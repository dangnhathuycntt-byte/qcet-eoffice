import * as React from "react";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { getLiveDashboardData } from "@/lib/server/dashboard-service";
import { UnifiedTaskHubClient } from "@/components/dashboard/unified-task-hub-client";
import type { DashboardPayload } from "@/types/dashboard";

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
    <div className="max-w-[1440px] w-full mx-auto space-y-6 pb-4 md:pb-8 animate-pulse">
      <div className="h-16 rounded-2xl bg-muted/40" />
      <div className="h-28 rounded-2xl bg-muted/40" />
      <div className="h-14 rounded-2xl bg-muted/40" />
      <div className="h-96 rounded-2xl bg-muted/40" />
    </div>
  );
}

interface UnifiedTaskHubPageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function UnifiedTaskHubPage({
  searchParams,
}: UnifiedTaskHubPageProps) {
  const resolvedParams = searchParams ? await searchParams : {};
  const zoneParam = resolvedParams?.zone;

  // Canonical redirect: If zone=tasks is detected, navigate to /tasks preserving remaining params
  if (zoneParam === "tasks") {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(resolvedParams)) {
      if (key !== "zone" && typeof value === "string") {
        params.set(key, value);
      }
    }
    const qs = params.toString();
    redirect(qs ? `/tasks?${qs}` : "/tasks");
  }

  // Direct server read avoiding client waterfall round-trips
  let initialData: DashboardPayload | undefined;
  try {
    initialData = await getLiveDashboardData();
  } catch (error) {
    console.error("Direct server read failed for dashboard page:", error);
  }

  return (
    <React.Suspense fallback={<DashboardLoadingFallback />}>
      <UnifiedTaskHubClient
        initialData={initialData}
        calendarZone={<CalendarZone />}
        orgZone={<OrgZone />}
        documentsZone={<DocumentsZone />}
      />
    </React.Suspense>
  );
}
