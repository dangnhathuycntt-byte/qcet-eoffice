"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import * as m from "motion/react-m";
import { Collapsible } from "@base-ui/react/collapsible";
import type { StaffTask } from "@/types/dashboard";
import { getStatusDisplay } from "@/domain/tasks/display-config";
import { TaskStatusCircle } from "@/components/tasks/task-status-circle";
import { getDueIndicator, getSlaBadgeStatus } from "@/components/tasks/table/utils/table-date-helpers";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import { formatCompactDate, formatDisplayDate } from "@/lib/format/date";
import { listItemVariants, staggerContainerVariants } from "@/lib/motion/variants";

export interface TaskSubtasksSidebarSectionProps {
  subTasks: StaffTask[];
  activeSubtaskId?: string | null;
  onSelectSubtask: (subtask: StaffTask) => void;
  onAddSubtask?: () => void;
}

const MAX_COLLAPSED = 5;

function SubtaskRow({
  subtask,
  isActive,
  onSelect,
}: {
  subtask: StaffTask;
  isActive: boolean;
  onSelect: (subtask: StaffTask) => void;
}) {
  const statusOpt = getStatusDisplay(subtask.status);
  const isCompleted = subtask.status === "COMPLETED";
  const formattedDueDate = subtask.dueDate ? formatCompactDate(subtask.dueDate, "") : "";

  // Cùng quy tắc màu hạn với bảng: đỏ khi trễ/hôm nay, nhạt khi còn xa
  const sla = getSlaBadgeStatus(subtask.dueDate, subtask.status);
  const due = getDueIndicator({
    status: subtask.status,
    isOverdue: sla.isOverdue,
    isToday: sla.isToday,
    daysRemaining: sla.daysRemaining,
    label: sla.label,
  });

  return (
    <m.div variants={listItemVariants}>
      <button
        type="button"
        onClick={() => onSelect(subtask)}
        className={cn(
          "w-full group/sub flex items-center gap-2.5 min-h-9 px-2 py-1.5 rounded-lg text-left text-compact leading-snug transition-colors cursor-pointer hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden",
          isActive ? "bg-muted/40 ring-1 ring-inset ring-border/60" : ""
        )}
        title={subtask.title}
      >
        {/* 1. Trạng thái */}
        <span
          className="shrink-0"
          role="status"
          aria-label={`Trạng thái: ${statusOpt?.label ?? subtask.status}`}
        >
          <TaskStatusCircle status={subtask.status} />
        </span>

        {/* 2. Tên việc con */}
        <span
          className={cn(
            "flex-1 min-w-0 line-clamp-2 break-words group-hover/sub:text-foreground",
            isCompleted
              ? "text-muted-foreground line-through decoration-muted-foreground/30"
              : "text-foreground/90"
          )}
        >
          {subtask.title}
        </span>

        {/* 3. Hạn hoàn thành: DD/MM (đỏ khi trễ hạn) */}
        {formattedDueDate && (
          <span
            className={cn(
              "shrink-0 text-xs tabular-nums",
              due.tone === "danger" ? "text-destructive font-medium" : "text-muted-foreground"
            )}
            title={`Hạn hoàn thành: ${formatDisplayDate(subtask.dueDate)}`}
          >
            {formattedDueDate}
          </span>
        )}

        {/* 4. Người phụ trách */}
        <div className="shrink-0">
          <UserAvatar avatarUrl={subtask.assigneeAvatar} name={subtask.assigneeName} size="sm" />
        </div>
      </button>
    </m.div>
  );
}

export function TaskSubtasksSidebarSection({
  subTasks = [],
  activeSubtaskId,
  onSelectSubtask,
  onAddSubtask,
}: TaskSubtasksSidebarSectionProps) {
  const [expanded, setExpanded] = React.useState(false);
  const alwaysVisible = subTasks.slice(0, MAX_COLLAPSED);
  const collapsibleItems = subTasks.slice(MAX_COLLAPSED);
  const remaining = Math.max(0, subTasks.length - MAX_COLLAPSED);

  const completedCount = subTasks.filter((st) => st.status === "COMPLETED").length;
  const progressPercent = subTasks.length > 0 ? Math.round((completedCount / subTasks.length) * 100) : 0;

  return (
    <div className="select-none">
      {/* Header */}
      <div className="group flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-compact font-semibold text-foreground truncate">Việc con</span>
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
            {subTasks.length}
          </span>
          {subTasks.length > 0 && (
            <span
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Tiến độ hoàn thành việc con"
              title={`${completedCount}/${subTasks.length} việc con đã xong`}
              className="inline-flex items-center gap-1 ml-0.5 text-xs text-muted-foreground tabular-nums"
            >
              <svg viewBox="0 0 16 16" className="size-3.5 -rotate-90" aria-hidden="true">
                <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth={1.5} />
                <circle
                  cx="8"
                  cy="8"
                  r="6.25"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  pathLength={100}
                  strokeDasharray={`${progressPercent} 100`}
                  className={completedCount === subTasks.length ? "text-emerald-500" : "text-foreground/70"}
                />
              </svg>
              {progressPercent}%
            </span>
          )}
        </div>
        {onAddSubtask && (
          <button
            type="button"
            onClick={onAddSubtask}
            className="inline-flex items-center gap-1 h-7 px-1.5 -mr-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
            title="Tạo việc con"
          >
            <Plus className="size-3.5" strokeWidth={1.5} />
            <span>Thêm</span>
          </button>
        )}
      </div>

      {/* Rows */}
      {alwaysVisible.length > 0 && (
        <m.div className="mt-1 space-y-0.5 -mx-1.5" variants={staggerContainerVariants} initial="initial" animate="animate">
          {alwaysVisible.map((st) => (
            <SubtaskRow key={st.id} subtask={st} isActive={st.id === activeSubtaskId} onSelect={onSelectSubtask} />
          ))}

          {/* Collapsible remaining items */}
          {collapsibleItems.length > 0 && (
            <Collapsible.Root open={expanded} onOpenChange={setExpanded}>
              <Collapsible.Panel className="space-y-0.5">
                {collapsibleItems.map((st) => (
                  <SubtaskRow key={st.id} subtask={st} isActive={st.id === activeSubtaskId} onSelect={onSelectSubtask} />
                ))}
              </Collapsible.Panel>
              <Collapsible.Trigger className="mt-1 text-xs text-primary hover:underline cursor-pointer pl-1.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden rounded">
                {expanded ? "Thu gọn" : `Xem thêm ${remaining} việc con`}
              </Collapsible.Trigger>
            </Collapsible.Root>
          )}
        </m.div>
      )}
    </div>
  );
}
