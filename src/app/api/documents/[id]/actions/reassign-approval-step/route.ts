import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveTaskSubresourceRequest, type TaskSubresourceContext } from "@/server/api/task-subresource-request";
import { ReassignStepSchema, reassignApprovalStep } from "@/server/documents/submission-approval-service";

/** POST /api/documents/{id}/actions/reassign-approval-step — luồng duyệt tờ trình nội bộ (V-06). */
export async function POST(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveTaskSubresourceRequest(request, context, { mutate: true, schema: ReassignStepSchema, subjectLabel: "văn bản" });
    requestId = ctx.requestId;
    const result = await reassignApprovalStep(ctx.session, ctx.taskId, ctx.body);
    return apiSuccess(result, { requestId, status: 200 });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
