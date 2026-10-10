import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveTaskSubresourceRequest, type TaskSubresourceContext } from "@/server/api/task-subresource-request";
import { RequestExtensionSchema, requestExtension } from "@/server/tasks/task-extension-service";

/** POST /api/tasks/{id}/actions/request-extension — người thực hiện chính xin gia hạn (T-01). */
export async function POST(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveTaskSubresourceRequest(request, context, { mutate: true, schema: RequestExtensionSchema });
    requestId = ctx.requestId;
    const result = await requestExtension(ctx.session, ctx.taskId, ctx.body);
    return apiSuccess({ success: true, data: result }, { requestId, status: 201 });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
