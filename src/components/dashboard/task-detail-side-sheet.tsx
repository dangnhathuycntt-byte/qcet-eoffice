"use client";

import * as React from "react";
import {
  X,
  Calendar,
  User,
  Users,
  CheckCircle2,
  Circle,
  Plus,
  Layers,
  Clock,
  Tag,
  Building2,
  Briefcase,
  AlertTriangle,
} from "lucide-react";
import type {
  SchoolTask,
  StaffTask,
  TaskCategory,
  TaskStatus,
} from "@/types/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCategoryBadgeConfig } from "./cascading-task-table";

export function isSchoolTask(
  task: SchoolTask | StaffTask | null | undefined
): task is SchoolTask {
  if (!task) return false;
  return "subTasks" in task && Array.isArray(task.subTasks);
}

export function formatDetailDate(dateStr?: string): string {
  if (!dateStr) return "Chưa đặt";
  try {
    const clean = dateStr.split("T")[0];
    const parts = clean.split("-");
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

export const TASK_LEVEL_CONFIG = {
  TRUONG: {
    label: "Nhiệm vụ cấp Trường",
    variant: "secondary" as const,
    className:
      "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300 font-semibold px-2.5 py-0.5",
  },
  DON_VI: {
    label: "Công việc Đơn vị",
    variant: "outline" as const,
    className:
      "border-border/60 bg-muted/40 text-muted-foreground font-semibold px-2.5 py-0.5",
  },
};

export const TASK_STATUS_CONFIG: Record<
  TaskStatus,
  {
    label: string;
    className: string;
    variant: "destructive" | "progress" | "warning" | "success" | "outline";
  }
> = {
  NEW: {
    label: "Mới",
    className:
      "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    variant: "destructive",
  },
  IN_PROGRESS: {
    label: "Đang thực hiện",
    className:
      "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    variant: "progress",
  },
  NEEDS_REVIEW: {
    label: "Cần chỉnh sửa",
    className:
      "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    variant: "warning",
  },
  COMPLETED: {
    label: "Hoàn thành",
    className:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    variant: "success",
  },
};

export function getTaskLevelBadge(isSchool: boolean) {
  return isSchool ? TASK_LEVEL_CONFIG.TRUONG : TASK_LEVEL_CONFIG.DON_VI;
}

export function getDetailStatusConfig(status: TaskStatus | string) {
  if (status in TASK_STATUS_CONFIG) {
    return TASK_STATUS_CONFIG[status as TaskStatus];
  }
  return {
    label: status || "Chưa rõ",
    className:
      "border-border/60 bg-muted/40 text-muted-foreground",
    variant: "outline" as const,
  };
}

function getInitials(name: string): string {
  if (!name) return "QC";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0].charAt(0);
  const last = parts[parts.length - 1].charAt(0);
  return (first + last).toUpperCase();
}

function getRelativeTimeString(
  dueDateStr?: string,
  isCompleted?: boolean
): { text: string; color: string } | null {
  if (isCompleted) {
    return {
      text: "Đã hoàn thành",
      color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    };
  }
  if (!dueDateStr) return null;
  try {
    const now = new Date("2026-09-04T00:00:00");
    const due = new Date(dueDateStr.split("T")[0] + "T00:00:00");
    const diffDays = Math.ceil(
      (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays < 0) {
      return {
        text: `Quá hạn ${Math.abs(diffDays)} ngày`,
        color: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20 font-bold",
      };
    }
    if (diffDays === 0) {
      return {
        text: "Hạn hôm nay",
        color: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20 font-bold",
      };
    }
    if (diffDays <= 3) {
      return {
        text: `Còn ${diffDays} ngày`,
        color: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20 font-medium",
      };
    }
    return {
      text: `Còn ${diffDays} ngày`,
      color: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20 font-medium",
    };
  } catch {
    return null;
  }
}

export interface ActivityNote {
  id: string;
  author: string;
  content: string;
  timestamp: string;
}

export interface TaskDetailSideSheetProps {
  task: SchoolTask | StaffTask | null;
  isOpen?: boolean;
  onClose: () => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  onAddSubTask?: (parentSchoolTaskId: string) => void;
  onSelectSubTask?: (subTask: StaffTask) => void;
  parentSchoolTaskTitle?: string;
  className?: string;
}

export function TaskDetailSideSheet({
  task,
  isOpen,
  onClose,
  onStatusChange,
  onAddSubTask,
  onSelectSubTask,
  parentSchoolTaskTitle,
  className,
}: TaskDetailSideSheetProps) {
  const visible = isOpen !== undefined ? isOpen : task !== null;
  const [newSubtaskTitle, setNewSubtaskTitle] = React.useState("");
  const [isAddingSubtask, setIsAddingSubtask] = React.useState(false);

  // Handle ESC key and scroll lock
  React.useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [visible, onClose]);

  if (!visible || !task) {
    return null;
  }

  const isSchool = isSchoolTask(task);
  const isDone = task.status === "COMPLETED";
  const levelBadge = getTaskLevelBadge(isSchool);
  const statusConfig = getDetailStatusConfig(task.status);
  const assigneeName = isSchool ? task.leadAssigneeName : task.assigneeName;
  const relativeTime = getRelativeTimeString(task.dueDate, isDone);
  const isOverdue =
    !isDone &&
    Boolean(task.dueDate) &&
    new Date(task.dueDate.split("T")[0] + "T00:00:00") <
      new Date("2026-09-04T00:00:00");

  const handleCreateSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim() || !isSchool) return;
    if (onAddSubTask) {
      onAddSubTask(task.id);
    }
    setIsAddingSubtask(false);
    setNewSubtaskTitle("");
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Drawer Panel */}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex h-full w-full sm:max-w-lg md:max-w-xl flex-col border-l border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl animate-in slide-in-from-right duration-300",
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-detail-title"
      >
        {/* Sticky Header Bar: Status & Quick Actions */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/50 px-5 sm:px-6 py-3.5 bg-card/90 backdrop-blur-xl gap-3">
          {/* Status Indicator Pill */}
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border shrink-0",
                isOverdue
                  ? "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  : statusConfig.className
              )}
            >
              <span
                className={cn(
                  "size-2 rounded-full shrink-0",
                  isDone
                    ? "bg-emerald-500"
                    : isOverdue
                    ? "bg-rose-500 animate-ping"
                    : "bg-primary"
                )}
              />
              <span>
                {isOverdue ? "Cảnh báo quá hạn ⚠️" : statusConfig.label}
              </span>
            </span>

            {relativeTime && !isOverdue && (
              <span
                className={cn(
                  "text-[11px] px-2.5 py-0.5 rounded-full border tabular-nums shrink-0 hidden sm:inline",
                  relativeTime.color
                )}
              >
                {relativeTime.text}
              </span>
            )}
          </div>

          {/* Quick Status Select & Close Button */}
          <div className="flex items-center gap-2 shrink-0">
            {onStatusChange && (
              <select
                id="status-select"
                value={task.status}
                onChange={(e) =>
                  onStatusChange(task.id, e.target.value as TaskStatus)
                }
                className="h-7.5 rounded-lg border border-border/60 bg-card px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-all cursor-pointer outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                aria-label="Cập nhật trạng thái nhiệm vụ"
              >
                <option value="NEW">Mới</option>
                <option value="IN_PROGRESS">Đang thực hiện</option>
                <option value="NEEDS_REVIEW">Cần chỉnh sửa</option>
                <option value="COMPLETED">Hoàn thành</option>
              </select>
            )}

            <button
              type="button"
              onClick={onClose}
              className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
              aria-label="Đóng bảng chi tiết"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-6 thin-scrollbar">
          {/* Header Block: Level Badge + Title */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border text-[11px] font-semibold px-2 py-0.5 shadow-2xs",
                  levelBadge.className
                )}
              >
                {isSchool ? (
                  <Building2 className="size-3" />
                ) : (
                  <Briefcase className="size-3" />
                )}
                <span>{levelBadge.label}</span>
              </span>
            </div>

            <h2
              id="task-detail-title"
              className="text-lg sm:text-xl font-bold tracking-tight text-foreground font-heading leading-snug"
            >
              {task.title}
            </h2>

            {/* Parent Task reference (clean title, no raw UUID) */}
            {!isSchool && parentSchoolTaskTitle && (
              <div className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 border border-border/40 rounded-xl px-3 py-2">
                <Layers className="size-3.5 text-primary shrink-0" />
                <span className="shrink-0">Nhiệm vụ cha:</span>
                <span className="font-semibold text-foreground truncate">
                  {parentSchoolTaskTitle}
                </span>
              </div>
            )}

            {/* Quick 1-Click Action Bar for Direct Workflow */}
            {onStatusChange && (
              <div className="mt-3.5 flex items-center gap-2">
                {task.status === "NEW" && (
                  <Button
                    type="button"
                    onClick={() => onStatusChange(task.id, "IN_PROGRESS")}
                    className="flex-1 h-8.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs gap-1.5 cursor-pointer"
                  >
                    <span>📥 Tiếp nhận công việc</span>
                  </Button>
                )}
                {task.status === "IN_PROGRESS" && (
                  <>
                    <Button
                      type="button"
                      onClick={() => onStatusChange(task.id, "COMPLETED")}
                      className="flex-1 h-8.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs gap-1.5 cursor-pointer"
                    >
                      <span>👍 Báo cáo hoàn thành</span>
                    </Button>
                    <button
                      type="button"
                      onClick={() => onStatusChange(task.id, "NEEDS_REVIEW")}
                      className="h-8.5 px-3 text-xs font-medium border border-amber-500/40 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 rounded-xl transition-colors cursor-pointer"
                      title="Chuyển sang trạng thái cần chỉnh sửa"
                    >
                      Cần sửa ⚠️
                    </button>
                  </>
                )}
                {task.status === "NEEDS_REVIEW" && (
                  <Button
                    type="button"
                    onClick={() => onStatusChange(task.id, "IN_PROGRESS")}
                    className="flex-1 h-8.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs gap-1.5 cursor-pointer"
                  >
                    <span>✏️ Tiếp nhận chỉnh sửa</span>
                  </Button>
                )}
                {task.status === "COMPLETED" && (
                  <button
                    type="button"
                    onClick={() => onStatusChange(task.id, "IN_PROGRESS")}
                    className="h-8 px-3 text-xs font-medium border border-border/60 bg-muted/40 text-muted-foreground hover:text-foreground rounded-xl transition-colors cursor-pointer"
                    title="Mở lại công việc để tiếp tục xử lý"
                  >
                    ↩️ Mở lại công việc
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Properties List (Structured like dashboard-chamcong PropertyItem) */}
          <div className="rounded-2xl border border-border/50 bg-card/60 p-4 divide-y divide-border/30 text-xs shadow-xs">
            {/* Delegator / Giao việc */}
            <div className="flex items-center justify-between py-2.5 first:pt-0">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="size-4 text-muted-foreground/70" />
                <span>Người giao việc</span>
              </div>
              <div className="font-semibold text-foreground">
                {isSchool ? "Ban Giám hiệu QCET" : "Trưởng đơn vị quản lý"}
              </div>
            </div>

            {/* Lead / Assignee */}
            <div className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="size-4 text-muted-foreground/70" />
                <span>Cán bộ chủ trì</span>
              </div>
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <span className="flex size-5.5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary border border-primary/20">
                  {getInitials(assigneeName)}
                </span>
                <span>{assigneeName}</span>
              </div>
            </div>

            {/* Category (if SchoolTask) */}
            {isSchool && (
              <div className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Tag className="size-4 text-muted-foreground/70" />
                  <span>Danh mục chuyên môn</span>
                </div>
                <div>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
                      getCategoryBadgeConfig(task.category).className
                    )}
                  >
                    {task.categoryLabel ||
                      getCategoryBadgeConfig(task.category).label}
                  </span>
                </div>
              </div>
            )}

            {/* Due Date */}
            <div className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="size-4 text-muted-foreground/70" />
                <span>Hạn hoàn thành</span>
              </div>
              <div className="flex items-center gap-2 font-mono font-semibold text-foreground tabular-nums">
                <span>{formatDetailDate(task.dueDate)}</span>
                {relativeTime && (
                  <span
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full border font-sans",
                      relativeTime.color
                    )}
                  >
                    {relativeTime.text}
                  </span>
                )}
              </div>
            </div>

            {/* Assigned / Updated Date */}
            <div className="flex items-center justify-between py-2.5 last:pb-0">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="size-4 text-muted-foreground/70" />
                <span>
                  {isSchool ? "Ngày giao nhiệm vụ" : "Cập nhật lần cuối"}
                </span>
              </div>
              <div className="font-mono text-muted-foreground tabular-nums">
                {formatDetailDate(
                  isSchool ? task.assignedDate : task.updatedAt
                )}
              </div>
            </div>

            {/* Co-assignees (SchoolTask only) */}
            {isSchool && task.coAssignees && task.coAssignees.length > 0 && (
              <div className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="size-4 text-muted-foreground/70" />
                  <span>Phối hợp</span>
                </div>
                <div className="flex flex-wrap gap-1.5 justify-end">
                  {task.coAssignees.map((partner) => (
                    <span
                      key={partner}
                      className="inline-flex items-center rounded-md bg-secondary/80 px-2 py-0.5 text-[11px] font-medium text-foreground"
                    >
                      {partner}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Subtasks Section (SchoolTask only) */}
          {isSchool && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-sans text-sm font-bold text-foreground tracking-tight">
                    Tiến độ công việc trực thuộc
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Đã hoàn thành {task.completedSubTasks} / {task.totalSubTasks}{" "}
                    việc con ({task.progressPercent}%)
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsAddingSubtask((v) => !v)}
                  className="h-7.5 gap-1 text-xs border-dashed rounded-lg"
                >
                  <Plus className="size-3.5" />
                  <span>Thêm việc</span>
                </Button>
              </div>

              {/* Progress Track */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-emerald-500 transition-all duration-500 ease-out"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(0, task.progressPercent)
                    )}%`,
                  }}
                />
              </div>

              {/* Inline Add Subtask Form */}
              {isAddingSubtask && (
                <form
                  onSubmit={handleCreateSubtask}
                  className="flex items-center gap-2 rounded-xl border border-border/80 bg-muted/40 p-2 animate-in fade-in"
                >
                  <input
                    type="text"
                    placeholder="Nhập tiêu đề công việc đơn vị..."
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    className="flex-1 bg-transparent px-2 text-xs text-foreground placeholder:text-muted-foreground outline-none"
                    autoFocus
                  />
                  <Button
                    type="submit"
                    size="sm"
                    className="h-7 text-xs px-2.5 rounded-lg font-semibold"
                  >
                    Giao việc
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddingSubtask(false)}
                    className="h-7 text-xs px-2 text-muted-foreground rounded-lg"
                  >
                    Hủy
                  </Button>
                </form>
              )}

              {/* Subtask Clean List */}
              <div className="divide-y divide-border/40 rounded-xl border border-border/50 bg-card overflow-hidden shadow-xs">
                {task.subTasks.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Chưa có công việc đơn vị trực thuộc
                  </div>
                ) : (
                  task.subTasks.map((sub) => {
                    const subStatus = getDetailStatusConfig(sub.status);
                    const subDone = sub.status === "COMPLETED";

                    return (
                      <div
                        key={sub.id}
                        tabIndex={0}
                        onClick={() => onSelectSubTask?.(sub)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onSelectSubTask?.(sub);
                          }
                        }}
                        className="group flex items-center justify-between gap-3 p-3 transition-colors hover:bg-secondary/40 cursor-pointer"
                        role="button"
                        aria-label={`Chi tiết việc con: ${sub.title}`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {subDone ? (
                            <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Circle className="size-4 shrink-0 text-muted-foreground/50" />
                          )}
                          <span
                            className={cn(
                              "text-xs font-medium text-foreground truncate",
                              subDone && "line-through text-muted-foreground"
                            )}
                          >
                            {sub.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="text-[11px] text-muted-foreground hidden sm:inline">
                            {sub.assigneeName}
                          </span>
                          <Badge
                            variant={subStatus.variant}
                            className={cn(
                              "text-[10px] px-2 py-0.5 rounded-md font-medium",
                              subStatus.className
                            )}
                          >
                            {subStatus.label}
                          </Badge>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

export default TaskDetailSideSheet;
