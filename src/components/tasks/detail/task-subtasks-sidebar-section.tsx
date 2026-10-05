"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import * as m from "motion/react-m";
import { Collapsible } from "@base-ui/react/collapsible";
import type { StaffTask } from "@/types/dashboard";
import { getStatusDisplay } from "@/domain/tasks/display-config";
import { getInitials, cn } from "@/lib/utils";
import { formatCompactDate, formatDisplayDate } from "@/lib/format/date";
import { listItemVariants, staggerContainerVariants } from "@/lib/motion/variants";

/** Compact inline avatar for subtask rows — renders img in SSR for avatar, initials circle otherwise */
function SubtaskAvatar({ name, avatarUrl }: { name?: string | null; avatarUrl?: string | null }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name || "Ảnh đại diện"}
        title={name || undefined}
        className="size-4 rounded-full object-cover shrink-0"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    );
  }
  if (name && name.trim() && name.trim().toLowerCase() !== "chưa phân công") {
    return (
      <span
        className="size-4 rounded-full shrink-0 inline-flex items-center justify-center bg-primary/10 text-primary text-[9px] font-semibold select-none"
        title={name}
      >
        {getInitials(name)}
      </span>
    );
  }
  return null;
}

export interface TaskSubtasksSidebarSectionProps {
  subTasks: StaffTask[];
  activeSubtaskId?: string | null;
  onSelectSubtask: (subtask: StaffTask) => void;
  onAddSubtask?: () => void;
}

const MAX_COLLAPSED = 5;

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
          <span className="text-xs font-semibold text-foreground truncate">
            Việc con
          </span>
          <span className="font-mono text-[11px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full tabular-nums shrink-0">
            {subTasks.length}
          </span>
          {completedCount > 0 && (
            <span className="text-[11px] text-muted-foreground font-mono tabular-nums shrink-0">
              ({completedCount} xong)
            </span>
          )}
        </div>
        {onAddSubtask && (
          <button
            type="button"
            onClick={onAddSubtask}
            className="inline-flex items-center gap-1 h-5 px-1.5 rounded text-[11px] font-medium text-muted-foreground/80 hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
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
      {alwaysVisible.length > 0 && (
        <m.div className="mt-1.5 space-y-0.5" variants={staggerContainerVariants} initial="initial" animate="animate">
          {alwaysVisible.map((st) => {
            const isActive = st.id === activeSubtaskId;
            const statusOpt = getStatusDisplay(st.status);
            const dotClass = statusOpt?.dotClass ?? "bg-muted-foreground/60";
            const isCompleted = st.status === "COMPLETED";
            const formattedDueDate = st.dueDate ? formatCompactDate(st.dueDate, "") : "";

            return (
              <m.div key={st.id} variants={listItemVariants}>
              <button
                type="button"
                onClick={() => onSelectSubtask(st)}
                className={cn(
                  "w-full flex items-start gap-2 px-1.5 py-1.5 rounded text-left text-[12px] leading-snug transition-colors cursor-pointer hover:bg-muted/60 active:scale-[0.98] transition-transform focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden",
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
                      ? "text-muted-foreground line-through decoration-muted-foreground/30"
                      : "text-foreground/90"
                  )}
                >
                  {st.title}
                </span>

                {/* 3. Hạn hoàn thành: DD/MM */}
                {formattedDueDate && (
                  <span
                    className="shrink-0 text-[11px] font-mono tabular-nums text-muted-foreground mt-0.5"
                    title={`Hạn hoàn thành: ${formatDisplayDate(st.dueDate)}`}
                  >
                    {formattedDueDate}
                  </span>
                )}

                {/* 4. Avatar người phụ trách */}
                <div className="shrink-0 mt-0.5">
                  <SubtaskAvatar
                    avatarUrl={st.assigneeAvatar}
                    name={st.assigneeName}
                  />
                </div>
              </button>
              </m.div>
            );
          })}

          {/* Collapsible remaining items */}
          {collapsibleItems.length > 0 && (
            <Collapsible.Root open={expanded} onOpenChange={setExpanded}>
              <Collapsible.Panel className="space-y-0.5">
                {collapsibleItems.map((st) => {
                  const isActive = st.id === activeSubtaskId;
                  const statusOpt = getStatusDisplay(st.status);
                  const dotClass = statusOpt?.dotClass ?? "bg-muted-foreground/60";
                  const isCompleted = st.status === "COMPLETED";
                  const formattedDueDate = st.dueDate ? formatCompactDate(st.dueDate, "") : "";

                  return (
                    <m.div key={st.id} variants={listItemVariants}>
                    <button
                      type="button"
                      onClick={() => onSelectSubtask(st)}
                      className={cn(
                        "w-full flex items-start gap-2 px-1.5 py-1.5 rounded text-left text-[12px] leading-snug transition-colors cursor-pointer hover:bg-muted/60 active:scale-[0.98] transition-transform focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden",
                        isActive ? "bg-muted/40" : ""
                      )}
                      title={st.title}
                    >
                      <span
                        className={cn("size-2 rounded-full shrink-0 mt-1.5", dotClass)}
                        role="status"
                        aria-label={`Trạng thái: ${statusOpt?.label ?? st.status}`}
                      />
                      <span
                        className={cn(
                          "flex-1 min-w-0 line-clamp-2 break-words",
                          isCompleted
                            ? "text-muted-foreground line-through decoration-muted-foreground/30"
                            : "text-foreground/90"
                        )}
                      >
                        {st.title}
                      </span>
                      {formattedDueDate && (
                        <span
                          className="shrink-0 text-[11px] font-mono tabular-nums text-muted-foreground mt-0.5"
                          title={`Hạn hoàn thành: ${formatDisplayDate(st.dueDate)}`}
                        >
                          {formattedDueDate}
                        </span>
                      )}
                      <div className="shrink-0 mt-0.5">
                        <SubtaskAvatar
                          avatarUrl={st.assigneeAvatar}
                          name={st.assigneeName}
                        />
                      </div>
                    </button>
                    </m.div>
                  );
                })}
              </Collapsible.Panel>
              <Collapsible.Trigger
                className="mt-1 text-[11px] text-primary hover:underline cursor-pointer pl-1.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden rounded"
              >
                {expanded ? "Thu gọn" : `Xem thêm ${remaining} việc con`}
              </Collapsible.Trigger>
            </Collapsible.Root>
          )}
        </m.div>
      )}
    </div>
  );
}
