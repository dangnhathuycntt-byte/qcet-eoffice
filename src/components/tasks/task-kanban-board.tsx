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
  badgeClass: string;
  bgClass: string;
}

export const KANBAN_COLUMNS: KanbanColumnConfig[] = [
  {
    id: "NEW",
    title: "Mới",
    label: "Mới",
    emoji: "",
    dotColor: "bg-red-500",
    badgeClass: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",
    bgClass: "bg-red-50/20 dark:bg-red-950/10",
  },
  {
    id: "IN_PROGRESS",
    title: "Đang thực hiện",
    label: "Đang thực hiện",
    emoji: "",
    dotColor: "bg-blue-500",
    badgeClass: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300",
    bgClass: "bg-blue-50/20 dark:bg-blue-950/10",
  },
  {
    id: "NEEDS_REVIEW",
    title: "Cần chỉnh sửa",
    label: "Cần chỉnh sửa",
    emoji: "",
    dotColor: "bg-amber-500",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
    bgClass: "bg-amber-50/20 dark:bg-amber-950/10",
  },
  {
    id: "COMPLETED",
    title: "Hoàn thành",
    label: "Hoàn thành",
    emoji: "",
    dotColor: "bg-emerald-500",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
    bgClass: "bg-emerald-50/20 dark:bg-emerald-950/10",
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
  try {
    const due = new Date(dueDateStr);
    const today = new Date("2026-09-04"); // System reference date
    return due < today;
  } catch {
    return false;
  }
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
  const groupedTasks = React.useMemo(() => {
    return groupTasksByStatus(tasks, levelFilter, categoryFilter, searchQuery);
  }, [tasks, levelFilter, categoryFilter, searchQuery]);

  return (
    <div
      className={cn("w-full overflow-x-auto pb-4", className)}
      data-slot="task-kanban-board"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 min-w-[320px]">
        {KANBAN_COLUMNS.map((col) => {
          const colTasks = groupedTasks[col.id] || [];
          const count = colTasks.length;

          return (
            <div
              key={col.id}
              className="flex flex-col rounded-xl border border-border/75 bg-[#FAFAFA] dark:bg-muted/10 p-3.5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)]"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <span className={cn("size-2 rounded-full ring-2 ring-background", col.dotColor)} />
                  <h3 className="text-xs font-semibold text-foreground tracking-tight">
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
              <div className="flex-1 space-y-2.5 pt-3 overflow-y-auto max-h-[calc(100vh-280px)] min-h-[150px]">
                {colTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground/60 border border-dashed border-border/60 rounded-md">
                    <span className="text-xs">Không có nhiệm vụ</span>
                  </div>
                ) : (
                  colTasks.map((item) => {
                    const categoryConfig = getCategoryBadgeConfig(item.category);
                    const overdue = isOverdue(item.dueDate, item.status);
                    const prevStatus = getPrevStatus(item.status);
                    const nextStatus = getNextStatus(item.status);

                    return (
                      <div
                        key={item.id}
                        onClick={() => onSelectTask?.(item.rawTask)}
                        className={cn(
                          "group relative flex flex-col gap-2.5 rounded-lg border border-border/80 bg-card p-3.5 shadow-2xs transition-all duration-150 hover:border-border hover:shadow-xs active:scale-[0.98] cursor-pointer text-card-foreground",
                          item.level === "TRUONG"
                            ? "border-l-[3px] border-l-blue-600 dark:border-l-blue-400"
                            : "border-l-[3px] border-l-indigo-500 dark:border-l-indigo-400"
                        )}
                      >
                        {/* Top Row: Level Indicator & Category Badge */}
                        <div className="flex items-center justify-between gap-1.5 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            {item.level === "TRUONG" ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800">
                                <Building2 className="size-2.5" />
                                <span>Cấp Trường</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800">
                                <Users className="size-2.5" />
                                <span>Đơn vị</span>
                              </span>
                            )}

                            <span
                              className={cn(
                                "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border",
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
                          <h4 className="text-xs font-semibold text-foreground line-clamp-2 group-hover:text-foreground leading-snug">
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
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
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
                              <span className={cn("truncate", overdue ? "text-destructive font-semibold" : "")}>
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
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
