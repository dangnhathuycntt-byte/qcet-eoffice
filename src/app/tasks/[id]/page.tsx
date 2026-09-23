import * as React from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/jwt-session";
import { mapPrismaTaskToSchoolTask, mapPrismaTaskToStaffTask } from "@/lib/adapters/task-db-adapter";
import { TaskDetailPage } from "@/components/tasks/task-detail-page";
import type { SchoolTask, StaffTask } from "@/types/dashboard";
import { getAuditActionLabel } from "@/lib/tasks/activity-feed-aggregator";
import { taskQueryService } from "@/server/tasks";
import { loadAuthorizationContext } from "@/server/authorization/authorization-context-service";
import { resolveTaskDetailContext } from "@/server/tasks/task-detail-context";

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

function formatAuditDescription(event: {
  action: string;
  beforeData: unknown;
  afterData: unknown;
  metadata: unknown;
}): string | undefined {
  const after = event.afterData as Record<string, any> | null;
  const before = event.beforeData as Record<string, any> | null;
  const meta = event.metadata as Record<string, any> | null;

  if (after?.triggerReason) return String(after.triggerReason);
  if (meta?.triggerReason) return String(meta.triggerReason);

  switch (event.action) {
    case "TASK_CREATED":
      return "Tạo mới nhiệm vụ";
    case "TASK_STATUS_CHANGED": {
      const statusMap: Record<string, string> = {
        NOT_STARTED: "Chưa thực hiện",
        IN_PROGRESS: "Đang thực hiện",
        WAITING_APPROVAL: "Chờ duyệt",
        COMPLETED: "Hoàn thành",
        CANCELLED: "Đã hủy",
      };
      const statusText = after?.status ? (statusMap[after.status] || after.status) : "";
      const reason = after?.reason ? ` (Lý do: ${after.reason})` : "";
      const note = after?.note ? ` - ${after.note}` : "";
      return statusText ? `Chuyển trạng thái sang "${statusText}"${reason}${note}` : after?.note || undefined;
    }
    case "TASK_APPROVED":
      return after?.note ? `Nghiệm thu nhiệm vụ: ${after.note}` : "Nghiệm thu và hoàn thành nhiệm vụ";
    case "TASK_REJECTED":
      return after?.reason || after?.note ? `Yêu cầu làm lại: ${after.reason || after.note}` : "Yêu cầu làm lại";
    case "TASK_DEADLINE_CHANGED":
      return "Điều chỉnh thời hạn hoàn thành";
    case "TASK_START_DATE_CHANGED":
      return "Điều chỉnh ngày bắt đầu";
    case "TASK_ASSIGNED":
      return after?.note ? `Phân công nhiệm vụ: ${after.note}` : "Phân công người phụ trách";
    case "DELIVERABLE_SUBMITTED":
      return after?.title ? `Nộp minh chứng: ${after.title}` : "Nộp tài liệu minh chứng";
    case "TASK_DELIVERABLE_DELETED":
      return before?.title ? `Xóa minh chứng: ${before.title}` : "Xóa tài liệu minh chứng";
    case "DELIVERABLE_REVIEWED":
      return after?.note || after?.reviewNote ? `Đánh giá minh chứng: ${after.note || after.reviewNote}` : "Đánh giá minh chứng";
    case "TASK_REMINDED":
      return after?.message ? `Nhắc nhở: ${after.message}` : "Gửi thông báo nhắc việc";
    case "TASK_UPDATED": {
      if (after?.note) return String(after.note);
      if (after?.progressPercent !== undefined && before?.progressPercent !== after?.progressPercent) {
        return `Cập nhật tiến độ thành ${after.progressPercent}%`;
      }
      if (after?.title && before?.title && after.title !== before.title) {
        return `Đổi tiêu đề: "${after.title}"`;
      }
      if (after?.description !== undefined && before?.description !== after.description) {
        return "Cập nhật nội dung mô tả nhiệm vụ";
      }
      return "Cập nhật thông tin nhiệm vụ";
    }
    default:
      return after?.note || after?.reason || getAuditActionLabel(event.action);
  }
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

  // 1. Fetch audit events from audit_events table
  const dbAuditEvents = await prisma.auditEvent.findMany({
    where: {
      entityType: { in: ["Task", "TASK", "task"] },
      entityId: id,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // 2. Join User to resolve actor names
  const actorIds = Array.from(
    new Set(
      dbAuditEvents
        .map((ev) => ev.actorId)
        .filter((actorId): actorId is string => Boolean(actorId))
    )
  );

  const actorUsers =
    actorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true },
        })
      : [];
  const actorMap = new Map(actorUsers.map((u) => [u.id, u.name]));

  const mappedAuditEvents = dbAuditEvents.map((ev) => ({
    id: ev.id,
    action: ev.action,
    timestamp: ev.createdAt ? ev.createdAt.toISOString() : new Date().toISOString(),
    actorName: (ev.actorId ? actorMap.get(ev.actorId) : undefined) || "Người điều hành",
    actorId: ev.actorId || undefined,
    description: formatAuditDescription(ev),
  }));

  // 3. Extract audit events from resolutions if present
  const resolutionEvents = ((rawTask as any).executiveResolutions || rawTask.resolutions || []).map((res: any) => ({
    id: `res-${res.id}`,
    action: res.resolutionType || "DIRECTIVE",
    timestamp: res.createdAt ? res.createdAt.toISOString() : new Date().toISOString(),
    actorName: res.actor?.name || "Người điều hành",
    actorId: res.actorId || undefined,
    description: res.directiveNote || undefined,
  }));

  // 4. Combine and sort descending by timestamp
  const combinedAuditEvents = [...mappedAuditEvents, ...resolutionEvents].sort((a, b) => {
    const tA = new Date(a.timestamp).getTime();
    const tB = new Date(b.timestamp).getTime();
    return tB - tA;
  });

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
