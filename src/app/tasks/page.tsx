import * as React from "react";
import { redirect } from "next/navigation";
import { TasksPageClient } from "./tasks-page-client";
import { type WorkspaceScope } from "@/components/tasks/task-management-workspace";
import { fetchPageData } from "@/lib/server-api";
import { TasksPageDataSchema } from "@qcet/contracts/page-data";
import type { TaskView } from "@qcet/shared/domain/tasks";

export default async function TasksPage(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const resolved = props.searchParams ? await props.searchParams : {};
  const searchParams = new URLSearchParams(resolved as Record<string, string>);

  // 1. Canonical view resolution with legacy scope backward-compat mapping (Issue #26)
  const rawView = searchParams.get("view");
  const rawScope = searchParams.get("scope");

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

  // Nhiệm vụ gốc theo góc nhìn, kèm thao tác được phép (GET /api/page-data/tasks)
  const result = await fetchPageData(
    `/api/page-data/tasks${canonicalView ? `?view=${canonicalView}` : ""}`,
    TasksPageDataSchema,
  );
  if (!result.ok) {
    if (result.status === 401) {
      const qs = searchParams.toString();
      const returnUrl = `/tasks${qs ? `?${qs}` : ""}`;
      redirect(`/login?returnTo=${encodeURIComponent(returnUrl)}`);
    }
    throw new Error(`GET /api/page-data/tasks trả ${result.status}`);
  }

  const scope: WorkspaceScope | undefined =
    canonicalView === "related" ? "my" : canonicalView === "unit" ? "unit" : canonicalView === "all" ? "school" : undefined;

  return (
    <TasksPageClient
      initialTasks={result.data.tasks}
      initialScope={scope}
      initialTaskView={canonicalView}
    />
  );
}
