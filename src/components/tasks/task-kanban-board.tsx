"use client";

import * as React from "react";
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
} from "lucide-react";
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
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/haptics";
import { isTaskPastDue, getSystemReferenceDate } from "@/lib/academic-calendar";

export type TaskLevelFilter = "ALL" | "TRUONG" | "DON_VI";

export interface KanbanColumnConfig {
  id: TaskStatus;
  title: string;
  label: string;
  emoji: string;
  dotColor: string;
  iconColor: string;
  accentBorder: string;
  headerAccent: string;
  badgeClass: string;
  bgClass: string;
}

export const KANBAN_COLUMNS: KanbanColumnConfig[] = [
  {
    id: "NEW",
    title: "Mới / Tiếp nhận",
    label: "Mới / Tiếp nhận",
    emoji: "",
    dotColor: "bg-slate-500",
    iconColor: "text-slate-500",
    accentBorder: "border-t-slate-500",
    headerAccent: "border-t-2 border-t-slate-500",
    badgeClass: "border-slate-500/20 bg-slate-500/10 text-slate-600",
    bgClass: "bg-muted/10",
  },
  {
    id: "IN_PROGRESS",
    title: "Đang thực hiện",
    label: "Đang thực hiện",
    emoji: "",
    dotColor: "bg-blue-500",
    iconColor: "text-blue-500",
    accentBorder: "border-t-blue-500",
    headerAccent: "border-t-2 border-t-blue-500",
    badgeClass: "border-blue-500/20 bg-blue-500/10 text-blue-600",
    bgClass: "bg-muted/10",
  },
  {
    id: "NEEDS_REVIEW",
    title: "Cần chỉnh sửa",
    label: "Cần chỉnh sửa",
    emoji: "",
    dotColor: "bg-amber-500",
    iconColor: "text-amber-500",
    accentBorder: "border-t-amber-500",
    headerAccent: "border-t-2 border-t-amber-500",
    badgeClass: "border-amber-500/20 bg-amber-500/10 text-amber-600",
    bgClass: "bg-muted/10",
  },
  {
    id: "COMPLETED",
    title: "Hoàn thành",
    label: "Hoàn thành",
    emoji: "",
    dotColor: "bg-emerald-500",
    iconColor: "text-emerald-500",
    accentBorder: "border-t-emerald-500",
    headerAccent: "border-t-2 border-t-emerald-500",
    badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600",
    bgClass: "bg-muted/10",
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

/**
 * Extracts and flattens all SchoolTasks and their StaffTasks into unified KanbanItems.
 */
export function extractKanbanItems(schoolTasks: SchoolTask[]): KanbanItem[] {
  const items: KanbanItem[] = [];

  for (const st of schoolTasks) {
    // Parent School Task
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

    // Subtasks
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
  searchQuery: string = ""
): KanbanItem[] {
  const allItems = extractKanbanItems(tasks);
  const query = searchQuery.trim().toLowerCase();

  return allItems.filter((item) => {
    // Level filter
    if (levelFilter !== "ALL" && item.level !== levelFilter) {
      return false;
    }

    // Category filter
    if (categoryFilter !== "ALL" && item.category !== categoryFilter) {
      return false;
    }

    // Search query
    if (query) {
      const matchTitle = item.title.toLowerCase().includes(query);
      const matchAssignee = item.assigneeName.toLowerCase().includes(query);
      const matchParent = item.parentSchoolTaskTitle
        ?.toLowerCase()
        .includes(query);
      if (!matchTitle && !matchAssignee && !matchParent) {
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
  searchQuery: string = ""
): Record<TaskStatus, KanbanItem[]> {
  const filtered = filterKanbanItems(
    tasks,
    levelFilter,
    categoryFilter,
    searchQuery
  );

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

    // 1. Maintain raw status bucket for backward compatibility if consumer relies on raw status keys
    if (grouped[upperStatus]) {
      grouped[upperStatus].push(item);
    }

    // 2. Map to canonical Kanban column (NEW, IN_PROGRESS, NEEDS_REVIEW, COMPLETED)
    const colId = mapTaskStatusToKanbanColumn(rawStatus);

    // Cancelled and archived tasks are intentionally excluded from active board columns
    if (upperStatus === "CANCELLED" || (upperStatus as string) === "CANCELED" || (upperStatus as string) === "ARCHIVED") {
      continue;
    }

    // Avoid duplicate push if upperStatus already matched the column ID
    if (upperStatus !== colId) {
      grouped[colId].push(item);
    }
  }

  return grouped;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

function isOverdue(dueDateStr?: string, status?: TaskStatus, referenceDate: string = getSystemReferenceDate()): boolean {
  if (!dueDateStr || status === "COMPLETED" || status === "CANCELLED") return false;
  return isTaskPastDue(dueDateStr, referenceDate);
}

// Status labels for action menu display
const STATUS_LABELS: Record<string, string> = {
  NEW: "Tiếp nhận",
  IN_PROGRESS: "Đang làm",
  NEEDS_REVIEW: "Chờ duyệt",
  COMPLETED: "Hoàn thành",
};

interface KanbanCardProps {
  item: KanbanItem;
  onSelectTask?: (task: SchoolTask | StaffTask) => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
}

function KanbanCard({ item, onSelectTask, onStatusChange }: KanbanCardProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [statusSubmenuOpen, setStatusSubmenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const overdue =
    isOverdue(item.dueDate, item.status) || item.status === "OVERDUE";
  const effectiveColId = mapTaskStatusToKanbanColumn(item.status);

  // Close menu on outside mousedown or Escape keydown
  React.useEffect(() => {
    if (!menuOpen) return;
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setStatusSubmenuOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setStatusSubmenuOpen(false);
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
    setMenuOpen((prev) => !prev);
    setStatusSubmenuOpen(false);
  }

  function handleStatusChange(newStatus: TaskStatus) {
    triggerHaptic("selection");
    onStatusChange?.(item.id, newStatus);
    setMenuOpen(false);
    setStatusSubmenuOpen(false);
  }

  function handleOpenDetail(e: React.MouseEvent) {
    e.stopPropagation();
    onSelectTask?.(item.rawTask);
    setMenuOpen(false);
  }

  return (
    <div
      onClick={handleCardClick}
      className={cn(
        "group relative flex flex-col gap-1.5 rounded-lg border border-border/60 bg-card py-2.5 px-3 text-card-foreground transition-all duration-150 cursor-pointer shadow-2xs",
        "hover:border-primary/40 hover:shadow-subtle hover:-translate-y-[1px] active:translate-y-0",
        item.level === "TRUONG"
          ? "border-l-2 border-l-blue-500/70"
          : "border-l-2 border-l-indigo-500/70"
      )}
    >
      {/* Row 1: Title + Action menu trigger */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {item.parentSchoolTaskTitle && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5 line-clamp-1">
              <FolderTree
                strokeWidth={1.5}
                className="size-3 shrink-0 text-muted-foreground/70"
              />
              <span className="truncate">{item.parentSchoolTaskTitle}</span>
            </div>
          )}
          <h4 className="text-xs font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {item.title}
          </h4>
        </div>

        {/* ⋯ Action menu button */}
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={handleMenuToggle}
            aria-label="Thao tác"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            data-slot="kanban-action-menu-trigger"
            data-actions="status-transition"
            className="size-7 min-h-[44px] sm:min-h-[28px] flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60 touch-manipulation"
          >
            <MoreHorizontal strokeWidth={1.5} className="size-4" />
          </button>

          {/* Action menu popover */}
          {menuOpen && (
            <div
              role="menu"
              data-slot="kanban-action-menu"
              aria-label="Thao tác nhiệm vụ"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setMenuOpen(false);
                  setStatusSubmenuOpen(false);
                }
              }}
              className="absolute right-0 top-full mt-1 z-50 w-48 rounded-xl border border-border/80 bg-card shadow-lg py-1 animate-in fade-in-0 zoom-in-95 duration-100"
            >
              {/* Mở chi tiết */}
              <button
                type="button"
                role="menuitem"
                onClick={handleOpenDetail}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-muted/60 transition-colors cursor-pointer min-h-[44px] sm:min-h-[36px] text-left"
              >
                Mở chi tiết
              </button>

              <div className="h-px bg-border/50 mx-2 my-0.5" />

              {/* Chuyển trạng thái submenu toggle */}
              <button
                type="button"
                role="menuitem"
                aria-label="Chuyển trạng thái"
                aria-expanded={statusSubmenuOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  setStatusSubmenuOpen((prev) => !prev);
                }}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs text-foreground hover:bg-muted/60 transition-colors cursor-pointer min-h-[44px] sm:min-h-[36px]"
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

              {/* Inline status options */}
              {statusSubmenuOpen && (
                <div className="pb-1">
                  {KANBAN_COLUMNS.map((col) => {
                    const isCurrent = col.id === effectiveColId;
                    return (
                      <button
                        key={col.id}
                        type="button"
                        role="menuitem"
                        disabled={isCurrent}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isCurrent) handleStatusChange(col.id);
                        }}
                        className={cn(
                          "w-full flex items-center gap-2 pl-6 pr-3 py-1.5 text-xs transition-colors cursor-pointer min-h-[40px] sm:min-h-[32px] text-left",
                          isCurrent
                            ? "text-primary font-semibold cursor-default"
                            : "text-foreground hover:bg-muted/60"
                        )}
                      >
                        <span
                          className={cn("size-1.5 rounded-full shrink-0", col.dotColor)}
                        />
                        {STATUS_LABELS[col.id] ?? col.title}
                        {isCurrent && (
                          <span className="ml-auto text-muted-foreground font-normal">
                            Hiện tại
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="h-px bg-border/50 mx-2 my-0.5" />

              {/* Close */}
              <button
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  setStatusSubmenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/60 transition-colors cursor-pointer min-h-[44px] sm:min-h-[36px] text-left"
              >
                <X strokeWidth={1.5} className="size-3" />
                Đóng
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Category (unit) · Assignee */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
        <span className="font-medium text-foreground/80 truncate">
          {item.categoryLabel}
        </span>
        <span className="shrink-0">·</span>
        <span className="truncate">{item.assigneeName}</span>
      </div>

      {/* Row 3: Deadline + Overdue badge */}
      <div className="flex items-center gap-2 flex-wrap">
        <div
          className={cn(
            "flex items-center gap-1 text-xs font-mono tabular-nums",
            overdue ? "text-destructive font-semibold" : "text-muted-foreground"
          )}
        >
          <Calendar
            strokeWidth={1.5}
            className={cn("size-3 shrink-0", overdue ? "text-destructive" : "")}
          />
          <span>Hạn {formatDate(item.dueDate)}</span>
        </div>
        {overdue && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-red-500/10 text-destructive border border-red-500/20">
            Quá hạn
          </span>
        )}
      </div>

      {/* Row 4: Progress bar - suppressed when 0% or 100% completed */}
      {item.progressPercent !== undefined &&
        item.progressPercent > 0 &&
        (item.progressPercent < 100 || item.status !== "COMPLETED") && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-mono tabular-nums">
              <span className="text-muted-foreground/70">Tiến độ</span>
              <span>{item.progressPercent}%</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted/60">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  item.progressPercent === 100
                    ? "bg-emerald-500"
                    : item.progressPercent >= 50
                    ? "bg-blue-500"
                    : "bg-amber-500"
                )}
                style={{
                  width: `${Math.min(100, Math.max(0, item.progressPercent))}%`,
                }}
              />
            </div>
          </div>
        )}
    </div>
  );
}

export interface TaskKanbanBoardProps {
  tasks: SchoolTask[];
  onSelectTask?: (task: SchoolTask | StaffTask) => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  onAddTask?: (
    initialLevel?: "TRUONG" | "DON_VI",
    initialParentTaskId?: string
  ) => void;
  levelFilter?: TaskLevelFilter;
  categoryFilter?: TaskCategory | "ALL";
  searchQuery?: string;
  className?: string;
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
}: TaskKanbanBoardProps) {
  const deferredSearchQuery = React.useDeferredValue(searchQuery);
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
      tasks,
      levelFilter,
      categoryFilter,
      deferredSearchQuery
    );
  }, [tasks, levelFilter, categoryFilter, deferredSearchQuery]);

  const allFilteredItems = React.useMemo(() => {
    return filterKanbanItems(
      tasks,
      levelFilter,
      categoryFilter,
      deferredSearchQuery
    );
  }, [tasks, levelFilter, categoryFilter, deferredSearchQuery]);

  const totalExtractedCount = allFilteredItems.length;
  const totalVisibleCount =
    (groupedTasks.NEW?.length || 0) +
    (groupedTasks.IN_PROGRESS?.length || 0) +
    (groupedTasks.NEEDS_REVIEW?.length || 0) +
    (groupedTasks.COMPLETED?.length || 0);
  const excludedCount = Math.max(0, totalExtractedCount - totalVisibleCount);

  return (
    <div
      className={cn("w-full overflow-x-auto pb-4", className)}
      data-slot="task-kanban-board"
    >
      {/* Flat compact summary (Zero Silent Loss Guarantee) */}
      <div
        data-slot="kanban-count-notice"
        className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground mb-2 px-0.5"
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-medium text-foreground">Kanban</span>
          <span>·</span>
          <span className="font-mono tabular-nums font-medium text-foreground">
            {totalVisibleCount} / {totalExtractedCount} công việc
          </span>
          {excludedCount > 0 && (
            <span className="text-amber-700 bg-amber-500/10 px-1.5 py-0.5 rounded text-xs border border-amber-500/20 font-medium">
              ({excludedCount} công việc bị huỷ / lưu trữ không hiển thị trên bảng)
            </span>
          )}
        </div>
      </div>

      {/* Mobile Stage Tab Bar */}
      <div className="flex md:hidden items-center gap-1.5 overflow-x-auto pb-2 mb-2 scrollbar-none">
        {KANBAN_COLUMNS.map((col, idx) => (
          <button
            key={col.id}
            type="button"
            onClick={() => scrollToColumn(idx)}
            className={cn(
              "min-h-[40px] px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer active:scale-95",
              activeColumnIndex === idx
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            )}
          >
            {col.title} ({groupedTasks[col.id]?.length || 0})
          </button>
        ))}
      </div>

      {/* Responsive Board: Carousel on mobile, Grid on tablet/desktop */}
      <div
        ref={carouselRef}
        onScroll={handleScroll}
        className="flex md:grid md:grid-cols-2 xl:grid-cols-4 gap-3.5 overflow-x-auto snap-x snap-mandatory scrollbar-none -mx-3.5 px-3.5 md:mx-0 md:px-0"
      >
        {KANBAN_COLUMNS.map((col, idx) => {
          const colTasks = groupedTasks[col.id] || [];
          const count = colTasks.length;
          const limit = colLimits[col.id] || 30;
          const displayedTasks = colTasks.slice(0, limit);
          const IconComponent = COLUMN_ICONS[col.id];

          return (
            <div
              key={col.id}
              ref={(el) => {
                columnRefs.current[idx] = el;
              }}
              className={cn(
                "w-[86vw] max-w-[340px] shrink-0 snap-center flex flex-col md:w-auto md:max-w-none rounded-2xl border border-border/60 bg-muted/20 backdrop-blur-xs p-3.5 transition-all",
                col.bgClass
              )}
            >
              {/* Column Header with Lucide icon and Micro-Pill Counter */}
              <div
                className={cn(
                  "flex items-center justify-between pb-3 border-b border-border/50 pt-1 px-0.5",
                  col.headerAccent
                )}
              >
                <div className="flex items-center gap-2">
                  <IconComponent
                    strokeWidth={1.5}
                    className={cn("size-3.5 shrink-0", col.iconColor)}
                  />
                  <h3 className="text-xs font-semibold text-foreground tracking-tight">
                    {col.title}
                  </h3>
                  <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-mono tabular-nums text-muted-foreground bg-muted/60 border border-border/40">
                    {count}
                  </span>
                </div>

                {onAddTask && (
                  <button
                    type="button"
                    onClick={() => onAddTask()}
                    title={`Thêm công việc vào mục ${col.title}`}
                    className="size-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
                  >
                    <Plus strokeWidth={1.5} className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Column Task Cards */}
              <div className="flex-1 space-y-2.5 pt-3 overflow-y-auto max-h-[calc(100vh-280px)] min-h-[160px] thin-scrollbar pr-0.5">
                {colTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground/60 border border-dashed border-border/60 rounded-lg bg-card/40">
                    <span className="text-xs font-medium">Không có nhiệm vụ</span>
                  </div>
                ) : (
                  <>
                    {displayedTasks.map((item) => (
                      <KanbanCard
                        key={item.id}
                        item={item}
                        onSelectTask={onSelectTask}
                        onStatusChange={onStatusChange}
                      />
                    ))}
                    {colTasks.length > limit && (
                      <button
                        type="button"
                        onClick={() =>
                          setColLimits((prev) => ({
                            ...prev,
                            [col.id]: (prev[col.id] || 30) + 30,
                          }))
                        }
                        className="w-full py-2 px-3 text-xs font-semibold font-mono tabular-nums rounded-lg border border-border/70 bg-card hover:bg-secondary/70 text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-2xs"
                      >
                        Hiển thị thêm {Math.min(30, colTasks.length - limit)}{" "}
                        việc (còn {colTasks.length - limit})
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile Active Column Indicator Dots */}
      <div className="flex md:hidden items-center justify-center gap-1.5 pt-3">
        {KANBAN_COLUMNS.map((col, idx) => (
          <button
            key={col.id}
            type="button"
            onClick={() => scrollToColumn(idx)}
            aria-label={`Chuyển tới cột ${col.title}`}
            className={cn(
              "h-1.5 rounded-full transition-all cursor-pointer",
              activeColumnIndex === idx
                ? "w-6 bg-primary"
                : "w-2 bg-border hover:bg-muted-foreground/40"
            )}
          />
        ))}
      </div>
    </div>
  );
}
