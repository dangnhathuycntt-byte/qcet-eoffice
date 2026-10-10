import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveSessionRequest, type TaskSubresourceContext } from "@/server/api/task-subresource-request";
import { updateTemplate } from "@/server/tasks/task-recurrence-service";

/** PATCH /api/task-templates/{id} — sửa mẫu hoặc ngừng dùng (`isActive: false`) (T-09). */
export async function PATCH(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveSessionRequest(request, { mutate: true, hasBody: true, context });
    requestId = ctx.requestId;
    return apiSuccess(await updateTemplate(ctx.session, ctx.id!, ctx.body), { requestId });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
