"use client";

import * as React from "react";
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
  Layers,
  Search,
  Trash2,
  ArrowUp,
  ArrowDown,
  Copy,
  ExternalLink,
  CheckCircle2,
  Circle,
  X,
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
  | "numbered_list"
  | "checklist"
  | "quote"
  | "callout"
  | "divider"
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
 * Helper tự động co giãn chiều cao textarea theo đúng scrollHeight,
 * loại bỏ hoàn toàn scrollbar riêng trong textarea.
 */
function autoResizeTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
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
  // Loại bỏ các trailing text block hoàn toàn rỗng ở cuối khi lưu (nếu có nhiều hơn 1 block)
  const cleaned = [...blocks];
  while (
    cleaned.length > 1 &&
    cleaned[cleaned.length - 1].type === "text" &&
    !cleaned[cleaned.length - 1].content.trim()
  ) {
    cleaned.pop();
  }

  // Nếu chỉ có đúng 1 block text và rỗng
  if (cleaned.length === 1 && cleaned[0].type === "text" && !cleaned[0].content.trim()) {
    return "";
  }
  return JSON.stringify({
    qcetBlocks: true,
    version: 1,
    blocks: cleaned,
  });
}

interface MenuItemOption {
  id: string;
  type: NotionBlockType | "create_subtask_action";
  group: "Soạn thảo" | "Danh sách" | "Tiêu đề" | "Trích dẫn & Ghi chú" | "Tệp & Liên kết" | "Phân cách";
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  level?: 1 | 2 | 3;
  badge?: string;
}

const MENU_OPTIONS: MenuItemOption[] = [
  // 1. Soạn thảo văn bản cơ bản
  {
    id: "opt-text",
    type: "text",
    group: "Soạn thảo",
    title: "Văn bản",
    description: "Văn bản thuần túy, tự do định dạng",
    icon: Type,
    shortcut: "text",
  },

  // 2. Danh sách (Ưu tiên E-Office)
  {
    id: "opt-bulleted",
    type: "bulleted_list",
    group: "Danh sách",
    title: "Danh sách dấu đầu dòng",
    description: "Danh sách dấu chấm đầu dòng",
    icon: List,
    shortcut: "-",
  },
  {
    id: "opt-numbered",
    type: "numbered_list",
    group: "Danh sách",
    title: "Danh sách đánh số",
    description: "Danh sách đánh số thứ tự",
    icon: ListOrdered,
    shortcut: "1.",
  },
  {
    id: "opt-checklist",
    type: "checklist",
    group: "Danh sách",
    title: "Checklist",
    description: "Danh sách việc cần làm có ô đánh dấu",
    icon: CheckSquare,
    shortcut: "[]",
  },

  // 3. Tiêu đề
  {
    id: "opt-h1",
    type: "heading",
    level: 1,
    group: "Tiêu đề",
    title: "Tiêu đề 1",
    description: "Tiêu đề lớn phân mục chính",
    icon: Heading1,
    shortcut: "#",
  },
  {
    id: "opt-h2",
    type: "heading",
    level: 2,
    group: "Tiêu đề",
    title: "Tiêu đề 2",
    description: "Tiêu đề vừa",
    icon: Heading2,
    shortcut: "##",
  },
  {
    id: "opt-h3",
    type: "heading",
    level: 3,
    group: "Tiêu đề",
    title: "Tiêu đề 3",
    description: "Tiêu đề nhỏ",
    icon: Heading3,
    shortcut: "###",
  },

  // 4. Trích dẫn & Ghi chú
  {
    id: "opt-quote",
    type: "quote",
    group: "Trích dẫn & Ghi chú",
    title: "Trích dẫn",
    description: "Trích dẫn ý kiến hoặc chỉ đạo",
    icon: Quote,
    shortcut: ">",
  },
  {
    id: "opt-callout",
    type: "callout",
    group: "Trích dẫn & Ghi chú",
    title: "Ghi chú nổi bật",
    description: "Hộp lưu ý hoặc thông điệp quan trọng",
    icon: Info,
  },

  // 5. Tệp / Liên kết
  {
    id: "opt-attachment",
    type: "attachment",
    group: "Tệp & Liên kết",
    title: "Tệp đính kèm",
    description: "Đính kèm tệp tài liệu, văn bản",
    icon: Paperclip,
  },
  {
    id: "opt-link",
    type: "link",
    group: "Tệp & Liên kết",
    title: "Liên kết",
    description: "Đường dẫn website hoặc tài liệu ngoài",
    icon: Link2,
  },
  {
    id: "opt-subtasks-view",
    type: "subtasks_view",
    group: "Tệp & Liên kết",
    title: "Chèn việc thành phần",
    description: "Hiển thị đồng bộ danh sách việc con",
    icon: Layers,
    badge: "Đồng bộ",
  },

  // 6. Đường phân cách
  {
    id: "opt-divider",
    type: "divider",
    group: "Phân cách",
    title: "Đường phân cách",
    description: "Đường kẻ chia tách phân đoạn",
    icon: Minus,
    shortcut: "---",
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

  // Slash Menu State
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [menuSearchQuery, setMenuSearchQuery] = React.useState("");
  const [menuTargetIndex, setMenuTargetIndex] = React.useState<number | null>(null);
  const [activeMenuIndex, setActiveMenuIndex] = React.useState(0);
  const [menuPosition, setMenuPosition] = React.useState<{ top: number; left: number } | null>(null);

  // Block Action Popover State (nhấn ⋮⋮)
  const [activeBlockMenuId, setActiveBlockMenuId] = React.useState<string | null>(null);

  // Drag and drop state
  const [draggedBlockIndex, setDraggedBlockIndex] = React.useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);

  // Trailing input state (controlled để quản lý hiển thị keycap hint)
  const [trailingValue, setTrailingValue] = React.useState("");

  // Ref tracking
  const menuInputRef = React.useRef<HTMLInputElement>(null);
  const blockInputRefs = React.useRef<Map<string, HTMLInputElement | HTMLTextAreaElement>>(new Map());
  const trailingInputRef = React.useRef<HTMLInputElement>(null);
  const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const pendingFocusBlockIdRef = React.useRef<string | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Đồng bộ khi initialDescription từ server đổi
  React.useEffect(() => {
    setBlocks(parseContentToBlocks(initialDescription));
  }, [initialDescription]);

  // Tự động resize toàn bộ textareas khi blocks thay đổi
  React.useEffect(() => {
    blockInputRefs.current.forEach((el) => {
      if (el instanceof HTMLTextAreaElement) {
        autoResizeTextarea(el);
      }
    });
  }, [blocks]);

  // Tự động focus vào block mới sau khi chèn
  React.useEffect(() => {
    if (pendingFocusBlockIdRef.current) {
      if (pendingFocusBlockIdRef.current === "trailing") {
        trailingInputRef.current?.focus();
      } else {
        const el = blockInputRefs.current.get(pendingFocusBlockIdRef.current);
        if (el) {
          el.focus();
          if (el instanceof HTMLTextAreaElement) {
            autoResizeTextarea(el);
          }
          if ("select" in el && el instanceof HTMLInputElement) {
            el.select();
          }
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
      debounceTimerRef.current = setTimeout(async () => {
        try {
          const payload = serializeBlocksToContent(newBlocks);
          await onSaveContent(payload);
        } catch {
          // silent autosave fallback
        }
      }, 800);
    },
    [onSaveContent]
  );

  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Mở Slash Menu
  const handleOpenSlashMenu = (index: number, anchorEl?: HTMLElement | null) => {
    setMenuTargetIndex(index);
    setMenuSearchQuery("");
    setActiveMenuIndex(0);

    if (anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + window.scrollY + 4,
        left: Math.max(16, rect.left + window.scrollX),
      });
    } else {
      setMenuPosition(null);
    }

    setIsMenuOpen(true);
    setTimeout(() => {
      menuInputRef.current?.focus();
    }, 40);
  };

  const handleCloseSlashMenu = () => {
    setIsMenuOpen(false);
    setMenuSearchQuery("");
    setMenuTargetIndex(null);
    setMenuPosition(null);
  };

  // Chọn loại Block từ Slash Menu
  const handleSelectMenuItem = (option: MenuItemOption) => {
    const targetIdx = menuTargetIndex ?? blocks.length;
    handleCloseSlashMenu();
    setTrailingValue("");

    if (option.type === "create_subtask_action") {
      onOpenCreateSubtask?.();
      return;
    }

    const newBlockId = `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newBlock: NotionBlockItem = {
      id: newBlockId,
      type: option.type as NotionBlockType,
      content: "",
      checked: option.type === "checklist" ? false : undefined,
      level: option.level || (option.type === "heading" ? 2 : undefined),
      url: option.type === "link" ? "https://" : undefined,
      fileName: option.type === "attachment" ? "Tài liệu đính kèm" : undefined,
    };

    setBlocks((prev) => {
      const next = [...prev];
      // Nếu target block hiện tại đang rỗng -> thay thế target block bằng block mới
      const currentBlock = next[targetIdx];
      if (currentBlock && !currentBlock.content.trim() && currentBlock.type === "text") {
        next[targetIdx] = newBlock;
      } else if (targetIdx >= next.length) {
        next.push(newBlock);
      } else {
        next.splice(targetIdx + 1, 0, newBlock);
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
      if (next.length === 0) {
        next.push({ id: `b-${Date.now()}`, type: "text", content: "" });
      }
      triggerAutoSave(next);
      return next;
    });
    setActiveBlockMenuId(null);
  };

  // Di chuyển block
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

  // Xử lý phím Enter / Backspace / Slash trong block
  const handleBlockKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    block: NotionBlockItem,
    index: number
  ) => {
    // 1. Phím "/" mở Slash Menu khi bắt đầu gõ hoặc ô trống
    if (e.key === "/" && (!block.content || block.content.trim() === "")) {
      e.preventDefault();
      const target = e.currentTarget as HTMLElement;
      handleOpenSlashMenu(index, target);
      return;
    }

    // 2. Phím Enter -> tạo block tiếp theo tự nhiên (Notion style)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const nextId = `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      // Nếu đang ở checklist / bullet / numbered list -> tiếp tục loại danh sách đó
      const isList = ["checklist", "bulleted_list", "numbered_list"].includes(block.type);
      const nextType = isList ? block.type : "text";

      const nextBlock: NotionBlockItem = {
        id: nextId,
        type: nextType,
        content: "",
        checked: nextType === "checklist" ? false : undefined,
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

    // 3. Phím Backspace khi ô rỗng
    if (e.key === "Backspace" && !block.content) {
      // Nếu là checklist / list / quote / callout / heading -> chuyển về text thường trước
      if (block.type !== "text") {
        e.preventDefault();
        handleUpdateBlock(block.id, { type: "text", level: undefined, checked: undefined });
        return;
      }

      // Nếu đã là text rỗng và có nhiều hơn 1 block -> xóa block và lùi focus về block trước
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

  // Trailing Empty Block KeyDown
  const handleTrailingKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "/") {
      e.preventDefault();
      handleOpenSlashMenu(blocks.length, e.currentTarget);
      setTrailingValue("");
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const val = trailingValue.trim();
      const newId = `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const nextId = `b-${Date.now() + 1}-${Math.random().toString(36).slice(2, 6)}`;

      setBlocks((prev) => {
        const next: NotionBlockItem[] = [...prev];
        if (val) {
          next.push({ id: newId, type: "text", content: val });
        }
        next.push({ id: nextId, type: "text", content: "" });
        triggerAutoSave(next);
        return next;
      });
      setTrailingValue("");
      pendingFocusBlockIdRef.current = nextId;
    }
  };

  const handleTrailingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "/") {
      handleOpenSlashMenu(blocks.length, e.target);
      setTrailingValue("");
      return;
    }
    setTrailingValue(val);
  };

  // Khi blur khỏi trailing input nếu có text thì commit thành block
  const handleTrailingBlur = () => {
    const val = trailingValue.trim();
    if (val) {
      const newId = `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setBlocks((prev) => {
        const next: NotionBlockItem[] = [...prev, { id: newId, type: "text", content: val }];
        triggerAutoSave(next);
        return next;
      });
      setTrailingValue("");
    }
  };

  // Drag & Drop
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

  // Tính số thứ tự cho numbered list
  let numberedCounter = 0;

  // Kiểm tra xem block cuối cùng có rỗng không
  const lastBlock = blocks[blocks.length - 1];
  const lastBlockIsEmptyText = lastBlock && lastBlock.type === "text" && !lastBlock.content;
  const isOnlyOneEmptyBlock = blocks.length === 1 && blocks[0].type === "text" && !blocks[0].content;

  return (
    <div
      ref={containerRef}
      data-slot="task-notion-block-content"
      className={cn("w-full relative font-sans text-sm text-foreground", className)}
    >
      {/* 1. Các Blocks Nội Dung (Auto-height, no internal scrollbar) */}
      <div className="space-y-0.5">
        {blocks.map((block, index) => {
          const isDragOver = dragOverIndex === index;

          // Reset hoặc tăng bộ đếm numbered list
          if (block.type === "numbered_list") {
            numberedCounter += 1;
          } else {
            numberedCounter = 0;
          }
          const currentNumber = numberedCounter;

          return (
            <div
              key={block.id}
              onDragOver={(e) => handleDragOver(e, index)}
              className={cn(
                "group/block relative flex items-start -mx-2 px-2 py-0.5 rounded-md transition-colors duration-75",
                isDragOver && "bg-primary/10 ring-1 ring-primary/30"
              )}
            >
              {/* Gutter trái: Handle ⋮⋮ (Chỉ hi���n khi hover hoặc focus block) */}
              {canEdit && (
                <div
                  className={cn(
                    "w-5 shrink-0 flex items-center justify-start pt-1 select-none transition-opacity duration-100 -ml-6 mr-1",
                    "opacity-0 group-hover/block:opacity-100 focus-within:opacity-100"
                  )}
                >
                  <div className="relative">
                    <button
                      type="button"
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragEnd={handleDragEnd}
                      onClick={() =>
                        setActiveBlockMenuId((prev) => (prev === block.id ? null : block.id))
                      }
                      className="p-0.5 rounded text-muted-foreground/35 hover:text-foreground hover:bg-muted/60 cursor-grab active:cursor-grabbing transition-colors"
                      title="Kéo thả hoặc nhấn để mở thao tác"
                      aria-label="Thao tác khối"
                    >
                      <GripVertical className="size-3.5" />
                    </button>

                    {/* Menu thao tác khi click ⋮⋮ */}
                    {activeBlockMenuId === block.id && (
                      <div
                        role="menu"
                        className="absolute left-0 top-full mt-1 w-44 rounded-xl border border-border bg-white p-1 text-foreground shadow-xl z-40 animate-in fade-in-0 zoom-in-95 duration-100 text-xs select-none"
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

              {/* Nội dung Block */}
              <div className="flex-1 min-w-0">
                {/* 1. Text Block */}
                {block.type === "text" && (
                  <div className="relative flex items-center min-h-[28px]">
                    {/* Placeholder Hint Layer với kbd '/' keycap khi block rỗng duy nhất */}
                    {isOnlyOneEmptyBlock && !block.content && (
                      <div className="absolute inset-0 flex items-center text-sm text-muted-foreground/60 select-none pointer-events-none transition-colors group-hover/block:text-muted-foreground/80 font-normal">
                        <span>Nhập nội dung hoặc gõ</span>
                        <kbd className="inline-flex items-center justify-center px-1.5 py-0.5 mx-1.5 rounded text-[11px] font-mono font-medium bg-muted text-muted-foreground border border-border/70 shadow-2xs leading-none">
                          /
                        </kbd>
                        <span>để chọn</span>
                      </div>
                    )}
                    <textarea
                      ref={(el) => {
                        if (el) {
                          blockInputRefs.current.set(block.id, el);
                          autoResizeTextarea(el);
                        } else {
                          blockInputRefs.current.delete(block.id);
                        }
                      }}
                      rows={1}
                      disabled={!canEdit}
                      value={block.content}
                      onInput={(e) => autoResizeTextarea(e.currentTarget)}
                      onChange={(e) => {
                        handleUpdateBlock(block.id, { content: e.target.value });
                        autoResizeTextarea(e.target);
                      }}
                      onKeyDown={(e) => handleBlockKeyDown(e, block, index)}
                      className="w-full resize-none overflow-hidden bg-transparent text-sm leading-relaxed text-foreground focus:outline-hidden py-0.5 cursor-text block relative z-10"
                    />
                  </div>
                )}

                {/* 2. Heading Block (H1, H2, H3) */}
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
                    placeholder={!block.content ? "Tiêu đề..." : undefined}
                    className={cn(
                      "w-full bg-transparent text-foreground placeholder:text-muted-foreground/35 focus:placeholder:text-muted-foreground/60 focus:outline-hidden py-1 font-bold tracking-tight cursor-text transition-colors",
                      block.level === 1 && "text-xl sm:text-2xl mt-2 mb-0.5",
                      block.level === 3 && "text-sm sm:text-base font-semibold mt-1 mb-0.5",
                      (!block.level || block.level === 2) && "text-base sm:text-lg font-semibold mt-1.5 mb-0.5"
                    )}
                  />
                )}

                {/* 3. Bulleted List */}
                {block.type === "bulleted_list" && (
                  <div className="flex items-start gap-2 py-0.5">
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
                      placeholder={!block.content ? "Danh sách..." : undefined}
                      className="w-full bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/35 focus:placeholder:text-muted-foreground/60 focus:outline-hidden cursor-text transition-colors"
                    />
                  </div>
                )}

                {/* 4. Numbered List */}
                {block.type === "numbered_list" && (
                  <div className="flex items-start gap-2 py-0.5">
                    <span className="font-mono text-xs text-muted-foreground font-semibold shrink-0 mt-0.5 w-4 text-right select-none">
                      {currentNumber}.
                    </span>
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
                      placeholder={!block.content ? "Danh sách..." : undefined}
                      className="w-full bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/35 focus:placeholder:text-muted-foreground/60 focus:outline-hidden cursor-text transition-colors"
                    />
                  </div>
                )}

                {/* 5. Checklist (To-do) */}
                {block.type === "checklist" && (
                  <div className="flex items-start gap-2.5 py-0.5">
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
                        <Circle className="size-4 text-muted-foreground/60 hover:text-foreground" />
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
                      placeholder={!block.content ? "Việc cần làm..." : undefined}
                      className={cn(
                        "w-full bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/35 focus:placeholder:text-muted-foreground/60 focus:outline-hidden cursor-text transition-colors",
                        block.checked && "line-through text-muted-foreground/70"
                      )}
                    />
                  </div>
                )}

                {/* 6. Quote (Trích dẫn) */}
                {block.type === "quote" && (
                  <div className="border-l-2 border-primary/70 pl-3 py-1 my-0.5 italic text-foreground/90">
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
                      placeholder={!block.content ? "Trích dẫn..." : undefined}
                      className="w-full bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/35 focus:placeholder:text-muted-foreground/60 focus:outline-hidden italic cursor-text transition-colors"
                    />
                  </div>
                )}

                {/* 7. Callout (Ghi chú nổi bật) */}
                {block.type === "callout" && (
                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-muted/40 my-1 text-sm border border-border/40">
                    <Info className="size-4 text-primary shrink-0 mt-0.5" />
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
                      placeholder={!block.content ? "Ghi chú lưu ý..." : undefined}
                      className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/35 focus:placeholder:text-muted-foreground/60 focus:outline-hidden font-medium cursor-text transition-colors"
                    />
                  </div>
                )}

                {/* 8. Divider (Đường phân cách) */}
                {block.type === "divider" && (
                  <div className="py-2">
                    <hr className="border-border/60" />
                  </div>
                )}

                {/* 9. Attachment (Tệp đính kèm) */}
                {block.type === "attachment" && (
                  <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-border/60 bg-muted/20 my-1 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <Paperclip className="size-4 text-primary shrink-0" />
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
                          className="w-full bg-transparent font-medium text-foreground focus:outline-hidden cursor-text"
                        />
                        <input
                          type="text"
                          disabled={!canEdit}
                          value={block.url || ""}
                          onChange={(e) => handleUpdateBlock(block.id, { url: e.target.value })}
                          placeholder="URL tải xuống (https://...)"
                          className="w-full bg-transparent text-[11px] text-muted-foreground focus:outline-hidden font-mono cursor-text"
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

                {/* 10. Link (Liên kết) */}
                {block.type === "link" && (
                  <div className="flex items-center justify-between gap-2.5 p-2 rounded-xl border border-border/60 bg-muted/20 my-1 text-xs">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Link2 className="size-3.5 text-primary shrink-0" />
                      <div className="min-w-0 flex-1">
                        <input
                          type="text"
                          disabled={!canEdit}
                          value={block.content}
                          onChange={(e) => handleUpdateBlock(block.id, { content: e.target.value })}
                          placeholder="Tiêu đề liên kết..."
                          className="w-full bg-transparent font-medium text-foreground focus:outline-hidden cursor-text"
                        />
                        <input
                          type="text"
                          disabled={!canEdit}
                          value={block.url || ""}
                          onChange={(e) => handleUpdateBlock(block.id, { url: e.target.value })}
                          placeholder="https://..."
                          className="w-full bg-transparent text-[11px] text-muted-foreground focus:outline-hidden font-mono cursor-text"
                        />
                      </div>
                    </div>
                    {block.url && (
                      <a
                        href={block.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 text-muted-foreground hover:text-foreground shrink-0"
                        title="Mở liên kết"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    )}
                  </div>
                )}

                {/* 11. Subtasks View Block */}
                {block.type === "subtasks_view" && (
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3 my-1.5 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Layers className="size-3.5 text-primary" />
                        <span className="font-semibold text-foreground">
                          Việc thành phần
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
                          title="Gỡ bỏ khối này"
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
                              className="flex items-center justify-between p-2 hover:bg-muted/30 transition-colors cursor-pointer gap-2"
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
                      <div className="text-center py-3 text-xs text-muted-foreground border border-dashed border-border/60 rounded-lg">
                        Chưa có việc thành phần nào.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. Trailing Empty Row (Render 1 dòng duy nhất ~32px sau block cuối, không border, không background) */}
      {canEdit && !lastBlockIsEmptyText && (
        <div
          className="group/trailing flex items-center h-8 -mx-2 px-2 py-0.5 rounded-md select-none cursor-text"
          onClick={() => trailingInputRef.current?.focus()}
        >
          {/* Khoảng trống căn chỉnh ngang hàng với text block phía trên */}
          <div className="w-5 shrink-0 -ml-6 mr-1 pointer-events-none" />
          <div className="relative flex-1 min-w-0 flex items-center min-h-[28px]">
            {/* Visual Hint Layer với keyboard keycap '/' */}
            {!trailingValue && (
              <div className="absolute inset-0 flex items-center text-sm text-muted-foreground/60 select-none pointer-events-none transition-colors group-hover/trailing:text-muted-foreground/80 font-normal">
                <span>Nhập nội dung hoặc gõ</span>
                <kbd className="inline-flex items-center justify-center px-1.5 py-0.5 mx-1.5 rounded text-[11px] font-mono font-medium bg-muted text-muted-foreground border border-border/70 shadow-2xs leading-none">
                  /
                </kbd>
                <span>để chọn</span>
              </div>
            )}
            <input
              ref={trailingInputRef}
              type="text"
              value={trailingValue}
              onKeyDown={handleTrailingKeyDown}
              onChange={handleTrailingChange}
              onBlur={handleTrailingBlur}
              className="w-full bg-transparent text-sm leading-relaxed text-foreground focus:outline-hidden py-0.5 cursor-text relative z-10"
            />
          </div>
        </div>
      )}

      {/* 3. Slash Command Popover Menu (Tối giản kiểu Notion, ưu tiên nghiệp vụ E-Office) */}
      {isMenuOpen && (
        <div
          role="dialog"
          aria-label="Menu lệnh"
          className="fixed inset-0 z-50 flex items-center justify-center sm:items-start sm:justify-start bg-black/10 sm:bg-transparent p-4 sm:p-0"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseSlashMenu();
          }}
        >
          <div
            style={
              menuPosition
                ? {
                    position: "absolute",
                    top: `${menuPosition.top}px`,
                    left: `${menuPosition.left}px`,
                  }
                : undefined
            }
            className="w-full max-w-sm sm:w-72 rounded-2xl border border-border bg-white p-1.5 text-foreground shadow-2xl z-50 animate-in fade-in-0 zoom-in-95 duration-100 select-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ô tìm kiếm lệnh */}
            <div className="relative mb-1.5">
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
                    handleCloseSlashMenu();
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
                placeholder="Tìm lệnh..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-muted/40 rounded-xl border border-border/60 focus:outline-hidden focus:ring-1 focus:ring-primary/40 font-medium"
              />
            </div>

            {/* Danh sách lựa chọn */}
            <div className="max-h-64 overflow-y-auto space-y-1.5 p-0.5">
              {(["Soạn thảo", "Danh sách", "Tiêu đề", "Trích dẫn & Ghi chú", "Tệp & Liên kết", "Phân cách"] as const).map((groupName) => {
                const groupOptions = filteredMenuOptions.filter((opt) => opt.group === groupName);
                if (groupOptions.length === 0) return null;

                return (
                  <div key={groupName} className="space-y-0.5">
                    <div className="px-2.5 py-1 text-[11px] font-semibold text-muted-foreground/80">
                      {groupName}
                    </div>
                    {groupOptions.map((opt) => {
                      const itemGlobalIndex = filteredMenuOptions.indexOf(opt);
                      const isSelected = itemGlobalIndex === activeMenuIndex;
                      const IconComponent = opt.icon;

                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleSelectMenuItem(opt)}
                          onMouseEnter={() => setActiveMenuIndex(itemGlobalIndex)}
                          className={cn(
                            "w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors cursor-pointer",
                            isSelected ? "bg-muted text-foreground font-medium" : "hover:bg-muted/60 text-muted-foreground"
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="p-1 rounded-lg border border-border/60 bg-white shrink-0">
                              <IconComponent className="size-3.5 text-foreground" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-foreground truncate flex items-center gap-1.5">
                                <span>{opt.title}</span>
                                {opt.badge && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-primary/10 text-primary font-normal">
                                    {opt.badge}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-muted-foreground truncate">
                                {opt.description}
                              </div>
                            </div>
                          </div>
                          {opt.shortcut && (
                            <span className="font-mono text-[10px] text-muted-foreground/60 shrink-0">
                              {opt.shortcut}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}

              {filteredMenuOptions.length === 0 && (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  Không tìm thấy lệnh phù hợp
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
