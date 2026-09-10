"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar,
  Building2,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  Circle,
  FolderTree,
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
import {
  getCategoryBadgeConfig,
  CATEGORY_TABS,
} from "@/components/tasks/cascading-task-table";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/haptics";

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

function isOverdue(dueDateStr?: string, status?: TaskStatus): boolean {
  if (!dueDateStr || status === "COMPLETED") return false;
  const d = dueDateStr.length > 10 ? dueDateStr.slice(0, 10) : dueDateStr;
  return d < "2026-09-04";
}

function getInitials(name: string): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
      {/* Explicit Count Notice Header (Zero Silent Loss Guarantee) */}
      <div
        data-slot="kanban-count-notice"
        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 mb-3 rounded-xl border border-border/60 bg-muted/30 text-xs text-muted-foreground"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-foreground">
            Bảng Kanban:
          </span>
          <span className="font-mono tabular-nums font-semibold text-foreground">
            {totalVisibleCount} / {totalExtractedCount} công việc
          </span>
          {excludedCount > 0 ? (
            <span className="text-amber-700 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 font-medium">
              ({excludedCount} công việc bị huỷ / lưu trữ không hiển thị trên bảng)
            </span>
          ) : (
            <span className="text-emerald-700 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 font-medium">
              Đầy đủ 100% công việc
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
                    {displayedTasks.map((item) => {
                      const categoryConfig = getCategoryBadgeConfig(
                        item.category
                      );
                      const effectiveColId = mapTaskStatusToKanbanColumn(item.status);
                      const overdue = isOverdue(item.dueDate, item.status) || item.status === "OVERDUE";
                      const prevStatus = getPrevStatus(item.status);
                      const nextStatus = getNextStatus(item.status);

                      return (
                        <div
                          key={item.id}
                          onClick={() => onSelectTask?.(item.rawTask)}
                          className={cn(
                            "group relative flex flex-col justify-between rounded-lg border border-border/60 bg-card p-3.5 text-card-foreground transition-all duration-150 cursor-pointer shadow-2xs",
                            "hover:border-primary/40 hover:shadow-subtle hover:-translate-y-[1px] active:translate-y-0",
                            item.level === "TRUONG"
                              ? "border-l-2 border-l-blue-500/70"
                              : "border-l-2 border-l-indigo-500/70"
                          )}
                        >
                          <div className="space-y-2">
                            {/* Top Row: Level Indicator & Category Badge */}
                            <div className="flex items-center justify-between gap-1.5 flex-wrap">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {item.level === "TRUONG" ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-600 border border-blue-500/20">
                                    <Building2
                                      strokeWidth={1.5}
                                      className="size-3"
                                    />
                                    <span>Cấp Trường</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                                    <Users
                                      strokeWidth={1.5}
                                      className="size-3"
                                    />
                                    <span>Đơn vị</span>
                                  </span>
                                )}

                                <span
                                  className={cn(
                                    "inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border border-border/50",
                                    categoryConfig.className
                                  )}
                                >
                                  {categoryConfig.label}
                                </span>

                                {overdue && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-red-500/10 text-destructive border border-red-500/20">
                                    Quá hạn
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Title & Parent School Task */}
                            <div>
                              {item.parentSchoolTaskTitle && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1 line-clamp-1">
                                  <FolderTree
                                    strokeWidth={1.5}
                                    className="size-3 shrink-0 text-muted-foreground/70"
                                  />
                                  <span className="truncate">
                                    {item.parentSchoolTaskTitle}
                                  </span>
                                </div>
                              )}
                              <h4 className="text-xs font-semibold text-foreground line-clamp-2 group-hover:text-primary leading-snug transition-colors">
                                {item.title}
                              </h4>
                            </div>
                          </div>

                          {/* Bottom Area: Micro Progress Bar (for School Tasks) & Footer */}
                          <div className="mt-2.5 space-y-2">
                            {/* 2px Micro Progress Bar (h-1) */}
                            {item.level === "TRUONG" && (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs text-muted-foreground font-mono tabular-nums">
                                  <span className="text-muted-foreground/70">
                                    Tiến độ
                                  </span>
                                  <span>{item.progressPercent ?? 0}%</span>
                                </div>
                                <div className="h-1 w-full overflow-hidden rounded-full bg-muted/60">
                                  <div
                                    className={cn(
                                      "h-full rounded-full transition-all duration-300",
                                      (item.progressPercent ?? 0) === 100
                                        ? "bg-emerald-500"
                                        : (item.progressPercent ?? 0) >= 50
                                        ? "bg-blue-500"
                                        : "bg-amber-500"
                                    )}
                                    style={{
                                      width: `${Math.min(
                                        100,
                                        Math.max(0, item.progressPercent ?? 0)
                                      )}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Footer Info: Assignee, Due Date & Quick Status Move Buttons */}
                            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-border/40">
                              {/* Assignee & Due Date */}
                              <div className="flex items-center gap-2 min-w-0">
                                <div
                                  className="size-[22px] rounded-full bg-secondary text-foreground border border-border/80 flex items-center justify-center text-xs font-semibold font-mono shrink-0"
                                  title={item.assigneeName}
                                >
                                  {getInitials(item.assigneeName)}
                                </div>
                                <div className="flex items-center gap-1 text-xs truncate text-muted-foreground">
                                  <Calendar
                                    strokeWidth={1.5}
                                    className={cn(
                                      "size-3 shrink-0",
                                      overdue ? "text-destructive" : ""
                                    )}
                                  />
                                  <span
                                    className={cn(
                                      "truncate font-mono tabular-nums text-xs",
                                      overdue
                                        ? "text-destructive font-semibold"
                                        : ""
                                    )}
                                  >
                                    {formatDate(item.dueDate)}
                                  </span>
                                </div>
                              </div>

                              {/* Quick Move and Status Selection Controls */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                {/* Accessible Status Transition Menu (Chuyển trạng thái) */}
                                <div className="relative inline-flex items-center">
                                  <label
                                    htmlFor={`status-select-${item.id}`}
                                    className="sr-only"
                                  >
                                    Chuyển trạng thái
                                  </label>
                                  <select
                                    id={`status-select-${item.id}`}
                                    aria-label="Chuyển trạng thái"
                                    title="Chuyển trạng thái"
                                    value={effectiveColId}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      const newStatus = e.target.value as TaskStatus;
                                      if (newStatus && onStatusChange) {
                                        triggerHaptic("selection");
                                        onStatusChange(item.id, newStatus);
                                      }
                                    }}
                                    className="h-8 min-h-[44px] sm:min-h-[28px] sm:h-7 pl-2 pr-6 text-xs font-medium rounded-lg border border-border/60 bg-background text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer transition-colors focus:outline-hidden focus:ring-1 focus:ring-primary/40 appearance-none touch-manipulation"
                                  >
                                    <option value="" disabled>
                                      Chuyển trạng thái
                                    </option>
                                    {KANBAN_COLUMNS.map((col) => (
                                      <option
                                        key={col.id}
                                        value={col.id}
                                        disabled={col.id === effectiveColId}
                                      >
                                        {col.id === effectiveColId
                                          ? `[Hiện tại] ${col.title}`
                                          : `→ ${col.title}`}
                                      </option>
                                    ))}
                                  </select>
                                  <ChevronRight
                                    className="pointer-events-none absolute right-1.5 size-3 text-muted-foreground rotate-90"
                                    strokeWidth={1.5}
                                  />
                                </div>

                                {/* Step-by-step Chevrons */}
                                <button
                                  type="button"
                                  disabled={!prevStatus}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (prevStatus && onStatusChange) {
                                      triggerHaptic("selection");
                                      onStatusChange(item.id, prevStatus);
                                    }
                                  }}
                                  aria-label={
                                    prevStatus
                                      ? `Lùi về ${prevStatus}`
                                      : "Không thể lùi"
                                  }
                                  title={
                                    prevStatus
                                      ? `Chuyển về ${prevStatus}`
                                      : "Không thể lùi"
                                  }
                                  className={cn(
                                    "size-8 sm:size-7 min-w-[32px] min-h-[44px] sm:min-w-[28px] sm:min-h-[28px] flex items-center justify-center rounded-lg border border-border/60 bg-background text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer active:scale-95 touch-manipulation",
                                    !prevStatus &&
                                      "opacity-30 cursor-not-allowed hover:bg-background hover:text-muted-foreground"
                                  )}
                                >
                                  <ChevronLeft
                                    strokeWidth={1.5}
                                    className="size-3.5"
                                  />
                                </button>

                                <button
                                  type="button"
                                  disabled={!nextStatus}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (nextStatus && onStatusChange) {
                                      triggerHaptic("selection");
                                      onStatusChange(item.id, nextStatus);
                                    }
                                  }}
                                  aria-label={
                                    nextStatus
                                      ? `Tiến sang ${nextStatus}`
                                      : "Không thể tiến"
                                  }
                                  title={
                                    nextStatus
                                      ? `Chuyển sang ${nextStatus}`
                                      : "Không thể tiến"
                                  }
                                  className={cn(
                                    "size-8 sm:size-7 min-w-[32px] min-h-[44px] sm:min-w-[28px] sm:min-h-[28px] flex items-center justify-center rounded-lg border border-border/60 bg-background text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer active:scale-95 touch-manipulation",
                                    !nextStatus &&
                                      "opacity-30 cursor-not-allowed hover:bg-background hover:text-muted-foreground"
                                  )}
                                >
                                  <ChevronRight
                                    strokeWidth={1.5}
                                    className="size-3.5"
                                  />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
