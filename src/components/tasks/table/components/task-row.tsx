"use client";

import * as React from "react";
import {
  AlertTriangle,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Eye,
  MoreHorizontal,
  Plus,
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
  activeCategory?: string;
  suppressCategory?: boolean;
  onToggleSelect?: (taskId: string, e?: React.MouseEvent | React.ChangeEvent) => void;
  onToggleExpand?: (taskId: string, e?: React.MouseEvent) => void;
  onClick?: (task: SchoolTask) => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => Promise<void> | void;
  onUrge?: (taskId: string, taskTitle: string, assigneeName: string) => Promise<void> | void;
  onAddSubTask?: (parentTaskOrId: SchoolTask | string) => void;
  className?: string;
}

export interface ParsedLeadAssignee {
  primaryName: string;
  subtext: string;
}

export function parseLeadAssignee(
  rawName?: string,
  department?: string
): ParsedLeadAssignee {
  if (!rawName || !rawName.trim()) {
    return {
      primaryName: "QCET",
      subtext: department || "",
    };
  }

  let cleaned = rawName.trim();
  let parenthetical = "";

  // Extract trailing parenthetical notes, e.g. "ThS. Nguyễn Tiến Phong (Trưởng phòng TC-ĐBCL)"
  const parenMatch = cleaned.match(/\s*\(([^)]+)\)\s*$/);
  if (parenMatch) {
    parenthetical = parenMatch[1].trim();
    cleaned = cleaned.slice(0, parenMatch.index).trim();
  }

  // Extract academic & administrative title prefixes, e.g. "TT ThS.", "ThS.", "TS.", "PGS.TS."
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
  } else if (department && !prefix.includes(department)) {
    subtextParts.push(department);
  }

  return {
    primaryName,
    subtext: subtextParts.join(" · "),
  };
}

function getInitials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
  if (prev.activeCategory !== next.activeCategory) return false;
  if (prev.suppressCategory !== next.suppressCategory) return false;
  if (prev.onAddSubTask !== next.onAddSubTask) return false;
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
  activeCategory,
  suppressCategory = false,
  onToggleSelect,
  onToggleExpand,
  onClick,
  onStatusChange,
  onUrge,
  onAddSubTask,
  className,
}: TaskRowProps) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const hasSubtasks = Boolean(task.subTasks && task.subTasks.length > 0);
  const totalSubTasks = task.totalSubTasks ?? task.subTasks?.length ?? 0;
  const completedSubTasks =
    task.completedSubTasks ??
    task.subTasks?.filter((s) => s.status === "COMPLETED").length ??
    0;

  const categoryConfig = getCategoryBadgeConfig(task.category);
  const statusConfig = getStatusBadgeConfig(task.status);
  const slaStatus = getSlaBadgeStatus(
    task.dueDate,
    task.status,
    typeof referenceDate === "string" ? referenceDate : referenceDate.toISOString().slice(0, 10)
  );
  const shouldSuppressCategory =
    suppressCategory || (Boolean(activeCategory) && activeCategory !== "ALL");
  const driInfo = parseLeadAssignee(task.leadAssigneeName, task.department);

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

  // Lắng nghe Escape để đóng overflow menu
  React.useEffect(() => {
    if (!isMenuOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setIsMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isMenuOpen]);

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

  const handleToggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen((prev) => !prev);
  };

  const paddingClass = density === "compact" ? "py-1.5 px-2.5" : "py-2.5 px-3.5";
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
        "group cursor-pointer transition-colors border-b border-border/70 select-none hover:bg-muted/50 focus-visible:outline-hidden",
        rowHeightClass,
        isSelected && "bg-primary/[0.04]",
        isExpanded && "bg-muted/30",
        isActive && "ring-1 ring-inset ring-indigo-500/40 bg-indigo-50/20",
        className
      )}
    >
      {/* 1. Selection Checkbox */}
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
              className="size-4 rounded border-input text-primary focus:ring-2 focus:ring-primary/25 cursor-pointer transition-colors"
              aria-label={`Chọn nhiệm vụ ${task.taskCode || task.id}`}
            />
          </div>
        </td>
      )}

      {/* 2. Nhiệm vụ (Title leads, secondary muted mono Code, subtask rollup) */}
      <td className={cn("align-middle text-sm font-medium text-foreground leading-snug", paddingClass)}>
        <div className="flex items-center gap-2">
          {/* Hierarchical Expand/Collapse Caret */}
          {hasSubtasks ? (
            <button
              type="button"
              onClick={handleExpandClick}
              className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-muted/80 hover:text-foreground cursor-pointer shrink-0"
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
            <span className="inline-flex size-6 items-center justify-center shrink-0">
              <span className="size-1.5 rounded-full bg-muted-foreground/30" />
            </span>
          )}

          {/* Task Title (Primary lead) */}
          <span
            className="line-clamp-1 text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate"
            title={task.title}
          >
            {task.title}
          </span>

          {/* Task Code (Secondary muted mono) */}
          <span className="font-mono text-xs text-muted-foreground tabular-nums shrink-0">
            {(task.code || task.taskCode || task.id).toUpperCase()}
          </span>

          {/* Subtask Rollup Indicator */}
          {hasSubtasks && (
            <span
              className="rounded bg-muted/70 px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums text-muted-foreground border border-border/60 shrink-0"
              title={`Hoàn thành ${completedSubTasks} trên tổng số ${totalSubTasks} việc thành phần`}
            >
              [{completedSubTasks}/{totalSubTasks}]
            </span>
          )}

          {/* Due in month indicator */}
          {dueInMonthCount > 0 && (
            <span
              className="rounded bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums shrink-0"
              title={`${dueInMonthCount} nhiệm vụ con đến hạn trong Kỳ Tháng ${selectedAcademicMonth}`}
            >
              Hạn trong kỳ T{selectedAcademicMonth} ({dueInMonthCount})
            </span>
          )}
        </div>
      </td>

      {/* 3. DRI (single clean avatar / initials + name) */}
      <td className={cn("w-36 align-middle whitespace-nowrap", paddingClass)}>
        <div
          className="flex items-center gap-1.5 min-w-0"
          title={`${driInfo.primaryName}${driInfo.subtext ? ` (${driInfo.subtext})` : ""}`}
        >
          {task.leadAssigneeAvatar ? (
            <img
              src={task.leadAssigneeAvatar}
              alt=""
              aria-hidden="true"
              width={22}
              height={22}
              loading="lazy"
              className="size-5.5 rounded-full object-cover shrink-0 ring-1 ring-border/40"
            />
          ) : (
            <span className="flex size-5.5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums text-muted-foreground border border-border">
              {getInitials(driInfo.primaryName)}
            </span>
          )}
          <span className="text-xs font-medium text-foreground/90 truncate">
            {driInfo.primaryName}
          </span>
        </div>
      </td>

      {/* 4. Đơn vị (Department tag) */}
      <td className={cn("w-36 sm:w-40 align-middle whitespace-nowrap", paddingClass)}>
        <div className="flex flex-col gap-0.5 justify-center">
          <span
            className="text-xs font-medium text-foreground truncate max-w-[150px]"
            title={task.department || "Toàn trường"}
          >
            {task.department || "Toàn trường"}
          </span>
          {!shouldSuppressCategory && categoryConfig && (
            <span
              className="text-xs text-muted-foreground truncate max-w-[150px]"
              title={categoryConfig.label}
            >
              {categoryConfig.label}
            </span>
          )}
        </div>
      </td>

      {/* 5. Hạn (SLA formatted date, highlighted if overdue; SLA badge only when urgent) */}
      <td className={cn("w-32 align-middle whitespace-nowrap", paddingClass)}>
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "font-mono tabular-nums text-xs font-semibold",
              slaStatus.isOverdue ? "text-rose-700 font-bold" : "text-muted-foreground"
            )}
          >
            {formatTableDate(task.dueDate)}
          </span>
          {slaStatus.label && task.status !== "COMPLETED" && task.status !== "CANCELLED" && (
            <span
              className={cn(
                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold border tabular-nums",
                slaStatus.colorClass
              )}
            >
              {slaStatus.isOverdue ? (
                <AlertTriangle className="size-3 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              ) : (
                <Clock className="size-3 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              )}
              {slaStatus.label}
            </span>
          )}
        </div>
      </td>

      {/* 6. Trạng thái (single clear scanning status badge) */}
      <td className={cn("w-28 align-middle whitespace-nowrap", paddingClass)}>
        <Badge
          variant={statusConfig.variant}
          className={cn(
            "h-5.5 px-2 text-xs font-semibold tabular-nums leading-none shrink-0",
            statusConfig.className
          )}
        >
          {statusConfig.label}
        </Badge>
      </td>

      {/* 7. Tiến độ (compact progress bar when 0 < progress < 100, suppressed bar at 0% and completed 100%) */}
      <td className={cn("w-28 align-middle whitespace-nowrap", paddingClass)}>
        {task.progressPercent > 0 && task.progressPercent < 100 ? (
          <div className="flex items-center gap-2">
            <div className="relative flex h-1.5 w-14 overflow-hidden rounded-full bg-muted/80">
              <div
                className="h-full bg-emerald-500 transition-all duration-300 ease-out"
                style={{
                  width: `${task.progressPercent}%`,
                }}
              />
            </div>
            <span className="font-mono text-xs font-semibold tabular-nums text-foreground/80">
              {task.progressPercent}%
            </span>
          </div>
        ) : task.progressPercent === 100 && task.status !== "COMPLETED" ? (
          <div className="flex items-center gap-2">
            <div className="relative flex h-1.5 w-14 overflow-hidden rounded-full bg-muted/80">
              <div className="h-full w-full bg-emerald-500" />
            </div>
            <span className="font-mono text-xs font-semibold tabular-nums text-amber-700">
              100%
            </span>
          </div>
        ) : (
          <span className="font-mono text-xs tabular-nums text-muted-foreground/60">
            {task.progressPercent === 100 ? "100%" : "0%"}
          </span>
        )}
      </td>

      {/* 8. Actions (maximum 1 contextual CTA if required + ... overflow dropdown menu) */}
      <td
        className={cn("w-24 sm:w-28 align-middle text-right whitespace-nowrap", paddingClass)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex items-center justify-end gap-1.5">
          {/* Contextual CTA: Inline [Duyệt] if WAITING_APPROVAL */}
          {isWaitingApproval && onStatusChange && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStatusChange(task.id, "COMPLETED");
              }}
              className="inline-flex h-6.5 items-center gap-1 rounded-md border border-emerald-600/30 bg-emerald-600 px-2 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer active:scale-95 transition-all shadow-2xs"
              title="Duyệt hoàn thành nhiệm vụ"
              aria-label={`Duyệt nhiệm vụ ${task.taskCode || task.id}`}
            >
              <Check className="size-3" strokeWidth={1.5} />
              <span>Duyệt</span>
            </button>
          )}

          {/* Secondary Actions: Overflow Menu (...) */}
          <div className="relative">
            <button
              type="button"
              onClick={handleToggleMenu}
              className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/80 hover:text-foreground cursor-pointer transition-colors"
              aria-expanded={isMenuOpen}
              aria-label="Thao tác khác"
              title="Thao tác khác"
            >
              <MoreHorizontal className="size-4" strokeWidth={1.5} />
            </button>

            {isMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(false);
                  }}
                  aria-hidden="true"
                />
                <div
                  role="menu"
                  aria-orientation="vertical"
                  className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-border bg-card p-1 shadow-lg z-40 text-xs font-medium divide-y divide-border/50 animate-in fade-in zoom-in-95 duration-100"
                >
                  <div className="py-0.5 space-y-0.5">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsMenuOpen(false);
                        onClick?.(task);
                      }}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-foreground hover:bg-muted/60 cursor-pointer transition-colors text-left"
                    >
                      <Eye className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                      <span>Xem chi tiết</span>
                    </button>

                    {onStatusChange && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsMenuOpen(false);
                          const nextStatus: TaskStatus =
                            task.status === "COMPLETED" ? "IN_PROGRESS" : "COMPLETED";
                          onStatusChange(task.id, nextStatus);
                        }}
                        className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-foreground hover:bg-muted/60 cursor-pointer transition-colors text-left"
                      >
                        <Check className="size-3.5 text-emerald-600" strokeWidth={1.5} />
                        <span>
                          {task.status === "COMPLETED"
                            ? "Đổi thành Đang làm"
                            : "Đánh dấu Hoàn thành"}
                        </span>
                      </button>
                    )}
                  </div>

                  {((canAssign && onAddSubTask) || (onUrge && task.status !== "COMPLETED")) && (
                    <div className="py-0.5 space-y-0.5">
                      {canAssign && onAddSubTask && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsMenuOpen(false);
                            onAddSubTask(task.id);
                          }}
                          className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-foreground hover:bg-muted/60 cursor-pointer transition-colors text-left"
                        >
                          <Plus className="size-3.5 text-primary" strokeWidth={1.5} />
                          <span>Thêm việc con</span>
                        </button>
                      )}

                      {onUrge && task.status !== "COMPLETED" && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsMenuOpen(false);
                            onUrge(task.id, task.title, task.leadAssigneeName || "");
                          }}
                          className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-foreground hover:bg-muted/60 cursor-pointer transition-colors text-left"
                        >
                          <Bell className="size-3.5 text-amber-600" strokeWidth={1.5} />
                          <span>Đôn đốc tiến độ</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}, areTaskRowPropsEqual);
