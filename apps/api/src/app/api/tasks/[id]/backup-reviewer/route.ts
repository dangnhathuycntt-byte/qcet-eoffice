import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveTaskSubresourceRequest, type TaskSubresourceContext } from "@/server/api/task-subresource-request";
import { SetBackupReviewerSchema, getBackupReviewer, setBackupReviewer } from "@/server/tasks/task-backup-reviewer-service";

export const dynamic = "force-dynamic";

/** GET /api/tasks/{id}/backup-reviewer — người duyệt dự phòng hiện tại (T-05). */
export async function GET(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveTaskSubresourceRequest(request, context, { mutate: false });
    requestId = ctx.requestId;
    return apiSuccess(await getBackupReviewer(ctx.session, ctx.taskId), { requestId, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}

/** PUT /api/tasks/{id}/backup-reviewer — chỉ định người dự phòng (`userId`) hoặc gỡ (`userId: null`) (T-05). */
export async function PUT(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveTaskSubresourceRequest(request, context, { mutate: true, schema: SetBackupReviewerSchema });
    requestId = ctx.requestId;
    return apiSuccess(await setBackupReviewer(ctx.session, ctx.taskId, ctx.body), { requestId });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
