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
  Search,
  Trash2,
  ArrowUp,
  ArrowDown,
  Copy,
  ExternalLink,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StaffTask } from "@/types/dashboard";

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
  | "link";

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
 * Danh sách block type legacy hoặc business widget bị loại bỏ khỏi content document.
 * Tuyệt đối không render trong canvas và dọn sạch khi parse.
 */
const LEGACY_STRIP_TYPES = new Set([
  "subtasks_view",
  "subtasks",
  "componentTasks",
  "childTasks",
  "taskChildren",
  "activity_view",
  "properties_view",
]);

/**
 * Singleton Block Guard: cấu hình các block chỉ được xuất hiện tối đa 1 lần nếu có trong tương lai.
 */
const SINGLETON_BLOCK_TYPES = new Set<NotionBlockType>([]);

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
 * Dọn sạch mọi widget legacy (như subtasks_view) khỏi model document.
 */
export function parseContentToBlocks(raw?: string | null): NotionBlockItem[] {
  if (!raw || !raw.trim()) {
    return [{ id: `b-${Date.now()}-1`, type: "text", content: "" }];
  }

  try {
    if (raw.includes('"qcetBlocks":true')) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.blocks) && parsed.blocks.length > 0) {
        // Dọn dữ liệu legacy: loại bỏ subtasks widgets khỏi document model
        const cleanedBlocks = parsed.blocks.filter(
          (b: any) => b && !LEGACY_STRIP_TYPES.has(b.type)
        );
        if (cleanedBlocks.length > 0) {
          return cleanedBlocks;
        }
        return [{ id: `b-${Date.now()}-1`, type: "text", content: "" }];
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
  // Dọn các block legacy nếu còn sót và các block text rỗng ở cuối
  const cleaned = blocks.filter((b) => !LEGACY_STRIP_TYPES.has(b.type));
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
  type: NotionBlockType;
  group: "Soạn thảo" | "Danh sách" | "Tiêu đề" | "Trích dẫn & Ghi chú" | "Tệp & Liên kết" | "Phân cách";
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  level?: 1 | 2 | 3;
}

/**
 * Slash menu CHỈ chứa các repeatable content blocks thuần túy của văn bản,
 * KHÔNG chứa các domain widget (như Việc thành phần, Hoạt động, Người phụ trách...).
 */
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

  // 2. Danh sách
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

  // Multi-Selection State theo convention Notion (Set các block ID được chọn)
  const [selectedBlockIds, setSelectedBlockIds] = React.useState<Set<string>>(new Set());
  const [anchorBlockId, setAnchorBlockId] = React.useState<string | null>(null);

  // Context Menu State (Chuột phải vào handle hoặc block)
  const [activeContextMenu, setActiveContextMenu] = React.useState<{
    blockId: string;
    top: number;
    left: number;
  } | null>(null);

  // Drag and drop state (Hỗ trợ kéo đơn hoặc kéo cả group multi-selected)
  const [draggedBlockIndex, setDraggedBlockIndex] = React.useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);
  const [draggedGroupBlockIds, setDraggedGroupBlockIds] = React.useState<string[]>([]);
  const isDraggingRef = React.useRef(false);

  // Trailing input state (controlled để quản lý hiển thị keycap hint)
  const [trailingValue, setTrailingValue] = React.useState("");

  // Ref tracking
  const menuInputRef = React.useRef<HTMLInputElement>(null);
  const menuPopoverRef = React.useRef<HTMLDivElement>(null);
  const menuListRef = React.useRef<HTMLDivElement>(null);
  const menuItemRefs = React.useRef<Map<number, HTMLButtonElement>>(new Map());
  const blockWrapperRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const blockInputRefs = React.useRef<Map<string, HTMLInputElement | HTMLTextAreaElement>>(new Map());
  const trailingInputRef = React.useRef<HTMLInputElement>(null);
  const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const pendingFocusBlockIdRef = React.useRef<string | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Bỏ selection và context menu khi click ra ngoài editor
  React.useEffect(() => {
    const handleGlobalPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSelectedBlockIds(new Set());
        setAnchorBlockId(null);
        setActiveContextMenu(null);
      }
    };
    window.addEventListener("mousedown", handleGlobalPointerDown);
    return () => window.removeEventListener("mousedown", handleGlobalPointerDown);
  }, []);

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

  // Tự động focus và scroll nhẹ vào view khi block mới được tạo (Enter hoặc Slash select)
  React.useEffect(() => {
    if (pendingFocusBlockIdRef.current) {
      if (pendingFocusBlockIdRef.current === "trailing") {
        trailingInputRef.current?.focus();
        trailingInputRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } else {
        const el = blockInputRefs.current.get(pendingFocusBlockIdRef.current);
        if (el) {
          el.focus();
          el.scrollIntoView({ behavior: "smooth", block: "nearest" });
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

  // Tự động scroll item đang chọn trong slash menu vào tầm nhìn (không scroll page)
  React.useEffect(() => {
    if (isMenuOpen) {
      const activeBtn = menuItemRefs.current.get(activeMenuIndex);
      if (activeBtn) {
        activeBtn.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [activeMenuIndex, isMenuOpen]);

  // Lọc menu theo ô tìm kiếm và áp dụng Singleton Guard
  const filteredMenuOptions = React.useMemo(() => {
    const q = menuSearchQuery.trim().toLowerCase();
    const existingTypes = new Set(blocks.map((b) => b.type));

    // Singleton Guard: ẩn/disable các block singleton nếu đã tồn tại
    const available = MENU_OPTIONS.filter((opt) => {
      if (SINGLETON_BLOCK_TYPES.has(opt.type) && existingTypes.has(opt.type)) {
        return false;
      }
      return true;
    });

    if (!q) return available;
    return available.filter((opt) => {
      const matchTitle = opt.title.toLowerCase().includes(q);
      const matchDesc = opt.description.toLowerCase().includes(q);
      const matchGroup = opt.group.toLowerCase().includes(q);
      const matchShortcut = opt.shortcut?.toLowerCase().includes(q);
      return matchTitle || matchDesc || matchGroup || matchShortcut;
    });
  }, [menuSearchQuery, blocks]);

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

  // Mở Slash Menu với Collision Handling & Auto-scroll an toàn
  const handleOpenSlashMenu = (index: number, anchorEl?: HTMLElement | null) => {
    setMenuTargetIndex(index);
    setMenuSearchQuery("");
    setActiveMenuIndex(0);

    if (anchorEl) {
      // 1. Cuộn nhẹ block / anchor hiện tại vào viewport nếu đang bị che
      anchorEl.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });

      const rect = anchorEl.getBoundingClientRect();
      const ESTIMATED_MENU_HEIGHT = 300;
      const ESTIMATED_MENU_WIDTH = 288;
      const COLLISION_PADDING = 12;
      const BOTTOM_SAFETY_MARGIN = 20;

      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      // Flip lên top nếu phía dưới không đủ không gian và phía trên rộng hơn
      const shouldFlipTop = spaceBelow < 240 && spaceAbove > spaceBelow;

      const top = shouldFlipTop
        ? Math.max(COLLISION_PADDING + window.scrollY, rect.top + window.scrollY - ESTIMATED_MENU_HEIGHT - 6)
        : rect.bottom + window.scrollY + 6;

      // Shift ngang để menu không tràn ra ngoài viewport
      let left = rect.left + window.scrollX;
      const maxLeft = window.innerWidth - ESTIMATED_MENU_WIDTH - COLLISION_PADDING;
      left = Math.max(COLLISION_PADDING, Math.min(left, maxLeft));

      setMenuPosition({ top, left });

      // 2. Chờ DOM vẽ menu và tự động scroll PAGE vừa đủ để menu và caret nằm trọn trong viewport
      setTimeout(() => {
        const menuEl = menuPopoverRef.current;
        if (menuEl) {
          const menuRect = menuEl.getBoundingClientRect();
          const overflowBottom = menuRect.bottom - (window.innerHeight - BOTTOM_SAFETY_MARGIN);
          if (overflowBottom > 0) {
            window.scrollBy({ top: overflowBottom, behavior: "smooth" });
          } else if (menuRect.top < COLLISION_PADDING) {
            window.scrollBy({ top: menuRect.top - COLLISION_PADDING, behavior: "smooth" });
          }
        }
      }, 50);
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

  /**
   * Chọn loại Block từ Slash Menu:
   * - Nếu kích hoạt từ current block đang rỗng -> REPLACE/CONVERT chính block rỗng đó.
   * - Nếu kích hoạt từ trailing row -> thay thế hoặc append trực tiếp vào cuối.
   * - Nếu kích hoạt từ block có text -> insert block mới ngay liền kề phía dưới.
   */
  const handleSelectMenuItem = (option: MenuItemOption) => {
    const targetIdx = menuTargetIndex ?? blocks.length;
    handleCloseSlashMenu();
    setTrailingValue("");

    const newBlockId = `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newBlock: NotionBlockItem = {
      id: newBlockId,
      type: option.type,
      content: "",
      checked: option.type === "checklist" ? false : undefined,
      level: option.level || (option.type === "heading" ? 2 : undefined),
      url: option.type === "link" ? "https://" : undefined,
      fileName: option.type === "attachment" ? "Tài liệu đính kèm" : undefined,
    };

    setBlocks((prev) => {
      const next = [...prev];

      // Trường hợp 1: Menu mở từ trailing row (cuối tài liệu)
      if (targetIdx >= next.length) {
        const last = next[next.length - 1];
        if (last && last.type === "text" && !last.content.trim()) {
          // Convert block text rỗng cuối cùng, không sinh thêm block rỗng thừa
          next[next.length - 1] = newBlock;
        } else {
          next.push(newBlock);
        }
      } else {
        // Trường hợp 2: Menu mở từ block hiện tại
        const currentBlock = next[targetIdx];
        if (currentBlock && !currentBlock.content.trim()) {
          // Block hiện tại rỗng -> convert tại chỗ
          next[targetIdx] = newBlock;
        } else {
          // Block hiện tại có nội dung -> insert ngay liền kề phía dưới
          next.splice(targetIdx + 1, 0, newBlock);
        }
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

  // Xóa toàn bộ các block đang được chọn (Multi-selection Delete)
  const handleDeleteSelectedBlocks = () => {
    if (selectedBlockIds.size === 0) return;

    setBlocks((prev) => {
      const deletedIndices = prev
        .map((b, idx) => (selectedBlockIds.has(b.id) ? idx : -1))
        .filter((idx) => idx !== -1);
      if (deletedIndices.length === 0) return prev;

      const minIndex = Math.min(...deletedIndices);
      const next = prev.filter((b) => !selectedBlockIds.has(b.id));

      if (next.length === 0) {
        const newId = `b-${Date.now()}`;
        pendingFocusBlockIdRef.current = newId;
        setSelectedBlockIds(new Set());
        setAnchorBlockId(null);
        return [{ id: newId, type: "text", content: "" }];
      }

      // Chọn block kế tiếp (nếu còn), hoặc block ngay trước đó
      const nextTargetIndex = minIndex < next.length ? minIndex : next.length - 1;
      const nextTargetBlock = next[nextTargetIndex];
      if (nextTargetBlock) {
        setSelectedBlockIds(new Set([nextTargetBlock.id]));
        setAnchorBlockId(nextTargetBlock.id);
        setTimeout(() => {
          blockWrapperRefs.current.get(nextTargetBlock.id)?.focus();
        }, 20);
      }

      triggerAutoSave(next);
      return next;
    });
    setActiveContextMenu(null);
  };

  // Xóa một block đơn lẻ
  const handleDeleteBlock = (blockId: string) => {
    setSelectedBlockIds(new Set([blockId]));
    setAnchorBlockId(blockId);
    setBlocks((prev) => {
      const index = prev.findIndex((b) => b.id === blockId);
      if (index === -1) return prev;

      const next = prev.filter((b) => b.id !== blockId);
      if (next.length === 0) {
        const newId = `b-${Date.now()}`;
        pendingFocusBlockIdRef.current = newId;
        setSelectedBlockIds(new Set());
        setAnchorBlockId(null);
        return [{ id: newId, type: "text", content: "" }];
      }

      const nextTargetIndex = index < next.length ? index : next.length - 1;
      const nextTargetBlock = next[nextTargetIndex];
      if (nextTargetBlock) {
        setSelectedBlockIds(new Set([nextTargetBlock.id]));
        setAnchorBlockId(nextTargetBlock.id);
        setTimeout(() => {
          blockWrapperRefs.current.get(nextTargetBlock.id)?.focus();
        }, 20);
      }

      triggerAutoSave(next);
      return next;
    });
    setActiveContextMenu(null);
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
    setActiveContextMenu(null);
  };

  // Nhân đôi toàn bộ các block đang được chọn (Multi-selection Duplicate)
  const handleDuplicateSelectedBlocks = () => {
    if (selectedBlockIds.size === 0) return;

    setBlocks((prev) => {
      const selectedItems = prev.filter((b) => selectedBlockIds.has(b.id));
      if (selectedItems.length === 0) return prev;

      let lastSelectedIndex = -1;
      prev.forEach((b, idx) => {
        if (selectedBlockIds.has(b.id)) lastSelectedIndex = idx;
      });

      const newClonedIds = new Set<string>();
      const clonedBlocks: NotionBlockItem[] = selectedItems.map((b, i) => {
        const newId = `b-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`;
        newClonedIds.add(newId);
        return {
          ...b,
          id: newId,
        };
      });

      const next = [...prev];
      next.splice(lastSelectedIndex + 1, 0, ...clonedBlocks);

      setSelectedBlockIds(newClonedIds);
      const firstClonedId = Array.from(newClonedIds)[0];
      setAnchorBlockId(firstClonedId);
      setTimeout(() => {
        blockWrapperRefs.current.get(firstClonedId)?.focus();
      }, 20);

      triggerAutoSave(next);
      return next;
    });
    setActiveContextMenu(null);
  };

  // Nhân đôi block đơn
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
    setSelectedBlockIds(new Set([cloneId]));
    setAnchorBlockId(cloneId);
    setTimeout(() => {
      blockWrapperRefs.current.get(cloneId)?.focus();
    }, 20);
    setActiveContextMenu(null);
  };

  // Click vào Drag Handle (Hỗ trợ Single click, Shift + click range, Cmd/Ctrl + click toggle)
  const handleBlockHandleClick = (e: React.MouseEvent, block: NotionBlockItem, index: number) => {
    e.stopPropagation();
    if (isDraggingRef.current) return;

    // Shift + click: Chọn liên tục từ anchor block đến block hiện tại
    if (e.shiftKey && anchorBlockId) {
      const anchorIdx = blocks.findIndex((b) => b.id === anchorBlockId);
      if (anchorIdx !== -1) {
        const start = Math.min(anchorIdx, index);
        const end = Math.max(anchorIdx, index);
        const rangeIds = new Set<string>();
        for (let i = start; i <= end; i++) {
          rangeIds.add(blocks[i].id);
        }
        setSelectedBlockIds(rangeIds);
        blockWrapperRefs.current.get(block.id)?.focus();
        return;
      }
    }

    // Cmd/Ctrl + click: Toggle block vào/ra khỏi selection mà không bỏ các block khác
    if (e.metaKey || e.ctrlKey) {
      setSelectedBlockIds((prev) => {
        const next = new Set(prev);
        if (next.has(block.id)) {
          next.delete(block.id);
        } else {
          next.add(block.id);
        }
        return next;
      });
      setAnchorBlockId(block.id);
      blockWrapperRefs.current.get(block.id)?.focus();
      return;
    }

    // Click nhanh thông thường: Chọn duy nhất block này
    setSelectedBlockIds(new Set([block.id]));
    setAnchorBlockId(block.id);
    blockWrapperRefs.current.get(block.id)?.focus();
  };

  // Context Menu khi chuột phải vào block hoặc handle
  const handleContextMenu = (e: React.MouseEvent, block: NotionBlockItem) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedBlockIds.has(block.id)) {
      setSelectedBlockIds(new Set([block.id]));
      setAnchorBlockId(block.id);
    }
    setActiveContextMenu({
      blockId: block.id,
      top: e.clientY + window.scrollY,
      left: Math.min(e.clientX + window.scrollX, window.innerWidth - 200),
    });
  };

  // Xử lý phím tắt khi block đang ở chế độ Selection Mode (Delete, Backspace, Cmd+D, ArrowUp/Down, Enter, Esc)
  const handleBlockWrapperKeyDown = (
    e: React.KeyboardEvent,
    block: NotionBlockItem,
    index: number
  ) => {
    if (!selectedBlockIds.has(block.id)) return;

    // 1. Delete hoặc Backspace -> xóa toàn bộ selected blocks ngay lập tức
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      e.stopPropagation();
      handleDeleteSelectedBlocks();
      return;
    }

    // 2. Cmd/Ctrl + D -> duplicate toàn bộ selected blocks
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
      e.preventDefault();
      e.stopPropagation();
      handleDuplicateSelectedBlocks();
      return;
    }

    // 3. Shift + ArrowUp / ArrowDown -> Mở rộng selection lên/xuống
    if (e.shiftKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      e.stopPropagation();
      const targetIndex = e.key === "ArrowUp" ? index - 1 : index + 1;
      if (targetIndex >= 0 && targetIndex < blocks.length) {
        const targetBlock = blocks[targetIndex];
        setSelectedBlockIds((prev) => {
          const next = new Set(prev);
          next.add(targetBlock.id);
          return next;
        });
        blockWrapperRefs.current.get(targetBlock.id)?.focus();
      }
      return;
    }

    // 4. Arrow Up / Down (khi chỉ có 1 block selected): chuyển selection
    if (e.key === "ArrowUp" && selectedBlockIds.size === 1) {
      e.preventDefault();
      e.stopPropagation();
      if (index > 0) {
        const prevBlock = blocks[index - 1];
        setSelectedBlockIds(new Set([prevBlock.id]));
        setAnchorBlockId(prevBlock.id);
        blockWrapperRefs.current.get(prevBlock.id)?.focus();
      }
      return;
    }

    if (e.key === "ArrowDown" && selectedBlockIds.size === 1) {
      e.preventDefault();
      e.stopPropagation();
      if (index < blocks.length - 1) {
        const nextBlock = blocks[index + 1];
        setSelectedBlockIds(new Set([nextBlock.id]));
        setAnchorBlockId(nextBlock.id);
        blockWrapperRefs.current.get(nextBlock.id)?.focus();
      }
      return;
    }

    // 5. Enter -> nếu chỉ chọn 1 block, thoát selection mode và edit text
    if (e.key === "Enter" && !e.shiftKey && selectedBlockIds.size === 1) {
      e.preventDefault();
      e.stopPropagation();
      setSelectedBlockIds(new Set());
      setAnchorBlockId(null);
      const inputEl = blockInputRefs.current.get(block.id);
      inputEl?.focus();
      return;
    }

    // 6. Esc -> bỏ selected state
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setSelectedBlockIds(new Set());
      setAnchorBlockId(null);
      setActiveContextMenu(null);
      return;
    }
  };

  // Xử lý phím Enter / Backspace / Slash trong text input của block
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

    // 2. Phím Esc khi đang edit text: chuyển current block sang selected
    if (e.key === "Escape") {
      e.preventDefault();
      setSelectedBlockIds(new Set([block.id]));
      setAnchorBlockId(block.id);
      blockWrapperRefs.current.get(block.id)?.focus();
      return;
    }

    // 3. Phím Enter -> tạo block tiếp theo tự nhiên (Notion style)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const nextId = `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

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

    // 4. Phím Backspace khi ô rỗng
    if (e.key === "Backspace" && !block.content) {
      if (block.type !== "text") {
        e.preventDefault();
        handleUpdateBlock(block.id, { type: "text", level: undefined, checked: undefined });
        return;
      }

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

  // Drag & Drop (Hỗ trợ kéo cả group multi-selected)
  const handleDragStart = (e: React.DragEvent, index: number, block: NotionBlockItem) => {
    isDraggingRef.current = true;
    let groupIds: string[];

    if (selectedBlockIds.has(block.id) && selectedBlockIds.size > 1) {
      groupIds = blocks.filter((b) => selectedBlockIds.has(b.id)).map((b) => b.id);
    } else {
      groupIds = [block.id];
      setSelectedBlockIds(new Set([block.id]));
      setAnchorBlockId(block.id);
    }

    setDraggedGroupBlockIds(groupIds);
    setDraggedBlockIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    if (draggedGroupBlockIds.length > 0 && dragOverIndex !== null && draggedBlockIndex !== null) {
      setBlocks((prev) => {
        const groupItems = prev.filter((b) => draggedGroupBlockIds.includes(b.id));
        if (groupItems.length === 0) return prev;

        const remaining = prev.filter((b) => !draggedGroupBlockIds.includes(b.id));
        const targetBlock = prev[dragOverIndex];
        let insertAt = targetBlock ? remaining.findIndex((b) => b.id === targetBlock.id) : remaining.length;
        if (insertAt === -1) insertAt = remaining.length;

        const next = [...remaining];
        next.splice(insertAt, 0, ...groupItems);
        triggerAutoSave(next);
        return next;
      });
    }

    isDraggingRef.current = false;
    setDraggedBlockIndex(null);
    setDragOverIndex(null);
    setDraggedGroupBlockIds([]);
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
          const isSelected = selectedBlockIds.has(block.id);

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
              ref={(el) => {
                if (el) blockWrapperRefs.current.set(block.id, el);
                else blockWrapperRefs.current.delete(block.id);
              }}
              tabIndex={canEdit ? 0 : undefined}
              onKeyDown={(e) => handleBlockWrapperKeyDown(e, block, index)}
              onContextMenu={(e) => handleContextMenu(e, block)}
              onDragOver={(e) => handleDragOver(e, index)}
              className={cn(
                "group/block relative flex items-start -mx-2 px-2 py-0.5 rounded-md transition-colors duration-75 outline-hidden",
                !isSelected && "hover:bg-muted/30",
                isDragOver && "ring-2 ring-primary/70 bg-primary/5",
                isSelected && "bg-primary/10 ring-1 ring-primary/30 shadow-2xs"
              )}
            >
              {/* Gutter trái: Handle ⋮⋮ (Hover hiện icon, click/shift/cmd để chọn block, drag để sắp xếp) */}
              {canEdit && (
                <div
                  className={cn(
                    "w-5 shrink-0 flex items-center justify-start pt-1 select-none transition-opacity duration-100 -ml-6 mr-1",
                    isSelected
                      ? "opacity-100"
                      : "opacity-0 group-hover/block:opacity-100 focus-within:opacity-100"
                  )}
                >
                  <div className="relative flex items-center">
                    <button
                      type="button"
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, index, block)}
                      onDragEnd={handleDragEnd}
                      onClick={(e) => handleBlockHandleClick(e, block, index)}
                      onContextMenu={(e) => handleContextMenu(e, block)}
                      className={cn(
                        "p-0.5 rounded text-muted-foreground/40 hover:text-foreground hover:bg-muted/60 cursor-grab active:cursor-grabbing transition-colors",
                        isSelected && "text-primary hover:text-primary bg-primary/15"
                      )}
                      title="Nhấn để chọn block (Delete để xóa, ⌘D để nhân đôi, kéo để di chuyển)"
                      aria-label="Chọn hoặc kéo khối"
                    >
                      <GripVertical className="size-3.5" />
                    </button>
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
                      onFocus={() => {
                        if (selectedBlockIds.size > 0) {
                          setSelectedBlockIds(new Set());
                          setAnchorBlockId(null);
                        }
                      }}
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
                    onFocus={() => {
                      if (selectedBlockIds.size > 0) {
                        setSelectedBlockIds(new Set());
                        setAnchorBlockId(null);
                      }
                    }}
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
                      onFocus={() => {
                        if (selectedBlockIds.size > 0) {
                          setSelectedBlockIds(new Set());
                          setAnchorBlockId(null);
                        }
                      }}
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
                      onFocus={() => {
                        if (selectedBlockIds.size > 0) {
                          setSelectedBlockIds(new Set());
                          setAnchorBlockId(null);
                        }
                      }}
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
                      onFocus={() => {
                        if (selectedBlockIds.size > 0) {
                          setSelectedBlockIds(new Set());
                          setAnchorBlockId(null);
                        }
                      }}
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
                      onFocus={() => {
                        if (selectedBlockIds.size > 0) {
                          setSelectedBlockIds(new Set());
                          setAnchorBlockId(null);
                        }
                      }}
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
                      onFocus={() => {
                        if (selectedBlockIds.size > 0) {
                          setSelectedBlockIds(new Set());
                          setAnchorBlockId(null);
                        }
                      }}
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
                          onFocus={() => {
                            if (selectedBlockIds.size > 0) {
                              setSelectedBlockIds(new Set());
                              setAnchorBlockId(null);
                            }
                          }}
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
                          onFocus={() => {
                            if (selectedBlockIds.size > 0) {
                              setSelectedBlockIds(new Set());
                              setAnchorBlockId(null);
                            }
                          }}
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
                          onFocus={() => {
                            if (selectedBlockIds.size > 0) {
                              setSelectedBlockIds(new Set());
                              setAnchorBlockId(null);
                            }
                          }}
                          onChange={(e) => handleUpdateBlock(block.id, { content: e.target.value })}
                          placeholder="Tiêu đề liên kết..."
                          className="w-full bg-transparent font-medium text-foreground focus:outline-hidden cursor-text"
                        />
                        <input
                          type="text"
                          disabled={!canEdit}
                          value={block.url || ""}
                          onFocus={() => {
                            if (selectedBlockIds.size > 0) {
                              setSelectedBlockIds(new Set());
                              setAnchorBlockId(null);
                            }
                          }}
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
              onFocus={() => {
                if (selectedBlockIds.size > 0) {
                  setSelectedBlockIds(new Set());
                  setAnchorBlockId(null);
                }
              }}
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
            ref={menuPopoverRef}
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
            <div ref={menuListRef} className="max-h-64 overflow-y-auto space-y-1.5 p-0.5">
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
                          ref={(el) => {
                            if (el) menuItemRefs.current.set(itemGlobalIndex, el);
                            else menuItemRefs.current.delete(itemGlobalIndex);
                          }}
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

      {/* 4. Context Menu Nâng cao (Chuột phải vào Block hoặc Handle) */}
      {activeContextMenu && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: `${activeContextMenu.top}px`,
            left: `${activeContextMenu.left}px`,
          }}
          className="w-48 rounded-xl border border-border bg-white p-1 text-foreground shadow-2xl z-50 animate-in fade-in-0 zoom-in-95 duration-100 text-xs select-none"
          onClick={(e) => e.stopPropagation()}
        >
          {selectedBlockIds.size <= 1 && (
            <>
              <button
                type="button"
                onClick={() => {
                  const idx = blocks.findIndex((b) => b.id === activeContextMenu.blockId);
                  if (idx > 0) handleMoveBlock(idx, "up");
                  setActiveContextMenu(null);
                }}
                disabled={blocks.findIndex((b) => b.id === activeContextMenu.blockId) === 0}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left hover:bg-muted disabled:opacity-40 cursor-pointer"
              >
                <ArrowUp className="size-3.5 text-muted-foreground" />
                <span>Di chuyển lên</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const idx = blocks.findIndex((b) => b.id === activeContextMenu.blockId);
                  if (idx >= 0 && idx < blocks.length - 1) handleMoveBlock(idx, "down");
                  setActiveContextMenu(null);
                }}
                disabled={blocks.findIndex((b) => b.id === activeContextMenu.blockId) === blocks.length - 1}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left hover:bg-muted disabled:opacity-40 cursor-pointer"
              >
                <ArrowDown className="size-3.5 text-muted-foreground" />
                <span>Di chuyển xuống</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              if (selectedBlockIds.size > 1) {
                handleDuplicateSelectedBlocks();
              } else {
                const idx = blocks.findIndex((b) => b.id === activeContextMenu.blockId);
                if (idx >= 0) handleDuplicateBlock(blocks[idx], idx);
              }
              setActiveContextMenu(null);
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left hover:bg-muted cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Copy className="size-3.5 text-muted-foreground" />
              <span>{selectedBlockIds.size > 1 ? `Nhân đôi (${selectedBlockIds.size})` : "Nhân đôi block"}</span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground/60">⌘D</span>
          </button>
          <div className="my-1 border-t border-border/40" />
          <button
            type="button"
            onClick={() => {
              if (selectedBlockIds.size > 1) {
                handleDeleteSelectedBlocks();
              } else {
                handleDeleteBlock(activeContextMenu.blockId);
              }
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-rose-600 hover:bg-rose-50 cursor-pointer font-medium"
          >
            <div className="flex items-center gap-2">
              <Trash2 className="size-3.5" />
              <span>{selectedBlockIds.size > 1 ? `Xóa (${selectedBlockIds.size}) khối` : "Xóa block"}</span>
            </div>
            <span className="text-[10px] font-mono text-rose-500/70">Del</span>
          </button>
        </div>
      )}
    </div>
  );
}
