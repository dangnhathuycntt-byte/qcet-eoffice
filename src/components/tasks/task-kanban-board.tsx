"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  Circle,
  FolderTree,
  MoreHorizontal,
  ChevronRight,
  X,
  SlidersHorizontal,
  Check,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  SchoolTask,
  StaffTask,
  TaskCategory,
  TaskStatus,
} from "@/types/dashboard";
import type {
  KanbanColumnId,
  DetailedKanbanProjection,
} from "@/contracts/workspace-semantic";
import { cn, getInitials } from "@/lib/utils";
import { triggerHaptic } from "@/lib/haptics";
import { isTaskPastDue, getSystemReferenceDate } from "@/lib/academic-calendar";

// ============================================================================
// Types & Display Settings
// ============================================================================

export type TaskLevelFilter = "ALL" | "TRUONG" | "DON_VI";

export interface KanbanDisplaySettings {
  showAssignee: boolean;     // Avatar + Tên phụ trách (mặc định: bật)
  showDueDate: boolean;      // Hạn hoàn thành (mặc định: bật)
  showParentTask: boolean;   // Nhiệm vụ cha (mặc định: bật)
  showProgress: boolean;     // Tiến độ % (mặc định: tắt)
  showSubtaskCount: boolean; // Số nhiệm vụ con (mặc định: tắt)
  // Các tùy chọn cũ giữ optional để tương thích ngược interface
  showCategory?: boolean;
  showLevel?: boolean;
}

export const DEFAULT_DISPLAY_SETTINGS: KanbanDisplaySettings = {
  showAssignee: true,
  showDueDate: true,
  showParentTask: true,
  showProgress: false,
  showSubtaskCount: false,
};

const DISPLAY_SETTINGS_STORAGE_KEY = "qcet_kanban_display_settings";

function loadDisplaySettings(): KanbanDisplaySettings {
  if (typeof window === "undefined") {
    return { ...DEFAULT_DISPLAY_SETTINGS, showProgress: false };
  }
  try {
    const stored = localStorage.getItem(DISPLAY_SETTINGS_STORAGE_KEY);
    if (!stored) return DEFAULT_DISPLAY_SETTINGS;
    return { ...DEFAULT_DISPLAY_SETTINGS, ...JSON.parse(stored), showProgress: false };
  } catch {
    return DEFAULT_DISPLAY_SETTINGS;
  }
}

function saveDisplaySettings(settings: KanbanDisplaySettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DISPLAY_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Silently ignore storage quota errors
  }
}

// ============================================================================
// Column Config (Minimal flat style — no container accents)
// ============================================================================

export interface KanbanColumnConfig {
  id: TaskStatus;
  title: string;
  label: string;
  emoji?: string;
  dotColor: string;
  iconColor: string;
}

export const KANBAN_COLUMNS: KanbanColumnConfig[] = [
  {
    id: "NEW",
    title: "Mới / Tiếp nhận",
    label: "Mới / Tiếp nhận",
    emoji: "",
    dotColor: "bg-muted-foreground/60",
    iconColor: "text-muted-foreground",
  },
  {
    id: "IN_PROGRESS",
    title: "Đang thực hiện",
    label: "Đang thực hiện",
    emoji: "",
    dotColor: "bg-blue-500",
    iconColor: "text-blue-500",
  },
  {
    id: "NEEDS_REVIEW",
    title: "Cần chỉnh sửa",
    label: "Cần chỉnh sửa",
    emoji: "",
    dotColor: "bg-amber-500",
    iconColor: "text-amber-500",
  },
  {
    id: "COMPLETED",
    title: "Hoàn thành",
    label: "Hoàn thành",
    emoji: "",
    dotColor: "bg-emerald-500",
    iconColor: "text-emerald-500",
  },
];

const COLUMN_ICONS: Record<
  TaskStatus,
  React.ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  NEW: Circle,
  NOT_STARTED: Circle,
  IN_PROGRESS: Clock,
  WAITING_APPROVAL: Clock,
  PENDING_EXECUTIVE_APPROVAL: Clock,
  NEEDS_REVIEW: AlertCircle,
  BLOCKED: AlertTriangle,
  COMPLETED: CheckCircle2,
  OVERDUE: AlertCircle,
  CANCELLED: AlertTriangle,
};

export interface KanbanItem {
  id: string;
  title: string;
  level: "TRUONG" | "DON_VI";
  status: TaskStatus;
  category: TaskCategory;
  categoryLabel: string;
  assigneeName: string;
  assigneeAvatar?: string;
  coAssignees?: string[];
  dueDate: string;
  assignedDate?: string;
  progressPercent?: number;
  totalSubTasks?: number;
  completedSubTasks?: number;
  parentSchoolTaskId?: string;
  parentSchoolTaskTitle?: string;
  rawTask: SchoolTask | StaffTask;
}

const STATUS_ORDER: TaskStatus[] = [
  "NEW",
  "IN_PROGRESS",
  "NEEDS_REVIEW",
  "COMPLETED",
];

// ============================================================================
// Status Mapping & Helpers
// ============================================================================

/**
 * Canonical mapping from database/operational status to one of the 4 Kanban columns.
 * Conforms to src/contracts/workspace-semantic.ts:
 * - NOT_STARTED, NEW -> NEW
 * - IN_PROGRESS, OVERDUE, BLOCKED -> IN_PROGRESS
 * - WAITING_APPROVAL, PENDING_EXECUTIVE_APPROVAL, NEEDS_REVIEW -> NEEDS_REVIEW
 * - COMPLETED -> COMPLETED
 */
export function mapTaskStatusToKanbanColumn(status?: string): TaskStatus {
  if (!status) return "NEW";
  const s = status.toUpperCase();
  switch (s) {
    case "NEW":
    case "NOT_STARTED":
      return "NEW";
    case "IN_PROGRESS":
    case "OVERDUE":
    case "BLOCKED":
      return "IN_PROGRESS";
    case "NEEDS_REVIEW":
    case "WAITING_APPROVAL":
    case "PENDING_EXECUTIVE_APPROVAL":
      return "NEEDS_REVIEW";
    case "COMPLETED":
    case "CANCELLED":
    case "CANCELED":
    case "ARCHIVED":
      return "COMPLETED";
    default:
      return "IN_PROGRESS";
  }
}

export function getNextStatus(status: TaskStatus): TaskStatus | null {
  const colId = mapTaskStatusToKanbanColumn(status);
  const index = STATUS_ORDER.indexOf(colId);
  if (index === -1 || index >= STATUS_ORDER.length - 1) return null;
  return STATUS_ORDER[index + 1];
}

export function getPrevStatus(status: TaskStatus): TaskStatus | null {
  const colId = mapTaskStatusToKanbanColumn(status);
  const index = STATUS_ORDER.indexOf(colId);
  if (index <= 0) return null;
  return STATUS_ORDER[index - 1];
}

export interface MenuPositionResult {
  top: number;
  left: number;
  placement: "top" | "bottom";
}

/**
 * Calculates collision-aware fixed viewport coordinates for portal action menus.
 */
export function calculateMenuPosition(
  triggerRect: { top: number; bottom: number; left: number; right: number },
  viewport: { width: number; height: number },
  menuSize = { width: 192, height: 180 },
  gap = 4,
  margin = 8
): MenuPositionResult {
  const spaceBelow = viewport.height - triggerRect.bottom - gap - margin;
  const spaceAbove = triggerRect.top - gap - margin;
  const placeAbove = spaceBelow < menuSize.height && spaceAbove >= spaceBelow;

  let top: number;
  let placement: "top" | "bottom";
  if (placeAbove) {
    top = Math.max(margin, triggerRect.top - menuSize.height - gap);
    placement = "top";
  } else {
    top = Math.min(
      triggerRect.bottom + gap,
      Math.max(margin, viewport.height - menuSize.height - margin)
    );
    placement = "bottom";
  }

  const preferredLeft = triggerRect.right - menuSize.width;
  const left = Math.max(margin, Math.min(preferredLeft, viewport.width - menuSize.width - margin));

  return { top, left, placement };
}

export interface KanbanTransitionState {
  pendingTaskIds: Record<string, boolean>;
  optimisticStatuses: Record<string, TaskStatus>;
  taskErrors: Record<string, string | null>;
  lastAttemptedStatuses?: Record<string, TaskStatus | null>;
}

/**
 * Executes status transition with double-invocation prevention, optimistic update,
 * and rollback with Vietnamese error message on failure.
 */
export async function executeKanbanStatusTransition(
  taskId: string,
  newStatus: TaskStatus,
  currentStatus: TaskStatus,
  state: KanbanTransitionState,
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => Promise<unknown> | void
): Promise<{
  state: KanbanTransitionState;
  ok: boolean;
  error?: string;
}> {
  if (state.pendingTaskIds[taskId]) {
    return { state, ok: false, error: "Thao tác đang xử lý, vui lòng chờ." };
  }

  if (currentStatus === newStatus) {
    return { state, ok: true };
  }

  const pendingState: KanbanTransitionState = {
    pendingTaskIds: { ...state.pendingTaskIds, [taskId]: true },
    optimisticStatuses: { ...state.optimisticStatuses, [taskId]: newStatus },
    taskErrors: { ...state.taskErrors, [taskId]: null },
    lastAttemptedStatuses: { ...state.lastAttemptedStatuses },
  };

  try {
    const result = await Promise.resolve(onStatusChange?.(taskId, newStatus));
    if (
      result &&
      typeof result === "object" &&
      "success" in result &&
      !(result as { success: boolean }).success
    ) {
      throw new Error((result as { error?: string }).error || "Cập nhật trạng thái thất bại.");
    }
    const { [taskId]: _, ...remainingPending } = pendingState.pendingTaskIds;
    const { [taskId]: _err, ...remainingErrors } = pendingState.taskErrors;
    const { [taskId]: _las, ...remainingLastAttempted } = pendingState.lastAttemptedStatuses ?? {};
    return {
      state: {
        ...pendingState,
        pendingTaskIds: remainingPending,
        taskErrors: remainingErrors,
        lastAttemptedStatuses: remainingLastAttempted,
      },
      ok: true,
    };
  } catch (err: unknown) {
    const { [taskId]: _opt, ...remainingOptimistic } = pendingState.optimisticStatuses;
    const { [taskId]: _pend, ...remainingPending } = pendingState.pendingTaskIds;
    const errorMessage =
      err instanceof Error && err.message
        ? err.message
        : "Cập nhật trạng thái thất bại. Vui lòng thử lại.";

    return {
      state: {
        pendingTaskIds: remainingPending,
        optimisticStatuses: remainingOptimistic,
        taskErrors: {
          ...pendingState.taskErrors,
          [taskId]: errorMessage,
        },
        lastAttemptedStatuses: {
          ...pendingState.lastAttemptedStatuses,
          [taskId]: newStatus,
        },
      },
      ok: false,
      error: errorMessage,
    };
  }
}

/**
 * Overrides task statuses with optimistic in-flight values without mutating other fields.
 */
export function applyOptimisticOverrides(
  tasks: SchoolTask[],
  optimisticStatuses: Record<string, TaskStatus>
): SchoolTask[] {
  if (Object.keys(optimisticStatuses).length === 0) return tasks;
  return tasks.map((st) => {
    const parentStatus = optimisticStatuses[st.id] ?? (st.status as TaskStatus);
    const updatedSubTasks = st.subTasks?.map((sub) => {
      const subStatus = optimisticStatuses[sub.id] ?? sub.status;
      return subStatus !== sub.status ? { ...sub, status: subStatus } : sub;
    });
    return {
      ...st,
      status: parentStatus,
      subTasks: updatedSubTasks,
    };
  });
}

/**
 * Extracts and flattens all SchoolTasks and their StaffTasks into unified KanbanItems.
 */
export function extractKanbanItems(schoolTasks: SchoolTask[]): KanbanItem[] {
  const items: KanbanItem[] = [];

  for (const st of schoolTasks) {
    items.push({
      id: st.id,
      title: st.title,
      level: "TRUONG",
      status: st.status as TaskStatus,
      category: st.category,
      categoryLabel: st.categoryLabel || st.category,
      assigneeName: st.leadAssigneeName,
      assigneeAvatar: st.leadAssigneeAvatar,
      coAssignees: st.coAssignees,
      dueDate: st.dueDate,
      assignedDate: st.assignedDate,
      progressPercent: st.progressPercent,
      totalSubTasks: st.totalSubTasks,
      completedSubTasks: st.completedSubTasks,
      rawTask: st,
    });

    if (st.subTasks && st.subTasks.length > 0) {
      for (const sub of st.subTasks) {
        items.push({
          id: sub.id,
          title: sub.title,
          level: "DON_VI",
          status: sub.status,
          category: st.category,
          categoryLabel: st.categoryLabel || st.category,
          assigneeName: sub.assigneeName,
          assigneeAvatar: sub.assigneeAvatar,
          dueDate: sub.dueDate,
          progressPercent: sub.progressPercent,
          parentSchoolTaskId: st.id,
          parentSchoolTaskTitle: st.title,
          rawTask: sub,
        });
      }
    }
  }

  return items;
}

export function filterKanbanItems(
  tasks: SchoolTask[],
  levelFilter: TaskLevelFilter = "ALL",
  categoryFilter: TaskCategory | "ALL" = "ALL",
  searchQuery = ""
): KanbanItem[] {
  const allItems = extractKanbanItems(tasks);
  const q = searchQuery.toLowerCase().trim();

  return allItems.filter((item) => {
    if (levelFilter !== "ALL" && item.level !== levelFilter) {
      return false;
    }
    if (categoryFilter !== "ALL" && item.category !== categoryFilter) {
      return false;
    }
    if (q) {
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchAssignee = item.assigneeName?.toLowerCase().includes(q) ?? false;
      const matchCategory = item.categoryLabel?.toLowerCase().includes(q) ?? false;
      const matchParent = item.parentSchoolTaskTitle?.toLowerCase().includes(q) ?? false;
      if (!matchTitle && !matchAssignee && !matchCategory && !matchParent) {
        return false;
      }
    }
    return true;
  });
}

export function groupTasksByStatus(
  tasks: SchoolTask[],
  levelFilter: TaskLevelFilter = "ALL",
  categoryFilter: TaskCategory | "ALL" = "ALL",
  searchQuery = ""
): Record<TaskStatus, KanbanItem[]> {
  const filtered = filterKanbanItems(tasks, levelFilter, categoryFilter, searchQuery);

  const grouped: Record<TaskStatus, KanbanItem[]> = {
    NEW: [],
    NOT_STARTED: [],
    IN_PROGRESS: [],
    WAITING_APPROVAL: [],
    PENDING_EXECUTIVE_APPROVAL: [],
    NEEDS_REVIEW: [],
    BLOCKED: [],
    COMPLETED: [],
    OVERDUE: [],
    CANCELLED: [],
  };

  for (const item of filtered) {
    const rawStatus = item.status;
    const upperStatus = (rawStatus || "").toUpperCase() as TaskStatus;

    if (grouped[upperStatus]) {
      grouped[upperStatus].push(item);
    }

    const colId = mapTaskStatusToKanbanColumn(rawStatus);

    if (upperStatus === "CANCELLED" || (upperStatus as string) === "CANCELED" || (upperStatus as string) === "ARCHIVED") {
      continue;
    }

    if (upperStatus !== colId) {
      grouped[colId].push(item);
    }
  }

  return grouped;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}`;
  } catch {
    return dateStr;
  }
}

function isOverdue(dueDateStr?: string, status?: TaskStatus, referenceDate: string = getSystemReferenceDate()): boolean {
  if (!dueDateStr || status === "COMPLETED" || status === "CANCELLED") return false;
  return isTaskPastDue(dueDateStr, referenceDate);
}

const STATUS_LABELS: Record<string, string> = {
  NEW: "Tiếp nhận",
  IN_PROGRESS: "Đang làm",
  NEEDS_REVIEW: "Chờ duyệt",
  COMPLETED: "Hoàn thành",
};

// ============================================================================
// Kanban Card (Minimal flat style)
// ============================================================================

interface KanbanCardProps {
  item: KanbanItem;
  displaySettings?: KanbanDisplaySettings;
  isPending?: boolean;
  errorMessage?: string | null;
  lastAttemptedStatus?: TaskStatus | null;
  onSelectTask?: (task: SchoolTask | StaffTask) => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => Promise<unknown> | void;
  isDragOverlay?: boolean;
}

function KanbanCard({
  item,
  displaySettings = DEFAULT_DISPLAY_SETTINGS,
  isPending = false,
  errorMessage = null,
  lastAttemptedStatus = null,
  onSelectTask,
  onStatusChange,
  isDragOverlay = false,
}: KanbanCardProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [statusSubmenuOpen, setStatusSubmenuOpen] = React.useState(false);
  const [menuCoords, setMenuCoords] = React.useState<MenuPositionResult | null>(null);
  const [mounted, setMounted] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const overdue = isOverdue(item.dueDate, item.status) || item.status === "OVERDUE";

  const updateCoords = React.useCallback(() => {
    if (!triggerRef.current || typeof window === "undefined") return;
    const rect = triggerRef.current.getBoundingClientRect();
    const estimatedHeight = statusSubmenuOpen ? 240 : 140;
    const coords = calculateMenuPosition(
      rect,
      { width: window.innerWidth, height: window.innerHeight },
      { width: 192, height: estimatedHeight }
    );
    setMenuCoords(coords);
  }, [statusSubmenuOpen]);

  React.useEffect(() => {
    if (!menuOpen) return;
    updateCoords();
    window.addEventListener("scroll", updateCoords, true);
    window.addEventListener("resize", updateCoords);
    return () => {
      window.removeEventListener("scroll", updateCoords, true);
      window.removeEventListener("resize", updateCoords);
    };
  }, [menuOpen, updateCoords]);

  React.useEffect(() => {
    if (!menuOpen) return;
    function handleOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setMenuOpen(false);
        setStatusSubmenuOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setStatusSubmenuOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  function handleCardClick() {
    onSelectTask?.(item.rawTask);
  }

  function handleMenuToggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (isPending) return;
    setMenuOpen((prev) => !prev);
    setStatusSubmenuOpen(false);
  }

  async function handleStatusChange(newStatus: TaskStatus) {
    if (isPending) return;
    triggerHaptic("selection");
    setMenuOpen(false);
    setStatusSubmenuOpen(false);
    await onStatusChange?.(item.id, newStatus);
  }

  function handleOpenDetail(e: React.MouseEvent) {
    e.stopPropagation();
    onSelectTask?.(item.rawTask);
    setMenuOpen(false);
  }

  return (
    <div
      onClick={handleCardClick}
      aria-busy={isPending}
      data-slot="kanban-card"
      className={cn(
        "group/card relative flex flex-col gap-1.5 rounded-[8px] border border-border/50 bg-card p-2.5 text-card-foreground transition-all duration-100 cursor-pointer select-none",
        "hover:bg-accent/40 hover:border-border/80 active:bg-accent/60",
        isPending && "opacity-70 pointer-events-none",
        isDragOverlay && "shadow-lg border-border rotate-[1.5deg] scale-[1.02] bg-card opacity-95 cursor-grabbing"
      )}
    >
      {/* Row 1: Optional Parent Breadcrumb */}
      {displaySettings.showParentTask && item.parentSchoolTaskTitle && (
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground/70 line-clamp-1">
          <FolderTree strokeWidth={1.5} className="size-2.5 shrink-0 text-muted-foreground/50" />
          <span className="truncate">{item.parentSchoolTaskTitle}</span>
        </div>
      )}

      {/* Row 2: Title + Action Trigger */}
      <div className="flex items-start justify-between gap-1.5">
        <h4 className="text-[13px] font-medium text-foreground leading-snug line-clamp-2 group-hover/card:text-primary transition-colors flex-1 min-w-0">
          {item.title}
        </h4>

        {/* Action Menu Trigger (Visible on hover or when open) */}
        {!isDragOverlay && (
          <div className="relative shrink-0 -mr-1 -mt-0.5">
            <button
              ref={triggerRef}
              type="button"
              onClick={handleMenuToggle}
              aria-label="Thao tác"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              disabled={isPending}
              data-slot="kanban-action-menu-trigger"
              data-actions="status-transition"
              className={cn(
                "size-6 min-h-[44px] sm:min-h-[24px] flex items-center justify-center rounded text-muted-foreground/60 hover:bg-muted hover:text-foreground transition-all cursor-pointer touch-manipulation",
                menuOpen ? "opacity-100 bg-muted text-foreground" : "opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100"
              )}
            >
              <MoreHorizontal strokeWidth={1.5} className="size-3.5" />
            </button>

            {/* Action Menu Popover Portal */}
            {mounted && menuOpen && menuCoords && typeof document !== "undefined" && createPortal(
              <div
                ref={menuRef}
                role="menu"
                data-slot="kanban-action-menu"
                aria-label="Thao tác nhiệm vụ"
                style={{
                  position: "fixed",
                  top: `${menuCoords.top}px`,
                  left: `${menuCoords.left}px`,
                  zIndex: 9999,
                }}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    setMenuOpen(false);
                    setStatusSubmenuOpen(false);
                    triggerRef.current?.focus();
                  } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    e.stopPropagation();
                    const items = Array.from(
                      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') || []
                    );
                    if (items.length === 0) return;
                    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
                    const nextIndex =
                      e.key === "ArrowDown"
                        ? (currentIndex + 1) % items.length
                        : (currentIndex - 1 + items.length) % items.length;
                    items[nextIndex]?.focus();
                  }
                }}
                className="w-44 rounded-lg border border-border/80 bg-popover shadow-md py-1 animate-in fade-in-0 zoom-in-95 duration-75 text-xs text-popover-foreground"
              >
                <button
                  type="button"
                  role="menuitem"
                  autoFocus
                  onClick={handleOpenDetail}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-muted/60 transition-colors cursor-pointer text-left"
                >
                  Mở chi tiết
                </button>

                <div className="h-px bg-border/40 mx-2 my-0.5" />

                <button
                  type="button"
                  role="menuitem"
                  aria-label="Chuyển trạng thái"
                  aria-expanded={statusSubmenuOpen}
                  onClick={(e) => {
                    e.stopPropagation();
                    setStatusSubmenuOpen((prev) => !prev);
                  }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                >
                  <span>Chuyển trạng thái</span>
                  <ChevronRight
                    strokeWidth={1.5}
                    className={cn(
                      "size-3 text-muted-foreground transition-transform",
                      statusSubmenuOpen && "rotate-90"
                    )}
                  />
                </button>

                {statusSubmenuOpen && (
                  <div className="px-1 py-1 space-y-0.5 bg-muted/20 border-y border-border/40">
                    {KANBAN_COLUMNS.map((col) => {
                      const isCurrent = mapTaskStatusToKanbanColumn(item.status) === col.id;
                      return (
                        <button
                          key={col.id}
                          type="button"
                          role="menuitem"
                          disabled={isCurrent || isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatusChange(col.id);
                          }}
                          className={cn(
                            "w-full flex items-center gap-2 px-2.5 py-1 text-xs rounded transition-colors cursor-pointer text-left",
                            isCurrent
                              ? "text-primary font-medium cursor-default bg-primary/10"
                              : "text-foreground hover:bg-muted/60"
                          )}
                        >
                          <span className={cn("size-1.5 rounded-full shrink-0", col.dotColor)} />
                          <span>{STATUS_LABELS[col.id] ?? col.title}</span>
                          {isCurrent && <span className="ml-auto text-primary font-bold">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="h-px bg-border/40 mx-2 my-0.5" />

                <button
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    setStatusSubmenuOpen(false);
                    triggerRef.current?.focus();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/60 transition-colors cursor-pointer text-left"
                >
                  <X strokeWidth={1.5} className="size-3" />
                  Đóng
                </button>
              </div>,
              document.body
            )}
          </div>
        )}
      </div>

      {/* Pending / Error State Feedback */}
      {isPending && (
        <div className="flex items-center gap-1.5 text-[11px] text-primary font-medium bg-primary/5 px-1.5 py-0.5 rounded">
          <Clock className="size-3 animate-spin shrink-0" />
          <span>Đang cập nhật…</span>
        </div>
      )}
      {errorMessage && (
        <div className="flex items-center gap-1.5 text-[11px] text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
          <AlertCircle className="size-3 shrink-0" />
          <span className="truncate flex-1">{errorMessage}</span>
          {lastAttemptedStatus && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStatusChange?.(item.id, lastAttemptedStatus);
              }}
              className="shrink-0 underline underline-offset-2 hover:no-underline cursor-pointer"
            >
              Thử lại
            </button>
          )}
        </div>
      )}

      {/* Row 3: Compact Metadata (Priority: Assignee + Due Date + Category) */}
      <div className="flex items-center justify-between gap-1.5 pt-0.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {/* Assignee Avatar & Name - Full available width, no premature truncation */}
          {displaySettings.showAssignee && (
            <div className="flex items-center gap-1.5 min-w-0 flex-1" title={item.assigneeName}>
              {item.assigneeAvatar ? (
                <img
                  src={item.assigneeAvatar}
                  alt={item.assigneeName}
                  className="size-[18px] rounded-full object-cover shrink-0 ring-1 ring-border/40"
                />
              ) : (
                <span className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-medium text-muted-foreground border border-border/60">
                  {getInitials(item.assigneeName)}
                </span>
              )}
              <span className="truncate text-[11px] font-normal text-muted-foreground">
                {item.assigneeName || "Chưa giao"}
              </span>
            </div>
          )}
        </div>

        {/* Due Date & Subtasks Count */}
        <div className="flex items-center gap-1.5 shrink-0">
          {displaySettings.showSubtaskCount && item.totalSubTasks !== undefined && item.totalSubTasks > 0 && (
            <span className="text-[10px] font-mono tabular-nums text-muted-foreground/70" title="Nhiệm vụ con hoàn thành">
              {item.completedSubTasks ?? 0}/{item.totalSubTasks}
            </span>
          )}

          {displaySettings.showDueDate && item.dueDate && (
            <div
              className={cn(
                "flex items-center gap-1 text-[11px] font-mono tabular-nums",
                overdue ? "text-destructive font-semibold" : "text-muted-foreground/70"
              )}
              title={overdue ? `Quá hạn: ${formatDate(item.dueDate)}` : `Hạn: ${formatDate(item.dueDate)}`}
            >
              <Calendar strokeWidth={1.5} className="size-3 shrink-0" />
              <span>Hạn {formatDate(item.dueDate)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Sortable Wrapper for KanbanCard
// ============================================================================

interface SortableKanbanCardProps extends KanbanCardProps {
  id: string;
}

function SortableKanbanCard({ id, ...cardProps }: SortableKanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    data: {
      type: "card",
      item: cardProps.item,
    },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    touchAction: "pan-y",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-pan-y">
      <KanbanCard {...cardProps} />
    </div>
  );
}

// ============================================================================
// Droppable Column Component
// ============================================================================

interface DroppableColumnProps {
  col: KanbanColumnConfig;
  tasks: KanbanItem[];
  displaySettings: KanbanDisplaySettings;
  transitionState: KanbanTransitionState;
  onSelectTask?: (task: SchoolTask | StaffTask) => void;
  onStatusChangeInternal: (taskId: string, newStatus: TaskStatus) => Promise<void>;
  onAddTask?: (initialLevel?: "TRUONG" | "DON_VI", initialParentTaskId?: string) => void;
  colLimit: number;
  onIncreaseLimit: () => void;
}

function DroppableColumn({
  col,
  tasks,
  displaySettings,
  transitionState,
  onSelectTask,
  onStatusChangeInternal,
  onAddTask,
  colLimit,
  onIncreaseLimit,
}: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: col.id,
    data: {
      type: "column",
      status: col.id,
    },
  });

  const IconComponent = COLUMN_ICONS[col.id] || Circle;
  const count = tasks.length;
  const displayedTasks = tasks.slice(0, colLimit);
  const taskIds = React.useMemo(() => tasks.map((t) => t.id), [tasks]);

  return (
    <div
      ref={setNodeRef}
      data-slot="kanban-column"
      data-status={col.id}
      className={cn(
        "w-[280px] xl:w-full flex-1 min-w-[270px] flex flex-col h-full min-h-0 group/col select-none transition-colors duration-150 rounded-lg",
        isOver && "bg-accent/25 ring-1 ring-primary/20"
      )}
    >
      {/* Column Header (Compact: icon + name + count, hover: "..." & "+") */}
      <div className="flex items-center justify-between h-8 px-1 mb-1.5 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <IconComponent
            strokeWidth={1.5}
            className={cn("size-3.5 shrink-0", col.iconColor)}
          />
          <h3 className="text-[13px] font-medium text-foreground tracking-tight truncate">
            {col.title}
          </h3>
          <span className="text-[11px] font-mono tabular-nums text-muted-foreground/70 ml-0.5">
            {count}
          </span>
        </div>

        <div className="flex items-center gap-0.5 opacity-0 group-hover/col:opacity-100 transition-opacity">
          {onAddTask && (
            <button
              type="button"
              onClick={() => onAddTask()}
              title={`Thêm công việc vào ${col.title}`}
              aria-label={`Thêm công việc vào ${col.title}`}
              className="size-6 flex items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            >
              <Plus strokeWidth={1.5} className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Column Cards Container (Independent Smooth Vertical Scroll) */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1.5 thin-scrollbar overscroll-contain pb-6">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {displayedTasks.map((item) => (
            <SortableKanbanCard
              key={item.id}
              id={item.id}
              item={item}
              displaySettings={displaySettings}
              isPending={Boolean(transitionState.pendingTaskIds[item.id])}
              errorMessage={transitionState.taskErrors[item.id]}
              lastAttemptedStatus={transitionState.lastAttemptedStatuses?.[item.id] ?? null}
              onSelectTask={onSelectTask}
              onStatusChange={onStatusChangeInternal}
            />
          ))}
        </SortableContext>

        {/* Minimal empty state: single lightweight "+" button */}
        {tasks.length === 0 && (
          <button
            type="button"
            onClick={() => onAddTask?.()}
            className="w-full py-3 flex items-center justify-center rounded-lg border border-dashed border-border/50 text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent/30 hover:border-border transition-colors cursor-pointer group/empty"
          >
            <Plus strokeWidth={1.5} className="size-3.5 group-hover/empty:scale-110 transition-transform" />
          </button>
        )}

        {/* Load More Affordance */}
        {tasks.length > colLimit && (
          <button
            type="button"
            onClick={onIncreaseLimit}
            className="w-full py-1.5 px-2 text-[11px] font-medium font-mono tabular-nums rounded border border-border/50 bg-card hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors cursor-pointer text-center"
          >
            + {Math.min(30, tasks.length - colLimit)} việc nữa ({tasks.length - colLimit})
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Display Settings Popover Component
// ============================================================================

interface DisplaySettingsPopoverProps {
  settings: KanbanDisplaySettings;
  onToggle: (key: keyof KanbanDisplaySettings) => void;
}

function DisplaySettingsPopover({ settings, onToggle }: DisplaySettingsPopoverProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const toggleOptions: { key: keyof KanbanDisplaySettings; label: string }[] = [
    { key: "showAssignee", label: "Người phụ trách" },
    { key: "showDueDate", label: "Thời hạn" },
    { key: "showParentTask", label: "Nhiệm vụ cha" },
    { key: "showSubtaskCount", label: "Số lượng nhiệm vụ con" },
  ];

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        title="Tùy chọn hiển thị thẻ"
        aria-label="Tùy chọn hiển thị thẻ"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-xs font-medium border transition-colors cursor-pointer",
          isOpen
            ? "bg-accent text-foreground border-border"
            : "bg-background text-muted-foreground border-border/60 hover:text-foreground hover:bg-muted"
        )}
      >
        <SlidersHorizontal strokeWidth={1.5} className="size-3" />
        <span className="hidden sm:inline text-[11px]">Hiển thị thẻ</span>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Tùy chọn hiển thị"
          className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg border border-border/80 bg-popover p-1.5 shadow-lg animate-in fade-in-0 zoom-in-95 duration-75 text-xs text-popover-foreground"
        >
          <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground border-b border-border/40 mb-1">
            Hiển thị trên thẻ
          </div>
          <div className="space-y-0.5">
            {toggleOptions.map((opt) => {
              const active = settings[opt.key];
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => onToggle(opt.key)}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-xs rounded hover:bg-accent/60 transition-colors cursor-pointer text-left"
                >
                  <span className={cn(active ? "text-foreground font-medium" : "text-muted-foreground")}>
                    {opt.label}
                  </span>
                  {active && <Check strokeWidth={1.5} className="size-3.5 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Kanban Board Component
// ============================================================================

export interface TaskKanbanBoardProps {
  tasks: SchoolTask[];
  onSelectTask?: (task: SchoolTask | StaffTask) => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => Promise<unknown> | void;
  onAddTask?: (
    initialLevel?: "TRUONG" | "DON_VI",
    initialParentTaskId?: string
  ) => void;
  levelFilter?: TaskLevelFilter;
  categoryFilter?: TaskCategory | "ALL";
  searchQuery?: string;
  className?: string;
  displaySettings?: KanbanDisplaySettings;
  onDisplaySettingsChange?: (settings: KanbanDisplaySettings) => void;
}

export function TaskKanbanBoard({
  tasks,
  onSelectTask,
  onStatusChange,
  onAddTask,
  levelFilter = "ALL",
  categoryFilter = "ALL",
  searchQuery = "",
  className,
  displaySettings: controlledSettings,
  onDisplaySettingsChange,
}: TaskKanbanBoardProps) {
  const deferredSearchQuery = React.useDeferredValue(searchQuery);

  // Transition and optimistic state
  const [transitionState, setTransitionState] = React.useState<KanbanTransitionState>({
    pendingTaskIds: {},
    optimisticStatuses: {},
    taskErrors: {},
    lastAttemptedStatuses: {},
  });
  const transitionStateRef = React.useRef(transitionState);
  transitionStateRef.current = transitionState;

  // Display settings state (with localStorage persistence)
  const [internalDisplaySettings, setInternalDisplaySettings] = React.useState<KanbanDisplaySettings>(() =>
    loadDisplaySettings()
  );

  const displaySettings = controlledSettings ?? internalDisplaySettings;

  const handleToggleDisplaySetting = (key: keyof KanbanDisplaySettings) => {
    const updated = {
      ...displaySettings,
      [key]: !displaySettings[key],
    };
    if (!controlledSettings) {
      setInternalDisplaySettings(updated);
      saveDisplaySettings(updated);
    }
    onDisplaySettingsChange?.(updated);
  };

  // Reconcile external tasks to clear obsolete optimistic overrides
  React.useEffect(() => {
    setTransitionState((prev) => {
      let changed = false;
      const nextOpt = { ...prev.optimisticStatuses };
      for (const st of tasks) {
        if (nextOpt[st.id] && nextOpt[st.id] === st.status) {
          delete nextOpt[st.id];
          changed = true;
        }
        if (st.subTasks) {
          for (const sub of st.subTasks) {
            if (nextOpt[sub.id] && nextOpt[sub.id] === sub.status) {
              delete nextOpt[sub.id];
              changed = true;
            }
          }
        }
      }
      return changed ? { ...prev, optimisticStatuses: nextOpt } : prev;
    });
  }, [tasks]);

  const effectiveTasks = React.useMemo(() => {
    return applyOptimisticOverrides(tasks, transitionState.optimisticStatuses);
  }, [tasks, transitionState.optimisticStatuses]);

  // Per-column pagination limit (30 items default)
  const [colLimits, setColLimits] = React.useState<Record<TaskStatus, number>>({
    NEW: 30,
    NOT_STARTED: 30,
    IN_PROGRESS: 30,
    WAITING_APPROVAL: 30,
    PENDING_EXECUTIVE_APPROVAL: 30,
    NEEDS_REVIEW: 30,
    BLOCKED: 30,
    COMPLETED: 30,
    OVERDUE: 30,
    CANCELLED: 30,
  });

  const [activeColumnIndex, setActiveColumnIndex] = React.useState(0);
  const columnRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const carouselRef = React.useRef<HTMLDivElement | null>(null);

  const scrollToColumn = (idx: number) => {
    setActiveColumnIndex(idx);
    triggerHaptic("selection");
    columnRefs.current[idx]?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (!el || el.clientWidth === 0) return;
    const scrollLeft = el.scrollLeft;
    const itemWidth = el.scrollWidth / KANBAN_COLUMNS.length;
    const newIdx = Math.round(scrollLeft / itemWidth);
    if (newIdx >= 0 && newIdx < KANBAN_COLUMNS.length && newIdx !== activeColumnIndex) {
      setActiveColumnIndex(newIdx);
    }
  };

  const groupedTasks = React.useMemo(() => {
    return groupTasksByStatus(
      effectiveTasks,
      levelFilter,
      categoryFilter,
      deferredSearchQuery
    );
  }, [effectiveTasks, levelFilter, categoryFilter, deferredSearchQuery]);

  const allFilteredItems = React.useMemo(() => {
    return filterKanbanItems(
      effectiveTasks,
      levelFilter,
      categoryFilter,
      deferredSearchQuery
    );
  }, [effectiveTasks, levelFilter, categoryFilter, deferredSearchQuery]);

  const handleStatusChangeInternal = React.useCallback(
    async (taskId: string, newStatus: TaskStatus) => {
      const latestState = transitionStateRef.current;
      if (latestState.pendingTaskIds[taskId]) return;

      const targetItem = allFilteredItems.find((i) => i.id === taskId);
      const currentStatus = targetItem?.status ?? "NEW";
      if (currentStatus === newStatus) return;

      const inFlightState: KanbanTransitionState = {
        ...latestState,
        pendingTaskIds: { ...latestState.pendingTaskIds, [taskId]: true },
        optimisticStatuses: { ...latestState.optimisticStatuses, [taskId]: newStatus },
        taskErrors: { ...latestState.taskErrors, [taskId]: null },
        lastAttemptedStatuses: { ...latestState.lastAttemptedStatuses },
      };
      transitionStateRef.current = inFlightState;
      setTransitionState(inFlightState);

      const transitionResult = await executeKanbanStatusTransition(
        taskId,
        newStatus,
        currentStatus,
        latestState,
        onStatusChange
      );

      setTransitionState((prev) => {
        const nextPending = { ...prev.pendingTaskIds };
        delete nextPending[taskId];

        const nextOptimistic = { ...prev.optimisticStatuses };
        if (!transitionResult.ok) {
          delete nextOptimistic[taskId];
        } else {
          nextOptimistic[taskId] = newStatus;
        }

        const nextErrors = { ...prev.taskErrors };
        if (transitionResult.ok) {
          delete nextErrors[taskId];
        } else if (transitionResult.error) {
          nextErrors[taskId] = transitionResult.error;
        }

        const nextLastAttempted = { ...prev.lastAttemptedStatuses };
        if (transitionResult.ok) {
          delete nextLastAttempted[taskId];
        } else {
          nextLastAttempted[taskId] = newStatus;
        }

        const next: KanbanTransitionState = {
          pendingTaskIds: nextPending,
          optimisticStatuses: nextOptimistic,
          taskErrors: nextErrors,
          lastAttemptedStatuses: nextLastAttempted,
        };
        transitionStateRef.current = next;
        return next;
      });
    },
    [allFilteredItems, onStatusChange]
  );

  // ============================================================================
  // Drag and Drop Logic (@dnd-kit)
  // ============================================================================

  const [activeDragId, setActiveDragId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px drag intent required before activating to avoid accidental drag on click
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activeDragItem = React.useMemo(() => {
    if (!activeDragId) return null;
    return allFilteredItems.find((item) => item.id === activeDragId) ?? null;
  }, [activeDragId, allFilteredItems]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
    triggerHaptic("selection");
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Case 1: Dropped over a column directly
    if (KANBAN_COLUMNS.some((col) => col.id === overId)) {
      const targetColumnStatus = overId as TaskStatus;
      handleStatusChangeInternal(activeId, targetColumnStatus);
      return;
    }

    // Case 2: Dropped over another card inside a column
    const overItem = allFilteredItems.find((item) => item.id === overId);
    if (overItem) {
      const targetColumnStatus = mapTaskStatusToKanbanColumn(overItem.status);
      const activeItem = allFilteredItems.find((item) => item.id === activeId);
      const activeColumnStatus = activeItem ? mapTaskStatusToKanbanColumn(activeItem.status) : null;

      if (activeColumnStatus !== targetColumnStatus) {
        handleStatusChangeInternal(activeId, targetColumnStatus);
      }
    }
  };

  // Counts & Exclusions
  const totalExtractedCount = allFilteredItems.length;
  const totalVisibleCount =
    (groupedTasks.NEW?.length || 0) +
    (groupedTasks.IN_PROGRESS?.length || 0) +
    (groupedTasks.NEEDS_REVIEW?.length || 0) +
    (groupedTasks.COMPLETED?.length || 0);
  const excludedCount = Math.max(0, totalExtractedCount - totalVisibleCount);

  return (
    <div
      className={cn(
        "w-full flex flex-col h-[calc(100vh-215px)] max-h-[calc(100vh-215px)] min-h-[460px] overflow-hidden",
        className
      )}
      data-slot="task-kanban-board"
    >
      {/* Board Utility Strip: Minimal Count Notice + Display Settings Button */}
      <div
        data-slot="kanban-count-notice"
        className="flex items-center justify-between gap-2 pb-2 text-xs text-muted-foreground shrink-0 px-0.5"
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-medium text-foreground text-xs">Kanban</span>
          <span>·</span>
          <span className="font-mono tabular-nums text-muted-foreground">
            {totalVisibleCount} / {totalExtractedCount} công việc
          </span>
          {excludedCount > 0 && (
            <span className="text-amber-700 bg-amber-500/10 px-1.5 py-0.5 rounded text-[11px] border border-amber-500/20 font-medium">
              ({excludedCount} công việc bị huỷ / lưu trữ không hiển thị trên bảng)
            </span>
          )}
        </div>

        {/* Display Settings Dropdown Toggle */}
        <DisplaySettingsPopover
          settings={displaySettings}
          onToggle={handleToggleDisplaySetting}
        />
      </div>

      {/* Mobile Stage Tab Bar (Single column carousel switcher) */}
      <div className="flex md:hidden items-center gap-1 overflow-x-auto pb-1.5 mb-1.5 scrollbar-none shrink-0">
        {KANBAN_COLUMNS.map((col, idx) => (
          <button
            key={col.id}
            type="button"
            onClick={() => scrollToColumn(idx)}
            className={cn(
              "h-8 px-2.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5",
              activeColumnIndex === idx
                ? "bg-primary text-primary-foreground shadow-2xs font-semibold"
                : "bg-muted/40 text-muted-foreground hover:bg-muted"
            )}
          >
            <span className={cn("size-1.5 rounded-full", col.dotColor)} />
            <span>{col.title}</span>
            <span className="font-mono tabular-nums opacity-80">({groupedTasks[col.id]?.length || 0})</span>
          </button>
        ))}
      </div>

      {/* DndContext Wrapping the Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Horizontal Scrolling Board Surface (Full width span) */}
        <div
          ref={carouselRef}
          onScroll={handleScroll}
          className="flex-1 min-h-0 flex gap-3.5 overflow-x-auto scrollbar-none pb-1 pt-0.5 w-full"
        >
          {KANBAN_COLUMNS.map((col, idx) => {
            const colTasks = groupedTasks[col.id] || [];
            const limit = colLimits[col.id] || 30;

            return (
              <div
                key={col.id}
                ref={(el) => {
                  columnRefs.current[idx] = el;
                }}
                className="h-full min-h-0 flex flex-col flex-1 min-w-[270px]"
              >
                <DroppableColumn
                  col={col}
                  tasks={colTasks}
                  displaySettings={displaySettings}
                  transitionState={transitionState}
                  onSelectTask={onSelectTask}
                  onStatusChangeInternal={handleStatusChangeInternal}
                  onAddTask={onAddTask}
                  colLimit={limit}
                  onIncreaseLimit={() =>
                    setColLimits((prev) => ({
                      ...prev,
                      [col.id]: (prev[col.id] || 30) + 30,
                    }))
                  }
                />
              </div>
            );
          })}
        </div>

        {/* Drag Overlay for Floating Card during DnD */}
        <DragOverlay dropAnimation={null}>
          {activeDragItem ? (
            <KanbanCard
              item={activeDragItem}
              displaySettings={displaySettings}
              isDragOverlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
