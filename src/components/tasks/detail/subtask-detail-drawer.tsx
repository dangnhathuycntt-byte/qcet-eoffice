"use client";

import * as React from "react";
import { Select } from "@base-ui/react/select";
import { Combobox } from "@base-ui/react/combobox";
import styles from "../task-detail-page.module.css";
import {
  X,
  Signal,
  UserPlus,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Users,
  Plus,
  CircleDashed,
  Activity,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StaffTask, TaskStatus, TaskPriority } from "@/types/dashboard";
import type { AuthUser } from "@/types/auth";
import { STATUS_OPTIONS, PRIORITY_OPTIONS, computeDueStatus } from "./task-identity-block";
import { formatAssigneeNameWithTitle } from "@/lib/format/personnel";
import { usePersonnelList } from "@/hooks/use-personnel-list";
import { formatDisplayDate, formatCompactDate } from "@/lib/format/date";
import { VietnameseDatePicker } from "@/components/ui/vietnamese-date-picker";
import { DirectInlineEditor } from "./direct-inline-editor";
import { TaskBlockEditor } from "./task-block-editor";
import { updateTaskStatus, updateTaskPriority, updateTaskAssignee, updateTaskDueDate, updateTaskStartDate } from "@/lib/tasks/task-actions";
import { useFeedback } from "@/components/ui/feedback-layer";
import { clampPeekWidth, DEFAULT_PEEK_WIDTH, SINGLE_PEEK_WIDTH, MIN_PEEK_WIDTH, MAX_PEEK_WIDTH } from "./subtask-peek-layout";
import {
  taskStateMachine,
  buildActorContext,
  buildTaskContext,
} from "@/domain/tasks/state-machine";

export interface SubtaskDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  subtask: StaffTask | null;
  canEdit?: boolean;
  currentUser?: AuthUser | null;
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

  React.useEffect(() => {
    setSubtask(initialSubtask);
  }, [initialSubtask]);

  // Dropdown states
  const [isReassigning, setIsReassigning] = React.useState(false);
  const { personnel: personnelList } = usePersonnelList();

  // FSM guard: compute allowed status transitions
  const actorContext = React.useMemo(() => buildActorContext(currentUser), [currentUser]);
  const subtaskContext = React.useMemo(() => subtask ? buildTaskContext(subtask) : null, [subtask]);
  const allowedTransitions = React.useMemo(() => {
    if (!subtaskContext) return [];
    return taskStateMachine.getAllowedTransitions(actorContext, subtaskContext, subtask?.status || "NOT_STARTED");
  }, [actorContext, subtaskContext, subtask?.status]);
  const allowedStatusMap = React.useMemo(() => {
    const map = new Map<string, { allowed: boolean; reason?: string }>();
    for (const t of allowedTransitions) {
      map.set(t.status, { allowed: t.allowed, reason: t.reason });
    }
    return map;
  }, [allowedTransitions]);

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


  // Status & Priority objects
  const currentStatusObj =
    STATUS_OPTIONS.find((s) => s.value === subtask?.status) || STATUS_OPTIONS[0];

  const currentPriorityVal =
    (subtask as any)?.priority === "MEDIUM"
      ? "NORMAL"
      : (subtask as any)?.priority || "NORMAL";
  const currentPriorityObj =
    PRIORITY_OPTIONS.find((p) => p.value === currentPriorityVal) || PRIORITY_OPTIONS[2];

  const assigneeDisplay = formatAssigneeNameWithTitle(subtask?.assigneeName, personnelList);

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

  const handlePriorityChange = async (newPriority: TaskPriority) => {
    if (!subtask) return;
    const currentVersion = typeof (subtask as any).version === "number" ? (subtask as any).version : undefined;
    const res = await updateTaskPriority(subtask.id, newPriority, currentVersion);
    if (!res.ok) {
      notifyError(res.error || "Không thể cập nhật độ ưu tiên", "Lỗi cập nhật");
      return;
    }

    const cleanPriority: TaskPriority = newPriority === "MEDIUM" ? "NORMAL" : newPriority;
    const nextVersion = (res.data as any)?.data?.version ?? (res.data as any)?.version ?? (currentVersion ? currentVersion + 1 : 1);
    const updated = { ...subtask, priority: cleanPriority, version: nextVersion };
    setSubtask(updated);
    onSubtaskUpdated?.(updated);
    notifySuccess("Đã cập nhật độ ưu tiên việc thành phần");
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

  if (!isOpen || !subtask) return null;

  // Sibling switcher data
  const currentIndex = siblings.findIndex((st) => st.id === subtask.id);
  const siblingPosition = currentIndex >= 0 ? currentIndex + 1 : 1;
  const siblingTotal = siblings.length;

  const rawDescription = (subtask as any).description || subtask.deliverableDescription || "";
  const description = rawDescription.replace(/^\[Tóm tắt\]\s*/i, "");
  const selectedAssignee = personnelList.find((person) =>
    person.id === (subtask as any).assigneeId || person.name === subtask.assigneeName
  ) || null;

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
          title="Kéo để điều chỉnh độ rộng bảng phụ hoặc nhấp đúp để đặt lại"
          onMouseDown={handleResizeMouseDown}
          onDoubleClick={handleResetWidth}
          className="hidden lg:block absolute -left-3 top-0 bottom-0 w-6 z-50 cursor-col-resize select-none bg-transparent focus:outline-none focus-visible:outline-none touch-none"
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
              const statusObj = STATUS_OPTIONS.find((s) => s.value === sib.status) || STATUS_OPTIONS[0];
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

        <div className="min-h-0 flex-1 flex flex-col overflow-y-auto overflow-x-hidden break-words px-6 pt-5 pb-6 overscroll-contain">
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

          <section aria-label="Thuộc tính việc thành phần" className="mt-3 flex items-center gap-2 flex-wrap text-xs text-muted-foreground font-normal select-none">
            <Select.Root
              value={subtask.status}
              onValueChange={(value) => void handleStatusChange(value as TaskStatus)}
              disabled={!canEdit}
            >
              <Select.Trigger className={cn(
                "inline-flex items-center gap-1.5 py-0.5 rounded text-xs font-normal text-foreground transition-colors outline-none",
                canEdit ? "cursor-pointer hover:text-foreground/70" : "cursor-default"
              )}>
                <CircleDashed className={cn("size-3.5", currentStatusObj.value === "COMPLETED" ? "text-emerald-600" : currentStatusObj.value === "IN_PROGRESS" ? "text-amber-500" : "text-amber-500")} strokeWidth={1.5} />
                <Select.Value>{() => <span>{currentStatusObj.label}</span>}</Select.Value>
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner className="z-50" align="start" sideOffset={4}>
                  <Select.Popup className="w-48 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg">
                    <Select.List>
                      {STATUS_OPTIONS.map((option) => {
                        const isCurrent = option.value === (subtask?.status || "NOT_STARTED");
                        const check = allowedStatusMap.get(option.value === "NOT_STARTED" ? "NEW" : option.value) || { allowed: true };
                        const isDisabled = !isCurrent && !check.allowed;
                        return (
                        <Select.Item
                          key={option.value}
                          value={option.value}
                          disabled={isDisabled}
                          className="flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1 text-left text-xs outline-none data-[highlighted]:bg-muted data-[selected]:bg-primary/10 data-[selected]:font-medium data-[selected]:text-primary data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40"
                        >
                          <span className="flex items-center gap-1.5">
                            <span className={cn("size-1.5 rounded-full", option.dotClass)} />
                            <Select.ItemText>{option.label}</Select.ItemText>
                          </span>
                          <Select.ItemIndicator><Check className="size-3 text-primary" /></Select.ItemIndicator>
                        </Select.Item>
                        );
                      })}
                    </Select.List>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>

            <span>·</span>

            <Combobox.Root
              items={personnelList}
              value={selectedAssignee}
              onValueChange={(person) => {
                if (person) void handleAssigneeChange(person);
              }}
              itemToStringLabel={(person) => person.name}
              itemToStringValue={(person) => person.id}
              isItemEqualToValue={(person, value) => person.id === value.id}
              filter={(person, query) => {
                const normalized = query.trim().toLocaleLowerCase("vi");
                if (!normalized) return true;
                return [person.name, person.email, person.departmentName]
                  .filter(Boolean)
                  .some((text) => text!.toLocaleLowerCase("vi").includes(normalized));
              }}
              autoHighlight
              disabled={!canEdit || isReassigning}
            >
              <Combobox.Trigger
                className={cn(
                  "inline-flex items-center gap-1.5 py-0.5 px-1.5 -mx-1.5 rounded text-xs font-normal text-foreground transition-colors select-none outline-none",
                  canEdit ? "cursor-pointer hover:bg-muted/40 hover:text-foreground" : "cursor-default"
                )}
                title={`Người phụ trách: ${assigneeDisplay} (nhấp để thay đổi)`}
              >
                {isReassigning ? (
                  <Clock3 className="size-3.5 shrink-0 animate-spin text-primary" />
                ) : (
                  <UserPlus className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
                )}
                <span className={cn(
                  "font-normal whitespace-nowrap",
                  selectedAssignee ? "text-foreground" : "text-muted-foreground"
                )}>{assigneeDisplay}</span>
              </Combobox.Trigger>
              <Combobox.Portal>
                <Combobox.Positioner className="z-50" align="start" sideOffset={4}>
                  <Combobox.Popup className="w-64 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg">
                    <Combobox.InputGroup className="m-1 border-b border-border/40 pb-1.5">
                      <Combobox.Input
                        placeholder="Tìm cán bộ..."
                        className="h-8 w-full rounded-md bg-muted/40 px-2 text-xs outline-none focus:bg-background"
                      />
                    </Combobox.InputGroup>
                    <Combobox.Empty className="px-2 py-3 text-center text-[11px] text-muted-foreground">
                      Không tìm thấy cán bộ phù hợp
                    </Combobox.Empty>
                    <Combobox.List className="max-h-64 overflow-y-auto overscroll-contain outline-none">
                      {(person) => (
                        <Combobox.Item
                          key={person.id}
                          value={person}
                          className="flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-left text-xs outline-none data-[highlighted]:bg-muted data-[selected]:bg-primary/10 data-[selected]:text-primary"
                        >
                          <span className="min-w-0">
                            <span className="block truncate">{person.name}</span>
                            {person.departmentName && <span className="block truncate text-[10px] text-muted-foreground">{person.departmentName}</span>}
                          </span>
                          <Combobox.ItemIndicator><Check className="size-3 text-primary" /></Combobox.ItemIndicator>
                        </Combobox.Item>
                      )}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>

            {Array.isArray(subtask.coAssignees) && subtask.coAssignees.length > 0 && (
              <>
                <span>·</span>
                <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="size-3.5 shrink-0" />
                  <span className="truncate">
                    {subtask.coAssignees.map((co: any) => co.name).join(", ")}
                  </span>
                </div>
              </>
            )}

            <span>·</span>

            {/* Ngày bắt đầu → Hạn chót */}
            <div className="inline-flex items-center gap-1 text-xs text-foreground">
              {canEdit ? (
                <VietnameseDatePicker
                  value={startDateIso}
                  onChange={handleStartDateChange}
                  placeholder="Bắt đầu"
                  variant="chip"
                  align="left"
                  className="p-0 h-auto border-0 text-xs font-normal shadow-none hover:bg-transparent"
                />
              ) : (
                <span className="text-muted-foreground">{startDateIso ? formatDisplayDate(startDateIso) : "—"}</span>
              )}
              <span className="text-muted-foreground/60 px-0.5">→</span>
              {canEdit ? (
                <VietnameseDatePicker
                  value={dueDateIso}
                  onChange={handleDueDateChange}
                  placeholder="Hạn chót"
                  variant="chip"
                  showPresets={true}
                  align="left"
                  className="p-0 h-auto border-0 text-xs font-normal shadow-none hover:bg-transparent"
                />
              ) : (
                <span className="text-muted-foreground">{dueDateIso ? formatDisplayDate(dueDateIso) : "Chưa đặt hạn"}</span>
              )}
            </div>
          </section>

          <section className="mt-3 flex flex-1 flex-col">
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
