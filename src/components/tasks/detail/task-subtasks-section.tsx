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
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StaffTask, TaskStatus } from "@/types/dashboard";
import { formatDetailDate } from "@/components/dashboard/task-detail-side-sheet";
import { computeDueStatus, STATUS_OPTIONS, PRIORITY_OPTIONS } from "./task-identity-block";

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
  const [inlineError, setInlineError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  const handleOpenInline = () => {
    setInlineError(null);
    setIsAddingInline(true);
  };

  const handleSaveInline = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle || isSaving) return;

    setIsSaving(true);
    setInlineError(null);
    try {
      if (onCreateSubTaskInline) {
        await onCreateSubTaskInline(trimmedTitle, undefined, newDueDate || undefined);
      } else {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: trimmedTitle,
            parentTaskId: parentId,
            dueDate: newDueDate || undefined,
            scope: "DEPARTMENT",
            priority: "NORMAL",
          }),
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => null);
          const errMsg =
            errJson?.error?.message ||
            errJson?.message ||
            (res.status === 403
              ? "Bạn không có quyền tạo việc thành phần cho nhiệm vụ này (403 Forbidden)"
              : "Không thể tạo việc thành phần. Vui lòng thử lại");
          throw new Error(errMsg);
        }

        if (onAddSubTask) {
          onAddSubTask(parentId);
        }
      }
      setNewTitle("");
      setNewDueDate("");
      setInlineError(null);
      setIsAddingInline(false);
    } catch (err: any) {
      setInlineError(err?.message || "Không thể tạo việc thành phần. Vui lòng thử lại");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section data-slot="task-subtasks-section" className={cn("space-y-3 select-none", className)}>
      {/* Header & Subtask Progress (Linear Style) */}
      <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-normal text-muted-foreground select-none">
            Việc thành phần
          </h2>
          {totalCount > 0 && (
            <span className="font-mono text-[11px] text-muted-foreground font-normal tabular-nums">
              {completedCount}/{totalCount}
            </span>
          )}
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={() => {
              if (onCreateSubTaskInline) {
                handleOpenInline();
              } else if (onAddSubTask) {
                onAddSubTask(parentId);
              }
            }}
            className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Thêm việc thành phần mới"
            aria-label="Thêm việc thành phần mới"
          >
            <Plus className="size-3" strokeWidth={1.5} />
            <span>Thêm việc con</span>
          </button>
        )}
      </div>

      {/* Progress Bar (Visible if there are subtasks) */}
      {totalCount > 0 && (
        <div className="w-full bg-muted/60 rounded-full h-1 overflow-hidden">
          <div
            className="bg-primary h-full transition-all duration-300 rounded-full"
            style={{ width: `${completionPercentage}%` }}
            role="progressbar"
            aria-valuenow={completionPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      )}

      {/* Subtasks List Table (Linear style) */}
      <div className="divide-y divide-border/40 rounded-xl border border-border/50 bg-background overflow-hidden">
        {subTasks.map((st) => {
          const isCompleted = st.status === "COMPLETED";
          const dueStatus = computeDueStatus(st.dueDate);
          const statusObj = STATUS_OPTIONS.find((s) => s.value === st.status) || STATUS_OPTIONS[0];

          return (
            <div
              key={st.id}
              className={cn(
                "group/row flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-muted/40 transition-colors",
                isCompleted && "bg-muted/10"
              )}
            >
              {/* Checkbox + Title */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => onToggleSubtask && onToggleSubtask(st)}
                  disabled={!canEdit}
                  className="text-muted-foreground hover:text-primary transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                  aria-label={isCompleted ? "Đánh dấu chưa xong" : "Đánh dấu hoàn thành"}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="size-4 text-emerald-600 fill-emerald-100" />
                  ) : (
                    <Circle className="size-4 text-muted-foreground/60 hover:text-foreground" />
                  )}
                </button>

                <span
                  onClick={() => onSelectSubtask && onSelectSubtask(st)}
                  className={cn(
                    "text-xs font-medium text-foreground truncate cursor-pointer",
                    isCompleted && "line-through text-muted-foreground/70"
                  )}
                  title={st.title}
                >
                  {st.title}
                </span>
              </div>

              {/* Assignee + Due Date + Status */}
              <div className="flex items-center gap-2 shrink-0 text-xs">
                {/* Assignee */}
                {st.assigneeName && (
                  <div className="flex items-center gap-1 text-muted-foreground max-w-[120px] truncate hidden sm:flex">
                    <div className="size-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[8px] font-bold shrink-0">
                      {st.assigneeName.charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate text-[11px]">{st.assigneeName}</span>
                  </div>
                )}

                {/* Due date */}
                {st.dueDate && (
                  <span
                    className={cn(
                      "font-mono text-[11px] text-muted-foreground tabular-nums hidden md:inline",
                      dueStatus.isOverdue && "text-rose-600 font-semibold"
                    )}
                  >
                    {formatDetailDate(st.dueDate)}
                  </span>
                )}

                {/* Status pill */}
                <span
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-medium border",
                    statusObj.colorClass
                  )}
                >
                  {statusObj.label}
                </span>
              </div>
            </div>
          );
        })}

        {/* Empty state or Inline creation row */}
        {subTasks.length === 0 && !isAddingInline && (
          <div className="py-6 px-4 text-center">
            <p className="text-xs text-muted-foreground">
              Chưa có việc thành phần nào cho nhiệm vụ này.
            </p>
            {canEdit && (
              <button
                type="button"
                onClick={handleOpenInline}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline cursor-pointer"
              >
                <Plus className="size-3" />
                <span>Thêm việc con đầu tiên</span>
              </button>
            )}
          </div>
        )}

        {/* Inline Subtask Creation Form */}
        {isAddingInline && (
          <form
            onSubmit={handleSaveInline}
            className="p-3 bg-muted/20 border-t border-border/40 space-y-2"
          >
            {inlineError && (
              <div className="p-2 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-[11px] flex items-start gap-1.5 leading-snug">
                <AlertCircle className="size-3.5 text-rose-600 shrink-0 mt-0.5" />
                <span>{inlineError}</span>
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                required
                autoFocus
                value={newTitle}
                onChange={(e) => {
                  setNewTitle(e.target.value);
                  if (inlineError) setInlineError(null);
                }}
                placeholder="Tên việc thành phần mới..."
                className="flex-1 min-w-[200px] text-xs font-medium text-foreground bg-background px-2.5 py-1.5 rounded-lg border border-border focus:ring-2 focus:ring-primary/40 focus:outline-hidden"
              />
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => {
                  setNewDueDate(e.target.value);
                  if (inlineError) setInlineError(null);
                }}
                className="text-xs font-mono text-foreground bg-background px-2.5 py-1.5 rounded-lg border border-border focus:ring-2 focus:ring-primary/40 focus:outline-hidden"
              />
              <div className="flex items-center gap-1">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="size-3 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <span>Thêm</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingInline(false)}
                  className="px-2.5 py-1 rounded-md border border-border bg-background text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Hủy
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Button to add more if list exists */}
      {subTasks.length > 0 && !isAddingInline && canEdit && (
        <button
          type="button"
          onClick={handleOpenInline}
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 px-2 py-1 rounded-md transition-colors cursor-pointer"
        >
          <Plus className="size-3.5" strokeWidth={1.5} />
          <span>Thêm việc con...</span>
        </button>
      )}
    </section>
  );
}
