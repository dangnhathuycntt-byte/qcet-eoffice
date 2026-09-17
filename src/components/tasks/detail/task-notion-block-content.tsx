"use client";

import * as React from "react";
import { createPortal } from "react-dom";
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
  Image as ImageIcon,
  FileText,
  Bookmark,
  Globe,
  UploadCloud,
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
  imageWidth?: number; // 25, 50, 75, 100 (%)
  description?: string;
  favicon?: string;
  thumbnailUrl?: string;
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
 * loại bỏ hoàn toàn scrollbar riêng trong textarea và chống layout thrashing.
 */
function autoResizeTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return;
  const currentHeight = el.style.height;
  el.style.height = "auto";
  const newHeight = `${el.scrollHeight}px`;
  if (currentHeight !== newHeight) {
    el.style.height = newHeight;
  } else {
    el.style.height = currentHeight;
  }
}

/**
 * Kiểm tra xem một block có chứa dữ liệu thực tế hay không.
 * Các block rỗng (chỉ có placeholder) không được lưu hoặc hiển thị như dữ liệu thật.
 */
export function isMeaningfulBlock(b: NotionBlockItem | null | undefined): boolean {
  if (!b) return false;

  // 1. Divider luôn là content có ý nghĩa dù không có text
  if (b.type === "divider") return true;

  // 2. Image: phải có URL ảnh thực tế
  if (b.type === "image") {
    return Boolean(b.url && b.url.trim().length > 0);
  }

  // 3. File / Attachment: chỉ có ý nghĩa khi có URL hoặc tên file thực tế (khác placeholder)
  if (b.type === "attachment") {
    const hasValidUrl = Boolean(b.url && b.url.trim() && b.url !== "https://" && b.url !== "https:///");
    const hasValidFile = Boolean(
      b.fileName &&
      b.fileName.trim() &&
      b.fileName !== "Tài liệu đính kèm" &&
      b.fileName !== "Tên tài liệu đính kèm..."
    );
    const hasContent = Boolean(
      b.content &&
      b.content.trim() &&
      b.content !== "Tài liệu đính kèm" &&
      b.content !== "Tên tài liệu đính kèm..."
    );
    return hasValidUrl || hasValidFile || hasContent;
  }

  // 4. Link & Bookmark: chỉ có ý nghĩa khi có URL thực tế khác "https://" và "https:///"
  if (b.type === "link" || b.type === "bookmark") {
    const hasValidUrl = Boolean(b.url && b.url.trim() && b.url !== "https://" && b.url !== "https:///");
    const hasContent = Boolean(b.content && b.content.trim() && b.content !== "Tiêu đề liên kết...");
    return hasValidUrl || hasContent;
  }

  // 5. Text, heading, list, checklist, quote, callout: cần content có dữ liệu
  return Boolean(b.content && b.content.trim().length > 0);
}

export interface UrlMetadata {
  url: string;
  title: string;
  domain: string;
  description?: string;
  favicon?: string;
  thumbnailUrl?: string;
  isInternalQcet?: boolean;
  entityType?: "task" | "document" | "meeting" | "general";
}

/**
 * Phân giải metadata cho URL hoặc phát hiện link nội bộ QCET E-Office
 */
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

/**
 * Phân tích chuỗi mô tả thành danh sách các block Notion.
 * Dọn sạch mọi widget legacy (như subtasks_view) và loại bỏ các empty block cũ khỏi model document.
 */
export function parseContentToBlocks(raw?: string | null): NotionBlockItem[] {
  if (!raw || !raw.trim()) {
    return [{ id: `b-${Date.now()}-1`, type: "text", content: "" }];
  }

  try {
    if (raw.includes('"qcetBlocks":true')) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.blocks) && parsed.blocks.length > 0) {
        // Dọn dữ liệu legacy: loại bỏ subtasks widgets VÀ loại bỏ các block rỗng không có dữ liệu thật
        const cleanedBlocks = parsed.blocks.filter(
          (b: any) => b && !LEGACY_STRIP_TYPES.has(b.type) && isMeaningfulBlock(b)
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
 * Chỉ persist các block có ý nghĩa, loại bỏ hoàn toàn các block rỗng.
 */
export function serializeBlocksToContent(blocks: NotionBlockItem[]): string {
  const cleaned = blocks.filter(
    (b) => !LEGACY_STRIP_TYPES.has(b.type) && isMeaningfulBlock(b)
  );

  // Nếu không còn block nào có ý nghĩa
  if (cleaned.length === 0) {
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
  group: "Soạn thảo" | "Danh sách" | "Tiêu đề" | "Trích dẫn & Ghi chú" | "Phương tiện & Tệp" | "Liên kết" | "Phân cách";
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

  // 5. Phương tiện & Tệp (Hình ảnh & Tệp tách riêng)
  {
    id: "opt-image",
    type: "image",
    group: "Phương tiện & Tệp",
    title: "Hình ảnh",
    description: "Tải lên hoặc dán hình ảnh trực quan",
    icon: ImageIcon,
    shortcut: "/image",
  },
  {
    id: "opt-attachment",
    type: "attachment",
    group: "Phương tiện & Tệp",
    title: "Tệp đính kèm",
    description: "Đính kèm tệp PDF, DOCX, bảng tính",
    icon: Paperclip,
    shortcut: "/file",
  },

  // 6. Liên kết & Dấu trang web
  {
    id: "opt-bookmark",
    type: "bookmark",
    group: "Liên kết",
    title: "Dấu trang web",
    description: "Thẻ xem trước trực quan cho liên kết",
    icon: Bookmark,
    shortcut: "/bookmark",
  },
  {
    id: "opt-link",
    type: "link",
    group: "Liên kết",
    title: "Liên kết",
    description: "Đường dẫn liên kết web hoặc tài liệu ngoài",
    icon: Link2,
    shortcut: "/link",
  },

  // 7. Đường phân cách
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

  // Client mounted state for document.body Portal
  const [mounted, setMounted] = React.useState(false);

  // Slash Menu State
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [menuSearchQuery, setMenuSearchQuery] = React.useState("");
  const [menuTargetIndex, setMenuTargetIndex] = React.useState<number | null>(null);
  const [activeMenuIndex, setActiveMenuIndex] = React.useState(0);
  const [menuPlacement, setMenuPlacement] = React.useState<"bottom" | "top">("bottom");
  const [menuMaxHeight, setMenuMaxHeight] = React.useState<number>(320);
  const [menuPosition, setMenuPosition] = React.useState<{
    top?: number;
    bottom?: number;
    left: number;
  } | null>(null);
  const menuAnchorElRef = React.useRef<HTMLElement | null>(null);

  // Multi-Selection State theo convention Notion (Set các block ID được chọn)
  const [selectedBlockIds, setSelectedBlockIds] = React.useState<Set<string>>(new Set());
  const [anchorBlockId, setAnchorBlockId] = React.useState<string | null>(null);

  // Vị trí block được focus gần nhất để chèn file vào đúng ngữ cảnh
  const lastActiveBlockIdRef = React.useRef<string | null>(null);

  // Global window drop overlay state & counter
  const [isGlobalDragging, setIsGlobalDragging] = React.useState(false);
  const dragCounterRef = React.useRef(0);

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
  const lastSavedContentRef = React.useRef<string | null>(initialDescription || null);

  // Gutter drag selection ref (quét chọn nhiều block từ gutter)
  const isGutterSelectingRef = React.useRef(false);
  const gutterAnchorIdRef = React.useRef<string | null>(null);

  // Contextual URL Paste Popover
  const [urlPastePopover, setUrlPastePopover] = React.useState<{
    blockId: string;
    url: string;
    top: number;
    left: number;
  } | null>(null);

  React.useEffect(() => {
    const handleGlobalMouseUp = () => {
      isGutterSelectingRef.current = false;
      gutterAnchorIdRef.current = null;
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, []);

  // Debounced Autosave
  const triggerAutoSave = React.useCallback(
    (newBlocks: NotionBlockItem[]) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(async () => {
        try {
          const payload = serializeBlocksToContent(newBlocks);
          lastSavedContentRef.current = payload;
          await onSaveContent(payload);
        } catch {
          // silent autosave fallback
        }
      }, 800);
    },
    [onSaveContent]
  );

  // Focus tracking cho block đang thao tác (hỗ trợ chèn file đúng vị trí ngữ cảnh)
  const handleBlockFocus = React.useCallback((blockId: string) => {
    lastActiveBlockIdRef.current = blockId;
    setSelectedBlockIds((prev) => (prev.size > 0 ? new Set() : prev));
    setAnchorBlockId(null);
  }, []);

  // Bỏ selection, context menu và dọn sạch block rỗng khi click ra ngoài editor
  React.useEffect(() => {
    const handleGlobalPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSelectedBlockIds((prev) => (prev.size > 0 ? new Set() : prev));
        setAnchorBlockId(null);
        setActiveContextMenu(null);

        // Dọn dẹp bất kỳ block rỗng nào chưa được lưu (trừ trailing block)
        setBlocks((prev) => {
          const meaningful = prev.filter((b) => isMeaningfulBlock(b));
          if (meaningful.length === prev.length) return prev;

          if (meaningful.length === 0) {
            const reset = [{ id: `b-${Date.now()}-1`, type: "text" as const, content: "" }];
            triggerAutoSave(reset);
            return reset;
          }

          triggerAutoSave(meaningful);
          return meaningful;
        });
      }
    };
    window.addEventListener("mousedown", handleGlobalPointerDown);
    return () => window.removeEventListener("mousedown", handleGlobalPointerDown);
  }, [triggerAutoSave]);

  // Đồng bộ khi initialDescription từ server đổi (chỉ khi nội dung bên ngoài thực sự khác và không phải do chính editor vừa lưu)
  React.useEffect(() => {
    if (initialDescription !== lastSavedContentRef.current) {
      lastSavedContentRef.current = initialDescription || null;
      setBlocks(parseContentToBlocks(initialDescription));
    }
  }, [initialDescription]);

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

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Tính toán vị trí và chiều cao tối đa khả dụng cho Slash Menu (Flip + Shift + Dynamic Max-Height)
  const updateSlashMenuPosition = React.useCallback((anchorEl: HTMLElement) => {
    const rect = anchorEl.getBoundingClientRect();
    const COLLISION_PADDING = 14; // Padding an toàn 12-16px với viewport
    const BOTTOM_SAFETY_MARGIN = 16;
    const GAP = 6;
    const ESTIMATED_MENU_WIDTH = 288;
    const PREFERRED_MENU_HEIGHT = 320;
    const MIN_ACCEPTABLE_HEIGHT = 160;

    // Không gian khả dụng phía dưới và phía trên anchor trong viewport
    const spaceBelow = window.innerHeight - rect.bottom - GAP - BOTTOM_SAFETY_MARGIN;
    const spaceAbove = rect.top - GAP - COLLISION_PADDING;

    // 1. Collision-aware positioning:
    // Preferred placement: bottom-start. Nếu không đủ chỗ phía dưới (<250px) và phía trên rộng hơn -> tự động flip sang top-start
    const shouldFlipTop = spaceBelow < 250 && spaceAbove > spaceBelow;
    const placement: "bottom" | "top" = shouldFlipTop ? "top" : "bottom";

    // 2. Dynamic max-height: tính từ không gian thực tế còn lại trong viewport
    let availableHeight: number;
    let top: number | undefined;
    let bottom: number | undefined;

    if (placement === "bottom") {
      availableHeight = Math.max(MIN_ACCEPTABLE_HEIGHT, Math.min(PREFERRED_MENU_HEIGHT, spaceBelow));
      top = rect.bottom + GAP;
    } else {
      availableHeight = Math.max(MIN_ACCEPTABLE_HEIGHT, Math.min(PREFERRED_MENU_HEIGHT, spaceAbove));
      bottom = window.innerHeight - rect.top + GAP;
    }

    // 3. Shift ngang để menu luôn nằm trọn trong viewport (không vượt mép trái hoặc mép phải)
    const menuWidth = Math.min(ESTIMATED_MENU_WIDTH, window.innerWidth - COLLISION_PADDING * 2);
    let left = rect.left;
    const maxLeft = window.innerWidth - menuWidth - COLLISION_PADDING;
    if (left > maxLeft) {
      left = maxLeft;
    }
    if (left < COLLISION_PADDING) {
      left = COLLISION_PADDING;
    }

    setMenuPlacement(placement);
    setMenuMaxHeight(availableHeight);
    setMenuPosition({ top, bottom, left });
  }, []);

  // Lắng nghe scroll và resize để định vị lại menu tức thì khi viewport thay đổi
  React.useEffect(() => {
    if (!isMenuOpen) return;

    const handleViewportChange = () => {
      if (menuAnchorElRef.current) {
        updateSlashMenuPosition(menuAnchorElRef.current);
      }
    };

    window.addEventListener("scroll", handleViewportChange, { passive: true, capture: true });
    window.addEventListener("resize", handleViewportChange, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [isMenuOpen, updateSlashMenuPosition]);

  // Mở Slash Menu với Collision Handling, Flip, Shift & Auto-scroll an toàn
  const handleOpenSlashMenu = (index: number, anchorEl?: HTMLElement | null) => {
    setMenuTargetIndex(index);
    setMenuSearchQuery("");
    setActiveMenuIndex(0);

    if (anchorEl) {
      menuAnchorElRef.current = anchorEl;
      const rect = anchorEl.getBoundingClientRect();
      const COLLISION_PADDING = 14;
      const BOTTOM_SAFETY_MARGIN = 16;
      const GAP = 6;

      const spaceBelow = window.innerHeight - rect.bottom - GAP - BOTTOM_SAFETY_MARGIN;
      const spaceAbove = rect.top - GAP - COLLISION_PADDING;

      // Ưu tiên flip menu lên trên trước nếu phía dưới thiếu chỗ
      const shouldFlipTop = spaceBelow < 250 && spaceAbove > spaceBelow;

      // Auto-scroll page chỉ khi thực sự cần:
      // - Nếu mở xuống nhưng caret nằm quá sát đáy viewport
      // - Nếu mở lên nhưng caret nằm sát mép trên viewport
      if (!shouldFlipTop && rect.bottom > window.innerHeight - 60) {
        anchorEl.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      } else if (shouldFlipTop && rect.top < 40) {
        anchorEl.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }

      updateSlashMenuPosition(anchorEl);
    } else {
      menuAnchorElRef.current = null;
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
    menuAnchorElRef.current = null;
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
      url: option.type === "link" || option.type === "bookmark" || option.type === "image" ? "" : undefined,
      fileName: option.type === "attachment" ? "" : undefined,
      imageWidth: option.type === "image" ? 100 : undefined,
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

  // Xử lý blur khỏi một block: tự động remove block nếu không có dữ liệu thực tế và focus rời khỏi editor
  const handleBlockBlur = (e: React.FocusEvent, blockId: string) => {
    // Nếu focus vẫn nằm trong container của editor hoặc cùng block wrapper -> giữ nguyên để không giật layout
    if (e.relatedTarget && containerRef.current && containerRef.current.contains(e.relatedTarget as Node)) {
      return;
    }

    setBlocks((prev) => {
      const current = prev.find((b) => b.id === blockId);
      if (!current) return prev;

      // Divider luôn giữ
      if (current.type === "divider") return prev;

      // Nếu block rỗng (không có dữ liệu ý nghĩa):
      if (!isMeaningfulBlock(current)) {
        // Nếu đây là block duy nhất trong editor:
        if (prev.length <= 1) {
          if (current.type !== "text" || current.content !== "") {
            const next = [{ id: current.id, type: "text" as const, content: "" }];
            triggerAutoSave(next);
            return next;
          }
          return prev;
        }

        // Tự động remove block rỗng khỏi document
        const next = prev.filter((b) => b.id !== blockId);
        triggerAutoSave(next);
        return next;
      }

      return prev;
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

  // Kéo chuột từ gutter để quét chọn nhiều block (Notion marquee drag selection)
  const handleGutterMouseDown = (e: React.MouseEvent, block: NotionBlockItem) => {
    if (e.button !== 0) return;
    if (e.shiftKey || e.metaKey || e.ctrlKey) return;

    isGutterSelectingRef.current = true;
    gutterAnchorIdRef.current = block.id;
    setAnchorBlockId(block.id);
    setSelectedBlockIds(new Set([block.id]));
  };

  const handleBlockMouseEnter = (blockId: string) => {
    if (isGutterSelectingRef.current && gutterAnchorIdRef.current) {
      const anchorIdx = blocks.findIndex((b) => b.id === gutterAnchorIdRef.current);
      const currentIdx = blocks.findIndex((b) => b.id === blockId);
      if (anchorIdx !== -1 && currentIdx !== -1) {
        const start = Math.min(anchorIdx, currentIdx);
        const end = Math.max(anchorIdx, currentIdx);
        const rangeIds = new Set<string>();
        for (let i = start; i <= end; i++) {
          rangeIds.add(blocks[i].id);
        }
        setSelectedBlockIds(rangeIds);
      }
    }
  };

  // Xử lý nạp file (hỗ trợ nhiều file, mixed ảnh/tài liệu, optimistic preview, chèn thông minh theo ngữ cảnh)
  const handleProcessDroppedFiles = React.useCallback(
    (files: FileList | File[], clientY?: number) => {
      const fileArray = Array.from(files);
      if (fileArray.length === 0) return;

      const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      };

      const isImageFile = (file: File): boolean => {
        if (file.type.startsWith("image/")) return true;
        const ext = file.name.split(".").pop()?.toLowerCase();
        return !!ext && ["png", "jpg", "jpeg", "webp", "gif", "svg", "avif"].includes(ext);
      };

      setBlocks((prev) => {
        // 1. Xác định vị trí chèn theo 3 quy tắc:
        // Quy tắc A: Sau block vừa được focus/thao tác
        let insertIndex = -1;
        if (lastActiveBlockIdRef.current) {
          const activeIdx = prev.findIndex((b) => b.id === lastActiveBlockIdRef.current);
          if (activeIdx !== -1) {
            insertIndex = activeIdx + 1;
          }
        }

        // Quy tắc B: Thả trực tiếp trên editor canvas -> chèn tại block gần tọa độ Y nhất
        if (insertIndex === -1 && typeof clientY === "number") {
          let closestIdx = -1;
          let minDistance = Infinity;
          prev.forEach((b, idx) => {
            const el = blockWrapperRefs.current.get(b.id);
            if (el) {
              const rect = el.getBoundingClientRect();
              const midY = rect.top + rect.height / 2;
              const dist = Math.abs(clientY - midY);
              if (dist < minDistance) {
                minDistance = dist;
                closestIdx = idx;
              }
            }
          });
          if (closestIdx !== -1) {
            insertIndex = closestIdx + 1;
          }
        }

        // Quy tắc C: Chưa focus hoặc thả ngoài canvas (sidebar, header, 2 bên lề) -> chèn vào cuối tài liệu
        if (insertIndex === -1) {
          insertIndex = prev.length;
        }

        // 2. Tạo các block cho từng file, bảo toàn nguyên vẹn thứ tự
        const newBlocks: NotionBlockItem[] = [];
        fileArray.forEach((file, idx) => {
          const blockId = `b-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`;
          const ext = file.name.split(".").pop()?.toUpperCase() || "TỆP";

          if (isImageFile(file)) {
            let objectUrl = "";
            try {
              objectUrl = URL.createObjectURL(file);
            } catch {
              objectUrl = "";
            }

            newBlocks.push({
              id: blockId,
              type: "image",
              content: file.name,
              url: objectUrl,
              imageWidth: 100,
            });

            // Đọc ngầm Data URL để lưu trữ bền vững vào DB
            if (typeof FileReader !== "undefined") {
              const reader = new FileReader();
              reader.onload = (loadEv) => {
                const dataUrl = loadEv.target?.result as string;
                if (dataUrl) {
                  setBlocks((currentBlocks) => {
                    const updated = currentBlocks.map((b) =>
                      b.id === blockId ? { ...b, url: dataUrl } : b
                    );
                    triggerAutoSave(updated);
                    return updated;
                  });
                }
              };
              reader.readAsDataURL(file);
            }
          } else {
            let objectUrl = "";
            try {
              objectUrl = URL.createObjectURL(file);
            } catch {
              objectUrl = "";
            }

            newBlocks.push({
              id: blockId,
              type: "attachment",
              content: file.name,
              fileName: file.name,
              fileSize: formatSize(file.size),
              fileType: ext,
              url: objectUrl,
            });

            // Đọc ngầm file nhỏ (< 5MB) lưu bền vững vào DB
            if (file.size < 5 * 1024 * 1024 && typeof FileReader !== "undefined") {
              const reader = new FileReader();
              reader.onload = (loadEv) => {
                const dataUrl = loadEv.target?.result as string;
                if (dataUrl) {
                  setBlocks((currentBlocks) => {
                    const updated = currentBlocks.map((b) =>
                      b.id === blockId ? { ...b, url: dataUrl } : b
                    );
                    triggerAutoSave(updated);
                    return updated;
                  });
                }
              };
              reader.readAsDataURL(file);
            }
          }
        });

        const next = [...prev];
        const last = next[next.length - 1];
        // Nếu chèn vào cuối và block cuối cùng là text rỗng -> thay thế block rỗng đó
        if (insertIndex >= next.length && last && last.type === "text" && !last.content.trim()) {
          next.splice(next.length - 1, 1, ...newBlocks);
        } else {
          next.splice(insertIndex, 0, ...newBlocks);
        }

        triggerAutoSave(next);
        return next;
      });
    },
    [triggerAutoSave]
  );

  // Global Window Drag & Drop Listeners (To��n bộ viewport nhận file từ OS mà không cần căn trúng editor)
  React.useEffect(() => {
    if (!canEdit) return;

    const hasFiles = (e: DragEvent): boolean => {
      // Tuyệt đối không can thiệp kéo block nội bộ bằng handle 6 chấm
      if (isDraggingRef.current) return false;
      if (!e.dataTransfer) return false;

      const types = Array.from(e.dataTransfer.types || []);
      if (types.includes("Files")) return true;

      if (e.dataTransfer.items) {
        for (let i = 0; i < e.dataTransfer.items.length; i++) {
          if (e.dataTransfer.items[i].kind === "file") return true;
        }
      }
      return false;
    };

    const handleWindowDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragCounterRef.current += 1;
      if (dragCounterRef.current === 1) {
        setIsGlobalDragging(true);
      }
    };

    const handleWindowDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      // Ngăn chặn trình duyệt mở trực tiếp file
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "copy";
      }
    };

    const handleWindowDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragCounterRef.current -= 1;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setIsGlobalDragging(false);
      }
    };

    const handleWindowDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      // Ngăn chặn trình duyệt tự động điều hướng sang file
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsGlobalDragging(false);

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        handleProcessDroppedFiles(files, e.clientY);
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
  }, [canEdit, handleProcessDroppedFiles]);

  // Hỗ trợ Paste ảnh từ clipboard & Paste URL xuất hiện Popover
  const handleContainerPaste = (e: React.ClipboardEvent) => {
    // 1. Kiểm tra clipboard có file ảnh không
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

    // 2. Kiểm tra nếu paste URL vào text input rỗng
    const pastedText = e.clipboardData?.getData("text/plain")?.trim();
    if (pastedText && (pastedText.startsWith("http://") || pastedText.startsWith("https://"))) {
      const activeEl = document.activeElement;
      if (activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement) {
        const isFieldEmpty =
          !activeEl.value.trim() ||
          (activeEl.selectionStart === 0 && activeEl.selectionEnd === activeEl.value.length);
        if (isFieldEmpty) {
          const rect = activeEl.getBoundingClientRect();
          for (const [bId, el] of blockInputRefs.current.entries()) {
            if (el === activeEl) {
              e.preventDefault();
              setUrlPastePopover({
                blockId: bId,
                url: pastedText,
                top: rect.bottom + 4,
                left: Math.max(14, Math.min(rect.left, window.innerWidth - 320)),
              });
              return;
            }
          }
        }
      }
    }
  };

  // Hỗ trợ kéo thả ảnh hoặc tệp vào canvas editor
  const handleContainerDrop = (e: React.DragEvent) => {
    if (isDraggingRef.current) return;

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      handleProcessDroppedFiles(files, e.clientY);
    }
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
      top: Math.min(e.clientY, window.innerHeight - 180),
      left: Math.min(e.clientX, window.innerWidth - 200),
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

    // 2. Phím Esc khi đang edit text:
    // Nếu block hiện tại rỗng (và không phải block text duy nhất): tự động rollback/remove block
    if (e.key === "Escape") {
      e.preventDefault();
      if (!isMeaningfulBlock(block)) {
        if (blocks.length > 1) {
          setBlocks((prev) => {
            const next = prev.filter((b) => b.id !== block.id);
            triggerAutoSave(next);
            return next;
          });
          const targetBlock = blocks[index - 1] || blocks[index + 1];
          if (targetBlock) {
            blockInputRefs.current.get(targetBlock.id)?.focus();
          } else {
            trailingInputRef.current?.focus();
          }
          return;
        }
      }

      // Nếu có nội dung: chuyển current block sang selected
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
      onPaste={handleContainerPaste}
      onDrop={handleContainerDrop}
      onDragOver={(e) => {
        if (!isDraggingRef.current) e.preventDefault();
      }}
      className={cn("w-full relative font-sans text-sm text-foreground", className)}
    >
      {/* 1. Các Blocks Nội Dung (Auto-height, no internal scrollbar, continuous selection group) */}
      <div className="flex flex-col">
        {blocks.map((block, index) => {
          const isDragOver = dragOverIndex === index;
          const isSelected = selectedBlockIds.has(block.id);
          const prevIsSelected = isSelected && index > 0 && selectedBlockIds.has(blocks[index - 1].id);
          const nextIsSelected = isSelected && index < blocks.length - 1 && selectedBlockIds.has(blocks[index + 1].id);

          // Radius thống nhất theo Notion continuous selection group:
          // - Single block: bo 4 góc
          // - Block đầu tiên của dải: bo 2 góc trên
          // - Block cuối cùng của dải: bo 2 góc dưới
          // - Block ở giữa: phẳng hoàn toàn cả trên lẫn dưới
          const selectionRadiusClass = isSelected
            ? !prevIsSelected && !nextIsSelected
              ? "rounded-md"
              : !prevIsSelected && nextIsSelected
              ? "rounded-t-md rounded-b-none"
              : prevIsSelected && !nextIsSelected
              ? "rounded-b-md rounded-t-none"
              : "rounded-none"
            : "rounded-md";

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
              tabIndex={isSelected ? 0 : undefined}
              onKeyDown={(e) => {
                if (isSelected) handleBlockWrapperKeyDown(e, block, index);
              }}
              onContextMenu={(e) => handleContextMenu(e, block)}
              onMouseEnter={() => handleBlockMouseEnter(block.id)}
              onDragOver={(e) => handleDragOver(e, index)}
              className={cn(
                "group/block relative flex items-start -mx-2 px-2 py-0.5 transition-colors duration-75 outline-hidden",
                selectionRadiusClass,
                !isSelected && "hover:bg-muted/30",
                isDragOver && "bg-primary/10",
                isSelected && "bg-primary/[0.08]"
              )}
            >
              {/* Gutter trái: Handle ⋮⋮ (Nằm ngoài selection, không background riêng, không border) */}
              {canEdit && (
                <div
                  onMouseDown={(e) => handleGutterMouseDown(e, block)}
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
                      className="p-0.5 rounded text-muted-foreground/40 hover:text-foreground/80 cursor-grab active:cursor-grabbing transition-colors bg-transparent border-0 outline-hidden"
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
                      onFocus={() => handleBlockFocus(block.id)}
                      onBlur={(e) => handleBlockBlur(e, block.id)}
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
                    onFocus={() => handleBlockFocus(block.id)}
                    onBlur={(e) => handleBlockBlur(e, block.id)}
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
                      onFocus={() => handleBlockFocus(block.id)}
                      onBlur={(e) => handleBlockBlur(e, block.id)}
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
                      onFocus={() => handleBlockFocus(block.id)}
                      onBlur={(e) => handleBlockBlur(e, block.id)}
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
                      onFocus={() => handleBlockFocus(block.id)}
                      onBlur={(e) => handleBlockBlur(e, block.id)}
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
                      onFocus={() => handleBlockFocus(block.id)}
                      onBlur={(e) => handleBlockBlur(e, block.id)}
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
                      onFocus={() => handleBlockFocus(block.id)}
                      onBlur={(e) => handleBlockBlur(e, block.id)}
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

                {/* 9. Image Block (Render trực tiếp hình ảnh, không card, có toolbar & caption) */}
                {block.type === "image" && (
                  <div className="py-1">
                    {!block.url ? (
                      /* Draft Image Upload UI */
                      <div className="flex flex-wrap items-center gap-2 p-2 rounded-xl border border-dashed border-border/80 bg-muted/20 text-xs">
                        <ImageIcon className="size-4 text-primary shrink-0" />
                        <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors cursor-pointer">
                          <UploadCloud className="size-3.5" />
                          <span>Tải ảnh lên</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) {
                                const reader = new FileReader();
                                reader.onload = (loadEv) => {
                                  handleUpdateBlock(block.id, {
                                    url: loadEv.target?.result as string,
                                    content: f.name,
                                    imageWidth: 100,
                                  });
                                };
                                reader.readAsDataURL(f);
                              }
                            }}
                          />
                        </label>
                        <span className="text-muted-foreground/50 text-[11px]">hoặc</span>
                        <input
                          ref={(el) => {
                            if (el) blockInputRefs.current.set(block.id, el);
                            else blockInputRefs.current.delete(block.id);
                          }}
                          type="text"
                          disabled={!canEdit}
                          value={block.url || ""}
                          autoFocus
                          onFocus={() => handleBlockFocus(block.id)}
                          onBlur={(e) => handleBlockBlur(e, block.id)}
                          onChange={(e) => handleUpdateBlock(block.id, { url: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && block.url?.trim()) {
                              e.preventDefault();
                              handleUpdateBlock(block.id, {
                                url: block.url.trim(),
                                content: "Hình ảnh",
                                imageWidth: 100,
                              });
                            }
                            handleBlockKeyDown(e, block, index);
                          }}
                          placeholder="Dán liên kết ảnh và nhấn Enter..."
                          className="flex-1 min-w-[180px] bg-transparent text-xs text-foreground focus:outline-hidden font-mono"
                        />
                      </div>
                    ) : (
                      /* Direct Image Display */
                      <div className="relative group/image my-2 max-w-full">
                        <div
                          style={{ width: `${block.imageWidth || 100}%` }}
                          className="relative mx-auto transition-all duration-150"
                        >
                          <img
                            src={block.url}
                            alt={block.caption || block.content || "Hình ảnh"}
                            className="w-full h-auto max-h-[640px] object-contain rounded-lg select-none"
                            loading="lazy"
                          />

                          {/* Action Toolbar chỉ hiện khi hover/focus */}
                          {canEdit && (
                            <div className="absolute top-2 right-2 flex items-center gap-1 p-1 rounded-lg bg-background/90 backdrop-blur-xs border border-border/80 shadow-md opacity-0 group-hover/image:opacity-100 focus-within:opacity-100 transition-opacity duration-150 z-20">
                              <button
                                type="button"
                                onClick={() => window.open(block.url, "_blank")}
                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                title="Mở ảnh"
                              >
                                <ExternalLink className="size-3.5" />
                              </button>
                              <label
                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-[11px] font-medium px-1.5 cursor-pointer"
                                title="Thay thế ảnh"
                              >
                                Thay thế
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) {
                                      const reader = new FileReader();
                                      reader.onload = (loadEv) => {
                                        handleUpdateBlock(block.id, {
                                          url: loadEv.target?.result as string,
                                          content: f.name,
                                        });
                                      };
                                      reader.readAsDataURL(f);
                                    }
                                  }}
                                />
                              </label>
                              <div className="flex items-center gap-0.5 border-l border-r border-border/60 px-1 mx-0.5 text-[10px] font-mono text-muted-foreground">
                                {([25, 50, 75, 100] as const).map((w) => (
                                  <button
                                    key={w}
                                    type="button"
                                    onClick={() => handleUpdateBlock(block.id, { imageWidth: w })}
                                    className={cn(
                                      "px-1 py-0.5 rounded hover:bg-muted transition-colors cursor-pointer",
                                      (block.imageWidth || 100) === w && "text-primary font-bold bg-primary/10"
                                    )}
                                  >
                                    {w}%
                                  </button>
                                ))}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteBlock(block.id)}
                                className="p-1 rounded hover:bg-rose-50 text-muted-foreground hover:text-rose-600 transition-colors cursor-pointer"
                                title="Xóa ảnh"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Caption dưới ảnh */}
                        <div style={{ width: `${block.imageWidth || 100}%` }} className="mx-auto mt-1">
                          <input
                            type="text"
                            disabled={!canEdit}
                            value={block.caption || ""}
                            onChange={(e) => handleUpdateBlock(block.id, { caption: e.target.value })}
                            placeholder={canEdit ? "Thêm chú thích ảnh..." : undefined}
                            className={cn(
                              "w-full text-center text-xs text-muted-foreground placeholder:text-muted-foreground/30 focus:placeholder:text-muted-foreground/60 bg-transparent focus:outline-hidden py-0.5 transition-colors",
                              !block.caption && !canEdit && "hidden"
                            )}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 10. Attachment Block (Compact File Row: Filename.ext, TYPE · size) */}
                {block.type === "attachment" && (
                  <div className="py-0.5">
                    {!block.fileName && !block.url ? (
                      /* Draft File Input */
                      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-lg bg-muted/40 border border-border/60 text-xs">
                        <Paperclip className="size-3.5 text-primary shrink-0" />
                        <label className="cursor-pointer font-medium text-primary hover:underline">
                          Chọn tệp từ máy
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) {
                                if (f.type.startsWith("image/")) {
                                  const reader = new FileReader();
                                  reader.onload = (loadEv) => {
                                    handleUpdateBlock(block.id, {
                                      type: "image",
                                      url: loadEv.target?.result as string,
                                      content: f.name,
                                      imageWidth: 100,
                                    });
                                  };
                                  reader.readAsDataURL(f);
                                  return;
                                }

                                const ext = f.name.split(".").pop()?.toUpperCase() || "TỆP";
                                const sizeStr = f.size < 1024 * 1024
                                  ? `${(f.size / 1024).toFixed(1)} KB`
                                  : `${(f.size / (1024 * 1024)).toFixed(1)} MB`;
                                handleUpdateBlock(block.id, {
                                  fileName: f.name,
                                  content: f.name,
                                  fileSize: sizeStr,
                                  fileType: ext,
                                  url: URL.createObjectURL(f),
                                });
                              }
                            }}
                          />
                        </label>
                        <span className="text-muted-foreground/40 text-[11px]">hoặc</span>
                        <input
                          ref={(el) => {
                            if (el) blockInputRefs.current.set(block.id, el);
                            else blockInputRefs.current.delete(block.id);
                          }}
                          type="text"
                          disabled={!canEdit}
                          value={block.url || ""}
                          onFocus={() => handleBlockFocus(block.id)}
                          onBlur={(e) => handleBlockBlur(e, block.id)}
                          onChange={(e) => handleUpdateBlock(block.id, { url: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && block.url?.trim()) {
                              e.preventDefault();
                              const name = block.url.split("/").pop() || "Tệp tài liệu";
                              const ext = name.split(".").pop()?.toUpperCase() || "FILE";
                              handleUpdateBlock(block.id, {
                                fileName: name,
                                content: name,
                                fileType: ext,
                                url: block.url.trim(),
                              });
                            }
                            handleBlockKeyDown(e, block, index);
                          }}
                          placeholder="nhập URL tệp..."
                          className="flex-1 min-w-[150px] bg-transparent text-xs text-foreground focus:outline-hidden font-mono"
                        />
                      </div>
                    ) : (
                      /* Compact Document Row */
                      <div className="group/file flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-lg hover:bg-muted/40 transition-colors my-0.5">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="size-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <FileText className="size-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium text-foreground truncate">
                              {block.fileName || block.content || "Tệp tài liệu"}
                            </div>
                            <div className="text-[11px] text-muted-foreground/70 font-mono">
                              {block.fileType || "TỆP"} {block.fileSize ? `· ${block.fileSize}` : ""}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover/file:opacity-100 transition-opacity shrink-0">
                          {block.url && (
                            <a
                              href={block.url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                              title="Mở tệp"
                            >
                              <ExternalLink className="size-3.5" />
                            </a>
                          )}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleDeleteBlock(block.id)}
                              className="p-1 rounded hover:bg-rose-50 text-muted-foreground hover:text-rose-600 transition-colors cursor-pointer"
                              title="Xóa tệp"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 11. Link Mention Block (Gọn gàng 1-2 dòng) */}
                {block.type === "link" && (
                  <div className="py-1">
                    {!block.url ? (
                      /* Draft link input */
                      <div className="flex items-center gap-2 p-1.5 rounded-lg bg-muted/40 border border-border/60 text-xs">
                        <Link2 className="size-3.5 text-primary shrink-0" />
                        <input
                          ref={(el) => {
                            if (el) blockInputRefs.current.set(block.id, el);
                            else blockInputRefs.current.delete(block.id);
                          }}
                          type="text"
                          disabled={!canEdit}
                          value={block.url || ""}
                          autoFocus
                          onFocus={() => handleBlockFocus(block.id)}
                          onBlur={(e) => handleBlockBlur(e, block.id)}
                          onChange={(e) => handleUpdateBlock(block.id, { url: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && block.url?.trim()) {
                              e.preventDefault();
                              const meta = resolveUrlMetadata(block.url);
                              handleUpdateBlock(block.id, {
                                url: meta.url,
                                content: meta.title,
                              });
                            }
                            handleBlockKeyDown(e, block, index);
                          }}
                          placeholder="Dán hoặc nhập URL liên kết (nhấn Enter để tạo)..."
                          className="w-full bg-transparent text-xs text-foreground focus:outline-hidden font-mono"
                        />
                      </div>
                    ) : (
                      /* Compact Mention Row */
                      <div className="group/link flex items-center justify-between gap-2 py-1 px-2 rounded-md hover:bg-muted/40 transition-colors text-xs">
                        <a
                          href={block.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 min-w-0 text-foreground hover:text-primary transition-colors font-medium truncate"
                        >
                          <Globe className="size-3.5 text-primary/70 shrink-0" />
                          <span className="truncate">{block.content || block.url}</span>
                          <span className="text-[11px] text-muted-foreground/60 font-mono shrink-0">
                            ({resolveUrlMetadata(block.url).domain})
                          </span>
                        </a>
                        {canEdit && (
                          <div className="flex items-center gap-1 opacity-0 group-hover/link:opacity-100 transition-opacity shrink-0">
                            <button
                              type="button"
                              onClick={() => window.open(block.url, "_blank")}
                              className="p-1 text-muted-foreground hover:text-foreground rounded cursor-pointer"
                              title="Mở liên kết"
                            >
                              <ExternalLink className="size-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateBlock(block.id, { url: "" })}
                              className="p-1 text-muted-foreground hover:text-foreground rounded text-[10px] cursor-pointer"
                              title="Đổi URL"
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBlock(block.id)}
                              className="p-1 text-muted-foreground hover:text-rose-600 rounded cursor-pointer"
                              title="Xóa"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 12. Bookmark Block (Thẻ xem trước web kiểu Notion) */}
                {block.type === "bookmark" && (
                  <div className="py-1">
                    {!block.url ? (
                      /* Draft bookmark input */
                      <div className="flex items-center gap-2 p-1.5 rounded-lg bg-muted/40 border border-border/60 text-xs">
                        <Bookmark className="size-3.5 text-primary shrink-0" />
                        <input
                          ref={(el) => {
                            if (el) blockInputRefs.current.set(block.id, el);
                            else blockInputRefs.current.delete(block.id);
                          }}
                          type="text"
                          disabled={!canEdit}
                          value={block.url || ""}
                          autoFocus
                          onFocus={() => handleBlockFocus(block.id)}
                          onBlur={(e) => handleBlockBlur(e, block.id)}
                          onChange={(e) => handleUpdateBlock(block.id, { url: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && block.url?.trim()) {
                              e.preventDefault();
                              const meta = resolveUrlMetadata(block.url);
                              handleUpdateBlock(block.id, {
                                url: meta.url,
                                content: meta.title,
                                description: meta.description,
                              });
                            }
                            handleBlockKeyDown(e, block, index);
                          }}
                          placeholder="Dán URL trang web để tạo dấu trang (nhấn Enter)..."
                          className="w-full bg-transparent text-xs text-foreground focus:outline-hidden font-mono"
                        />
                      </div>
                    ) : (
                      /* Visual Bookmark Card */
                      <div className="group/bookmark my-1.5 flex items-stretch justify-between rounded-xl border border-border/60 hover:border-border hover:bg-muted/20 transition-all overflow-hidden text-xs">
                        <a
                          href={block.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 p-3 flex flex-col justify-between min-w-0"
                        >
                          <div className="space-y-1">
                            <div className="font-semibold text-sm text-foreground hover:text-primary transition-colors line-clamp-1">
                              {block.content || resolveUrlMetadata(block.url).title}
                            </div>
                            {block.description && (
                              <p className="text-muted-foreground text-[11px] line-clamp-2 leading-relaxed">
                                {block.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground/70 text-[11px] font-mono mt-2">
                            <Globe className="size-3 text-primary/70 shrink-0" />
                            <span className="truncate">{resolveUrlMetadata(block.url).domain}</span>
                          </div>
                        </a>
                        {canEdit && (
                          <div className="flex flex-col items-center justify-center p-2 opacity-0 group-hover/bookmark:opacity-100 transition-opacity border-l border-border/40 gap-1 bg-background/60 shrink-0">
                            <button
                              type="button"
                              onClick={() => window.open(block.url, "_blank")}
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                              title="Mở liên kết"
                            >
                              <ExternalLink className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBlock(block.id)}
                              className="p-1 rounded hover:bg-rose-50 text-muted-foreground hover:text-rose-600 cursor-pointer"
                              title="Xóa"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
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
                lastActiveBlockIdRef.current = null;
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

      {/* 3. Slash Command Popover Menu qua Portal ra document.body */}
      {isMenuOpen && mounted && typeof document !== "undefined" && createPortal(
        <div
          role="dialog"
          aria-label="Menu lệnh"
          className="fixed inset-0 z-50 pointer-events-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseSlashMenu();
          }}
        >
          <div
            ref={menuPopoverRef}
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
                : "animate-in fade-in-0 slide-in-from-top-2 duration-100"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ô tìm kiếm lệnh (Header cố định) */}
            <div className="relative mb-1.5 shrink-0">
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

            {/* Danh sách lựa chọn - Cuộn nội bộ nếu dài hơn availableHeight */}
            <div ref={menuListRef} className="flex-1 min-h-0 overflow-y-auto space-y-1.5 p-0.5 overscroll-contain">
              {(["Soạn thảo", "Danh sách", "Tiêu đề", "Trích dẫn & Ghi chú", "Phương tiện & Tệp", "Liên kết", "Phân cách"] as const).map((groupName) => {
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
        </div>,
        document.body
      )}

      {/* 4. Context Menu Nâng cao qua Portal ra document.body */}
      {activeContextMenu && mounted && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-50 pointer-events-auto"
          onClick={() => setActiveContextMenu(null)}
        >
          <div
            role="menu"
            style={{
              position: "fixed",
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
      </div>,
      document.body
    )}

      {/* 5. Contextual URL Paste Popover: Dán dưới dạng [Liên kết] [Dấu trang] [Nhúng] */}
      {urlPastePopover && mounted && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-50 pointer-events-auto"
          onClick={() => setUrlPastePopover(null)}
        >
          <div
            style={{
              position: "fixed",
              top: `${urlPastePopover.top}px`,
              left: `${urlPastePopover.left}px`,
            }}
            className="rounded-xl border border-border bg-white p-1.5 text-foreground shadow-xl z-50 animate-in fade-in-0 zoom-in-95 duration-100 text-xs select-none flex items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-muted-foreground px-1 font-medium">Dán dưới dạng:</span>
            <button
              type="button"
              onClick={() => {
                const meta = resolveUrlMetadata(urlPastePopover.url);
                handleUpdateBlock(urlPastePopover.blockId, {
                  type: "link",
                  content: meta.title,
                  url: meta.url,
                });
                setUrlPastePopover(null);
              }}
              className="px-2.5 py-1 rounded-lg hover:bg-muted font-medium text-foreground transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Link2 className="size-3 text-primary" />
              <span>Liên kết</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const meta = resolveUrlMetadata(urlPastePopover.url);
                handleUpdateBlock(urlPastePopover.blockId, {
                  type: "bookmark",
                  content: meta.title,
                  url: meta.url,
                  description: meta.description,
                  favicon: meta.favicon,
                });
                setUrlPastePopover(null);
              }}
              className="px-2.5 py-1 rounded-lg hover:bg-muted font-medium text-foreground transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Bookmark className="size-3 text-primary" />
              <span>Dấu trang</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const meta = resolveUrlMetadata(urlPastePopover.url);
                handleUpdateBlock(urlPastePopover.blockId, {
                  type: "bookmark",
                  content: meta.title,
                  url: meta.url,
                  description: meta.description,
                });
                setUrlPastePopover(null);
              }}
              className="px-2.5 py-1 rounded-lg hover:bg-muted font-medium text-foreground transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Globe className="size-3 text-primary" />
              <span>Nhúng</span>
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* 6. Global File Drop Target Overlay qua Portal ra document.body */}
      {mounted && isGlobalDragging && typeof document !== "undefined" && createPortal(
        <div
          role="presentation"
          data-testid="global-file-drop-overlay"
          className="fixed inset-0 z-50 pointer-events-none flex flex-col items-center justify-center bg-background/80 backdrop-blur-xs transition-all animate-in fade-in duration-150 p-6"
        >
          <div className="flex flex-col items-center gap-3.5 p-8 bg-card/95 shadow-2xl rounded-2xl border-2 border-dashed border-primary/60 max-w-sm text-center transform scale-100 transition-transform">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-xs animate-bounce">
              <UploadCloud className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground tracking-tight">
                Thả để thêm vào nội dung
              </h3>
              <p className="text-xs text-muted-foreground">
                Ảnh, PDF, tài liệu và các tệp khác
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
