import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveTaskSubresourceRequest, type TaskSubresourceContext } from "@/server/api/task-subresource-request";
import { CreateUnitRequestSchema, createTaskUnitRequest, listTaskUnitRequests } from "@/server/tasks/task-unit-request-service";

export const dynamic = "force-dynamic";

/** GET /api/tasks/{id}/unit-requests — yêu cầu phối hợp liên đơn vị của nhiệm vụ (T-12). */
export async function GET(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveTaskSubresourceRequest(request, context, { mutate: false });
    requestId = ctx.requestId;
    return apiSuccess(await listTaskUnitRequests(ctx.session, ctx.taskId), { requestId, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}

/** POST /api/tasks/{id}/unit-requests — người giao đề nghị một đơn vị khác cử người phối hợp (T-12). */
export async function POST(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveTaskSubresourceRequest(request, context, { mutate: true, schema: CreateUnitRequestSchema });
    requestId = ctx.requestId;
    return apiSuccess(await createTaskUnitRequest(ctx.session, ctx.taskId, ctx.body), { requestId, status: 201 });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
