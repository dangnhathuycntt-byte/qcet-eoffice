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
} from "platejs";
import {
  BaseH1Plugin,
  BaseH2Plugin,
  BaseH3Plugin,
  BaseBlockquotePlugin,
  BaseHorizontalRulePlugin,
} from "@platejs/basic-nodes";
import { BaseCalloutPlugin } from "@platejs/callout";
import { BaseListPlugin } from "@platejs/list";
import { BaseIndentPlugin } from "@platejs/indent";
import { BlockSelectionPlugin, BlockSelectionAfterEditable, useBlockSelectable, useBlockSelected } from "@platejs/selection/react";
import { DndPlugin, useDraggable, useDropLine } from "@platejs/dnd";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import {
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
  Search,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Circle,
  Image as ImageIcon,
  FileText,
  Bookmark,
  Globe,
  UploadCloud,
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
  | "bookmark";

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
      if (pathname.includes("/documents/")) {
        return {
          url,
          title: "Văn bản & Hồ sơ công việc",
          domain: "QCET E-Office",
          description: "Cổng văn bản điện tử và hồ sơ điều hành",
          isInternalQcet: true,
          entityType: "document",
        };
      }
      if (pathname.includes("/meetings/")) {
        return {
          url,
          title: "Lịch họp & Công tác",
          domain: "QCET E-Office",
          description: "Lịch công tác và biên bản họp điều hành",
          isInternalQcet: true,
          entityType: "meeting",
        };
      }
    }

    // Link thông thường ngoài hệ thống
    let displayTitle = domain.replace(/^www\./, "");
    if (domain.includes("github.com")) displayTitle = "GitHub Repository";
    else if (domain.includes("youtube.com") || domain.includes("youtu.be")) displayTitle = "YouTube Video";
    else if (domain.includes("google.com")) displayTitle = "Tài liệu Google";

    return {
      url,
      title: displayTitle,
      domain: domain.replace(/^www\./, ""),
      description: pathname !== "/" ? pathname : undefined,
    };
  } catch {
    return {
      url,
      title: url,
      domain: url,
    };
  }
}

// ---------------------------------------------------------------------------
// Slash Menu options (unchanged QCET command inventory)
// ---------------------------------------------------------------------------

interface MenuItemOption {
  id: string;
  type: NotionBlockType;
  group: "Soạn thảo" | "Danh sách" | "Tiêu đề" | "Trích dẫn & Ghi chú" | "Phương tiện & Tệp" | "Liên kết" | "Phân cách";
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
  { id: "opt-image", type: "image", group: "Phương tiện & Tệp", title: "Hình ảnh", description: "Tải lên hoặc dán hình ảnh trực quan", icon: ImageIcon, shortcut: "/image" },
  { id: "opt-attachment", type: "attachment", group: "Phương tiện & Tệp", title: "Tệp đính kèm", description: "Đính kèm tệp PDF, DOCX, bảng tính", icon: Paperclip, shortcut: "/file" },
  { id: "opt-bookmark", type: "bookmark", group: "Liên kết", title: "Dấu trang web", description: "Thẻ xem trước trực quan cho liên kết", icon: Bookmark, shortcut: "/bookmark" },
  { id: "opt-link", type: "link", group: "Liên kết", title: "Liên kết", description: "Đường dẫn liên kết web hoặc tài liệu ngoài", icon: Link2, shortcut: "/link" },
  { id: "opt-divider", type: "divider", group: "Phân cách", title: "Đường phân cách", description: "Đường kẻ chia tách phân đoạn", icon: Minus, shortcut: "---" },
];

// ---------------------------------------------------------------------------
// Custom Plate plugins for QCET void block types
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

// ---------------------------------------------------------------------------
// Plate element render components — visual output matches original exactly
// ---------------------------------------------------------------------------

function ParagraphEl({ attributes, children, element }: any) {
  const editor = useEditorRef();
  const indent = element.indent;
  const listStyle = element.listStyleType;
  const checked = element.checked;

  if (indent >= 1 && listStyle) {
    if (typeof checked === "boolean") {
      const toggleChecked = () => {
        if (!editor.api.isReadOnly()) {
          const path = editor.api.findPath(element);
          if (path) editor.tf.setNodes({ checked: !checked } as any, { at: path });
        }
      };
      return (
        <div {...attributes} className="flex items-start gap-2.5 py-0.5 text-sm leading-relaxed">
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
        <div {...attributes} className="flex items-start gap-2 py-0.5 text-sm leading-relaxed">
          <span contentEditable={false} className="font-mono text-xs text-muted-foreground font-semibold shrink-0 mt-0.5 w-4 text-right select-none">
            {(element.listStart ?? 1)}.
          </span>
          <span className="flex-1 min-w-0">{children}</span>
        </div>
      );
    }
    return (
      <div {...attributes} className="flex items-start gap-2 py-0.5 text-sm leading-relaxed">
        <span contentEditable={false} className="size-1.5 rounded-full bg-foreground/70 shrink-0 mt-2" />
        <span className="flex-1 min-w-0">{children}</span>
      </div>
    );
  }

  return (
    <div {...attributes} className="text-sm leading-relaxed text-foreground py-0.5">
      {children}
    </div>
  );
}

function H1El({ attributes, children }: any) {
  return <h1 {...attributes} className="text-xl sm:text-2xl mt-2 mb-0.5 font-bold tracking-tight text-foreground">{children}</h1>;
}

function H2El({ attributes, children }: any) {
  return <h2 {...attributes} className="text-base sm:text-lg font-semibold mt-1.5 mb-0.5 tracking-tight text-foreground">{children}</h2>;
}

function H3El({ attributes, children }: any) {
  return <h3 {...attributes} className="text-sm sm:text-base font-semibold mt-1 mb-0.5 tracking-tight text-foreground">{children}</h3>;
}

function BlockquoteEl({ attributes, children }: any) {
  return <blockquote {...attributes} className="border-l-2 border-primary/70 pl-3 py-1 my-0.5 italic text-foreground/90 text-sm leading-relaxed">{children}</blockquote>;
}

function CalloutEl({ attributes, children }: any) {
  return (
    <div {...attributes} className="flex items-start gap-2.5 p-2.5 my-1 rounded-xl bg-primary/5 border border-primary/20 text-foreground text-sm leading-relaxed">
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
  const text = element.children?.[0]?.text || "";
  const commitUrl = React.useCallback((rawUrl: string) => {
    const meta = resolveUrlMetadata(rawUrl);
    const path = editor.api.findPath(element);
    if (path) editor.tf.setNodes({ url: meta.url, description: meta.description } as any, { at: path });
  }, [editor, element]);
  return (
    <div {...attributes}>
      <div contentEditable={false} className="py-0.5">
        {!url && (
          <div className="flex items-center gap-2 p-1.5 rounded-lg bg-muted/40 border border-border/60 text-xs">
            <Link2 className="size-3.5 text-primary shrink-0" />
            <input type="text" value={draftUrl} autoFocus onChange={(e) => setDraftUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && draftUrl.trim()) { e.preventDefault(); commitUrl(draftUrl.trim()); } }}
              placeholder="Dán URL liên kết (nhấn Enter)..."
              className="w-full bg-transparent text-xs text-foreground focus:outline-hidden font-mono" />
          </div>
        )}
        {url && (
          <div className="flex items-center gap-2.5 p-2 my-0.5 rounded-lg border border-border/60 hover:bg-muted/20 transition-colors text-xs">
            <Globe className="size-3.5 text-primary/70 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-foreground text-sm truncate">{text || url}</div>
              {desc && <div className="text-muted-foreground text-[11px] truncate">{desc}</div>}
            </div>
            <a href={url} target="_blank" rel="noreferrer" className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
              <ExternalLink className="size-3.5" />
            </a>
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
  const { url, description: desc } = element;
  const text = element.children?.[0]?.text || "";
  let domain = "";
  try { domain = new URL(url || "").hostname.replace(/^www\./, ""); } catch {}
  const commitUrl = React.useCallback((rawUrl: string) => {
    const meta = resolveUrlMetadata(rawUrl);
    const path = editor.api.findPath(element);
    if (path) editor.tf.setNodes({ url: meta.url, description: meta.description } as any, { at: path });
  }, [editor, element]);
  return (
    <div {...attributes}>
      <div contentEditable={false} className="py-1">
        {!url && (
          <div className="flex items-center gap-2 p-1.5 rounded-lg bg-muted/40 border border-border/60 text-xs">
            <Bookmark className="size-3.5 text-primary shrink-0" />
            <input type="text" value={draftUrl} autoFocus onChange={(e) => setDraftUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && draftUrl.trim()) { e.preventDefault(); commitUrl(draftUrl.trim()); } }}
              placeholder="Dán URL trang web để tạo dấu trang (nhấn Enter)..."
              className="w-full bg-transparent text-xs text-foreground focus:outline-hidden font-mono" />
          </div>
        )}
        {url && (
          <div className="group/bookmark my-1.5 flex items-stretch justify-between rounded-xl border border-border/60 hover:border-border hover:bg-muted/20 transition-all overflow-hidden text-xs">
            <a href={url} target="_blank" rel="noreferrer" className="flex-1 p-3 flex flex-col justify-between min-w-0">
              <div className="space-y-1">
                <div className="font-semibold text-sm text-foreground hover:text-primary transition-colors line-clamp-1">{text || domain}</div>
                {desc && <p className="text-muted-foreground text-[11px] line-clamp-2 leading-relaxed">{desc}</p>}
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground/70 text-[11px] font-mono mt-2">
                <Globe className="size-3 text-primary/70 shrink-0" />
                <span className="truncate">{domain}</span>
              </div>
            </a>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Block wrapper with hover-only six-dot handle
// ---------------------------------------------------------------------------



// ---------------------------------------------------------------------------
// renderElement — wraps each block with the handle gutter
// ---------------------------------------------------------------------------

function BlockRow({ children, element }: { children: React.ReactNode; element: any }) {
  const { props: selectableProps } = useBlockSelectable();
  const isSelected = useBlockSelected();
  const editor = useEditorRef();
  const readOnly = editor.api.isReadOnly();
  const { isDragging, previewRef, handleRef } = useDraggable({ element });
  const { dropLine } = useDropLine({ id: element.id, orientation: "horizontal" });
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
      <div className={cn("w-5 shrink-0 -ml-6 mr-1 flex items-center justify-center h-6 mt-0.5", readOnly && "invisible")} contentEditable={false} data-qcet-block-selection-rail="">
        <button
          ref={handleRef}
          type="button"
          contentEditable={false}
          tabIndex={-1}
          aria-label="Kéo để sắp xếp lại"
          className={cn(
            "size-5 flex items-center justify-center rounded-md",
            "text-muted-foreground/50 hover:text-foreground hover:bg-muted",
            "cursor-grab active:cursor-grabbing transition-all duration-100",
            "opacity-0 pointer-events-none",
            "group-hover/block:opacity-100 group-hover/block:pointer-events-auto",
            "group-focus-within/block:opacity-100 group-focus-within/block:pointer-events-auto",
            "focus-visible:opacity-100 focus-visible:pointer-events-auto focus-visible:ring-2 focus-visible:ring-primary/40",
            "motion-reduce:transition-none",
            (isSelected || isDragging) && "!opacity-100 !pointer-events-auto",
          )}
        >
          <GripVertical className="size-3.5" />
        </button>
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

function renderElement(props: any) {
  const { element } = props;
  let inner: React.ReactNode;

  switch (element.type) {
    case PT.h1: inner = <H1El {...props} />; break;
    case PT.h2: inner = <H2El {...props} />; break;
    case PT.h3: inner = <H3El {...props} />; break;
    case PT.blockquote: inner = <BlockquoteEl {...props} />; break;
    case PT.callout: inner = <CalloutEl {...props} />; break;
    case PT.hr: inner = <HrEl {...props} />; break;
    case PT.image: inner = <ImageEl {...props} />; break;
    case PT.attachment: inner = <AttachmentEl {...props} />; break;
    case PT.link: inner = <LinkBlockEl {...props} />; break;
    case PT.bookmark: inner = <BookmarkEl {...props} />; break;
    default: inner = <ParagraphEl {...props} />; break;
  }

  return (
    <BlockRow element={element}>
      {inner}
    </BlockRow>
  );
}

// ---------------------------------------------------------------------------
// Slash Menu component (extracted for reuse)
// ---------------------------------------------------------------------------

function SlashMenu({
  isOpen,
  onClose,
  onSelect,
  searchQuery,
  setSearchQuery,
  menuPosition,
  menuPlacement,
  menuMaxHeight,
  filteredOptions,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (option: MenuItemOption) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  menuPosition: { top?: number; bottom?: number; left: number } | null;
  menuPlacement: "bottom" | "top";
  menuMaxHeight: number;
  filteredOptions: MenuItemOption[];
}) {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const menuInputRef = React.useRef<HTMLInputElement>(null);
  const menuItemRefs = React.useRef<Map<number, HTMLButtonElement>>(new Map());
  const menuListRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      setTimeout(() => menuInputRef.current?.focus(), 40);
    }
  }, [isOpen]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [searchQuery]);

  React.useEffect(() => {
    if (isOpen) {
      const btn = menuItemRefs.current.get(activeIndex);
      btn?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activeIndex, isOpen]);

  if (!isOpen || typeof document === "undefined") return null;

  const groups = ["Soạn thảo", "Danh sách", "Tiêu đề", "Trích dẫn & Ghi chú", "Phương tiện & Tệp", "Liên kết", "Phân cách"] as const;

  return createPortal(
    <div
      role="dialog"
      aria-label="Menu lệnh"
      className="fixed inset-0 z-50 pointer-events-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          position: "fixed",
          top: menuPosition?.top !== undefined ? `${menuPosition.top}px` : undefined,
          bottom: menuPosition?.bottom !== undefined ? `${menuPosition.bottom}px` : undefined,
          left: menuPosition ? `${menuPosition.left}px` : undefined,
          maxHeight: `${menuMaxHeight}px`,
        }}
        className={cn(
          "w-72 max-w-[calc(100vw-28px)] rounded-2xl border border-border bg-white p-1.5 text-foreground shadow-2xl z-50 select-none flex flex-col",
          menuPlacement === "top"
            ? "animate-in fade-in-0 slide-in-from-bottom-2 duration-100"
            : "animate-in fade-in-0 slide-in-from-top-2 duration-100",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative mb-1.5 shrink-0">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <input
            ref={menuInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || (e as any).keyCode === 229) return;
              if (e.key === "Escape") { onClose(); }
              else if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((p) => p < filteredOptions.length - 1 ? p + 1 : 0); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((p) => p > 0 ? p - 1 : filteredOptions.length - 1); }
              else if (e.key === "Enter") { e.preventDefault(); const opt = filteredOptions[activeIndex]; if (opt) onSelect(opt); }
            }}
            placeholder="Tìm lệnh..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-muted/40 rounded-xl border border-border/60 focus:outline-hidden focus:ring-1 focus:ring-primary/40 font-medium"
          />
        </div>
        <div ref={menuListRef} className="flex-1 min-h-0 overflow-y-auto space-y-1.5 p-0.5 overscroll-contain">
          {groups.map((groupName) => {
            const groupOpts = filteredOptions.filter((o) => o.group === groupName);
            if (groupOpts.length === 0) return null;
            return (
              <div key={groupName} className="space-y-0.5">
                <div className="px-2.5 py-1 text-[11px] font-semibold text-muted-foreground/80">{groupName}</div>
                {groupOpts.map((opt) => {
                  const idx = filteredOptions.indexOf(opt);
                  const isActive = idx === activeIndex;
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      ref={(el) => { if (el) menuItemRefs.current.set(idx, el); else menuItemRefs.current.delete(idx); }}
                      type="button"
                      onClick={() => onSelect(opt)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={cn(
                        "w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors cursor-pointer",
                        isActive ? "bg-muted text-foreground font-medium" : "hover:bg-muted/60 text-muted-foreground",
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-1 rounded-lg border border-border/60 bg-white shrink-0"><Icon className="size-3.5 text-foreground" /></div>
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-foreground truncate">{opt.title}</div>
                          <div className="text-[11px] text-muted-foreground truncate">{opt.description}</div>
                        </div>
                      </div>
                      {opt.shortcut && <span className="font-mono text-[10px] text-muted-foreground/60 shrink-0">{opt.shortcut}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
          {filteredOptions.length === 0 && (
            <div className="text-center py-6 text-xs text-muted-foreground/60">Không tìm thấy lệnh phù hợp</div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Main component — Plate-powered editor with QCET persistence
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

  // Slash Menu State
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [menuSearchQuery, setMenuSearchQuery] = React.useState("");
  const [menuPlacement, setMenuPlacement] = React.useState<"bottom" | "top">("bottom");
  const [menuMaxHeight, setMenuMaxHeight] = React.useState(320);
  const [menuPosition, setMenuPosition] = React.useState<{ top?: number; bottom?: number; left: number } | null>(null);

  // Global file drop
  const [isGlobalDragging, setIsGlobalDragging] = React.useState(false);
  const dragCounterRef = React.useRef(0);
  const resetGlobalDrag = React.useCallback(() => { dragCounterRef.current = 0; setIsGlobalDragging(false); }, []);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const lastSavedContentRef = React.useRef<string | null>(initialDescription || null);

  // Filtered menu options
  const filteredMenuOptions = React.useMemo(() => {
    const q = menuSearchQuery.trim().toLowerCase();
    if (!q) return MENU_OPTIONS;
    return MENU_OPTIONS.filter((opt) => {
      return opt.title.toLowerCase().includes(q) || opt.description.toLowerCase().includes(q) ||
        opt.group.toLowerCase().includes(q) || (opt.shortcut?.toLowerCase().includes(q) ?? false);
    });
  }, [menuSearchQuery]);

  // Compute initial Plate value from persisted description
  const initialValue = React.useMemo(() => parseToPlateValue(initialDescription), []);

  // Create Plate editor with all plugins
  const editor = usePlateEditor({
    value: initialValue as any,
    plugins: [
      BaseParagraphPlugin.withComponent(ParagraphEl),
      BaseH1Plugin.withComponent(H1El),
      BaseH2Plugin.withComponent(H2El),
      BaseH3Plugin.withComponent(H3El),
      BaseBlockquotePlugin.withComponent(BlockquoteEl),
      BaseCalloutPlugin.withComponent(CalloutEl),
      BaseHorizontalRulePlugin.withComponent(HrEl),
      BaseListPlugin,
      BaseIndentPlugin,
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
            boundaries: ["[data-slot=\"task-notion-block-content\"]"],
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
      },
    },
  }, []);

  // Autosave: debounced, skip blob URLs
  const [saveError, setSaveError] = React.useState<string | null>(null);

  // URL Paste Chooser
  const [urlPastePopover, setUrlPastePopover] = React.useState<{ url: string; blockPath: number[] } | null>(null);
  const handleUrlPasteChoice = React.useCallback((choice: 'link' | 'bookmark', info: { url: string; blockPath: number[] }) => {
    if (editor.api.isReadOnly()) return;
    const meta = resolveUrlMetadata(info.url);
    const nodeId = `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newNode: PlateElemT = {
      id: nodeId,
      type: choice === 'link' ? PT.link : PT.bookmark,
      children: [{ text: meta.url }],
      url: meta.url,
      description: meta.description,
    } as PlateElemT;
    editor.tf.insertNodes([newNode] as any, { at: [info.blockPath[0] + 1] });
    setUrlPastePopover(null);
  }, [editor]);

  const triggerAutoSave = React.useCallback(
    (plateValue: PlateValue) => {
      const qcetBlocks = plateToQcet(plateValue);
      if (qcetBlocks.some((b) => b.url?.startsWith("blob:"))) return;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(async () => {
        try {
          const payload = serializeBlocksToContent(qcetBlocks);
          lastSavedContentRef.current = payload;
          await onSaveContent(payload);
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

  // Cleanup debounce
  React.useEffect(() => { return () => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); }; }, []);

  // Global file drop listeners
  React.useEffect(() => {
    if (!globalFileDrop || !canEdit) return;
    const handleDragEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) {
        dragCounterRef.current++;
        setIsGlobalDragging(true);
      }
    };
    const handleDragLeave = () => {
      dragCounterRef.current--;
      if (dragCounterRef.current <= 0) resetGlobalDrag();
    };
    const handleDrop = (e: DragEvent) => {
      resetGlobalDrag();
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        e.preventDefault();
        handleProcessDroppedFiles(files);
      }
    };
    const handleDragOver = (e: DragEvent) => { e.preventDefault(); };
    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);
    window.addEventListener("dragover", handleDragOver);
    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
      window.removeEventListener("dragover", handleDragOver);
    };
  }, [globalFileDrop]);

  // Process dropped files
  const handleProcessDroppedFiles = React.useCallback((files: FileList | File[]) => {
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
              const idx = nodes.findIndex((n) => n.id === nodeId);
              if (idx >= 0) {
                editor.tf.setNodes({ url: dataUrl } as any, { at: [idx] });
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
              const idx = nodes.findIndex((n) => n.id === nodeId);
              if (idx >= 0) {
                editor.tf.setNodes({ url: dataUrl } as any, { at: [idx] });
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

    // 3-tier insertion: focused block → nearest block → end of document
    const sel = editor.selection;
    let insertAt: number[];
    if (sel) {
      insertAt = [sel.anchor.path[0] + 1];
    } else {
      insertAt = [editor.children.length];
    }
    editor.tf.insertNodes(newNodes as any, { at: insertAt });
  }, [editor]);

  // Slash menu handlers
  const handleOpenSlashMenu = React.useCallback((anchorEl?: HTMLElement | null) => {
    if (!canEdit) return;
    setMenuSearchQuery("");
    if (anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      const GAP = 6;
      const spaceBelow = window.innerHeight - rect.bottom - GAP - 16;
      const spaceAbove = rect.top - GAP - 14;
      const shouldFlip = spaceBelow < 250 && spaceAbove > spaceBelow;
      const placement = shouldFlip ? "top" : "bottom";
      const available = Math.max(160, Math.min(320, shouldFlip ? spaceAbove : spaceBelow));
      let left = rect.left;
      const maxLeft = window.innerWidth - 288 - 14;
      if (left > maxLeft) left = maxLeft;
      if (left < 14) left = 14;
      setMenuPlacement(placement);
      setMenuMaxHeight(available);
      setMenuPosition({
        top: placement === "bottom" ? rect.bottom + GAP : undefined,
        bottom: placement === "top" ? window.innerHeight - rect.top + GAP : undefined,
        left,
      });
    } else {
      setMenuPosition(null);
    }
    setIsMenuOpen(true);
  }, []);

  const handleCloseSlashMenu = React.useCallback(() => {
    setIsMenuOpen(false);
    setMenuSearchQuery("");
    setMenuPosition(null);
  }, []);

  const handleSelectMenuItem = React.useCallback((option: MenuItemOption) => {
    handleCloseSlashMenu();
    if (editor.api.isReadOnly()) return;

    const newBlockId = `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    let newNode: PlateElemT;

    // Convert QCET menu option to Plate node
    const qcetBlock: NotionBlockItem = {
      id: newBlockId,
      type: option.type,
      content: "",
      checked: option.type === "checklist" ? false : undefined,
      level: option.level || (option.type === "heading" ? 2 : undefined),
      url: (option.type === "link" || option.type === "bookmark" || option.type === "image") ? "" : undefined,
      fileName: option.type === "attachment" ? "" : undefined,
      imageWidth: option.type === "image" ? 100 : undefined,
    };

    const plateNodes = qcetToPlate([qcetBlock]);
    newNode = plateNodes[0];

    // Insert at current selection or end
    const sel = editor.selection;
    if (sel) {
      const path = sel.anchor.path;
      const blockPath = [path[0]];
      const currentNode = editor.children[blockPath[0]] as PlateElemT;
      const currentText = currentNode?.children?.map((c: any) => c.text || "").join("") || "";

      if (!currentText.trim()) {
        // Replace empty block
        editor.tf.removeNodes({ at: blockPath });
        editor.tf.insertNodes([newNode] as any, { at: blockPath });
      } else {
        // Insert after current block
        editor.tf.insertNodes([newNode] as any, { at: [blockPath[0] + 1] });
      }
    } else {
      editor.tf.insertNodes([newNode] as any, { at: [editor.children.length] });
    }

    // Focus the new block
    setTimeout(() => {
      const nodes = editor.children as PlateElemT[];
      const idx = nodes.findIndex((n) => n.id === newBlockId);
      if (idx >= 0) {
        editor.tf.select({ anchor: { path: [idx, 0], offset: 0 }, focus: { path: [idx, 0], offset: 0 } });
      }
    }, 50);
  }, [editor, handleCloseSlashMenu]);

  // Handle "/" key to open slash menu
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing || (e as any).keyCode === 229) return;

    if (e.key === "/") {
      const sel = editor.selection;
      if (sel) {
        const path = sel.anchor.path;
        const blockPath = [path[0]];
        const currentNode = editor.children[blockPath[0]] as PlateElemT;
        const currentText = currentNode?.children?.map((c: any) => c.text || "").join("") || "";
        if (!currentText.trim()) {
          e.preventDefault();
          const el = containerRef.current?.querySelector(`[data-block-id="${currentNode.id}"]`) as HTMLElement;
          handleOpenSlashMenu(el);
        }
      }
    }
  }, [editor, handleOpenSlashMenu]);

  // Handle paste for images and URLs
  const handlePaste = React.useCallback((e: React.ClipboardEvent) => {
    if (!canEdit) return;
    // URL paste detection
    const plainText = e.clipboardData?.getData("text/plain")?.trim();
    if (plainText && /^https?:\/\//i.test(plainText) && !e.clipboardData?.types.includes("Files")) {
      const sel = editor.selection;
      if (sel) {
        e.preventDefault();
        setUrlPastePopover({ url: plainText, blockPath: [sel.anchor.path[0]] });
        return;
      }
    }
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            handleProcessDroppedFiles([file]);
            return;
          }
        }
      }
    }
  }, [canEdit, handleProcessDroppedFiles]);

  return (
    <DndProvider backend={HTML5Backend}>
      <div
        ref={containerRef}
        data-slot="task-notion-block-content"
        onPaste={handlePaste}
        className={cn("w-full relative font-sans text-sm text-foreground flex flex-col pl-6", className)}
      >
        <Plate
          editor={editor}
          onChange={({ value }) => { triggerAutoSave(value as any); }}
        >
          <PlateContent
            readOnly={!canEdit}
            renderElement={renderElement}
            onKeyDown={handleKeyDown}
            placeholder="Nhập nội dung hoặc gõ / để chèn"
            className="outline-hidden min-h-[2em] [&_[data-slate-placeholder]]:text-muted-foreground/35 [&_[data-slate-placeholder]]:!opacity-100"
            style={{ minHeight: "2em" }}
          />
        <BlockSelectionAfterEditable />
        </Plate>
        {saveError && (
          <div className="flex items-center gap-1.5 px-2 py-1 mt-1 text-xs text-rose-600 bg-rose-50 rounded-md border border-rose-200">
            <span>{saveError}</span>
            <button type="button" onClick={() => { setSaveError(null); triggerAutoSave(editor.children as any); }} className="ml-auto text-[10px] font-medium underline cursor-pointer">Thử lại</button>
          </div>
        )}

        {/* URL Paste Chooser */}
        {urlPastePopover && (
          <div className="flex items-center gap-2 px-3 py-2 mt-1 rounded-lg border border-border bg-card shadow-lg text-xs animate-in fade-in-0 zoom-in-95">
            <span className="truncate max-w-[200px] text-muted-foreground font-mono">{urlPastePopover.url}</span>
            <button type="button" onClick={() => handleUrlPasteChoice('link', urlPastePopover)} className="px-2 py-1 rounded-md bg-primary text-primary-foreground font-medium cursor-pointer hover:opacity-90">Liên kết</button>
            <button type="button" onClick={() => handleUrlPasteChoice('bookmark', urlPastePopover)} className="px-2 py-1 rounded-md bg-muted text-foreground font-medium cursor-pointer hover:bg-muted/80">Bookmark</button>
            <button type="button" onClick={() => setUrlPastePopover(null)} className="px-1.5 py-1 text-muted-foreground hover:text-foreground cursor-pointer">×</button>
          </div>
        )}

        {/* Slash Command Menu */}
        {mounted && (
          <SlashMenu
            isOpen={isMenuOpen}
            onClose={handleCloseSlashMenu}
            onSelect={handleSelectMenuItem}
            searchQuery={menuSearchQuery}
            setSearchQuery={setMenuSearchQuery}
            menuPosition={menuPosition}
            menuPlacement={menuPlacement}
            menuMaxHeight={menuMaxHeight}
            filteredOptions={filteredMenuOptions}
          />
        )}

        {/* Global File Drop Overlay */}
        {mounted && isGlobalDragging && typeof document !== "undefined" && createPortal(
          <div
            role="presentation"
            data-testid="global-file-drop-overlay"
            onClick={resetGlobalDrag}
            className="fixed inset-0 z-50 pointer-events-auto flex flex-col items-center justify-center bg-background/80 backdrop-blur-xs transition-all animate-in fade-in duration-150 p-6"
          >
            <div className="flex flex-col items-center gap-3.5 p-8 bg-card/95 shadow-2xl rounded-2xl border-2 border-dashed border-primary/60 max-w-sm text-center transform scale-100 transition-transform">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-xs animate-bounce">
                <UploadCloud className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-foreground tracking-tight">Thả để thêm vào nội dung</h3>
                <p className="text-xs text-muted-foreground">Ảnh, PDF, tài liệu và các tệp khác</p>
              </div>
            </div>
          </div>,
          document.body,
        )}
      </div>
    </DndProvider>
  );
}
