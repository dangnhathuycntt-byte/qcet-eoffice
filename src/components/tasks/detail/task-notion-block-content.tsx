"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  Plate,
  PlateContent,
  usePlateEditor,
  useEditorRef,
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
import { SlashPlugin, SlashInputPlugin } from "@platejs/slash-command/react";
import { BlockSelectionPlugin, useBlockSelectable, useBlockSelected } from "@platejs/selection/react";
import { DndPlugin, useDraggable, useDropLine } from "@platejs/dnd";
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
  Paperclip,
  Link2,
  Trash2,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Search,
  CheckCircle2,
  Circle,
  Image as ImageIcon,
  FileText,
  Bookmark,
  Globe,
  IndentIncrease,
  IndentDecrease,
  UploadCloud,
  Highlighter,
  Table as TableIcon,
  AtSign,
  Tv,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  BookOpen,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StaffTask } from "@/types/dashboard";
import {
  type PlateElement as PlateElemT,
  type PlateValue,
  parseToPlateValue,
  serializePlateValue,
  plateToQcet,
  qcetToPlate,
  parseContentToBlocks,
  serializeBlocksToContent,
  isMeaningfulBlock,
  PLATE_NODE_TYPES as PT,
} from "./plate-qcet-codec";

// ---------------------------------------------------------------------------
// Re-exports (public API unchanged)
// ---------------------------------------------------------------------------

export type NotionBlockType =
  | "text"
  | "heading"
  | "bulleted_list"
  | "numbered_list"
  | "checklist"
  | "quote"
  | "callout"
  | "divider"
  | "image"
  | "attachment"
  | "link"
  | "bookmark"
  | "table"
  | "toggle"
  | "media_embed";

export interface NotionBlockItem {
  id: string;
  type: NotionBlockType;
  content: string;
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
  isInternalQcet?: boolean;
  entityType?: string;
  align?: "left" | "center" | "right" | "justify";
  open?: boolean;
  rows?: Array<{ cells: Array<{ content: string; isHeader?: boolean; children?: any[] }> }>;
  providerType?: string;
}

export function moveBlock(blocks: NotionBlockItem[], activeId: string, overId: string) {
  const from = blocks.findIndex((block) => block.id === activeId);
  const to = blocks.findIndex((block) => block.id === overId);
  if (from < 0 || to < 0 || from === to) return blocks;
  const next = [...blocks];
  const [block] = next.splice(from, 1);
  next.splice(to, 0, block);
  return next;
}

export { isMeaningfulBlock, parseContentToBlocks, serializeBlocksToContent };

export interface TaskNotionBlockContentProps {
  taskId: string;
  initialDescription?: string | null;
  subTasks?: StaffTask[];
  canEdit?: boolean;
  globalFileDrop?: boolean;
  onSaveContent: (newContent: string) => Promise<void> | void;
  onSelectSubtask?: (subtask: StaffTask) => void;
  onOpenCreateSubtask?: () => void;
  className?: string;
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
      if (pathname.includes("/schedule/") || pathname.includes("/lich-tuan/") || pathname.includes("/meetings/")) {
        return {
          url,
          title: "Lịch công tác trường",
          domain: "QCET E-Office",
          description: "Lịch tuần và sự kiện công tác toàn trường",
          isInternalQcet: true,
          entityType: pathname.includes("/meetings/") ? "meeting" : "schedule",
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

// ---------------------------------------------------------------------------
// Menu item options for Slash command & Quick action
// ---------------------------------------------------------------------------

interface MenuItemOption {
  id: string;
  type: NotionBlockType;
  group: "Soạn thảo" | "Danh sách" | "Tiêu đề" | "Trích dẫn & Ghi chú" | "Bảng biểu & Cấu trúc" | "Phương tiện & Tệp" | "Liên kết" | "Phân cách";
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  level?: 1 | 2 | 3;
}

const MENU_OPTIONS: MenuItemOption[] = [
  { id: "opt-text", type: "text", group: "Soạn thảo", title: "Văn bản", description: "Văn bản thuần túy, tự do định dạng", icon: Type, shortcut: "text" },
  { id: "opt-bulleted", type: "bulleted_list", group: "Danh sách", title: "Danh sách dấu đầu dòng", description: "Danh sách dấu chấm đầu dòng", icon: List, shortcut: "-" },
  { id: "opt-numbered", type: "numbered_list", group: "Danh sách", title: "Danh sách đánh số", description: "Danh sách đánh số thứ tự", icon: ListOrdered, shortcut: "1." },
  { id: "opt-checklist", type: "checklist", group: "Danh sách", title: "Checklist", description: "Danh sách việc cần làm có ô đánh dấu", icon: CheckSquare, shortcut: "[]" },
  { id: "opt-h1", type: "heading", level: 1, group: "Tiêu đề", title: "Tiêu đề 1", description: "Tiêu đề lớn phân mục chính", icon: Heading1, shortcut: "#" },
  { id: "opt-h2", type: "heading", level: 2, group: "Tiêu đề", title: "Tiêu đề 2", description: "Tiêu đề vừa", icon: Heading2, shortcut: "##" },
  { id: "opt-h3", type: "heading", level: 3, group: "Tiêu đề", title: "Tiêu đề 3", description: "Tiêu đề nhỏ", icon: Heading3, shortcut: "###" },
  { id: "opt-quote", type: "quote", group: "Trích dẫn & Ghi chú", title: "Trích dẫn", description: "Trích dẫn ý kiến hoặc chỉ đạo", icon: Quote, shortcut: ">" },
  { id: "opt-callout", type: "callout", group: "Trích dẫn & Ghi chú", title: "Ghi chú nổi bật", description: "Hộp lưu ý hoặc thông điệp quan trọng", icon: Info },
  { id: "opt-table", type: "table", group: "Bảng biểu & Cấu trúc", title: "Bảng biểu", description: "Tạo bảng dữ liệu phân công, báo cáo", icon: TableIcon, shortcut: "/table" },
  { id: "opt-toggle", type: "toggle", group: "Bảng biểu & Cấu trúc", title: "Khối thu gọn (Toggle)", description: "Thu gọn hướng dẫn, danh mục dài", icon: ChevronRight, shortcut: "/toggle" },
  { id: "opt-image", type: "image", group: "Phương tiện & Tệp", title: "Hình ảnh", description: "Tải lên hoặc dán hình ảnh trực quan", icon: ImageIcon, shortcut: "/image" },
  { id: "opt-attachment", type: "attachment", group: "Phương tiện & Tệp", title: "Tệp đính kèm", description: "Đính kèm tệp PDF, DOCX, bảng tính", icon: Paperclip, shortcut: "/file" },
  { id: "opt-media-embed", type: "media_embed", group: "Phương tiện & Tệp", title: "Nhúng phương tiện", description: "Nhúng video hướng dẫn YouTube/Loom/Drive", icon: Tv, shortcut: "/embed" },
  { id: "opt-bookmark", type: "bookmark", group: "Liên kết", title: "Dấu trang web", description: "Thẻ xem trước trực quan cho liên kết", icon: Bookmark, shortcut: "/bookmark" },
  { id: "opt-link", type: "link", group: "Liên kết", title: "Liên kết", description: "Đường dẫn liên kết web hoặc tài liệu ngoài", icon: Link2, shortcut: "/link" },
  { id: "opt-divider", type: "divider", group: "Phân cách", title: "Đường phân cách", description: "Đường kẻ chia tách phân đoạn", icon: Minus, shortcut: "---" },
];

// Mock QCET staff directory for @mention combobox
const QCET_STAFF_DIRECTORY = [
  { id: "u-1", name: "TS. Nguyễn Văn A", role: "Hiệu trưởng", email: "nva@qcet.edu.vn" },
  { id: "u-2", name: "ThS. Trần Thị B", role: "Trưởng phòng Đào tạo", email: "ttb@qcet.edu.vn" },
  { id: "u-3", name: "ThS. Lê Văn C", role: "Trưởng khoa CNTT", email: "lvc@qcet.edu.vn" },
  { id: "u-4", name: "CN. Đặng Nhật Huy", role: "Chuyên viên CNTT", email: "dnhhuy@qcet.edu.vn" },
  { id: "u-5", name: "ThS. Phạm Thu D", role: "Phó Trưởng phòng TCHC", email: "ptd@qcet.edu.vn" },
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

function ParagraphEl({ attributes, children, element }: any) {
  const editor = useEditorRef();
  const indent = element.indent;
  const listStyle = element.listStyleType;
  const checked = element.checked;
  const textAlign = element.textAlign;

  const alignStyle = textAlign ? { textAlign } : undefined;

  if (indent >= 1 && listStyle) {
    if (typeof checked === "boolean") {
      const toggleChecked = () => {
        if (!editor.api.isReadOnly()) {
          const path = editor.api.findPath(element);
          if (path) editor.tf.setNodes({ checked: !checked } as any, { at: path });
        }
      };
      return (
        <div {...attributes} style={alignStyle} className="flex items-start gap-2.5 py-0.5 text-sm leading-relaxed">
          <button type="button" contentEditable={false} onClick={toggleChecked} className="mt-0.5 shrink-0 select-none cursor-pointer" aria-label={checked ? "Đánh dấu chưa xong" : "Đánh dấu hoàn thành"}>
            {checked ? (
              <CheckCircle2 className="size-4 text-emerald-600 fill-emerald-100" />
            ) : (
              <Circle className="size-4 text-muted-foreground/60 hover:text-foreground" />
            )}
          </button>
          <span className={cn("flex-1 min-w-0", checked && "line-through text-muted-foreground/70")}>
            {children}
          </span>
        </div>
      );
    }
    if (listStyle === "decimal") {
      return (
        <div {...attributes} style={alignStyle} className="flex items-start gap-2 py-0.5 text-sm leading-relaxed">
          <span contentEditable={false} className="font-mono text-xs text-muted-foreground font-semibold shrink-0 mt-0.5 w-4 text-right select-none">
            {(element.listStart ?? 1)}.
          </span>
          <span className="flex-1 min-w-0">{children}</span>
        </div>
      );
    }
    return (
      <div {...attributes} style={alignStyle} className="flex items-start gap-2 py-0.5 text-sm leading-relaxed">
        <span contentEditable={false} className="size-1.5 rounded-full bg-foreground/70 shrink-0 mt-2" />
        <span className="flex-1 min-w-0">{children}</span>
      </div>
    );
  }

  return (
    <div {...attributes} style={alignStyle} className="text-sm leading-relaxed text-foreground py-0.5">
      {children}
    </div>
  );
}

function H1El({ attributes, children, element }: any) {
  return <h1 {...attributes} style={element.textAlign ? { textAlign: element.textAlign } : undefined} className="text-xl sm:text-2xl mt-2 mb-0.5 font-bold tracking-tight text-foreground">{children}</h1>;
}

function H2El({ attributes, children, element }: any) {
  return <h2 {...attributes} style={element.textAlign ? { textAlign: element.textAlign } : undefined} className="text-base sm:text-lg font-semibold mt-1.5 mb-0.5 tracking-tight text-foreground">{children}</h2>;
}

function H3El({ attributes, children, element }: any) {
  return <h3 {...attributes} style={element.textAlign ? { textAlign: element.textAlign } : undefined} className="text-sm sm:text-base font-semibold mt-1 mb-0.5 tracking-tight text-foreground">{children}</h3>;
}

function BlockquoteEl({ attributes, children, element }: any) {
  return <blockquote {...attributes} style={element.textAlign ? { textAlign: element.textAlign } : undefined} className="border-l-2 border-primary/70 pl-3 py-1 my-0.5 italic text-foreground/90 text-sm leading-relaxed">{children}</blockquote>;
}

function CalloutEl({ attributes, children }: any) {
  return (
    <div {...attributes} className="flex items-start gap-2 px-2.5 py-1.5 my-1 rounded-xl bg-primary/5 border border-primary/20 text-foreground text-sm leading-relaxed">
      <Info className="size-4 text-primary shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function HrEl({ attributes, children }: any) {
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

function TableEl({ attributes, children }: any) {
  return (
    <div className="my-3 overflow-x-auto rounded-lg border border-border/50">
      <table {...attributes} className="w-full border-collapse text-sm text-left">
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function TableRowEl({ attributes, children }: any) {
  return <tr {...attributes} className="border-b border-border/30 last:border-b-0">{children}</tr>;
}

function TableCellEl({ attributes, children }: any) {
  return <td {...attributes} className="border-r border-border/30 last:border-r-0 px-3 py-2 min-w-[100px] min-h-[36px] align-top text-foreground leading-relaxed relative group/cell [&[data-selected]]:bg-primary/[0.06]">{children}</td>;
}

function TableCellHeaderEl({ attributes, children }: any) {
  return <th {...attributes} className="border-r border-border/30 last:border-r-0 bg-muted/30 px-3 py-2 min-w-[100px] min-h-[36px] align-top font-semibold text-foreground leading-relaxed select-none relative [&[data-selected]]:bg-primary/[0.06]">{children}</th>;
}

// ---------------------------------------------------------------------------
// Toggle (Collapsible) Component
// ---------------------------------------------------------------------------

function ToggleEl({ attributes, children, element }: any) {
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
        <button
          type="button"
          contentEditable={false}
          onClick={handleToggle}
          className="mt-0.5 size-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-transform"
          aria-label={isOpen ? "Thu gọn" : "Mở rộng"}
        >
          <ChevronRight className={cn("size-3.5 transition-transform duration-150", isOpen && "rotate-90")} />
        </button>
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

function MentionEl({ attributes, children, element }: any) {
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

function MentionInputElement({ attributes, children, element }: any) {
  const editor = useEditorRef();
  const query = (element.children?.[0]?.text || "").replace(/^@/, "").toLowerCase();
  const [filtered, setFiltered] = React.useState(QCET_STAFF_DIRECTORY);

  React.useEffect(() => {
    if (!query) setFiltered(QCET_STAFF_DIRECTORY);
    else setFiltered(QCET_STAFF_DIRECTORY.filter((s) => s.name.toLowerCase().includes(query) || s.email.toLowerCase().includes(query)));
  }, [query]);

  const selectStaff = React.useCallback((staff: typeof QCET_STAFF_DIRECTORY[0]) => {
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
      <div contentEditable={false} className="absolute left-0 top-full mt-1 z-50 w-64 rounded-lg border border-border/80 bg-card p-1 shadow-lg animate-in fade-in-0 zoom-in-95 duration-100">
        <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Nhân sự QCET</div>
        <div className="max-h-48 overflow-y-scroll space-y-0.5">
          {filtered.map((staff) => (
            <button
              key={staff.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); selectStaff(staff); }}
              className="flex w-full items-center justify-between px-2 py-1.5 rounded-md hover:bg-muted text-xs text-left cursor-pointer"
            >
              <div>
                <div className="font-medium text-foreground">{staff.name}</div>
                <div className="text-[10px] text-muted-foreground">{staff.role}</div>
              </div>
            </button>
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
  const { url } = element;
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
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground text-xs gap-1.5">
            <Tv className="size-6 text-primary/60" />
            <span>Chưa cấu hình URL video/iframe</span>
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

function ImageEl({ attributes, children, element }: any) {
  const editor = useEditorRef();
  const { url, caption, imageWidth = 100 } = element;
  const setImageUrl = React.useCallback((newUrl: string, newCaption?: string) => {
    const path = editor.api.findPath(element);
    if (path) editor.tf.setNodes({ url: newUrl, content: newCaption || element.children?.[0]?.text || "", imageWidth: 100 } as any, { at: path });
  }, [editor, element]);
  return (
    <div {...attributes}>
      <div contentEditable={false} className="py-1">
        {url ? (
          <div className="relative group/image my-2 max-w-full">
            <div style={{ width: `${imageWidth}%` }} className="relative mx-auto transition-all duration-150">
              <img src={url} alt={caption || "Hình ảnh"} className="w-full h-auto max-h-[640px] object-contain rounded-lg select-none" loading="lazy" />
              {!editor.api.isReadOnly() && <input type="text" defaultValue={caption || ""} placeholder="Thêm chú thích..." onBlur={(ev) => { const p = editor.api.findPath(element); if (p) editor.tf.setNodes({ content: ev.target.value } as any, { at: p }); }} className="w-full mt-1.5 text-xs text-muted-foreground text-center bg-transparent border-0 outline-none focus:text-foreground placeholder:text-muted-foreground/40" />}
              {!editor.api.isReadOnly() && <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1 p-0.5 rounded bg-background/80 border border-border/60 opacity-0 group-hover/image:opacity-100 transition-opacity">
                {[25, 50, 75, 100].map((w) => <button key={w} type="button" onClick={() => { const p = editor.api.findPath(element); if (p) editor.tf.setNodes({ imageWidth: w } as any, { at: p }); }} className={"px-1.5 py-0.5 text-[10px] rounded cursor-pointer " + (imageWidth === w ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>{w}%</button>)}
              </div>}
              <div className="absolute top-2 right-2 flex items-center gap-1 p-1 rounded-lg bg-background/80 border border-border/60 opacity-0 group-hover/image:opacity-100 transition-opacity">
                <button type="button" onClick={() => { if (!editor.api.isReadOnly()) { const p = editor.api.findPath(element); if (p) editor.tf.removeNodes({ at: p }); } }} className="p-1 rounded hover:bg-rose-50 text-muted-foreground hover:text-rose-600 cursor-pointer" title="Xóa">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-muted/40 border border-dashed border-border/80 text-xs">
            <ImageIcon className="size-4 text-primary shrink-0" />
            <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity cursor-pointer shadow-2xs">
              <UploadCloud className="size-3.5" />
              <span>Tải ảnh lên</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  const reader = new FileReader();
                  reader.onload = (ev) => { setImageUrl(ev.target?.result as string, f.name); };
                  reader.readAsDataURL(f);
                }
              }} />
            </label>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function AttachmentEl({ attributes, children, element }: any) {
  const { fileName, fileSize, fileType, url } = element;
  return (
    <div {...attributes}>
      <div contentEditable={false} className="py-0.5">
        <div className="flex items-center gap-2.5 p-2.5 my-1 rounded-xl bg-muted/30 border border-border/60 hover:bg-muted/50 transition-colors text-xs">
          <div className="p-1.5 rounded-lg bg-primary/10 shrink-0"><FileText className="size-4 text-primary" /></div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-foreground text-sm truncate">{fileName || "Tệp"}</div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
              {fileType && <span className="font-mono">{fileType}</span>}
              {fileSize && <span>{fileSize}</span>}
            </div>
          </div>
          {url && (
            <a href={url} target="_blank" rel="noreferrer" className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
              <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
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
            <button type="button" onClick={() => { if (draftUrl.trim()) setLinkUrl(draftUrl); }} className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity cursor-pointer">Lưu</button>
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
              <img src={thumbnailUrl} alt="" className="size-10 rounded-lg object-cover shrink-0" />
            ) : favicon ? (
              <img src={favicon} alt="" className="size-5 rounded shrink-0" />
            ) : (
              <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0"><Globe className="size-4" /></div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-foreground text-sm truncate flex items-center gap-1.5">
                <span>{url}</span>
                {isInternalQcet && <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary/15 text-primary font-semibold">Nội bộ</span>}
              </div>
              {desc && <div className="text-muted-foreground text-[11px] truncate mt-0.5">{desc}</div>}
            </div>
            <a href={url} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <ExternalLink className="size-4" />
            </a>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-2 my-1 rounded-xl bg-muted/40 border border-dashed border-border/80 text-xs">
            <Bookmark className="size-4 text-muted-foreground shrink-0" />
            <input type="text" value={draftUrl} onChange={(e) => setDraftUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && draftUrl.trim()) setBookmarkUrl(draftUrl); }} placeholder="Dán link web để tạo thẻ dấu trang (nhấn Enter)..." className="flex-1 bg-transparent border-0 outline-none text-foreground placeholder:text-muted-foreground/50 text-xs" />
            <button type="button" onClick={() => { if (draftUrl.trim()) setBookmarkUrl(draftUrl); }} className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity cursor-pointer">Tạo thẻ</button>
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

function MultiBlockToolbar({ editor }: { editor: any }) {
  const readOnly = editor.api.isReadOnly();
  const [hasSelection, setHasSelection] = React.useState(false);

  React.useEffect(() => {
    const check = () => {
      try {
        const ids = editor.api.blockSelection?.getSelectedIds?.() || editor.getOption?.(BlockSelectionPlugin, "selectedIds");
        setHasSelection(ids && (ids instanceof Set ? ids.size > 1 : Object.keys(ids).length > 1));
      } catch { setHasSelection(false); }
    };
    const timer = setInterval(check, 300);
    return () => clearInterval(timer);
  }, [editor]);

  if (!hasSelection || readOnly) return null;

  return (
    <div className="sticky bottom-2 z-40 flex items-center justify-center pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-border/80 bg-card px-2 py-1.5 shadow-lg text-xs">
        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.tf.duplicateSelection?.(); }} className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-muted transition-colors cursor-pointer">
          <Copy className="size-3.5 text-muted-foreground" /> Nhân bản
        </button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.tf.deleteFragment?.(); }} className="flex items-center gap-1.5 px-2 py-1 rounded-md text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer">
          <Trash2 className="size-3.5" /> Xóa
        </button>
        <div className="w-px h-4 bg-border/60 mx-0.5" />
        <button type="button" onMouseDown={(e) => { e.preventDefault(); plateIndent(editor); }} className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-muted transition-colors cursor-pointer" title="Thụt vào">
          <IndentIncrease className="size-3.5 text-muted-foreground" />
        </button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); plateOutdent(editor); }} className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-muted transition-colors cursor-pointer" title="Giảm thụt">
          <IndentDecrease className="size-3.5 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toolbar Dropdown primitive (click-to-toggle, closes on outside click)
// ---------------------------------------------------------------------------

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

  const { refs, floatingStyles } = useFloating({
    strategy: "fixed",
    placement: "bottom-start",
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
          style={floatingStyles}
          className={cn(
            "z-[100] min-w-[140px] rounded-lg border border-border/80 bg-card p-1 shadow-lg animate-in fade-in-0 zoom-in-95 duration-100",
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
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onAction(); }}
      className="flex w-full items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left hover:bg-muted transition-colors cursor-pointer"
    >
      <Icon className="size-3.5 text-muted-foreground shrink-0" />
      <span>{label}</span>
    </button>
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
          <button type="button" title="Văn bản" className={cn(tbBtn, tbBtnIdle, "gap-0.5 w-auto px-1.5")}>
            <Type className="size-3.5" />
            <ChevronDown className="size-2.5 opacity-60" />
          </button>
        }
      >
        <DropdownItem icon={Type} label="Văn bản" onAction={() => editor.tf.setNodes({ type: PT.paragraph } as any)} />
        <DropdownItem icon={Heading1} label="Tiêu đề 1" onAction={() => editor.tf.setNodes({ type: PT.h1 } as any)} />
        <DropdownItem icon={Heading2} label="Tiêu đề 2" onAction={() => editor.tf.setNodes({ type: PT.h2 } as any)} />
        <DropdownItem icon={Heading3} label="Tiêu đề 3" onAction={() => editor.tf.setNodes({ type: PT.h3 } as any)} />
      </ToolbarDropdown>

      <div className="w-px h-4 bg-border/60 mx-0.5" />

      {/* ── Inline marks: Bold / Italic / Underline / Highlight ── */}
      <button type="button" title="In đậm (⌘B)" onMouseDown={(e) => { e.preventDefault(); toggleMark("bold"); }} className={cn(tbBtn, isMarkActive("bold") ? "bg-primary/15 text-primary" : tbBtnIdle)}>
        <Bold className="size-3.5" />
      </button>
      <button type="button" title="In nghiêng (⌘I)" onMouseDown={(e) => { e.preventDefault(); toggleMark("italic"); }} className={cn(tbBtn, isMarkActive("italic") ? "bg-primary/15 text-primary" : tbBtnIdle)}>
        <Italic className="size-3.5" />
      </button>
      <button type="button" title="Gạch chân (⌘U)" onMouseDown={(e) => { e.preventDefault(); toggleMark("underline"); }} className={cn(tbBtn, isMarkActive("underline") ? "bg-primary/15 text-primary" : tbBtnIdle)}>
        <Underline className="size-3.5" />
      </button>
      <button type="button" title="Đánh dấu nổi bật (⌘⇧H)" onMouseDown={(e) => { e.preventDefault(); toggleMark("highlight"); }} className={cn(tbBtn, isMarkActive("highlight") ? "bg-amber-100 text-amber-900" : tbBtnIdle)}>
        <Highlighter className="size-3.5" />
      </button>

      <div className="w-px h-4 bg-border/60 mx-0.5" />

      {/* ── Link ── */}
      <button type="button" title="Chèn liên kết (⌘K)" onMouseDown={(e) => { e.preventDefault(); triggerFloatingLinkInsert(editor, { focused: true }); }} className={cn(tbBtn, tbBtnIdle)}>
        <Link className="size-3.5" />
      </button>

      <div className="w-px h-4 bg-border/60 mx-0.5" />

      {/* ── List dropdown ── */}
      <ToolbarDropdown
        trigger={
          <button type="button" title="Danh sách" className={cn(tbBtn, tbBtnIdle, "gap-0.5 w-auto px-1.5")}>
            <List className="size-3.5" />
            <ChevronDown className="size-2.5 opacity-60" />
          </button>
        }
      >
        <DropdownItem icon={List} label="Dấu đầu dòng" onAction={() => editor.tf.setNodes({ type: PT.paragraph, listStyleType: "disc", indent: 1 } as any)} />
        <DropdownItem icon={ListOrdered} label="Đánh số" onAction={() => editor.tf.setNodes({ type: PT.paragraph, listStyleType: "decimal", indent: 1 } as any)} />
        <DropdownItem icon={CheckSquare} label="Checklist" onAction={() => editor.tf.setNodes({ type: PT.paragraph, listStyleType: "disc", indent: 1, checked: false } as any)} />
      </ToolbarDropdown>

      {/* ── Alignment dropdown ── */}
      <ToolbarDropdown
        trigger={
          <button type="button" title="Căn chỉnh" className={cn(tbBtn, tbBtnIdle, "gap-0.5 w-auto px-1.5")}>
            <AlignLeft className="size-3.5" />
            <ChevronDown className="size-2.5 opacity-60" />
          </button>
        }
      >
        <DropdownItem icon={AlignLeft} label="Căn trái" onAction={() => handleAlign("left")} />
        <DropdownItem icon={AlignCenter} label="Căn giữa" onAction={() => handleAlign("center")} />
        <DropdownItem icon={AlignRight} label="Căn phải" onAction={() => handleAlign("right")} />
        <DropdownItem icon={AlignJustify} label="Căn đều" onAction={() => handleAlign("justify")} />
      </ToolbarDropdown>

      <div className="w-px h-4 bg-border/60 mx-0.5" />

      {/* ── Table ── */}
      <button type="button" title="Chèn bảng biểu" onMouseDown={(e) => { e.preventDefault(); handleInsertTable(); }} className={cn(tbBtn, tbBtnIdle)}>
        <TableIcon className="size-3.5" />
      </button>

      {/* ── More / Overflow (Quote, Callout, Toggle, Divider) ── */}
      <ToolbarDropdown
        trigger={
          <button type="button" title="Thêm" className={cn(tbBtn, tbBtnIdle)}>
            <MoreHorizontal className="size-3.5" />
          </button>
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

  const { refs, floatingStyles } = useFloating({
    strategy: "fixed",
    placement: "top",
    whileElementsMounted: autoUpdate,
    middleware: [offset(8), flip(), shift({ padding: 8 })],
  });

  React.useEffect(() => {
    if (readOnly) { setVisible(false); return; }
    const sel = editor.selection;
    if (!sel || editor.api.isCollapsed?.(sel)) {
      setVisible(false);
      return;
    }
    const domSel = window.getSelection();
    if (!domSel || domSel.rangeCount === 0) {
      setVisible(false);
      return;
    }
    const range = domSel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setVisible(false);
      return;
    }
    refs.setPositionReference({
      getBoundingClientRect: () => rect,
    });
    setVisible(true);
  }, [editor, editor.selection, readOnly, refs]);

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
      style={floatingStyles}
      className="z-50 flex items-center gap-0.5 rounded-lg border border-border/80 bg-card p-0.5 shadow-lg animate-in fade-in-0 zoom-in-95 duration-100"
    >
      {marks.map(({ key, icon: Icon, label }) => (
        <button
          key={key}
          type="button"
          title={label}
          onMouseDown={(e) => { e.preventDefault(); toggleMark(key); }}
          className={cn(
            "size-7 flex items-center justify-center rounded-md text-xs transition-colors cursor-pointer",
            isMarkActive(key) ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Icon className="size-3.5" strokeWidth={1.5} />
        </button>
      ))}
      <div className="w-px h-4 bg-border/60 mx-0.5" />
      <button
        type="button"
        title="Chèn liên kết (⌘K)"
        onMouseDown={(e) => {
          e.preventDefault();
          triggerFloatingLinkInsert(editor, { focused: true });
        }}
        className="size-7 flex items-center justify-center rounded-md text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
      >
        <Link className="size-3.5" strokeWidth={1.5} />
      </button>
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

function BlockMenu({ editor, element, onClose }: { editor: any; element: any; onClose: () => void }) {
  const [showTurnInto, setShowTurnInto] = React.useState(false);

  const turnInto = React.useCallback((opt: typeof TURN_INTO_OPTIONS[number]) => {
    const path = editor.api.findPath(element);
    if (!path) return;
    const qcetBlock = plateToQcet([element])[0];
    const converted: any = { id: qcetBlock.id, type: opt.type, content: qcetBlock.content };
    if (opt.type === "heading") converted.level = (opt as any).level;
    if (opt.type === "checklist") converted.checked = false;
    const [plateNode] = qcetToPlate([converted]);
    const richChildren = element.children;
    const finalNode = { ...plateNode, children: richChildren };
    editor.tf.removeNodes({ at: path });
    editor.tf.insertNodes([finalNode] as any, { at: path });
    onClose();
  }, [editor, element, onClose]);

  const duplicateBlock = React.useCallback(() => {
    const path = editor.api.findPath(element);
    if (!path) return;
    const id = `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const clone = { ...JSON.parse(JSON.stringify(element)), id };
    editor.tf.insertNodes([clone] as any, { at: [path[0] + 1] });
    onClose();
  }, [editor, element, onClose]);

  const deleteBlock = React.useCallback(() => {
    const path = editor.api.findPath(element);
    if (!path) return;
    editor.tf.removeNodes({ at: path });
    onClose();
  }, [editor, element, onClose]);

  return (
    <div className="absolute left-0 top-full mt-1 z-50 w-44 rounded-lg border border-border/80 bg-card p-1 text-xs shadow-lg animate-in fade-in-0 zoom-in-95 duration-100">
      <button
        type="button"
        onClick={() => setShowTurnInto(!showTurnInto)}
        className="flex w-full items-center justify-between px-2 py-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer text-left"
      >
        <span className="flex items-center gap-2"><ArrowRight className="size-3.5 text-muted-foreground" /> Chuyển thành</span>
        <ChevronRight className="size-3 text-muted-foreground" strokeWidth={1.5} />
      </button>
      {showTurnInto && (
        <div className="ml-1 mt-0.5 space-y-0.5 border-l border-border/40 pl-1">
          {TURN_INTO_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={`${opt.type}-${(opt as any).level || ""}`}
                type="button"
                onClick={() => turnInto(opt)}
                className="flex w-full items-center gap-2 px-2 py-1 rounded-md hover:bg-muted transition-colors cursor-pointer text-left text-xs"
              >
                <Icon className="size-3.5 text-muted-foreground" /> {opt.label}
              </button>
            );
          })}
        </div>
      )}
      <button type="button" onClick={duplicateBlock} className="flex w-full items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer text-left">
        <Copy className="size-3.5 text-muted-foreground" /> Nhân bản
      </button>
      <button type="button" onClick={() => { plateIndent(editor); onClose(); }} className="flex w-full items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer text-left">
        <IndentIncrease className="size-3.5 text-muted-foreground" /> Thụt vào
      </button>
      <button type="button" onClick={() => { plateOutdent(editor); onClose(); }} className="flex w-full items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer text-left">
        <IndentDecrease className="size-3.5 text-muted-foreground" /> Giảm thụt
      </button>
      <button type="button" onClick={deleteBlock} className="flex w-full items-center gap-2 px-2 py-1.5 rounded-md text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer text-left">
        <Trash2 className="size-3.5" /> Xóa block
      </button>
    </div>
  );
}

function BlockRow({ children, element }: { children: React.ReactNode; element: any }) {
  const { props: selectableProps } = useBlockSelectable();
  const isSelected = useBlockSelected();
  const editor = useEditorRef();
  const readOnly = editor.api.isReadOnly();
  const { isDragging, previewRef, handleRef } = useDraggable({ element });
  const { dropLine } = useDropLine({ id: element.id, orientation: "horizontal" });
  const [showBlockMenu, setShowBlockMenu] = React.useState(false);
  const blockMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!showBlockMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (blockMenuRef.current && !blockMenuRef.current.contains(e.target as Node)) {
        setShowBlockMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showBlockMenu]);

  // Don't render block drag handles for table inner elements (rows, cells)
  if (element.type === PT.tableRow || element.type === PT.tableCell || element.type === PT.tableHeader) {
    return <>{children}</>;
  }

  return (
    <div
      ref={previewRef}
      {...selectableProps}
      className={cn(
        "group/block relative flex items-start -mx-2 px-2 py-0.5 transition-colors duration-75 outline-hidden select-auto rounded-md",
        isSelected ? "bg-primary/[0.08]" : "hover:bg-muted/30",
        isDragging && "opacity-50",
      )}
      data-block-id={element.id}
    >
      <div ref={blockMenuRef} className={cn("w-5 shrink-0 -ml-6 mr-1 flex items-center justify-center h-6 mt-0.5 relative", readOnly && "invisible")} contentEditable={false} data-qcet-block-selection-rail="">
        <button
          ref={handleRef}
          type="button"
          contentEditable={false}
          tabIndex={-1}
          aria-label="Mở menu block hoặc kéo để sắp xếp"
          onClick={(e) => { e.stopPropagation(); setShowBlockMenu((prev) => !prev); }}
          className={cn(
            "size-5 flex items-center justify-center rounded-md",
            "text-muted-foreground/50 hover:text-foreground hover:bg-muted",
            "cursor-grab active:cursor-grabbing transition-opacity duration-100",
            "opacity-0 pointer-events-none",
            "group-hover/block:opacity-100 group-hover/block:pointer-events-auto",
            "focus-visible:ring-2 focus-visible:ring-primary/40",
            "motion-reduce:transition-none",
          )}
        >
          <GripVertical className="size-3.5" />
        </button>
        {showBlockMenu && !readOnly && <BlockMenu editor={editor} element={element} onClose={() => setShowBlockMenu(false)} />}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
      {dropLine && (
        <div className={cn(
          "absolute left-0 right-0 h-0.5 bg-primary",
          dropLine === "top" ? "-top-px" : "-bottom-px",
        )} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slash Menu component
// ---------------------------------------------------------------------------

const SlashSelectContext = React.createContext<((option: MenuItemOption) => void) | null>(null);

function SlashInputElement({ attributes, children, element }: any) {
  const editor = useEditorRef();
  const onSelectOption = React.useContext(SlashSelectContext);
  const searchQuery = (element.children?.[0]?.text || "").replace(/^\//, "");
  const filteredOptions = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return MENU_OPTIONS;
    return MENU_OPTIONS.filter((opt) =>
      opt.title.toLowerCase().includes(q) || opt.description.toLowerCase().includes(q) ||
      opt.group.toLowerCase().includes(q) || (opt.shortcut?.toLowerCase().includes(q) ?? false)
    );
  }, [searchQuery]);

  const handleSelect = React.useCallback((option: MenuItemOption) => {
    const path = editor.api.findPath(element);
    if (path) editor.tf.removeNodes({ at: path });
    onSelectOption?.(option);
  }, [editor, element, onSelectOption]);

  const inlineRef = React.useRef<HTMLSpanElement>(null);

  return (
    <span {...attributes} ref={inlineRef}>
      <span contentEditable={false} className="inline">
        <SlashMenu
          isOpen={true}
          onClose={() => {
            const path = editor.api.findPath(element);
            if (path) editor.tf.removeNodes({ at: path });
          }}
          onSelect={handleSelect}
          searchQuery={searchQuery}
          setSearchQuery={() => {}}
          anchorElement={inlineRef.current}
          filteredOptions={filteredOptions}
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
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (option: MenuItemOption) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  anchorElement: HTMLElement | null;
  filteredOptions: MenuItemOption[];
}) {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const menuListRef = React.useRef<HTMLDivElement>(null);
  const menuItemRefs = React.useRef<Map<number, HTMLButtonElement>>(new Map());

  const { refs, floatingStyles } = useFloating({
    strategy: "fixed",
    placement: "bottom-start",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(6),
      flip({ padding: 14 }),
      shift({ padding: 14 }),
      size({
        padding: 14,
        apply({ availableHeight, elements }) {
          Object.assign(elements.floating.style, {
            maxHeight: `${Math.min(availableHeight, 320)}px`,
          });
        },
      }),
    ],
  });

  React.useEffect(() => {
    if (anchorElement) refs.setPositionReference(anchorElement);
  }, [anchorElement, refs]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [filteredOptions]);

  React.useEffect(() => {
    const el = menuItemRefs.current.get(activeIndex);
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activeIndex]);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // e.nativeEvent.isComposing && keyCode === 229
      if (e.isComposing || (e as any).nativeEvent?.isComposing || (e as any).keyCode === 229) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % Math.max(1, filteredOptions.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + filteredOptions.length) % Math.max(1, filteredOptions.length));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredOptions[activeIndex]) {
          onSelect(filteredOptions[activeIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, activeIndex, filteredOptions, onSelect, onClose]);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={refs.setFloating}
      style={floatingStyles}
      className="z-50 w-72 overflow-y-scroll overscroll-contain rounded-xl border border-border/80 bg-card p-1 text-xs shadow-xl animate-in fade-in-0 zoom-in-95 duration-100"
    >
      <div ref={menuListRef} className="space-y-0.5">
        {filteredOptions.map((opt, idx) => {
          const Icon = opt.icon;
          const isSelected = idx === activeIndex;
          return (
            <button
              key={opt.id}
              ref={(el) => { if (el) menuItemRefs.current.set(idx, el); else menuItemRefs.current.delete(idx); }}
              type="button"
              onMouseEnter={() => setActiveIndex(idx)}
              onClick={() => onSelect(opt)}
              className={cn(
                "flex w-full items-center gap-2.5 px-2 py-1.5 rounded-lg text-left transition-colors cursor-pointer",
                isSelected ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground"
              )}
            >
              <div className={cn("p-1 rounded-md", isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground")}>
                <Icon className="size-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{opt.title}</div>
                <div className={cn("text-[10px] truncate", isSelected ? "text-primary-foreground/80" : "text-muted-foreground")}>{opt.description}</div>
              </div>
              {opt.shortcut && (
                <span className={cn("font-mono text-[10px] px-1 py-0.5 rounded", isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground")}>
                  {opt.shortcut}
                </span>
              )}
            </button>
          );
        })}
        {filteredOptions.length === 0 && (
          <div className="px-3 py-4 text-center text-muted-foreground">Không có kết quả phù hợp</div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// Main Component: TaskNotionBlockContent
// ---------------------------------------------------------------------------

export function TaskNotionBlockContent({
  taskId,
  initialDescription,
  subTasks = [],
  canEdit = true,
  globalFileDrop = true,
  onSaveContent,
  onSelectSubtask,
  onOpenCreateSubtask,
  className,
}: TaskNotionBlockContentProps) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);

  // Global file drop state
  const [isGlobalDragging, setIsGlobalDragging] = React.useState(false);
  const dragCounterRef = React.useRef(0);
  const resetGlobalDrag = React.useCallback(() => {
    dragCounterRef.current = 0;
    setIsGlobalDragging(false);
  }, []);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const lastSavedContentRef = React.useRef<string | null>(initialDescription || null);

  // Compute initial Plate value from persisted description
  const initialValue = React.useMemo(() => parseToPlateValue(initialDescription), []);

  // Create Plate editor with full v53 plugins
  const editor = usePlateEditor({
    value: initialValue as any,
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
      ExitBreakPlugin.configure({
        shortcuts: { insert: { keys: "mod+enter" }, insertBefore: { keys: "mod+shift+enter" } },
      }),
      QcetAlignPlugin,
      QcetImagePlugin.withComponent(ImageEl),
      QcetAttachmentPlugin.withComponent(AttachmentEl),
      QcetLinkBlockPlugin.withComponent(LinkBlockEl),
      QcetBookmarkPlugin.withComponent(BookmarkEl),
      NodeIdPlugin,
      BlockSelectionPlugin.configure({
        options: {
          areaOptions: {
            behaviour: { startThreshold: 4, scrolling: { speedDivider: 1.5 } },
            features: { singleTap: { allow: false } },
            startAreas: ["[data-qcet-block-selection-rail]"],
            boundaries: ['[data-slot="task-notion-block-content"]'],
          },
        },
      }),
      DndPlugin.configure({ options: { enableScroller: true } }),
      TrailingBlockPlugin.configure({ options: { type: "p" } }),
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

  // Autosave: debounced, skip blob URLs
  const [saveError, setSaveError] = React.useState<string | null>(null);

  // URL Paste Chooser
  const [urlPastePopover, setUrlPastePopover] = React.useState<{ url: string; blockPath: number[] } | null>(null);
  const handleUrlPasteChoice = React.useCallback((choice: "link" | "bookmark", info: { url: string; blockPath: number[] }) => {
    if (editor.api.isReadOnly()) return;
    const meta = resolveUrlMetadata(info.url);
    const nodeId = `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newNode: PlateElemT = {
      id: nodeId,
      type: choice === "link" ? PT.link : PT.bookmark,
      children: [{ text: meta.url }],
      url: meta.url,
      description: meta.description,
    } as PlateElemT;
    editor.tf.insertNodes([newNode] as any, { at: [info.blockPath[0] + 1] });
    setUrlPastePopover(null);
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
      if (isImageFile(file)) {
        let objectUrl = "";
        try { objectUrl = URL.createObjectURL(file); } catch {}
        if (typeof FileReader !== "undefined") {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            if (dataUrl) {
              const nodes = editor.children as PlateElemT[];
              const nodeIdx = nodes.findIndex((n) => n.id === nodeId);
              if (nodeIdx >= 0) {
                editor.tf.setNodes({ url: dataUrl } as any, { at: [nodeIdx] });
              }
            }
          };
          reader.readAsDataURL(file);
        }
        return {
          id: nodeId, type: PT.image, children: [{ text: file.name }],
          url: objectUrl, imageWidth: 100,
        } as PlateElemT;
      } else {
        let objectUrl = "";
        try { objectUrl = URL.createObjectURL(file); } catch {}
        const ext = file.name.split(".").pop()?.toUpperCase() || "TỆP";
        if (file.size < 5 * 1024 * 1024 && typeof FileReader !== "undefined") {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            if (dataUrl) {
              const nodes = editor.children as PlateElemT[];
              const nodeIdx = nodes.findIndex((n) => n.id === nodeId);
              if (nodeIdx >= 0) {
                editor.tf.setNodes({ url: dataUrl } as any, { at: [nodeIdx] });
              }
            }
          };
          reader.readAsDataURL(file);
        }
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
  }, [canEdit, editor]);

  // Container paste and drop handlers
  const handleContainerPaste = React.useCallback((e: React.ClipboardEvent) => {
    if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
      e.preventDefault();
      handleProcessDroppedFiles(e.clipboardData.files);
    }
  }, [handleProcessDroppedFiles]);

  const handleContainerDrop = React.useCallback((e: React.DragEvent) => {
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      e.preventDefault();
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

  const triggerAutoSave = React.useCallback(
    (plateValue: PlateValue) => {
      const qcetBlocks = plateToQcet(plateValue);
      if (qcetBlocks.some((b) => b.url?.startsWith("blob:"))) return;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(async () => {
        try {
          const payload = serializeBlocksToContent(qcetBlocks);
          // Skip save if content unchanged from last saved or initial state
          if (payload === lastSavedContentRef.current) return;
          await onSaveContent(payload);
          lastSavedContentRef.current = payload;
          setSaveError(null);
        } catch (err: any) {
          setSaveError(err?.message || "Lỗi lưu nội dung");
        }
      }, 800);
    },
    [onSaveContent],
  );

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
    (option: MenuItemOption) => {
      if (editor.api.isReadOnly()) return;
      const id = `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

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
        editor.tf.insertNodes([tableNode] as any);
        return;
      }

      if (option.type === "toggle") {
        const toggleNode: PlateElemT = {
          id,
          type: PT.toggle,
          open: true,
          children: [{ text: "Mục hướng dẫn..." }],
        };
        editor.tf.insertNodes([toggleNode] as any);
        return;
      }

      if (option.type === "media_embed") {
        const embedNode: PlateElemT = {
          id,
          type: PT.mediaEmbed,
          url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          children: [{ text: "" }],
        };
        editor.tf.insertNodes([embedNode] as any);
        return;
      }

      const qcetBlock: NotionBlockItem = {
        id,
        type: option.type,
        content: "",
        ...(option.level ? { level: option.level } : {}),
      };
      const [plateNode] = qcetToPlate([qcetBlock]);
      editor.tf.insertNodes([plateNode] as any);
    },
    [editor],
  );

  return (
    <SlashSelectContext.Provider value={handleSlashSelect}>
      <div
        ref={containerRef}
        data-slot="task-notion-block-content"
        onPaste={handleContainerPaste}
        onDrop={handleContainerDrop}
        className={cn(
          "relative flex-1 min-h-0 flex flex-col text-foreground",
          className
        )}
      >
        <FixedToolbar editor={editor} />

        <div className="flex-1 min-h-0 px-1 py-3">
          <Plate
            editor={editor}
            onValueChange={({ value }) => {
              if (canEdit) triggerAutoSave(value as PlateValue);
            }}
          >
            <PlateContent
              readOnly={!canEdit}
              placeholder="Nhập nội dung hoặc gõ / để chèn"
              className="outline-none text-sm leading-relaxed"
            />
            <FloatingToolbar editor={editor} />
            <MultiBlockToolbar editor={editor} />
          </Plate>
        </div>

        {/* Global File Drop Full-Viewport Overlay Portal */}
        {isGlobalDragging && typeof document !== "undefined" && createPortal(
          <div
            data-testid="global-file-drop-overlay"
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm border-4 border-dashed border-primary/60 animate-in fade-in-0 duration-150 pointer-events-none"
          >
            <div className="p-4 rounded-2xl bg-card border border-border shadow-2xl flex flex-col items-center gap-3 text-center max-w-sm">
              <div className="p-3 rounded-full bg-primary/10 text-primary">
                <UploadCloud className="size-8 animate-bounce" />
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
          <div className="px-3 py-1 bg-rose-50 border-t border-rose-200 text-rose-600 text-xs">
            {saveError}
          </div>
        )}
      </div>
    </SlashSelectContext.Provider>
  );
}
