"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DashboardStateProvider,
  useDashboardNav,
} from "@/components/dashboard/dashboard-context";
import { useAuthRole } from "@/hooks/use-auth-role";
import { DashboardZone } from "@/components/dashboard/zones/dashboard-zone";
import { TasksZone } from "@/components/dashboard/zones/tasks-zone";
import { DashboardModalsHost } from "@/components/dashboard/dashboard-modals-host";

const CalendarZone = dynamic(
  () => import("@/components/dashboard/zones/calendar-zone").then((m) => m.CalendarZone)
);

const OrgZone = dynamic(
  () => import("@/components/dashboard/zones/org-zone").then((m) => m.OrgZone)
);

const DocumentsZone = dynamic(
  () => import("@/components/dashboard/zones/documents-zone").then((m) => m.DocumentsZone)
);

function DashboardLoadingFallback() {
  return (
    <div className="max-w-[1440px] w-full mx-auto space-y-6 pb-24 md:pb-10 animate-pulse">
      <div className="h-16 rounded-2xl bg-muted/40" />
      <div className="h-28 rounded-2xl bg-muted/40" />
      <div className="h-14 rounded-2xl bg-muted/40" />
      <div className="h-96 rounded-2xl bg-muted/40" />
    </div>
  );
}

function UnifiedTaskHubContent() {
  const { activeZone, scope, handleScopeChange } = useDashboardNav();
  const { isExecutive, isManager } = useAuthRole();
  const router = useRouter();
  const searchParams = useSearchParams();

  const zoneParam = searchParams.get("zone");

  // Canonical redirect: If zone=tasks is detected, navigate to /tasks preserving remaining params
  React.useEffect(() => {
    if (zoneParam === "tasks") {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("zone");
      const qs = params.toString();
      router.replace(qs ? `/tasks?${qs}` : "/tasks");
    }
  }, [zoneParam, searchParams, router]);

  // Security access control guard: double-check scope access
  React.useEffect(() => {
    if (scope === "SCHOOL_TASKS" && !isExecutive) {
      handleScopeChange(isManager ? "UNIT_TASKS" : "MY_TASKS");
    }
  }, [scope, isExecutive, isManager, handleScopeChange]);

  if (zoneParam === "tasks") {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-sm text-muted-foreground animate-pulse">
        Đang chuyển tiếp sang Không gian Nhiệm vụ...
      </div>
    );
  }

  return (
    <div
      className="max-w-[1440px] w-full mx-auto space-y-6 pb-24 md:pb-10"
      data-slot="twenty-dashboard"
      data-hub="unified-task-hub"
      data-active-zone={activeZone}
    >
      {activeZone === "dashboard" && <DashboardZone />}
      {activeZone === "tasks" && <TasksZone />}
      {activeZone === "calendar" && <CalendarZone />}
      {activeZone === "org" && <OrgZone />}
      {activeZone === "documents" && <DocumentsZone />}

      <DashboardModalsHost />
    </div>
  );
}

export default function UnifiedTaskHubPage() {
  return (
    <React.Suspense fallback={<DashboardLoadingFallback />}>
      <DashboardStateProvider>
        <UnifiedTaskHubContent />
      </DashboardStateProvider>
    </React.Suspense>
  );
}
