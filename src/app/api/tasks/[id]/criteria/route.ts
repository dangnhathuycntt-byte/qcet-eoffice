import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveTaskSubresourceRequest, type TaskSubresourceContext } from "@/server/api/task-subresource-request";
import { ReplaceCriteriaSchema, getTaskCriteria, replaceTaskCriteria } from "@/server/tasks/task-criteria-service";

export const dynamic = "force-dynamic";

/** GET /api/tasks/{id}/criteria — danh sách tiêu chí hoàn thành (T-04). */
export async function GET(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveTaskSubresourceRequest(request, context, { mutate: false });
    requestId = ctx.requestId;
    const view = await getTaskCriteria(ctx.session, ctx.taskId);
    return apiSuccess(view, { requestId, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}

/** PUT /api/tasks/{id}/criteria — thay toàn bộ danh sách tiêu chí (T-04). */
export async function PUT(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveTaskSubresourceRequest(request, context, { mutate: true, schema: ReplaceCriteriaSchema });
    requestId = ctx.requestId;
    const view = await replaceTaskCriteria(ctx.session, ctx.taskId, ctx.body);
    return apiSuccess(view, { requestId });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
