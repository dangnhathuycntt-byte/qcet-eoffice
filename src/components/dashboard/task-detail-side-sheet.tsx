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
  MessageSquare,
  Clock,
  Send,
  Tag,
  Check,
  Building2,
  Briefcase,
  AlertCircle,
  Sparkles,
  ArrowRight,
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
      "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200 font-medium px-2.5 py-1",
  },
  DON_VI: {
    label: "Công việc Đơn vị",
    variant: "outline" as const,
    className:
      "border-border bg-muted/60 text-muted-foreground font-medium px-2.5 py-1",
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
      "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300",
    variant: "destructive",
  },
  IN_PROGRESS: {
    label: "Đang thực hiện",
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
    variant: "progress",
  },
  NEEDS_REVIEW: {
    label: "Cần chỉnh sửa",
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    variant: "warning",
  },
  COMPLETED: {
    label: "Hoàn thành",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
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
      "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
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

  // Local state for interactive discussion notes
  const [notes, setNotes] = React.useState<ActivityNote[]>([]);
  const [newNote, setNewNote] = React.useState("");
  const [newSubtaskTitle, setNewSubtaskTitle] = React.useState("");
  const [isAddingSubtask, setIsAddingSubtask] = React.useState(false);

  // Synchronize initial mock notes when task changes
  React.useEffect(() => {
    if (task) {
      const isSchool = isSchoolTask(task);
      const initialNotes: ActivityNote[] = [
        {
          id: "init-1",
          author: isSchool ? task.leadAssigneeName : task.assigneeName,
          content: isSchool
            ? `Nhiệm vụ cấp Trường được giao phụ trách. Hạn chót: ${formatDetailDate(task.dueDate)}.`
            : `Đã tiếp nhận công việc từ nhiệm vụ cấp Trường.`,
          timestamp: isSchool ? task.assignedDate || "Hôm nay" : task.updatedAt || "Hôm nay",
        },
      ];
      if (task.status === "COMPLETED") {
        initialNotes.push({
          id: "init-2",
          author: "Hệ thống QCET",
          content: "Đã đánh dấu hoàn thành 100% chỉ tiêu được giao.",
          timestamp: "Vừa xong",
        });
      }
      setNotes(initialNotes);
      setNewNote("");
      setIsAddingSubtask(false);
      setNewSubtaskTitle("");
    }
  }, [task]);

  // Esc key listener and body scroll lock
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
  const levelBadge = getTaskLevelBadge(isSchool);
  const statusConfig = getDetailStatusConfig(task.status);
  const assigneeName = isSchool ? task.leadAssigneeName : task.assigneeName;

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    const note: ActivityNote = {
      id: `note-${Date.now()}`,
      author: "Lãnh đạo Ban",
      content: newNote.trim(),
      timestamp: "Vừa xong",
    };
    setNotes((prev) => [note, ...prev]);
    setNewNote("");
  };

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
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[3px] transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Drawer with smooth entry */}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col border-l border-border/70 bg-card/95 backdrop-blur-md shadow-2xl sm:max-w-xl animate-in slide-in-from-right duration-300",
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-detail-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/70 px-6 py-4 bg-card/80 backdrop-blur-xs">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border text-xs font-semibold px-3 py-1 shadow-2xs",
                levelBadge.className
              )}
            >
              {isSchool ? <Building2 className="size-3.5" /> : <Briefcase className="size-3.5" />}
              <span>{levelBadge.label}</span>
            </span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="size-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
            aria-label="Đóng"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 thin-scrollbar">
          {/* Status Selector & Title */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  Trạng thái:
                </span>
                <Badge
                  variant={statusConfig.variant}
                  className={cn("text-xs font-semibold rounded-md", statusConfig.className)}
                >
                  {statusConfig.label}
                </Badge>
              </div>

              {/* Quick Status Selector */}
              <div className="flex items-center gap-1.5">
                <label htmlFor="status-select" className="sr-only">
                  Cập nhật trạng thái
                </label>
                <select
                  id="status-select"
                  value={task.status}
                  onChange={(e) =>
                    onStatusChange?.(task.id, e.target.value as TaskStatus)
                  }
                  className="rounded-lg border border-border/80 bg-background px-3 py-1 text-xs font-medium text-foreground shadow-2xs hover:bg-muted/50 focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
                >
                  <option value="NEW">Mới</option>
                  <option value="IN_PROGRESS">Đang thực hiện</option>
                  <option value="NEEDS_REVIEW">Cần chỉnh sửa</option>
                  <option value="COMPLETED">Hoàn thành</option>
                </select>
              </div>
            </div>

            {/* Task Title */}
            <h2
              id="task-detail-title"
              className="font-sans text-xl font-bold tracking-tight text-foreground leading-snug"
            >
              {task.title}
            </h2>

            {/* Parent SchoolTask indicator for StaffTask */}
            {!isSchool && (
              <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/40 p-3 text-xs text-muted-foreground">
                <Layers className="size-4 shrink-0 text-primary" />
                <div className="flex-1 truncate">
                  Thuộc nhiệm vụ cấp Trường:{" "}
                  <strong className="font-semibold text-foreground">
                    {parentSchoolTaskTitle || task.parentSchoolTaskId}
                  </strong>
                </div>
              </div>
            )}
          </div>

          {/* Key Attributes Section (Metadata Grid) */}
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4.5 space-y-3.5 text-xs shadow-xs">
            <h3 className="font-sans text-xs font-bold text-foreground uppercase tracking-wider text-muted-foreground/90 flex items-center gap-1.5">
              <span>Thông tin nhiệm vụ</span>
            </h3>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              {/* Category (if SchoolTask) */}
              {isSchool && (
                <div className="flex items-start gap-2.5">
                  <Tag className="size-4 mt-0.5 text-primary shrink-0" />
                  <div>
                    <div className="text-muted-foreground text-[11px] font-medium">
                      Phân loại danh mục
                    </div>
                    <div className="mt-1">
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
                </div>
              )}

              {/* Lead / Assignee */}
              <div className="flex items-start gap-2.5">
                <User className="size-4 mt-0.5 text-primary shrink-0" />
                <div>
                  <div className="text-muted-foreground text-[11px] font-medium">
                    {isSchool ? "Chủ trì nhiệm vụ" : "Cán bộ phụ trách"}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary border border-primary/20">
                      {getInitials(assigneeName)}
                    </span>
                    <span className="font-semibold text-foreground">
                      {assigneeName}
                    </span>
                  </div>
                </div>
              </div>

              {/* Due Date */}
              <div className="flex items-start gap-2.5">
                <Calendar className="size-4 mt-0.5 text-primary shrink-0" />
                <div>
                  <div className="text-muted-foreground text-[11px] font-medium">
                    Hạn hoàn thành
                  </div>
                  <div className="mt-1 font-mono font-semibold text-foreground">
                    {formatDetailDate(task.dueDate)}
                  </div>
                </div>
              </div>

              {/* Created / Assigned Date */}
              <div className="flex items-start gap-2.5">
                <Clock className="size-4 mt-0.5 text-primary shrink-0" />
                <div>
                  <div className="text-muted-foreground text-[11px] font-medium">
                    {isSchool ? "Ngày giao nhiệm vụ" : "Cập nhật lần cuối"}
                  </div>
                  <div className="mt-1 font-mono text-muted-foreground">
                    {formatDetailDate(
                      isSchool ? task.assignedDate : task.updatedAt
                    )}
                  </div>
                </div>
              </div>

              {/* Co-assignees if SchoolTask */}
              {isSchool && task.coAssignees && task.coAssignees.length > 0 && (
                <div className="flex items-start gap-2.5 sm:col-span-2">
                  <Users className="size-4 mt-0.5 text-primary shrink-0" />
                  <div className="flex-1">
                    <div className="text-muted-foreground text-[11px] font-medium">
                      Cán bộ phối hợp ({task.coAssignees.length})
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {task.coAssignees.map((name, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 rounded-md bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-secondary-foreground border border-border/80"
                        >
                          <span className="size-3.5 rounded-full bg-muted flex items-center justify-center text-[8px] font-bold">
                            {getInitials(name)}
                          </span>
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Rollup Progress & Subtasks (SchoolTask only) */}
          {isSchool && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-sans text-sm font-bold text-foreground tracking-tight">
                    Tiến độ công việc trực thuộc
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Đã hoàn thành {task.completedSubTasks} / {task.totalSubTasks}{" "}
                    việc con ({task.progressPercent}%)
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsAddingSubtask((v) => !v)}
                  className="h-8 gap-1 text-xs border-dashed rounded-lg"
                >
                  <Plus className="size-3.5" />
                  Thêm việc con
                </Button>
              </div>

              {/* Progress Bar */}
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted border border-border/40">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, task.progressPercent))}%` }}
                />
              </div>

              {/* Inline Add Subtask Form */}
              {isAddingSubtask && (
                <form
                  onSubmit={handleCreateSubtask}
                  className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 p-2.5 animate-fade-in"
                >
                  <input
                    type="text"
                    placeholder="Nhập tiêu đề việc con cần giao..."
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    className="flex-1 bg-transparent px-2.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-lg"
                    autoFocus
                  />
                  <Button type="submit" size="sm" className="h-7.5 text-xs px-3 rounded-lg font-semibold">
                    Giao việc
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddingSubtask(false)}
                    className="h-7.5 text-xs px-2.5 text-muted-foreground rounded-lg"
                  >
                    Hủy
                  </Button>
                </form>
              )}

              {/* Subtask Embedded List */}
              <div className="divide-y divide-border/60 rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
                {task.subTasks.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Chưa có công việc đơn vị con nào được phân rã
                  </div>
                ) : (
                  task.subTasks.map((sub) => {
                    const subStatus = getDetailStatusConfig(sub.status);
                    const isDone = sub.status === "COMPLETED";

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
                        className="group flex items-center justify-between gap-3 p-3 transition-colors hover:bg-muted/40 focus-visible:outline-hidden focus-visible:bg-muted/60 cursor-pointer"
                        role="button"
                        aria-label={`Chi tiết việc con: ${sub.title}`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {isDone ? (
                            <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Circle className="size-4 shrink-0 text-muted-foreground/60" />
                          )}
                          <span
                            className={cn(
                              "text-xs font-medium text-foreground truncate",
                              isDone && "line-through text-muted-foreground"
                            )}
                          >
                            {sub.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Assignee Avatar */}
                          <div
                            className="flex items-center gap-1 text-[11px] text-muted-foreground"
                            title={sub.assigneeName}
                          >
                            <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[9px] font-bold border border-border">
                              {getInitials(sub.assigneeName)}
                            </span>
                            <span className="hidden sm:inline">
                              {sub.assigneeName}
                            </span>
                          </div>

                          <Badge
                            variant={subStatus.variant}
                            className={cn("text-[10px] px-2 py-0.5 rounded-md font-semibold", subStatus.className)}
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

          {/* Timeline & Discussion Notes */}
          <div className="space-y-3.5 pt-2 border-t border-border/80">
            <div className="flex items-center justify-between">
              <h3 className="font-sans text-sm font-bold text-foreground tracking-tight flex items-center gap-1.5">
                <MessageSquare className="size-4 text-primary" />
                <span>Ghi chú điều hành & Nhật ký</span>
              </h3>
              <span className="text-[11px] text-muted-foreground font-medium">
                {notes.length} bản ghi
              </span>
            </div>

            {/* Note input form */}
            <form onSubmit={handleAddNote} className="space-y-2">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={2}
                placeholder="Thêm ý kiến chỉ đạo, phản hồi tiến độ hoặc ghi chú..."
                className="w-full resize-none rounded-xl border border-border/80 bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  disabled={!newNote.trim()}
                  className="h-8 gap-1.5 px-3.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-card"
                >
                  <Send className="size-3" />
                  <span>Gửi ghi chú</span>
                </Button>
              </div>
            </form>

            {/* Activity Stream */}
            <div className="space-y-2.5 pt-1">
              {notes.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-border/60 bg-muted/25 p-3 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-foreground">
                      {item.author}
                    </span>
                    <span className="text-muted-foreground font-mono text-[10px]">
                      {item.timestamp}
                    </span>
                  </div>
                  <p className="text-foreground/90 text-xs leading-relaxed">
                    {item.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t border-border bg-card px-6 py-3.5">
          <div className="text-xs text-muted-foreground">
            Phím tắt: <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd> để đóng
          </div>
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs font-semibold rounded-lg">
            Đóng
          </Button>
        </div>
      </aside>
    </>
  );
}

export default TaskDetailSideSheet;
