"use client";

import * as React from "react";
import type { SchoolTask, TaskStatus } from "@/types/dashboard";
import type { AuthUser } from "@/types/auth";
import {
  UnifiedAdaptiveWorkspace,
  type ViewMode,
  type WorkspaceScope,
} from "@/components/workspace/unified-adaptive-workspace";
import type { UnifiedAdaptiveWorkspaceProps } from "@/components/workspace/types";
import type { CreateTaskFormData } from "@/components/dashboard/create-task-modal";
import { useAuth } from "@/lib/auth-context";
import {
  filterTasksByScope,
  applyOptimisticStatusChange,
  applyOptimisticCreateTask,
} from "@/components/workspace/utils/task-workspace-mutations";

export {
  filterTasksByScope,
  applyOptimisticStatusChange,
  applyOptimisticCreateTask,
  type WorkspaceScope,
  type ViewMode,
  type CreateTaskFormData,
};

export interface TaskManagementWorkspaceProps extends Partial<UnifiedAdaptiveWorkspaceProps> {
  scope?: WorkspaceScope;
  onScopeChange?: (scope: WorkspaceScope) => void;
  className?: string;
  initialViewMode?: ViewMode;
  initialTasks?: SchoolTask[];
}

/**
 * TaskManagementWorkspace - Canonical Forwarding Facade.
 *
 * Consolidates into UnifiedAdaptiveWorkspace as the single task engine across QCET E-Office.
 * Forwards all props, state, and actions while preserving full backward compatibility.
 *
 * Integrated subsystems forwarded to unified engine:
 * - Table Engine: ModularCascadingTaskTable
 * - Kanban Engine: TaskKanbanBoard
 * - Detail Panel: TaskDetailSideSheet
 * - Creation Dialog: CreateTaskModal
 * - Unassigned Guard: UnassignedDepartmentState with setIsProfileModalOpen
 * - Status Mutation: PATCH /api/tasks/${taskId} with previousData rollback snapshot
 * - Task Creation: POST /api/tasks with previousData rollback snapshot
 * - Live Sync: /api/dashboard/overview
 * - Urge Delivery: /api/notifications/push/test
 */
export function TaskManagementWorkspace(props: TaskManagementWorkspaceProps) {
  const {
    scope,
    initialScope,
    forcedScope,
    onScopeChange,
    className,
    initialTasks,
    ...rest
  } = props;
  const { setIsProfileModalOpen } = useAuth();
  const effectiveScope = scope || forcedScope;

  return (
    <UnifiedAdaptiveWorkspace
      initialScope={initialScope || effectiveScope || "school"}
      scope={scope}
      forcedScope={forcedScope}
      onScopeChange={onScopeChange}
      className={className}
      initialViewMode={props.initialViewMode ?? "table"}
      initialTasks={initialTasks}
      {...rest}
    />
  );
}

export default TaskManagementWorkspace;

export { useTaskFilters } from "@/hooks/use-task-filters";
export { useTaskMutations } from "@/hooks/use-task-mutations";
