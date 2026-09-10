import * as React from "react";
import { getLiveDashboardData } from "@/lib/server/dashboard-service";
import { TasksPageClient } from "./tasks-page-client";
import { TaskManagementWorkspace, type ViewMode, type WorkspaceScope } from "@/components/tasks/task-management-workspace";
export type { ViewMode, WorkspaceScope };

export default async function TasksPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = props.searchParams ? await props.searchParams : {};
  const searchParams = new URLSearchParams(resolved as Record<string, string>);
  const raw = searchParams.get("scope");
  const scope: WorkspaceScope | undefined = raw === "school" || raw === "unit" || raw === "my" ? raw : undefined;
  const { tasks } = await getLiveDashboardData().catch(() => ({ tasks: [] }));
  return (
    <React.Suspense fallback={<TaskManagementWorkspace scope="school" />}>
      <TasksPageClient initialTasks={tasks} initialScope={scope} />
    </React.Suspense>
  );
}
