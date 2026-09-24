"use client";

import * as React from "react";
import {
  ArrowRight,
  Check,
  RotateCcw,
  UploadCloud,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, getInitials } from "@/lib/utils";
import type { SchoolTask, StaffTask, TaskStatus } from "@/types/dashboard";
import type { TableDensity } from "../types";
import { getStatusBadgeConfig } from "../constants";
import {
  formatTableDate,
  getSlaBadgeStatus,
  getSystemReferenceDate,
} from "../utils/table-date-helpers";
import { isDateInAcademicMonth } from "@/lib/academic-calendar";

export interface SubtaskInlineRowProps {
  subTask: StaffTask;
  parentTask: SchoolTask;
  density?: TableDensity;
  scope?: string;
  isHighlighted?: boolean;
  selectedAcademicMonth?: number | "ALL";
  referenceDate?: string | Date;
  onSelectSubTask?: (subTask: StaffTask, parentTask: SchoolTask) => void;
  onStatusChange?: (
    taskId: string,
    newStatus: TaskStatus,
    isSubTask?: boolean,
    parentId?: string
  ) => Promise<void> | void;
  onOpenSubmitModal?: (task: StaffTask) => void;
  className?: string;
}

export const SubtaskInlineRow = React.memo(function SubtaskInlineRow({
  subTask,
  parentTask,
  density = "comfortable",
  scope,
  isHighlighted = false,
  selectedAcademicMonth,
  referenceDate = getSystemReferenceDate(),
  onSelectSubTask,
  onStatusChange,
  onOpenSubmitModal,
  className,
}: SubtaskInlineRowProps) {
  const statusConfig = getStatusBadgeConfig(subTask.status);
  const slaStatus = getSlaBadgeStatus(
    subTask.dueDate,
    subTask.status,
    typeof referenceDate === "string" ? referenceDate : referenceDate.toISOString().slice(0, 10)
  );

  const isSubDueInMonth =
    selectedAcademicMonth && selectedAcademicMonth !== "ALL" && subTask.dueDate
      ? isDateInAcademicMonth(subTask.dueDate, selectedAcademicMonth, "2026-2027")
      : false;

  const handleRowClick = () => {
    onSelectSubTask?.(subTask, parentTask);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelectSubTask?.(subTask, parentTask);
    }
  };

  const handleStatusToggle = (e: React.MouseEvent) => {
    if (!onStatusChange) return;
    e.stopPropagation();
    const nextStatus: TaskStatus =
      subTask.status === "COMPLETED"
        ? "IN_PROGRESS"
        : subTask.status === "IN_PROGRESS"
        ? "COMPLETED"
        : "IN_PROGRESS";
    onStatusChange(subTask.id, nextStatus, true, parentTask.id);
  };

  const paddingClass = density === "compact" ? "py-1.5 px-3" : "py-2 px-3.5";

  return (
    <div
      role="row"
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={handleKeyDown}
      data-subtask-id={subTask.id}
      className={cn(
        "group/sub flex items-center justify-between gap-3 rounded-xl border transition-colors cursor-pointer select-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40",
        paddingClass,
        isHighlighted
          ? "border-primary/40 bg-primary/[0.07] shadow-xs hover:bg-primary/[0.10] ring-1 ring-primary/20"
          : isSubDueInMonth
            ? "border-primary/25 bg-primary/[0.04] shadow-2xs hover:bg-primary/[0.08]"
            : "border-slate-200/60 bg-white/70 hover:bg-slate-100/70",
        className
      )}
    >
      {/* Left section: Status Badge, Title & Month Tag */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {/* Status Badge */}
        <Badge
          variant={statusConfig.variant}
          onClick={handleStatusToggle}
          title={onStatusChange ? "Click để chuyển đổi trạng thái" : undefined}
          className={cn(
            "h-5.5 px-2 text-xs font-semibold tabular-nums leading-none shrink-0 transition-all",
            onStatusChange && "cursor-pointer hover:opacity-85 active:opacity-75 transition-opacity",
            statusConfig.className
          )}
        >
          {statusConfig.label}
        </Badge>

        {/* Subtask Title - Straight Aligned */}
        <span className="truncate text-slate-900 font-medium text-xs sm:text-[13px] leading-snug">
          {subTask.title}
        </span>

        {/* Parent Task Context Badge in MY_TASKS or when highlighted */}
        {(scope === "MY_TASKS" || isHighlighted) && parentTask?.title && (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-primary/10 text-primary border border-primary/20 max-w-[240px] truncate shrink-0"
            title={`Thuộc nhiệm vụ: ${parentTask.title}`}
          >
            Thuộc nhiệm vụ: {parentTask.title}
          </span>
        )}

        {/* Weight indicator if present */}
        {typeof subTask.weight === "number" && subTask.weight > 0 && (
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200 shrink-0"
            title={`Trọng số đóng góp: ${subTask.weight}%`}
          >
            {subTask.weight}%
          </span>
        )}

        {/* Month due badge */}
        {isSubDueInMonth && (
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary border border-primary/20 shrink-0"
            title={`Nhiệm vụ con đến hạn trong Kỳ Tháng ${selectedAcademicMonth}`}
          >
            Hạn trong kỳ T{selectedAcademicMonth}
          </span>
        )}

        {/* Quick Action Micro-buttons */}
        <div className="flex items-center gap-1.5 shrink-0 ml-1">
          {/* Submit Deliverable Modal Button */}
          {onOpenSubmitModal && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenSubmitModal(subTask);
              }}
              className="inline-flex items-center gap-1 h-5.5 px-2 rounded-md border border-blue-500/20 bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 text-xs font-semibold tabular-nums cursor-pointer active:scale-[0.98] transition-colors"
              title="Nộp minh chứng hoàn thành"
            >
              <UploadCloud className="size-3" strokeWidth={1.5} />
              <span className="hidden sm:inline">Nộp minh chứng</span>
            </button>
          )}

          {/* Quick status transition actions */}
          {onStatusChange && (
            <>
              {subTask.status === "NEW" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(subTask.id, "IN_PROGRESS", true, parentTask.id);
                  }}
                  className="inline-flex items-center gap-1 h-5.5 px-2 rounded-md bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 text-xs font-semibold tabular-nums border border-blue-500/20 cursor-pointer active:scale-[0.98] transition-colors"
                  title="Tiếp nhận thực hiện"
                >
                  <ArrowRight className="size-3" strokeWidth={1.5} />
                  <span>Tiếp nhận</span>
                </button>
              )}

              {subTask.status === "IN_PROGRESS" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(subTask.id, "COMPLETED", true, parentTask.id);
                  }}
                  className="inline-flex items-center gap-1 h-5.5 px-2 rounded-md bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 text-xs font-semibold tabular-nums border border-emerald-500/20 cursor-pointer active:scale-[0.98] transition-colors"
                  title="Báo cáo hoàn thành"
                >
                  <Check className="size-3" strokeWidth={1.5} />
                  <span>Hoàn thành</span>
                </button>
              )}

              {subTask.status === "NEEDS_REVIEW" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(subTask.id, "IN_PROGRESS", true, parentTask.id);
                  }}
                  className="inline-flex items-center gap-1 h-5.5 px-2 rounded-md bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 text-xs font-semibold tabular-nums border border-amber-500/20 cursor-pointer active:scale-[0.98] transition-colors"
                  title="Tiếp nhận chỉnh sửa"
                >
                  <RotateCcw className="size-3" strokeWidth={1.5} />
                  <span>Chỉnh sửa</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right section: Progress bar, Single DRI Assignee, SLA Date */}
      <div className="flex items-center gap-3.5 shrink-0">
        {/* Progress percent if subtask tracks progress */}
        {typeof subTask.progressPercent === "number" && (
          <div className="flex items-center gap-1.5">
            <div className="relative h-1.5 w-12 overflow-hidden rounded-full bg-slate-200/80">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, subTask.progressPercent))}%` }}
              />
            </div>
            <span className="font-mono text-xs font-semibold tabular-nums text-slate-700">
              {subTask.progressPercent}%
            </span>
          </div>
        )}

        {/* Single DRI Assignee */}
        <div className="flex items-center gap-1.5">
          {subTask.assigneeAvatar ? (
            <img
              src={subTask.assigneeAvatar}
              alt=""
              aria-hidden="true"
              width={20}
              height={20}
              loading="lazy"
              className="size-5 rounded-full object-cover shrink-0 ring-1 ring-border/40"
            />
          ) : (
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold tabular-nums text-slate-700 border border-border/60">
              {getInitials(subTask.assigneeName)}
            </span>
          )}
          <span className="text-xs font-medium text-slate-800 max-w-[130px] truncate">
            {subTask.assigneeName || "Chưa giao"}
          </span>
        </div>

        {/* SLA Date Pill */}
        <span
          className={cn(
            "text-xs tabular-nums font-mono font-semibold px-2 py-0.5 rounded border",
            slaStatus.colorClass
          )}
          title={slaStatus.label ?? undefined}
        >
          {slaStatus.isOverdue && slaStatus.label ? `${slaStatus.label} · ` : ""}{formatTableDate(subTask.dueDate)}
        </span>
      </div>
    </div>
  );
});
