"use client";

import * as React from "react";
import {
  CheckCircle2,
  Circle,
  Plus,
  Calendar,
  UserPlus,
  Users,
  AlertCircle,
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

  return (
    <section data-slot="task-subtasks-section" className={cn("space-y-4 select-none", className)}>
      {/* 1. Header & Quick Actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <h2 className="text-sm font-semibold text-foreground">
            Danh sách việc thành phần
          </h2>
          <span className="font-mono text-xs text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full tabular-nums">
            {completedCount}/{totalCount} hoàn thành
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/70 bg-background hover:bg-muted/50 text-xs font-medium text-foreground transition-colors cursor-pointer"
            title="Thêm việc thành phần mới"
            aria-label="Thêm việc thành phần mới"
          >
            <Plus className="size-3.5" strokeWidth={1.5} />
            <span>Thêm việc con</span>
          </button>
        )}
      </div>

      {/* Progress Bar */}
      {totalCount > 0 && (
        <div className="w-full bg-muted/60 rounded-full h-1.5 overflow-hidden">
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

      {/* 2. Standard 5-Column Table: Nhiệm vụ → Phụ trách → Phối hợp → Thời hạn → Tình trạng */}
      <div className="rounded-xl border border-border/60 bg-background overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border/60 bg-muted/20 text-muted-foreground font-medium">
                <th scope="col" className="py-2.5 pl-4 pr-3 font-medium min-w-[240px]">
                  Nhiệm vụ
                </th>
                <th scope="col" className="py-2.5 px-3 font-medium min-w-[160px]">
                  Phụ trách
                </th>
                <th scope="col" className="py-2.5 px-3 font-medium min-w-[140px]">
                  Phối hợp
                </th>
                <th scope="col" className="py-2.5 px-3 font-medium min-w-[120px]">
                  Thời hạn
                </th>
                <th scope="col" className="py-2.5 pl-3 pr-4 font-medium text-right min-w-[110px]">
                  Tình trạng
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {subTasks.map((st) => {
                const isCompleted = st.status === "COMPLETED";
                const dueStatus = computeDueStatus(st.dueDate);
                const statusObj = STATUS_OPTIONS.find((s) => s.value === st.status) || STATUS_OPTIONS[0];
                const assigneeTitle = formatAssigneeNameWithTitle(st.assigneeName);
                const coAssigneesList = Array.isArray(st.coAssignees) && st.coAssignees.length > 0
                  ? st.coAssignees.map((c: any) => c.name).join(", ")
                  : Array.isArray(st.collaborators) && st.collaborators.length > 0
                  ? st.collaborators.map((c: any) => c.name).join(", ")
                  : "—";

                return (
                  <tr
                    key={st.id}
                    className={cn(
                      "group/row hover:bg-muted/30 transition-colors",
                      isCompleted && "bg-muted/10 text-muted-foreground"
                    )}
                  >
                    {/* Cột 1: Nhiệm vụ (Checkbox + Tên việc con mở drawer) */}
                    <td className="py-3 pl-4 pr-3 align-middle">
                      <div className="flex items-center gap-2.5">
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

                        <button
                          type="button"
                          onClick={() => onSelectSubtask && onSelectSubtask(st)}
                          className={cn(
                            "text-xs font-medium text-foreground hover:text-primary text-left transition-colors cursor-pointer line-clamp-2",
                            isCompleted && "line-through text-muted-foreground/70"
                          )}
                          title={`Xem chi tiết việc con: ${st.title}`}
                        >
                          {st.title}
                        </button>
                      </div>
                    </td>

                    {/* Cột 2: Phụ trách */}
                    <td className="py-3 px-3 align-middle">
                      <div className="flex items-center gap-1.5 text-foreground">
                        <UserPlus className="size-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{assigneeTitle}</span>
                      </div>
                    </td>

                    {/* Cột 3: Phối hợp */}
                    <td className="py-3 px-3 align-middle text-muted-foreground">
                      <div className="flex items-center gap-1.5 max-w-[180px] truncate" title={coAssigneesList}>
                        <Users className="size-3.5 text-muted-foreground/70 shrink-0" />
                        <span className="truncate">{coAssigneesList}</span>
                      </div>
                    </td>

                    {/* Cột 4: Thời hạn */}
                    <td className="py-3 px-3 align-middle">
                      {st.dueDate ? (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="size-3 text-muted-foreground shrink-0" />
                          <span
                            className={cn(
                              "font-mono text-xs tabular-nums",
                              dueStatus.isOverdue && "text-rose-600 font-semibold"
                            )}
                          >
                            {formatDisplayDate(st.dueDate)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>

                    {/* Cột 5: Tình trạng */}
                    <td className="py-3 pl-3 pr-4 align-middle text-right">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border",
                          statusObj.colorClass
                        )}
                      >
                        <span className={cn("size-1.5 rounded-full", statusObj.dotClass)} />
                        <span>{statusObj.label}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}

              {/* Empty state */}
              {subTasks.length === 0 && !isAddingInline && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    <p className="text-xs">Chưa có việc thành phần nào cho nhiệm vụ này.</p>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={handleOpenInline}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline cursor-pointer"
                      >
                        <Plus className="size-3.5" />
                        <span>Thêm việc con đầu tiên</span>
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Inline Subtask Creation Form Row */}
        {isAddingInline && (
          <form
            onSubmit={handleSaveInline}
            className="p-3 bg-muted/20 border-t border-border/40 flex items-center gap-2 flex-wrap"
          >
            {inlineError && (
              <div className="w-full p-2 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-[11px] flex items-center gap-1.5">
                <AlertCircle className="size-3.5 text-rose-600 shrink-0" />
                <span>{inlineError}</span>
              </div>
            )}
            <input
              type="text"
              required
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Tên việc thành phần mới..."
              className="flex-1 min-w-[200px] text-xs font-medium text-foreground bg-background px-2.5 py-1.5 rounded-lg border border-border focus:ring-2 focus:ring-primary/40 focus:outline-hidden"
            />
            <input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="text-xs font-mono text-foreground bg-background px-2.5 py-1.5 rounded-lg border border-border focus:ring-2 focus:ring-primary/40 focus:outline-hidden"
            />
            <div className="flex items-center gap-1">
              <button
                type="submit"
                disabled={isSaving}
                className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? "Đang lưu..." : "Thêm"}
              </button>
              <button
                type="button"
                onClick={() => setIsAddingInline(false)}
                className="px-2.5 py-1.5 rounded-md border border-border bg-background text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Hủy
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
