"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth, isUserUnassignedDepartment } from "@/lib/auth-context";
import { isUserExecutive, isUserUnitHead } from "@/domain/tasks/attention-resolver";
import { useWorkspaceQuery } from "@/hooks/use-workspace-query";
import {
  TaskManagementWorkspace,
  type ViewMode,
  type WorkspaceScope,
} from "@/components/tasks/task-management-workspace";
import type { SchoolTask, StaffTask } from "@/types/dashboard";

export type { ViewMode, WorkspaceScope };

export interface TasksPageClientProps {
  initialTasks?: SchoolTask[];
  initialScope?: WorkspaceScope;
  initialView?: ViewMode;
}

export function TasksPageClient({ initialTasks, initialScope, initialView }: TasksPageClientProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { queryState, setScope, setView } = useWorkspaceQuery({
    defaultView: initialView,
    defaultScope: initialScope,
  });

  const isExec = user ? isUserExecutive(user as any) : false;
  const isHead = user ? isUserUnitHead(user as any) : false;
  const isUnassigned = isUserUnassignedDepartment(user);

  const fallback: WorkspaceScope = isExec ? "school" : isUnassigned ? "my" : "unit";
  const rawScope = queryState.scope || initialScope || fallback;

  let authorizedScope: WorkspaceScope = rawScope;
  if (authorizedScope === "school" && !isExec) {
    authorizedScope = isUnassigned ? "my" : "unit";
  }
  if (authorizedScope === "unit" && isUnassigned) {
    authorizedScope = "my";
  }

  const onScopeChange = (s: WorkspaceScope) => {
    let target = s;
    if (target === "school" && !isExec) {
      target = isUnassigned ? "my" : "unit";
    }
    if (target === "unit" && isUnassigned) {
      target = "my";
    }
    setScope(target, { shallow: true, replace: true });
  };

  const handleViewChange = (v: ViewMode) => {
    setView(v, { shallow: true, replace: true });
  };

  const handleSelectTask = React.useCallback(
    (task: SchoolTask | StaffTask) => {
      router.push(`/tasks/${task.id}`);
    },
    [router]
  );

  const activeView: ViewMode =
    queryState.view === "kanban" || queryState.view === "table"
      ? queryState.view
      : (initialView ?? "table");

  return (
    <TaskManagementWorkspace
      scope={authorizedScope}
      onScopeChange={onScopeChange}
      viewMode={activeView}
      initialViewMode={initialView ?? "table"}
      onViewModeChange={handleViewChange}
      onSelectTask={handleSelectTask}
      initialTasks={initialTasks}
    />
  );
}
