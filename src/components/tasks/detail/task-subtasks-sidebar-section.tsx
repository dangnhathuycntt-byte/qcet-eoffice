"use client";

import * as React from "react";
import { Plus, User } from "lucide-react";
import type { StaffTask } from "@/types/dashboard";
import { STATUS_OPTIONS } from "./task-identity-block";
import { cn, getInitials } from "@/lib/utils";
import { formatCompactDate, formatDisplayDate } from "@/lib/format/date";

export interface TaskSubtasksSidebarSectionProps {
  subTasks: StaffTask[];
  activeSubtaskId?: string | null;
  onSelectSubtask: (subtask: StaffTask) => void;
  onAddSubtask?: () => void;
}

const MAX_COLLAPSED = 5;

function SubtaskAssigneeAvatar({
  avatarUrl,
  name,
}: {
  avatarUrl?: string;
  name?: string;
}) {
  const [imgError, setImgError] = React.useState(false);
  const normalized = name?.trim().toLowerCase();
  const hasAssignee = Boolean(
    name && name.trim() && normalized !== "chưa phân công"
  );
  const initials = getInitials(name);

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={name || "Người phụ trách"}
        onError={() => setImgError(true)}
        className="size-4 rounded-full object-cover"
        title={name || "Người phụ trách"}
      />
    );
  }

  if (hasAssignee) {
    return (
      <div
        className="size-4 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-[8px]"
        title={name}
      >
        {initials}
      </div>
    );
  }

  return (
    <div
      className="size-4 rounded-full bg-muted/60 text-muted-foreground/50 flex items-center justify-center"
      title="Chưa phân công"
    >
      <User className="size-2.5" />
    </div>
  );
}

export function TaskSubtasksSidebarSection({
  subTasks = [],
  activeSubtaskId,
  onSelectSubtask,
  onAddSubtask,
}: TaskSubtasksSidebarSectionProps) {
  const [expanded, setExpanded] = React.useState(false);
  const visible = expanded ? subTasks : subTasks.slice(0, MAX_COLLAPSED);
  const remaining = Math.max(0, subTasks.length - MAX_COLLAPSED);

  const completedCount = subTasks.filter((st) => st.status === "COMPLETED").length;
  const progressPercent = subTasks.length > 0 ? Math.round((completedCount / subTasks.length) * 100) : 0;

  return (
    <div className="select-none">
      {/* Header */}
      <div className="group flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-foreground truncate">
            Việc con
          </span>
          <span className="font-mono text-[11px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full tabular-nums shrink-0">
            {subTasks.length}
          </span>
          {completedCount > 0 && (
            <span className="text-[10px] text-muted-foreground/70 font-mono tabular-nums shrink-0">
              ({completedCount} xong)
            </span>
          )}
        </div>
        {onAddSubtask && (
          <button
            type="button"
            onClick={onAddSubtask}
            className="inline-flex items-center gap-1 h-5 px-1.5 rounded text-[11px] font-medium text-muted-foreground/80 hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer shrink-0"
            title="Tạo việc con"
          >
            <Plus className="size-3" strokeWidth={1.5} />
            <span>Thêm</span>
          </button>
        )}
      </div>

      {/* Micro progress bar */}
      {subTasks.length > 0 && completedCount > 0 && (
        <div
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Tiến độ hoàn thành việc con"
          className="mt-1.5 h-1 w-full bg-muted/50 rounded-full overflow-hidden"
        >
          <div
            className="h-full bg-emerald-500/80 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Rows */}
      {visible.length > 0 && (
        <div className="mt-1.5 space-y-0.5">
          {visible.map((st) => {
            const isActive = st.id === activeSubtaskId;
            const statusOpt = STATUS_OPTIONS.find((o) => o.value === st.status);
            const dotClass = statusOpt?.dotClass ?? "bg-muted-foreground/60";
            const isCompleted = st.status === "COMPLETED";
            const formattedDueDate = st.dueDate ? formatCompactDate(st.dueDate, "") : "";

            return (
              <button
                key={st.id}
                type="button"
                onClick={() => onSelectSubtask(st)}
                className={cn(
                  "w-full flex items-start gap-2 px-1.5 py-1.5 rounded text-left text-[12px] leading-snug transition-colors cursor-pointer hover:bg-muted/60",
                  isActive ? "bg-muted/40" : ""
                )}
                title={st.title}
              >
                {/* 1. Chấm trạng thái */}
                <span
                  className={cn("size-2 rounded-full shrink-0 mt-1.5", dotClass)}
                  role="status"
                  aria-label={`Trạng thái: ${statusOpt?.label ?? st.status}`}
                />

                {/* 2. Tên việc con */}
                <span
                  className={cn(
                    "flex-1 min-w-0 line-clamp-2 break-words",
                    isCompleted
                      ? "text-muted-foreground/60 line-through decoration-muted-foreground/30"
                      : "text-foreground/90"
                  )}
                >
                  {st.title}
                </span>

                {/* 3. Hạn hoàn thành: DD/MM */}
                {formattedDueDate && (
                  <span
                    className="shrink-0 text-[10px] font-mono tabular-nums text-muted-foreground/70 mt-0.5"
                    title={`Hạn hoàn thành: ${formatDisplayDate(st.dueDate)}`}
                  >
                    {formattedDueDate}
                  </span>
                )}

                {/* 4. Avatar người phụ trách */}
                <div className="shrink-0 mt-0.5">
                  <SubtaskAssigneeAvatar
                    avatarUrl={st.assigneeAvatar}
                    name={st.assigneeName}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Expand / Collapse */}
      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-1 text-[11px] text-primary hover:underline cursor-pointer pl-1.5"
        >
          {expanded ? "Thu gọn" : `Xem thêm ${remaining} việc con`}
        </button>
      )}
    </div>
  );
}
