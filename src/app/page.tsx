import * as React from "react";
import dynamic from "next/dynamic";
import { permanentRedirect, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getLiveDashboardData, type LiveDashboardOptions } from "@/lib/server/dashboard-service";
import { UnifiedTaskHubClient } from "@/components/dashboard/unified-task-hub-client";
import type { DashboardPayload } from "@/types/dashboard";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/jwt-session";
import { isAdmin } from "@/server/policies/document-policy";

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

  // Direct server read avoiding client waterfall round-trips (authenticated & scoped).
  // The server-rendered payload below is serialized into the RSC stream, so it is bound by the exact
  // same Server-Truth-Wins confinement contract as the canonical API route
  // (`src/app/api/dashboard/overview/route.ts`): it may carry only data the caller may see. Both
  // surfaces share the statutory `isAdmin` gate (ADMIN / Ban Giám hiệu) so they cannot diverge.
  let initialData: DashboardPayload | undefined;
  const cookieStore = await cookies();
  const session = verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value || "");
  const userIsAdmin = session ? isAdmin(session) : false;

  if (session) {
    try {
      // Non-admins are strictly bound to their own unit; accounts with no unit (schema-legal
      // `departmentId: null`) fail closed to their own task participation rather than leaving the query
      // unscoped, which would surface the school-wide dataset and inflated aggregates.
      const options: LiveDashboardOptions = {};
      if (!userIsAdmin) {
        if (session.departmentId) {
          options.departmentId = session.departmentId;
        } else {
          options.userId = session.id;
        }
      }

      initialData = await getLiveDashboardData(options);

      if (!userIsAdmin && initialData) {
        const userDeptId = session.departmentId || undefined;

        // `departmentHealth` is an institution-wide per-department aggregate computed independently of
        // the caller. Confine unit leaders to their own unit; accounts with no unit receive none.
        initialData.departmentHealth = userDeptId
          ? (initialData.departmentHealth || []).filter(
              (dept: { departmentId?: string }) => dept.departmentId === userDeptId
            )
          : [];

        // `activities` derive from a recipient-agnostic, school-wide notification scan (other users'
        // actor names and notification titles). There is no per-activity attribution available at this
        // layer, so fail closed rather than leak into the RSC payload.
        initialData.activities = [];

        // The query-level `departmentId` guard confines parent tasks; this mirrors the API route's
        // in-memory filter so cross-department lead/subtask rows cannot slip through either surface.
        if (userDeptId) {
          initialData.tasks = initialData.tasks.filter(
            (task) =>
              task.departmentId === userDeptId ||
              task.leadDepartmentId === userDeptId ||
              task.subTasks?.some(
                (sub) =>
                  sub.assignedToDepartmentId === userDeptId ||
                  sub.assigneeId === session.id
              )
          );
        }
      }
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
