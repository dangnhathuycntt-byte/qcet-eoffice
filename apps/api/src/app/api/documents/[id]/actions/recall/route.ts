import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveTaskSubresourceRequest, type TaskSubresourceContext } from "@/server/api/task-subresource-request";
import { RecallSchema, recallOutgoing } from "@/server/documents/outgoing-recipients";

/** POST /api/documents/{id}/actions/recall — thu hồi văn bản đi khi chưa nơi nhận nào tiếp nhận (V-05). */
export async function POST(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveTaskSubresourceRequest(request, context, { mutate: true, schema: RecallSchema, subjectLabel: "văn bản" });
    requestId = ctx.requestId;
    const result = await recallOutgoing(ctx.session, ctx.taskId, ctx.body);
    return apiSuccess(result, { requestId, status: 200 });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
