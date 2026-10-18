/**
 * API Route: /api/page-data/tasks/[id]
 * GET - Dữ liệu trang chi tiết nhiệm vụ (src/app/tasks/[id]/page.tsx). Query là query của trang (`subtaskId`…):
 * nhiệm vụ con được chuyển về nhiệm vụ gốc (`outcome: "redirect"`), nhiệm vụ đọc được trả dữ liệu để vẽ
 * (`outcome: "render"`), không có hoặc không được đọc trả 404.
 */

import { NextRequest } from "next/server";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { NotFoundError } from "@/server/api/errors";
import { mapPrismaTaskToSchoolTask, mapPrismaTaskToStaffTask } from "@qcet/shared/lib/adapters/task-db-adapter";
import type { SchoolTask, StaffTask } from "@qcet/contracts/types/dashboard";
import type { TaskDetailPageData } from "@qcet/contracts/page-data";
import { taskQueryService } from "@/server/tasks";
import { loadAuthorizationContext } from "@/server/authorization/authorization-context-service";
import { dbReadScope } from "@/server/tasks/staff-read-scope";
import { resolveTaskDetailContext } from "@/server/tasks/task-detail-context";
import { loadTaskDetailAuditEvents } from "@/server/tasks/task-page-data";

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  let requestId = crypto.randomUUID();
  try {
    const { id } = await props.params;
    const ctx = await getApiContext(request);
    requestId = ctx.requestId;
    const user = requireAuthenticated(ctx);

    // Query của trang được chuyển nguyên: dùng cho đường dẫn chuyển hướng; `subtaskId` lặp lại thì bỏ qua như trang
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();
    const subtaskIds = searchParams.getAll("subtaskId");
    const subtaskId = subtaskIds.length === 1 ? subtaskIds[0] : undefined;

    // Load authorization context once for all auth checks
    const authorizationContext = await loadAuthorizationContext(user.id);

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
      throw new NotFoundError("Không tìm thấy nhiệm vụ");
    }

    if (result.outcome === "redirect") {
      const data: TaskDetailPageData = { outcome: "redirect", redirectTo: result.redirectTo! };
      return apiSuccess(data, { requestId, headers: NO_STORE });
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

    const auditEvents = await loadTaskDetailAuditEvents(id, rawTask);

    const data: TaskDetailPageData = {
      outcome: "render",
      task: mappedTask,
      auditEvents,
      canEdit,
      peekTasks: result.peekTasks,
      currentUser: {
        id: user.id,
        name: user.name || "Người dùng",
        role: user.role || "STAFF",
        email: user.email || "",
        department: user.departmentId || "",
      },
    };
    return apiSuccess(data, { requestId, headers: NO_STORE });
  } catch (error) {
    return apiError(error, requestId, { headers: NO_STORE });
  }
}
