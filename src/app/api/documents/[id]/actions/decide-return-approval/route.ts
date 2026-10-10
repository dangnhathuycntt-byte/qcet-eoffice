import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveTaskSubresourceRequest, type TaskSubresourceContext } from "@/server/api/task-subresource-request";
import { DecideReturnSchema, decideApprovalReturn } from "@/server/documents/submission-approval-service";

/** POST /api/documents/{id}/actions/decide-return-approval — người đang chờ duyệt đồng ý hoặc từ chối trả lại (V-06). */
export async function POST(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveTaskSubresourceRequest(request, context, { mutate: true, schema: DecideReturnSchema, subjectLabel: "văn bản" });
    requestId = ctx.requestId;
    return apiSuccess(await decideApprovalReturn(ctx.session, ctx.taskId, ctx.body), { requestId });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
