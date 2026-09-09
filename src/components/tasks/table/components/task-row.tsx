"use client";

import * as React from "react";
import {
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  UserCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SchoolTask, TaskStatus } from "@/types/dashboard";
import type { TableDensity } from "../types";
import {
  getCategoryBadgeConfig,
  getStatusBadgeConfig,
} from "../constants";
import {
  formatTableDate,
  getSlaBadgeStatus,
  getSystemReferenceDate,
} from "../utils/table-date-helpers";
import { isDateInAcademicMonth } from "@/lib/academic-calendar";

export interface TaskRowProps {
  task: SchoolTask;
  isSelected?: boolean;
  isExpanded?: boolean;
  isActive?: boolean;
  density?: TableDensity;
  showSelection?: boolean;
  canAssign?: boolean;
  selectedAcademicMonth?: number | "ALL";
  referenceDate?: string | Date;
  onToggleSelect?: (taskId: string, e?: React.MouseEvent | React.ChangeEvent) => void;
  onToggleExpand?: (taskId: string, e?: React.MouseEvent) => void;
  onClick?: (task: SchoolTask) => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => Promise<void> | void;
  onUrge?: (taskId: string, taskTitle: string, assigneeName: string) => Promise<void> | void;
  onAddSubTask?: (parentTask: SchoolTask) => void;
  className?: string;
}

function getInitials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getPriorityBadgeConfig(priority?: string): { label: string; className: string } {
  switch (priority) {
    case "URGENT":
      return { label: "Khẩn", className: "bg-rose-50 text-rose-700 border-rose-200/80" };
    case "HIGH":
      return { label: "Cao", className: "bg-amber-50 text-amber-700 border-amber-200/80" };
    case "LOW":
      return { label: "Thấp", className: "bg-zinc-50 text-zinc-600 border-zinc-200/80" };
    case "MEDIUM":
    case "NORMAL":
    default:
      return { label: "Bình thường", className: "bg-slate-50 text-slate-700 border-slate-200/80" };
  }
}

export function areTaskRowPropsEqual(
  prev: Readonly<TaskRowProps>,
  next: Readonly<TaskRowProps>
): boolean {
  if (prev.task.id !== next.task.id) return false;
  if (prev.task.title !== next.task.title) return false;
  if (prev.task.status !== next.task.status) return false;
  if (prev.task.progressPercent !== next.task.progressPercent) return false;
  if (prev.task.dueDate !== next.task.dueDate) return false;
  if (prev.task.priority !== next.task.priority) return false;
  if (prev.task.leadAssigneeId !== next.task.leadAssigneeId) return false;
  if (prev.task.leadAssigneeName !== next.task.leadAssigneeName) return false;
  if (prev.task.leadAssigneeAvatar !== next.task.leadAssigneeAvatar) return false;
  if (prev.task.department !== next.task.department) return false;
  if (prev.task.category !== next.task.category) return false;
  if ((prev.task.subTasks?.length || 0) !== (next.task.subTasks?.length || 0)) return false;
  if (prev.task.completedSubTasks !== next.task.completedSubTasks) return false;
  if (prev.task.totalSubTasks !== next.task.totalSubTasks) return false;
  if (prev.isSelected !== next.isSelected) return false;
  if (prev.isExpanded !== next.isExpanded) return false;
  if (prev.isActive !== next.isActive) return false;
  if (prev.density !== next.density) return false;
  if (prev.showSelection !== next.showSelection) return false;
  if (prev.canAssign !== next.canAssign) return false;
  if (prev.selectedAcademicMonth !== next.selectedAcademicMonth) return false;
  if (prev.referenceDate !== next.referenceDate) return false;
  return true;
}

export const TaskRow = React.memo(function TaskRow({
  task,
  isSelected = false,
  isExpanded = false,
  isActive = false,
  density = "comfortable",
  showSelection = true,
  canAssign = false,
  selectedAcademicMonth,
  referenceDate = getSystemReferenceDate(),
  onToggleSelect,
  onToggleExpand,
  onClick,
  onStatusChange,
  onUrge,
  onAddSubTask,
  className,
}: TaskRowProps) {
  const hasSubtasks = Boolean(task.subTasks && task.subTasks.length > 0);
  const totalSubTasks = task.totalSubTasks ?? task.subTasks?.length ?? 0;
  const completedSubTasks =
    task.completedSubTasks ??
    task.subTasks?.filter((s) => s.status === "COMPLETED").length ??
    0;

  const categoryConfig = getCategoryBadgeConfig(task.category);
  const priorityConfig = getPriorityBadgeConfig(task.priority);
  const statusConfig = getStatusBadgeConfig(task.status);
  const slaStatus = getSlaBadgeStatus(
    task.dueDate,
    task.status,
    typeof referenceDate === "string" ? referenceDate : referenceDate.toISOString().slice(0, 10)
  );

  const dueInMonthCount =
    selectedAcademicMonth && selectedAcademicMonth !== "ALL" && hasSubtasks
      ? task.subTasks?.filter(
          (s) =>
            s.dueDate &&
            isDateInAcademicMonth(s.dueDate, selectedAcademicMonth, "2026-2027")
        ).length || 0
      : 0;

  const handleRowClick = () => {
    onClick?.(task);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.(task);
    }
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSelect?.(task.id, e);
  };

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpand?.(task.id, e);
  };

  const handleStatusToggle = (e: React.MouseEvent) => {
    if (!onStatusChange) return;
    e.stopPropagation();
    const nextStatus: TaskStatus =
      task.status === "COMPLETED" ? "IN_PROGRESS" : "COMPLETED";
    onStatusChange(task.id, nextStatus);
  };

  const handleUrgeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUrge?.(task.id, task.title, task.leadAssigneeName || "");
  };

  const handleAddSubTaskClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddSubTask?.(task);
  };

  const paddingClass = density === "compact" ? "py-1.5 px-3" : "py-3 px-4";
  const rowHeightClass = density === "compact" ? "h-[38px]" : "h-[48px]";

  return (
    <tr
      role="row"
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={handleKeyDown}
      data-task-id={task.id}
      data-task-tier="1"
      aria-selected={isSelected}
      className={cn(
        "group cursor-pointer transition-colors border-b border-slate-200/70 select-none hover:bg-slate-50/80 focus-visible:outline-hidden",
        rowHeightClass,
        isSelected && "bg-primary/[0.04]",
        isExpanded && "bg-slate-50/50",
        isActive && "ring-1 ring-inset ring-indigo-500/40 bg-indigo-50/20",
        className
      )}
    >
      {/* Selection Checkbox */}
      {showSelection && (
        <td
          className={cn("w-10 text-center align-middle", paddingClass)}
          onClick={handleCheckboxClick}
        >
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => onToggleSelect?.(task.id, e)}
              className="size-4 rounded border-slate-300 text-primary focus:ring-2 focus:ring-primary/25 cursor-pointer transition-colors"
              aria-label={`Chọn nhiệm vụ ${task.taskCode || task.id}`}
            />
          </div>
        </td>
      )}

      {/* Expand / Collapse Caret */}
      <td className={cn("w-9 text-center align-middle", paddingClass)}>
        {hasSubtasks ? (
          <button
            type="button"
            onClick={handleExpandClick}
            className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-slate-200/60 hover:text-foreground cursor-pointer"
            aria-expanded={isExpanded}
            aria-label={
              isExpanded
                ? "Thu gọn nhiệm vụ thành phần"
                : "Mở rộng nhiệm vụ thành phần"
            }
          >
            {isExpanded ? (
              <ChevronDown className="size-3.5" strokeWidth={1.5} />
            ) : (
              <ChevronRight className="size-3.5" strokeWidth={1.5} />
            )}
          </button>
        ) : (
          <span className="inline-block size-1.5 rounded-full bg-slate-200" />
        )}
      </td>

      {/* Task Code */}
      <td
        className={cn(
          "w-24 whitespace-nowrap font-mono text-xs sm:text-[13px] tabular-nums text-muted-foreground font-semibold align-middle",
          paddingClass
        )}
      >
        {(task.code || task.taskCode || task.id).toUpperCase()}
      </td>

      {/* Task Title + Subtasks rollup */}
      <td className={cn("align-middle text-sm font-medium text-foreground leading-snug", paddingClass)}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="line-clamp-1 text-sm font-medium text-foreground group-hover:text-primary transition-colors">
            {task.title}
          </span>

          {hasSubtasks && (
            <span
              className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums text-slate-600 border border-slate-200/60"
              title={`Hoàn thành ${completedSubTasks} trên tổng số ${totalSubTasks} việc thành phần`}
            >
              [{completedSubTasks}/{totalSubTasks}]
            </span>
          )}

          {dueInMonthCount > 0 && (
            <span
              className="rounded-md bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums"
              title={`${dueInMonthCount} nhiệm vụ con đến hạn trong Kỳ Tháng ${selectedAcademicMonth}`}
            >
              Hạn trong kỳ T{selectedAcademicMonth} ({dueInMonthCount})
            </span>
          )}
        </div>
      </td>

      {/* Department & DACUM Category Pill */}
      <td className={cn("w-40 align-middle whitespace-nowrap", paddingClass)}>
        <div className="flex flex-col gap-1">
          {categoryConfig && (
            <span className="inline-flex items-center w-fit px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200/70">
              {categoryConfig.label}
            </span>
          )}
          {task.department && (
            <span className="text-xs text-muted-foreground font-medium truncate max-w-[150px]">
              {task.department}
            </span>
          )}
        </div>
      </td>

      {/* Lead Assignee (Single DRI) */}
      <td className={cn("w-36 align-middle whitespace-nowrap", paddingClass)}>
        <div className="flex items-center gap-2">
          {task.leadAssigneeAvatar ? (
            <img
              src={task.leadAssigneeAvatar}
              alt=""
              aria-hidden="true"
              width={24}
              height={24}
              loading="lazy"
              className="size-6 rounded-full object-cover shrink-0"
            />
          ) : (
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold tabular-nums text-slate-700 border border-slate-200">
              {getInitials(task.leadAssigneeName)}
            </span>
          )}
          <span className="text-xs font-medium text-foreground/90 truncate max-w-[110px]">
            {task.leadAssigneeName || "QCET"}
          </span>
        </div>
      </td>

      {/* Due Date & SLA Badge */}
      <td className={cn("w-36 align-middle whitespace-nowrap", paddingClass)}>
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground font-mono tabular-nums text-xs font-semibold">
            {formatTableDate(task.dueDate)}
          </span>
          {slaStatus.label !== "-" && (
            <span
              className={cn(
                "inline-flex items-center w-fit px-1.5 py-0.5 rounded text-xs font-semibold border tabular-nums",
                slaStatus.colorClass
              )}
            >
              {slaStatus.label}
            </span>
          )}
        </div>
      </td>

      {/* Priority Badge */}
      <td className={cn("w-24 align-middle whitespace-nowrap", paddingClass)}>
        <span
          className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border",
            priorityConfig.className
          )}
        >
          {priorityConfig.label}
        </span>
      </td>

      {/* Progress Bar & Actions */}
      <td className={cn("w-56 align-middle text-right whitespace-nowrap", paddingClass)}>
        <div className="flex items-center justify-end gap-2.5">
          {/* Quick Action Micro-buttons */}
          <div className="flex items-center gap-1">
            {onStatusChange && task.status === "IN_PROGRESS" && (
              <button
                type="button"
                onClick={handleStatusToggle}
                className="inline-flex h-6 items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 text-xs font-semibold tabular-nums text-emerald-700 hover:bg-emerald-500/20 cursor-pointer active:scale-95 transition-colors"
                title="Duyệt nhanh hoàn thành nhiệm vụ"
              >
                <Check className="size-3" strokeWidth={1.5} />
                <span>Duyệt nhanh</span>
              </button>
            )}

            {task.status !== "COMPLETED" && onUrge && (
              <button
                type="button"
                onClick={handleUrgeClick}
                className="inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 text-xs font-semibold tabular-nums text-amber-700 hover:bg-amber-500/20 cursor-pointer active:scale-95 transition-colors"
                title="Đôn đốc tiến độ thực hiện"
              >
                <Bell className="size-3" strokeWidth={1.5} />
                <span>Đôn đốc</span>
              </button>
            )}

            {canAssign && onAddSubTask && (
              <button
                type="button"
                onClick={handleAddSubTaskClick}
                className="inline-flex h-6 items-center gap-1 rounded-md border border-slate-300/80 bg-slate-100/70 px-2 text-xs font-semibold tabular-nums text-slate-700 hover:bg-slate-200/80 cursor-pointer active:scale-95 transition-colors"
                title="Phân công thêm việc con"
              >
                <UserCheck className="size-3" strokeWidth={1.5} />
                <span>Phân công</span>
              </button>
            )}
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-1.5">
            <div className="relative flex h-2 w-14 overflow-hidden rounded-full bg-slate-200/80">
              <div
                className="h-full bg-emerald-500 transition-all duration-300 ease-out"
                style={{
                  width: `${Math.min(100, Math.max(0, task.progressPercent))}%`,
                }}
              />
            </div>
            <span className="font-mono text-xs font-semibold tabular-nums text-slate-700">
              {task.progressPercent}%
            </span>
          </div>

          {/* Status Badge */}
          <Badge
            variant={statusConfig.variant}
            onClick={handleStatusToggle}
            title={onStatusChange ? "Click để chuyển đổi trạng thái" : undefined}
            className={cn(
              "h-5.5 px-2 text-xs font-semibold tabular-nums leading-none shrink-0",
              onStatusChange && "cursor-pointer hover:opacity-85 active:opacity-75 transition-opacity",
              statusConfig.className
            )}
          >
            {statusConfig.label}
          </Badge>
        </div>
      </td>
    </tr>
  );
}, areTaskRowPropsEqual);
