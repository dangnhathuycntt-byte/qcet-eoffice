import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveTaskSubresourceRequest, type TaskSubresourceContext } from "@/server/api/task-subresource-request";
import { withdrawApproval } from "@/server/documents/submission-approval-service";

/** POST /api/documents/{id}/actions/withdraw-approval — người trình rút lại khi chưa ai mở (V-06). */
export async function POST(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveTaskSubresourceRequest(request, context, { mutate: true, subjectLabel: "văn bản" });
    requestId = ctx.requestId;
    const result = await withdrawApproval(ctx.session, ctx.taskId);
    return apiSuccess(result, { requestId });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
