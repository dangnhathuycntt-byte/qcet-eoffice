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

  const isExec = user ? isUserExecutive(user as any) : false;
  const isHead = user ? isUserUnitHead(user as any) : false;
  const isUnassigned = isUserUnassignedDepartment(user);

  const defaultRoleScope: WorkspaceScope = isExec ? "school" : isHead ? "unit" : "my";
  const { queryState, setScope, setDept, setView } = useWorkspaceQuery({
    defaultView: initialView,
    defaultScope: initialScope || defaultRoleScope,
  });

  const activeScope: WorkspaceScope =
    queryState.scope || initialScope || defaultRoleScope;

  const currentDept =
    queryState.dept || queryState.unit || "ALL";

  const onScopeChange = (s: WorkspaceScope) => {
    setScope(s, { shallow: true, replace: true });
  };

  const handleDepartmentChange = (dept?: string) => {
    const nextDept = dept || "ALL";
    setDept(nextDept !== "ALL" ? nextDept : null, { shallow: true, replace: true });
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
      scope={activeScope}
      onScopeChange={onScopeChange}
      selectedDepartment={currentDept}
      onDepartmentChange={handleDepartmentChange}
      viewMode={activeView}
      initialViewMode={initialView ?? "table"}
      onViewModeChange={handleViewChange}
      onSelectTask={handleSelectTask}
      initialTasks={initialTasks}
    />
  );
}
