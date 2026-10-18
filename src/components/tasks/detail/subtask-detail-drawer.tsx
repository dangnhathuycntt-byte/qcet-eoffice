"use client";

import * as React from "react";
import styles from "../task-detail-page.module.css";
import { X, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { TaskIconCollaborators } from "@qcet/shared/lib/icons/task-icons";
import { SubtaskOutlineRail } from "./subtask-outline-rail";
import { TaskStatusSelect, TaskAssigneePicker, TaskDateRange } from "./task-property-controls";
import type { StaffTask, TaskStatus } from "@qcet/contracts/types/dashboard";
import type { AuthUser } from "@qcet/contracts/types/auth";
import { STATUS_OPTIONS } from "@qcet/shared/domain/tasks/display-config";
import { normalizeDisplayStatus } from "@qcet/shared/domain/tasks/canonical-semantics";
import { formatAssigneeNameWithTitle } from "@/lib/format/personnel";
import { usePersonnelList } from "@/hooks/use-personnel-list";
import { getTaskUnitId } from "@qcet/shared/lib/tasks/task-unit";
import { DirectInlineEditor } from "./direct-inline-editor";
import { markSelectionStartTarget } from "./block-selection-canvas";
import { TaskBlockEditor } from "./task-block-editor";
import { updateTaskStatus, updateTaskAssignee, updateTaskDueDate, updateTaskStartDate } from "@/lib/tasks/task-actions";
import { useFeedback } from "@/components/ui/feedback-layer";
import { clampPeekWidth, DEFAULT_PEEK_WIDTH, SINGLE_PEEK_WIDTH, MIN_PEEK_WIDTH, MAX_PEEK_WIDTH } from "./subtask-peek-layout";
import { ResizeGrip } from "@/components/ui/pane-resize-handle";
import {
  taskStateMachine,
  buildActorContext,
  buildTaskContext,
} from "@qcet/shared/domain/tasks/state-machine";

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

  // Kết quả lưu có thể về sau khi người dùng đã chuyển sang việc con khác: chỉ cập nhật khung đang mở khi
  // vẫn đúng việc con đó (không đè việc con mới chọn), còn danh sách ở trang cha thì luôn được cập nhật.
  const commitSubtask = (updated: StaffTask) => {
    setSubtask((prev) => (prev && prev.id === updated.id ? updated : prev));
    onSubtaskUpdated?.(updated);
  };

  // Dưới 1024px khung phủ toàn màn hình (có lớp nền) → coi như modal
  const [isMobileOverlay, setIsMobileOverlay] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const sync = () => setIsMobileOverlay(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Dropdown states
  const [isReassigning, setIsReassigning] = React.useState(false);
  const { personnel: personnelList, isLoading: personnelLoading } = usePersonnelList({ departmentId: getTaskUnitId(subtask) });

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

  // Mapper việc con trả về "NEW" cho NOT_STARTED: chuẩn hóa về bộ 4 trạng thái của dropdown
  // để không thêm nhầm một mục "Mới" thứ hai vào cuối danh sách.
  const currentStatusValue = subtask ? normalizeDisplayStatus(subtask.status) : "NOT_STARTED";

  const statusChoices = React.useMemo(() => {
    const current = currentStatusValue;
    const options = STATUS_OPTIONS;
    return options.map((option) => {
        const check = allowedStatusMap.get(option.value === "NOT_STARTED" ? "NEW" : option.value) || { allowed: true, reason: undefined };
        const isCurrent = option.value === current;
        return {
          value: option.value,
          label: option.label,
          dotClass: option.dotClass,
          iconClass: option.iconClass,
          disabled: !isCurrent && !check.allowed,
          reason: !isCurrent && !check.allowed ? check.reason : undefined,
        };
    });
  }, [allowedStatusMap, currentStatusValue]);

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


  // Quyền theo từng thao tác, cùng điều kiện máy chủ kiểm: sửa tên/mô tả cần task.update_metadata,
  // đổi người phụ trách cần task.reassign, đổi hạn chót cần task.assign (ngày bắt đầu chỉ cần task.update_metadata).
  // `canEdit` (thực hiện) giữ cho trạng thái.
  const subtaskActions = (subtask as { availableActions?: unknown } | null)?.availableActions;
  const allows = (action: string) => canEdit && (!Array.isArray(subtaskActions) || subtaskActions.includes(action));
  const canEditContent = allows("task.update_metadata");
  const canReassign = allows("task.reassign");
  const canChangeDueDate = allows("task.assign");

  // Hiển thị tên người phụ trách; chức danh không thay thế tên
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
    commitSubtask(updated);
  };

  const handleDescriptionChange = async (newDesc: string) => {
    if (!subtask) return;
    const trimmed = newDesc.trim();

    // Skip saving if description unchanged from what we already have
    const currentDesc = (subtask as any).description || subtask.deliverableDescription || "";
    if (trimmed === currentDesc.trim()) return;

    const currentVersion = typeof (subtask as any).version === "number" ? (subtask as any).version : undefined;

    const res = await fetch(`/api/tasks/${subtask.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: trimmed,
        ...(currentVersion !== undefined ? { expectedVersion: currentVersion } : {}),
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      const serverMsg = errBody?.error || errBody?.message || "";
      throw new Error(serverMsg || "Không thể lưu mô tả việc thành phần");
    }

    const data = await res.json().catch(() => null);
    const nextVersion = data?.data?.version ?? data?.task?.version ?? (currentVersion ? currentVersion + 1 : 1);
    const updated = { ...subtask, deliverableDescription: trimmed, description: trimmed, version: nextVersion } as StaffTask;
    commitSubtask(updated);
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
    commitSubtask(updated);
    notifySuccess("Đã cập nhật trạng thái việc thành phần");
  };

  const handleAssigneeChange = async (person: { id: string; name: string }): Promise<void> => {
    if (!subtask) return;
    setIsReassigning(true);
    const result = await updateTaskAssignee(subtask.id, person.id, person.name, (subtask as any).version);
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
    commitSubtask(updated);
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
    commitSubtask(updated);
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
    commitSubtask(updated);
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

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-2xs motion-reduce:animate-none lg:hidden"
      />

      <aside
        key="subtask-drawer"
        role="dialog"
        aria-modal={isMobileOverlay ? true : undefined}
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
          className="group/resize hidden lg:block absolute -left-3 top-0 bottom-0 w-6 z-50 cursor-col-resize select-none bg-transparent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden touch-none"
        >
          <ResizeGrip />
        </div>

        {/* Thanh vạch mỏng ở mép trái khung: chọn nhanh việc con (chỉ khi có từ 2 việc con) */}
        {onSelectSibling && siblings.length > 1 && (
          <SubtaskOutlineRail
            subTasks={siblings}
            activeSubtaskId={subtask.id}
            onSelectSubtask={onSelectSibling}
          />
        )}

        {/* Header chi tiết việc con: điều hướng trước/sau + vị trí, hành động bên phải */}
        <div className="group/peek-header flex h-10 shrink-0 items-center justify-between border-b border-border/60 px-3 select-none">
          <div className="flex items-center gap-1 min-w-0">
            {onSelectSibling && siblingTotal > 1 && (
              <div className="flex items-center">
                <button
                  type="button"
                  disabled={currentIndex <= 0}
                  onClick={() => currentIndex > 0 && onSelectSibling(siblings[currentIndex - 1])}
                  className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:cursor-default transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
                  aria-label="Việc con trước"
                  title="Việc con trước (↑)"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  disabled={currentIndex >= siblingTotal - 1}
                  onClick={() => currentIndex < siblingTotal - 1 && onSelectSibling(siblings[currentIndex + 1])}
                  className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:cursor-default transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
                  aria-label="Việc con tiếp theo"
                  title="Việc con tiếp theo (↓)"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            )}
            <span className="text-xs font-medium text-foreground truncate pl-1">Việc con</span>
            {siblingTotal > 0 && (
              <span className="text-xs tabular-nums text-muted-foreground">
                {siblingPosition}/{siblingTotal}
              </span>
            )}
          </div>

          <div className="flex items-center gap-0.5">
            {onAddSubtask && (
              <button
                type="button"
                onClick={onAddSubtask}
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
                title="Thêm việc con"
                aria-label="Thêm việc con"
              >
                <Plus className="size-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title="Đóng (Esc)"
              aria-label="Đóng chi tiết việc con"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div
          data-selection-canvas="peek"
          data-plate-selectable="true"
          onMouseDownCapture={markSelectionStartTarget}
          className="relative min-h-0 flex-1 flex flex-col overflow-y-auto overflow-x-hidden break-words px-6 pt-5 pb-6 overscroll-contain"
        >
              {/* Child title first */}
              <div className="space-y-1.5">
            <DirectInlineEditor
              value={subtask.title}
              onSave={handleTitleChange}
              canEdit={canEditContent}
              as="h2"
              multiline={false}
              submitOnEnter={true}
              ariaLabel="Tên việc thành phần"
              placeholder="Nhập tên việc thành phần..."
              viewClassName="text-xl font-semibold tracking-tight text-foreground leading-snug break-words whitespace-pre-wrap"
              editorClassName="text-xl font-semibold tracking-tight text-foreground leading-snug break-words whitespace-pre-wrap"
              largeText
            />
          </div>

          <section aria-label="Thuộc tính việc thành phần" className="mt-3 flex items-center gap-3 flex-wrap text-xs text-muted-foreground font-normal select-none">
            <TaskStatusSelect
              value={currentStatusValue}
              options={statusChoices}
              disabled={!canEdit}
              onValueChange={(value) => void handleStatusChange(value)}
            />

            <TaskAssigneePicker
              items={personnelList}
              loading={personnelLoading}
              assigneeId={(subtask as any).assigneeId}
              assigneeName={subtask.assigneeName}
              displayName={assigneeDisplay}
              disabled={!canReassign || isReassigning}
              pending={isReassigning}
              onSelect={handleAssigneeChange}
            />

            {Array.isArray(subtask.coAssignees) && subtask.coAssignees.length > 0 && (
              <>
                <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <TaskIconCollaborators className="size-4 shrink-0" />
                  <span className="truncate">
                    {subtask.coAssignees.map((co: any) => (typeof co === "string" ? co : co?.name)).filter(Boolean).join(", ")}
                  </span>
                </div>
              </>
            )}

            <span>·</span>

            <TaskDateRange
              startDateIso={startDateIso}
              dueDateIso={dueDateIso}
              canEdit={canEditContent || canChangeDueDate}
              onStartDateChange={canEditContent ? handleStartDateChange : undefined}
              onDueDateChange={canChangeDueDate ? handleDueDateChange : undefined}
            />
          </section>

          <section className="mt-3 flex flex-1 flex-col">
            {!description && !canEditContent && (
              <p className="text-xs text-muted-foreground/50 italic px-1 mb-1.5">Chưa có mô tả.</p>
            )}
            <TaskBlockEditor
              selectionContainerSelector='[data-selection-canvas="peek"]'
              key={subtask.id}
              taskId={subtask.id}
              initialDescription={description}
              onSaveContent={handleDescriptionChange}
              canEdit={canEditContent}
              globalFileDrop={false}
            />
          </section>
        </div>
      </aside>
    </>
  );
}
