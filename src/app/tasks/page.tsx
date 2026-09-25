import * as React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TasksPageClient } from "./tasks-page-client";
import { TaskManagementWorkspace, type WorkspaceScope, type ViewMode } from "@/components/tasks/task-management-workspace";
import { getSessionFromRequest } from "@/lib/jwt-session";
import { taskQueryService } from "@/server/tasks";
import { loadAuthorizationContext } from "@/server/authorization/authorization-context-service";
import { buildTaskResource, computeAvailableActions } from "@/server/authorization/available-actions";
import type { SchoolTask } from "@/types/dashboard";
import type { TaskView } from "@/domain/tasks";

export default async function TasksPage(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const resolved = props.searchParams ? await props.searchParams : {};
  const searchParams = new URLSearchParams(resolved as Record<string, string>);

  // 1. Canonical view resolution with legacy scope backward-compat mapping (Issue #26)
  const rawView = searchParams.get("view");
  const rawScope = searchParams.get("scope");
  const rawViewMode = searchParams.get("viewMode");

  let canonicalView: TaskView | undefined;
  if (rawView === "related" || rawView === "unit" || rawView === "all" || rawView === "approval") {
    canonicalView = rawView as TaskView;
  } else if (rawScope) {
    const s = rawScope.toLowerCase();
    if (s === "my" || s === "personal" || s === "individual") {
      canonicalView = "related";
    } else if (s === "unit" || s === "department") {
      canonicalView = "unit";
    } else if (s === "school" || s === "all") {
      canonicalView = "all";
    } else if (s === "approval") {
      canonicalView = "approval";
    }
  }

  // 2. Backward-compat redirect: if legacy ?scope= parameter is in URL, redirect to canonical ?view=
  if (rawScope && canonicalView) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("scope");
    nextParams.set("view", canonicalView);
    redirect(`/tasks?${nextParams.toString()}`);
  }

  const initialViewMode: ViewMode | undefined =
    rawViewMode === "kanban" || rawViewMode === "table"
      ? rawViewMode
      : rawView === "kanban" || rawView === "table"
      ? rawView
      : undefined;

  const cookieStore = await cookies();
  const session = await getSessionFromRequest({ cookies: cookieStore });
  if (!session) {
    const qs = searchParams.toString();
    const returnUrl = `/tasks${qs ? `?${qs}` : ""}`;
    redirect(`/login?returnTo=${encodeURIComponent(returnUrl)}`);
  }

  const scope: WorkspaceScope | undefined =
    canonicalView === "related" ? "my" : canonicalView === "unit" ? "unit" : canonicalView === "all" ? "school" : undefined;

  const authorizationContext = await loadAuthorizationContext(session.id);
  const { tasks } = await taskQueryService.queryTasksForList(authorizationContext, {
    all: true,
    parentTaskId: 'root',
    view: canonicalView,
  });
  const authorizedTasks = tasks.map((task) => ({
    ...task,
    availableActions: computeAvailableActions(authorizationContext, buildTaskResource(task)),
  }));

  return (
    <TasksPageClient
      initialTasks={authorizedTasks as unknown as SchoolTask[]}
      initialScope={scope}
      initialView={initialViewMode}
      initialTaskView={canonicalView}
    />
  );
}
