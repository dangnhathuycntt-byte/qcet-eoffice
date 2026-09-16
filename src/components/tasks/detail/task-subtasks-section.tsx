"use client";

import * as React from "react";
import {
  ListTodo,
  CheckCircle2,
  Circle,
  Plus,
  User,
  Calendar,
  Clock,
  ChevronRight,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StaffTask, TaskStatus } from "@/types/dashboard";
import { formatDetailDate } from "@/components/dashboard/task-detail-side-sheet";
import { computeDueStatus } from "./task-identity-block";

export interface TaskSubtasksSectionProps {
  parentId: string;
  subTasks: StaffTask[];
  canEdit?: boolean;
  onToggleSubtask?: (subtask: StaffTask) => Promise<void> | void;
  onSelectSubtask?: (subtask: StaffTask) => void;
  onAddSubTask?: (parentId: string) => void;
  onCreateSubTaskInline?: (title: string, assigneeName?: string, dueDate?: string) => Promise<void> | void;
  className?: string;
}

export function TaskSubtasksSection({
  parentId,
  subTasks = [],
  canEdit = true,
  onToggleSubtask,
  onSelectSubtask,
  onAddSubTask,
  onCreateSubTaskInline,
  className,
}: TaskSubtasksSectionProps) {
  const totalCount = subTasks.length;
  const completedCount = subTasks.filter((s) => s.status === "COMPLETED").length;
  const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Inline creation state
  const [isAddingInline, setIsAddingInline] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState("");
  const [newDueDate, setNewDueDate] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);

  const handleSaveInline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || isSaving) return;

    setIsSaving(true);
    try {
      if (onCreateSubTaskInline) {
        await onCreateSubTaskInline(newTitle.trim(), undefined, newDueDate || undefined);
      } else if (onAddSubTask) {
        onAddSubTask(parentId);
      }
      setNewTitle("");
      setNewDueDate("");
      setIsAddingInline(false);
    } catch {
      // transient
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section data-slot="task-subtasks-section" className={cn("space-y-3", className)}>
      {/* Header & Subtask Completion Progress */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ListTodo className="size-4 text-primary shrink-0" strokeWidth={1.5} />
          <h2 className="text-xs font-semibold text-foreground">
            Việc thành phần ({completedCount}/{totalCount})
          </h2>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={() => {
              if (onCreateSubTaskInline) {
                setIsAddingInline(true);
              } else if (onAddSubTask) {
                onAddSubTask(parentId);
              }
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border/80 bg-background hover:bg-muted/80 text-xs font-semibold text-foreground transition-colors cursor-pointer shadow-2xs"
            title="Thêm việc thành phần mới"
            aria-label="Thêm việc thành phần mới"
          >
            <Plus className="size-3.5 text-primary" strokeWidth={1.5} />
            <span>Thêm việc con</span>
          </button>
        )}
      </div>

      {/* Progress Bar (Visible if there are subtasks) */}
      {totalCount > 0 && (
        <div className="space-y-1">
          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-primary h-full transition-all duration-300 rounded-full"
              style={{ width: `${completionPercentage}%` }}
              role="progressbar"
              aria-valuenow={completionPercentage}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <div className="flex justify-between items-center text-[11px] text-muted-foreground">
            <span>Tiến độ hoàn thành việc con</span>
            <span className="font-mono font-semibold text-foreground tabular-nums">
              {completionPercentage}%
            </span>
          </div>
        </div>
      )}

      {/* Inline Subtask Creation Form */}
      {isAddingInline && (
        <form
          onSubmit={handleSaveInline}
          className="p-3 rounded-xl border border-primary/40 bg-primary/5 space-y-2.5 animate-in fade-in-0 duration-150"
        >
          <div className="space-y-1">
            <input
              type="text"
              required
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Tên việc thành phần cần thực hiện..."
              className="w-full text-xs font-medium text-foreground bg-background px-2.5 py-1.5 rounded-lg border border-border focus:ring-2 focus:ring-primary/40 focus:outline-hidden"
              aria-label="Tên việc thành phần mới"
            />
          </div>
          <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="size-3.5" strokeWidth={1.5} />
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="text-xs bg-background border border-border rounded px-2 py-1 text-foreground focus:outline-hidden"
                aria-label="Hạn hoàn thành việc con"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="submit"
                disabled={isSaving || !newTitle.trim()}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Check className="size-3.5" strokeWidth={1.5} />
                )}
                <span>Lưu việc con</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAddingInline(false)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border bg-background text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="size-3.5" strokeWidth={1.5} />
                <span>Hủy</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Subtasks List */}
      {totalCount === 0 && !isAddingInline ? (
        <div className="p-4 rounded-xl border border-dashed border-border/80 bg-muted/20 text-center space-y-1.5">
          <p className="text-xs text-muted-foreground">
            Chưa có việc thành phần nào cho nhiệm vụ này.
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                if (onCreateSubTaskInline) {
                  setIsAddingInline(true);
                } else if (onAddSubTask) {
                  onAddSubTask(parentId);
                }
              }}
              className="text-xs text-primary font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="size-3" strokeWidth={1.5} />
              <span>Thêm việc con đầu tiên</span>
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-border/60 rounded-xl border border-border/70 bg-card overflow-hidden shadow-2xs">
          {subTasks.map((st) => {
            const isCompleted = st.status === "COMPLETED";
            const dueInfo = computeDueStatus(st.dueDate);

            return (
              <div
                key={st.id}
                className={cn(
                  "flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-muted/50 transition-colors group/subtask",
                  isCompleted && "bg-muted/20"
                )}
              >
                {/* Left: Checkbox & Subtask Title */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => onToggleSubtask?.(st)}
                    disabled={!canEdit}
                    className={cn(
                      "size-5 rounded-md flex items-center justify-center transition-all cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden",
                      isCompleted
                        ? "bg-emerald-600 text-white"
                        : "border border-border/80 hover:border-primary text-transparent hover:text-primary/40 bg-background"
                    )}
                    aria-label={
                      isCompleted
                        ? `Đánh dấu chưa hoàn thành việc con: ${st.title}`
                        : `Đánh dấu hoàn thành việc con: ${st.title}`
                    }
                  >
                    <Check className="size-3.5 stroke-[1.5]" />
                  </button>

                  <div className="min-w-0 flex-1">
                    <p
                      onClick={() => onSelectSubtask?.(st)}
                      className={cn(
                        "text-xs font-medium text-foreground truncate cursor-pointer hover:text-primary transition-colors",
                        isCompleted && "line-through text-muted-foreground"
                      )}
                      title={st.title}
                    >
                      {st.title}
                    </p>
                  </div>
                </div>

                {/* Right: Assignee & Due Date */}
                <div className="flex items-center gap-2.5 shrink-0 text-xs">
                  {st.assigneeName && (
                    <div
                      className="hidden sm:flex items-center gap-1 text-muted-foreground"
                      title={`Người phụ trách: ${st.assigneeName}`}
                    >
                      <User className="size-3" strokeWidth={1.5} />
                      <span className="max-w-[100px] truncate text-[11px]">
                        {st.assigneeName}
                      </span>
                    </div>
                  )}

                  {st.dueDate && (
                    <span
                      className={cn(
                        "text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded",
                        dueInfo.isOverdue && !isCompleted
                          ? "text-rose-700 bg-rose-50 font-semibold"
                          : "text-muted-foreground bg-muted/50"
                      )}
                      title={formatDetailDate(st.dueDate)}
                    >
                      {dueInfo.text}
                    </span>
                  )}

                  {onSelectSubtask && (
                    <button
                      type="button"
                      onClick={() => onSelectSubtask(st)}
                      className="opacity-0 group-hover/subtask:opacity-100 p-1 text-muted-foreground hover:text-foreground rounded transition-opacity cursor-pointer"
                      title="Xem chi tiết việc con"
                      aria-label="Xem chi tiết việc con"
                    >
                      <ChevronRight className="size-3.5" strokeWidth={1.5} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
