import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveTaskSubresourceRequest, type TaskSubresourceContext } from "@/server/api/task-subresource-request";
import { DeclineTaskSchema, declineTask, getDeclineState } from "@/server/tasks/task-decline-service";

export const dynamic = "force-dynamic";

/** GET /api/tasks/{id}/actions/decline — trạng thái từ chối nhận việc và quyền của người xem (T-02). */
export async function GET(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveTaskSubresourceRequest(request, context, { mutate: false });
    requestId = ctx.requestId;
    const state = await getDeclineState(ctx.session, ctx.taskId);
    return apiSuccess(state, { requestId, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}

/** POST /api/tasks/{id}/actions/decline — người thực hiện chính từ chối nhận việc (T-02). */
export async function POST(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveTaskSubresourceRequest(request, context, { mutate: true, schema: DeclineTaskSchema });
    requestId = ctx.requestId;
    const result = await declineTask(ctx.session, ctx.taskId, ctx.body);
    return apiSuccess({ success: true, data: result }, { requestId, status: 201 });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
