"use client";

import * as React from "react";
import type { SchoolTask } from "@qcet/contracts/types/dashboard";
import {
  UnifiedAdaptiveWorkspace,
  UnifiedAdaptiveWorkspaceControlled,
  type WorkspaceScope,
} from "@/components/workspace/unified-adaptive-workspace";
import type { UnifiedAdaptiveWorkspaceProps } from "@/components/workspace/types";
import type { UseWorkspaceQueryReturn } from "@/hooks/use-workspace-query";
import { preloadWhenIdle } from "@/lib/idle-preload";
import {
  filterTasksByScope,
  applyOptimisticStatusChange,
} from "@/components/workspace/utils/task-workspace-mutations";

export {
  filterTasksByScope,
  applyOptimisticStatusChange,
  type WorkspaceScope,
};

export interface TaskManagementWorkspaceProps extends Partial<UnifiedAdaptiveWorkspaceProps> {
  scope?: WorkspaceScope;
  onScopeChange?: (scope: WorkspaceScope) => void;
  className?: string;
  initialTasks?: SchoolTask[];
  workspaceQuery?: UseWorkspaceQueryReturn;
}

// Chi tiết nhiệm vụ là chunk dynamic() riêng (cùng specifier trong unified-adaptive-workspace);
// nạp sẵn lúc rảnh để lần mở nhiệm vụ đầu không chờ mạng
const TASK_DETAIL_PRELOAD = [
  { key: "task-detail-view", load: () => import("@/components/tasks/detail/task-detail-view") },
];

/**
 * TaskManagementWorkspace - Canonical Forwarding Facade.
 *
 * Consolidates into UnifiedAdaptiveWorkspace as the single task engine across QCET E-Office.
 * Forwards all props, state, and actions while preserving full backward compatibility.
 *
 * Integrated subsystems forwarded to unified engine:
 * - Table Engine: ModularCascadingTaskTable
 * - Detail Panel: TaskDetailSideSheet
 * - Creation Dialog: CreateTaskModal
 * - Unassigned Guard: UnassignedDepartmentState
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
  const effectiveScope = scope || forcedScope;
  const sharedProps = {
    initialScope: initialScope || effectiveScope || "school" as WorkspaceScope,
    scope,
    forcedScope,
    onScopeChange,
    className,
    initialTasks,
    ...rest,
  };

  const preloadDetail = !rest.disableInternalDetail;
  React.useEffect(() => {
    if (preloadDetail) preloadWhenIdle(TASK_DETAIL_PRELOAD);
  }, [preloadDetail]);

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
