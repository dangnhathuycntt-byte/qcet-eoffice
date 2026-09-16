"use client";

import * as React from "react";
import { Plus, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SchoolTask, StaffTask, TaskStatus } from "@/types/dashboard";
import type { TableDensity } from "../types";
import { SubtaskInlineRow } from "./subtask-inline-row";
import { useAuth } from "@/lib/auth-context";
import { matchesUser } from "@/lib/role-task-filter";

export interface SubtaskRowGroupProps {
  parentTask: SchoolTask;
  subTasks?: StaffTask[];
  isExpanded: boolean;
  colSpan?: number;
  density?: TableDensity;
  scope?: string;
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
  onAddSubTask?: (parentTaskOrId: SchoolTask | string) => void;
  className?: string;
  selectedTaskId?: string;
}

export const SubtaskRowGroup = React.memo(function SubtaskRowGroup({
  parentTask,
  subTasks = parentTask.subTasks || [],
  isExpanded,
  colSpan = 8,
  density = "comfortable",
  scope,
  selectedAcademicMonth,
  referenceDate,
  onSelectSubTask,
  onStatusChange,
  onOpenSubmitModal,
  canAssign = false,
  onAddSubTask,
  className,
  selectedTaskId,
}: SubtaskRowGroupProps) {
  let user: ReturnType<typeof useAuth>["user"] = null;
  try {
    const auth = useAuth();
    user = auth?.user ?? null;
  } catch {
    user = null;
  }

  if (!isExpanded) {
    return null;
  }

  const hasSubtasks = subTasks && subTasks.length > 0;

  return (
    <tr
      data-parent-id={parentTask.id}
      data-task-tier="2"
      className={cn("bg-muted/10 dark:bg-zinc-800/10 transition-colors rounded-lg", className)}
    >
      <td colSpan={colSpan} className="p-0 rounded-lg">
        <div className="py-2 pr-3.5 pl-3.5 sm:pl-4">
          {/* Tree indentation vertical connector line (Carbon Hierarchy) */}
          <div className="border-l border-border/70 ml-2 pl-3 sm:pl-4 space-y-1.5">
            {!hasSubtasks ? (
              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-card/60 border border-dashed border-border/80 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <ListTodo className="size-4 text-muted-foreground/60" strokeWidth={1.5} />
                  <span>Nhiệm vụ này chưa có việc thành phần nào.</span>
                </div>
                {canAssign && onAddSubTask && (
                  <button
                    type="button"
                    onClick={() => onAddSubTask(parentTask.id)}
                    className="inline-flex items-center gap-1 h-6 px-2.5 rounded-md border border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold cursor-pointer active:scale-95 transition-colors"
                  >
                    <Plus className="size-3" strokeWidth={1.5} />
                    <span>Thêm việc con</span>
                  </button>
                )}
              </div>
            ) : (
              <>
                {subTasks.map((subTask) => {
                  const subAny = subTask as any;
                  const isUserSubtask = Boolean(
                    user &&
                      ((user.id && (subTask.assigneeId === user.id || subAny.assignedTo === user.id)) ||
                        matchesUser(subTask.assigneeName, user) ||
                        matchesUser(subAny.assignedTo, user) ||
                        subAny.collaborators?.some(
                          (c: any) => matchesUser(c.name, user) || (user.id && c.id === user.id)
                        ))
                  );

                  return (
                    <SubtaskInlineRow
                      key={subTask.id}
                      subTask={subTask}
                      parentTask={parentTask}
                      density={density}
                      scope={scope}
                      isHighlighted={
                        isUserSubtask ||
                        subTask.id === selectedTaskId ||
                        Boolean((subTask as any).code && (subTask as any).code === selectedTaskId)
                      }
                      selectedAcademicMonth={selectedAcademicMonth}
                      referenceDate={referenceDate}
                      onSelectSubTask={onSelectSubTask}
                      onStatusChange={onStatusChange}
                      onOpenSubmitModal={onOpenSubmitModal}
                    />
                  );
                })}

                {/* Optional "Add subtask" bottom line if permitted */}
                {canAssign && onAddSubTask && (
                  <div className="pt-1 flex items-center">
                    <button
                      type="button"
                      onClick={() => onAddSubTask(parentTask.id)}
                      className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-lg border border-dashed border-border bg-card/60 text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 text-xs font-medium cursor-pointer transition-colors"
                    >
                      <Plus className="size-3 text-primary" strokeWidth={1.5} />
                      <span>Thêm việc con cho nhiệm vụ này</span>
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
