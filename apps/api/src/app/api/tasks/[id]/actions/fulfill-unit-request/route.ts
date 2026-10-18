import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveTaskSubresourceRequest, type TaskSubresourceContext } from "@/server/api/task-subresource-request";
import { DecideUnitRequestSchema, decideTaskUnitRequest } from "@/server/tasks/task-unit-request-service";

/**
 * POST /api/tasks/{id}/actions/fulfill-unit-request — trưởng đơn vị được yêu cầu cử người (`ASSIGN`) hoặc
 * từ chối (`DECLINE`, lý do bắt buộc); người gửi rút lại (`CANCEL`) (T-12).
 */
export async function POST(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveTaskSubresourceRequest(request, context, { mutate: true, schema: DecideUnitRequestSchema });
    requestId = ctx.requestId;
    return apiSuccess(await decideTaskUnitRequest(ctx.session, ctx.taskId, ctx.body), { requestId });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
