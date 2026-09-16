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
  const { queryState, setScope, setDept, setView } = useWorkspaceQuery({
    defaultView: initialView,
    defaultScope: initialScope,
  });

  const isExec = user ? isUserExecutive(user as any) : false;
  const isHead = user ? isUserUnitHead(user as any) : false;
  const isUnassigned = isUserUnassignedDepartment(user);

  const userId = user?.id || "guest";

  // Persistence: Read stored scope and department preference per user account
  const [storedScope, setStoredScope] = React.useState<WorkspaceScope | null>(null);
  const [storedDept, setStoredDept] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const userScopeKey = `qcet_preferred_task_scope_${userId}`;
      const savedScope = (localStorage.getItem(userScopeKey) || localStorage.getItem("qcet_preferred_task_scope")) as WorkspaceScope | null;
      if (savedScope === "school" || savedScope === "unit" || savedScope === "my") {
        setStoredScope(savedScope);
      }

      const userDeptKey = `qcet_preferred_task_department_${userId}`;
      const savedDept = localStorage.getItem(userDeptKey) || localStorage.getItem("qcet_preferred_task_department");
      if (savedDept) {
        setStoredDept(savedDept);
      }
    } catch {
      // Ignore localStorage read errors
    }
  }, [userId]);

  const defaultRoleScope: WorkspaceScope = isExec ? "school" : isHead ? "unit" : "my";
  const activeScope: WorkspaceScope =
    queryState.scope || initialScope || storedScope || defaultRoleScope;

  const currentDept =
    queryState.dept || queryState.unit || storedDept || user?.departmentCode || user?.department || "ALL";

  const onScopeChange = (s: WorkspaceScope) => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`qcet_preferred_task_scope_${userId}`, s);
        localStorage.setItem("qcet_preferred_task_scope", s);
      } catch {
        // Ignore localStorage write errors
      }
    }
    setScope(s, { shallow: true, replace: true });
  };

  const handleDepartmentChange = (dept?: string) => {
    const nextDept = dept || "ALL";
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`qcet_preferred_task_department_${userId}`, nextDept);
        localStorage.setItem("qcet_preferred_task_department", nextDept);
      } catch {
        // Ignore localStorage write errors
      }
    }
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
