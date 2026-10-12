"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/user-avatar";
import { TaskStatusCircle } from "./task-status-circle";
import { TaskIconPriorityHigh, TaskIconPriorityUrgent } from "./task-action-icons";
import type { SchoolTask, StaffTask, TaskStatus } from "@/types/dashboard";
import type { FlattenedPersonalTask } from "./table/types";
import { getStatusBadgeConfig } from "./table/constants";
import {
  getSystemReferenceDate,
  getDaysRemaining,
  getDueIndicator,
} from "./table/utils/table-date-helpers";

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
      className: "border-destructive/20 bg-danger-soft text-destructive font-semibold",
    };
  }
  if (diffDays === 0) {
    return {
      label: "Hạn hôm nay",
      className: "border-destructive/20 bg-danger-soft text-destructive font-semibold",
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
      className: "border-warning/20 bg-warning/10 text-warning font-medium",
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
        className: "border-destructive/20 bg-danger-soft text-destructive font-semibold",
      };
    case "HIGH":
    case "CAO":
      return {
        label: "Ưu tiên cao",
        className: "border-border bg-secondary text-foreground font-medium",
      };
    case "MEDIUM":
    case "NORMAL":
    case "TRUNG_BINH":
      return {
        label: "Trung bình",
        className: "border-border bg-secondary text-muted-foreground font-medium",
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
 * MobileTaskCard - hàng nhiệm vụ di động gọn kiểu Linear (hàng phẳng, không thẻ).
 *
 * - Cả hàng chạm được để mở chi tiết (min-h-[48px], touch-manipulation), không có nút lẻ bên trong
 * - Một dòng: icon trạng thái, tiêu đề; bên phải icon ưu tiên (khẩn cấp, cao), ngày hạn (đỏ khi trễ, cam khi sắp tới) và avatar
 * - Mã, người phụ trách, đơn vị, trạng thái chữ nằm ở aria-label và văn bản dành cho trình đọc màn hình
 */
export const MobileTaskCard = React.memo(function MobileTaskCard({
  task,
  onSelectTask,
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
  const rawPriority = String(anyTask.priority || "").toUpperCase();
  const PriorityIcon =
    rawPriority === "URGENT" || rawPriority === "CRITICAL" || rawPriority === "KHAN_CAP"
      ? TaskIconPriorityUrgent
      : rawPriority === "HIGH" || rawPriority === "CAO"
      ? TaskIconPriorityHigh
      : null;
  const priorityLabel = getMobilePriorityBadgeConfig(rawPriority)?.label;
  // Chỉ giữ màu chữ tín hiệu của huy hiệu hạn: hàng phẳng không có nền chip
  const dueTone = dueBadge.className.includes("text-destructive")
    ? "text-destructive"
    : dueBadge.className.includes("text-warning")
    ? "text-warning"
    : "text-muted-foreground";
  const contextLabel =
    (isSubTask && (flattenedTask?.parentSchoolTaskTitle || flattenedTask?.parentTaskTitle)) || departmentName;
  const subtaskDri =
    "viewerContext" in task && (task as any).viewerContext?.relation === "SUBTASK_DRI"
      ? Number((task as any).viewerContext.matchedSubtaskCount ?? 0)
      : 0;

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

  const shortDue = task.dueDate ? formattedDueDate.replace(/^Hạn /, "") : "";

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
        "group relative flex min-h-[48px] items-center gap-3 px-4 py-2",
        "touch-manipulation cursor-pointer select-none active:bg-muted/50 transition-colors duration-100",
        className
      )}
    >
      <TaskStatusCircle status={task.status} className="size-4" />

      <h3 className="min-w-0 flex-1 truncate text-compact font-normal text-foreground">{title}</h3>

      {/* Thông tin phụ cho trình đọc màn hình; trên hàng chỉ giữ ký hiệu để nhìn thoáng như Linear */}
      <span className="sr-only">
        {formattedCode} · {assigneeName} · {contextLabel}
        {subtaskDri > 0 ? ` · Phụ trách ${subtaskDri} việc con` : ""} · {dueBadge.label}
      </span>

      <div className="flex shrink-0 items-center gap-2.5">
        {PriorityIcon ? (
          <PriorityIcon
            className={cn("size-4", rawPriority === "HIGH" || rawPriority === "CAO" ? "text-foreground/60" : "text-destructive")}
            aria-label={priorityLabel}
          />
        ) : null}
        {shortDue ? <span className={cn("text-xs tabular-nums", dueTone)}>{shortDue}</span> : null}
        <UserAvatar name={assigneeName} avatarUrl={assigneeAvatar} size="sm" />
      </div>
    </article>
  );
});

export default MobileTaskCard;
