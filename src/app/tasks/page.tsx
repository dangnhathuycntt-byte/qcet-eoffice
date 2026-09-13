import * as React from "react";
import { cookies } from "next/headers";
import { getLiveDashboardData } from "@/lib/server/dashboard-service";
import { TasksPageClient } from "./tasks-page-client";
import { TaskManagementWorkspace, type WorkspaceScope } from "@/components/tasks/task-management-workspace";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/jwt-session";
import { isUserExecutive } from "@/domain/tasks/attention-resolver";

export default async function TasksPage(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const resolved = props.searchParams ? await props.searchParams : {};
  const searchParams = new URLSearchParams(resolved as Record<string, string>);
  const raw = searchParams.get("scope");
  const scope: WorkspaceScope | undefined = raw === "school" || raw === "unit" || raw === "my" ? raw : undefined;
  const cookieStore = await cookies();
  const session = verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value || "");
  const isExec = session ? isUserExecutive(session as any) : false;
  // P0-05 / T01: a task load FAILURE must not degrade into empty task data —
  // "error is not empty". This call used to swallow its rejection and resolve to
  // an empty task list, rendering a fabricated empty workspace on any read
  // failure and hiding real outages. Letting the error propagate hands it to
  // src/app/tasks/error.tsx, which renders an explicit error state with retry.
  const { tasks } = session
    ? await getLiveDashboardData({ userId: session.id, departmentId: isExec ? undefined : session.departmentId || undefined })
    : { tasks: [] };
  return (
    <React.Suspense fallback={<TaskManagementWorkspace scope="school" />}>
      <TasksPageClient initialTasks={tasks} initialScope={scope} />
    </React.Suspense>
  );
}