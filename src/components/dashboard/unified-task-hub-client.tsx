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
import type { DashboardPayload } from "@/types/dashboard";

const FallbackCalendarZone = dynamic(
  () => import("@/components/dashboard/zones/calendar-zone").then((m) => m.CalendarZone)
);

const FallbackOrgZone = dynamic(
  () => import("@/components/dashboard/zones/org-zone").then((m) => m.OrgZone)
);

const FallbackDocumentsZone = dynamic(
  () => import("@/components/dashboard/zones/documents-zone").then((m) => m.DocumentsZone)
);

export interface UnifiedTaskHubClientProps {
  initialData?: DashboardPayload;
  calendarZone?: React.ReactNode;
  orgZone?: React.ReactNode;
  documentsZone?: React.ReactNode;
}

function UnifiedTaskHubContent({
  calendarZone,
  orgZone,
  documentsZone,
}: {
  calendarZone?: React.ReactNode;
  orgZone?: React.ReactNode;
  documentsZone?: React.ReactNode;
}) {
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
      className="max-w-[1440px] w-full mx-auto space-y-6 pb-4 md:pb-8"
      data-slot="twenty-dashboard"
      data-hub="unified-task-hub"
      data-active-zone={activeZone}
    >
      {activeZone === "dashboard" && <DashboardZone />}
      {activeZone === "tasks" && <TasksZone />}
      {activeZone === "calendar" && (calendarZone || <FallbackCalendarZone />)}
      {activeZone === "org" && (orgZone || <FallbackOrgZone />)}
      {activeZone === "documents" && (documentsZone || <FallbackDocumentsZone />)}

      <DashboardModalsHost />
    </div>
  );
}

export function UnifiedTaskHubClient({
  initialData,
  calendarZone,
  orgZone,
  documentsZone,
}: UnifiedTaskHubClientProps) {
  return (
    <DashboardStateProvider initialData={initialData}>
      <UnifiedTaskHubContent
        calendarZone={calendarZone}
        orgZone={orgZone}
        documentsZone={documentsZone}
      />
    </DashboardStateProvider>
  );
}
