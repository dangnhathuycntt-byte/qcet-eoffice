"use client";

import * as React from "react";
import styles from "../task-detail-page.module.css";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Users,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StaffTask, TaskStatus } from "@/types/dashboard";
import { computeDueStatus } from "@/domain/tasks/deadlines";
import { CORE_STATUS_OPTIONS as STATUS_OPTIONS, getStatusDisplay } from "@/domain/tasks/display-config";
import { formatAssigneeNameWithTitle } from "@/lib/format/personnel";
import { formatCompactDate, extractDateIso } from "@/lib/format/date";
import { DirectInlineEditor } from "./direct-inline-editor";
import { TaskBlockEditor } from "./task-block-editor";
import { TaskStatusSelect, TaskAssigneePicker, TaskDateRange } from "./task-property-controls";
import { computeSubtaskStatusGuard } from "@/domain/tasks/subtask-status-guard";
import { usePersonnelList } from "@/hooks/use-personnel-list";
import { updateTaskStatus, updateTaskAssignee, updateTaskDueDate, updateTaskStartDate } from "@/lib/tasks/task-actions";
import { useFeedback } from "@/components/ui/feedback-layer";
import { clampPeekWidth, DEFAULT_PEEK_WIDTH, SINGLE_PEEK_WIDTH, MIN_PEEK_WIDTH, MAX_PEEK_WIDTH } from "./subtask-peek-layout";

export interface SubtaskDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  subtask: StaffTask | null;
  canEdit?: boolean;
  currentUser?: any;
  onSubtaskUpdated?: (updated: StaffTask) => void;
  /** All siblings of the current child (parent's subTasks) */
  siblings?: StaffTask[];
  /** Navigate to a sibling child */
  onSelectSibling?: (st: StaffTask) => void;
  /** Open create-subtask flow */
  onAddSubtask?: () => void;
  peekWidth?: number;
  onPeekWidthChange?: (width: number, persist?: boolean) => void;
}

export function SubtaskDetailDrawer({
  isOpen,
  onClose,
  subtask: initialSubtask,
  canEdit = true,
  currentUser,
  onSubtaskUpdated,
  siblings = [],
  onSelectSibling,
  onAddSubtask,
  peekWidth = SINGLE_PEEK_WIDTH,
  onPeekWidthChange,
}: SubtaskDetailDrawerProps) {
  const { notifySuccess, notifyError } = useFeedback();
  const [subtask, setSubtask] = React.useState<StaffTask | null>(initialSubtask);
  const peekContentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setSubtask(initialSubtask);
  }, [initialSubtask]);

  // Dropdown states
  const [isReassigning, setIsReassigning] = React.useState(false);
  const { personnel: personnelList } = usePersonnelList({ enabled: canEdit });

  // Dọn sự kiện kéo cả khi pane đóng hoặc cửa sổ mất focus.
  const stopResizeRef = React.useRef<(() => void) | null>(null);

  const handleResizeMouseDown = React.useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 || !onPeekWidthChange) return;
    e.preventDefault();
    e.stopPropagation();
    stopResizeRef.current?.();
    const paneRight = e.currentTarget.parentElement!.getBoundingClientRect().right;

    const prevCursor = document.body.style.cursor;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    let pendingFrame: number | null = null;
    let latestWidth: number | null = null;
    let renderedWidth: number | null = null;
    const handleMouseMove = (moveEvent: MouseEvent) => {
      latestWidth = Math.round(clampPeekWidth(paneRight - moveEvent.clientX, window.innerWidth));
      if (pendingFrame !== null) return;
      pendingFrame = window.requestAnimationFrame(() => {
        pendingFrame = null;
        if (latestWidth !== null && latestWidth !== renderedWidth) {
          renderedWidth = latestWidth;
          onPeekWidthChange(latestWidth, false);
        }
      });
    };

    const handleMouseUp = () => {
      if (pendingFrame !== null) window.cancelAnimationFrame(pendingFrame);
      if (latestWidth !== null) onPeekWidthChange(latestWidth);
      stopResizeRef.current = null;
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevUserSelect;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("blur", handleMouseUp);
    };

    stopResizeRef.current = handleMouseUp;
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("blur", handleMouseUp);
  }, [onPeekWidthChange]);

  React.useEffect(() => {
    if (!isOpen) stopResizeRef.current?.();
    return () => stopResizeRef.current?.();
  }, [isOpen]);

  const handleResetWidth = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onPeekWidthChange?.(DEFAULT_PEEK_WIDTH);
  }, [onPeekWidthChange]);

  const assigneeDisplay = formatAssigneeNameWithTitle(subtask?.assigneeName, personnelList);

  // Dates
  const startDateIso = extractDateIso((subtask as any)?.startDate);
  const dueDateIso = extractDateIso(subtask?.dueDate);

  // Atomic clear of both dates
  const handleClearDates = async () => {
    if (!subtask) return;
    const currentVersion = typeof (subtask as any).version === "number" ? (subtask as any).version : undefined;
    const [resStart, resDue] = await Promise.allSettled([
      updateTaskStartDate(subtask.id, "", currentVersion),
      updateTaskDueDate(subtask.id, "", currentVersion),
    ]);
    const startOk = resStart.status === "fulfilled" && resStart.value.ok;
    const dueOk = resDue.status === "fulfilled" && resDue.value.ok;
    if (!startOk && !dueOk) {
      notifyError("Không thể xóa ngày", "Lỗi cập nhật");
      return;
    }
    const nextVersion =
      (dueOk ? (resDue as PromiseFulfilledResult<any>).value.data?.data?.version : undefined) ??
      (startOk ? (resStart as PromiseFulfilledResult<any>).value.data?.data?.version : undefined) ??
      currentVersion;
    const updated = { ...subtask, startDate: "", dueDate: "", version: nextVersion } as StaffTask;
    setSubtask(updated);
    onSubtaskUpdated?.(updated);
    notifySuccess("Đã xóa ngày");
  };

  // Handlers
  const handleTitleChange = async (newTitle: string) => {
    if (!subtask) return;
    const cleaned = newTitle.replace(/\r?\n|\r/g, " ").trim();
    if (!cleaned) return;
    const currentVersion = typeof (subtask as any).version === "number" ? (subtask as any).version : undefined;
    const res = await fetch(`/api/tasks/${subtask.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: cleaned,
        ...(currentVersion !== undefined ? { expectedVersion: currentVersion } : {}),
      }),
    });
    if (!res.ok) throw new Error("Không thể lưu tiêu đề việc thành phần");

    const data = await res.json().catch(() => null);
    const nextVersion = data?.data?.version ?? data?.task?.version ?? (currentVersion ? currentVersion + 1 : 1);
    const updated = { ...subtask, title: cleaned, version: nextVersion };
    setSubtask(updated);
    onSubtaskUpdated?.(updated);
  };

  const handleDescriptionChange = async (newDesc: string) => {
    if (!subtask) return;
    const trimmed = newDesc.trim();

    // Skip saving if description unchanged from what we already have
    const currentDesc = (subtask as any).description || subtask.deliverableDescription || "";
    if (trimmed === currentDesc.trim()) return;

    // Fetch latest version from server to avoid OCC conflict
    let latestVersion: number | undefined;
    try {
      const freshRes = await fetch(`/api/tasks/${subtask.id}`);
      if (freshRes.ok) {
        const freshData = await freshRes.json().catch(() => null);
        const freshTask = freshData?.data ?? freshData?.task;
        latestVersion = typeof freshTask?.version === "number" ? freshTask.version : undefined;
      }
    } catch { /* proceed without fresh version */ }

    const versionToSend = latestVersion ?? (typeof (subtask as any).version === "number" ? (subtask as any).version : undefined);

    const res = await fetch(`/api/tasks/${subtask.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: trimmed,
        ...(versionToSend !== undefined ? { expectedVersion: versionToSend } : {}),
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      const serverMsg = errBody?.error || errBody?.message || "";
      throw new Error(serverMsg || "Không thể lưu mô tả việc thành phần");
    }

    const data = await res.json().catch(() => null);
    const nextVersion = data?.data?.version ?? data?.task?.version ?? (versionToSend ? versionToSend + 1 : 1);
    const updated = { ...subtask, deliverableDescription: trimmed, description: trimmed, version: nextVersion } as StaffTask;
    setSubtask(updated);
    onSubtaskUpdated?.(updated);
  };

  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (!subtask) return;
    const currentVersion = typeof (subtask as any).version === "number" ? (subtask as any).version : undefined;
    const res = await updateTaskStatus(subtask.id, newStatus, undefined, currentVersion);
    if (!res.ok) {
      notifyError(res.reason || res.error || "Không thể cập nhật trạng thái nhiệm vụ thành phần", "Lỗi đổi trạng thái");
      return;
    }

    const nextVersion = (res.data as any)?.version ?? (res.data as any)?.data?.version ?? (currentVersion ? currentVersion + 1 : 1);
    const updated = { ...subtask, status: newStatus, version: nextVersion };
    setSubtask(updated);
    onSubtaskUpdated?.(updated);
    notifySuccess("Đã cập nhật trạng thái việc thành phần");
  };

  const handleAssigneeChange = async (person: { id: string; name: string }) => {
    if (!subtask) return;
    setIsReassigning(true);
    const result = await updateTaskAssignee(subtask.id, person.id, person.name);
    setIsReassigning(false);
    if (!result.ok) {
      notifyError(result.error || "Không thể cập nhật người phụ trách", "Lỗi cập nhật");
      return;
    }

    const currentVersion = typeof (subtask as any).version === "number" ? (subtask as any).version : undefined;
    const nextVersion = (result.data as any)?.data?.version ?? (result.data as any)?.version ?? (currentVersion ? currentVersion + 1 : 1);
    const updated = {
      ...subtask,
      assigneeId: person.id,
      assigneeName: person.name,
      version: nextVersion,
    } as StaffTask;
    setSubtask(updated);
    onSubtaskUpdated?.(updated);
    notifySuccess("Đã cập nhật người phụ trách việc thành phần");
  };

  const handleStartDateChange = async (newStartDate: string) => {
    if (!subtask) return;
    const res = await updateTaskStartDate(subtask.id, newStartDate, (subtask as any).version);
    if (!res.ok) {
      notifyError(res.error || "Không thể cập nhật ngày bắt đầu", "Lỗi cập nhật");
      return;
    }

    const nextVersion = (res.data as any)?.data?.version ?? (res.data as any)?.task?.version ?? (subtask as any).version;
    const updated = { ...subtask, startDate: newStartDate, version: nextVersion } as StaffTask;
    setSubtask(updated);
    onSubtaskUpdated?.(updated);
    notifySuccess("Đã cập nhật ngày bắt đầu việc con");
  };

  const handleDueDateChange = async (newDueDate: string) => {
    if (!subtask) return;
    const res = await updateTaskDueDate(subtask.id, newDueDate, (subtask as any).version);
    if (!res.ok) {
      notifyError(res.error || "Không thể cập nhật hạn hoàn thành", "Lỗi cập nhật");
      return;
    }

    const nextVersion = (res.data as any)?.data?.version ?? (res.data as any)?.task?.version ?? (subtask as any).version;
    const updated = { ...subtask, dueDate: newDueDate, version: nextVersion };
    setSubtask(updated);
    onSubtaskUpdated?.(updated);
    notifySuccess("Đã cập nhật hạn hoàn thành việc con");
  };

  // Peek keyboard: Esc closes, ArrowUp/ArrowDown navigates siblings
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable ||
        !!target?.closest("[role='combobox'], [role='listbox'], [role='menu'], [data-slate-editor]");
      if (isEditing) return;

      if (e.key === "Escape") {
        onClose();
        return;
      }

      // ArrowUp/ArrowDown — navigate siblings
      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && onSelectSibling && siblings.length > 1) {
        e.preventDefault();
        const currentIdx = subtask ? siblings.findIndex((st) => st.id === subtask.id) : -1;
        if (currentIdx === -1) return;
        const direction = e.key === "ArrowDown" ? 1 : -1;
        const nextIdx = (currentIdx + direction + siblings.length) % siblings.length;
        onSelectSibling(siblings[nextIdx]);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, onSelectSibling, siblings, subtask]);

  // Guard chuyển trạng thái — dùng quyền của chính việc con (hook phải ở trước early return)
  const statusGuard = React.useMemo(() => {
    if (!subtask) return null;
    return computeSubtaskStatusGuard(
      subtask as any,
      currentUser,
      (subtask as any).availableActions,
    );
  }, [subtask, currentUser]);

  if (!isOpen || !subtask) return null;

  // Sibling switcher data
  const currentIndex = siblings.findIndex((st) => st.id === subtask.id);
  const siblingPosition = currentIndex >= 0 ? currentIndex + 1 : 1;
  const siblingTotal = siblings.length;

  const rawDescription = (subtask as any).description || subtask.deliverableDescription || "";
  const description = rawDescription.replace(/^\[Tóm tắt\]\s*/i, "");

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-2xs animate-in fade-in duration-200 motion-reduce:animate-none lg:hidden"
      />

      <aside
        role="dialog"
        aria-label={`Chi tiết việc thành phần: ${subtask.title}`}
        className={styles.peekSurface}
      >
        {/* Left Resize Handle for Desktop */}
        <div
          role="separator"
          aria-orientation="vertical"
          tabIndex={0}
          aria-valuemin={MIN_PEEK_WIDTH}
          aria-valuemax={MAX_PEEK_WIDTH}
          aria-valuenow={Math.round(peekWidth)}
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home"].includes(event.key)) return;
            event.preventDefault();
            const width = event.key === "Home" ? SINGLE_PEEK_WIDTH : peekWidth + (event.key === "ArrowLeft" ? 20 : -20);
            onPeekWidthChange?.(clampPeekWidth(width, window.innerWidth));
          }}
          aria-label="Kéo để điều chỉnh độ rộng bảng phụ hoặc nhấp đúp để đặt lại"
          onMouseDown={handleResizeMouseDown}
          onDoubleClick={handleResetWidth}
          className="hidden lg:block absolute -left-1 top-0 bottom-0 w-2 z-50 cursor-col-resize select-none focus-visible:outline-2 focus-visible:outline-ring"
        />

        {/* Header chi tiết việc con */}
        <div className="group/peek-header flex h-12 shrink-0 items-center justify-between border-b border-border/60 px-4 select-none">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-medium text-foreground truncate">
              Chi tiết việc con
            </span>
            {siblingTotal > 0 && (
              <span className="text-[11px] font-mono tabular-nums text-muted-foreground bg-muted/60 px-1.5 py-0.2 rounded-full">
                {siblingPosition}/{siblingTotal}
              </span>
            )}
            {onSelectSibling && siblingTotal > 1 && (
              <>
                <button
                  type="button"
                  disabled={currentIndex <= 0}
                  onClick={() => currentIndex > 0 && onSelectSibling(siblings[currentIndex - 1])}
                  className="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:cursor-default transition-colors"
                  aria-label="Việc con trước"
                  title="Việc con trước (↑)"
                >
                  <ChevronLeft className="size-3" />
                </button>
                <button
                  type="button"
                  disabled={currentIndex >= siblingTotal - 1}
                  onClick={() => currentIndex < siblingTotal - 1 && onSelectSibling(siblings[currentIndex + 1])}
                  className="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:cursor-default transition-colors"
                  aria-label="Việc con tiếp theo"
                  title="Việc con tiếp theo (↓)"
                >
                  <ChevronRight className="size-3" />
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-1">
            {onAddSubtask && (
              <button
                type="button"
                onClick={onAddSubtask}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
                title="Thêm việc con"
                aria-label="Thêm việc con"
              >
                <Plus className="size-3.5" strokeWidth={1.5} />
                <span>Thêm</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground active:scale-[0.96] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title="Đóng (Esc)"
              aria-label="Đóng chi tiết việc con"
            >
              <X className="size-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Dải danh sách việc con nhỏ gọn (Compact Horizontal Subtasks Bar) */}
        {siblings.length > 0 && (
          <div
            role="tablist"
            aria-label="Danh sách việc con"
            className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border/60 bg-muted/15 overflow-x-auto thin-scrollbar select-none shrink-0"
          >
            <span className="text-[11px] font-medium text-muted-foreground shrink-0 pl-1 pr-0.5">
              Việc con:
            </span>
            {siblings.map((sib) => {
              const isSelected = sib.id === subtask.id;
              const statusObj = getStatusDisplay(sib.status);
              const isCompleted = sib.status === "COMPLETED";
              const formattedDueDate = sib.dueDate ? formatCompactDate(sib.dueDate, "") : "";
              const rawAssignee = sib.assigneeName?.trim();
              const assigneeName = rawAssignee ? formatAssigneeNameWithTitle(rawAssignee, personnelList) : "";

              return (
                <button
                  key={sib.id}
                  role="tab"
                  aria-selected={isSelected}
                  type="button"
                  onClick={() => {
                    if (!isSelected && onSelectSibling) onSelectSibling(sib);
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs whitespace-nowrap transition-colors cursor-pointer shrink-0",
                    isSelected
                      ? "bg-background text-foreground font-medium shadow-2xs border border-border ring-1 ring-primary/25"
                      : "bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground border border-transparent"
                  )}
                  title={`${sib.title}${rawAssignee ? ` • ${rawAssignee}` : ""}${formattedDueDate ? ` • Hạn ${formattedDueDate}` : ""}`}
                >
                  <span className={cn("size-1.5 shrink-0 rounded-full", statusObj.dotClass)} />
                  {computeDueStatus(sib.dueDate).isOverdue && (
                    <span className="size-1 shrink-0 rounded-full bg-rose-500" aria-hidden="true" />
                  )}
                  <span
                    className={cn(
                      "truncate",
                      isSelected ? "max-w-[200px] sm:max-w-[260px]" : "max-w-[130px] sm:max-w-[170px]",
                      isCompleted && "line-through opacity-70"
                    )}
                  >
                    {sib.title}
                  </span>
                  {(assigneeName || formattedDueDate) && (
                    <span className="text-[10px] text-muted-foreground/70 font-normal">
                      {formattedDueDate ? `· ${formattedDueDate}` : ""}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div
          ref={peekContentRef}
          className="min-h-0 flex-1 flex flex-col overflow-y-auto overflow-x-hidden break-words px-6 pt-5 pb-6 overscroll-contain cursor-text"
          onClick={(e) => {
            if (!canEdit) return;
            const target = e.target as HTMLElement;
            if (target !== peekContentRef.current) return;
            // Click on content padding → focus editor at end
            const editable = peekContentRef.current?.querySelector<HTMLElement>(
              "[data-slot='task-block-editor'] [contenteditable='true']"
            );
            if (!editable) return;
            editable.focus();
            const sel = window.getSelection();
            if (sel && editable.lastChild) {
              const range = document.createRange();
              range.selectNodeContents(editable);
              range.collapse(false);
              sel.removeAllRanges();
              sel.addRange(range);
            }
          }}
        >
              {/* Child title first */}
              <div className="space-y-1.5">
            <DirectInlineEditor
              value={subtask.title}
              onSave={handleTitleChange}
              canEdit={canEdit}
              as="h2"
              multiline={false}
              submitOnEnter={true}
              ariaLabel="Tên việc thành phần"
              placeholder="Nhập tên việc thành phần..."
              viewClassName="text-[21px] font-semibold tracking-tight text-foreground leading-snug break-words whitespace-pre-wrap"
              editorClassName="text-[21px] font-semibold tracking-tight text-foreground leading-snug break-words whitespace-pre-wrap"
            />
          </div>

          <section aria-label="Thuộc tính việc thành phần" className="mt-4 flex flex-row flex-wrap items-center gap-x-3 gap-y-1 text-xs select-none cursor-default">
            <TaskStatusSelect
              value={subtask.status}
              options={statusGuard?.options.map((opt) => ({
                value: opt.status as TaskStatus,
                label: opt.label,
                dotClass: getStatusDisplay(opt.status).dotClass,
                iconClass: getStatusDisplay(opt.status).iconClass,
                disabled: opt.disabled,
                reason: opt.reason,
              })) ?? STATUS_OPTIONS.map((opt) => ({ ...opt, disabled: false }))}
              disabled={!canEdit || statusGuard?.readonly}
              onValueChange={(value) => void handleStatusChange(value as TaskStatus)}
            />

            <TaskAssigneePicker
              items={personnelList}
              assigneeId={(subtask as any).assigneeId}
              assigneeName={subtask.assigneeName}
              displayName={assigneeDisplay}
              disabled={!canEdit}
              pending={isReassigning}
              onSelect={handleAssigneeChange}
            />

            {Array.isArray(subtask.coAssignees) && subtask.coAssignees.length > 0 && (
              <div className="inline-flex min-h-7 items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-muted/40">
                <Users className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate text-muted-foreground">
                  {subtask.coAssignees.map((co: any) => co.name).join(", ")}
                </span>
              </div>
            )}

            <TaskDateRange
              startDateIso={startDateIso}
              dueDateIso={dueDateIso}
              canEdit={canEdit}
              onStartDateChange={handleStartDateChange}
              onDueDateChange={handleDueDateChange}
              onClearDates={handleClearDates}
            />
          </section>

          <section className="mt-3 flex flex-1 flex-col cursor-text">
            {!description && !canEdit && (
              <p className="text-xs text-muted-foreground/50 italic px-1 mb-1.5">Chưa có mô tả.</p>
            )}
            <TaskBlockEditor
              key={subtask.id}
              taskId={subtask.id}
              initialDescription={description}
              onSaveContent={handleDescriptionChange}
              canEdit={canEdit}
              globalFileDrop={false}
            />
          </section>
        </div>
      </aside>
    </>
  );
}
