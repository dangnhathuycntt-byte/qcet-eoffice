"use client";

import * as React from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ListTodo,
  UploadCloud,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSwipeAction } from "@/hooks/use-swipe-action";
import type { SchoolTask, StaffTask, TaskStatus } from "@/types/dashboard";
import type { FlattenedPersonalTask } from "../types";
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

export interface MobileTaskCardProps {
  task: SchoolTask | FlattenedPersonalTask;
  isExpanded?: boolean;
  onToggleExpand?: (taskId: string, e?: React.MouseEvent) => void;
  onSelectTask?: (task: SchoolTask | StaffTask) => void;
  onStatusChange?: (
    taskId: string,
    newStatus: TaskStatus,
    isSubTask?: boolean,
    parentId?: string
  ) => Promise<void> | void;
  onOpenSubmitModal?: (task: StaffTask) => void;
  selectedAcademicMonth?: number | "ALL";
  referenceDate?: string | Date;
  className?: string;
}

function getInitials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const MobileTaskCard = React.memo(function MobileTaskCard({
  task,
  isExpanded = false,
  onToggleExpand,
  onSelectTask,
  onStatusChange,
  onOpenSubmitModal,
  selectedAcademicMonth,
  referenceDate = getSystemReferenceDate(),
  className,
}: MobileTaskCardProps) {
  const anyTask = task as any;
  const isSubTask = Boolean(anyTask.isSubTask || anyTask.isFlattenedSubtask);
  const flattenedTask = isSubTask ? anyTask : null;
  const schoolTask = !isSubTask ? (task as SchoolTask) : null;

  const code = (
    isSubTask
      ? (flattenedTask?.code || flattenedTask?.id || "")
      : (schoolTask?.code || schoolTask?.taskCode || schoolTask?.id || "")
  ).toUpperCase();

  const title = task.title;
  const assigneeName = isSubTask
    ? (flattenedTask?.assigneeName || "")
    : (schoolTask?.leadAssigneeName || "");
  const assigneeAvatar = isSubTask
    ? flattenedTask?.assigneeAvatar
    : schoolTask?.leadAssigneeAvatar;

  const category = isSubTask
    ? flattenedTask?.parentCategory || "OTHER"
    : schoolTask?.category || "OTHER";
  const categoryConfig = getCategoryBadgeConfig(category);

  const department = isSubTask
    ? (flattenedTask?.assignedToDepartmentName || flattenedTask?.parentDepartment || "")
    : (schoolTask?.department || "");

  const statusConfig = getStatusBadgeConfig(task.status);
  const slaStatus = getSlaBadgeStatus(
    task.dueDate,
    task.status,
    typeof referenceDate === "string" ? referenceDate : referenceDate.toISOString().slice(0, 10)
  );

  const subTasks = schoolTask?.subTasks || [];
  const hasSubtasks = subTasks.length > 0;
  const totalSubTasks = schoolTask?.totalSubTasks ?? subTasks.length;
  const completedSubTasks =
    schoolTask?.completedSubTasks ??
    subTasks.filter((s) => s.status === "COMPLETED").length;

  const progressPercent =
    typeof task.progressPercent === "number"
      ? task.progressPercent
      : totalSubTasks > 0
      ? Math.round((completedSubTasks / totalSubTasks) * 100)
      : task.status === "COMPLETED"
      ? 100
      : 0;

  const isDueInMonth =
    selectedAcademicMonth && selectedAcademicMonth !== "ALL" && task.dueDate
      ? isDateInAcademicMonth(task.dueDate, selectedAcademicMonth, "2026-2027")
      : false;

  // Swipe Action for rapid status completion
  const isSwipeable = task.status === "IN_PROGRESS" && Boolean(onStatusChange);
  const swipe = useSwipeAction({
    onSwipeRight: () => {
      if (isSwipeable && onStatusChange) {
        if (isSubTask && flattenedTask) {
          onStatusChange(
            flattenedTask.id,
            "COMPLETED",
            true,
            flattenedTask.parentSchoolTaskId || (flattenedTask as any).taskId
          );
        } else if (schoolTask) {
          onStatusChange(schoolTask.id, "COMPLETED");
        }
      }
    },
    threshold: 72,
    slop: 8,
    enableHaptic: true,
  });

  const handleCardClick = () => {
    onSelectTask?.(task as unknown as SchoolTask | StaffTask);
  };

  const handleExpandToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (schoolTask && onToggleExpand) {
      onToggleExpand(schoolTask.id, e);
    }
  };

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs", className)}>
      {/* Swipe reveal background for quick completion */}
      {isSwipeable && (
        <div
          className="absolute inset-0 flex items-center justify-start bg-emerald-500/15 pl-5 text-emerald-700 font-semibold text-xs transition-opacity"
          aria-hidden="true"
        >
          <div className="flex items-center gap-1.5">
            <Check className="size-5" strokeWidth={2.5} />
            <span>Kéo sang phải để hoàn thành</span>
          </div>
        </div>
      )}

      {/* Main interactive card body */}
      <div
        style={{
          transform: isSwipeable && swipe.offset > 0 ? `translateX(${swipe.offset}px)` : undefined,
          transition: swipe.isSwiping ? "none" : "transform 200ms ease-out",
        }}
        onTouchStart={isSwipeable ? swipe.onTouchStart : undefined}
        onTouchMove={isSwipeable ? swipe.onTouchMove : undefined}
        onTouchEnd={isSwipeable ? swipe.onTouchEnd : undefined}
        onClick={handleCardClick}
        className="relative bg-white p-3.5 space-y-3 cursor-pointer select-none active:bg-slate-50/80 transition-colors"
      >
        {/* Header: Code, Parent Breadcrumb, Status Badge */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-xs font-semibold tabular-nums text-muted-foreground shrink-0">
              {code}
            </span>
            {isSubTask && (flattenedTask?.parentSchoolTaskCode || flattenedTask?.parentTaskCode) && (
              <span className="text-xs font-mono text-muted-foreground/80 truncate">
                thuộc [{flattenedTask?.parentSchoolTaskCode || flattenedTask?.parentTaskCode}]
              </span>
            )}
            {categoryConfig && (
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                {categoryConfig.label}
              </span>
            )}
          </div>

          <Badge
            variant={statusConfig.variant}
            className={cn(
              "h-5.5 px-2 text-xs font-semibold tabular-nums leading-none shrink-0",
              statusConfig.className
            )}
          >
            {statusConfig.label}
          </Badge>
        </div>

        {/* Title */}
        <h4 className="text-sm font-medium text-foreground leading-snug line-clamp-2">
          {title}
        </h4>

        {/* Info Grid: Department, Assignee, SLA Date */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground pt-0.5">
          {/* Single DRI Assignee */}
          <div className="flex items-center gap-1.5 min-w-0">
            {assigneeAvatar ? (
              <img
                src={assigneeAvatar}
                alt=""
                aria-hidden="true"
                width={20}
                height={20}
                loading="lazy"
                className="size-5 rounded-full object-cover shrink-0"
              />
            ) : (
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold tabular-nums text-slate-700 border border-slate-200">
                {getInitials(assigneeName)}
              </span>
            )}
            <span className="font-medium text-foreground/90 truncate max-w-[130px]">
              {assigneeName || "QCET"}
            </span>
          </div>

          {/* SLA Date badge */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={cn(
                "font-mono text-xs font-semibold tabular-nums px-2 py-0.5 rounded border",
                slaStatus.colorClass
              )}
            >
              {slaStatus.label !== "-" ? slaStatus.label : formatTableDate(task.dueDate)}
            </span>
            {isDueInMonth && (
              <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                T{selectedAcademicMonth}
              </span>
            )}
          </div>
        </div>

        {/* Progress Bar & Subtask Indicator */}
        <div className="space-y-1.5 pt-1 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-mono tabular-nums">
            <span>Tiến độ</span>
            <div className="flex items-center gap-2">
              {!isSubTask && hasSubtasks && (
                <span className="text-slate-600 font-semibold">
                  [{completedSubTasks}/{totalSubTasks}] việc
                </span>
              )}
              <span className="font-bold text-foreground">{progressPercent}%</span>
            </div>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-emerald-500 transition-all duration-300 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
            />
          </div>
        </div>

        {/* Quick Action Tap Targets (Minimum 44px touch height for mobile) */}
        <div className="flex items-center gap-2 pt-1">
          {/* Submit Deliverable Button */}
          {isSubTask && onOpenSubmitModal && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenSubmitModal(task as StaffTask);
              }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-700 text-xs font-semibold tabular-nums active:bg-blue-500/20 transition-colors"
            >
              <UploadCloud className="size-4" strokeWidth={1.5} />
              <span>Nộp minh chứng</span>
            </button>
          )}

          {/* Quick complete button */}
          {task.status === "IN_PROGRESS" && onStatusChange && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isSubTask && flattenedTask) {
                  onStatusChange(
                    flattenedTask.id,
                    "COMPLETED",
                    true,
                    flattenedTask.parentSchoolTaskId || (flattenedTask as any).taskId
                  );
                } else if (schoolTask) {
                  onStatusChange(schoolTask.id, "COMPLETED");
                }
              }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 text-xs font-semibold tabular-nums active:bg-emerald-500/20 transition-colors"
            >
              <Check className="size-4" strokeWidth={2} />
              <span>Hoàn thành</span>
            </button>
          )}

          {/* Subtasks Accordion Toggle */}
          {!isSubTask && hasSubtasks && onToggleExpand && (
            <button
              type="button"
              onClick={handleExpandToggle}
              className="inline-flex items-center justify-center gap-1 min-h-[44px] px-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-xs font-semibold active:bg-slate-100 transition-colors"
              aria-expanded={isExpanded}
            >
              <ListTodo className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
              <span>{subTasks.length} việc con</span>
              {isExpanded ? (
                <ChevronDown className="size-3.5 ml-0.5" strokeWidth={1.5} />
              ) : (
                <ChevronRight className="size-3.5 ml-0.5" strokeWidth={1.5} />
              )}
            </button>
          )}
        </div>

        {/* Collapsible Child Subtasks List */}
        {!isSubTask && hasSubtasks && isExpanded && (
          <div className="pt-2 border-t border-slate-100 space-y-2">
            {subTasks.map((sub) => {
              const subStatusConfig = getStatusBadgeConfig(sub.status);
              return (
                <div
                  key={sub.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTask?.(sub);
                  }}
                  className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2 cursor-pointer active:bg-slate-100"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold tabular-nums text-muted-foreground">
                      {sub.id.toUpperCase()}
                    </span>
                    <Badge
                      variant={subStatusConfig.variant}
                      className={cn("h-5 px-1.5 text-xs font-semibold", subStatusConfig.className)}
                    >
                      {subStatusConfig.label}
                    </Badge>
                  </div>
                  <p className="text-xs font-medium text-foreground line-clamp-2">
                    {sub.title}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{sub.assigneeName || "Chưa giao"}</span>
                    <span className="font-mono tabular-nums font-semibold">
                      {formatTableDate(sub.dueDate)}
                    </span>
                  </div>
                  {onOpenSubmitModal && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenSubmitModal(sub);
                      }}
                      className="w-full inline-flex items-center justify-center gap-1 min-h-[36px] px-2 rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-700 text-xs font-semibold active:bg-blue-500/20 transition-colors"
                    >
                      <UploadCloud className="size-3.5" strokeWidth={1.5} />
                      <span>Nộp minh chứng</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});
