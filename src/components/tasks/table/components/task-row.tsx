"use client";

import type { SelectionGroupPosition } from "@/lib/selection-group";
import * as React from "react";
import { Check, Ellipsis } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Button } from "@/components/ui/button";
import type { SchoolTask, TaskStatus } from "@qcet/contracts/types/dashboard";
import type { TableDensity, TableColumnVisibility } from "../types";
import {
  formatTableDate,
  getDueIndicator,
  getSlaBadgeStatus,
  getSystemReferenceDate,
} from "../utils/table-date-helpers";
import { isDateInAcademicMonth } from "@qcet/shared/lib/academic-calendar";
import { getCategoryBadgeConfig, TASK_COLUMN_CLASS } from "../constants";
import { PrioritySignalBars } from "@/components/tasks/priority-signal-bars";
import { TaskStatusCircle } from "@/components/tasks/task-status-circle";
import {
  TaskIconDue,
  TaskIconDueClosed,
  TaskIconDueOverdue,
  TaskIconDueSoon,
  TaskIconStatusOverdue,
} from "@qcet/shared/lib/icons/task-icons";

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
  /** Dòng đang là đích của menu chuột phải: giữ nền nổi bật khi menu mở */
  isContextMenuTarget?: boolean;
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
  onContextMenu?: (task: SchoolTask, e: React.MouseEvent | React.KeyboardEvent) => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => Promise<void> | void;
  onUrge?: (taskId: string, taskTitle: string, assigneeName: string) => Promise<void> | void;
  onAddSubTask?: (parentTaskOrId: SchoolTask | string) => void;
  showTaskCode?: boolean;
  /** Position within a contiguous selection group: 'first' | 'middle' | 'last' | 'only' | null */
  selectionGroupPosition?: SelectionGroupPosition | null;
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

/** Ô chưa có dữ liệu: dấu gạch mờ cho mắt, "Chưa có" cho trình đọc màn hình */
function EmptyCell() {
  return (
    <span className="text-xs text-muted-foreground/50">
      <span aria-hidden="true">–</span>
      <span className="sr-only">Chưa có</span>
    </span>
  );
}

/** Ô ngày dùng chung cho cột Ngày tạo và Hạn (cùng padding, căn trái) */
const TASK_DATE_CELL_CLASS = "align-middle whitespace-nowrap pl-2.5 pr-4 sm:pr-5 py-1.5 text-left";

/** Hiển thị ngày dùng chung cho cột Ngày tạo và Hạn: cùng cỡ chữ, số căn đều */
function TaskDateValue({
  value,
  icon: Icon,
  iconClassName,
  textClassName,
  title,
  srText,
}: {
  value: string | Date;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: "true" }>;
  iconClassName?: string;
  textClassName?: string;
  title?: string;
  srText?: string;
}) {
  return (
    <div className="flex items-center gap-2 tabular-nums text-xs" title={title}>
      {Icon && <Icon className={cn("size-4 shrink-0", iconClassName)} aria-hidden="true" />}
      <span className={textClassName}>{formatShortTableDate(value)}</span>
      {srText && <span className="sr-only">{srText}</span>}
    </div>
  );
}

export const TaskRow = React.memo(function TaskRow({
  task,
  scope,
  isSelected = false,
  isExpanded = false,
  isActive = false,
  isPreviewing = false,
  density = "comfortable",
  visibleColumns = { priority: true, subtasks: true, status: true },
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
  isContextMenuTarget = false,
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

  // Nhóm avatar "Phối hợp": ưu tiên người kèm ảnh đại diện thật (Google); chỉ khi thiếu ảnh mới hiện chữ cái
  const coAssigneeEntries: Array<{ name: string; avatarUrl?: string }> = React.useMemo(() => {
    const entries = new Map<string, { name: string; avatarUrl?: string }>();
    const add = (name: unknown, avatarUrl?: string | null) => {
      if (typeof name !== "string") return;
      const clean = name.trim();
      if (!clean || clean === "Chưa phân công") return;
      const existing = entries.get(clean);
      if (!existing) entries.set(clean, { name: clean, avatarUrl: avatarUrl || undefined });
      else if (!existing.avatarUrl && avatarUrl) existing.avatarUrl = avatarUrl;
    };
    if (Array.isArray((task as any).coAssigneeUsers)) {
      (task as any).coAssigneeUsers.forEach((u: any) => add(u?.name, u?.avatarUrl));
    }
    if (Array.isArray((task as any).coAssignees)) {
      (task as any).coAssignees.forEach((n: any) => add(typeof n === "string" ? n : n?.name, typeof n === "string" ? undefined : n?.avatarUrl));
    }
    if (Array.isArray(task.subTasks)) {
      task.subTasks.forEach((st) => add(st.assigneeName, (st as any).assigneeAvatar));
    }
    return Array.from(entries.values());
  }, [task]);
  const coAssigneesList = React.useMemo(() => coAssigneeEntries.map((e) => e.name), [coAssigneeEntries]);

  // Hạn: icon lịch đổi màu theo mức độ gấp (đỏ: trễ/hôm nay, cam: trong 7 ngày, xám: còn lại)
  const dueIndicator = getDueIndicator({
    status: task.status,
    isOverdue: slaStatus.isOverdue,
    isToday: slaStatus.isToday,
    daysRemaining: slaStatus.daysRemaining,
    label: slaStatus.label,
  });
  const dueTone = dueIndicator.tone;
  const dueHint = dueIndicator.hint;
  const DueIcon = {
    closed: TaskIconDueClosed,
    overdue: TaskIconDueOverdue,
    soon: TaskIconDueSoon,
    default: TaskIconDue,
  }[dueIndicator.icon];

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
    // Phím Menu hoặc Shift+F10: mở menu thao tác như chuột phải (chỉ khi focus đang ở chính dòng).
    if ((e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey)) && e.target === e.currentTarget) {
      e.preventDefault();
      onContextMenu?.(task, e);
    } else if (e.key === "Enter") {
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

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onContextMenu?.(task, e);
  };

  const rawCode = task.code || task.taskCode || `NV-${task.id.slice(0, 4)}`;
  const taskCode = rawCode.replace(/[–—–—]/g, "-");
  const statusLabel =
    task.status === "COMPLETED"
      ? "Hoàn thành"
      : slaStatus.isOverdue
      ? "Trễ hạn"
      : isWaitingApproval
      ? "Chờ duyệt"
      : task.status === "IN_PROGRESS"
      ? "Đang thực hiện"
      : "Mới";

  const rowHeightClass = "h-12 min-h-[48px]";
  // Các hàng đang chọn liền nhau gộp thành một khối: chỉ bo góc ngoài của khối
  const radiusTop = "[&>td:first-child]:rounded-tl-md [&>td:last-child]:rounded-tr-md";
  const radiusBottom = "[&>td:first-child]:rounded-bl-md [&>td:last-child]:rounded-br-md";
  // Hàng chưa chọn chỉ bo góc khi có nền riêng (hover, đang xem, menu chuột phải). Nếu bo sẵn, lúc
  // bỏ chọn hàng loạt nền xanh còn đang mờ dần sẽ lộ các góc bo rời rạc giữa các hàng liền nhau.
  const hoverRadiusClass = "hover:[&>td:first-child]:rounded-l-md hover:[&>td:last-child]:rounded-r-md";
  const hasStandaloneBg = isPreviewing || isActive || isContextMenuTarget || isExpanded;
  const selectionRadiusClass = !isSelected
    ? hasStandaloneBg
      ? cn(radiusTop, radiusBottom)
      : hoverRadiusClass
    : selectionGroupPosition === "only" || selectionGroupPosition === null
    ? cn(radiusTop, radiusBottom)
    : selectionGroupPosition === "first"
    ? radiusTop
    : selectionGroupPosition === "last"
    ? radiusBottom
    : "";

  return (
    <tr
      role="row"
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={handleKeyDown}
      onContextMenu={handleRightClick}
      data-task-id={task.id}
      data-task-tier="1"
      data-slot="task-row"
      aria-selected={isSelected}
      className={cn(
        // Nền và bo góc đặt trên <td> (<tr> trong bảng border-collapse không bo được;
        // pseudo-element trong <tr> thì bị coi là một ô thừa và làm lệch cột)
        "group cursor-pointer select-none text-foreground outline-none [&>td]:transition-colors",
        rowHeightClass,
        selectionRadiusClass,
        // State 1: Hover on unselected row
        !isSelected && "hover:[&>td]:bg-muted/40",
        // State 2: Selected row
        isSelected && "[&>td]:bg-selected/80 hover:[&>td]:bg-selected",
        // State 3: Focus (WCAG 2.2 AA Focus visible)
        "focus-visible:[--row-ring-w:2px] focus-visible:[--row-ring-c:var(--color-primary)]",
        // State 4: Previewing (Peek preview)
        isPreviewing && "[&>td]:bg-selected/70",
        // State 5: Opened / Active detail
        isActive && !isPreviewing && !isSelected && "[&>td]:bg-selected",
        // State 6: Đích của menu chuột phải (giữ bôi nền khi menu mở, vì con trỏ đã rời dòng)
        isContextMenuTarget && !isSelected && !isPreviewing && "[&>td]:bg-accent",
        isExpanded && "[&>td]:bg-muted/20",
        className
      )}
    >
      {/* 1. Tên nhiệm vụ Column: Selector + Status Circle + Title + Code + Subtask Count */}
      <td className={cn("relative align-middle pl-4 sm:pl-5 pr-11 py-1.5", TASK_COLUMN_CLASS.title)}>
        <div className="flex items-center gap-2 min-w-0">
          {/* Integrated leading selector */}
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
                className="size-3.5 rounded-[3px] bg-primary text-primary-foreground flex items-center justify-center shadow-2xs hover:opacity-90 transition-[opacity,transform] active:scale-[0.98] pointer-events-none"
                aria-hidden="true"
              >
                <Check className="size-2.5 text-primary-foreground" />
              </div>
            ) : (
              <div
                className="size-3.5 rounded-[3px] border border-border/70 bg-background/60 opacity-60 group-hover/selector:opacity-100 group-hover:opacity-100 group-hover:border-primary group-hover:bg-primary/5 group-hover:scale-105 flex items-center justify-center transition-[opacity,transform,border-color,background-color] duration-150 ease-out active:scale-[0.98] shadow-2xs pointer-events-none"
                aria-hidden="true"
              />
            )}
          </div>

          <div className="flex flex-col flex-1 min-w-0 gap-0.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="sr-only">{statusLabel}</span>

              <span
                className="text-compact font-medium text-foreground group-hover:text-primary transition-colors truncate"
                title={task.title}
              >
                {task.title}
              </span>

              {/* Task Code */}
              {visibleColumns?.code === true && (
                <span
                  className="font-mono text-xs text-muted-foreground/60 tabular-nums shrink-0"
                  title={taskCode}
                >
                  {taskCode}
                </span>
              )}

              {/* Linear-style Category / Tag Pill */}
              {task.category && !suppressCategory && visibleColumns?.category === true && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-muted/60 text-muted-foreground border border-border/40 shrink-0"
                  title={`Danh mục: ${getCategoryBadgeConfig(task.category).label}`}
                >
                  <span
                    className="size-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: getCategoryBadgeConfig(task.category).oklchColor }}
                    aria-hidden="true"
                  />
                  <span>{getCategoryBadgeConfig(task.category).label}</span>
                </span>
              )}

              {/* Inline subtask counter matching Image #1 and qcet-nhiem-vu.html: e.g. 1/4 or 0/3 */}
              {totalSubTasks > 0 && visibleColumns?.subtasks !== false && (
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
                  className="rounded bg-sky-50 text-sky-700 border border-sky-200/80 px-1.5 py-0.2 font-mono text-xs font-semibold tabular-nums shrink-0 inline-flex items-center gap-1"
                  title={`Bạn phụ trách ${task.viewerContext.matchedSubtaskCount} việc con trong nhiệm vụ này`}
                >
                  Phụ trách {task.viewerContext.matchedSubtaskCount} việc con
                </span>
              )}

              {/* Due in month indicator */}
              {dueInMonthCount > 0 && (
                <span
                  className="rounded bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.2 font-mono text-xs font-semibold tabular-nums shrink-0"
                  title={`${dueInMonthCount} nhiệm vụ con đến hạn trong Kỳ Tháng ${selectedAcademicMonth}`}
                >
                  Hạn trong kỳ T{selectedAcademicMonth} ({dueInMonthCount})
                </span>
              )}
            </div>
          </div>
        </div>
        {/* Nút thao tác: hiện khi rê chuột / focus dòng; màn cảm ứng luôn hiện vì không có hover */}
        {onContextMenu && (
          <Button
            variant="ghost"
            size="icon-xs"
            className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 aria-expanded:opacity-100"
            aria-label={`Thao tác với nhiệm vụ ${task.title}`}
            aria-haspopup="menu"
            aria-expanded={isContextMenuTarget}
            onClick={(e) => {
              e.stopPropagation();
              onContextMenu(task, e);
            }}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Ellipsis />
          </Button>
        )}
      </td>

      {/* 3. Ưu tiên Column */}
      {visibleColumns?.priority !== false && (
        <td className={cn("align-middle whitespace-nowrap px-3 py-1.5", TASK_COLUMN_CLASS.priority)}>
          <div className="flex items-center">
            <PrioritySignalBars priority={task.priority} />
          </div>
        </td>
      )}

      {/* 4. Phụ trách Column: Avatar + Name */}
      {visibleColumns?.leadAssignee !== false && (
        <td className={cn("align-middle px-3 py-1.5", TASK_COLUMN_CLASS.leadAssignee)}>
          <div className="flex items-center gap-2 min-w-0" title={driInfo.primaryName || undefined}>
            {driInfo.primaryName ? (
              <>
                <UserAvatar
                  name={driInfo.primaryName}
                  avatarUrl={task.leadAssigneeAvatar}
                  size="xs"
                />
                <span className="min-w-0 truncate text-xs text-foreground">
                  {driInfo.primaryName}
                </span>
              </>
            ) : (
              <EmptyCell />
            )}
          </div>
        </td>
      )}

      {/* 4b. Phối hợp Column */}
      {visibleColumns?.coAssignees === true && (
        <td className={cn("align-middle whitespace-nowrap px-3 py-1.5", TASK_COLUMN_CLASS.coAssignees)}>
          {coAssigneesList.length > 0 && (
            <div className="flex items-center -space-x-1" title={coAssigneesList.join(", ")}>
              {coAssigneeEntries.slice(0, 3).map((entry) => (
                <UserAvatar key={entry.name} name={entry.name} avatarUrl={entry.avatarUrl} size="xs" />
              ))}
              {coAssigneesList.length > 3 && (
                <span className="ml-2.5 text-xs text-muted-foreground tabular-nums">
                  +{coAssigneesList.length - 3}
                </span>
              )}
            </div>
          )}
        </td>
      )}

      {/* 2. Đơn vị Column */}
      {visibleColumns?.department !== false && (
        <td className={cn("align-middle px-3 py-1.5", TASK_COLUMN_CLASS.department)}>
          <span
            className="text-xs leading-snug text-muted-foreground line-clamp-2 break-words"
            title={departmentName || undefined}
          >
            {departmentName || "-"}
          </span>
        </td>
      )}

      {/* Bắt đầu Column */}
      {visibleColumns?.startDate === true && (
        <td className={cn(TASK_DATE_CELL_CLASS, TASK_COLUMN_CLASS.startDate)}>
          {task.startDate ? (
            <TaskDateValue
              value={task.startDate}
              textClassName="text-muted-foreground"
              title={formatTableDate(task.startDate)}
            />
          ) : (
            <EmptyCell />
          )}
        </td>
      )}

      {/* Hạn Column */}
      {visibleColumns?.dueDate !== false && (
        <td className={cn(TASK_DATE_CELL_CLASS, TASK_COLUMN_CLASS.dueDate, "relative group/due")}>
          <div>
            {task.dueDate ? (
              <TaskDateValue
                value={task.dueDate}
                icon={DueIcon}
                iconClassName={
                  dueTone === "danger"
                    ? "text-destructive"
                    : dueTone === "warn"
                    ? "text-warning"
                    : "text-muted-foreground/70"
                }
                textClassName={cn(
                  dueTone === "danger" ? "text-destructive" : dueTone === "warn" ? "text-warning" : "text-muted-foreground"
                )}
                title={`${formatTableDate(task.dueDate)} · ${dueHint}`}
                srText={dueHint}
              />
            ) : (
              <EmptyCell />
            )}
          </div>
        </td>
      )}

      {/* Ngày tạo Column (đứng sau Hạn) */}
      {visibleColumns?.createdAt === true && (
        <td className={cn(TASK_DATE_CELL_CLASS, TASK_COLUMN_CLASS.createdAt)}>
          {task.createdAt ? (
            <TaskDateValue
              value={task.createdAt}
              textClassName="text-muted-foreground"
              title={formatTableDate(task.createdAt)}
            />
          ) : (
            <EmptyCell />
          )}
        </td>
      )}

      {/* Trạng thái Column */}
      {visibleColumns?.status === true && (
        <td className={cn("align-middle whitespace-nowrap pl-2.5 pr-4 sm:pr-5 py-1.5", TASK_COLUMN_CLASS.status)}>
          <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            {statusLabel === "Trễ hạn" ? (
              <TaskIconStatusOverdue className="size-4 shrink-0 text-destructive" />
            ) : (
              <TaskStatusCircle status={task.status} />
            )}
            <span className={cn("truncate", statusLabel === "Trễ hạn" && "font-semibold text-destructive")}>{statusLabel}</span>
          </span>
        </td>
      )}
    </tr>
  );
});
