import * as React from "react";
import dynamic from "next/dynamic";
import { permanentRedirect, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getLiveDashboardData } from "@/lib/server/dashboard-service";
import { UnifiedTaskHubClient } from "@/components/dashboard/unified-task-hub-client";
import type { DashboardPayload } from "@/types/dashboard";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/jwt-session";
import { isUserExecutive } from "@/domain/tasks/attention-resolver";

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

  // Canonical redirect: If ?zone=* is detected, redirect permanently (308) to canonical paths
  if (typeof zoneParam === "string" && zoneParam.length > 0) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(resolvedParams)) {
      if (key !== "zone" && typeof value === "string") {
        params.set(key, value);
      }
    }
    const qs = params.toString();
    const query = qs ? `?${qs}` : "";

    if (zoneParam === "tasks") {
      permanentRedirect("/tasks" + query);
    } else if (zoneParam === "calendar") {
      permanentRedirect(`/calendar${query}`);
    } else if (zoneParam === "org") {
      permanentRedirect(`/org${query}`);
    } else if (zoneParam === "documents") {
      permanentRedirect(`/documents${query}`);
    } else {
      permanentRedirect(`/${query}`);
    }
  }

  // Direct server read avoiding client waterfall round-trips (authenticated & scoped)
  let initialData: DashboardPayload | undefined;
  const cookieStore = await cookies();
  const session = verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value || "");
  const isExec = session ? isUserExecutive(session as any) : false;

  if (session) {
    try {
      initialData = await getLiveDashboardData({
        userId: session.id,
        departmentId: isExec ? undefined : session.departmentId || undefined,
      });
    } catch (error) {
      console.error("Direct server read failed for dashboard page:", error);
    }
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
