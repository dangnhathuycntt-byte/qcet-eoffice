import * as React from "react";
import { cookies } from "next/headers";
import { getLiveDashboardData } from "@/lib/server/dashboard-service";
import { TasksPageClient } from "./tasks-page-client";
import { TaskManagementWorkspace, type WorkspaceScope, type ViewMode } from "@/components/tasks/task-management-workspace";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/jwt-session";
import { isUserExecutive } from "@/domain/tasks/attention-resolver";

export default async function TasksPage(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const resolved = props.searchParams ? await props.searchParams : {};
  const searchParams = new URLSearchParams(resolved as Record<string, string>);
  const rawScope = searchParams.get("scope");
  const scope: WorkspaceScope | undefined = rawScope === "school" || rawScope === "unit" || rawScope === "my" ? rawScope : undefined;
  const rawView = searchParams.get("view");
  const initialView: ViewMode | undefined = rawView === "kanban" || rawView === "table" ? rawView : undefined;
  const cookieStore = await cookies();
  const session = verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value || "");
  const isExec = session ? isUserExecutive(session as any) : false;
  // P0-05 / T01: never swallow a read failure into empty task data. The rejection
  // propagates to src/app/tasks/error.tsx, which renders an explicit error + retry.
  const { tasks } = session
    ? await getLiveDashboardData({ userId: session.id, departmentId: isExec ? undefined : session.departmentId || undefined })
    : { tasks: [] };
  return (
    <React.Suspense fallback={<TaskManagementWorkspace scope="school" initialViewMode={initialView ?? "table"} />}>
      <TasksPageClient initialTasks={tasks} initialScope={scope} initialView={initialView} />
    </React.Suspense>
  );
}