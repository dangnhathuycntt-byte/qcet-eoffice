"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar,
  User,
  Users,
  Building2,
  CheckCircle2,
  Clock,
  AlertCircle,
  FolderTree,
  Search,
  Filter,
  Layers,
  Sparkles,
} from "lucide-react";
import type {
  SchoolTask,
  StaffTask,
  TaskCategory,
  TaskStatus,
} from "@/types/dashboard";
import {
  getCategoryBadgeConfig,
  getStatusBadgeConfig,
  CATEGORY_TABS,
} from "@/components/dashboard/cascading-task-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type TaskLevelFilter = "ALL" | "TRUONG" | "DON_VI";

export interface KanbanColumnConfig {
  id: TaskStatus;
  title: string;
  label: string;
  emoji: string;
  dotColor: string;
  accentBorder: string;
  headerAccent: string;
  badgeClass: string;
  bgClass: string;
}

export const KANBAN_COLUMNS: KanbanColumnConfig[] = [
  {
    id: "NEW",
    title: "Mới tiếp nhận",
    label: "Mới tiếp nhận",
    emoji: "",
    dotColor: "bg-violet-500",
    accentBorder: "border-t-violet-500",
    headerAccent: "border-t-2 border-t-violet-500",
    badgeClass: "border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400",
    bgClass: "bg-violet-500/[0.02] dark:bg-violet-500/[0.03]",
  },
  {
    id: "IN_PROGRESS",
    title: "Đang thực hiện",
    label: "Đang thực hiện",
    emoji: "",
    dotColor: "bg-blue-500",
    accentBorder: "border-t-blue-500",
    headerAccent: "border-t-2 border-t-blue-500",
    badgeClass: "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
    bgClass: "bg-blue-500/[0.02] dark:bg-blue-500/[0.03]",
  },
  {
    id: "NEEDS_REVIEW",
    title: "Chờ duyệt / Cần sửa",
    label: "Cần chỉnh sửa",
    emoji: "",
    dotColor: "bg-amber-500",
    accentBorder: "border-t-amber-500",
    headerAccent: "border-t-2 border-t-amber-500",
    badgeClass: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    bgClass: "bg-amber-500/[0.02] dark:bg-amber-500/[0.03]",
  },
  {
    id: "COMPLETED",
    title: "Hoàn thành",
    label: "Hoàn thành",
    emoji: "",
    dotColor: "bg-emerald-500",
    accentBorder: "border-t-emerald-500",
    headerAccent: "border-t-2 border-t-emerald-500",
    badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-500/[0.02] dark:bg-emerald-500/[0.03]",
  },
];

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

const STATUS_ORDER: TaskStatus[] = ["NEW", "IN_PROGRESS", "NEEDS_REVIEW", "COMPLETED"];

export function getNextStatus(status: TaskStatus): TaskStatus | null {
  const index = STATUS_ORDER.indexOf(status);
  if (index === -1 || index >= STATUS_ORDER.length - 1) return null;
  return STATUS_ORDER[index + 1];
}

export function getPrevStatus(status: TaskStatus): TaskStatus | null {
  const index = STATUS_ORDER.indexOf(status);
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
      const matchParent = item.parentSchoolTaskTitle?.toLowerCase().includes(query);
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
  const filtered = filterKanbanItems(tasks, levelFilter, categoryFilter, searchQuery);

  const grouped: Record<TaskStatus, KanbanItem[]> = {
    NEW: [],
    IN_PROGRESS: [],
    NEEDS_REVIEW: [],
    COMPLETED: [],
  };

  for (const item of filtered) {
    if (grouped[item.status]) {
      grouped[item.status].push(item);
    } else {
      // Fallback if status is unknown
      grouped.IN_PROGRESS.push(item);
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
  onAddTask?: (initialLevel?: "TRUONG" | "DON_VI", initialParentTaskId?: string) => void;
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
    IN_PROGRESS: 30,
    NEEDS_REVIEW: 30,
    COMPLETED: 30,
  });

  const groupedTasks = React.useMemo(() => {
    return groupTasksByStatus(tasks, levelFilter, categoryFilter, deferredSearchQuery);
  }, [tasks, levelFilter, categoryFilter, deferredSearchQuery]);

  return (
    <div
      className={cn("w-full overflow-x-auto pb-4", className)}
      data-slot="task-kanban-board"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 min-w-[320px]">
        {KANBAN_COLUMNS.map((col) => {
          const colTasks = groupedTasks[col.id] || [];
          const count = colTasks.length;
          const limit = colLimits[col.id] || 30;
          const displayedTasks = colTasks.slice(0, limit);

          return (
            <div
              key={col.id}
              className={cn(
                "flex flex-col rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xs p-3.5 shadow-card transition-all",
                col.bgClass
              )}
            >
              {/* Column Header with Colored Accent Border */}
              <div
                className={cn(
                  "flex items-center justify-between pb-3 border-b border-border/50 pt-1.5 px-0.5",
                  col.headerAccent
                )}
              >
                <div className="flex items-center gap-2">
                  <span className={cn("size-2 rounded-full ring-2 ring-background", col.dotColor)} />
                  <h3 className="text-xs font-bold text-foreground tracking-tight">
                    {col.title}
                  </h3>
                  <span
                    className={cn(
                      "inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold",
                      col.badgeClass
                    )}
                  >
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
                    <Plus className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Column Task Cards */}
              <div className="flex-1 space-y-2.5 pt-3 overflow-y-auto max-h-[calc(100vh-280px)] min-h-[160px] thin-scrollbar pr-0.5">
                {colTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground/60 border border-dashed border-border/60 rounded-xl bg-muted/20">
                    <span className="text-xs">Không có nhiệm vụ</span>
                  </div>
                ) : (
                  <>
                    {displayedTasks.map((item) => {
                    const categoryConfig = getCategoryBadgeConfig(item.category);
                    const overdue = isOverdue(item.dueDate, item.status);
                    const prevStatus = getPrevStatus(item.status);
                    const nextStatus = getNextStatus(item.status);

                    return (
                      <div
                        key={item.id}
                        onClick={() => onSelectTask?.(item.rawTask)}
                        className={cn(
                          "group relative flex flex-col gap-2.5 rounded-xl border border-border/50 shadow-xs hover:shadow-card bg-card p-3.5 transition-all cursor-pointer text-card-foreground hover:border-border/80 active:scale-[0.99]",
                          item.level === "TRUONG"
                            ? "border-l-[3px] border-l-blue-600 dark:border-l-blue-400"
                            : "border-l-[3px] border-l-indigo-500 dark:border-l-indigo-400"
                        )}
                      >
                        {/* Top Row: Level Indicator & Category Badge */}
                        <div className="flex items-center justify-between gap-1.5 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            {item.level === "TRUONG" ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800">
                                <Building2 className="size-2.5" />
                                <span>Cấp Trường</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800">
                                <Users className="size-2.5" />
                                <span>Đơn vị</span>
                              </span>
                            )}

                            <span
                              className={cn(
                                "inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium border",
                                categoryConfig.className
                              )}
                            >
                              {categoryConfig.label}
                            </span>
                          </div>
                        </div>

                        {/* Title */}
                        <div>
                          {item.parentSchoolTaskTitle && (
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1 line-clamp-1">
                              <FolderTree className="size-3 shrink-0 text-muted-foreground/70" />
                              <span className="truncate">{item.parentSchoolTaskTitle}</span>
                            </div>
                          )}
                          <h4 className="text-xs font-semibold text-foreground line-clamp-2 group-hover:text-primary leading-snug transition-colors">
                            {item.title}
                          </h4>
                        </div>

                        {/* Progress Bar (for School Tasks) */}
                        {item.level === "TRUONG" && (
                          <div className="space-y-1 pt-0.5">
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                              <span>
                                {item.completedSubTasks ?? 0}/{item.totalSubTasks ?? 0} đơn vị xong
                              </span>
                              <span className="font-semibold text-foreground">
                                {item.progressPercent ?? 0}%
                              </span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/80">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all duration-300",
                                  (item.progressPercent ?? 0) === 100
                                    ? "bg-emerald-600"
                                    : (item.progressPercent ?? 0) >= 50
                                    ? "bg-blue-600"
                                    : "bg-amber-500"
                                )}
                                style={{ width: `${Math.min(100, Math.max(0, item.progressPercent ?? 0))}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Footer Info: Assignee, Due Date & Quick Status Move Buttons */}
                        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-border/50">
                          {/* Assignee & Due Date */}
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className="size-5 rounded-full bg-secondary text-foreground border border-border/80 flex items-center justify-center text-[9px] font-bold shrink-0"
                              title={item.assigneeName}
                            >
                              {getInitials(item.assigneeName)}
                            </div>
                            <div className="flex items-center gap-1 text-[11px] truncate text-muted-foreground">
                              <Calendar className={cn("size-3 shrink-0", overdue ? "text-destructive" : "")} />
                              <span className={cn("truncate font-mono", overdue ? "text-destructive font-semibold" : "")}>
                                {formatDate(item.dueDate)}
                              </span>
                            </div>
                          </div>

                          {/* Quick Move Buttons (◀ / ▶) */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              disabled={!prevStatus}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (prevStatus && onStatusChange) {
                                  onStatusChange(item.id, prevStatus);
                                }
                              }}
                              title={prevStatus ? `Chuyển về ${prevStatus}` : "Không thể lùi"}
                              className={cn(
                                "size-6 flex items-center justify-center rounded-md border border-border/80 bg-background text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer",
                                !prevStatus && "opacity-30 cursor-not-allowed hover:bg-background hover:text-muted-foreground"
                              )}
                            >
                              <ChevronLeft className="size-3.5" />
                            </button>

                            <button
                              type="button"
                              disabled={!nextStatus}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (nextStatus && onStatusChange) {
                                  onStatusChange(item.id, nextStatus);
                                }
                              }}
                              title={nextStatus ? `Chuyển sang ${nextStatus}` : "Không thể tiến"}
                              className={cn(
                                "size-6 flex items-center justify-center rounded-md border border-border/80 bg-background text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer",
                                !nextStatus && "opacity-30 cursor-not-allowed hover:bg-background hover:text-muted-foreground"
                              )}
                            >
                              <ChevronRight className="size-3.5" />
                            </button>
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
                      className="w-full py-2 px-3 text-xs font-semibold rounded-xl border border-border/70 bg-card hover:bg-secondary/70 text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-2xs"
                    >
                      Hiển thị thêm {Math.min(30, colTasks.length - limit)} việc (còn {colTasks.length - limit})
                    </button>
                  )}
                </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
