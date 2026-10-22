"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import type { RenderElementProps } from "@platejs/core";
import {
  Plate,
  PlateContent,
  PlateContainer,
  usePluginOption,
  usePlateEditor,
  useEditorRef,
  useEditorSelector,
  createPlatePlugin,
} from "@platejs/core/react";
import {
  BaseParagraphPlugin,
  NodeIdPlugin,
  TrailingBlockPlugin,
  ExitBreakPlugin,
} from "platejs";
import {
  BaseH1Plugin,
  BaseH2Plugin,
  BaseH3Plugin,
  BaseBlockquotePlugin,
  BaseHorizontalRulePlugin,
  HeadingRules,
  BlockquoteRules,
  HorizontalRuleRules,
  BoldRules,
  ItalicRules,
  CodeRules,
  StrikethroughRules,
} from "@platejs/basic-nodes";
import {
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
  StrikethroughPlugin,
  CodePlugin,
  HighlightPlugin,
} from "@platejs/basic-nodes/react";
import { BaseCalloutPlugin } from "@platejs/callout";
import { BaseListPlugin, BulletedListRules, OrderedListRules, TaskListRules } from "@platejs/list";
import { BaseIndentPlugin, indent as plateIndent, outdent as plateOutdent } from "@platejs/indent";
import { LinkPlugin, triggerFloatingLinkInsert } from "@platejs/link/react";
import {
  TaskIconBlockText,
  TaskIconBlockBulletList,
  TaskIconBlockNumberedList,
  TaskIconBlockChecklist,
  TaskIconBlockHeading1,
  TaskIconBlockHeading2,
  TaskIconBlockHeading3,
  TaskIconBlockQuote,
  TaskIconBlockCallout,
  TaskIconBlockTable,
  TaskIconBlockToggle,
  TaskIconBlockImage,
  TaskIconBlockAttachment,
  TaskIconBlockEmbed,
  TaskIconBlockBookmark,
  TaskIconBlockLink,
  TaskIconBlockDivider,
} from "@qcet/shared/lib/icons/task-icons";
import { SlashPlugin, SlashInputPlugin } from "@platejs/slash-command/react";
import { BlockSelectionPlugin, useBlockSelectable, useBlockSelected } from "@platejs/selection/react";
import { DRAG_ITEM_BLOCK, DndPlugin, getDropPath, onHoverNode, useDragNode, useDraggable, useDropLine } from "@platejs/dnd";
import { DndContext, DndProvider, type DropTargetMonitor } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import {
  TablePlugin,
  TableRowPlugin,
  TableCellPlugin,
  TableCellHeaderPlugin,
} from "@platejs/table/react";
import { TogglePlugin } from "@platejs/toggle/react";
import { MentionPlugin, MentionInputPlugin } from "@platejs/mention/react";
import { MediaEmbedPlugin } from "@platejs/media/react";
import { TocPlugin } from "@platejs/toc/react";
import {
  autoUpdate,
  flip,
  offset,
  shift,
  size,
  useFloating,
  type Placement,
} from "@floating-ui/react";
import {
  Copy,
  ArrowRight,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code2,
  Link,
  GripVertical,
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Info,
  Minus,
  Link2,
  Trash2,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Circle,
  Image as ImageIcon,
  FileText,
  Bookmark,
  Globe,
  UploadCloud,
  Loader2,
  Highlighter,
  Table as TableIcon,
  AtSign,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  BookOpen,
  IndentIncrease,
  IndentDecrease,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadFile, type UploadedFile } from "@/lib/files/upload-file";
import { selectionTextRect } from "@/lib/selection-rect";
import { usePersonnelList, type PersonnelOption } from "@/hooks/use-personnel-list";
import type { StaffTask } from "@qcet/contracts/types/dashboard";
import {
  type PlateElement as PlateElemT,
  type PlateValue,
  parseToPlateValue,
  plateToBlocks,
  blocksToPlate,
  parseContentToBlocks,
  serializeBlocksToContent,
  isMeaningfulBlock,
  imageRowAt,
  IMAGE_ROW_MAX,
  PLATE_NODE_TYPES as PT,
  type ContentBlockItem,
  type ContentBlockType,
} from "@qcet/shared/lib/tasks/plate-block-codec";
import { Pressable } from "@/components/ui/pressable";
import { Kbd } from "@/components/ui/kbd";
import { ImageViewerTrigger } from "@/components/ui/image-viewer";
import { MENU_POPUP_CLASS, MenuActionItem, MenuContent, MenuRoot, MenuSubmenu, MenuTrigger } from "@/components/ui/menu";
import { rankSlashOptions, type SlashSearchable } from "./slash-menu-search";
import { insertSlashBlock } from "./slash-insert-block";
import { pruneEmptyBlocks } from "./prune-empty-blocks";
import { collabNodeIdPlugin } from "./collab-node-id";
import type { TaskCollabRuntime } from "./task-collab-runtime";

/** Props chung cho mọi element renderer trong QCET Plate editor */
type ElProps = RenderElementProps & {
  element: RenderElementProps["element"] & {
    indent?: number;
    listStyleType?: string;
    listStart?: number;
    checked?: boolean;
    textAlign?: React.CSSProperties["textAlign"];
    url?: string;
    value?: string;
    trigger?: string;
    title?: string;
    emoji?: string;
    children?: Array<{ text?: string; [key: string]: unknown }>;
  };
};

// ---------------------------------------------------------------------------
// Re-exports (public API unchanged)
// ---------------------------------------------------------------------------

export type { ContentBlockItem, ContentBlockType };
export { isMeaningfulBlock, parseContentToBlocks, serializeBlocksToContent };

export interface TaskBlockEditorProps {
  taskId: string;
  initialDescription?: string | null;
  placeholder?: string;
  subTasks?: StaffTask[];
  canEdit?: boolean;
  globalFileDrop?: boolean;
  /** Bộ chọn CSS của vùng cuộn dùng làm phạm vi kéo chọn nhiều khối (mặc định: chỉ trong khung soạn thảo) */
  selectionContainerSelector?: string;
  showFixedToolbar?: boolean;
  onSaveContent: (newContent: string) => Promise<void> | void;
  onSelectSubtask?: (subtask: StaffTask) => void;
  onOpenCreateSubtask?: () => void;
  className?: string;
  /**
   * compose: ô mô tả trong hộp tạo việc. Tay kéo khối nằm trong lề 24px của hộp (không chừa lề trái), ⌘/Ctrl+Enter để hộp gửi
   * (không chèn dòng thoát khối), báo nội dung ngay sau mỗi thay đổi (không debounce) để bấm Tạo không mất chữ cuối,
   * tệp tải lên chưa gắn nhiệm vụ (nhiệm vụ chưa có).
   */
  variant?: "page" | "compose";
  /** Nhãn truy cập của vùng soạn (contenteditable). */
  ariaLabel?: string;
  /** Đặt con trỏ vào cuối nội dung ngay khi gắn (ô ghi chú vừa mở). */
  autoFocus?: boolean;
  /**
   * Cùng sửa trực tiếp (ADR-014): nội dung đi qua tài liệu Yjs của máy chủ cộng tác, `onSaveContent` không được gọi (máy chủ tự
   * lưu và chiếu ra mô tả). Đọc lúc gắn: đổi chế độ thì gắn lại editor (`key`).
   */
  collab?: TaskEditorCollabOptions;
}

/** Một người khác đang mở cùng tài liệu (awareness của Yjs). */
export interface CollabPeer {
  clientId: number;
  userId: string;
  name: string;
  color: string;
}

export interface TaskEditorCollabOptions {
  /** `task:<id>` */
  documentName: string;
  /** ws(s)://<cùng tên miền>/collab */
  url: string;
  user: { id: string; name: string; color: string };
  onSyncChange?: (synced: boolean) => void;
  onPeersChange?: (peers: CollabPeer[]) => void;
  /** Phần Yjs (`task-collab-runtime`), nơi gọi import động: editor không import tĩnh để bản thường không phải tải Yjs. */
  runtime: TaskCollabRuntime;
}

// ---------------------------------------------------------------------------
// URL Metadata resolver (unchanged)
// ---------------------------------------------------------------------------

export interface UrlMetadata {
  url: string;
  title: string;
  domain: string;
  description?: string;
  favicon?: string;
  thumbnailUrl?: string;
  isInternalQcet?: boolean;
  entityType?: string;
}

export function resolveUrlMetadata(rawUrl: string, currentTaskTitle?: string): UrlMetadata {
  let url = rawUrl.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("/")) {
    url = `https://${url}`;
  }

  try {
    const parsed = new URL(url, "https://qcet.edu.vn");
    const domain = parsed.hostname;
    const pathname = parsed.pathname;

    // Kiểm tra link thực thể nội bộ QCET E-Office
    if (domain.includes("qcet.edu.vn") || domain === "localhost" || rawUrl.startsWith("/")) {
      if (pathname.includes("/tasks/")) {
        const taskId = pathname.split("/tasks/")[1]?.split("/")[0] || "";
        return {
          url,
          title: taskId ? `Nhiệm vụ: ${currentTaskTitle || taskId}` : "Chi tiết nhiệm vụ QCET",
          domain: "QCET E-Office",
          description: "Hệ thống quản lý công việc và nhiệm vụ nội bộ",
          isInternalQcet: true,
          entityType: "task",
        };
      }
      if (pathname.includes("/documents/") || pathname.includes("/van-ban/")) {
        return {
          url,
          title: "Văn bản & Hồ sơ QCET",
          domain: "QCET E-Office",
          description: "Văn bản chỉ đạo, hồ sơ hành chính nội bộ",
          isInternalQcet: true,
          entityType: "document",
        };
      }
      if (pathname.includes("/meetings/")) {
        return {
          url,
          title: "Cuộc họp",
          domain: "QCET E-Office",
          description: "Chương trình, thành phần và biên bản cuộc họp",
          isInternalQcet: true,
          entityType: "meeting",
        };
      }
      if (pathname.includes("/schedule/") || pathname.includes("/lich-tuan/")) {
        return {
          url,
          title: "Lịch công tác trường",
          domain: "QCET E-Office",
          description: "Lịch tuần và sự kiện công tác toàn trường",
          isInternalQcet: true,
          entityType: "schedule",
        };
      }
    }

    // Link bên ngoài: Trích xuất tên trang từ domain
    const cleanDomain = domain.replace(/^www\./, "");
    let siteName = cleanDomain;
    if (cleanDomain.includes("google.com")) siteName = "Google Drive / Docs";
    else if (cleanDomain.includes("github.com")) siteName = "GitHub Repository";
    else if (cleanDomain.includes("youtube.com") || cleanDomain.includes("youtu.be")) siteName = "YouTube Video";
    else if (cleanDomain.includes("canva.com")) siteName = "Canva Design";
    else if (cleanDomain.includes("figma.com")) siteName = "Figma File";
    else if (cleanDomain.includes("notion.site") || cleanDomain.includes("notion.so")) siteName = "Notion Page";
    else if (cleanDomain.includes("zalo.me")) siteName = "Zalo Group / Chat";

    return {
      url,
      title: siteName,
      domain: cleanDomain,
      description: "Liên kết ngoài được đính kèm trong nội dung nhiệm vụ",
      favicon: `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=32`,
      isInternalQcet: false,
    };
  } catch {
    return {
      url,
      title: url,
      domain: "Liên kết ngoài",
      isInternalQcet: false,
    };
  }
}

/**
 * Thanh nút trên ảnh (độ rộng, xóa): hiện khi rê chuột hoặc focus vào ảnh;
 * màn cảm ứng không có hover nên luôn hiện (cùng cách với nút thao tác ở hàng bảng nhiệm vụ).
 */
const IMAGE_TOOLBAR_REVEAL =
  "opacity-0 transition-opacity group-hover/image:opacity-100 group-focus-within/image:opacity-100 [@media(hover:none)]:opacity-100";

// ---------------------------------------------------------------------------
// Menu item options for Slash command & Quick action
// ---------------------------------------------------------------------------

interface MenuItemOption extends SlashSearchable {
  id: string;
  type: ContentBlockType;
  group: "Khối cơ bản" | "Tệp & liên kết";
  icon: React.ComponentType<{ className?: string }>;
  /** Chỉ ghi phím tắt markdown editor thật sự đổi được (Plate inputRules), không lặp lại tên lệnh "/" */
  shortcut?: string;
  level?: 1 | 2 | 3;
}

// Hai nhóm như "Basic blocks"/"Media" của Notion (trước 21/10/2026 là tám nhóm, nhóm 1–2 mục làm menu dài và phải cuộn).
// Từ khóa gồm tên tiếng Anh quen dùng ở Notion/Linear để gõ "/h1", "/todo", "/image" vẫn ra. Mô tả hiện ở chân menu cho mục
// đang chọn (tên như "Khối thu gọn", "Dấu trang web" chưa đủ rõ) nên giữ một dòng, vừa menu rộng 256px.
export const MENU_OPTIONS: MenuItemOption[] = [
  { id: "opt-text", type: "text", group: "Khối cơ bản", title: "Văn bản", description: "Đoạn văn thường", icon: TaskIconBlockText, keywords: ["text", "paragraph", "doan van"] },
  { id: "opt-h1", type: "heading", level: 1, group: "Khối cơ bản", title: "Tiêu đề 1", description: "Tiêu đề lớn cho phần chính", icon: TaskIconBlockHeading1, shortcut: "#", keywords: ["h1", "heading 1"] },
  { id: "opt-h2", type: "heading", level: 2, group: "Khối cơ bản", title: "Tiêu đề 2", description: "Tiêu đề vừa cho từng mục", icon: TaskIconBlockHeading2, shortcut: "##", keywords: ["h2", "heading 2"] },
  { id: "opt-h3", type: "heading", level: 3, group: "Khối cơ bản", title: "Tiêu đề 3", description: "Tiêu đề nhỏ cho ý trong mục", icon: TaskIconBlockHeading3, shortcut: "###", keywords: ["h3", "heading 3"] },
  { id: "opt-bulleted", type: "bulleted_list", group: "Khối cơ bản", title: "Danh sách dấu đầu dòng", description: "Liệt kê các ý không theo thứ tự", icon: TaskIconBlockBulletList, shortcut: "-", keywords: ["bullet", "ul", "list", "gach dau dong"] },
  { id: "opt-numbered", type: "numbered_list", group: "Khối cơ bản", title: "Danh sách đánh số", description: "Liệt kê theo thứ tự 1, 2, 3", icon: TaskIconBlockNumberedList, shortcut: "1.", keywords: ["numbered", "ol", "list", "so thu tu"] },
  { id: "opt-checklist", type: "checklist", group: "Khối cơ bản", title: "Checklist", description: "Việc cần làm có ô đánh dấu", icon: TaskIconBlockChecklist, shortcut: "[]", keywords: ["todo", "to-do", "task", "viec can lam"] },
  { id: "opt-toggle", type: "toggle", group: "Khối cơ bản", title: "Khối thu gọn", description: "Ẩn bớt nội dung dài, bấm để mở ra", icon: TaskIconBlockToggle, keywords: ["toggle", "collapse", "an hien"] },
  { id: "opt-quote", type: "quote", group: "Khối cơ bản", title: "Trích dẫn", description: "Trích ý kiến hoặc chỉ đạo", icon: TaskIconBlockQuote, shortcut: ">", keywords: ["quote", "blockquote"] },
  { id: "opt-callout", type: "callout", group: "Khối cơ bản", title: "Ghi chú nổi bật", description: "Hộp làm nổi bật lưu ý quan trọng", icon: TaskIconBlockCallout, keywords: ["callout", "note", "luu y"] },
  { id: "opt-divider", type: "divider", group: "Khối cơ bản", title: "Đường phân cách", description: "Kẻ ngang chia tách các phần", icon: TaskIconBlockDivider, shortcut: "---", keywords: ["divider", "hr", "line", "ke ngang"] },
  { id: "opt-table", type: "table", group: "Khối cơ bản", title: "Bảng biểu", description: "Bảng phân công, số liệu báo cáo", icon: TaskIconBlockTable, keywords: ["table"] },
  { id: "opt-image", type: "image", group: "Tệp & liên kết", title: "Hình ảnh", description: "Tải lên hoặc dán ảnh", icon: TaskIconBlockImage, keywords: ["image", "img", "photo", "picture", "anh"] },
  { id: "opt-attachment", type: "attachment", group: "Tệp & liên kết", title: "Tệp đính kèm", description: "Đính kèm PDF, DOCX, bảng tính", icon: TaskIconBlockAttachment, keywords: ["file", "attach", "attachment", "pdf", "tai lieu"] },
  { id: "opt-media-embed", type: "media_embed", group: "Tệp & liên kết", title: "Nhúng phương tiện", description: "Video YouTube, Loom, Google Drive", icon: TaskIconBlockEmbed, keywords: ["embed", "video", "youtube", "loom", "drive"] },
  { id: "opt-link", type: "link", group: "Tệp & liên kết", title: "Liên kết", description: "Đường dẫn tới trang web hoặc tài liệu", icon: TaskIconBlockLink, keywords: ["link", "url"] },
  { id: "opt-bookmark", type: "bookmark", group: "Tệp & liên kết", title: "Dấu trang web", description: "Thẻ xem trước của một trang web", icon: TaskIconBlockBookmark, keywords: ["bookmark", "preview"] },
];

// ---------------------------------------------------------------------------
// Custom Plate plugins for QCET void & custom block types
// ---------------------------------------------------------------------------

const QcetImagePlugin = createPlatePlugin({
  key: PT.image,
  node: { isElement: true, isVoid: true, type: PT.image },
});

const QcetAttachmentPlugin = createPlatePlugin({
  key: PT.attachment,
  node: { isElement: true, isVoid: true, type: PT.attachment },
});

const QcetLinkBlockPlugin = createPlatePlugin({
  key: PT.link,
  node: { isElement: true, isVoid: true, type: PT.link },
});

const QcetBookmarkPlugin = createPlatePlugin({
  key: PT.bookmark,
  node: { isElement: true, isVoid: true, type: PT.bookmark },
});

// Alignment Plugin using Plate nodeProps inject
const QcetAlignPlugin = createPlatePlugin({
  key: "align",
  inject: {
    nodeProps: {
      styleKey: "textAlign",
      validNodeValues: ["left", "center", "right", "justify"],
      defaultNodeValue: "left",
    },
    targetPlugins: [
      BaseParagraphPlugin.key,
      BaseH1Plugin.key,
      BaseH2Plugin.key,
      BaseH3Plugin.key,
      BaseBlockquotePlugin.key,
      BaseCalloutPlugin.key,
    ],
  },
});

// ---------------------------------------------------------------------------
// Plate element render components
// ---------------------------------------------------------------------------

/**
 * Đoạn văn là `<p>`, mục danh sách là `<ul>`/`<ol>` bọc `<li aria-level>`: đúng thẻ mà bộ đọc HTML của Plate nhận ra
 * (BaseParagraphPlugin đọc `P`, BaseListPlugin đọc `LI` + `aria-level` + kiểu của danh sách cha), nên chữ chọn bằng chuột
 * rồi dán vào ô khác hay ứng dụng khác vẫn giữ được đoạn và gạch đầu dòng. `li` hiển thị flex nên không hiện dấu mặc định.
 */
function ParagraphEl({ attributes, children, element }: RenderElementProps<any>) {
  const editor = useEditorRef();
  const indent = element.indent;
  const listStyle = element.listStyleType;
  const checked = element.checked;
  const textAlign = element.textAlign;
  // Thụt lề theo cấp, 24px mỗi cấp như BaseIndentPlugin; danh sách cấp 1 nằm sát lề vì dấu đầu dòng đã chiếm chỗ.
  // Tự tính vì style riêng của khối thay style Plate chèn vào `attributes`.
  const indentLevel = (indent ?? 0) - (listStyle && indent >= 1 ? 1 : 0);
  const alignStyle = {
    ...(textAlign ? { textAlign } : {}),
    ...(indentLevel > 0 ? { marginLeft: indentLevel * 24 } : {}),
  };

  if (indent >= 1 && listStyle) {
    if (typeof checked === "boolean") {
      const toggleChecked = () => {
        if (!editor.api.isReadOnly()) {
          const path = editor.api.findPath(element);
          if (path) editor.tf.setNodes({ checked: !checked } as any, { at: path });
        }
      };
      return (
        <ul {...attributes} style={{ ...alignStyle, listStyleType: listStyle }}>
          <li aria-level={indent} className="flex items-start gap-2.5 py-0.5 text-sm leading-relaxed">
            <Pressable contentEditable={false} onClick={toggleChecked} className="mt-0.5 shrink-0 select-none" aria-label={checked ? "Đánh dấu chưa xong" : "Đánh dấu hoàn thành"}>
              {checked ? (
                <CheckCircle2 className="size-4 text-emerald-600 fill-emerald-100" />
              ) : (
                <Circle className="size-4 text-muted-foreground/60 hover:text-foreground" />
              )}
            </Pressable>
            <span className={cn("flex-1 min-w-0", checked && "line-through text-muted-foreground/70")}>
              {children}
            </span>
          </li>
        </ul>
      );
    }
    if (listStyle === "decimal") {
      return (
        <ol {...attributes} start={element.listStart ?? 1} style={{ ...alignStyle, listStyleType: listStyle }}>
          <li aria-level={indent} className="flex items-start gap-2 py-0.5 text-sm leading-relaxed">
            <span contentEditable={false} className="font-mono text-xs text-muted-foreground font-semibold shrink-0 mt-0.5 w-4 text-right select-none">
              {(element.listStart ?? 1)}.
            </span>
            <span className="flex-1 min-w-0">{children}</span>
          </li>
        </ol>
      );
    }
    return (
      <ul {...attributes} style={{ ...alignStyle, listStyleType: listStyle }}>
        <li aria-level={indent} className="flex items-start gap-2 py-0.5 text-sm leading-relaxed">
          <span contentEditable={false} className="size-1.5 rounded-full bg-foreground/70 shrink-0 mt-2 select-none" />
          <span className="flex-1 min-w-0">{children}</span>
        </li>
      </ul>
    );
  }

  return (
    <p {...attributes} style={alignStyle} className="text-sm leading-relaxed text-foreground py-0.5">
      {children}
    </p>
  );
}

function H1El({ attributes, children, element }: RenderElementProps<any>) {
  return <h1 {...attributes} style={{ ...attributes.style, ...(element.textAlign ? { textAlign: element.textAlign } : {}) }} className="text-xl sm:text-2xl mt-2 mb-0.5 font-bold tracking-tight text-foreground">{children}</h1>;
}

function H2El({ attributes, children, element }: RenderElementProps<any>) {
  return <h2 {...attributes} style={{ ...attributes.style, ...(element.textAlign ? { textAlign: element.textAlign } : {}) }} className="text-base sm:text-lg font-semibold mt-1.5 mb-0.5 tracking-tight text-foreground">{children}</h2>;
}

function H3El({ attributes, children, element }: RenderElementProps<any>) {
  return <h3 {...attributes} style={{ ...attributes.style, ...(element.textAlign ? { textAlign: element.textAlign } : {}) }} className="text-sm sm:text-base font-semibold mt-1 mb-0.5 tracking-tight text-foreground">{children}</h3>;
}

function BlockquoteEl({ attributes, children, element }: RenderElementProps<any>) {
  return <blockquote {...attributes} style={{ ...attributes.style, ...(element.textAlign ? { textAlign: element.textAlign } : {}) }} className="border-l-2 border-primary/70 pl-3 py-1 my-0.5 italic text-foreground/90 text-sm leading-relaxed">{children}</blockquote>;
}

function CalloutEl({ attributes, children }: Pick<ElProps, "attributes" | "children">) {
  return (
    <div {...attributes} className="flex items-start gap-2 px-2.5 py-1.5 my-1 rounded-xl bg-primary/5 border border-primary/20 text-foreground text-sm leading-relaxed">
      <Info className="size-4 text-primary shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function HrEl({ attributes, children }: Pick<ElProps, "attributes" | "children">) {
  return (
    <div {...attributes} contentEditable={false} className="py-2 my-0.5 flex items-center">
      <div className="w-full h-px bg-border/80" />
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table Components
// ---------------------------------------------------------------------------

function TableEl({ attributes, children }: Pick<ElProps, "attributes" | "children">) {
  return (
    <div className="my-3 overflow-x-auto rounded-lg border border-border/50">
      <table {...attributes} className="w-full border-collapse text-sm text-left">
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function TableRowEl({ attributes, children }: Pick<ElProps, "attributes" | "children">) {
  return <tr {...attributes} className="border-b border-border/30 last:border-b-0">{children}</tr>;
}

function TableCellEl({ attributes, children }: Pick<ElProps, "attributes" | "children">) {
  return <td {...attributes} className="border-r border-border/30 last:border-r-0 px-3 py-2 min-w-[100px] min-h-[36px] align-top text-foreground leading-relaxed relative group/cell [&[data-selected]]:bg-selected">{children}</td>;
}

function TableCellHeaderEl({ attributes, children }: Pick<ElProps, "attributes" | "children">) {
  return <th {...attributes} className="border-r border-border/30 last:border-r-0 bg-muted/30 px-3 py-2 min-w-[100px] min-h-[36px] align-top font-semibold text-foreground leading-relaxed select-none relative [&[data-selected]]:bg-selected">{children}</th>;
}

// ---------------------------------------------------------------------------
// Toggle (Collapsible) Component
// ---------------------------------------------------------------------------

function ToggleEl({ attributes, children, element }: RenderElementProps<any>) {
  const editor = useEditorRef();
  const isOpen = element.open ?? true;

  const handleToggle = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editor.api.isReadOnly()) {
      const path = editor.api.findPath(element);
      if (path) {
        editor.tf.setNodes({ open: !isOpen } as any, { at: path });
      }
    }
  }, [editor, element, isOpen]);

  return (
    <div {...attributes} className="my-1.5 rounded-lg border border-border/40 bg-muted/10 p-1 transition-colors">
      <div className="flex items-start gap-1.5">
        <Pressable
          contentEditable={false}
          onClick={handleToggle}
          className="mt-0.5 size-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-transform"
          aria-label={isOpen ? "Thu gọn" : "Mở rộng"}
        >
          <ChevronRight className={cn("size-3.5 transition-transform duration-150", isOpen && "rotate-90")} />
        </Pressable>
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mention Components
// ---------------------------------------------------------------------------

function MentionEl({ attributes, children, element }: ElProps) {
  return (
    <span
      {...attributes}
      contentEditable={false}
      className="inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary text-xs font-medium select-none align-baseline"
      title={`Cán bộ QCET: ${element.value || ""}`}
    >
      <AtSign className="size-3" />
      <span>{element.value || "Cán bộ"}</span>
      {children}
    </span>
  );
}

function MentionInputElement({ attributes, children, element }: RenderElementProps<any>) {
  const editor = useEditorRef();
  const { personnel } = usePersonnelList();
  const query = (element.children?.[0]?.text || "").replace(/^@/, "").toLowerCase();
  const filtered = React.useMemo(() => {
    if (!query) return personnel;
    return personnel.filter((s) =>
      s.name.toLowerCase().includes(query) ||
      (s.email && s.email.toLowerCase().includes(query))
    );
  }, [query, personnel]);

  const selectStaff = React.useCallback((staff: PersonnelOption) => {
    const path = editor.api.findPath(element);
    if (path) {
      editor.tf.removeNodes({ at: path });
      editor.tf.insertNodes([
        {
          type: PT.mention,
          key: staff.id,
          value: staff.name,
          children: [{ text: "" }],
        } as any,
        { text: " " },
      ], { at: path });
    }
  }, [editor, element]);

  return (
    <span {...attributes} className="relative inline">
      <span className="text-primary font-medium">@{query}</span>
      <div contentEditable={false} className="absolute left-0 top-full mt-1 z-50 w-64 origin-top-left rounded-lg border border-border/80 bg-card p-1 shadow-lg animate-in fade-in-0 zoom-in-95 duration-100">
        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Nhân sự QCET</div>
        <div className="max-h-48 overflow-y-scroll space-y-0.5">
          {filtered.map((staff) => (
            <Pressable
              key={staff.id}
              onMouseDown={(e) => { e.preventDefault(); selectStaff(staff); }}
              className="flex w-full items-center justify-between px-2 py-1.5 rounded-md hover:bg-muted text-xs text-left"
            >
              <div>
                <div className="font-medium text-foreground">{staff.name}</div>
                <div className="text-xs text-muted-foreground">{staff.departmentName || ""}</div>
              </div>
            </Pressable>
          ))}
          {filtered.length === 0 && (
            <div className="px-2 py-2 text-xs text-muted-foreground text-center">Không tìm thấy cán bộ</div>
          )}
        </div>
      </div>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Media Embed Component
// ---------------------------------------------------------------------------

function MediaEmbedEl({ attributes, children, element }: any) {
  const editor = useEditorRef();
  const { url } = element;
  const [draftUrl, setDraftUrl] = React.useState("");

  const applyUrl = () => {
    const next = draftUrl.trim();
    if (!/^https?:\/\/\S+$/i.test(next)) return;
    const path = editor.api.findPath(element);
    if (path) editor.tf.setNodes({ url: next } as any, { at: path });
  };

  return (
    <div {...attributes} className="my-3">
      <div contentEditable={false} className="aspect-video w-full rounded-xl overflow-hidden border border-border/60 bg-muted/20 shadow-2xs">
        {url ? (
          <iframe
            src={url.includes("youtube.com/watch?v=") ? url.replace("watch?v=", "embed/") : url}
            title="Nhúng phương tiện"
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 px-6 text-xs text-muted-foreground">
            <TaskIconBlockEmbed className="size-6" />
            <span>Dán đường dẫn YouTube, Loom hoặc Drive</span>
            <div className="flex w-full max-w-sm items-center gap-1.5">
              <input
                value={draftUrl}
                onChange={(e) => setDraftUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyUrl();
                  }
                }}
                placeholder="https://..."
                aria-label="Đường dẫn nhúng"
                className="h-7 min-w-0 flex-1 rounded-md bg-muted/60 px-2 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:bg-muted"
              />
              <Pressable
                onClick={applyUrl}
                className="h-7 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                Nhúng
              </Pressable>
            </div>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TOC Component
// ---------------------------------------------------------------------------

function TocEl({ attributes, children }: any) {
  return (
    <div {...attributes} contentEditable={false} className="my-3 p-3 rounded-xl border border-primary/20 bg-primary/5 text-xs">
      <div className="flex items-center gap-1.5 font-semibold text-primary mb-2">
        <BookOpen className="size-4" />
        <span>Mục lục nội dung</span>
      </div>
      <div className="text-muted-foreground italic">Mục lục được tự động trích xuất từ các tiêu đề H1, H2, H3.</div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Media / Attachment / Link / Bookmark Renderers (existing)
// ---------------------------------------------------------------------------

interface TaskEditorUploadContextValue {
  uploadFileToServer?: (file: File) => Promise<{ fileUrl: string; fileName: string } | null>;
  taskId?: string;
  triggerAutoSave?: (val: PlateValue) => void;
}
const TaskEditorUploadContext = React.createContext<TaskEditorUploadContextValue>({});

// Ảnh vừa tải lên trong phiên trang: URL máy chủ → bản xem trước cục bộ (blob). Ảnh chèn lúc soạn nhiệm vụ mới chưa gắn
// tài nguyên nào nên máy chủ chưa cho tải lại cho tới khi nhiệm vụ được tạo; khối ảnh hiển thị bản cục bộ thay thế.
const localImagePreviews = new Map<string, string>();

function ImageEl({ attributes, children, element }: any) {
  const editor = useEditorRef();
  const uploadCtx = React.useContext(TaskEditorUploadContext);
  // Kéo bằng chính ảnh (không chỉ tay kéo ⠿): thả vào mép trái/phải ảnh khác để xếp cạnh nhau (BlockRowDraggable nhận thả).
  // Bấm không kéo vẫn mở trình xem; sau khi kéo trình duyệt không phát click nên không mở nhầm.
  const [{ isDragging: imageDragging }, imageDragRef] = useDragNode(editor, {
    element,
    type: DRAG_ITEM_BLOCK,
    canDrag: () => !editor.api.isReadOnly(),
  });
  const { dropLine: sideDropLine } = useDropLine({ orientation: "horizontal" });
  const { url, caption, imageWidth = 100 } = element;
  const [captionValue, setCaptionValue] = React.useState(caption || "");
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [imageLoadError, setImageLoadError] = React.useState(false);

  React.useEffect(() => {
    setCaptionValue(caption || "");
  }, [caption]);

  React.useEffect(() => {
    setImageLoadError(false);
  }, [url]);

  const commitCaption = React.useCallback((newCaption: string) => {
    if (editor.api.isReadOnly()) return;
    const path = editor.api.findPath(element);
    if (path) {
      editor.tf.setNodes(
        { caption: newCaption, content: newCaption } as any,
        { at: path }
      );
    }
  }, [editor, element]);

  const setImageUrl = React.useCallback((newUrl: string, newCaption?: string) => {
    const path = editor.api.findPath(element);
    if (path) {
      editor.tf.setNodes(
        {
          url: newUrl,
          caption: newCaption !== undefined ? newCaption : (element.caption || ""),
          content: newCaption !== undefined ? newCaption : (element.content || element.children?.[0]?.text || ""),
          imageWidth: 100,
        } as any,
        { at: path }
      );
    }
  }, [editor, element]);

  const handleUploadFile = React.useCallback(async (f: File) => {
    if (!f || editor.api.isReadOnly()) return;
    setIsUploading(true);
    setUploadError(null);
    setImageLoadError(false);

    let objectUrl = "";
    try {
      objectUrl = URL.createObjectURL(f);
    } catch {}

    if (objectUrl) {
      setImageUrl(objectUrl, f.name);
    }

    if (uploadCtx.uploadFileToServer) {
      try {
        const result = await uploadCtx.uploadFileToServer(f);
        setIsUploading(false);
        if (!result) {
          setUploadError("Không thể tải ảnh lên máy chủ");
          setImageUrl("", f.name);
          return;
        }
        if (objectUrl) localImagePreviews.set(result.fileUrl, objectUrl);
        setImageUrl(result.fileUrl, f.name);
        uploadCtx.triggerAutoSave?.(editor.children as PlateValue);
      } catch (err) {
        setIsUploading(false);
        setUploadError(err instanceof Error ? err.message : "Lỗi khi tải ảnh lên");
        setImageUrl("", f.name);
      }
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setIsUploading(false);
        setImageUrl(ev.target?.result as string, f.name);
        uploadCtx.triggerAutoSave?.(editor.children as PlateValue);
      };
      reader.onerror = () => {
        setIsUploading(false);
        setUploadError("Không thể đọc tệp ảnh");
        setImageUrl("", f.name);
      };
      reader.readAsDataURL(f);
    }
  }, [editor, element, setImageUrl, uploadCtx]);

  return (
    <div {...attributes}>
      <div contentEditable={false} className="py-1">
        {url ? (
          <div className="relative group/image my-2 max-w-full">
            {/* Trong hàng ảnh: ảnh lấp đầy ô của nó (bỏ cỡ 25–100%), ẩn thanh chọn cỡ */}
            <div
              ref={(node) => {
                imageDragRef(node);
              }}
              data-image-frame=""
              style={{ width: `${imageWidth}%` }}
              className={cn(
                "relative mx-auto transition-all duration-150 group-data-[image-row=true]/block:w-full!",
                // Kéo bằng ảnh thì mờ như kéo bằng tay kéo (cờ isDragging của khối chỉ theo tay kéo)
                imageDragging && "opacity-50"
              )}
            >
              {!imageLoadError ? (
                // Bấm ảnh mở trình xem toàn màn hình; các ảnh khác trong cùng editor xem nối tiếp (nhóm ở khung editor)
                <ImageViewerTrigger src={localImagePreviews.get(url) ?? url} title={caption || "Hình ảnh"} className="w-full rounded-lg">
                  <img
                    src={localImagePreviews.get(url) ?? url}
                    alt={caption || "Hình ảnh"}
                    draggable={false}
                    className="w-full h-auto max-h-[640px] object-contain rounded-lg select-none"
                    loading="lazy"
                    onError={() => setImageLoadError(true)}
                  />
                </ImageViewerTrigger>
              ) : (
                <div className="flex flex-col items-center justify-center p-6 rounded-lg border border-dashed border-destructive/40 bg-destructive/5 text-center my-2">
                  <ImageIcon className="size-8 text-destructive/60 mb-2" />
                  <p className="text-xs font-medium text-destructive">Không thể hiển thị hình ảnh</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Tệp có thể đang chờ kiểm tra hoặc liên kết đã thay đổi.</p>
                  {!editor.api.isReadOnly() && (
                    <div className="flex items-center gap-2 mt-3">
                      <Pressable
                        onClick={() => setImageLoadError(false)}
                        className="px-2.5 py-1 text-xs rounded-md bg-background border border-border hover:bg-muted text-foreground transition-colors"
                      >
                        Thử lại
                      </Pressable>
                      <label className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90 cursor-pointer transition-opacity">
                        <UploadCloud className="size-3" />
                        <span>Tải ảnh khác</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUploadFile(f);
                          }}
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}
              {isUploading && (
                <div className="absolute inset-0 bg-background/60 backdrop-blur-2xs flex items-center justify-center rounded-lg">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background/90 shadow-sm border border-border text-xs text-foreground font-medium">
                    <Loader2 className="size-3.5 animate-spin text-primary" />
                    <span>Đang tải ảnh lên máy chủ...</span>
                  </div>
                </div>
              )}
              {sideDropLine === "left" || sideDropLine === "right" ? (
                <div
                  aria-hidden="true"
                  data-slot="image-side-drop-indicator"
                  className={cn(
                    "pointer-events-none absolute inset-y-0 z-20 w-0.5 rounded-full bg-primary",
                    sideDropLine === "left" ? "-left-1.5" : "-right-1.5"
                  )}
                />
              ) : null}
              {!editor.api.isReadOnly() && !imageLoadError && (
                <div className={cn("absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1 p-0.5 rounded bg-background/80 border border-border/60 select-none group-data-[image-row=true]/block:hidden", IMAGE_TOOLBAR_REVEAL)}>
                  {[25, 50, 75, 100].map((w) => (
                    <Pressable
                      key={w}
                      onClick={() => {
                        const p = editor.api.findPath(element);
                        if (p) editor.tf.setNodes({ imageWidth: w } as any, { at: p });
                      }}
                      className={cn("px-1.5 py-0.5 text-xs rounded", imageWidth === w ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
                    >
                      {w}%
                    </Pressable>
                  ))}
                </div>
              )}
              <div className={cn("absolute top-2 right-2 flex items-center gap-1 p-1 rounded-lg bg-background/80 border border-border/60 select-none", IMAGE_TOOLBAR_REVEAL)}>
                <Pressable
                  onClick={() => {
                    if (!editor.api.isReadOnly()) {
                      const p = editor.api.findPath(element);
                      if (p) editor.tf.removeNodes({ at: p });
                    }
                  }}
                  className="p-1 rounded hover:bg-danger-soft text-muted-foreground hover:text-destructive"
                  title="Xóa"
                >
                  <Trash2 className="size-3.5" />
                </Pressable>
              </div>
            </div>
            {!editor.api.isReadOnly() ? (
              // Điện thoại: CSS chung ép ô nhập 16px để iPhone không phóng trang khi chạm; giữ 16px thật nhưng thu hình còn 12px
              // (scale 0.75, rộng bù 133% và lùi lề để vẫn căn giữa đúng bề rộng ảnh), nên chú thích không to hơn chữ phụ
              <div style={{ maxWidth: `${imageWidth}%`, margin: "6px auto 0" }} className="group-data-[image-row=true]/block:max-w-full!">
              <input
                type="text"
                value={captionValue}
                placeholder="Thêm chú thích..."
                onChange={(ev) => setCaptionValue(ev.target.value)}
                onBlur={() => commitCaption(captionValue)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter") {
                    ev.preventDefault();
                    commitCaption(captionValue);
                    (ev.target as HTMLElement).blur();
                  }
                }}
                className="block w-full text-xs text-muted-foreground text-center bg-transparent border-0 outline-none focus:text-foreground placeholder:text-muted-foreground/40 max-sm:-mx-[16.667%] max-sm:-my-1 max-sm:w-[133.333%] max-sm:max-w-none max-sm:scale-75"
              />
              </div>
            ) : caption ? (
              <p
                className="block w-full mt-1.5 text-xs text-muted-foreground text-center italic group-data-[image-row=true]/block:max-w-full!"
                style={{ maxWidth: `${imageWidth}%`, margin: "6px auto 0" }}
              >
                {caption}
              </p>
            ) : null}
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const f = e.dataTransfer.files?.[0];
              if (f && f.type.startsWith("image/")) {
                handleUploadFile(f);
              }
            }}
            className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-muted/40 border border-dashed border-border/80 text-xs"
          >
            <div className="flex items-center gap-2">
              <ImageIcon className="size-4 text-primary shrink-0" />
              <span className="text-muted-foreground text-xs">Kéo thả ảnh vào đây hoặc bấm để chọn</span>
            </div>
            <div className="flex items-center gap-2">
              {uploadError && <span className="text-destructive text-xs">{uploadError}</span>}
              <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity cursor-pointer shadow-2xs">
                {isUploading ? <Loader2 className="size-3.5 animate-spin" /> : <UploadCloud className="size-3.5" />}
                <span>{isUploading ? "Đang tải ảnh..." : "Tải ảnh lên"}</span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={isUploading}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadFile(f);
                  }}
                />
              </label>
            </div>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function AttachmentEl({ attributes, children, element }: any) {
  const editor = useEditorRef();
  const uploadCtx = React.useContext(TaskEditorUploadContext);
  const { fileName, fileSize, fileType, url } = element;
  const [isUploading, setIsUploading] = React.useState(false);
  const meta = [fileType, fileSize].filter(Boolean).join(" · ");

  const handleUploadFile = React.useCallback(async (f: File) => {
    if (!f || editor.api.isReadOnly()) return;
    setIsUploading(true);
    const formatSize = (bytes: number) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };
    const ext = f.name.split(".").pop()?.toUpperCase() || "TỆP";

    if (uploadCtx.uploadFileToServer) {
      try {
        const result = await uploadCtx.uploadFileToServer(f);
        setIsUploading(false);
        if (result) {
          const path = editor.api.findPath(element);
          if (path) {
            editor.tf.setNodes(
              {
                url: result.fileUrl,
                fileName: f.name,
                fileSize: formatSize(f.size),
                fileType: ext,
                content: f.name,
              } as any,
              { at: path }
            );
            uploadCtx.triggerAutoSave?.(editor.children as PlateValue);
          }
        }
      } catch {
        setIsUploading(false);
      }
    }
  }, [editor, element, uploadCtx]);

  const inner = (
    <div className="inline-flex min-w-0 items-center gap-1.5 py-0.5 px-1.5 my-0.5 rounded-md bg-muted/40 hover:bg-muted/70 border border-border/40 transition-colors text-xs max-w-full group/file">
      <FileText className="size-3.5 text-muted-foreground shrink-0" />
      <span className="min-w-0 font-medium text-foreground truncate" title={fileName || undefined}>{fileName || "Tệp"}</span>
      {meta && <span className="text-muted-foreground shrink-0 font-mono">{meta}</span>}
      {url && <ExternalLink className="size-3 text-muted-foreground opacity-0 group-hover/file:opacity-100 transition-opacity shrink-0" />}
    </div>
  );
  return (
    <div {...attributes}>
      <div contentEditable={false} className="py-0.5">
        {url ? (
          // w-fit + max-w-full: thẻ tệp co theo tên nhưng không vượt khung (màn hẹp, ngăn việc con), tên dài cắt "…"
          <a href={url} target="_blank" rel="noreferrer" className="flex w-fit max-w-full">
            {inner}
          </a>
        ) : (
          <div className="flex max-w-full items-center gap-2 py-1 px-2.5 rounded-lg bg-muted/30 border border-dashed border-border/70 text-xs w-fit">
            <FileText className="size-3.5 text-muted-foreground" />
            <label className="inline-flex items-center gap-1 text-primary hover:underline cursor-pointer font-medium">
              {isUploading ? <Loader2 className="size-3 animate-spin" /> : <UploadCloud className="size-3" />}
              <span>{isUploading ? "Đang tải tệp..." : "Tải tệp đính kèm lên"}</span>
              <input
                type="file"
                disabled={isUploading}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUploadFile(f);
                }}
              />
            </label>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function LinkBlockEl({ attributes, children, element }: any) {
  const editor = useEditorRef();
  const [draftUrl, setDraftUrl] = React.useState("");
  const { url, description: desc } = element;
  const setLinkUrl = React.useCallback((newUrl: string) => {
    const meta = resolveUrlMetadata(newUrl);
    const path = editor.api.findPath(element);
    if (path) editor.tf.setNodes({ url: meta.url, description: meta.description, isInternalQcet: meta.isInternalQcet } as any, { at: path });
  }, [editor, element]);
  return (
    <div {...attributes}>
      <div contentEditable={false} className="py-0.5">
        {url ? (
          <div className="flex items-center gap-2 p-2 my-1 rounded-xl bg-muted/30 border border-border/60 hover:bg-muted/50 transition-colors text-xs group/link">
            <Link2 className="size-4 text-primary shrink-0 ml-1" />
            <a href={url} target="_blank" rel="noreferrer" className="flex-1 min-w-0 font-medium text-primary hover:underline truncate">
              {url}
            </a>
            {desc && <span className="text-muted-foreground truncate max-w-xs">{desc}</span>}
            <a href={url} target="_blank" rel="noreferrer" className="p-1 rounded text-muted-foreground hover:text-foreground">
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-2 my-1 rounded-xl bg-muted/40 border border-dashed border-border/80 text-xs">
            <Link2 className="size-4 text-muted-foreground shrink-0" />
            <input type="text" value={draftUrl} onChange={(e) => setDraftUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && draftUrl.trim()) setLinkUrl(draftUrl); }} placeholder="Dán đường dẫn liên kết (nhấn Enter)..." className="flex-1 bg-transparent border-0 outline-none text-foreground placeholder:text-muted-foreground/50 text-xs" />
            <Pressable onClick={() => { if (draftUrl.trim()) setLinkUrl(draftUrl); }} className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity">Lưu</Pressable>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function BookmarkEl({ attributes, children, element }: any) {
  const editor = useEditorRef();
  const [draftUrl, setDraftUrl] = React.useState("");
  const { url, description: desc, favicon, thumbnailUrl, isInternalQcet } = element;
  const setBookmarkUrl = React.useCallback((newUrl: string) => {
    const meta = resolveUrlMetadata(newUrl);
    const path = editor.api.findPath(element);
    if (path) editor.tf.setNodes({ url: meta.url, description: meta.description, favicon: meta.favicon, isInternalQcet: meta.isInternalQcet } as any, { at: path });
  }, [editor, element]);
  return (
    <div {...attributes}>
      <div contentEditable={false} className="py-0.5">
        {url ? (
          <div className="flex items-center gap-3 p-3 my-1.5 rounded-xl bg-card border border-border/70 hover:border-primary/40 hover:bg-muted/30 transition-all text-xs shadow-2xs group/bm">
            {thumbnailUrl ? (
              <img src={thumbnailUrl} alt="" loading="lazy" width={40} height={40} className="size-10 rounded-lg object-cover shrink-0" />
            ) : favicon ? (
              <img src={favicon} alt="" loading="lazy" width={20} height={20} className="size-5 rounded shrink-0" />
            ) : (
              <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0"><Globe className="size-4" /></div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-foreground text-sm truncate flex items-center gap-1.5">
                <span>{url}</span>
                {isInternalQcet && <span className="text-xs px-1.5 py-0.2 rounded bg-primary/15 text-primary font-semibold">Nội bộ</span>}
              </div>
              {desc && <div className="text-muted-foreground text-xs truncate mt-0.5">{desc}</div>}
            </div>
            <a href={url} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <ExternalLink className="size-4" />
            </a>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-2 my-1 rounded-xl bg-muted/40 border border-dashed border-border/80 text-xs">
            <Bookmark className="size-4 text-muted-foreground shrink-0" />
            <input type="text" value={draftUrl} onChange={(e) => setDraftUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && draftUrl.trim()) setBookmarkUrl(draftUrl); }} placeholder="Dán link web để tạo thẻ dấu trang (nhấn Enter)..." className="flex-1 bg-transparent border-0 outline-none text-foreground placeholder:text-muted-foreground/50 text-xs" />
            <Pressable onClick={() => { if (draftUrl.trim()) setBookmarkUrl(draftUrl); }} className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity">Tạo thẻ</Pressable>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function InlineLinkEl({ attributes, children, element }: any) {
  return (
    <a
      {...attributes}
      href={element.url}
      target="_blank"
      rel="noreferrer"
      className="text-primary underline decoration-primary/40 hover:decoration-primary cursor-pointer"
    >
      {children}
    </a>
  );
}

// ---------------------------------------------------------------------------
// Multi-block selection toolbar
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Toolbar Dropdown primitive (click-to-toggle, closes on outside click)
// ---------------------------------------------------------------------------

/**
 * Hiệu ứng mở của menu nổi (Floating UI): chỉ chuyển `opacity` và `scale`. Floating UI dựng menu ở (0,0) rồi mới đặt vào chỗ neo;
 * `duration-*` không kèm `transition-[…]` là chuyển mọi thuộc tính (mặc định `all`), nên menu trượt từ góc trên trái màn hình tới
 * chỗ neo (người dùng quay màn hình menu "/" ngày 21/10/2026). Không dùng `animate-in zoom-in-*` (keyframe ghi `transform`, kèm
 * `duration-*` trần). Đi kèm `useFloating({ transform: false })` (đặt bằng top/left; để transform thì `scale` co cả khoảng dịch, menu
 * vẫn trượt vài chục px) và `transformOrigin: floatingOrigin(placement)` để menu phóng to từ phía chạm chỗ neo.
 */
const FLOATING_ENTER_CLASS =
  "transition-[opacity,scale] duration-[var(--motion-duration-fast)] ease-[var(--motion-ease-enter)] starting:opacity-0 starting:scale-95";

function floatingOrigin(placement: Placement): string {
  const [side, align] = placement.split("-");
  return `${side === "top" ? "bottom" : "top"} ${align === "start" ? "left" : align === "end" ? "right" : "center"}`;
}

function ToolbarDropdown({
  trigger,
  children,
  className,
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  const { refs, floatingStyles, placement } = useFloating({
    strategy: "fixed",
    placement: "bottom-start",
    transform: false,
    whileElementsMounted: autoUpdate,
    middleware: [offset(4), flip({ padding: 8 }), shift({ padding: 8 })],
  });

  React.useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        wrapRef.current && !wrapRef.current.contains(e.target as Node) &&
        panelRef.current && !panelRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={(el) => { (wrapRef as any).current = el; refs.setReference(el); }}>
      <div onMouseDown={(e) => { e.preventDefault(); setOpen((p) => !p); }}>
        {trigger}
      </div>
      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={(el) => { (panelRef as any).current = el; refs.setFloating(el); }}
          style={{ ...floatingStyles, transformOrigin: floatingOrigin(placement) }}
          className={cn(
            "z-[100] min-w-[140px] rounded-lg border border-border/80 bg-card p-1 shadow-lg",
            FLOATING_ENTER_CLASS,
            className,
          )}
          onMouseDown={(e) => e.preventDefault()}
        >
          {children}
        </div>,
        document.body,
      )}
    </div>
  );
}

function DropdownItem({
  icon: Icon,
  label,
  onAction,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onAction: () => void;
}) {
  return (
    <Pressable
      onMouseDown={(e) => { e.preventDefault(); onAction(); }}
      className="flex w-full items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left hover:bg-muted transition-colors"
    >
      <Icon className="size-3.5 text-muted-foreground shrink-0" />
      <span>{label}</span>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Compact Fixed / Sticky Toolbar Component (P0)
// ---------------------------------------------------------------------------

function FixedToolbar({ editor }: { editor: any }) {
  const readOnly = editor.api.isReadOnly();
  if (readOnly) return null;

  const isMarkActive = (mark: string) => {
    try { return editor.api.isMarkActive(mark); } catch { return false; }
  };
  const toggleMark = (mark: string) => {
    editor.tf.toggleMark(mark);
  };

  const handleInsertTable = () => {
    const tableId = `t-${Date.now()}`;
    const tableNode: PlateElemT = {
      id: tableId,
      type: PT.table,
      children: [
        {
          id: `tr-${tableId}-0`,
          type: PT.tableRow,
          children: [
            { id: `th-${tableId}-0-0`, type: PT.tableHeader, children: [{ type: PT.paragraph, children: [{ text: "Cột 1" }] }] },
            { id: `th-${tableId}-0-1`, type: PT.tableHeader, children: [{ type: PT.paragraph, children: [{ text: "Cột 2" }] }] },
            { id: `th-${tableId}-0-2`, type: PT.tableHeader, children: [{ type: PT.paragraph, children: [{ text: "Cột 3" }] }] },
          ],
        },
        {
          id: `tr-${tableId}-1`,
          type: PT.tableRow,
          children: [
            { id: `td-${tableId}-1-0`, type: PT.tableCell, children: [{ type: PT.paragraph, children: [{ text: "" }] }] },
            { id: `td-${tableId}-1-1`, type: PT.tableCell, children: [{ type: PT.paragraph, children: [{ text: "" }] }] },
            { id: `td-${tableId}-1-2`, type: PT.tableCell, children: [{ type: PT.paragraph, children: [{ text: "" }] }] },
          ],
        },
      ],
    };
    editor.tf.insertNodes([tableNode] as any);
  };

  const handleInsertToggle = () => {
    const toggleNode: PlateElemT = {
      id: `toggle-${Date.now()}`,
      type: PT.toggle,
      open: true,
      children: [{ text: "Mục hướng dẫn / Checklist..." }],
    };
    editor.tf.insertNodes([toggleNode] as any);
  };

  const handleAlign = (align: "left" | "center" | "right" | "justify") => {
    editor.tf.setNodes({ textAlign: align } as any);
  };

  const tbBtn = "size-7 flex items-center justify-center rounded-md cursor-pointer transition-colors";
  const tbBtnIdle = "text-muted-foreground hover:bg-muted hover:text-foreground";

  return (
    <div className="sticky top-0 z-10 flex items-center gap-0.5 overflow-x-auto no-scrollbar border-b border-border/40 bg-background px-1 py-1 text-xs select-none">
      {/* ── Text style dropdown (H1/H2/H3/Paragraph) ── */}
      <ToolbarDropdown
        trigger={
          <Pressable title="Văn bản" className={cn(tbBtn, tbBtnIdle, "gap-0.5 w-auto px-1.5")}>
            <Type className="size-3.5" />
            <ChevronDown className="size-2.5 opacity-60" />
          </Pressable>
        }
      >
        <DropdownItem icon={Type} label="Văn bản" onAction={() => editor.tf.setNodes({ type: PT.paragraph } as any)} />
        <DropdownItem icon={Heading1} label="Tiêu đề 1" onAction={() => editor.tf.setNodes({ type: PT.h1 } as any)} />
        <DropdownItem icon={Heading2} label="Tiêu đề 2" onAction={() => editor.tf.setNodes({ type: PT.h2 } as any)} />
        <DropdownItem icon={Heading3} label="Tiêu đề 3" onAction={() => editor.tf.setNodes({ type: PT.h3 } as any)} />
      </ToolbarDropdown>

      <div className="w-px h-4 bg-border/60 mx-0.5" />

      {/* ── Inline marks: Bold / Italic / Underline / Highlight ── */}
      <Pressable title="In đậm (⌘B)" onMouseDown={(e) => { e.preventDefault(); toggleMark("bold"); }} className={cn(tbBtn, isMarkActive("bold") ? "bg-selected text-foreground" : tbBtnIdle)}>
        <Bold className="size-3.5" />
      </Pressable>
      <Pressable title="In nghiêng (⌘I)" onMouseDown={(e) => { e.preventDefault(); toggleMark("italic"); }} className={cn(tbBtn, isMarkActive("italic") ? "bg-selected text-foreground" : tbBtnIdle)}>
        <Italic className="size-3.5" />
      </Pressable>
      <Pressable title="Gạch chân (⌘U)" onMouseDown={(e) => { e.preventDefault(); toggleMark("underline"); }} className={cn(tbBtn, isMarkActive("underline") ? "bg-selected text-foreground" : tbBtnIdle)}>
        <Underline className="size-3.5" />
      </Pressable>
      <Pressable title="Đánh dấu nổi bật (⌘⇧H)" onMouseDown={(e) => { e.preventDefault(); toggleMark("highlight"); }} className={cn(tbBtn, isMarkActive("highlight") ? "bg-warning/15 text-warning" : tbBtnIdle)}>
        <Highlighter className="size-3.5" />
      </Pressable>

      <div className="w-px h-4 bg-border/60 mx-0.5" />

      {/* ── Link ── */}
      <Pressable title="Chèn liên kết (⌘K)" onMouseDown={(e) => { e.preventDefault(); triggerFloatingLinkInsert(editor, { focused: true }); }} className={cn(tbBtn, tbBtnIdle)}>
        <Link className="size-3.5" />
      </Pressable>

      <div className="w-px h-4 bg-border/60 mx-0.5" />

      {/* ── List dropdown ── */}
      <ToolbarDropdown
        trigger={
          <Pressable title="Danh sách" className={cn(tbBtn, tbBtnIdle, "gap-0.5 w-auto px-1.5")}>
            <List className="size-3.5" />
            <ChevronDown className="size-2.5 opacity-60" />
          </Pressable>
        }
      >
        <DropdownItem icon={List} label="Dấu đầu dòng" onAction={() => editor.tf.setNodes({ type: PT.paragraph, listStyleType: "disc", indent: 1 } as any)} />
        <DropdownItem icon={ListOrdered} label="Đánh số" onAction={() => editor.tf.setNodes({ type: PT.paragraph, listStyleType: "decimal", indent: 1 } as any)} />
        <DropdownItem icon={CheckSquare} label="Checklist" onAction={() => editor.tf.setNodes({ type: PT.paragraph, listStyleType: "disc", indent: 1, checked: false } as any)} />
      </ToolbarDropdown>

      {/* ── Alignment dropdown ── */}
      <ToolbarDropdown
        trigger={
          <Pressable title="Căn chỉnh" className={cn(tbBtn, tbBtnIdle, "gap-0.5 w-auto px-1.5")}>
            <AlignLeft className="size-3.5" />
            <ChevronDown className="size-2.5 opacity-60" />
          </Pressable>
        }
      >
        <DropdownItem icon={AlignLeft} label="Căn trái" onAction={() => handleAlign("left")} />
        <DropdownItem icon={AlignCenter} label="Căn giữa" onAction={() => handleAlign("center")} />
        <DropdownItem icon={AlignRight} label="Căn phải" onAction={() => handleAlign("right")} />
        <DropdownItem icon={AlignJustify} label="Căn đều" onAction={() => handleAlign("justify")} />
      </ToolbarDropdown>

      <div className="w-px h-4 bg-border/60 mx-0.5" />

      {/* ── Table ── */}
      <Pressable title="Chèn bảng biểu" onMouseDown={(e) => { e.preventDefault(); handleInsertTable(); }} className={cn(tbBtn, tbBtnIdle)}>
        <TableIcon className="size-3.5" />
      </Pressable>

      {/* ── More / Overflow (Quote, Callout, Toggle, Divider) ── */}
      <ToolbarDropdown
        trigger={
          <Pressable title="Thêm" className={cn(tbBtn, tbBtnIdle)}>
            <MoreHorizontal className="size-3.5" />
          </Pressable>
        }
      >
        <DropdownItem icon={Quote} label="Trích dẫn" onAction={() => editor.tf.setNodes({ type: PT.blockquote } as any)} />
        <DropdownItem icon={Info} label="Ghi chú nổi bật" onAction={() => editor.tf.setNodes({ type: PT.callout } as any)} />
        <DropdownItem icon={ChevronRight} label="Khối thu gọn" onAction={() => handleInsertToggle()} />
        <DropdownItem icon={Minus} label="Đường phân cách" onAction={() => editor.tf.insertNodes([{ id: `hr-${Date.now()}`, type: PT.hr, children: [{ text: "" }] }] as any)} />
      </ToolbarDropdown>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Floating Toolbar Component
// ---------------------------------------------------------------------------

function FloatingToolbar({ editor }: { editor: any }) {
  const [visible, setVisible] = React.useState(false);
  const readOnly = editor.api.isReadOnly();

  const { refs, floatingStyles, placement } = useFloating({
    strategy: "fixed",
    placement: "top",
    transform: false,
    whileElementsMounted: autoUpdate,
    middleware: [offset(8), flip(), shift({ padding: 8 })],
  });

  React.useEffect(() => {
    if (readOnly) { setVisible(false); return; }

    // Đang kéo khối (ảnh, video...) thì không hiện thanh định dạng
    let dragging = false;
    const onDragStart = () => { dragging = true; setVisible(false); };
    const onDragEnd = () => { dragging = false; };
    document.addEventListener("dragstart", onDragStart, true);
    document.addEventListener("dragend", onDragEnd, true);
    document.addEventListener("drop", onDragEnd, true);

    // Chỉ hiện khi đang bôi đen chữ trong chính editor này. Xét vùng chọn DOM thay vì editor.selection: Slate cập nhật
    // editor.selection trễ, nên bấm vào chữ (chỉ focus) vẫn còn vùng chọn cũ và thanh hiện nhầm ở con trỏ.
    const handleSelectionChange = () => {
      const domSel = window.getSelection();
      const root = editor.api.toDOMNode(editor);
      if (
        dragging || !domSel || domSel.rangeCount === 0 || domSel.isCollapsed || !root ||
        !root.contains(domSel.anchorNode) || !root.contains(domSel.focusNode)
      ) {
        setVisible(false);
        return;
      }
      // Chỉ hiện khi chọn chữ: vùng không chỉnh sửa được (khối ảnh, video) không có định dạng
      const anchorEl = domSel.anchorNode instanceof Element ? domSel.anchorNode : domSel.anchorNode?.parentElement;
      if (anchorEl?.closest('[contenteditable="false"]')) {
        setVisible(false);
        return;
      }
      // Neo theo khung của phần chữ được chọn, không theo khung các khối chứa nó (chọn qua nhiều mục danh sách thì khung
      // khối rộng hết editor, thanh bị đẩy sang phải). Tính lại mỗi lần đo để thanh đi theo chữ khi cuộn.
      const range = domSel.getRangeAt(0).cloneRange();
      const textRect = () => selectionTextRect(range) ?? range.getBoundingClientRect();
      const rect = textRect();
      if (rect.width === 0 && rect.height === 0) {
        setVisible(false);
        return;
      }
      refs.setPositionReference({ getBoundingClientRect: textRect });
      setVisible(true);
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("dragstart", onDragStart, true);
      document.removeEventListener("dragend", onDragEnd, true);
      document.removeEventListener("drop", onDragEnd, true);
    };
  }, [editor, readOnly, refs]);

  if (!visible || typeof document === "undefined") return null;

  const isMarkActive = (mark: string) => {
    try { return editor.api.isMarkActive(mark); } catch { return false; }
  };
  const toggleMark = (mark: string) => {
    editor.tf.toggleMark(mark);
  };

  const marks = [
    { key: "bold", icon: Bold, label: "In đậm (⌘B)" },
    { key: "italic", icon: Italic, label: "In nghiêng (⌘I)" },
    { key: "underline", icon: Underline, label: "Gạch chân (⌘U)" },
    { key: "strikethrough", icon: Strikethrough, label: "Gạch xóa" },
    { key: "code", icon: Code2, label: "Mã lệnh" },
    { key: "highlight", icon: Highlighter, label: "Đánh dấu nổi bật (⌘⇧H)" },
  ];

  return createPortal(
    <div
      ref={refs.setFloating}
      style={{ ...floatingStyles, transformOrigin: floatingOrigin(placement) }}
      className={cn("z-50 flex items-center gap-0.5 rounded-lg border border-border/80 bg-card p-0.5 shadow-lg", FLOATING_ENTER_CLASS)}
    >
      {marks.map(({ key, icon: Icon, label }) => (
        <Pressable
          key={key}
          title={label}
          onMouseDown={(e) => { e.preventDefault(); toggleMark(key); }}
          className={cn(
            "size-7 flex items-center justify-center rounded-md text-xs transition-colors",
            isMarkActive(key) ? "bg-selected text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Icon className="size-3.5" />
        </Pressable>
      ))}
      <div className="w-px h-4 bg-border/60 mx-0.5" />
      <Pressable
        title="Chèn liên kết (⌘K)"
        onMouseDown={(e) => {
          e.preventDefault();
          triggerFloatingLinkInsert(editor, { focused: true });
        }}
        className="size-7 flex items-center justify-center rounded-md text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <Link className="size-3.5" />
      </Pressable>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Block wrapper with hover-only six-dot handle + block menu
// ---------------------------------------------------------------------------

const TURN_INTO_OPTIONS = [
  { type: "text", label: "Văn bản", icon: Type },
  { type: "heading", level: 1, label: "Tiêu đề 1", icon: Heading1 },
  { type: "heading", level: 2, label: "Tiêu đề 2", icon: Heading2 },
  { type: "heading", level: 3, label: "Tiêu đề 3", icon: Heading3 },
  { type: "bulleted_list", label: "Dấu đầu dòng", icon: List },
  { type: "numbered_list", label: "Đánh số", icon: ListOrdered },
  { type: "checklist", label: "Checklist", icon: CheckSquare },
  { type: "quote", label: "Trích dẫn", icon: Quote },
  { type: "callout", label: "Ghi chú", icon: Info },
] as const;

/** Menu khối đang mở: neo vào tay kéo hoặc điểm bấm chuột phải; `ids` là các khối menu tác động. */
interface BlockMenuState {
  anchor: Element | { getBoundingClientRect: () => DOMRect };
  ids: string[];
}

/** Mở menu khối từ tay kéo của từng khối; `openId` giữ tay kéo của khối đang mở menu luôn hiện. */
const BlockMenuContext = React.createContext<{
  openId: string | null;
  open: (element: any, anchor: BlockMenuState["anchor"]) => void;
} | null>(null);

/**
 * Menu khối (tay kéo sáu chấm, chuột phải) dựng trên `ui/menu` (Base UI): tự lật lên trên hay sang bên khi gần mép màn
 * hình. Như BlockContextMenu của Plate, menu tác động lên vùng chọn khối hiện tại bằng transform có sẵn của Plate; bấm
 * vào menu (portal ngoài khung soạn) có thể làm Plate bỏ chọn, khi đó dùng các khối ghi lại lúc mở và chọn lại trước
 * mỗi thao tác. Phải nằm trong `<Plate>` để đọc vùng chọn.
 */
function BlockMenu({ editor, state, onClose }: { editor: any; state: BlockMenuState | null; onClose: () => void }) {
  const selectedIds = usePluginOption(BlockSelectionPlugin, "selectedIds");
  const ids = state && selectedIds?.size ? [...selectedIds] : (state?.ids ?? []);
  const selectTargets = () => editor.getApi(BlockSelectionPlugin).blockSelection.set(ids);
  const targetNodes = { at: [], match: (node: any) => typeof node.id === "string" && ids.includes(node.id) };

  const turnInto = (opt: typeof TURN_INTO_OPTIONS[number]) => {
    selectTargets();
    const entries = editor.getApi(BlockSelectionPlugin).blockSelection.getNodes() as Array<[any, number[]]>;
    editor.tf.withoutNormalizing(() => {
      // Từ cuối lên để đường dẫn của các khối phía trên không đổi
      for (let i = entries.length - 1; i >= 0; i--) {
        const [el, path] = entries[i];
        const contentBlock = plateToBlocks([el])[0];
        const converted: any = { id: contentBlock.id, type: opt.type, content: contentBlock.content };
        if (opt.type === "heading") converted.level = (opt as any).level;
        if (opt.type === "checklist") converted.checked = false;
        const [plateNode] = blocksToPlate([converted]);
        editor.tf.removeNodes({ at: path });
        editor.tf.insertNodes([{ ...plateNode, children: el.children }] as any, { at: path });
      }
    });
    // Khối được gỡ rồi chèn lại (giữ id) nên Plate bỏ chọn: chọn lại để thao tác tiếp trên đúng các khối này
    selectTargets();
  };

  const duplicateBlock = () => {
    selectTargets();
    editor.getTransforms(BlockSelectionPlugin).blockSelection.duplicate();
  };

  const deleteBlock = () => {
    selectTargets();
    editor.getTransforms(BlockSelectionPlugin).blockSelection.removeNodes();
  };

  return (
    <MenuRoot open={state !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      {/* Base UI chỉ đăng ký menu gốc vào cây menu qua Trigger; thiếu nó thì mở menu con "Chuyển thành" sẽ đóng menu gốc
          (lý do sibling-open). Menu mở bằng tay kéo hoặc chuột phải qua `anchor`, nên nút này ẩn và không nhận focus. */}
      <MenuTrigger aria-hidden tabIndex={-1} className="sr-only" />
      <MenuContent
        anchor={state?.anchor}
        positionerClassName="z-50"
        className="w-56"
        data-plate-prevent-unselect="true"
      >
        <MenuSubmenu icon={<ArrowRight />} label="Chuyển thành">
          {TURN_INTO_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <MenuActionItem key={`${opt.type}-${(opt as any).level || ""}`} leading={<Icon />} onClick={() => turnInto(opt)}>
                {opt.label}
              </MenuActionItem>
            );
          })}
        </MenuSubmenu>
        <MenuActionItem leading={<IndentIncrease />} onClick={() => plateIndent(editor, { getNodesOptions: targetNodes })}>
          Thụt vào
        </MenuActionItem>
        <MenuActionItem
          leading={<IndentDecrease />}
          // Về mức 0 thì bỏ luôn kiểu danh sách, như giảm thụt của danh sách Plate
          onClick={() => plateOutdent(editor, { getNodesOptions: targetNodes, unsetNodesProps: ["listStyleType", "listStart", "checked"] })}
        >
          Giảm thụt
        </MenuActionItem>
        <MenuActionItem leading={<Copy />} onClick={duplicateBlock}>
          Nhân bản
        </MenuActionItem>
        <MenuActionItem destructive leading={<Trash2 />} onClick={deleteBlock}>
          {ids.length > 1 ? `Xóa ${ids.length} khối` : "Xóa khối"}
        </MenuActionItem>
      </MenuContent>
    </MenuRoot>
  );
}

const SINGLE_IMAGE_ROW = { start: 0, position: 0, size: 1 };
/** Khe giữa các ảnh trong một hàng */
const IMAGE_ROW_GAP_PX = 12;

/**
 * Thả một ảnh vào mép trái/phải của ảnh khác: hai ảnh vào chung một hàng (cùng `rowId`), ảnh kéo đứng ngay bên cạnh. Mọi bước
 * tra node theo id vì `moveNodes`/`setNodes` thay đối tượng node (tra theo đối tượng cũ sẽ hụt).
 */
function joinImageRow(
  editor: any,
  dragItem: any,
  target: any,
  monitor: DropTargetMonitor,
  nodeRef: React.RefObject<HTMLElement | null>,
  canDropNode: (args: any) => boolean
) {
  const draggedId = dragItem.id as string;
  const rowId =
    target.rowId ?? (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `row-${Date.now()}`);
  const move = getDropPath(editor, { canDropNode, dragItem, element: target, monitor, nodeRef: nodeRef as any, orientation: "horizontal" });
  editor.tf.withoutNormalizing(() => {
    if (move?.dragPath) editor.tf.moveNodes({ at: move.dragPath, to: move.to });
    for (const id of [target.id, draggedId]) {
      const entry = editor.api.node({ id, at: [] });
      if (entry && entry[0].rowId !== rowId) editor.tf.setNodes({ rowId }, { at: entry[1] });
    }
  });
}

/** Kéo một ảnh ra khỏi hàng của nó (thả lên nửa trên/dưới một ảnh cùng hàng): ảnh đứng riêng trước/sau cả hàng */
function leaveImageRow(editor: any, draggedId: string, rowMate: any, line: "top" | "bottom") {
  const dragEntry = editor.api.node({ id: draggedId, at: [] });
  const mateIndex = editor.api.node({ id: rowMate.id, at: [] })?.[1]?.[0];
  if (!dragEntry || mateIndex === undefined) return;
  const dragIndex: number = dragEntry[1][0];
  const row = imageRowAt(editor.children, mateIndex);
  const target = line === "top" ? row.start : row.start + row.size;
  editor.tf.withoutNormalizing(() => {
    editor.tf.moveNodes({ at: [dragIndex], to: [dragIndex < target ? target - 1 : target] });
    const moved = editor.api.node({ id: draggedId, at: [] });
    if (moved) editor.tf.unsetNodes("rowId", { at: moved[1] });
  });
}

function BlockRowDraggable({ children, element, compact }: { children: React.ReactNode; element: any; compact?: boolean }) {
  const { props: selectableProps } = useBlockSelectable();
  const isSelected = useBlockSelected(element?.id);
  const editor = useEditorRef();
  const readOnly = editor.api.isReadOnly();
  const previewRef = React.useRef<HTMLDivElement>(null);
  const nodeRefHolder = React.useRef<React.RefObject<HTMLDivElement | null> | null>(null);
  const isImage = element?.type === PT.image;

  // Hàng ảnh: chạy lại khi khối kề bên đổi (một ảnh vào/ra hàng), không chỉ khi chính khối này đổi. Tra vị trí theo id:
  // `findPath` đọc bảng vị trí Slate chỉ cập nhật lúc render, selector chạy trước đó nên sau khi đổi chỗ ảnh nhận vị trí cũ
  const elementId: string | undefined = element?.id;
  const row = useEditorSelector(
    (ed) => {
      if (!isImage) return SINGLE_IMAGE_ROW;
      const index = (ed.children as any[]).findIndex((node) => node.id === elementId);
      return index < 0 ? SINGLE_IMAGE_ROW : imageRowAt(ed.children as any, index);
    },
    [elementId, isImage],
    { equalityFn: (a, b) => a.start === b.start && a.position === b.position && a.size === b.size }
  );
  const inRow = row.size > 1;

  const canDropNode = React.useCallback(
    ({ dragItem }: any) => !("editorId" in dragItem) || dragItem.editorId === editor.id,
    [editor]
  );

  // Ảnh đang kéo trỏ vào 1/4 mép trái/phải của khung ảnh này (tối đa 96px) thì là thả để xếp cạnh nhau
  const sideOf = (dragItem: any, monitor: DropTargetMonitor): "left" | "right" | null => {
    if (!isImage || readOnly) return null;
    const dragged = dragItem?.element;
    if (!dragged || dragged.type !== PT.image || Array.isArray(dragItem.id) || dragItem.editorId !== editor.id || dragged.id === element.id) return null;
    const frame = nodeRefHolder.current?.current?.querySelector<HTMLElement>("[data-image-frame]");
    const offset = monitor.getClientOffset();
    if (!frame || !offset) return null;
    const rect = frame.getBoundingClientRect();
    if (offset.y < rect.top || offset.y > rect.bottom) return null;
    const zone = Math.min(rect.width / 4, 96);
    const side = offset.x < rect.left + zone ? "left" : offset.x > rect.right - zone ? "right" : null;
    if (!side) return null;
    const sameRow = Boolean(element.rowId) && dragged.rowId === element.rowId;
    return sameRow || row.size < IMAGE_ROW_MAX ? side : null;
  };

  // Ảnh trong hàng kéo lên nửa trên/dưới một ảnh cùng hàng: Plate coi là không đổi chỗ (thứ tự phẳng đã liền nhau) nên tự xử lý
  const leaveLineOf = (dragItem: any, monitor: DropTargetMonitor): "top" | "bottom" | null => {
    const dragged = dragItem?.element;
    if (!isImage || readOnly || !dragged?.rowId || dragged.rowId !== element.rowId || dragged.id === element.id || typeof dragItem.id !== "string") return null;
    const rect = nodeRefHolder.current?.current?.getBoundingClientRect();
    const offset = monitor.getClientOffset();
    if (!rect || !offset) return null;
    return offset.y < rect.top + rect.height / 2 ? "top" : "bottom";
  };

  const { isDragging, nodeRef, handleRef } = useDraggable({
    element,
    orientation: "vertical",
    preview: { ref: previewRef },
    canDropNode,
    drop: {
      hover: (item: any, monitor: DropTargetMonitor) => {
        const line = sideOf(item, monitor) ?? leaveLineOf(item, monitor);
        if (line) {
          const current = editor.getOption(DndPlugin, "dropTarget");
          if (current?.id !== element.id || current?.line !== line) {
            editor.setOption(DndPlugin, "dropTarget", { id: element.id, line });
          }
          return;
        }
        if (nodeRefHolder.current) {
          onHoverNode(editor, { canDropNode, dragItem: item, element, monitor, nodeRef: nodeRefHolder.current as any, orientation: "vertical" });
        }
      },
    },
    onDropHandler: (_editor, { dragItem, monitor, nodeRef: dropNodeRef }) => {
      const side = sideOf(dragItem, monitor);
      if (side) {
        joinImageRow(editor, dragItem, element, monitor, dropNodeRef, canDropNode);
        // Plate chỉ xóa vạch thả khi bắt được sự kiện drop ở document; xóa luôn ở đây để vạch không còn đọng giữa hai ảnh
        editor.setOption(DndPlugin, "dropTarget", { id: null, line: "" });
        return true;
      }
      const leave = leaveLineOf(dragItem, monitor);
      if (leave) {
        leaveImageRow(editor, (dragItem as any).id, element, leave);
        editor.setOption(DndPlugin, "dropTarget", { id: null, line: "" });
        return true;
      }
      // Thả ảnh lên trên/dưới khối khác: ảnh rời hàng. Plate chuyển khối ngay sau handler này nên gỡ rowId sau đó, tra theo id
      const item = dragItem as any;
      if (item.element?.rowId && typeof item.id === "string" && getDropPath(editor, { canDropNode, dragItem: item, element, monitor, nodeRef: dropNodeRef as any, orientation: "vertical" })) {
        const draggedId: string = item.id;
        queueMicrotask(() => {
          const entry = editor.api.node({ id: draggedId, at: [] });
          if (entry) editor.tf.unsetNodes("rowId", { at: entry[1] });
        });
      }
      return false;
    },
  });
  nodeRefHolder.current = nodeRef ?? null;
  const { dropLine } = useDropLine({ id: element.id, orientation: "vertical" });
  const blockMenu = React.useContext(BlockMenuContext);
  const showBlockMenu = blockMenu?.openId === element.id;
  const isLastInRow = row.position === row.size - 1;

  return (
    <div
      ref={nodeRef}
      {...selectableProps}
      className={cn(
        "group/block relative items-start outline-hidden select-auto",
        // Ảnh cùng hàng: các khối liền nhau đứng thành hàng (inline-flex, chia đều bề rộng trừ khe)
        inRow ? "inline-flex align-top" : "flex",
        selectableProps.className,
        isDragging && "opacity-50",
      )}
      style={
        inRow
          ? {
              width: `calc((100% - ${(row.size - 1) * IMAGE_ROW_GAP_PX}px) / ${row.size} - 0.5px)`,
              marginRight: isLastInRow ? undefined : IMAGE_ROW_GAP_PX,
            }
          : undefined
      }
      data-block-id={element.id}
      data-slot="task-editor-block"
      data-block-selected={isSelected ? "true" : undefined}
      data-image-row={inRow ? "true" : undefined}
      data-plate-selectable="true"
    >
      <div
        data-slot="block-handle"
        className={cn(
          "shrink-0 mr-1 flex items-center justify-center h-6 mt-0.5 relative select-none",
          // compact (hộp tạo việc): khe 24px vừa lề của hộp; điện thoại không rê chuột nên ẩn tay kéo
          compact ? "w-5 -ml-6 max-md:hidden" : "w-6 -ml-7",
          // Ảnh thứ hai trở đi trong hàng: tay kéo sẽ đè lên ảnh bên trái, kéo bằng chính ảnh
          (readOnly || row.position > 0) && "invisible"
        )}
        contentEditable={false}
        data-plate-selectable="true"
      >
        <button
          ref={handleRef}
          type="button"
          contentEditable={false}
          tabIndex={-1}
          aria-label="Mở menu khối hoặc kéo để sắp xếp"
          aria-haspopup="menu"
          aria-expanded={showBlockMenu}
          // Bấm tay kéo không làm Plate bỏ vùng chọn khối: menu mở trên đúng các khối đang chọn. Plate chỉ đọc thuộc tính
          // trên chính phần tử bị bấm nên icon bên trong không nhận chuột
          data-plate-prevent-unselect="true"
          onClick={(e) => { e.stopPropagation(); blockMenu?.open(element, e.currentTarget); }}
          className={cn(
            "size-5 flex items-center justify-center rounded-md",
            "text-muted-foreground/50 hover:text-foreground hover:bg-muted",
            "cursor-grab active:cursor-grabbing transition-opacity duration-100",
            showBlockMenu ? "opacity-100" : "opacity-0 pointer-events-none",
            "group-hover/block:opacity-100 group-hover/block:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto",
            "focus-visible:ring-2 focus-visible:ring-primary/40",
            "motion-reduce:transition-none",
          )}
        >
          <GripVertical className="size-3.5 pointer-events-none" />
        </button>
      </div>
      <div ref={previewRef} className="flex-1 min-w-0">{children}</div>
      {dropLine && (
        <div
          aria-hidden="true"
          data-slot="block-drop-indicator"
          className={cn(
            "pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-primary",
            dropLine === "top" ? "top-0" : "bottom-0",
          )}
        />
      )}
    </div>
  );
}

function PlateDndContainer({ children }: { children: React.ReactNode }) {
  const dndContext = React.useContext(DndContext);
  if (dndContext?.dragDropManager) {
    return <>{children}</>;
  }
  return <DndProvider backend={HTML5Backend}>{children}</DndProvider>;
}

// ---------------------------------------------------------------------------
// Slash Menu component
// ---------------------------------------------------------------------------

/** Trả `true` khi đã tự đưa tiêu điểm vào ô nhập của khối vừa chèn (ô sẽ không bị editor giành lại). */
const SlashSelectContext = React.createContext<((option: MenuItemOption) => boolean) | null>(null);

type SlashCloseReason = "escape" | "outside" | "no-match";

/**
 * Phần tử nhập lệnh "/": là node void nên văn bản gõ vào KHÔNG nằm trong Slate.
 * Cần một <input> thật giữ focus để người dùng gõ tiếp (ví dụ "/image") và lọc menu.
 * Đóng bằng Esc, bấm ra ngoài hoặc gõ Space/Enter khi không có mục nào khớp thì chữ đã gõ ("/abc") ở lại thành văn bản
 * thường như Notion và combobox của Plate (trước 21/10/2026 Esc xóa mất cả chữ đã gõ); Backspace khi ô trống mới bỏ dấu "/".
 */
function SlashInputElement({ attributes, children, element }: any) {
  const editor = useEditorRef();
  const onSelectOption = React.useContext(SlashSelectContext);
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listboxId = React.useId();

  const filteredOptions = React.useMemo(() => rankSlashOptions(MENU_OPTIONS, query), [query]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  /**
   * Gỡ node "/". Giữ chữ thì chèn "/" + chữ đã gõ (+ `suffix`) vào đúng chỗ đó: inline luôn có text node đứng trước nên lấy
   * cuối text node ấy làm điểm chèn (sau khi gỡ, hai text node gộp lại, điểm vẫn đúng). `refocus` false khi người dùng bấm
   * ra chỗ khác: không kéo con trỏ về đây.
   */
  const closeInput = React.useCallback(
    ({ keepText = false, suffix = "", refocus = true }: { keepText?: boolean; suffix?: string; refocus?: boolean } = {}) => {
      const path = editor.api.findPath(element);
      if (!path) return;
      const index = path[path.length - 1];
      const anchor = index > 0 ? editor.api.end([...path.slice(0, -1), index - 1]) : undefined;
      editor.tf.removeNodes({ at: path });
      const text = keepText ? `/${query}${suffix}` : "";
      if (anchor && text) editor.tf.insertText(text, { at: anchor });
      if (!refocus) return;
      if (anchor) editor.tf.select({ path: anchor.path, offset: anchor.offset + text.length });
      editor.tf.focus();
    },
    [editor, element, query]
  );

  const handleClose = React.useCallback(
    (reason: SlashCloseReason) => closeInput({ keepText: true, refocus: reason !== "outside" }),
    [closeInput]
  );

  const handleSelect = React.useCallback((option: MenuItemOption) => {
    const path = editor.api.findPath(element);
    if (path) editor.tf.removeNodes({ at: path });
    if (!onSelectOption?.(option)) editor.tf.focus();
  }, [editor, element, onSelectOption]);

  // Lấy focus ngay khi mở để gõ tiếp được
  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Neo menu vào cụm "/" + ô nhập (vị trí thật của con trỏ), không phụ thuộc node void của Slate. Neo cả cụm để mép trái menu
  // thẳng dấu "/" như Notion/Linear (trước 21/10/2026 neo ô nhập nên menu lệch phải một ký tự).
  const [anchorEl, setAnchorEl] = React.useState<HTMLSpanElement | null>(null);
  const setAnchorRef = React.useCallback((node: HTMLSpanElement | null) => {
    setAnchorEl((prev) => (prev === node ? prev : node));
  }, []);

  const activeOption = filteredOptions[activeIndex];

  return (
    <span {...attributes}>
      <span ref={setAnchorRef} contentEditable={false} className="inline-flex items-baseline text-muted-foreground">
        <span aria-hidden="true">/</span>
        <input
          ref={inputRef}
          value={query}
          // Dấu "/" đã hiện sẵn bên trái ô; gõ thêm "/" ở đầu (nhấn đúp, giữ phím, dán "/image") sẽ thành "//" nên bỏ đi
          onChange={(e) => setQuery(e.target.value.replace(/^\/+/, ""))}
          // Mọi phím của menu xử lý ngay tại ô nhập (tiêu điểm luôn ở đây): trình nghe ở window không nhận được phím khi một
          // khung cha chặn sự kiện (hộp tạo việc chặn mũi tên, Esc), nên trước 21/10/2026 mũi tên không chạy trong hộp tạo việc.
          // Phím đã xử lý thì chặn luôn để hộp thoại không gửi biểu mẫu (Enter) hay đóng (Esc).
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || e.keyCode === 229) return;
            const count = filteredOptions.length;
            const handled = () => {
              e.preventDefault();
              e.stopPropagation();
            };
            switch (e.key) {
              case "ArrowDown":
                handled();
                setActiveIndex((prev) => (prev + 1) % Math.max(1, count));
                return;
              case "ArrowUp":
                handled();
                setActiveIndex((prev) => (prev - 1 + count) % Math.max(1, count));
                return;
              case "Home":
              case "PageUp":
                handled();
                setActiveIndex(0);
                return;
              case "End":
              case "PageDown":
                handled();
                setActiveIndex(Math.max(0, count - 1));
                return;
              case "Enter":
              case "Tab":
                // Tab chọn như Enter (Notion), không để tiêu điểm nhảy ra khỏi editor giữa chừng
                handled();
                if (activeOption) handleSelect(activeOption);
                else if (e.key === "Enter") handleClose("no-match");
                return;
              case "Escape":
                handled();
                handleClose("escape");
                return;
              case "Backspace":
                // Xóa hết chữ rồi Backspace: đóng menu, bỏ dấu "/"
                if (query === "") {
                  handled();
                  closeInput();
                }
                return;
              case " ":
                // Không mục nào khớp mà gõ Space: người dùng đang viết chữ có dấu "/", trả lại thành văn bản và gõ tiếp
                if (query.trim() && count === 0) {
                  handled();
                  closeInput({ keepText: true, suffix: " " });
                }
                return;
            }
          }}
          role="combobox"
          aria-label="Tìm khối nội dung"
          aria-expanded={Boolean(anchorEl)}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeOption ? `${listboxId}-${activeOption.id}` : undefined}
          autoComplete="off"
          spellCheck={false}
          style={{ width: `${Math.max(query.length, 1) + 1}ch` }}
          className="bg-transparent p-0 text-foreground outline-none"
        />
        <SlashMenu
          isOpen={Boolean(anchorEl)}
          onClose={handleClose}
          onSelect={handleSelect}
          searchQuery={query}
          anchorElement={anchorEl}
          filteredOptions={filteredOptions}
          activeIndex={activeIndex}
          setActiveIndex={setActiveIndex}
          listboxId={listboxId}
        />
      </span>
      {children}
    </span>
  );
}

function SlashMenu({
  isOpen,
  onClose,
  onSelect,
  searchQuery,
  anchorElement,
  filteredOptions,
  activeIndex,
  setActiveIndex,
  listboxId,
}: {
  isOpen: boolean;
  onClose: (reason: SlashCloseReason) => void;
  onSelect: (option: MenuItemOption) => void;
  searchQuery: string;
  anchorElement: HTMLElement | null;
  filteredOptions: MenuItemOption[];
  activeIndex: number;
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
  listboxId: string;
}) {
  const menuListRef = React.useRef<HTMLDivElement>(null);
  const menuItemRefs = React.useRef<Map<number, HTMLButtonElement>>(new Map());
  // Đang gõ thì xếp theo độ khớp, bỏ tên nhóm (một danh sách phẳng như Notion); ô trống mới chia nhóm
  const searching = searchQuery.trim().length > 0;
  const descriptionId = `${listboxId}-description`;
  const activeOption = filteredOptions[activeIndex];

  const { refs, floatingStyles, placement, update } = useFloating({
    strategy: "fixed",
    placement: "bottom-start",
    transform: false,
    // animationFrame: đo lại mỗi frame, tránh kẹt vị trí cũ khi Slate/void node dựng lại DOM
    whileElementsMounted: (reference, floating, updateFn) =>
      autoUpdate(reference, floating, updateFn, { animationFrame: true }),
    middleware: [
      offset(6),
      flip({ padding: 14 }),
      shift({ padding: 14 }),
      size({
        padding: 14,
        apply({ availableHeight, elements }) {
          Object.assign(elements.floating.style, {
            maxHeight: `${Math.min(availableHeight, 400)}px`,
          });
        },
      }),
    ],
  });

  // Neo menu vào đúng ô nhập ngay sau dấu "/". Không dùng selection làm neo dự phòng:
  // trên void node selection thường cho rect rỗng (0,0) nên menu bị đẩy về góc trên trái.
  React.useLayoutEffect(() => {
    refs.setReference(anchorElement);
  }, [anchorElement, refs]);

  // Đo lại ngay khi mở (và sau một frame, khi layout của node đã ổn định)
  React.useLayoutEffect(() => {
    if (!anchorElement) return;
    update();
    const id = requestAnimationFrame(() => update());
    return () => cancelAnimationFrame(id);
  }, [anchorElement, update]);

  React.useEffect(() => {
    // Mục đầu: cuộn về đỉnh để thấy cả tên nhóm. Không dùng smooth: giữ phím mũi tên bị trễ và giật
    if (activeIndex === 0) {
      menuListRef.current?.parentElement?.scrollTo({ top: 0 });
      return;
    }
    menuItemRefs.current.get(activeIndex)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // Đóng menu khi click bên ngoài
  React.useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      const floating = refs.floating.current;
      if (floating && !floating.contains(e.target as Node) && !anchorElement?.contains(e.target as Node)) {
        onClose("outside");
      }
    };
    // Delay thêm 1 frame để tránh conflict với event tạo menu
    const id = requestAnimationFrame(() => {
      document.addEventListener("pointerdown", handlePointerDown);
    });
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen, refs.floating, onClose, anchorElement]);

  if (!isOpen || typeof document === "undefined") return null;

  // Khung ngoài nhận maxHeight (middleware `size`) và bo góc; danh sách cuộn trong khung riêng, chân menu (mô tả mục đang chọn)
  // luôn hiện. Khung cuộn cách mép 4px (`m-1`, không `p-1`) để thanh cuộn nằm trong thẻ, không dính mép phải và góc bo (người
  // dùng chụp thanh cuộn "lệch ra ngoài" 21/10/2026).
  return createPortal(
    <div
      ref={refs.setFloating}
      style={{ ...floatingStyles, transformOrigin: floatingOrigin(placement) }}
      // Bấm vào menu không lấy tiêu điểm khỏi ô nhập "/" (ô mất tiêu điểm thì phím mũi tên, Esc không còn tới đây)
      onMouseDown={(e) => e.preventDefault()}
      className={cn(MENU_POPUP_CLASS, "flex w-64 max-w-[calc(100vw-28px)] flex-col overflow-hidden p-0", FLOATING_ENTER_CLASS)}
    >
      <div className="thin-scrollbar m-1 min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div ref={menuListRef} id={listboxId} role="listbox" aria-label="Chèn khối nội dung">
          {filteredOptions.map((opt, idx) => {
            const Icon = opt.icon;
            const isSelected = idx === activeIndex;
            const showGroup = !searching && (idx === 0 || filteredOptions[idx - 1].group !== opt.group);
            return (
              <React.Fragment key={opt.id}>
                {showGroup && (
                  <div role="presentation" className={cn("flex h-7 items-center px-2 text-xs font-medium text-muted-foreground", idx > 0 && "mt-1")}>
                    {opt.group}
                  </div>
                )}
                <Pressable
                  ref={(el) => { if (el) menuItemRefs.current.set(idx, el); else menuItemRefs.current.delete(idx); }}
                  id={`${listboxId}-${opt.id}`}
                  role="option"
                  tabIndex={-1}
                  aria-selected={isSelected}
                  aria-describedby={isSelected ? descriptionId : undefined}
                  onMouseMove={() => setActiveIndex((prev) => (prev === idx ? prev : idx))}
                  onClick={() => onSelect(opt)}
                  className={cn(
                    "flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-foreground transition-colors duration-75",
                    isSelected && "bg-accent"
                  )}
                >
                  <Icon className={cn("size-4 shrink-0", isSelected ? "text-foreground" : "text-muted-foreground")} />
                  <span className="min-w-0 flex-1 truncate">{opt.title}</span>
                  {/* Phím markdown gõ ở đầu dòng: ô phím như gợi ý phím tắt ở Ctrl+K, để "-", ">" không trông như ký tự lạc */}
                  {opt.shortcut && <Kbd className="shrink-0 tracking-wide">{opt.shortcut}</Kbd>}
                </Pressable>
              </React.Fragment>
            );
          })}
          {filteredOptions.length === 0 && (
            <div role="status" className="px-2 py-1.5 text-muted-foreground">
              <p>Không có khối nào khớp “{searchQuery.trim()}”</p>
              <p className="mt-0.5 text-muted-foreground/80">Gõ Space để viết tiếp như chữ thường</p>
            </div>
          )}
        </div>
      </div>
      {activeOption && (
        <p id={descriptionId} className="shrink-0 truncate border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
          {activeOption.description}
        </p>
      )}
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// Main Component: TaskBlockEditor
// ---------------------------------------------------------------------------

export function TaskBlockEditor({
  taskId,
  initialDescription,
  placeholder,
  subTasks = [],
  canEdit = true,
  globalFileDrop = true,
  selectionContainerSelector,
  showFixedToolbar = false,
  onSaveContent,
  onSelectSubtask,
  onOpenCreateSubtask,
  className,
  variant = "page",
  ariaLabel,
  autoFocus = false,
  collab,
}: TaskBlockEditorProps) {
  const compose = variant === "compose";
  // Chế độ chốt lúc gắn: plugin của editor không đổi được sau khi tạo
  const collabRef = React.useRef(collab);
  // Global file drop state
  const [isGlobalDragging, setIsGlobalDragging] = React.useState(false);
  const dragCounterRef = React.useRef(0);
  const resetGlobalDrag = React.useCallback(() => {
    dragCounterRef.current = 0;
    setIsGlobalDragging(false);
  }, []);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const lastSavedContentRef = React.useRef<string | null>(initialDescription ?? null);
  // Skip very first onValueChange (Plate mount); mark ready after 1st tick
  const editorReadyRef = React.useRef(false);
  React.useEffect(() => { const t = setTimeout(() => { editorReadyRef.current = true; }, 100); return () => clearTimeout(t); }, []);

  // Compute initial Plate value from persisted description
  const initialValue = React.useMemo(() => parseToPlateValue(initialDescription), []);

  // Create Plate editor with full v53 plugins
  const editor = usePlateEditor({
    id: taskId,
    // Cùng sửa: nội dung lấy từ tài liệu Yjs khi `init` (máy chủ seed từ mô tả), không khởi tạo bằng mô tả ở client
    value: collabRef.current ? undefined : (initialValue as any),
    skipInitialization: Boolean(collabRef.current),
    plugins: [
      BaseParagraphPlugin.withComponent(ParagraphEl),
      BaseH1Plugin.withComponent(H1El).extend({ inputRules: [HeadingRules.markdown()] }).configure({
        rules: { break: { empty: "reset", splitReset: true }, delete: { start: "reset" } },
      }),
      BaseH2Plugin.withComponent(H2El).extend({ inputRules: [HeadingRules.markdown()] }).configure({
        rules: { break: { empty: "reset", splitReset: true }, delete: { start: "reset" } },
      }),
      BaseH3Plugin.withComponent(H3El).extend({ inputRules: [HeadingRules.markdown()] }).configure({
        rules: { break: { empty: "reset", splitReset: true }, delete: { start: "reset" } },
      }),
      BaseBlockquotePlugin.withComponent(BlockquoteEl).extend({ inputRules: [BlockquoteRules.markdown()] }).configure({
        rules: { break: { default: "lineBreak", empty: "reset" } },
      }),
      BaseCalloutPlugin.withComponent(CalloutEl).configure({
        rules: { break: { default: "lineBreak", empty: "reset", emptyLineEnd: "deleteExit" } },
      }),
      BaseHorizontalRulePlugin.withComponent(HrEl).extend({ inputRules: [HorizontalRuleRules.markdown()] }),
      BaseListPlugin.extend({ inputRules: [BulletedListRules.markdown(), OrderedListRules.markdown(), TaskListRules.markdown()] }),
      BaseIndentPlugin,
      BoldPlugin.extend({ inputRules: [BoldRules.markdown()] }),
      ItalicPlugin.extend({ inputRules: [ItalicRules.markdown()] }),
      UnderlinePlugin,
      StrikethroughPlugin.extend({ inputRules: [StrikethroughRules.markdown()] }),
      CodePlugin.extend({ inputRules: [CodeRules.markdown()] }),
      HighlightPlugin,
      LinkPlugin.withComponent(InlineLinkEl),
      SlashPlugin.configure({ options: { trigger: "/", triggerPreviousCharPattern: /^\s?$/ } }),
      SlashInputPlugin.withComponent(SlashInputElement),
      TablePlugin.withComponent(TableEl),
      TableRowPlugin.withComponent(TableRowEl),
      TableCellPlugin.withComponent(TableCellEl),
      TableCellHeaderPlugin.withComponent(TableCellHeaderEl),
      TogglePlugin.withComponent(ToggleEl),
      MentionPlugin.withComponent(MentionEl),
      MentionInputPlugin.withComponent(MentionInputElement),
      MediaEmbedPlugin.withComponent(MediaEmbedEl),
      TocPlugin.withComponent(TocEl),
      // compose: ⌘/Ctrl+Enter thuộc về hộp tạo việc (Tạo nhiệm vụ), không chèn dòng thoát khối
      ExitBreakPlugin.configure({
        shortcuts: compose ? {} : { insert: { keys: "mod+enter" }, insertBefore: { keys: "mod+shift+enter" } },
      }),
      QcetAlignPlugin,
      QcetImagePlugin.withComponent(ImageEl),
      QcetAttachmentPlugin.withComponent(AttachmentEl),
      QcetLinkBlockPlugin.withComponent(LinkBlockEl),
      QcetBookmarkPlugin.withComponent(BookmarkEl),
      collabRef.current ? collabNodeIdPlugin : NodeIdPlugin,
      BlockSelectionPlugin.configure({
        options: {
          enableContextMenu: true,
          areaOptions: {
            behaviour: { startThreshold: 4, scrolling: { speedDivider: 1.5 } },
            features: { singleTap: { allow: false } },
          },
        },
      }),
      DndPlugin.configure({
        options: { enableScroller: true },
        render: {
          aboveNodes: ({ element, editor }) => {
            const path = editor.api.findPath(element);
            if (path?.length !== 1) return;
            return (props) => <BlockRowDraggable {...props} compact={compose} />;
          },
        },
      }),
      TrailingBlockPlugin.configure({ options: { type: "p" } }),
      ...(collabRef.current
        ? [collabRef.current.runtime.collabPlugin(collabRef.current, (synced) => collabRef.current?.onSyncChange?.(synced))]
        : []),
    ],
    override: {
      components: {
        [PT.image]: ImageEl,
        [PT.attachment]: AttachmentEl,
        [PT.link]: LinkBlockEl,
        [PT.bookmark]: BookmarkEl,
        [PT.table]: TableEl,
        [PT.tableRow]: TableRowEl,
        [PT.tableCell]: TableCellEl,
        [PT.tableHeader]: TableCellHeaderEl,
        [PT.toggle]: ToggleEl,
        [PT.mention]: MentionEl,
        [PT.mediaEmbed]: MediaEmbedEl,
      },
    },
  }, []);

  // Nối máy chủ cộng tác (chi tiết và cách tránh khởi tạo đôi của StrictMode ở `connectCollab`)
  React.useEffect(() => {
    const options = collabRef.current;
    if (!options) return;
    return options.runtime.connectCollab(editor, options);
  }, [editor]);

  // Chờ một khung hình: Plate chuẩn hóa giá trị lúc gắn (gán id khối, thêm dòng cuối) làm mất vùng chọn đặt ngay trong effect
  React.useEffect(() => {
    if (!autoFocus) return;
    const frame = requestAnimationFrame(() => {
      editor.tf.select(editor.api.end([]));
      editor.tf.focus();
    });
    return () => cancelAnimationFrame(frame);
    // Chỉ lúc gắn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phạm vi kéo chọn khối: cả vùng cuộn của trang (kiểu Notion) thay vì chỉ khung soạn thảo.
  // Phải đặt trước khi <Plate> render để useSelectionArea đọc đúng tùy chọn.
  React.useMemo(() => {
    if (!selectionContainerSelector) return;
    editor.setOption(BlockSelectionPlugin as any, "areaOptions" as any, {
      behaviour: { startThreshold: 4, scrolling: { speedDivider: 1.5 } },
      features: { singleTap: { allow: false } },
      boundaries: selectionContainerSelector,
      container: selectionContainerSelector,
    } as any);
  }, [editor, selectionContainerSelector]);

  // Autosave: debounced, skip blob URLs
  const [saveError, setSaveError] = React.useState<string | null>(null);
  // Luôn gọi bản onSaveContent mới nhất (version/đóng gói state đổi theo mỗi lần render)
  const onSaveRef = React.useRef(onSaveContent);
  onSaveRef.current = onSaveContent;

  // Tải tệp lên máy chủ; compose: nhiệm vụ chưa được tạo nên tệp chưa gắn với nhiệm vụ nào
  const uploadFileToServer = React.useCallback(
    (file: File): Promise<UploadedFile | null> => uploadFile(file, { taskId: taskId && !compose ? taskId : undefined }),
    [taskId, compose],
  );

  const triggerAutoSave = React.useCallback(
    (plateValue: PlateValue) => {
      // Skip the initial onValueChange from Plate mount
      if (!editorReadyRef.current) return;
      // Cùng sửa: máy chủ cộng tác lưu, không PATCH mô tả
      if (collabRef.current) return;
      const contentBlocks = plateToBlocks(plateValue);
      // Filter out blocks with blob: URLs (still uploading) instead of skipping entire save
      const savableBlocks = contentBlocks.filter((b) => !b.url?.startsWith("blob:"));
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      // compose: báo ngay (đồng bộ) để ⌘/Ctrl+Enter ngay sau khi gõ vẫn gửi đủ nội dung
      if (compose) {
        const payload = serializeBlocksToContent(savableBlocks);
        if (payload === lastSavedContentRef.current) return;
        lastSavedContentRef.current = payload;
        void Promise.resolve(onSaveRef.current(payload)).catch(() => {});
        return;
      }
      debounceTimerRef.current = setTimeout(async () => {
        debounceTimerRef.current = null;
        try {
          const payload = serializeBlocksToContent(savableBlocks);
          if (payload === lastSavedContentRef.current) return;
          await onSaveRef.current(payload);
          lastSavedContentRef.current = payload;
          setSaveError(null);
        } catch (err: unknown) {
          setSaveError(err instanceof Error ? err.message : "Lỗi lưu nội dung");
        }
      }, 800);
    },
    [compose],
  );

  const uploadContextValue = React.useMemo<TaskEditorUploadContextValue>(
    () => ({
      uploadFileToServer,
      taskId,
      triggerAutoSave,
    }),
    [uploadFileToServer, taskId, triggerAutoSave]
  );

  // Flush pending save on unmount / navigate away
  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
        try {
          const blocks = plateToBlocks(editor.children as PlateValue);
          const savable = blocks.filter((b) => !b.url?.startsWith("blob:"));
          const payload = serializeBlocksToContent(savable);
          if (payload && payload !== lastSavedContentRef.current) {
            lastSavedContentRef.current = payload;
            void Promise.resolve(onSaveRef.current(payload)).catch(() => {});
          }
        } catch { /* best-effort on unmount */ }
      }
    };
  }, [editor]);

  // Process dropped files
  const handleProcessDroppedFiles = React.useCallback((files: FileList | File[], clientY?: number) => {
    if (!canEdit || editor.api.isReadOnly()) return;
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;
    const formatSize = (bytes: number) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };
    const isImageFile = (file: File) => {
      if (file.type.startsWith("image/")) return true;
      const ext = file.name.split(".").pop()?.toLowerCase();
      return !!ext && ["png", "jpg", "jpeg", "webp", "gif", "svg", "avif"].includes(ext);
    };

    const newNodes: PlateElemT[] = fileArray.map((file, idx) => {
      const nodeId = `b-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`;
      // Insert placeholder with blob URL immediately, then upload in background
      let objectUrl = "";
      try { objectUrl = URL.createObjectURL(file); } catch {}

      // Background upload → then set server URL on editor node
      uploadFileToServer(file).catch((err: unknown) => {
        setSaveError(err instanceof Error ? err.message : "Không thể tải lên tệp đính kèm");
        return null;
      }).then(async (result) => {
        if (!result) {
          // Clean up placeholder node on failure
          const nodes = editor.children as PlateElemT[];
          const nodeIdx = nodes.findIndex((n) => n.id === nodeId);
          if (nodeIdx >= 0) {
            editor.tf.removeNodes({ at: [nodeIdx] });
          }
          return;
        }
        // Set server URL on editor node
        const nodes = editor.children as PlateElemT[];
        const nodeIdx = nodes.findIndex((n) => n.id === nodeId);
        if (nodeIdx >= 0) {
          if (objectUrl && isImageFile(file)) localImagePreviews.set(result.fileUrl, objectUrl);
          editor.tf.setNodes({ url: result.fileUrl } as any, { at: [nodeIdx] });
          // Trigger autosave now that blob URL is replaced with server URL
          triggerAutoSave(editor.children as PlateValue);
        }
      });

      if (isImageFile(file)) {
        return {
          id: nodeId, type: PT.image, children: [{ text: file.name }],
          url: objectUrl, imageWidth: 100,
        } as PlateElemT;
      } else {
        const ext = file.name.split(".").pop()?.toUpperCase() || "TỆP";
        return {
          id: nodeId, type: PT.attachment, children: [{ text: file.name }],
          url: objectUrl, fileName: file.name, fileSize: formatSize(file.size), fileType: ext,
        } as PlateElemT;
      }
    });

    // 3-tier insertion: focused block -> canvas cursor clientY -> end of document
    const sel = editor.selection;
    let insertAt: number[];
    if (sel) {
      insertAt = [sel.anchor.path[0] + 1];
    } else {
      insertAt = [editor.children.length];
    }
    editor.tf.insertNodes(newNodes as any, { at: insertAt });
  }, [canEdit, editor, uploadFileToServer, triggerAutoSave]);

  // Container paste and drop handlers
  const handleContainerPaste = React.useCallback((e: React.ClipboardEvent) => {
    if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
      e.preventDefault();
      handleProcessDroppedFiles(e.clipboardData.files);
    }
  }, [handleProcessDroppedFiles]);

  // Cờ riêng cho "khung soạn đã xử lý lần thả này": không dựa vào defaultPrevented vì thư viện kéo thả của Plate
  // cũng preventDefault ở window, làm tệp thả ngoài khung soạn bị bỏ qua.
  const containerHandledDropRef = React.useRef(false);
  const handleContainerDrop = React.useCallback((e: React.DragEvent) => {
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      e.preventDefault();
      containerHandledDropRef.current = true;
      handleProcessDroppedFiles(e.dataTransfer.files, e.clientY);
    }
  }, [handleProcessDroppedFiles]);

  // Window drag & drop listeners
  React.useEffect(() => {
    if (!globalFileDrop || !canEdit) return;

    const handleWindowDragEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
        dragCounterRef.current += 1;
        setIsGlobalDragging(true);
      }
    };
    const handleWindowDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
      }
    };
    const handleWindowDragLeave = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
        dragCounterRef.current -= 1;
        if (dragCounterRef.current <= 0) {
          resetGlobalDrag();
        }
      }
    };
    const handleWindowDrop = (e: DragEvent) => {
      if (containerHandledDropRef.current) {
        // Khung soạn đã chèn tệp ở onDrop — tránh chèn trùng
        containerHandledDropRef.current = false;
        resetGlobalDrag();
        return;
      }
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        e.preventDefault();
        resetGlobalDrag();
        handleProcessDroppedFiles(e.dataTransfer.files, e.clientY);
      }
    };

    window.addEventListener("dragenter", handleWindowDragEnter);
    window.addEventListener("dragover", handleWindowDragOver);
    window.addEventListener("dragleave", handleWindowDragLeave);
    window.addEventListener("drop", handleWindowDrop);

    return () => {
      window.removeEventListener("dragenter", handleWindowDragEnter);
      window.removeEventListener("dragover", handleWindowDragOver);
      window.removeEventListener("dragleave", handleWindowDragLeave);
      window.removeEventListener("drop", handleWindowDrop);
    };
  }, [globalFileDrop, canEdit, resetGlobalDrag, handleProcessDroppedFiles]);

  // Sync external description changes
  React.useEffect(() => {
    if (containerRef.current?.contains(document.activeElement)) return;
    if (initialDescription !== lastSavedContentRef.current) {
      lastSavedContentRef.current = initialDescription || null;
      const newValue = parseToPlateValue(initialDescription);
      editor.tf.setValue(newValue as any);
    }
  }, [initialDescription, editor]);

  // Handle Slash menu option selection
  const handleSlashSelect = React.useCallback(
    (option: MenuItemOption): boolean => {
      if (editor.api.isReadOnly()) return false;
      const id = `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const insertBlock = (node: PlateElemT): boolean => {
        const voidBlock = insertSlashBlock(editor, node);
        if (!voidBlock) return false;
        // Khối có ô nhập (dấu trang, liên kết, nhúng) thì đưa con trỏ vào ô đó khi khối đã hiện
        window.setTimeout(() => {
          const field = editor.api.toDOMNode(voidBlock as any)?.querySelector<HTMLElement>("input:not([type=file]), textarea");
          if (field) field.focus();
          else editor.tf.focus();
        }, 0);
        return true;
      };

      if (option.type === "table") {
        const tableNode: PlateElemT = {
          id,
          type: PT.table,
          children: [
            {
              id: `tr-${id}-0`,
              type: PT.tableRow,
              children: [
                { id: `th-${id}-0-0`, type: PT.tableHeader, children: [{ type: PT.paragraph, children: [{ text: "Cột 1" }] }] },
                { id: `th-${id}-0-1`, type: PT.tableHeader, children: [{ type: PT.paragraph, children: [{ text: "Cột 2" }] }] },
                { id: `th-${id}-0-2`, type: PT.tableHeader, children: [{ type: PT.paragraph, children: [{ text: "Cột 3" }] }] },
              ],
            },
            {
              id: `tr-${id}-1`,
              type: PT.tableRow,
              children: [
                { id: `td-${id}-1-0`, type: PT.tableCell, children: [{ type: PT.paragraph, children: [{ text: "" }] }] },
                { id: `td-${id}-1-1`, type: PT.tableCell, children: [{ type: PT.paragraph, children: [{ text: "" }] }] },
                { id: `td-${id}-1-2`, type: PT.tableCell, children: [{ type: PT.paragraph, children: [{ text: "" }] }] },
              ],
            },
          ],
        };
        return insertBlock(tableNode);
      }

      if (option.type === "toggle") {
        const toggleNode: PlateElemT = {
          id,
          type: PT.toggle,
          open: true,
          children: [{ text: "Mục hướng dẫn..." }],
        };
        return insertBlock(toggleNode);
      }

      if (option.type === "media_embed") {
        const embedNode: PlateElemT = {
          id,
          type: PT.mediaEmbed,
          url: "",
          children: [{ text: "" }],
        };
        return insertBlock(embedNode);
      }

      const contentBlock: ContentBlockItem = {
        id,
        type: option.type,
        content: "",
        ...(option.level ? { level: option.level } : {}),
      };
      const [plateNode] = blocksToPlate([contentBlock]);
      return insertBlock(plateNode as PlateElemT);
    },
    [editor],
  );

  // Menu khối dùng chung cho tay kéo và chuột phải. Khối nằm trong vùng chọn nhiều khối (chọn khối, hoặc bôi đen chữ trải
  // qua nhiều khối) thì menu tác động cả vùng chọn (kiểu Notion), không thì chỉ khối đó; chọn khối ngay khi mở để thấy
  // menu đang tác động lên đâu.
  const [blockMenu, setBlockMenu] = React.useState<(BlockMenuState & { openId: string }) | null>(null);
  const openBlockMenu = React.useCallback(
    (element: any, anchor: BlockMenuState["anchor"]) => {
      const selected = editor.getOption(BlockSelectionPlugin, "selectedIds") as Set<string> | undefined;
      const textSelected: string[] = editor.selection && editor.api.isExpanded()
        ? Array.from(editor.api.nodes({ at: editor.selection, match: (_node: any, path: number[]) => path.length === 1 }))
            .map(([node]: any) => node.id)
            .filter((id: unknown): id is string => typeof id === "string")
        : [];
      const ids = selected?.has(element.id) && selected.size > 1
        ? [...selected]
        : textSelected.length > 1 && textSelected.includes(element.id)
          ? textSelected
          : [element.id];
      editor.getApi(BlockSelectionPlugin).blockSelection.set(ids);
      setBlockMenu({ anchor, ids, openId: element.id });
    },
    [editor],
  );
  const closeBlockMenu = React.useCallback(() => {
    setBlockMenu(null);
    // Như menu khối của Plate: trả focus cho vùng chọn khối để Delete, ⌘C, mũi tên vẫn tác động lên khối
    requestAnimationFrame(() => {
      if ((editor.getOption(BlockSelectionPlugin, "selectedIds") as Set<string> | undefined)?.size) {
        editor.getApi(BlockSelectionPlugin).blockSelection.focus();
      }
    });
  }, [editor]);
  const blockMenuContext = React.useMemo(
    () => ({ openId: blockMenu?.openId ?? null, open: openBlockMenu }),
    [blockMenu?.openId, openBlockMenu],
  );

  const handleEditorContextMenu = React.useCallback(
    (e: React.MouseEvent) => {
      if (!canEdit || editor.api.isReadOnly()) return;
      // Find the block element from the right-click target
      const target = e.target as HTMLElement;
      const blockEl = target.closest<HTMLElement>("[data-block-id]");
      if (!blockEl) return;
      const blockId = blockEl.getAttribute("data-block-id");
      if (!blockId) return;
      // Find the Plate element by id
      const node = editor.children.find((n: any) => n.id === blockId);
      if (!node) return;
      e.preventDefault();
      const { clientX: x, clientY: y } = e;
      openBlockMenu(node, { getBoundingClientRect: () => new DOMRect(x, y, 0, 0) });
    },
    [canEdit, editor, openBlockMenu],
  );

  // Bấm vùng trống dưới khối cuối: khối cuối là ảnh/tệp/bảng thì thêm dòng mới, còn lại đặt con trỏ cuối nội dung
  const handleMouseDownBelowContent = React.useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (e.button !== 0 || !canEdit || editor.api.isReadOnly()) return;
      const contentEl = e.currentTarget.querySelector<HTMLElement>("[data-slate-editor]");
      if (!contentEl || (e.target !== contentEl && e.target !== e.currentTarget)) return;
      const lastBlockEl = contentEl.lastElementChild;
      if (lastBlockEl && e.clientY <= lastBlockEl.getBoundingClientRect().bottom) return;
      e.preventDefault();
      const lastNode = editor.children[editor.children.length - 1] as any;
      if (lastNode?.type !== PT.paragraph) {
        editor.tf.insertNodes(editor.api.create.block({ type: PT.paragraph }), { at: [editor.children.length] });
      }
      editor.tf.select(editor.api.end([]));
      editor.tf.focus();
    },
    [canEdit, editor],
  );

  return (
    <SlashSelectContext.Provider value={handleSlashSelect}>
      <TaskEditorUploadContext.Provider value={uploadContextValue}>
        <div
          ref={containerRef}
          data-slot="task-block-editor"
          data-image-viewer-group=""
        data-plate-selectable="true"
        onPaste={handleContainerPaste}
        onDrop={handleContainerDrop}
        className={cn(
          "relative flex-1 min-h-0 flex flex-col text-foreground cursor-text [&_.slate-selection-area]:border-0 [&_.slate-selection-area]:bg-primary/20 [&_.slate-selection-area]:rounded-xs [&_.slate-selection-area]:pointer-events-none [&_.slate-selection-area]:z-50",
          className
        )}
      >
        {showFixedToolbar && <FixedToolbar editor={editor} />}

        <div className={cn("flex flex-1 min-h-0 flex-col", !compose && "px-1 py-1")}>
          <BlockMenuContext.Provider value={blockMenuContext}>
          <PlateDndContainer>
            <Plate
              editor={editor}
              onValueChange={({ value }) => {
                if (canEdit) triggerAutoSave(value as PlateValue);
              }}
            >
              <PlateContainer
                data-plate-selectable="true"
                className="relative flex-1 min-h-0 flex flex-col"
                onContextMenu={handleEditorContextMenu}
                onMouseDown={handleMouseDownBelowContent}
              >
                <PlateContent
                  readOnly={!canEdit}
                  aria-label={ariaLabel}
                  placeholder={placeholder || "Nhập nội dung hoặc gõ / để chèn..."}
                  className={cn("outline-none text-sm leading-relaxed flex-1", compose ? "pb-4" : "pl-8 sm:pl-9 pr-4 pb-32")}
                  onBlur={() => {
                    // Cùng sửa thì không dọn: khối rỗng có thể là khối người khác vừa tạo và đang gõ
                    if (canEdit && !collabRef.current) pruneEmptyBlocks(editor);
                  }}
                />
                <FloatingToolbar editor={editor} />
              </PlateContainer>
              <BlockMenu editor={editor} state={blockMenu} onClose={closeBlockMenu} />
            </Plate>
          </PlateDndContainer>
          </BlockMenuContext.Provider>
        </div>
        {isGlobalDragging && typeof document !== "undefined" && createPortal(
          <div
            data-testid="global-file-drop-overlay"
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm border-4 border-dashed border-primary/60 animate-in fade-in-0 duration-150 pointer-events-none"
          >
            <div className="p-4 rounded-2xl bg-card border border-border shadow-2xl flex flex-col items-center gap-3 text-center max-w-sm">
              <div className="p-3 rounded-full bg-primary/10 text-primary">
                <UploadCloud className="size-8 motion-safe:animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Thả để thêm vào nội dung</h3>
                <p className="text-xs text-muted-foreground mt-1">Ảnh, PDF, tài liệu và các tệp khác</p>
              </div>
            </div>
          </div>,
          document.body
        )}

        {saveError && (
          <div className="px-3 py-1 bg-danger-soft border-t border-destructive/30 text-destructive text-xs">
            {saveError}
          </div>
        )}
      </div>
      </TaskEditorUploadContext.Provider>
    </SlashSelectContext.Provider>
  );
}
