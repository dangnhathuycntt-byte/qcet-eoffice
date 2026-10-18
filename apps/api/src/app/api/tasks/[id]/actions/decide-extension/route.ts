import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveTaskSubresourceRequest, type TaskSubresourceContext } from "@/server/api/task-subresource-request";
import { DecideExtensionSchema, decideExtension } from "@/server/tasks/task-extension-service";

/**
 * POST /api/tasks/{id}/actions/decide-extension (T-01)
 * Người giao: APPROVE | REJECT | COUNTER. Người xin: ACCEPT | DECLINE khi có đề xuất hạn khác.
 */
export async function POST(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveTaskSubresourceRequest(request, context, { mutate: true, schema: DecideExtensionSchema });
    requestId = ctx.requestId;
    const result = await decideExtension(ctx.session, ctx.taskId, ctx.body);
    return apiSuccess({ success: true, data: result }, { requestId });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
