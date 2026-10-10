import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveTaskSubresourceRequest, type TaskSubresourceContext } from "@/server/api/task-subresource-request";
import { DefineApprovalProcessSchema, defineApprovalProcess, getApprovalProcess } from "@/server/tasks/task-approval-process-service";

export const dynamic = "force-dynamic";

/** GET /api/tasks/{id}/approval-process — luồng duyệt nhiều bước gần nhất và quyền lập luồng của người xem (T-05). */
export async function GET(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveTaskSubresourceRequest(request, context, { mutate: false });
    requestId = ctx.requestId;
    return apiSuccess(await getApprovalProcess(ctx.session, ctx.taskId), { requestId, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}

/** POST /api/tasks/{id}/approval-process — người giao lập luồng duyệt nhiều bước cho nhiệm vụ đang chờ duyệt (T-05). */
export async function POST(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveTaskSubresourceRequest(request, context, { mutate: true, schema: DefineApprovalProcessSchema });
    requestId = ctx.requestId;
    return apiSuccess(await defineApprovalProcess(ctx.session, ctx.taskId, ctx.body), { requestId });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
