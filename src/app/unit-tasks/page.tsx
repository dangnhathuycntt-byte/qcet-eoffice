"use client";

import * as React from "react";
import {
  TaskManagementWorkspace,
  type ViewMode,
  type WorkspaceScope,
} from "@/components/tasks/task-management-workspace";

export type { ViewMode, WorkspaceScope };

export default function UnitTasksPage() {
  return <TaskManagementWorkspace scope="unit" />;
}
