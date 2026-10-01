"use client";

import * as React from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  MoreHorizontal,
  Signal,
  SignalHigh,
  SignalMedium,
  SignalLow,
  Eye,
  MessageSquare,
  Paperclip,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { SchoolTask, TaskPriority, TaskStatus } from "@/types/dashboard";
import type { TableDensity, TableColumnVisibility } from "../types";
import {
  formatTableDate,
  getSlaBadgeStatus,
  getSystemReferenceDate,
} from "../utils/table-date-helpers";
import { isDateInAcademicMonth } from "@/lib/academic-calendar";
import { PrioritySignalBars } from "@/components/tasks/priority-signal-bars";
import { TaskStatusCircle } from "@/components/tasks/task-status-circle";
import {
  StatusSubNew,
  StatusSubInProgress,
  StatusSubReview,
  StatusSubCompleted,
  HealthSubOverdue,
} from "@/components/dashboard/task-filter-icons";

function formatShortTableDate(dateStr?: string | Date | null): string {
  if (!dateStr) return "-";
  try {
    const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
    if (isNaN(d.getTime())) return String(dateStr);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}`;
  } catch {
    return String(dateStr);
  }
}

export interface TaskRowProps {
  task: SchoolTask;
  scope?: string;
  isSelected?: boolean;
  isExpanded?: boolean;
  isActive?: boolean;
  isPreviewing?: boolean;
  density?: TableDensity;
  visibleColumns?: TableColumnVisibility;
  showSelection?: boolean;
  canAssign?: boolean;
  selectedAcademicMonth?: number | "ALL";
  referenceDate?: string | Date;
  activeCategory?: string;
  suppressCategory?: boolean;
  onToggleSelect?: (taskId: string, e?: React.MouseEvent | React.ChangeEvent) => void;
  onToggleExpand?: (taskId: string, e?: React.MouseEvent) => void;
  onClick?: (task: SchoolTask) => void;
  onContextMenu?: (task: SchoolTask, e: React.MouseEvent) => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => Promise<void> | void;
  onUrge?: (taskId: string, taskTitle: string, assigneeName: string) => Promise<void> | void;
  onAddSubTask?: (parentTaskOrId: SchoolTask | string) => void;
  showTaskCode?: boolean;
  /** Position within a contiguous selection group: 'first' | 'middle' | 'last' | 'only' | null */
  selectionGroupPosition?: "first" | "middle" | "last" | "only" | null;
  className?: string;
}

export interface ParsedLeadAssignee {
  primaryName: string;
  subtext: string;
}

export function parseLeadAssignee(
  rawName?: string,
  department?: string | { name?: string; code?: string }
): ParsedLeadAssignee {
  const deptStr =
    typeof department === "string"
      ? department
      : department && typeof department === "object"
      ? department.name || department.code || ""
      : "";

  if (!rawName || !rawName.trim()) {
    return {
      primaryName: "QCET",
      subtext: deptStr,
    };
  }

  let cleaned = rawName.trim();
  let parenthetical = "";

  const parenMatch = cleaned.match(/\s*\(([^)]+)\)\s*$/);
  if (parenMatch) {
    parenthetical = parenMatch[1].trim();
    cleaned = cleaned.slice(0, parenMatch.index).trim();
  }

  const prefixMatch = cleaned.match(
    /^(?:(TT|TP|PP|CVP|P\.CVP|HT|PHT|GV|CVC|CV|Tổ trưởng|Trưởng phòng|Phó phòng|Trưởng khoa|Phó khoa)\.?\s*)?(?:(GS\.TS|PGS\.TS|GS|PGS|TS|ThS|CN|KS|BS|KTS)\.?\s*)?/i
  );

  let prefix = "";
  if (prefixMatch && prefixMatch[0].trim()) {
    prefix = prefixMatch[0].trim();
    cleaned = cleaned.slice(prefixMatch[0].length).trim();
  }

  const primaryName = cleaned || rawName;

  const subtextParts: string[] = [];
  if (prefix) subtextParts.push(prefix);
  if (parenthetical) {
    subtextParts.push(parenthetical);
  } else if (deptStr && !prefix.includes(deptStr)) {
    subtextParts.push(deptStr);
  }

  return {
    primaryName,
    subtext: subtextParts.join(" · "),
  };
}

/**
 * Priority Indicator
 * Khẩn cấp    → strongest semantic emphasis (icon + red)
 * Cao         → noticeable (icon + amber)
 * Bình thường → quiet neutral metadata (plain muted text, no icon)
 * Thấp        → quietest (plain muted text, no icon)
 */
function PriorityIndicator({ priority }: { priority?: TaskPriority | string }) {
  const p = (priority || "NORMAL").toUpperCase();

  if (p === "URGENT") {
    return (
      <div className="inline-flex items-center gap-1 text-rose-600" title="Độ ưu tiên: Khẩn cấp">
        <AlertTriangle className="size-3.5 shrink-0" strokeWidth={1.5} />
        <span className="text-[11px] font-medium hidden lg:inline">Khẩn cấp</span>
      </div>
    );
  }
  if (p === "HIGH") {
    return (
      <div className="inline-flex items-center gap-1 text-amber-600" title="Độ ưu tiên: Cao">
        <SignalHigh className="size-3.5 shrink-0" strokeWidth={1.5} />
        <span className="text-[11px] font-medium hidden lg:inline">Cao</span>
      </div>
    );
  }
  if (p === "LOW") {
    return (
      <div className="inline-flex items-center text-slate-400" title="Độ ưu tiên: Thấp">
        <span className="text-[11px] hidden lg:inline">Thấp</span>
      </div>
    );
  }
  return (
    <div className="inline-flex items-center text-slate-500" title="Độ ưu tiên: Bình thường">
      <span className="text-[11px] hidden lg:inline">Bình thường</span>
    </div>
  );
}

/**
 * Health Badge Indicator (Linear Health style: On track / At risk / Off track)
 * Refined: restrained dot indicator with lowered saturation to avoid competing with task title
 */
function HealthIndicator({
  status,
  isOverdue,
  isWaitingApproval,
}: {
  status: TaskStatus;
  isOverdue: boolean;
  isWaitingApproval: boolean;
}) {
  if (status === "COMPLETED") {
    return (
      <div className="inline-flex items-center gap-1.5 text-[11px] text-foreground/80 font-medium">
        <StatusSubCompleted className="size-3.5 text-foreground/80 shrink-0" />
        <span>Hoàn thành</span>
      </div>
    );
  }
  if (isOverdue) {
    return (
      <div className="inline-flex items-center gap-1.5 text-[11px] text-foreground/90 font-medium">
        <HealthSubOverdue className="size-3.5 text-foreground/90 shrink-0" />
        <span>Quá hạn</span>
      </div>
    );
  }
  if (isWaitingApproval || status === "WAITING_APPROVAL" || (status as string) === "NEEDS_REVIEW") {
    const label = (status as string) === "NEEDS_REVIEW" ? "Cần chỉnh sửa" : "Chờ duyệt";
    return (
      <div className="inline-flex items-center gap-1.5 text-[11px] text-foreground/80 font-medium">
        <StatusSubReview className="size-3.5 text-foreground/80 shrink-0" />
        <span>{label}</span>
      </div>
    );
  }
  if (status === "IN_PROGRESS") {
    return (
      <div className="inline-flex items-center gap-1.5 text-[11px] text-foreground font-medium">
        <StatusSubInProgress className="size-3.5 text-foreground/80 shrink-0" />
        <span>Đang thực hiện</span>
      </div>
    );
  }
  // Mới
  return (
    <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground font-normal">
      <StatusSubNew className="size-3.5 text-muted-foreground/60 shrink-0" />
      <span>Mới</span>
    </div>
  );
}

/**
 * Circular Progress Ring (Minimal circular indicator)
 * Clean: When progress is 0%, render subtle plain text to avoid visual clutter
 */
export function CircularProgressRing({ percent }: { percent: number }) {
  const bounded = Math.min(100, Math.max(0, percent || 0));
  if (bounded === 0) {
    return (
      <span className="font-mono text-xs tabular-nums text-muted-foreground/50 font-normal">
        0%
      </span>
    );
  }
  const radius = 5.5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (circumference * bounded) / 100;

  return (
    <div className="inline-flex items-center gap-1.5 font-mono text-xs tabular-nums text-foreground font-medium">
      <svg className="size-3.5 shrink-0 -rotate-90" viewBox="0 0 16 16">
        <circle
          cx="8"
          cy="8"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-border"
        />
        <circle
          cx="8"
          cy="8"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={cn(
            "transition-all duration-300",
            bounded === 100 ? "text-emerald-500" : "text-primary"
          )}
        />
      </svg>
      <span>{bounded}%</span>
    </div>
  );
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
  if (prev.isPreviewing !== next.isPreviewing) return false;
  if (prev.density !== next.density) return false;
  if (prev.showSelection !== next.showSelection) return false;
  if (prev.canAssign !== next.canAssign) return false;
  if (prev.selectedAcademicMonth !== next.selectedAcademicMonth) return false;
  if (prev.referenceDate !== next.referenceDate) return false;
  if (prev.activeCategory !== next.activeCategory) return false;
  if (prev.suppressCategory !== next.suppressCategory) return false;
  if (prev.onAddSubTask !== next.onAddSubTask) return false;
  if (prev.showTaskCode !== next.showTaskCode) return false;
  if (prev.selectionGroupPosition !== next.selectionGroupPosition) return false;
  if (prev.onContextMenu !== next.onContextMenu) return false;
  if (prev.task.viewerContext?.relation !== next.task.viewerContext?.relation) return false;
  if (prev.task.viewerContext?.matchedSubtaskCount !== next.task.viewerContext?.matchedSubtaskCount) return false;
  return true;
}

export const TaskRow = React.memo(function TaskRow({
  task,
  scope,
  isSelected = false,
  isExpanded = false,
  isActive = false,
  isPreviewing = false,
  density = "comfortable",
  visibleColumns = { priority: true, subtasks: true, progress: true },
  showSelection = false,
  canAssign = false,
  selectedAcademicMonth,
  referenceDate = getSystemReferenceDate(),
  activeCategory,
  suppressCategory = false,
  onToggleSelect,
  onToggleExpand,
  onClick,
  onContextMenu,
  onStatusChange,
  onUrge,
  onAddSubTask,
  showTaskCode = false,
  selectionGroupPosition = null,
  className,
}: TaskRowProps) {
  const hasSubtasks = Boolean(task.subTasks && task.subTasks.length > 0);
  const totalSubTasks = task.totalSubTasks ?? task.subTasks?.length ?? 0;
  const completedSubTasks =
    task.completedSubTasks ??
    task.subTasks?.filter((s) => s.status === "COMPLETED").length ??
    0;

  const slaStatus = getSlaBadgeStatus(
    task.dueDate,
    task.status,
    typeof referenceDate === "string" ? referenceDate : referenceDate.toISOString().slice(0, 10)
  );

  const driInfo = parseLeadAssignee(task.leadAssigneeName, task.department);
  const departmentName =
    typeof task.department === "string"
      ? task.department
      : (task.department as any)?.name || (task.department as any)?.code || driInfo.subtext;

  const coAssigneesList: string[] = React.useMemo(() => {
    const names = new Set<string>();
    if (Array.isArray((task as any).coAssignees)) {
      (task as any).coAssignees.forEach((n: any) => {
        if (typeof n === "string" && n.trim() && n.trim() !== driInfo.primaryName) {
          names.add(n.trim());
        }
      });
    }
    if (Array.isArray(task.subTasks)) {
      task.subTasks.forEach((st) => {
        if (st.assigneeName && st.assigneeName.trim() && st.assigneeName.trim() !== driInfo.primaryName) {
          names.add(st.assigneeName.trim());
        }
      });
    }
    return Array.from(names);
  }, [task, driInfo.primaryName]);

  const isWaitingApproval =
    task.status === "WAITING_APPROVAL" ||
    (task.status as string) === "PENDING_EXECUTIVE_APPROVAL" ||
    (task.status as string) === "NEEDS_REVIEW" ||
    Boolean((task as any).needsReview) ||
    (task as any).approvalStatus === "PENDING";

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
    if (e.key === "Enter") {
      e.preventDefault();
      onClick?.(task);
    } else if (e.key === " " || e.key === "x" || e.key === "X") {
      e.preventDefault();
      onToggleSelect?.(task.id, e as unknown as React.MouseEvent);
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

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onContextMenu?.(task, e);
  };

  const taskCode = task.code || task.taskCode || `NV-${task.id.slice(0, 4)}`;
  const statusLabel =
    task.status === "COMPLETED"
      ? "Hoàn thành"
      : slaStatus.isOverdue
      ? "Quá hạn"
      : isWaitingApproval
      ? "Chờ duyệt"
      : task.status === "IN_PROGRESS"
      ? "Đang thực hiện"
      : "Mới";

  const paddingClass = "py-2 px-2.5";
  const titlePaddingClass = "pl-3.5 sm:pl-4 pr-2.5 py-2";
  const rowHeightClass = "min-h-[44px] sm:min-h-[48px]";

  // Cell styling based on column position (first, middle, last) and contiguous selection group status
  const getCellClasses = (isFirst: boolean, isLast: boolean) => {
    const bgClass = isSelected
      ? "bg-primary/[0.08] group-hover:bg-primary/[0.12]"
      : "bg-transparent group-hover:bg-muted/35";

    let radiusClass = "rounded-none";
    if (!isSelected || selectionGroupPosition === "only" || !selectionGroupPosition) {
      if (isFirst) radiusClass = "rounded-l-xl";
      else if (isLast) radiusClass = "rounded-r-xl";
    } else if (selectionGroupPosition === "first") {
      if (isFirst) radiusClass = "rounded-tl-xl rounded-bl-none rounded-r-none";
      else if (isLast) radiusClass = "rounded-tr-xl rounded-br-none rounded-l-none";
    } else if (selectionGroupPosition === "middle") {
      radiusClass = "rounded-none";
    } else if (selectionGroupPosition === "last") {
      if (isFirst) radiusClass = "rounded-bl-xl rounded-tl-none rounded-r-none";
      else if (isLast) radiusClass = "rounded-br-xl rounded-tr-none rounded-l-none";
    }

    return cn("transition-colors border-b-[1.5px] border-transparent", bgClass, radiusClass);
  };

  return (
    <tr
      role="row"
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={handleKeyDown}
      onContextMenu={handleRightClick}
      data-task-id={task.id}
      data-task-tier="1"
      aria-selected={isSelected}
      className={cn(
        "group cursor-pointer transition-all select-none bg-transparent text-foreground",
        rowHeightClass,
        // State 1: Hover on unselected row — subtle tint without competing with selected state
        !isSelected && "hover:bg-muted/35",
        // State 2: Focus on unselected row (WCAG 2.2 AA Focus visible)
        !isSelected && "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset focus-visible:bg-muted/30 focus-visible:outline-none",
        // Focus on selected row: subtle inner tint without recreating individual rounded capsule or gaps
        isSelected && "focus-visible:outline-none focus-visible:[&>td]:bg-primary/[0.14]",
        // State 4: Previewing (Peek preview)
        isPreviewing && "bg-blue-50/70 ring-1 ring-inset ring-blue-500/40",
        // State 5: Opened / Active detail
        isActive && !isPreviewing && !isSelected && "ring-1 ring-inset ring-primary/40 bg-primary/[0.08]",
        isExpanded && "bg-muted/20",
        className
      )}
    >
      {/* 1. Mã Column: Selector + Status Circle + Priority Signal Bars + Task Code */}
      <td className={cn("w-44 min-w-[170px] align-middle whitespace-nowrap", titlePaddingClass, getCellClasses(true, false))}>
        <div className="flex items-center gap-2">
          {/* Integrated leading selector: Accessible keyboard + large hit area (~32px) */}
          <div
            role="checkbox"
            aria-checked={isSelected}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                onToggleSelect?.(task.id, e as unknown as React.MouseEvent);
              }
            }}
            className="size-7 sm:size-8 -my-2 ml-0 shrink-0 flex items-center justify-center relative select-none cursor-pointer group/selector focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded"
            onClick={handleCheckboxClick}
            title={isSelected ? "Bỏ chọn (X)" : "Chọn nhiệm vụ (X)"}
          >
            <input
              type="checkbox"
              checked={isSelected}
              readOnly
              className="sr-only"
              aria-label={isSelected ? `Bỏ chọn nhiệm vụ ${task.title}` : `Chọn nhiệm vụ ${task.title}`}
              tabIndex={-1}
            />
            {isSelected ? (
              <div
                className="size-4 rounded-[4px] bg-primary text-primary-foreground flex items-center justify-center shadow-2xs hover:opacity-90 transition-all active:scale-[0.98] pointer-events-none"
                aria-hidden="true"
              >
                <Check className="size-3 text-primary-foreground" strokeWidth={2.5} />
              </div>
            ) : (
              /* Minimalist Subtle Checkbox: Quiet and visible when idle, highlighted on hover */
              <div
                className="size-4 rounded-[4px] border border-border/70 bg-background/60 opacity-60 group-hover/selector:opacity-100 group-hover:opacity-100 group-hover:border-primary group-hover:bg-primary/5 group-hover:scale-105 flex items-center justify-center transition-all duration-150 ease-out active:scale-[0.98] shadow-2xs pointer-events-none"
                aria-hidden="true"
              />
            )}
          </div>

          {/* Geometric Status Indicator Circle with accessible label */}
          <div title={statusLabel} className="shrink-0 flex items-center">
            <TaskStatusCircle status={task.status} />
            <span className="sr-only">{statusLabel}</span>
          </div>

          {/* Priority 3-bar signal indicator */}
          <PrioritySignalBars priority={task.priority} />

          {/* Task Code */}
          <span
            className="font-mono text-xs text-muted-foreground/80 tabular-nums shrink-0"
            title={taskCode}
          >
            {taskCode}
          </span>
        </div>
      </td>

      {/* 2. Tên Column: Title + Inline Subtask Count */}
      <td className={cn("min-w-[280px] md:min-w-[360px] flex-1 align-middle", paddingClass, getCellClasses(false, false))}>
        <div className="flex flex-col min-w-0 gap-0.5">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="text-[13px] sm:text-[13.5px] font-medium text-foreground group-hover:text-primary transition-colors truncate"
              title={task.title}
            >
              {task.title}
            </span>

            {/* Inline subtask counter matching Image #1 and qcet-nhiem-vu.html: e.g. 1/4 or 0/3 */}
            {totalSubTasks > 0 && (
              <span
                className="text-xs text-muted-foreground/60 tabular-nums font-normal shrink-0"
                title={`${completedSubTasks}/${totalSubTasks} việc con hoàn thành`}
              >
                {completedSubTasks}/{totalSubTasks}
              </span>
            )}

            {/* Matched Subtask Badge for SUBTASK_DRI */}
            {task.viewerContext?.relation === "SUBTASK_DRI" && (task.viewerContext.matchedSubtaskCount ?? 0) > 0 && (
              <span
                data-slot="subtask-dri-badge"
                className="rounded bg-sky-50 text-sky-700 border border-sky-200/80 px-1.5 py-0.2 font-mono text-[10px] font-semibold tabular-nums shrink-0 inline-flex items-center gap-1"
                title={`Bạn phụ trách ${task.viewerContext.matchedSubtaskCount} việc con trong nhiệm vụ này`}
              >
                Phụ trách {task.viewerContext.matchedSubtaskCount} việc con
              </span>
            )}

            {/* Due in month indicator */}
            {dueInMonthCount > 0 && (
              <span
                className="rounded bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.2 font-mono text-[10px] font-semibold tabular-nums shrink-0"
                title={`${dueInMonthCount} nhiệm vụ con đến hạn trong Kỳ Tháng ${selectedAcademicMonth}`}
              >
                Hạn trong kỳ T{selectedAcademicMonth} ({dueInMonthCount})
              </span>
            )}
          </div>

          {task.description && (() => {
            let preview = task.description;
            try {
              if (preview.includes('"qcetBlocks":true')) {
                const parsed = JSON.parse(preview);
                preview = (parsed.blocks as Array<{content?: string}>)
                  .map((b) => b.content || "")
                  .join(" ")
                  .trim();
              }
            } catch { /* keep raw */ }
            preview = preview.length > 120 ? preview.slice(0, 120) + "…" : preview;
            return preview ? (
              <span className="text-[11.5px] text-muted-foreground/60 truncate leading-snug max-w-full">
                {preview}
              </span>
            ) : null;
          })()}
        </div>
      </td>

      {/* 3. Đơn vị Column */}
      <td className={cn("w-36 lg:w-44 min-w-[120px] align-middle whitespace-nowrap", paddingClass, getCellClasses(false, false))}>
        <span className="text-xs text-muted-foreground truncate block" title={departmentName}>
          {departmentName || "—"}
        </span>
      </td>

      {/* 4. Phụ trách Column: Pastel Avatar + Name */}
      <td className={cn("w-40 lg:w-48 min-w-[140px] align-middle whitespace-nowrap", paddingClass, getCellClasses(false, false))}>
        <div
          className="flex items-center gap-2 min-w-0"
          title={`${driInfo.primaryName || "—"}${departmentName ? ` (${departmentName})` : ""}`}
        >
          {driInfo.primaryName ? (
            <>
              <UserAvatar
                name={driInfo.primaryName}
                avatarUrl={task.leadAssigneeAvatar}
                size="sm"
              />
              <span className="text-xs font-medium text-foreground truncate">
                {driInfo.primaryName}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground/50 text-xs">—</span>
          )}
        </div>
      </td>

      {/* 5. Hạn Column: DD/MM (bold red if overdue) + title with DD/MM/YYYY */}
      <td className={cn("w-28 min-w-[90px] align-middle whitespace-nowrap", paddingClass, getCellClasses(false, false))}>
        <div className="flex flex-col gap-0.5">
          {task.dueDate ? (
            <>
              <span
                className={cn(
                  "font-mono tabular-nums text-xs",
                  slaStatus.isOverdue
                    ? "text-rose-600 font-semibold"
                    : slaStatus.isToday
                    ? "text-amber-600 font-semibold"
                    : "text-muted-foreground font-normal"
                )}
                title={formatTableDate(task.dueDate)}
              >
                {formatShortTableDate(task.dueDate)}
              </span>
              {slaStatus.isOverdue && (
                <span
                  className="inline-flex items-center text-[10px] font-semibold text-rose-600"
                  title={slaStatus.label || "Quá hạn"}
                >
                  {slaStatus.label || "Quá hạn"}
                </span>
              )}
              {!slaStatus.isOverdue && slaStatus.isToday && (
                <span className="inline-flex items-center text-[10px] font-semibold text-amber-600">
                  Hôm nay
                </span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground/50 text-xs">—</span>
          )}
        </div>
      </td>

      {/* 6. Thao tác Column (Context button `...` - Mobile/Touch overflow) */}
      <td
        className={cn("w-8 min-w-[32px] align-middle text-right whitespace-nowrap pr-2.5", paddingClass, getCellClasses(false, true))}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu?.(task, e);
          }}
          className="inline-flex size-6 items-center justify-center rounded text-muted-foreground/60 hover:bg-muted hover:text-foreground cursor-pointer transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none"
          aria-label="Thao tác nhanh"
          title="Thao tác nhanh (Chuột phải hoặc nhấp)"
        >
          <MoreHorizontal className="size-3.5" strokeWidth={1.5} />
        </button>
      </td>
    </tr>
  );
});
