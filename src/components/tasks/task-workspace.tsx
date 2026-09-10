"use client";

import * as React from "react";
import {
  TaskManagementWorkspace,
  type TaskManagementWorkspaceProps,
  type WorkspaceScope,
  type ViewMode,
  type CreateTaskFormData,
  filterTasksByScope,
  applyOptimisticStatusChange,
  applyOptimisticCreateTask,
} from "./task-management-workspace";

export {
  filterTasksByScope,
  applyOptimisticStatusChange,
  applyOptimisticCreateTask,
  type WorkspaceScope,
  type ViewMode,
  type CreateTaskFormData,
  type TaskManagementWorkspaceProps as TaskWorkspaceProps,
};

/**
 * TaskWorkspace - Canonical Unified Task Workspace (Sprint 8)
 *
 * Single, adaptive task workspace replacing all role-specific workspaces.
 * Light-Only, responsive mobile layout, minimum 44px touch targets, zero emojis.
 */
export function TaskWorkspace(props: TaskManagementWorkspaceProps) {
  return (
    <div className="w-full bg-background text-foreground" data-slot="task-workspace">
      <TaskManagementWorkspace {...props} />
    </div>
  );
}

export default TaskWorkspace;
