import * as React from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSessionFromRequest } from "@/lib/jwt-session";
import { mapPrismaTaskToSchoolTask, mapPrismaTaskToStaffTask } from "@/lib/adapters/task-db-adapter";
import { TaskDetailPage } from "@/components/tasks/task-detail-page";
import type { SchoolTask, StaffTask } from "@/types/dashboard";
import { taskQueryService } from "@/server/tasks";
import { loadAuthorizationContext } from "@/server/authorization/authorization-context-service";
import { dbReadScope } from "@/server/tasks/staff-read-scope";
import { resolveTaskDetailContext } from "@/server/tasks/task-detail-context";
import { loadTaskDetailAuditEvents } from "@/server/tasks/task-page-data";

// Always fetch fresh from DB — task detail contains user-edited content
export const dynamic = "force-dynamic";

interface TaskDetailPageParams {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: TaskDetailPageParams): Promise<Metadata> {
  await params;
  // Do not query protected task data from metadata before authentication and
  // object-level authorization have run in the page request.
  return { title: "Chi tiết nhiệm vụ" };
}

export default async function Page({ params, searchParams }: TaskDetailPageParams) {
  const { id } = await params;
  if (!id) {
    notFound();
  }

  // Resolve searchParams — preserve full query string for login returnTo
  const resolvedSearchParams = await searchParams;
  const queryString = new URLSearchParams(
    Object.entries(resolvedSearchParams).flatMap(([k, v]) =>
      v === undefined ? [] : Array.isArray(v) ? v.map((val) => [k, val]) : [[k, v]]
    )
  ).toString();
  const subtaskId = typeof resolvedSearchParams.subtaskId === "string"
    ? resolvedSearchParams.subtaskId
    : undefined;

  const cookieStore = await cookies();
  const session = await getSessionFromRequest({ cookies: cookieStore });
  if (!session) {
    const returnPath = queryString ? `/tasks/${id}?${queryString}` : `/tasks/${id}`;
    redirect(`/login?returnTo=${encodeURIComponent(returnPath)}`);
  }

  const currentUser =
    session && session.id
      ? {
          id: session.id,
          name: session.name || "Người dùng",
          role: session.role || "STAFF",
          email: session.email || "",
          department: session.departmentId || "",
        }
      : null;

  // Load authorization context once for all auth checks
  const authorizationContext = await loadAuthorizationContext(session.id);

  // Resolve canonical route with independent authorization of task, ancestors, and children
  const result = await resolveTaskDetailContext(
    id,
    subtaskId,
    queryString,
    authorizationContext,
    (taskId) => taskQueryService.getTaskEntityForInternalUse(taskId),
    dbReadScope(authorizationContext),
  );

  if (result.outcome === "notFound") {
    notFound();
  }

  if (result.outcome === "redirect") {
    redirect(result.redirectTo!);
  }

  // outcome === 'render'
  const rawTask = result.canonicalRawTask!;
  const availableActions = result.canonicalAvailableActions!;
  const canEdit = availableActions.includes("task.update_metadata");

  // Format task according to scope.
  // Use raw sub-task aggregates for progress/count (not the auth-filtered subset).
  const isSchoolScope = rawTask.scope === "SCHOOL";
  const mappedTask = (
    isSchoolScope
      ? mapPrismaTaskToSchoolTask(rawTask as any)
      : mapPrismaTaskToStaffTask(rawTask as any)
  ) as unknown as SchoolTask | StaffTask;
  (mappedTask as any).availableActions = availableActions;

  // Override subTasks on the mapped task with only auth-readable direct children.
  // Preserve business aggregates (totalSubTasks, completedSubTasks) from raw data.
  if (result.peekTasks) {
    (mappedTask as any).subTasks = result.peekTasks;
  }
  if (result.rawSubTaskCount !== undefined) {
    (mappedTask as any).totalSubTasks = result.rawSubTaskCount;
  }
  if (result.rawCompletedSubTaskCount !== undefined) {
    (mappedTask as any).completedSubTasks = result.rawCompletedSubTaskCount;
  }

  const combinedAuditEvents = await loadTaskDetailAuditEvents(id, rawTask);

  return (
    <TaskDetailPage
      task={mappedTask}
      auditEvents={combinedAuditEvents}
      currentUser={currentUser}
      canEdit={canEdit}
      peekTasks={result.peekTasks}
    />
  );
}
