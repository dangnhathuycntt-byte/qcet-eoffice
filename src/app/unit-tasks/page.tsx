"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TaskManagementWorkspace, type ViewMode, type WorkspaceScope } from "@/components/tasks/task-management-workspace";
export type { ViewMode, WorkspaceScope };

function UnitTasksRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  React.useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("scope", "unit");
    router.replace(`/tasks?${params.toString()}`);
  }, [router, searchParams]);
  return <TaskManagementWorkspace scope="unit" />;
}

export default function UnitTasksPage() {
  return (
    <React.Suspense fallback={<TaskManagementWorkspace scope="unit" />}>
      <UnitTasksRedirect />
    </React.Suspense>
  );
}
