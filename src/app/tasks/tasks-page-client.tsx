"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
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
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const raw = searchParams.get("scope");
  const fallback: WorkspaceScope =
    user?.role === "ADMIN" ? "school" : user?.role === "MANAGER" ? "unit" : "my";
  const scope: WorkspaceScope =
    raw === "school" || raw === "unit" || raw === "my"
      ? raw
      : initialScope || fallback;

  const onScopeChange = (s: WorkspaceScope) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("scope", s);
    router.replace(`/tasks?${p.toString()}`);
  };

  return (
    <TaskManagementWorkspace
      scope={scope}
      onScopeChange={onScopeChange}
      initialTasks={initialTasks}
    />
  );
}
