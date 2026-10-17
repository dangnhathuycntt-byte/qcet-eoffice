"use client";

import * as React from "react";
import { X, ArrowRight, ChevronUp, ChevronDown } from "lucide-react";
import { StandardDialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { InspectorRow } from "@/components/documents/document-detail-parts";
import { TaskStatusCircle } from "@/components/tasks/task-status-circle";
import { PrioritySignalBars } from "@/components/tasks/priority-signal-bars";
import { TaskIconDue, TaskIconDueClosed, TaskIconDueOverdue, TaskIconDueSoon } from "@/lib/icons/task-icons";
import type { SchoolTask, StaffTask } from "@/types/dashboard";
import { isSchoolTask } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import { formatDetailDate } from "@/lib/task-detail-helpers";
import { getDueIndicator, getSlaBadgeStatus } from "@/components/tasks/table/utils/table-date-helpers";
import { PRIORITY_DISPLAY_CONFIG, getStatusDisplay } from "@/domain/tasks/display-config";
import { normalizeDisplayStatus } from "@/domain/tasks/canonical-semantics";
import { shouldIgnoreShortcut } from "@/lib/shortcuts/guards";
import { getTaskContentPreview } from "@/lib/task-content-preview";

const DUE_ICONS = { closed: TaskIconDueClosed, overdue: TaskIconDueOverdue, soon: TaskIconDueSoon, default: TaskIconDue } as const;
const DUE_TONE_CLASS = { danger: "text-destructive", warn: "text-warning", muted: "text-muted-foreground" } as const;
const MAX_SUBTASKS_SHOWN = 4;

export interface TaskPeekPreviewModalProps {
  task: SchoolTask | StaffTask | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenDetail: (task: SchoolTask | StaffTask) => void;
  triggerElement?: HTMLElement | null;
  onNavigateNext?: () => void;
  onNavigatePrev?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export function TaskPeekPreviewModal({
  task,
  isOpen,
  onClose,
  onOpenDetail,
  triggerElement,
  onNavigateNext,
  onNavigatePrev,
  hasPrev = true,
  hasNext = true,
}: TaskPeekPreviewModalProps) {
  const openedAtRef = React.useRef<number>(0);
  // Mở bằng Space thì focus vào tiêu đề (đọc được bằng trình đọc màn hình), không rơi vào nút ↑ kèm viền focus
  const titleRef = React.useRef<HTMLHeadingElement>(null);

  // Track open time for hold-to-peek & debounce
  React.useEffect(() => {
    if (isOpen) {
      openedAtRef.current = Date.now();
    }
  }, [isOpen]);

  // Global keyboard shortcuts while modal is open
  React.useEffect(() => {
    if (!isOpen || !task) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (shouldIgnoreShortcut(e)) return;

      if (e.repeat && (e.key === " " || e.key === "Escape")) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (e.key === " ") {
        // Debounce chống kích hoạt lại ngay khi vừa mở (trong 250ms đầu)
        if (Date.now() - openedAtRef.current < 250) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onClose();
        return;
      }

      if (e.key === "ArrowDown" || e.key === "j" || e.key === "J") {
        e.preventDefault();
        e.stopPropagation();
        onNavigateNext?.();
        return;
      }

      if (e.key === "ArrowUp" || e.key === "k" || e.key === "K") {
        e.preventDefault();
        e.stopPropagation();
        onNavigatePrev?.();
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        onOpenDetail(task);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [isOpen, task, onClose, onOpenDetail, onNavigateNext, onNavigatePrev]);

  // Hold-to-Peek & Quick Look:
  // Nếu người dùng đè giữ phím Space (> 400ms) rồi thả ra -> tự động đóng (hold-to-peek).
  // Nếu chỉ bấm nhả nhanh (< 400ms) -> xem như toggle, giữ modal mở để điều hướng.
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === " " || e.code === "Space") {
        const heldDuration = Date.now() - openedAtRef.current;
        if (heldDuration > 400) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          onClose();
        }
      }
    };

    window.addEventListener("keyup", handleKeyUp, { capture: true });
    return () => {
      window.removeEventListener("keyup", handleKeyUp, { capture: true });
    };
  }, [isOpen, onClose]);

  if (!isOpen || !task) return null;

  // --- Data extraction ---
  const isSchool = isSchoolTask(task);
  const schoolTask = isSchool ? (task as SchoolTask) : null;
  const staffTask = !isSchool ? (task as StaffTask) : null;

  const taskCode =
    task.code ||
    (isSchool ? schoolTask?.taskCode : staffTask?.taskId) ||
    task.id.slice(0, 8).toUpperCase();

  const leadName = isSchool ? schoolTask?.leadAssigneeName : staffTask?.assigneeName;
  const leadAvatar = isSchool ? schoolTask?.leadAssigneeAvatar : undefined;

  const departmentName = isSchool
    ? schoolTask?.leadDepartment || schoolTask?.department || schoolTask?.departmentName || "Chưa có đơn vị"
    : staffTask?.assignedToDepartmentName || staffTask?.department || "Chưa có đơn vị";

  const subTasks = isSchool && Array.isArray(schoolTask?.subTasks)
    ? Array.from(new Map(schoolTask.subTasks.map((subtask) => [subtask.id, subtask])).values())
    : [];

  const rawTaskDescription = isSchool
    ? schoolTask?.description
    : staffTask?.deliverableDescription || (task as any).description;
  const taskDescription = getTaskContentPreview(rawTaskDescription);
  const parentTaskCode = isSchool
    ? schoolTask?.parentTaskCode || schoolTask?.parentTask?.code
    : staffTask?.parentSchoolTaskCode || staffTask?.parentTask?.code;
  const parentTaskTitle = isSchool
    ? schoolTask?.parentTaskTitle || schoolTask?.parentTask?.title
    : staffTask?.parentSchoolTaskTitle || staffTask?.parentTask?.title;

  // Hạn: cùng cách tính, icon và màu với cột Hạn của danh sách (ngày nghiệp vụ, đã đóng thì không báo trễ)
  const sla = getSlaBadgeStatus(task.dueDate, task.status);
  const dueIndicator = getDueIndicator({
    status: task.status,
    isOverdue: sla.isOverdue,
    isToday: sla.isToday,
    daysRemaining: sla.daysRemaining,
    label: sla.label,
  });
  const DueIcon = DUE_ICONS[dueIndicator.icon];
  const dueToneClass = DUE_TONE_CLASS[dueIndicator.tone];

  // Nhãn trạng thái dùng chung với danh sách (Mới, Đang thực hiện, Chờ duyệt, Hoàn thành, Đã hủy)
  const statusLabel = getStatusDisplay(normalizeDisplayStatus(task.status)).label;

  const priorityVal = task.priority || "NORMAL";
  const priorityLabel = PRIORITY_DISPLAY_CONFIG.find((p) => p.value === priorityVal)?.label ?? "Bình thường";

  const completedSubtasks = subTasks.filter((s) => s.status === "COMPLETED").length;

  return (
    <StandardDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Xem nhanh nhiệm vụ"
      description={`Mã công việc: ${taskCode} - ${departmentName}`}
      size="lg"
      showCloseButton={false}
      showHeader={false}
      initialFocus={titleRef}
      className="gap-3 overflow-hidden px-5 pt-3 pb-3 sm:px-5 sm:pt-3 sm:pb-3"
    >
      {/* Header như Quick View văn bản: mã (chữ số đều cột) · đơn vị bên trái, chuyển việc và đóng bên phải */}
      <div className="flex min-h-8 shrink-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-1.5 text-xs text-muted-foreground">
          <span className="shrink-0 tabular-nums text-foreground/80 select-all">{taskCode}</span>
          <span aria-hidden="true" className="text-muted-foreground/50">·</span>
          {/* Tên đơn vị không ghi tắt: hẹp thì xuống tối đa 2 dòng */}
          <span className="line-clamp-2 break-words" title={departmentName}>
            {departmentName}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {onNavigatePrev && (
            <Button variant="ghost" size="icon-xs" onClick={onNavigatePrev} disabled={!hasPrev} title="Nhiệm vụ trước (↑)" aria-label="Nhiệm vụ trước">
              <ChevronUp />
            </Button>
          )}
          {onNavigateNext && (
            <Button variant="ghost" size="icon-xs" onClick={onNavigateNext} disabled={!hasNext} title="Nhiệm vụ kế tiếp (↓)" aria-label="Nhiệm vụ kế tiếp">
              <ChevronDown />
            </Button>
          )}
          <Button variant="ghost" size="icon-xs" onClick={onClose} title="Đóng (Esc)" aria-label="Đóng">
            <X />
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
        <div className="flex flex-col gap-1">
          {(parentTaskTitle || parentTaskCode) && (
            <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              <span className="shrink-0">Việc con của</span>
              {parentTaskCode && <span className="shrink-0 tabular-nums">{parentTaskCode}</span>}
              {parentTaskTitle && <span className="truncate text-foreground/80" title={parentTaskTitle}>{parentTaskTitle}</span>}
            </p>
          )}
          {/* Tiêu đề 16/24 như trích yếu ở Quick View văn bản */}
          <h2 ref={titleRef} tabIndex={-1} className="line-clamp-3 break-words text-base leading-6 font-semibold tracking-tight text-foreground outline-none">
            {task.title}
          </h2>
        </div>

        {/* Thuộc tính là lưới nhãn–giá trị căn thẳng cột (nhãn như panel chi tiết), rộng thì hai cột */}
        <div role="group" aria-label="Thuộc tính chính" className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          <InspectorRow label="Trạng thái">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <TaskStatusCircle status={task.status} className="size-3.5" />
              {statusLabel}
            </span>
          </InspectorRow>
          <InspectorRow label="Ưu tiên">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <PrioritySignalBars priority={priorityVal} ariaLabel={`Độ ưu tiên: ${priorityLabel}`} />
              <span className={cn(priorityVal === "URGENT" && "font-medium text-destructive")}>{priorityLabel}</span>
            </span>
          </InspectorRow>
          <InspectorRow label="Phụ trách">
            {leadName ? (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <UserAvatar name={leadName} avatarUrl={leadAvatar} size="xs" />
                <span className="truncate">{leadName}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">Chưa phân công</span>
            )}
          </InspectorRow>
          {task.dueDate && (
            <InspectorRow label="Hạn hoàn thành">
              <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1.5 tabular-nums">
                <DueIcon className={cn("size-3.5 shrink-0", dueToneClass)} aria-hidden="true" />
                <span className={cn(dueIndicator.tone !== "muted" && dueToneClass)}>{formatDetailDate(task.dueDate)}</span>
                {dueIndicator.hint && dueIndicator.icon !== "closed" && (
                  // Dấu chấm và ghi chú xuống dòng cùng nhau khi cột hẹp
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <span aria-hidden="true" className="text-muted-foreground/50">·</span>
                    <span className={cn(dueToneClass, dueIndicator.tone === "danger" && "font-medium")}>{dueIndicator.hint}</span>
                  </span>
                )}
              </span>
            </InspectorRow>
          )}
        </div>

        {/* Mô tả: chỉ hiện khi có, như trường trống ở Quick View văn bản */}
        {taskDescription && (
          <p className="line-clamp-4 border-t border-border/60 pt-3 text-compact leading-relaxed whitespace-pre-line text-foreground/80">
            {taskDescription}
          </p>
        )}

        {subTasks.length > 0 && (
          <section aria-label="Việc con" className="border-t border-border/60 pt-2">
            <h3 className="flex h-6 items-center gap-1.5 text-xs font-medium text-muted-foreground">
              Việc con
              <span className="font-normal tabular-nums">{completedSubtasks}/{subTasks.length}</span>
            </h3>
            <ul>
              {subTasks.slice(0, MAX_SUBTASKS_SHOWN).map((st) => (
                <li key={st.id} className="flex h-7 items-center gap-2 text-compact text-foreground">
                  <TaskStatusCircle status={st.status} className="size-3.5" />
                  <span className={cn("truncate", st.status === "COMPLETED" && "text-muted-foreground line-through")} title={st.title}>
                    {st.title}
                  </span>
                </li>
              ))}
            </ul>
            {subTasks.length > MAX_SUBTASKS_SHOWN && (
              <p className="pl-5.5 text-xs text-muted-foreground">+{subTasks.length - MAX_SUBTASKS_SHOWN} việc khác</p>
            )}
          </section>
        )}
      </div>

      {/* Footer: phím tắt (ẩn trên điện thoại vì không có bàn phím) và Mở chi tiết */}
      <div className="flex h-8 shrink-0 items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground select-none max-md:h-auto">
        <div className="flex items-center gap-3 max-md:hidden" aria-hidden="true">
          <span><kbd className="font-sans text-foreground/70">Space</kbd> Đóng</span>
          <span><kbd className="font-sans text-foreground/70">↑↓</kbd> Chuyển</span>
          <span><kbd className="font-sans text-foreground/70">Enter</kbd> Mở chi tiết</span>
        </div>
        <Button variant="ghost" size="xs" onClick={() => onOpenDetail(task)} className="ml-auto">
          Mở chi tiết
          <ArrowRight data-icon="inline-end" />
        </Button>
      </div>
    </StandardDialog>
  );
}
