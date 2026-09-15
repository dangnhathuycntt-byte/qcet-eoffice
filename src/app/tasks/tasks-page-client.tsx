"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth-context";
import { isUserExecutive, isUserUnitHead } from "@/domain/tasks/attention-resolver";
import { useWorkspaceQuery } from "@/hooks/use-workspace-query";
import {
  TaskManagementWorkspace,
  type ViewMode,
  type WorkspaceScope,
} from "@/components/tasks/task-management-workspace";
import type { SchoolTask } from "@/types/dashboard";

export type { ViewMode, WorkspaceScope };

export interface TasksPageClientProps {
  initialTasks?: SchoolTask[];
  initialScope?: WorkspaceScope;
}

export function TasksPageClient({ initialTasks, initialScope }: TasksPageClientProps) {
  const { user } = useAuth();
  const { queryState, setScope, setView } = useWorkspaceQuery();

  const isExec = user ? isUserExecutive(user as any) : false;
  const isHead = user ? isUserUnitHead(user as any) : false;

  const fallback: WorkspaceScope = isExec ? "school" : isHead ? "unit" : "my";
  const rawScope = queryState.scope || initialScope || fallback;

  // AUTH-03: Enforce scope authorization
  let authorizedScope: WorkspaceScope = rawScope;
  if (authorizedScope === "school" && !isExec) {
    authorizedScope = isHead ? "unit" : "my";
  }

  const onScopeChange = (s: WorkspaceScope) => {
    let target = s;
    if (target === "school" && !isExec) {
      target = isHead ? "unit" : "my";
    }
    setScope(target);
  };

  const handleViewChange = (v: ViewMode) => {
    setView(v, { shallow: true, replace: true });
  };

  return (
    <TaskManagementWorkspace
      scope={authorizedScope}
      onScopeChange={onScopeChange}
      viewMode={queryState.view === "kanban" ? "kanban" : "table"}
      onViewModeChange={handleViewChange}
      initialTasks={initialTasks}
    />
  );
}
