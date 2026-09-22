/**
 * Bidirectional codec: QCET JSON v1 blocks ↔ Plate v53 Value.
 *
 * Constraints:
 * - Persistence format stays QCET JSON v1 (qcetBlocks: true, version: 1).
 * - Plate internal Value never persisted directly.
 * - All 12 QCET block types round-trip losslessly.
 * - Legacy plain text loads as single paragraph.
 * - Empty document serializes to "".
 */

import type { ContentBlockItem, ContentBlockType } from "./task-block-editor";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LEGACY_STRIP_TYPES = new Set([
  "subtasks_view",
  "subtasks",
  "componentTasks",
  "childTasks",
  "taskChildren",
  "activity_view",
  "properties_view",
]);

// Plate node types
const PT = {
  paragraph: "p",
  h1: "h1",
  h2: "h2",
  h3: "h3",
  blockquote: "blockquote",
  callout: "callout",
  hr: "hr",
  image: "qcet_image",
  attachment: "qcet_attachment",
  link: "qcet_link",
  bookmark: "qcet_bookmark",
  table: "table",
  tableRow: "tr",
  tableCell: "td",
  tableHeader: "th",
  toggle: "toggle",
  mention: "mention",
  mediaEmbed: "media_embed",
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal Slate element type used by Plate */
export interface PlateElement {
  id?: string;
  type: string;
  children: Array<{ text: string } | PlateElement>;
  // QCET metadata preserved on the node
  checked?: boolean;
  level?: 1 | 2 | 3;
  url?: string;
  fileName?: string;
  fileSize?: string;
  fileType?: string;
  caption?: string;
  imageWidth?: number;
  description?: string;
  favicon?: string;
  thumbnailUrl?: string;
  // Plate list fields
  listStyleType?: string;
  indent?: number;
  // Toggle
  open?: boolean;
  // Table
  header?: boolean;
  colSizes?: number[];
  // Mention
  value?: string;
}

export type PlateValue = PlateElement[];

// ---------------------------------------------------------------------------
// QCET → Plate
// ---------------------------------------------------------------------------

function blockToPlateElement(block: ContentBlockItem): PlateElement {
  const children: [{ text: string }] = [{ text: block.content || "" }];
  const base: PlateElement = { id: block.id, type: PT.paragraph, children };

  switch (block.type) {
    case "text":
      return base;

    case "heading": {
      const level = block.level || 2;
      const typeMap = { 1: PT.h1, 2: PT.h2, 3: PT.h3 } as const;
      return { ...base, type: typeMap[level] };
    }

    case "bulleted_list":
      return { ...base, listStyleType: "disc", indent: 1 };

    case "numbered_list":
      return { ...base, listStyleType: "decimal", indent: 1 };

    case "checklist":
      return {
        ...base,
        listStyleType: "disc",
        indent: 1,
        checked: block.checked ?? false,
      };

    case "quote":
      return { ...base, type: PT.blockquote };

    case "callout":
      return { ...base, type: PT.callout };

    case "divider":
      return { ...base, type: PT.hr, children: [{ text: "" }] };

    case "image":
      return {
        ...base,
        type: PT.image,
        url: block.url,
        caption: block.caption,
        imageWidth: block.imageWidth,
      };

    case "attachment":
      return {
        ...base,
        type: PT.attachment,
        url: block.url,
        fileName: block.fileName,
        fileSize: block.fileSize,
        fileType: block.fileType,
      };

    case "link":
      return {
        ...base,
        type: PT.link,
        url: block.url,
        description: block.description,
      };

    case "bookmark":
      return {
        ...base,
        type: PT.bookmark,
        url: block.url,
        description: block.description,
        favicon: block.favicon,
        thumbnailUrl: block.thumbnailUrl,
      };

    default:
      return base;
  }
}

export function blocksToPlate(blocks: ContentBlockItem[]): PlateValue {
  return blocks
    .filter((b) => b && !LEGACY_STRIP_TYPES.has(b.type))
    .map(blockToPlateElement);
}

// ---------------------------------------------------------------------------
// Plate → QCET
// ---------------------------------------------------------------------------

function textOf(el: PlateElement): string {
  return el.children
    .map((c) => ("text" in c ? c.text : ""))
    .join("");
}

function plateElementToBlock(el: PlateElement): ContentBlockItem {
  const id = el.id || `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const content = textOf(el);

  // List items (indent + listStyleType)
  if (el.indent && el.indent >= 1 && el.listStyleType) {
    if (typeof el.checked === "boolean") {
      return { id, type: "checklist", content, checked: el.checked };
    }
    if (el.listStyleType === "decimal") {
      return { id, type: "numbered_list", content };
    }
    return { id, type: "bulleted_list", content };
  }

  switch (el.type) {
    case PT.paragraph:
      return { id, type: "text", content };

    case PT.h1:
      return { id, type: "heading", content, level: 1 };
    case PT.h2:
      return { id, type: "heading", content, level: 2 };
    case PT.h3:
      return { id, type: "heading", content, level: 3 };

    case PT.blockquote:
      return { id, type: "quote", content };

    case PT.callout:
      return { id, type: "callout", content };

    case PT.hr:
      return { id, type: "divider", content: "" };

    case PT.image:
      return {
        id, type: "image", content,
        url: el.url, caption: el.caption, imageWidth: el.imageWidth,
      };

    case PT.attachment:
      return {
        id, type: "attachment", content,
        url: el.url, fileName: el.fileName, fileSize: el.fileSize, fileType: el.fileType,
      };

    case PT.link:
      return {
        id, type: "link", content,
        url: el.url, description: el.description,
      };

    case PT.bookmark:
      return {
        id, type: "bookmark", content,
        url: el.url, description: el.description,
        favicon: el.favicon, thumbnailUrl: el.thumbnailUrl,
      };

    default:
      return { id, type: "text", content };
  }
}

export function plateToBlocks(value: PlateValue): ContentBlockItem[] {
  return value.map(plateElementToBlock);
}

// ---------------------------------------------------------------------------
// Parse / Serialize (replacing the originals in task-block-editor.tsx)
// ---------------------------------------------------------------------------

export function isMeaningfulBlock(b: ContentBlockItem | null | undefined): boolean {
  if (!b) return false;
  if (b.type === "divider") return true;
  if (b.type === "image") return Boolean(b.url && b.url.trim().length > 0);

  if (b.type === "attachment") {
    const hasValidUrl = Boolean(b.url && b.url.trim() && b.url !== "https://" && b.url !== "https:///");
    const hasValidFile = Boolean(
      b.fileName && b.fileName.trim() &&
      b.fileName !== "Tài liệu đính kèm" && b.fileName !== "Tên tài liệu đính kèm..."
    );
    const hasContent = Boolean(
      b.content && b.content.trim() &&
      b.content !== "Tài liệu đính kèm" && b.content !== "Tên tài liệu đính kèm..."
    );
    return hasValidUrl || hasValidFile || hasContent;
  }

  if (b.type === "link" || b.type === "bookmark") {
    const hasValidUrl = Boolean(b.url && b.url.trim() && b.url !== "https://" && b.url !== "https:///");
    const hasContent = Boolean(b.content && b.content.trim() && b.content !== "Tiêu đề liên kết...");
    return hasValidUrl || hasContent;
  }

  return Boolean(b.content && b.content.trim().length > 0);
}

export function parseContentToBlocks(raw?: string | null): ContentBlockItem[] {
  if (!raw || !raw.trim()) {
    return [{ id: `b-${Date.now()}-1`, type: "text", content: "" }];
  }

  try {
    if (raw.includes('"qcetBlocks":true')) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.blocks) && parsed.blocks.length > 0) {
        const cleanedBlocks = parsed.blocks.filter(
          (b: any) => b && !LEGACY_STRIP_TYPES.has(b.type) && isMeaningfulBlock(b)
        );
        if (cleanedBlocks.length > 0) return cleanedBlocks;
        return [{ id: `b-${Date.now()}-1`, type: "text", content: "" }];
      }
    }
  } catch {
    // fallback plain text
  }

  return [{ id: `b-${Date.now()}-legacy`, type: "text", content: raw }];
}

export function serializeBlocksToContent(blocks: ContentBlockItem[]): string {
  const cleaned = blocks.filter(
    (b) => !LEGACY_STRIP_TYPES.has(b.type) && isMeaningfulBlock(b)
  );
  if (cleaned.length === 0) return "";
  return JSON.stringify({ qcetBlocks: true, version: 1, blocks: cleaned });
}

// ---------------------------------------------------------------------------
// Convenience: parse raw → Plate Value, serialize Plate Value → raw
// ---------------------------------------------------------------------------

export function parseToPlateValue(raw?: string | null): PlateValue {
  return blocksToPlate(parseContentToBlocks(raw));
}

export function serializePlateValue(value: PlateValue): string {
  return serializeBlocksToContent(plateToBlocks(value));
}

// Re-export Plate node type constants for use in editor plugin config
export { PT as PLATE_NODE_TYPES };
