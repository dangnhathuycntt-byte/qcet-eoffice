"use client";

import * as React from "react";
import type { SchoolTask, TaskStatus } from "@/types/dashboard";
import type { AuthUser } from "@/types/auth";
import {
  UnifiedAdaptiveWorkspace,
  UnifiedAdaptiveWorkspaceControlled,
  type ViewMode,
  type WorkspaceScope,
} from "@/components/workspace/unified-adaptive-workspace";
import type { UnifiedAdaptiveWorkspaceProps } from "@/components/workspace/types";
import type { UseWorkspaceQueryReturn } from "@/hooks/use-workspace-query";
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
  workspaceQuery?: UseWorkspaceQueryReturn;
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
    workspaceQuery,
    ...rest
  } = props;
  const { setIsProfileModalOpen } = useAuth();
  const effectiveScope = scope || forcedScope;
  const sharedProps = {
    initialScope: initialScope || effectiveScope || "school" as WorkspaceScope,
    scope,
    forcedScope,
    onScopeChange,
    className,
    initialViewMode: props.initialViewMode ?? "table" as ViewMode,
    initialTasks,
    ...rest,
  };

  // Dùng Controlled variant khi caller là canonical owner của workspaceQuery
  // → không tạo listener popstate thứ hai bên trong UAW.
  if (workspaceQuery) {
    return <UnifiedAdaptiveWorkspaceControlled {...sharedProps} workspaceQuery={workspaceQuery} />;
  }

  return <UnifiedAdaptiveWorkspace {...sharedProps} />;
}

export default TaskManagementWorkspace;

export { useTaskFilters } from "@/hooks/use-task-filters";
export { useTaskMutations } from "@/hooks/use-task-mutations";
