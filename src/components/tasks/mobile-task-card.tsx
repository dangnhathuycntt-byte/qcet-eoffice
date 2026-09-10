"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SchoolTask, StaffTask, TaskStatus } from "@/types/dashboard";
import type { FlattenedPersonalTask } from "./table/types";
import { getStatusBadgeConfig } from "./table/constants";
import {
  getSystemReferenceDate,
  getDaysRemaining,
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
 * Lấy chữ viết tắt cho avatar tên người phụ trách
 */
function getInitials(name?: string): string {
  if (!name) return "QC";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Tính toán badge thời hạn còn lại hoặc quá hạn
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
      className: "border-slate-200 bg-slate-50 text-slate-600",
    };
  }

  const diffDays = getDaysRemaining(dueDate, referenceDateInput);
  if (diffDays === null) {
    return {
      label: "Không xác định",
      className: "border-slate-200 bg-slate-50 text-slate-600",
    };
  }

  if (diffDays < 0) {
    return {
      label: `Quá hạn ${Math.abs(diffDays)} ngày`,
      className: "border-rose-500/20 bg-rose-500/10 text-rose-700 font-semibold",
    };
  }
  if (diffDays === 0) {
    return {
      label: "Hạn hôm nay",
      className: "border-amber-500/20 bg-amber-500/10 text-amber-700 font-semibold",
    };
  }
  if (diffDays <= 3) {
    return {
      label: `Còn ${diffDays} ngày`,
      className: "border-amber-500/20 bg-amber-500/10 text-amber-700 font-medium",
    };
  }
  return {
    label: `Còn ${diffDays} ngày`,
    className: "border-blue-500/20 bg-blue-500/10 text-blue-700 font-medium",
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
        className: "border-slate-200 bg-slate-100/80 text-slate-600 font-normal",
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
 * - Thanh tiến độ: Thanh tiến độ mượt mà kèm tỷ lệ phần trăm tabular-nums
 * - Hàng dưới: Ngày hạn (Hạn 14/09) & Huy hiệu thời hạn/quá hạn
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
  const departmentName =
    (isSubTask && (flattenedTask?.assignedToDepartmentName || flattenedTask?.parentDepartment)) ||
    (schoolTask && (schoolTask.department || schoolTask.leadDepartmentCode)) ||
    anyTask.department ||
    anyTask.leadDepartmentCode ||
    anyTask.departmentCode ||
    "QCET";

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

  // 5. Progress calculation
  const subTasks = schoolTask?.subTasks || [];
  const totalSubTasks = schoolTask?.totalSubTasks ?? subTasks.length;
  const completedSubTasks =
    schoolTask?.completedSubTasks ??
    subTasks.filter((s) => s.status === "COMPLETED").length;

  const progressPercent =
    typeof task.progressPercent === "number"
      ? Math.min(100, Math.max(0, task.progressPercent))
      : totalSubTasks > 0
      ? Math.round((completedSubTasks / totalSubTasks) * 100)
      : task.status === "COMPLETED"
      ? 100
      : 0;

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
      className={cn(
        "group relative flex flex-col gap-2.5 rounded-xl border border-border/70 bg-card p-3.5 shadow-2xs",
        "min-h-[48px] touch-manipulation cursor-pointer select-none",
        "hover:border-primary/40 hover:shadow-xs active:bg-muted/40 transition-all duration-150",
        className
      )}
    >
      {/* Top Row: Task code + Priority & Status badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-mono text-xs font-semibold tabular-nums text-muted-foreground shrink-0 bg-muted/60 border border-border/50 px-1.5 py-0.5 rounded">
            {formattedCode}
          </span>
          {isSubTask && (flattenedTask?.parentSchoolTaskCode || flattenedTask?.parentTaskCode) && (
            <span className="text-xs font-mono text-muted-foreground/80 truncate">
              [{flattenedTask?.parentSchoolTaskCode || flattenedTask?.parentTaskCode}]
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
      <h3 className="text-[14.5px] font-semibold text-foreground leading-snug line-clamp-2 font-heading tracking-tight">
        {title}
      </h3>

      {/* Unit & Assignee: Department name • Assignee name with avatar/dot */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
        <span className="font-medium text-foreground/85 truncate max-w-[140px]" title={departmentName}>
          {departmentName}
        </span>
        <span className="inline-block size-1 rounded-full bg-muted-foreground/40 shrink-0" aria-hidden="true" />
        <div className="flex items-center gap-1.5 min-w-0 truncate">
          {assigneeAvatar ? (
            <img
              src={assigneeAvatar}
              alt=""
              aria-hidden="true"
              width={18}
              height={18}
              loading="lazy"
              className="size-4.5 rounded-full object-cover shrink-0 border border-border/60"
            />
          ) : (
            <span className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary border border-primary/20">
              {getInitials(assigneeName)}
            </span>
          )}
          <span className="font-medium text-foreground/80 truncate max-w-[120px]" title={assigneeName}>
            {assigneeName}
          </span>
        </div>
      </div>

      {/* Progress Bar: Sleek thin bar with tabular percentage */}
      <div className="space-y-1 pt-0.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground font-mono tabular-nums">
          <span className="text-xs font-medium text-muted-foreground/80">
            {totalSubTasks > 0 ? `Tiến độ (${completedSubTasks}/${totalSubTasks} việc)` : "Tiến độ"}
          </span>
          <span className="font-semibold text-foreground text-xs">{progressPercent}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/80">
          <div
            className={cn(
              "h-full transition-all duration-300 ease-out rounded-full",
              progressPercent === 100
                ? "bg-emerald-500"
                : task.status === "BLOCKED"
                ? "bg-rose-500"
                : "bg-primary"
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Bottom Row: Due date (Hạn 14/09) & days remaining / overdue badge */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40 text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {formattedDueDate}
          </span>
          {isDueInMonth && (
            <span className="hidden xs:inline-flex px-1.5 py-0.2 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20">
              Kỳ T{selectedAcademicMonth}
            </span>
          )}
        </div>

        <span
          className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono tabular-nums border shrink-0",
            dueBadge.className
          )}
        >
          {dueBadge.label}
        </span>
      </div>
    </article>
  );
});

export default MobileTaskCard;
