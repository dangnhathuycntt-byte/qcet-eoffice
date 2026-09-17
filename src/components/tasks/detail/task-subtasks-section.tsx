"use client";

import * as React from "react";
import {
  CheckCircle2,
  Circle,
  CircleDot,
  Clock,
  Plus,
  Calendar,
  User,
  MoreHorizontal,
  AlertCircle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StaffTask } from "@/types/dashboard";
import { formatDisplayDate } from "@/lib/format/date";
import { formatAssigneeNameWithTitle } from "@/lib/format/personnel";
import { computeDueStatus, STATUS_OPTIONS } from "./task-identity-block";

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
      } else if (onAddSubTask) {
        onAddSubTask(parentId);
      }
      setNewTitle("");
      setNewDueDate("");
      setIsAddingInline(false);
    } catch {
      setInlineError("Không thể tạo việc thành phần. Vui lòng thử lại.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = (e: React.MouseEvent, st: StaffTask) => {
    e.stopPropagation();
    if (onToggleSubtask) {
      onToggleSubtask(st);
    }
  };

  return (
    <section data-slot="task-subtasks-section" className={cn("space-y-2 select-none w-full", className)}>
      {/* 1. Header: "Việc thành phần" + progress "0/0" + nút "+ Thêm việc con" */}
      <div className="flex items-center justify-between gap-2 py-1 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-xs font-semibold text-foreground tracking-tight">
            Việc thành phần
          </h2>
          <span className="font-mono text-xs text-muted-foreground bg-muted/60 px-1.5 py-0.2 rounded-full tabular-nums">
            {completedCount}/{totalCount}
          </span>
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
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-foreground hover:bg-muted border border-border/60 hover:border-border transition-colors cursor-pointer"
            title="Thêm việc con"
            aria-label="Thêm việc con"
          >
            <Plus className="size-3.5" strokeWidth={1.5} />
            <span>Thêm việc con</span>
          </button>
        )}
      </div>

      {/* 2. Empty State (Tối giản, không card/box lớn, không lặp nút thêm) */}
      {totalCount === 0 && !isAddingInline && (
        <div className="py-8 px-3 text-center select-none">
          <p className="text-xs font-medium text-muted-foreground">
            Chưa có việc thành phần
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Tạo việc con để phân rã nhiệm vụ này.
          </p>
        </div>
      )}

      {/* 3. Inline Subtask Creation Row (Linear Style) */}
      {isAddingInline && (
        <div className="space-y-1.5">
          <form
            onSubmit={handleSaveInline}
            className="h-10 sm:h-11 flex items-center gap-2 px-3 rounded-lg border border-primary/40 bg-muted/20 text-xs"
          >
            <Circle className="size-4 text-muted-foreground/40 shrink-0" />
            <input
              type="text"
              required
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setIsAddingInline(false);
                  setInlineError(null);
                }
              }}
              placeholder="Tên việc con mới... (Enter để lưu, Esc để hủy)"
              className="flex-1 min-w-0 bg-transparent text-xs font-normal text-foreground placeholder:text-muted-foreground/60 focus:outline-hidden"
            />
            <input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="text-xs font-mono text-muted-foreground bg-transparent px-1.5 py-0.5 rounded border border-border/40 focus:outline-hidden"
            />
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="submit"
                disabled={isSaving || !newTitle.trim()}
                className="px-2.5 py-1 rounded bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? "Đang lưu..." : "Thêm"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddingInline(false);
                  setInlineError(null);
                }}
                className="p-1 rounded text-muted-foreground hover:text-foreground cursor-pointer"
                title="Hủy"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </form>

          {inlineError && (
            <div className="p-2 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-[11px] flex items-center gap-1.5">
              <AlertCircle className="size-3.5 text-rose-600 shrink-0" />
              <span>{inlineError}</span>
            </div>
          )}
        </div>
      )}

      {/* 4. Danh sách khi có dữ liệu (Compact sub-issue list) */}
      {totalCount > 0 && (
        <div className="flex flex-col gap-0.5">
          {/* Header nhẹ chỉ hiển thị khi danh sách lớn (> 5 items) */}
          {totalCount > 5 && (
            <div className="flex items-center gap-3 px-3 py-1 text-[11px] font-medium text-muted-foreground/70 border-b border-border/30 select-none">
              <div className="w-5 shrink-0" />
              <div className="flex-1 min-w-0">Nhiệm vụ</div>
              <div className="w-28 shrink-0 hidden sm:block">Phụ trách</div>
              <div className="w-20 sm:w-24 shrink-0">Thời hạn</div>
              <div className="w-24 sm:w-28 shrink-0 text-right pr-6">Tình trạng</div>
            </div>
          )}

          {/* Subtask rows */}
          {subTasks.map((st) => {
            const isCompleted = st.status === "COMPLETED";
            const dueStatus = computeDueStatus(st.dueDate);
            const statusObj =
              STATUS_OPTIONS.find((s) => s.value === st.status) || STATUS_OPTIONS[0];
            const assigneeTitle = formatAssigneeNameWithTitle(st.assigneeName) || "Chưa giao";

            return (
              <div
                key={st.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectSubtask && onSelectSubtask(st)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectSubtask && onSelectSubtask(st);
                  }
                }}
                className={cn(
                  "group flex items-center gap-3 px-3 h-10 sm:h-11 rounded-lg transition-colors cursor-pointer border border-transparent hover:bg-muted/40 hover:border-border/40 focus-visible:outline-hidden focus-visible:bg-muted/50 select-none",
                  isCompleted && "opacity-85"
                )}
              >
                {/* 1. Status icon (click to toggle) */}
                <button
                  type="button"
                  onClick={(e) => handleToggle(e, st)}
                  className="size-5 shrink-0 flex items-center justify-center rounded hover:bg-muted/80 transition-colors cursor-pointer focus-visible:outline-hidden"
                  title={isCompleted ? "Đánh dấu chưa hoàn thành" : "Đánh dấu hoàn thành"}
                  aria-label={isCompleted ? "Đánh dấu chưa hoàn thành" : "Đánh dấu hoàn thành"}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="size-4 text-emerald-600 transition-transform group-hover:scale-105" />
                  ) : st.status === "IN_PROGRESS" ? (
                    <CircleDot className="size-4 text-blue-600" />
                  ) : st.status === "WAITING_APPROVAL" ? (
                    <Clock className="size-4 text-amber-600" />
                  ) : (
                    <Circle className="size-4 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors" />
                  )}
                </button>

                {/* 2. Tên việc (chiếm phần lớn width) */}
                <div className="flex-1 min-w-0 pr-2">
                  <span
                    className={cn(
                      "text-xs font-normal text-foreground truncate block",
                      isCompleted && "line-through text-muted-foreground/70"
                    )}
                    title={st.title}
                  >
                    {st.title}
                  </span>
                </div>

                {/* 3. Phụ trách */}
                <div className="shrink-0 w-28 hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                  <User className="size-3 text-muted-foreground/60 shrink-0" />
                  <span className="truncate" title={assigneeTitle}>
                    {assigneeTitle}
                  </span>
                </div>

                {/* 4. Hạn */}
                <div className="shrink-0 w-20 sm:w-24 flex items-center gap-1.5 text-xs">
                  {st.dueDate ? (
                    <>
                      <Calendar className="size-3 text-muted-foreground/60 shrink-0" />
                      <span
                        className={cn(
                          "font-mono text-xs tabular-nums text-muted-foreground truncate",
                          dueStatus.isOverdue && "text-rose-600 font-semibold"
                        )}
                      >
                        {formatDisplayDate(st.dueDate)}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground/40 text-xs">—</span>
                  )}
                </div>

                {/* 5. Trạng thái */}
                <div className="shrink-0 w-24 sm:w-28 flex items-center justify-end">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border leading-none",
                      statusObj.colorClass
                    )}
                  >
                    <span className={cn("size-1.5 rounded-full", statusObj.dotClass)} />
                    <span className="truncate">{statusObj.label}</span>
                  </span>
                </div>

                {/* Action "..." khi hover */}
                <div className="w-5 shrink-0 flex items-center justify-end">
                  <span
                    className="opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 p-0.5 rounded text-muted-foreground hover:text-foreground transition-opacity"
                    title="Chi tiết việc con"
                  >
                    <MoreHorizontal className="size-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
