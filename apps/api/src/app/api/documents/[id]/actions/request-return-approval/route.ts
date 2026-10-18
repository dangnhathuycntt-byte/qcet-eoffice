import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveTaskSubresourceRequest, type TaskSubresourceContext } from "@/server/api/task-subresource-request";
import { RequestReturnSchema, requestApprovalReturn } from "@/server/documents/submission-approval-service";

/** POST /api/documents/{id}/actions/request-return-approval — người trình xin trả lại khi đã có người mở (V-06). */
export async function POST(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveTaskSubresourceRequest(request, context, { mutate: true, schema: RequestReturnSchema, subjectLabel: "văn bản" });
    requestId = ctx.requestId;
    return apiSuccess(await requestApprovalReturn(ctx.session, ctx.taskId, ctx.body), { requestId, status: 201 });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
