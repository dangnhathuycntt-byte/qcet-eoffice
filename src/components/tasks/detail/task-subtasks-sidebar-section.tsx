"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import type { StaffTask } from "@/types/dashboard";
import { STATUS_OPTIONS } from "./task-identity-block";

export interface TaskSubtasksSidebarSectionProps {
  subTasks: StaffTask[];
  activeSubtaskId?: string | null;
  onSelectSubtask: (subtask: StaffTask) => void;
  onAddSubtask?: () => void;
}

const MAX_COLLAPSED = 5;

export function TaskSubtasksSidebarSection({
  subTasks,
  activeSubtaskId,
  onSelectSubtask,
  onAddSubtask,
}: TaskSubtasksSidebarSectionProps) {
  const [expanded, setExpanded] = React.useState(false);
  const visible = expanded ? subTasks : subTasks.slice(0, MAX_COLLAPSED);
  const remaining = Math.max(0, subTasks.length - MAX_COLLAPSED);

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
        </div>
        {onAddSubtask && (
          <button
            type="button"
            onClick={onAddSubtask}
            className={`size-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer ${
              subTasks.length === 0
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100 focus:opacity-100"
            }`}
            title="Tạo việc con"
          >
            <Plus className="size-3.5" strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Rows */}
      {visible.length > 0 && (
        <div className="mt-1.5 space-y-0.5">
          {visible.map((st) => {
            const isActive = st.id === activeSubtaskId;
            const statusOpt = STATUS_OPTIONS.find((o) => o.value === st.status);
            const dotClass = statusOpt?.dotClass ?? "bg-muted-foreground/60";

            return (
              <button
                key={st.id}
                type="button"
                onClick={() => onSelectSubtask(st)}
                className={`w-full flex items-center gap-2 px-1.5 py-1 rounded text-left text-[12px] leading-snug transition-colors cursor-pointer hover:bg-muted/60 ${
                  isActive ? "bg-muted/40" : ""
                }`}
                title={st.title}
              >
                <span
                  className={`size-2 rounded-full shrink-0 ${dotClass}`}
                  aria-label={statusOpt?.label ?? st.status}
                />
                <span className="min-w-0 truncate text-foreground/90">
                  {st.title}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Expand */}
      {!expanded && remaining > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-1 text-[11px] text-primary hover:underline cursor-pointer pl-1.5"
        >
          Xem thêm {remaining} việc con
        </button>
      )}
    </div>
  );
}
