"use client";

import * as React from "react";
import { Plus, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SchoolTask, StaffTask, TaskStatus } from "@/types/dashboard";
import type { TableDensity } from "../types";
import { SubtaskInlineRow } from "./subtask-inline-row";

export interface SubtaskRowGroupProps {
  parentTask: SchoolTask;
  subTasks?: StaffTask[];
  isExpanded: boolean;
  colSpan?: number;
  density?: TableDensity;
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
  canAssign?: boolean;
  onAddSubTask?: (parentTask: SchoolTask) => void;
  className?: string;
}

export const SubtaskRowGroup = React.memo(function SubtaskRowGroup({
  parentTask,
  subTasks = parentTask.subTasks || [],
  isExpanded,
  colSpan = 9,
  density = "comfortable",
  selectedAcademicMonth,
  referenceDate,
  onSelectSubTask,
  onStatusChange,
  onOpenSubmitModal,
  canAssign = false,
  onAddSubTask,
  className,
}: SubtaskRowGroupProps) {
  if (!isExpanded) {
    return null;
  }

  const hasSubtasks = subTasks && subTasks.length > 0;

  return (
    <tr
      data-parent-id={parentTask.id}
      data-task-tier="2"
      className={cn("bg-slate-50/60 transition-colors", className)}
    >
      <td colSpan={colSpan} className="p-0 border-b border-slate-200/70">
        <div className="py-2.5 pr-4 pl-8 sm:pl-10">
          {/* Tree indentation vertical connector line */}
          <div className="border-l-2 border-slate-200 ml-6 pl-3 space-y-2">
            {!hasSubtasks ? (
              <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/80 border border-dashed border-slate-200 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <ListTodo className="size-4 text-muted-foreground/60" strokeWidth={1.5} />
                  <span>Nhiệm vụ này chưa có việc thành phần nào.</span>
                </div>
                {canAssign && onAddSubTask && (
                  <button
                    type="button"
                    onClick={() => onAddSubTask(parentTask)}
                    className="inline-flex items-center gap-1 h-6 px-2.5 rounded-lg border border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold cursor-pointer active:scale-95 transition-colors"
                  >
                    <Plus className="size-3" strokeWidth={2} />
                    <span>Thêm việc con</span>
                  </button>
                )}
              </div>
            ) : (
              <>
                {subTasks.map((subTask) => (
                  <SubtaskInlineRow
                    key={subTask.id}
                    subTask={subTask}
                    parentTask={parentTask}
                    density={density}
                    selectedAcademicMonth={selectedAcademicMonth}
                    referenceDate={referenceDate}
                    onSelectSubTask={onSelectSubTask}
                    onStatusChange={onStatusChange}
                    onOpenSubmitModal={onOpenSubmitModal}
                  />
                ))}

                {/* Optional "Add subtask" bottom line if permitted */}
                {canAssign && onAddSubTask && (
                  <div className="pt-1 flex items-center">
                    <button
                      type="button"
                      onClick={() => onAddSubTask(parentTask)}
                      className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-lg border border-dashed border-slate-300 bg-white/60 text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 text-xs font-medium cursor-pointer transition-colors"
                    >
                      <Plus className="size-3 text-primary" strokeWidth={2} />
                      <span>Thêm việc con cho [{parentTask.taskCode || parentTask.id}]</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
});
