"use client";

import * as React from "react";
import {
  Plus,
  GripVertical,
  Type,
  Heading2,
  List,
  CheckSquare,
  Paperclip,
  Link2,
  Layers,
  Search,
  Trash2,
  ArrowUp,
  ArrowDown,
  Copy,
  ExternalLink,
  CheckCircle2,
  Circle,
  MoreHorizontal,
  X,
  Loader2,
  AlertCircle,
  Calendar,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StaffTask } from "@/types/dashboard";
import { formatDisplayDate } from "@/lib/format/date";
import { formatAssigneeNameWithTitle } from "@/lib/format/personnel";
import { STATUS_OPTIONS } from "./task-identity-block";

export type NotionBlockType =
  | "text"
  | "heading"
  | "bulleted_list"
  | "checklist"
  | "attachment"
  | "link"
  | "subtasks_view";

export interface NotionBlockItem {
  id: string;
  type: NotionBlockType;
  content: string;
  checked?: boolean;
  level?: 1 | 2 | 3;
  url?: string;
  fileName?: string;
  fileSize?: string;
}

export interface TaskNotionBlockContentProps {
  taskId: string;
  initialDescription?: string | null;
  subTasks?: StaffTask[];
  canEdit?: boolean;
  onSaveContent: (newContent: string) => Promise<void> | void;
  onSelectSubtask?: (subtask: StaffTask) => void;
  onOpenCreateSubtask?: () => void;
  className?: string;
}

/**
 * Phân tích chuỗi mô tả thành danh sách các block Notion.
 * Nếu đã lưu dạng JSON blocks thì parse ra, nếu là văn bản cũ thì đưa vào block text đầu tiên.
 */
export function parseContentToBlocks(raw?: string | null): NotionBlockItem[] {
  if (!raw || !raw.trim()) {
    return [{ id: `b-${Date.now()}-1`, type: "text", content: "" }];
  }

  try {
    if (raw.includes('"qcetBlocks":true')) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.blocks) && parsed.blocks.length > 0) {
        return parsed.blocks;
      }
    }
  } catch {
    // fallback plain text
  }

  // Giữ nguyên mô tả cũ
  return [{ id: `b-${Date.now()}-legacy`, type: "text", content: raw }];
}

/**
 * Đóng gói danh sách blocks thành chuỗi JSON lưu vào DB.
 */
export function serializeBlocksToContent(blocks: NotionBlockItem[]): string {
  // Nếu chỉ có đúng 1 block text không có metadata khác và rỗng, có thể lưu rỗng
  if (blocks.length === 1 && blocks[0].type === "text" && !blocks[0].content.trim()) {
    return "";
  }
  return JSON.stringify({
    qcetBlocks: true,
    version: 1,
    blocks,
  });
}

interface MenuItemOption {
  id: string;
  type: NotionBlockType | "create_subtask_action";
  group: "Nội dung" | "Tài liệu" | "Công việc";
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  badge?: string;
}

const MENU_OPTIONS: MenuItemOption[] = [
  // 1. Nhóm Nội dung
  {
    id: "opt-text",
    type: "text",
    group: "Nội dung",
    title: "Văn bản",
    description: "Văn bản thuần túy, tự do ghi chú",
    icon: Type,
    shortcut: "text",
  },
  {
    id: "opt-heading",
    type: "heading",
    group: "Nội dung",
    title: "Tiêu đề",
    description: "Tiêu đề phân mục nội dung rõ ràng",
    icon: Heading2,
    shortcut: "#",
  },
  {
    id: "opt-bulleted",
    type: "bulleted_list",
    group: "Nội dung",
    title: "Danh sách",
    description: "Danh sách dấu chấm đầu dòng",
    icon: List,
    shortcut: "-",
  },
  {
    id: "opt-checklist",
    type: "checklist",
    group: "Nội dung",
    title: "Checklist",
    description: "Nội dung đánh dấu hoàn thành (To-do)",
    icon: CheckSquare,
    shortcut: "[]",
  },

  // 2. Nhóm Tài liệu
  {
    id: "opt-attachment",
    type: "attachment",
    group: "Tài liệu",
    title: "Tệp đính kèm",
    description: "Đính kèm tệp tài liệu, minh chứng",
    icon: Paperclip,
  },
  {
    id: "opt-link",
    type: "link",
    group: "Tài liệu",
    title: "Liên kết",
    description: "Đường dẫn website hoặc tài liệu ngoài",
    icon: Link2,
  },

  // 3. Nhóm Công việc
  {
    id: "opt-create-subtask",
    type: "create_subtask_action",
    group: "Công việc",
    title: "Tạo việc con",
    description: "Giao nhiệm vụ thành phần có người và hạn",
    icon: Plus,
    badge: "Nhiệm vụ",
  },
  {
    id: "opt-subtasks-view",
    type: "subtasks_view",
    group: "Công việc",
    title: "Chèn danh sách việc con",
    description: "Hiển thị đồng bộ dữ liệu việc con hiện có",
    icon: Layers,
    badge: "Đồng bộ",
  },
];

export function TaskNotionBlockContent({
  taskId,
  initialDescription,
  subTasks = [],
  canEdit = true,
  onSaveContent,
  onSelectSubtask,
  onOpenCreateSubtask,
  className,
}: TaskNotionBlockContentProps) {
  const [blocks, setBlocks] = React.useState<NotionBlockItem[]>(() =>
    parseContentToBlocks(initialDescription)
  );
  const [saveStatus, setSaveStatus] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = React.useState<string | null>(null);

  // Slash Menu & Quick Add State
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [menuSearchQuery, setMenuSearchQuery] = React.useState("");
  const [menuInsertIndex, setMenuInsertIndex] = React.useState<number | null>(null);
  const [activeMenuIndex, setActiveMenuIndex] = React.useState(0);

  // Block Action Popover State (nhấn ⋮⋮)
  const [activeBlockMenuId, setActiveBlockMenuId] = React.useState<string | null>(null);

  // Drag and drop state
  const [draggedBlockIndex, setDraggedBlockIndex] = React.useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);

  // Ref tracking
  const menuInputRef = React.useRef<HTMLInputElement>(null);
  const blockInputRefs = React.useRef<Map<string, HTMLInputElement | HTMLTextAreaElement>>(new Map());
  const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const pendingFocusBlockIdRef = React.useRef<string | null>(null);

  // Đồng bộ khi initialDescription từ server đổi
  React.useEffect(() => {
    setBlocks(parseContentToBlocks(initialDescription));
  }, [initialDescription]);

  // Tự động focus vào block mới sau khi chèn
  React.useEffect(() => {
    if (pendingFocusBlockIdRef.current) {
      const el = blockInputRefs.current.get(pendingFocusBlockIdRef.current);
      if (el) {
        el.focus();
        if ("select" in el && el instanceof HTMLInputElement) {
          el.select();
        }
      }
      pendingFocusBlockIdRef.current = null;
    }
  }, [blocks]);

  // Lọc menu theo ô tìm kiếm
  const filteredMenuOptions = React.useMemo(() => {
    const q = menuSearchQuery.trim().toLowerCase();
    if (!q) return MENU_OPTIONS;
    return MENU_OPTIONS.filter((opt) => {
      const matchTitle = opt.title.toLowerCase().includes(q);
      const matchDesc = opt.description.toLowerCase().includes(q);
      const matchGroup = opt.group.toLowerCase().includes(q);
      const matchShortcut = opt.shortcut?.toLowerCase().includes(q);
      return matchTitle || matchDesc || matchGroup || matchShortcut;
    });
  }, [menuSearchQuery]);

  // Debounced Autosave
  const triggerAutoSave = React.useCallback(
    (newBlocks: NotionBlockItem[]) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      setSaveStatus("saving");
      setSaveError(null);

      debounceTimerRef.current = setTimeout(async () => {
        try {
          const payload = serializeBlocksToContent(newBlocks);
          await onSaveContent(payload);
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2000);
        } catch (err: any) {
          setSaveStatus("error");
          setSaveError(err?.message || "Lỗi tự động lưu nội dung");
        }
      }, 800);
    },
    [onSaveContent]
  );

  // Cleanup timer
  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Mở Slash Menu
  const handleOpenMenu = (insertIndex: number | null = null, defaultQuery = "") => {
    setMenuInsertIndex(insertIndex);
    setMenuSearchQuery(defaultQuery);
    setActiveMenuIndex(0);
    setIsMenuOpen(true);
    setTimeout(() => {
      menuInputRef.current?.focus();
    }, 50);
  };

  const handleCloseMenu = () => {
    setIsMenuOpen(false);
    setMenuSearchQuery("");
    setMenuInsertIndex(null);
  };

  // Thêm Block mới từ Menu
  const handleSelectMenuItem = (option: MenuItemOption) => {
    handleCloseMenu();

    // Nếu chọn "Tạo việc con" -> gọi modal tạo việc con thật
    if (option.type === "create_subtask_action") {
      if (onOpenCreateSubtask) {
        onOpenCreateSubtask();
      }
      return;
    }

    const newBlockId = `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newBlock: NotionBlockItem = {
      id: newBlockId,
      type: option.type as NotionBlockType,
      content: "",
      checked: option.type === "checklist" ? false : undefined,
      level: option.type === "heading" ? 2 : undefined,
      url: option.type === "link" ? "https://" : undefined,
      fileName: option.type === "attachment" ? "Tài liệu đính kèm" : undefined,
    };

    setBlocks((prev) => {
      const next = [...prev];
      if (menuInsertIndex !== null && menuInsertIndex >= 0 && menuInsertIndex <= next.length) {
        next.splice(menuInsertIndex, 0, newBlock);
      } else {
        next.push(newBlock);
      }
      triggerAutoSave(next);
      return next;
    });

    pendingFocusBlockIdRef.current = newBlockId;
  };

  // Cập nhật nội dung một block
  const handleUpdateBlock = (blockId: string, updates: Partial<NotionBlockItem>) => {
    setBlocks((prev) => {
      const next = prev.map((b) => (b.id === blockId ? { ...b, ...updates } : b));
      triggerAutoSave(next);
      return next;
    });
  };

  // Xóa một block
  const handleDeleteBlock = (blockId: string) => {
    setBlocks((prev) => {
      const next = prev.filter((b) => b.id !== blockId);
      // Giữ tối thiểu 1 block
      if (next.length === 0) {
        next.push({ id: `b-${Date.now()}`, type: "text", content: "" });
      }
      triggerAutoSave(next);
      return next;
    });
    setActiveBlockMenuId(null);
  };

  // Di chuyển block lên/xuống
  const handleMoveBlock = (index: number, direction: "up" | "down") => {
    setBlocks((prev) => {
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      triggerAutoSave(next);
      return next;
    });
    setActiveBlockMenuId(null);
  };

  // Nhân đôi block
  const handleDuplicateBlock = (block: NotionBlockItem, index: number) => {
    const cloneId = `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const cloned: NotionBlockItem = {
      ...block,
      id: cloneId,
    };
    setBlocks((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, cloned);
      triggerAutoSave(next);
      return next;
    });
    setActiveBlockMenuId(null);
  };

  // Xử lý phím Enter / Slash trong block
  const handleBlockKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    block: NotionBlockItem,
    index: number
  ) => {
    // 1. Phím "/" mở Slash Menu khi ô trống hoặc vừa gõ /
    if (e.key === "/" && (!block.content || block.content.trim() === "")) {
      e.preventDefault();
      handleOpenMenu(index + 1);
      return;
    }

    // 2. Phím Enter trong Checklist -> tự động tạo checklist item tiếp theo bên dưới
    if (e.key === "Enter" && !e.shiftKey) {
      if (block.type === "checklist" || block.type === "bulleted_list") {
        e.preventDefault();
        const nextId = `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const nextBlock: NotionBlockItem = {
          id: nextId,
          type: block.type,
          content: "",
          checked: block.type === "checklist" ? false : undefined,
        };
        setBlocks((prev) => {
          const next = [...prev];
          next.splice(index + 1, 0, nextBlock);
          triggerAutoSave(next);
          return next;
        });
        pendingFocusBlockIdRef.current = nextId;
        return;
      }
    }

    // 3. Phím Backspace khi ô trống -> xóa block nếu có nhiều hơn 1 block
    if (e.key === "Backspace" && !block.content) {
      if (blocks.length > 1) {
        e.preventDefault();
        const prevBlock = blocks[index - 1];
        if (prevBlock) {
          pendingFocusBlockIdRef.current = prevBlock.id;
        }
        handleDeleteBlock(block.id);
      }
    }
  };

  // Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedBlockIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedBlockIndex === null || draggedBlockIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    if (draggedBlockIndex !== null && dragOverIndex !== null && draggedBlockIndex !== dragOverIndex) {
      setBlocks((prev) => {
        const next = [...prev];
        const [moved] = next.splice(draggedBlockIndex, 1);
        next.splice(dragOverIndex, 0, moved);
        triggerAutoSave(next);
        return next;
      });
    }
    setDraggedBlockIndex(null);
    setDragOverIndex(null);
  };

  return (
    <section
      data-slot="task-notion-block-content"
      className={cn("space-y-3 relative group/container", className)}
      aria-label="Vùng nội dung chi tiết dạng block"
    >
      {/* Header nhỏ & Trạng thái lưu */}
      <div className="flex items-center justify-between gap-2 text-xs select-none">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground tracking-tight">
            Nội dung chi tiết
          </span>
          {saveStatus === "saving" && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-medium animate-pulse">
              <Loader2 className="size-3 animate-spin" />
              <span>Đang lưu...</span>
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
              <span>Đã lưu</span>
            </span>
          )}
          {saveStatus === "error" && (
            <span className="inline-flex items-center gap-1 text-[11px] text-rose-600 font-medium">
              <AlertCircle className="size-3" />
              <span>{saveError || "Lưu thất bại"}</span>
            </span>
          )}
        </div>
      </div>

      {/* Danh sách các Block */}
      <div className="space-y-2">
        {blocks.map((block, index) => {
          const isDragOver = dragOverIndex === index;

          return (
            <div
              key={block.id}
              onDragOver={(e) => handleDragOver(e, index)}
              className={cn(
                "group/block relative flex items-start gap-1 rounded-xl transition-all duration-150 p-1 -mx-1",
                isDragOver && "bg-primary/10 ring-1 ring-primary/40 rounded-xl",
                "hover:bg-muted/30"
              )}
            >
              {/* Tay nắm kéo thả & Nút thêm nhanh bên trái (Notion style) */}
              {canEdit && (
                <div
                  className={cn(
                    "flex items-center gap-0.5 pt-1.5 shrink-0 transition-opacity duration-150 select-none",
                    "opacity-0 group-hover/block:opacity-100 focus-within:opacity-100"
                  )}
                >
                  {/* Nút + (Thêm block ngay dưới) */}
                  <button
                    type="button"
                    onClick={() => handleOpenMenu(index + 1)}
                    className="size-5 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors"
                    title="Thêm block bên dưới"
                    aria-label="Thêm block bên dưới"
                  >
                    <Plus className="size-3.5" />
                  </button>

                  {/* Tay nắm kéo thả ⋮⋮ */}
                  <div className="relative">
                    <button
                      type="button"
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragEnd={handleDragEnd}
                      onClick={() =>
                        setActiveBlockMenuId((prev) => (prev === block.id ? null : block.id))
                      }
                      className="size-5 rounded hover:bg-muted/80 text-muted-foreground/70 hover:text-foreground flex items-center justify-center cursor-grab active:cursor-grabbing transition-colors"
                      title="Kéo để di chuyển hoặc nhấn để mở thao tác"
                      aria-label="Thao tác block"
                    >
                      <GripVertical className="size-3.5" />
                    </button>

                    {/* Menu thao tác block khi click ⋮⋮ */}
                    {activeBlockMenuId === block.id && (
                      <div
                        role="menu"
                        className="absolute left-0 top-full mt-1 w-44 rounded-xl border border-border bg-white p-1 text-foreground shadow-xl z-30 animate-in fade-in-0 zoom-in-95 duration-100 text-xs"
                      >
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => handleMoveBlock(index, "up")}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left hover:bg-muted disabled:opacity-40 cursor-pointer"
                        >
                          <ArrowUp className="size-3.5 text-muted-foreground" />
                          <span>Di chuyển lên</span>
                        </button>
                        <button
                          type="button"
                          disabled={index === blocks.length - 1}
                          onClick={() => handleMoveBlock(index, "down")}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left hover:bg-muted disabled:opacity-40 cursor-pointer"
                        >
                          <ArrowDown className="size-3.5 text-muted-foreground" />
                          <span>Di chuyển xuống</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicateBlock(block, index)}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left hover:bg-muted cursor-pointer"
                        >
                          <Copy className="size-3.5 text-muted-foreground" />
                          <span>Nhân đôi block</span>
                        </button>
                        <div className="my-1 border-t border-border/40" />
                        <button
                          type="button"
                          onClick={() => handleDeleteBlock(block.id)}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-rose-600 hover:bg-rose-50 cursor-pointer font-medium"
                        >
                          <Trash2 className="size-3.5" />
                          <span>Xóa block</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Thân Block theo từng loại */}
              <div className="flex-1 min-w-0">
                {/* 1. Block: Text (Văn bản) */}
                {block.type === "text" && (
                  <textarea
                    ref={(el) => {
                      if (el) blockInputRefs.current.set(block.id, el);
                      else blockInputRefs.current.delete(block.id);
                    }}
                    rows={Math.max(1, block.content.split("\n").length)}
                    disabled={!canEdit}
                    value={block.content}
                    onChange={(e) => handleUpdateBlock(block.id, { content: e.target.value })}
                    onKeyDown={(e) => handleBlockKeyDown(e, block, index)}
                    placeholder="Gõ văn bản hoặc '/' để chọn lệnh..."
                    className="w-full resize-none bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/40 focus:outline-hidden py-1"
                  />
                )}

                {/* 2. Block: Heading (Tiêu đề) */}
                {block.type === "heading" && (
                  <input
                    ref={(el) => {
                      if (el) blockInputRefs.current.set(block.id, el);
                      else blockInputRefs.current.delete(block.id);
                    }}
                    type="text"
                    disabled={!canEdit}
                    value={block.content}
                    onChange={(e) => handleUpdateBlock(block.id, { content: e.target.value })}
                    onKeyDown={(e) => handleBlockKeyDown(e, block, index)}
                    placeholder="Tiêu đề mục..."
                    className="w-full bg-transparent text-base sm:text-lg font-bold tracking-tight text-foreground placeholder:text-muted-foreground/40 focus:outline-hidden py-1 border-b border-border/30"
                  />
                )}

                {/* 3. Block: Bulleted List (Danh sách chấm) */}
                {block.type === "bulleted_list" && (
                  <div className="flex items-start gap-2 py-1">
                    <span className="size-1.5 rounded-full bg-foreground/70 shrink-0 mt-2" />
                    <input
                      ref={(el) => {
                        if (el) blockInputRefs.current.set(block.id, el);
                        else blockInputRefs.current.delete(block.id);
                      }}
                      type="text"
                      disabled={!canEdit}
                      value={block.content}
                      onChange={(e) => handleUpdateBlock(block.id, { content: e.target.value })}
                      onKeyDown={(e) => handleBlockKeyDown(e, block, index)}
                      placeholder="Nội dung danh sách..."
                      className="w-full bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/40 focus:outline-hidden"
                    />
                  </div>
                )}

                {/* 4. Block: Checklist (To-do list tương tác) */}
                {block.type === "checklist" && (
                  <div className="flex items-start gap-2.5 py-1">
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => handleUpdateBlock(block.id, { checked: !block.checked })}
                      className="mt-0.5 text-muted-foreground hover:text-primary transition-colors cursor-pointer shrink-0"
                      aria-label={block.checked ? "Đánh dấu chưa xong" : "Đánh dấu hoàn thành"}
                    >
                      {block.checked ? (
                        <CheckCircle2 className="size-4 text-emerald-600 fill-emerald-100" />
                      ) : (
                        <Circle className="size-4 text-muted-foreground/70 hover:text-foreground" />
                      )}
                    </button>
                    <input
                      ref={(el) => {
                        if (el) blockInputRefs.current.set(block.id, el);
                        else blockInputRefs.current.delete(block.id);
                      }}
                      type="text"
                      disabled={!canEdit}
                      value={block.content}
                      onChange={(e) => handleUpdateBlock(block.id, { content: e.target.value })}
                      onKeyDown={(e) => handleBlockKeyDown(e, block, index)}
                      placeholder="Mục cần làm..."
                      className={cn(
                        "w-full bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/40 focus:outline-hidden",
                        block.checked && "line-through text-muted-foreground"
                      )}
                    />
                  </div>
                )}

                {/* 5. Block: Attachment (Tệp đính kèm) */}
                {block.type === "attachment" && (
                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border/70 bg-card/60 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Paperclip className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <input
                          type="text"
                          disabled={!canEdit}
                          value={block.fileName || block.content}
                          onChange={(e) =>
                            handleUpdateBlock(block.id, {
                              fileName: e.target.value,
                              content: e.target.value,
                            })
                          }
                          placeholder="Tên tài liệu đính kèm..."
                          className="w-full bg-transparent font-medium text-foreground focus:outline-hidden"
                        />
                        <input
                          type="text"
                          disabled={!canEdit}
                          value={block.url || ""}
                          onChange={(e) => handleUpdateBlock(block.id, { url: e.target.value })}
                          placeholder="URL liên kết tải xuống (https://...)"
                          className="w-full bg-transparent text-[11px] text-muted-foreground focus:outline-hidden font-mono"
                        />
                      </div>
                    </div>
                    {block.url && (
                      <a
                        href={block.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border hover:bg-muted text-foreground transition-colors shrink-0"
                      >
                        <ExternalLink className="size-3" />
                        <span>Mở</span>
                      </a>
                    )}
                  </div>
                )}

                {/* 6. Block: Link (Liên kết) */}
                {block.type === "link" && (
                  <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-border/70 bg-card/40 text-xs">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Link2 className="size-4 text-primary shrink-0" />
                      <div className="min-w-0 flex-1">
                        <input
                          type="text"
                          disabled={!canEdit}
                          value={block.content}
                          onChange={(e) => handleUpdateBlock(block.id, { content: e.target.value })}
                          placeholder="Tiêu đề liên kết..."
                          className="w-full bg-transparent font-medium text-foreground focus:outline-hidden"
                        />
                        <input
                          type="text"
                          disabled={!canEdit}
                          value={block.url || ""}
                          onChange={(e) => handleUpdateBlock(block.id, { url: e.target.value })}
                          placeholder="https://..."
                          className="w-full bg-transparent text-[11px] text-muted-foreground focus:outline-hidden font-mono"
                        />
                      </div>
                    </div>
                    {block.url && (
                      <a
                        href={block.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-muted-foreground hover:text-foreground shrink-0"
                        title="Mở liên kết"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    )}
                  </div>
                )}

                {/* 7. Block: Subtasks View (Chèn danh sách việc con nhúng đồng bộ) */}
                {block.type === "subtasks_view" && (
                  <div className="rounded-xl border border-border/70 bg-card/40 p-3 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Layers className="size-4 text-primary" />
                        <span className="font-semibold text-foreground">
                          Việc thành phần (Dữ liệu đồng bộ)
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground bg-muted px-2 py-0.2 rounded-full tabular-nums">
                          {subTasks.filter((s) => s.status === "COMPLETED").length}/{subTasks.length}
                        </span>
                      </div>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => handleDeleteBlock(block.id)}
                          className="p-1 text-muted-foreground hover:text-rose-600 rounded cursor-pointer"
                          title="Gỡ bỏ khối hiển thị này"
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
                    </div>

                    {subTasks.length > 0 ? (
                      <div className="divide-y divide-border/40 rounded-lg border border-border/50 bg-background overflow-hidden text-xs">
                        {subTasks.map((st) => {
                          const isDone = st.status === "COMPLETED";
                          const assigneeTitle = formatAssigneeNameWithTitle(st.assigneeName);
                          const stStatus = STATUS_OPTIONS.find((s) => s.value === st.status) || STATUS_OPTIONS[0];

                          return (
                            <div
                              key={st.id}
                              onClick={() => onSelectSubtask?.(st)}
                              className="flex items-center justify-between p-2.5 hover:bg-muted/30 transition-colors cursor-pointer gap-2"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                {isDone ? (
                                  <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                                ) : (
                                  <Circle className="size-3.5 text-muted-foreground/60 shrink-0" />
                                )}
                                <span className={cn("truncate font-medium text-foreground", isDone && "line-through text-muted-foreground")}>
                                  {st.title}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 text-[11px] text-muted-foreground">
                                <span className="truncate max-w-[120px]">{assigneeTitle}</span>
                                {st.dueDate && (
                                  <span className="font-mono tabular-nums">{formatDisplayDate(st.dueDate)}</span>
                                )}
                                <span className={cn("px-1.5 py-0.2 rounded text-[10px] font-medium border", stStatus.colorClass)}>
                                  {stStatus.label}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-xs text-muted-foreground border border-dashed border-border/60 rounded-lg">
                        Chưa có việc thành phần nào.{" "}
                        {canEdit && onOpenCreateSubtask && (
                          <button
                            type="button"
                            onClick={onOpenCreateSubtask}
                            className="text-primary font-medium hover:underline cursor-pointer ml-1"
                          >
                            + Tạo việc con
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Dòng nhẹ Notion ở cuối vùng nội dung: "+ Thêm nội dung — hoặc gõ / để chọn" */}
      {canEdit && (
        <div className="pt-2 flex items-center gap-2 text-xs select-none">
          <button
            type="button"
            onClick={() => handleOpenMenu(blocks.length)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/70 bg-background hover:bg-muted/60 text-foreground font-medium transition-colors cursor-pointer text-xs"
          >
            <Plus className="size-3.5" />
            <span>Thêm nội dung</span>
          </button>
          <span className="text-muted-foreground/60 text-xs italic">
            — hoặc gõ <kbd className="px-1.5 py-0.5 rounded bg-muted text-[11px] font-mono not-italic text-foreground border border-border/60">/</kbd> để chọn
          </span>
        </div>
      )}

      {/* Slash Command & Quick Add Popover Menu có tìm kiếm */}
      {isMenuOpen && (
        <div
          role="dialog"
          aria-label="Menu thêm khối nội dung"
          className="fixed inset-0 z-50 flex items-center justify-center sm:items-start sm:justify-start bg-black/20 sm:bg-transparent backdrop-blur-2xs sm:backdrop-blur-none p-4 sm:p-0"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseMenu();
          }}
        >
          <div
            className="w-full max-w-sm sm:w-80 rounded-2xl border border-border bg-white p-2 text-foreground shadow-2xl z-50 animate-in fade-in-0 zoom-in-95 duration-150 sm:mt-12 sm:ml-20"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ô tìm kiếm lệnh */}
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <input
                ref={menuInputRef}
                type="text"
                value={menuSearchQuery}
                onChange={(e) => {
                  setMenuSearchQuery(e.target.value);
                  setActiveMenuIndex(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    handleCloseMenu();
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActiveMenuIndex((prev) =>
                      prev < filteredMenuOptions.length - 1 ? prev + 1 : 0
                    );
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveMenuIndex((prev) =>
                      prev > 0 ? prev - 1 : filteredMenuOptions.length - 1
                    );
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    const opt = filteredMenuOptions[activeMenuIndex];
                    if (opt) handleSelectMenuItem(opt);
                  }
                }}
                placeholder="Tìm nội dung hoặc lệnh..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-muted/40 rounded-xl border border-border/60 focus:outline-hidden focus:ring-2 focus:ring-primary/40 font-medium"
              />
            </div>

            {/* Danh sách lựa chọn nhóm */}
            <div className="max-h-72 overflow-y-auto space-y-2 p-0.5">
              {["Nội dung", "Tài liệu", "Công việc"].map((groupName) => {
                const groupItems = filteredMenuOptions.filter((o) => o.group === groupName);
                if (groupItems.length === 0) return null;

                return (
                  <div key={groupName} className="space-y-1">
                    <div className="text-[11px] font-semibold text-muted-foreground/80 px-2 pt-1 select-none">
                      {groupName}
                    </div>
                    {groupItems.map((opt) => {
                      const itemGlobalIndex = filteredMenuOptions.indexOf(opt);
                      const isSelected = activeMenuIndex === itemGlobalIndex;
                      const IconComp = opt.icon;

                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleSelectMenuItem(opt)}
                          onMouseEnter={() => setActiveMenuIndex(itemGlobalIndex)}
                          className={cn(
                            "w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition-colors cursor-pointer",
                            isSelected
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-foreground hover:bg-muted/60"
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="size-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              <IconComp className="size-3.5" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-medium truncate">{opt.title}</div>
                              <div className="text-[11px] text-muted-foreground truncate leading-tight">
                                {opt.description}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            {opt.badge && (
                              <span className="px-1.5 py-0.2 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
                                {opt.badge}
                              </span>
                            )}
                            {opt.shortcut && (
                              <span className="font-mono text-[10px] text-muted-foreground/60">
                                {opt.shortcut}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}

              {filteredMenuOptions.length === 0 && (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  Không tìm thấy lựa chọn phù hợp.
                </div>
              )}
            </div>

            {/* Footer đóng menu */}
            <div className="pt-2 mt-1 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground px-2 select-none">
              <span>Đóng menu</span>
              <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">Esc</kbd>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
