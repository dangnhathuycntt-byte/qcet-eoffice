"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth, isUserUnassignedDepartment } from "@/lib/auth-context";
import { isUserExecutive, isUserUnitHead } from "@/domain/tasks/attention-resolver";
import { useWorkspaceQuery } from "@/hooks/use-workspace-query";
import { getCurrentAcademicPeriod } from "@/lib/academic-calendar";
import {
  TaskManagementWorkspace,
  type ViewMode,
  type WorkspaceScope,
} from "@/components/tasks/task-management-workspace";
import type { SchoolTask, StaffTask } from "@/types/dashboard";
import type { TaskView } from "@/domain/tasks";

export type { ViewMode, WorkspaceScope, TaskView };

export interface TasksPageClientProps {
  initialTasks?: SchoolTask[];
  initialScope?: WorkspaceScope;
  initialView?: ViewMode;
  initialTaskView?: TaskView;
}

export function TasksPageClient({ initialTasks, initialScope, initialView }: TasksPageClientProps) {
  const router = useRouter();
  const { user } = useAuth();

  const isExec = user ? isUserExecutive(user as any) : false;
  const isHead = user ? isUserUnitHead(user as any) : false;
  const isUnassigned = isUserUnassignedDepartment(user);

  const currentAcademicMonth = React.useMemo(() => getCurrentAcademicPeriod().month, []);

  const defaultRoleScope: WorkspaceScope = isExec ? "school" : isHead ? "unit" : "my";
  const workspaceQuery = useWorkspaceQuery({
    defaultView: initialView,
    defaultScope: initialScope || defaultRoleScope,
    defaultMonth: currentAcademicMonth,
    canonicalTaskView: true,
  });
  const { queryState, setScope, setTaskView, setDept, setView } = workspaceQuery;

  const activeScope: WorkspaceScope =
    queryState.scope || initialScope || defaultRoleScope;

  const currentDept =
    queryState.dept || queryState.unit || "ALL";

  const onScopeChange = (s: WorkspaceScope | TaskView) => {
    if (s === "related" || s === "unit" || s === "all" || s === "approval") {
      setTaskView(s as TaskView, { shallow: true, replace: true });
    } else {
      setScope(s as WorkspaceScope, { shallow: true, replace: true });
    }
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
      workspaceQuery={workspaceQuery}
    />
  );
}
