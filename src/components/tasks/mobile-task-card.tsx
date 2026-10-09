"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn, getInitials } from "@/lib/utils";
import type { SchoolTask, StaffTask, TaskStatus } from "@/types/dashboard";
import type { FlattenedPersonalTask } from "./table/types";
import { getStatusBadgeConfig } from "./table/constants";
import {
  getSystemReferenceDate,
  getDaysRemaining,
  getDueIndicator,
} from "./table/utils/table-date-helpers";
import { isDateInAcademicMonth } from "@/lib/academic-calendar";

export interface MobileTaskCardProps {
  task: SchoolTask | StaffTask | FlattenedPersonalTask;
  onSelectTask?: (task: SchoolTask | StaffTask) => void;
  selectedAcademicMonth?: number | "ALL";
  referenceDate?: string | Date;
  className?: string;
  // Optional backward compatibility props
  isExpanded?: boolean;
  onToggleExpand?: (taskId: string, e?: React.MouseEvent) => void;
  onStatusChange?: (
    taskId: string,
    newStatus: TaskStatus,
    isSubTask?: boolean,
    parentId?: string
  ) => Promise<void> | void;
  onOpenSubmitModal?: (task: StaffTask) => void;
  onAddSubTask?: (parentTaskOrId: SchoolTask | string) => void;
  canAssign?: boolean;
}

/**
 * Định dạng ngày đến hạn cho thẻ di động: "Hạn 14/09"
 */
export function formatMobileDueDate(dateStr?: string): string {
  if (!dateStr) return "Không hạn";
  try {
    const clean = dateStr.split("T")[0];
    const parts = clean.split("-");
    if (parts.length === 3) {
      const [, month, day] = parts;
      return `Hạn ${day.padStart(2, "0")}/${month.padStart(2, "0")}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

/**
 * Tính toán badge thời hạn còn lại hoặc trễ hạn
 */
export function getMobileDueBadge(
  dueDate?: string,
  status?: TaskStatus | string,
  referenceDateInput: string | Date = getSystemReferenceDate()
): { label: string; className: string } {
  if (status === "COMPLETED") {
    return {
      label: "Hoàn thành",
      className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
    };
  }
  if (!dueDate) {
    return {
      label: "Không hạn",
      className: "border-border bg-secondary text-muted-foreground",
    };
  }

  const diffDays = getDaysRemaining(dueDate, referenceDateInput);
  if (diffDays === null) {
    return {
      label: "Không xác định",
      className: "border-border bg-secondary text-muted-foreground",
    };
  }

  if (diffDays < 0) {
    return {
      label: `Trễ hạn ${Math.abs(diffDays)} ngày`,
      className: "border-rose-500/20 bg-rose-500/10 text-rose-700 font-semibold",
    };
  }
  if (diffDays === 0) {
    return {
      label: "Hạn hôm nay",
      className: "border-amber-500/20 bg-amber-500/10 text-amber-700 font-semibold",
    };
  }
  const soon = getDueIndicator({
    status,
    isOverdue: false,
    isToday: false,
    daysRemaining: diffDays,
  });
  if (soon.tone === "warn") {
    return {
      label: `Còn ${diffDays} ngày`,
      className: "border-amber-500/20 bg-amber-500/10 text-amber-700 font-medium",
    };
  }
  return {
    label: `Còn ${diffDays} ngày`,
    className: "border-border bg-secondary text-muted-foreground font-medium",
  };
}

/**
 * Lấy cấu hình huy hiệu mức độ ưu tiên cho thẻ di động
 */
export function getMobilePriorityBadgeConfig(
  priority?: string
): { label: string; className: string } | null {
  if (!priority) return null;
  const normalized = priority.toUpperCase();
  switch (normalized) {
    case "CRITICAL":
    case "URGENT":
    case "KHAN_CAP":
      return {
        label: "Khẩn cấp",
        className: "border-rose-500/30 bg-rose-500/15 text-rose-700 font-semibold",
      };
    case "HIGH":
    case "CAO":
      return {
        label: "Ưu tiên cao",
        className: "border-orange-500/30 bg-orange-500/15 text-orange-700 font-medium",
      };
    case "MEDIUM":
    case "NORMAL":
    case "TRUNG_BINH":
      return {
        label: "Trung bình",
        className: "border-amber-500/30 bg-amber-500/15 text-amber-700 font-medium",
      };
    case "LOW":
    case "THAP":
      return {
        label: "Tiêu chuẩn",
        className: "border-border bg-secondary text-muted-foreground font-normal",
      };
    default:
      return null;
  }
}

/**
 * MobileTaskCard - Thẻ nhiệm vụ di động chuẩn Apple HIG & WCAG 2.2
 *
 * Thiết kế tinh gọn, chống slop:
 * - Toàn bộ thẻ có thể chạm/nhấp để mở chi tiết (min-h-[48px], touch-manipulation)
 * - Hàng trên: Mã nhiệm vụ (NV-xxx), Huy hiệu trạng thái
 * - Tiêu đề: 14-15px font-semibold text-foreground leading-snug
 * - Đơn vị & Người phụ trách: Tên phòng ban • Tên người phụ trách (avatar/dot)
 * - Hàng dưới: Ngày hạn (Hạn 14/09) & Huy hiệu thời hạn/trễ hạn
 * - Không có nút bấm rác bên trong thẻ
 */
export const MobileTaskCard = React.memo(function MobileTaskCard({
  task,
  onSelectTask,
  selectedAcademicMonth,
  referenceDate = getSystemReferenceDate(),
  className,
}: MobileTaskCardProps) {
  const anyTask = task as any;
  const isSubTask = Boolean(anyTask.isSubTask || anyTask.isFlattenedSubtask);
  const flattenedTask = isSubTask ? anyTask : null;
  const schoolTask = !isSubTask && anyTask.totalSubTasks !== undefined ? (task as SchoolTask) : null;

  // 1. Task Code
  const code = (
    isSubTask
      ? (flattenedTask?.code || flattenedTask?.id || "")
      : (schoolTask?.code || schoolTask?.taskCode || anyTask?.code || task.id || "")
  ).toUpperCase();
  const formattedCode = code.startsWith("NV-") ? code : `NV-${code.slice(0, 8)}`;

  // 2. Title
  const title = task.title;

  // 3. Department & Assignee
  const rawDept =
    (isSubTask && (flattenedTask?.assignedToDepartmentName || flattenedTask?.parentDepartment)) ||
    (schoolTask && (schoolTask.department || schoolTask.leadDepartmentCode)) ||
    anyTask.department ||
    anyTask.leadDepartmentCode ||
    anyTask.departmentCode ||
    "QCET";

  const departmentName =
    typeof rawDept === "string"
      ? rawDept
      : rawDept && typeof rawDept === "object"
      ? rawDept.name || rawDept.code || "QCET"
      : "QCET";

  const assigneeName =
    (isSubTask && flattenedTask?.assigneeName) ||
    (schoolTask && schoolTask.leadAssigneeName) ||
    anyTask.assigneeName ||
    anyTask.leadAssigneeName ||
    "Chưa phân công";

  const assigneeAvatar =
    (isSubTask && flattenedTask?.assigneeAvatar) ||
    (schoolTask && schoolTask.leadAssigneeAvatar) ||
    anyTask.assigneeAvatar ||
    anyTask.leadAssigneeAvatar;

  // 4. Status & SLA & Priority
  const statusConfig = getStatusBadgeConfig(task.status);
  const dueBadge = getMobileDueBadge(task.dueDate, task.status, referenceDate);
  const formattedDueDate = formatMobileDueDate(task.dueDate);
  const priorityBadge = getMobilePriorityBadgeConfig(
    anyTask.priority || (schoolTask as any)?.priority || flattenedTask?.priority
  );

  const isDueInMonth =
    selectedAcademicMonth &&
    selectedAcademicMonth !== "ALL" &&
    task.dueDate &&
    isDateInAcademicMonth(task.dueDate, selectedAcademicMonth, "2026-2027");

  const handleCardClick = React.useCallback(() => {
    onSelectTask?.(task as unknown as SchoolTask | StaffTask);
  }, [onSelectTask, task]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelectTask?.(task as unknown as SchoolTask | StaffTask);
      }
    },
    [onSelectTask, task]
  );

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      data-slot="mobile-task-card"
      data-task-id={task.id}
      aria-label={`Nhiệm vụ ${formattedCode}: ${title}. Trạng thái ${statusConfig.label}`}
      className={cn(
        "group relative flex flex-col gap-2.5 rounded-xl border border-border/70 bg-card p-3.5 shadow-2xs",
        "min-h-[48px] touch-manipulation cursor-pointer select-none",
        "hover:border-primary/40 hover:shadow-xs active:bg-muted/40 transition-all duration-150",
        className
      )}
    >
      {/* Top Row: Task Code + Department / Context + Priority & Status badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-mono text-xs font-bold text-foreground bg-muted/70 border border-border/70 px-2 py-0.5 rounded-md shrink-0">
            {formattedCode}
          </span>
          <span className="text-xs font-semibold text-foreground/80 truncate bg-muted/50 border border-border/50 px-2 py-0.5 rounded-md">
            {departmentName}
          </span>
          {isSubTask && (flattenedTask?.parentSchoolTaskTitle || flattenedTask?.parentTaskTitle) && (
            <span className="text-xs text-muted-foreground truncate" title={flattenedTask?.parentSchoolTaskTitle || flattenedTask?.parentTaskTitle}>
              • {flattenedTask?.parentSchoolTaskTitle || flattenedTask?.parentTaskTitle}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {priorityBadge && (
            <span
              className={cn(
                "inline-flex items-center h-5.5 px-2 text-xs font-medium tabular-nums leading-none shrink-0 border rounded-full",
                priorityBadge.className
              )}
            >
              {priorityBadge.label}
            </span>
          )}
          <Badge
            variant={statusConfig.variant}
            className={cn(
              "h-5.5 px-2 text-xs font-semibold tabular-nums leading-none shrink-0 border",
              statusConfig.className
            )}
          >
            {statusConfig.label}
          </Badge>
        </div>
      </div>

      {/* Title */}
      <h3 className="text-[14px] font-semibold text-foreground leading-snug line-clamp-2">
        {title}
      </h3>

      {/* Matched Subtask Badge for SUBTASK_DRI (Issue #21 & Issue #26) */}
      {"viewerContext" in task && (task as any).viewerContext?.relation === "SUBTASK_DRI" && ((task as any).viewerContext.matchedSubtaskCount ?? 0) > 0 && (
        <div className="flex items-center gap-1">
          <span
            data-slot="subtask-dri-badge"
            className="inline-flex items-center gap-1 rounded bg-sky-50 text-sky-700 border border-sky-200/80 px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums"
          >
            Phụ trách {(task as any).viewerContext.matchedSubtaskCount} việc con
          </span>
        </div>
      )}

      {/* Lead Assignee: Assignee name with avatar/dot */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
        <span className="text-muted-foreground/80 shrink-0">Phụ trách:</span>
        <div className="flex items-center gap-1.5 min-w-0 truncate">
          <UserAvatar
            name={assigneeName}
            avatarUrl={assigneeAvatar}
            size="xs"
            className="size-4.5"
          />
          <span className="font-medium text-foreground truncate" title={assigneeName}>
            {assigneeName}
          </span>
        </div>
      </div>

      {/* Bottom Row: Due date (Hạn 14/09) & days remaining / overdue badge + Chevron */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40 text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {formattedDueDate}
          </span>
          {isDueInMonth && (
            <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20">
              Kỳ T{selectedAcademicMonth}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono tabular-nums border",
              dueBadge.className
            )}
          >
            {dueBadge.label}
          </span>
          <ChevronRight className="size-4 text-muted-foreground/60 group-hover:text-primary transition-colors shrink-0" strokeWidth={1.5} />
        </div>
      </div>
    </article>
  );
});

export default MobileTaskCard;
