import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveTaskSubresourceRequest, type TaskSubresourceContext } from "@/server/api/task-subresource-request";
import { getTaskExtensions } from "@/server/tasks/task-extension-service";

export const dynamic = "force-dynamic";

/** GET /api/tasks/{id}/extensions — yêu cầu gia hạn đang mở, lịch sử và quyền của người xem (T-01). */
export async function GET(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveTaskSubresourceRequest(request, context, { mutate: false });
    requestId = ctx.requestId;
    const view = await getTaskExtensions(ctx.session, ctx.taskId);
    return apiSuccess(view, { requestId, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
