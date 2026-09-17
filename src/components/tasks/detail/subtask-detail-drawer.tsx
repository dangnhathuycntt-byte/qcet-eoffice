"use client";

import * as React from "react";
import {
  X,
  ExternalLink,
  ArrowLeft,
  CircleDashed,
  Signal,
  UserPlus,
  Calendar,
  Check,
  CheckCircle2,
  Circle,
  FileText,
  Users,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StaffTask, TaskStatus, TaskPriority } from "@/types/dashboard";
import { STATUS_OPTIONS, PRIORITY_OPTIONS, computeDueStatus } from "./task-identity-block";
import { formatAssigneeNameWithTitle } from "@/lib/format/personnel";
import { formatDisplayDate } from "@/lib/format/date";
import { VietnameseDatePicker } from "@/components/ui/vietnamese-date-picker";
import { DirectInlineEditor } from "./direct-inline-editor";
import { updateTaskStatus, updateTaskPriority, updateTaskDueDate, updateTaskStartDate } from "@/lib/tasks/task-actions";
import Link from "next/link";

export interface SubtaskDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  subtask: StaffTask | null;
  parentTaskTitle: string;
  parentTaskCode?: string;
  canEdit?: boolean;
  onSubtaskUpdated?: (updated: StaffTask) => void;
  onOpenAnotherSubtask?: (subtask: StaffTask) => void;
  onNavigateBackHistory?: () => void;
  hasHistoryPrev?: boolean;
  historyPrevTitle?: string;
}

export function SubtaskDetailDrawer({
  isOpen,
  onClose,
  subtask: initialSubtask,
  parentTaskTitle,
  parentTaskCode,
  canEdit = true,
  onSubtaskUpdated,
  onOpenAnotherSubtask,
  onNavigateBackHistory,
  hasHistoryPrev = false,
  historyPrevTitle,
}: SubtaskDetailDrawerProps) {
  const [subtask, setSubtask] = React.useState<StaffTask | null>(initialSubtask);

  React.useEffect(() => {
    setSubtask(initialSubtask);
  }, [initialSubtask]);

  // Dropdown states
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = React.useState(false);
  const [isPriorityDropdownOpen, setIsPriorityDropdownOpen] = React.useState(false);

  // Status & Priority objects
  const currentStatusObj =
    STATUS_OPTIONS.find((s) => s.value === subtask?.status) || STATUS_OPTIONS[0];

  const currentPriorityVal =
    (subtask as any)?.priority === "MEDIUM"
      ? "NORMAL"
      : (subtask as any)?.priority || "NORMAL";
  const currentPriorityObj =
    PRIORITY_OPTIONS.find((p) => p.value === currentPriorityVal) || PRIORITY_OPTIONS[2];

  const assigneeDisplay = formatAssigneeNameWithTitle(subtask?.assigneeName);

  // Dates
  const rawStartDate = (subtask as any)?.startDate;
  const startDateIso = rawStartDate
    ? typeof rawStartDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(rawStartDate)
      ? rawStartDate.slice(0, 10)
      : new Date(rawStartDate).toISOString().slice(0, 10)
    : "";

  const dueDateIso = subtask?.dueDate
    ? typeof subtask.dueDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(subtask.dueDate)
      ? subtask.dueDate.slice(0, 10)
      : new Date(subtask.dueDate).toISOString().slice(0, 10)
    : "";

  const dueInfo = computeDueStatus(subtask?.dueDate);

  // Handlers
  const handleTitleChange = async (newTitle: string) => {
    if (!subtask) return;
    const res = await fetch(`/api/tasks/${subtask.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle }),
    });
    if (!res.ok) throw new Error("Không thể lưu tiêu đề việc thành phần");

    const updated = { ...subtask, title: newTitle };
    setSubtask(updated);
    onSubtaskUpdated?.(updated);
  };

  const handleDescriptionChange = async (newDesc: string) => {
    if (!subtask) return;
    const res = await fetch(`/api/tasks/${subtask.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: newDesc }),
    });
    if (!res.ok) throw new Error("Không thể lưu mô tả việc thành phần");

    const updated = { ...subtask, deliverableDescription: newDesc } as StaffTask;
    setSubtask(updated);
    onSubtaskUpdated?.(updated);
  };

  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (!subtask) return;
    setIsStatusDropdownOpen(false);
    const res = await updateTaskStatus(subtask.id, newStatus);
    if (!res.ok) return;

    const updated = { ...subtask, status: newStatus };
    setSubtask(updated);
    onSubtaskUpdated?.(updated);
  };

  const handlePriorityChange = async (newPriority: TaskPriority) => {
    if (!subtask) return;
    setIsPriorityDropdownOpen(false);
    const res = await updateTaskPriority(subtask.id, newPriority);
    if (!res.ok) return;

    const cleanPriority: TaskPriority = newPriority === "MEDIUM" ? "NORMAL" : newPriority;
    const updated = { ...subtask, priority: cleanPriority };
    setSubtask(updated);
    onSubtaskUpdated?.(updated);
  };

  const handleStartDateChange = async (newStartDate: string) => {
    if (!subtask) return;
    const res = await updateTaskStartDate(subtask.id, newStartDate);
    if (!res.ok) return;

    const updated = { ...subtask, startDate: newStartDate } as StaffTask;
    setSubtask(updated);
    onSubtaskUpdated?.(updated);
  };

  const handleDueDateChange = async (newDueDate: string) => {
    if (!subtask) return;
    const res = await updateTaskDueDate(subtask.id, newDueDate);
    if (!res.ok) return;

    const updated = { ...subtask, dueDate: newDueDate };
    setSubtask(updated);
    onSubtaskUpdated?.(updated);
  };

  // Keyboard shortcut: Escape để đóng drawer (khi không sửa text)
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const target = e.target as HTMLElement | null;
        const isEditing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
        if (!isEditing) {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !subtask) return null;

  return (
    <>
      {/* Backdrop (chỉ trên mobile hoặc mờ nhẹ) */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 bg-black/20 backdrop-blur-2xs z-40 lg:bg-transparent lg:pointer-events-none transition-opacity"
      />

      {/* Drawer Container: Chiếm 440px trên desktop, toàn màn hình trên mobile */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Chi tiết việc thành phần: ${subtask.title}`}
        className={cn(
          "fixed top-0 right-0 bottom-0 z-50 flex flex-col bg-background border-l border-border shadow-2xl transition-transform duration-200 ease-out",
          "w-full sm:w-[480px] lg:w-[460px] xl:w-[500px]"
        )}
      >
        {/* 1. Header: Back to parent, Stack history, Full page CTA, Close CTA */}
        <div className="h-13 px-4 border-b border-border/60 flex items-center justify-between gap-2 shrink-0 bg-background/95 backdrop-blur-md select-none">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* Nếu có lịch sử việc trước đó trong cùng drawer */}
            {hasHistoryPrev && onNavigateBackHistory ? (
              <button
                type="button"
                onClick={onNavigateBackHistory}
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 px-2 py-1 rounded-md transition-colors cursor-pointer"
                title={`Quay lại: ${historyPrevTitle || "Việc trước"}`}
              >
                <ArrowLeft className="size-3.5" />
                <span className="truncate max-w-[140px]">{historyPrevTitle || "Quay lại"}</span>
              </button>
            ) : (
              /* Link / Quay về nhiệm vụ cha */
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors truncate max-w-[240px] cursor-pointer"
                title={`Thuộc nhiệm vụ: ${parentTaskTitle}`}
              >
                <ArrowLeft className="size-3.5 shrink-0" />
                <span className="truncate">
                  {parentTaskCode ? `${parentTaskCode} · ` : ""}
                  {parentTaskTitle}
                </span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Nút Mở toàn trang */}
            <Link
              href={`/tasks/${subtask.id}`}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border/60 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title="Mở toàn trang"
            >
              <ExternalLink className="size-3.5" />
              <span className="hidden sm:inline">Mở toàn trang</span>
            </Link>

            {/* Nút Đóng */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
              title="Đóng (Esc)"
              aria-label="Đóng chi tiết việc con"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* 2. Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* A. Title with DirectInlineEditor */}
          <div className="space-y-1">
            <DirectInlineEditor
              value={subtask.title}
              onSave={handleTitleChange}
              canEdit={canEdit}
              as="h2"
              multiline={false}
              submitOnEnter={true}
              ariaLabel="Tên việc thành phần"
              placeholder="Nhập tên việc thành phần..."
              viewClassName="text-lg sm:text-xl font-semibold tracking-tight text-foreground leading-snug"
              editorClassName="text-lg sm:text-xl font-semibold tracking-tight text-foreground leading-snug"
            />
            <p className="text-xs text-muted-foreground">
              Việc thành phần thuộc{" "}
              <span className="font-medium text-foreground">{parentTaskTitle}</span>
            </p>
          </div>

          {/* B. Compact Properties Grid */}
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 space-y-2.5 text-xs">
            {/* Status */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Trạng thái</span>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => canEdit && setIsStatusDropdownOpen((prev) => !prev)}
                  disabled={!canEdit}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs transition-colors",
                    canEdit ? "cursor-pointer hover:bg-muted/50" : "cursor-default"
                  )}
                >
                  <span className={cn("size-2 rounded-full", currentStatusObj.dotClass)} />
                  <span className="font-medium text-foreground">{currentStatusObj.label}</span>
                </button>

                {isStatusDropdownOpen && (
                  <div
                    role="listbox"
                    className="absolute right-0 top-full mt-1.5 w-44 rounded-xl border border-border bg-white p-1 text-foreground shadow-xl z-30"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleStatusChange(opt.value)}
                        className={cn(
                          "w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors text-left cursor-pointer",
                          subtask.status === opt.value
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-foreground hover:bg-muted"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className={cn("size-2 rounded-full", opt.dotClass)} />
                          <span>{opt.label}</span>
                        </div>
                        {subtask.status === opt.value && (
                          <Check className="size-3 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Priority */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Độ ưu tiên</span>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => canEdit && setIsPriorityDropdownOpen((prev) => !prev)}
                  disabled={!canEdit}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs transition-colors",
                    canEdit ? "cursor-pointer hover:bg-muted/50" : "cursor-default"
                  )}
                >
                  <Signal className={cn("size-3.5", currentPriorityObj.iconClass)} />
                  <span className="font-medium text-foreground">{currentPriorityObj.label}</span>
                </button>

                {isPriorityDropdownOpen && (
                  <div
                    role="listbox"
                    className="absolute right-0 top-full mt-1.5 w-44 rounded-xl border border-border bg-white p-1 text-foreground shadow-xl z-30"
                  >
                    {PRIORITY_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handlePriorityChange(opt.value)}
                        className={cn(
                          "w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors text-left cursor-pointer",
                          currentPriorityVal === opt.value
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-foreground hover:bg-muted"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Signal className={cn("size-3.5", opt.iconClass)} />
                          <span>{opt.label}</span>
                        </div>
                        {currentPriorityVal === opt.value && (
                          <Check className="size-3 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Assignee */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Người phụ trách</span>
              <div className="inline-flex items-center gap-1.5 text-foreground font-normal">
                <UserPlus className="size-3.5 text-muted-foreground" />
                <span>{assigneeDisplay}</span>
              </div>
            </div>

            {/* Dates: Start -> Due Date */}
            <div className="flex items-center justify-between gap-2 pt-0.5 border-t border-border/40">
              <span className="text-muted-foreground">Thời hạn</span>
              <div className="flex items-center gap-1">
                {canEdit ? (
                  <VietnameseDatePicker
                    value={startDateIso}
                    onChange={handleStartDateChange}
                    placeholder="Bắt đầu"
                    variant="chip"
                    align="right"
                    className="p-0 border-0 text-xs shadow-none hover:bg-transparent"
                  />
                ) : (
                  <span>{startDateIso ? formatDisplayDate(startDateIso) : "Chưa đặt"}</span>
                )}
                <span className="text-muted-foreground/60">→</span>
                {canEdit ? (
                  <VietnameseDatePicker
                    value={dueDateIso}
                    onChange={handleDueDateChange}
                    placeholder="Hạn chót"
                    variant="chip"
                    align="right"
                    className="p-0 border-0 text-xs shadow-none hover:bg-transparent"
                  />
                ) : (
                  <span className={cn(dueInfo.isOverdue && "text-rose-600 font-semibold")}>
                    {dueDateIso ? formatDisplayDate(dueDateIso) : "Chưa đặt"}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* C. Description Section with DirectInlineEditor */}
          <section className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <FileText className="size-3.5 text-primary" />
              <span>Nội dung & Yêu cầu thực hiện</span>
            </div>
            <div className="p-3 rounded-xl border border-border/60 bg-card/40">
              <DirectInlineEditor
                value={(subtask as any)?.description || subtask.deliverableDescription || ""}
                onSave={handleDescriptionChange}
                canEdit={canEdit}
                multiline={true}
                as="div"
                submitOnEnter={false}
                minRows={3}
                ariaLabel="Mô tả việc thành phần"
                placeholder="Thêm mô tả chi tiết, hướng dẫn hoặc yêu cầu cụ thể..."
                viewClassName="text-xs leading-relaxed text-foreground min-h-[48px]"
                editorClassName="text-xs leading-relaxed text-foreground min-h-[48px]"
              />
            </div>
          </section>

          {/* D. Co-assignees / Phối hợp nếu có */}
          {Array.isArray(subtask.coAssignees) && subtask.coAssignees.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Users className="size-3.5 text-primary" />
                <span>Người phối hợp ({subtask.coAssignees.length})</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {subtask.coAssignees.map((co: any) => (
                  <span
                    key={co.id || co.name}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/60 text-xs text-foreground"
                  >
                    {co.name}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      </aside>
    </>
  );
}
