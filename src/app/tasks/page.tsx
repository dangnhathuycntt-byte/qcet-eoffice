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

export default async function TasksPage(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const resolved = props.searchParams ? await props.searchParams : {};
  const searchParams = new URLSearchParams(resolved as Record<string, string>);
  const rawScope = searchParams.get("scope");
  const scope: WorkspaceScope | undefined = rawScope === "school" || rawScope === "unit" || rawScope === "my" ? rawScope : undefined;
  const rawView = searchParams.get("view");
  const initialView: ViewMode | undefined = rawView === "kanban" || rawView === "table" ? rawView : undefined;
  const cookieStore = await cookies();
  const session = await getSessionFromRequest({ cookies: cookieStore });
  if (!session) {
    const qs = searchParams.toString();
    const returnUrl = `/tasks${qs ? `?${qs}` : ""}`;
    redirect(`/login?returnTo=${encodeURIComponent(returnUrl)}`);
  }
  const authorizationContext = await loadAuthorizationContext(session.id);
  const { tasks } = await taskQueryService.queryTasksForList(authorizationContext, { all: true, parentTaskId: 'root' });
  const authorizedTasks = tasks.map((task) => ({
    ...task,
    availableActions: computeAvailableActions(authorizationContext, buildTaskResource(task)),
  }));
  return (
    <TasksPageClient initialTasks={authorizedTasks as unknown as SchoolTask[]} initialScope={scope} initialView={initialView} />
  );
}
