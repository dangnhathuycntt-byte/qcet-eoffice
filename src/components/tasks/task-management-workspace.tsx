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
import { ModularCascadingTaskTable } from "@/components/tasks/table/modular-cascading-task-table";
import { TaskKanbanBoard } from "@/components/tasks/task-kanban-board";
import { CreateTaskModal, type CreateTaskFormData } from "@/components/dashboard/create-task-modal";
import { TaskDetailSideSheet } from "@/components/dashboard/task-detail-side-sheet";
import { UnassignedDepartmentState } from "@/components/workspace/components/unassigned-department-state";
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
export function TaskManagementWorkspace({
  scope,
  initialScope,
  forcedScope,
  onScopeChange,
  className,
  initialViewMode = "kanban",
  initialTasks,
  ...rest
}: TaskManagementWorkspaceProps) {
  const { setIsProfileModalOpen } = useAuth();
  const effectiveScope = scope || forcedScope;

  return (
    <UnifiedAdaptiveWorkspace
      initialScope={initialScope || effectiveScope || "school"}
      forcedScope={effectiveScope}
      onScopeChange={onScopeChange}
      className={className}
      initialViewMode={initialViewMode}
      initialTasks={initialTasks}
      {...rest}
    />
  );
}

export default TaskManagementWorkspace;
