import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveTaskSubresourceRequest, type TaskSubresourceContext } from "@/server/api/task-subresource-request";
import { recheckIncomingSignature } from "@/server/documents/signature-verification-service";

/** POST /api/documents/{id}/actions/verify-signature — Văn thư kiểm lại chữ ký số của văn bản đến (V-03). */
export async function POST(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveTaskSubresourceRequest(request, context, { mutate: true, subjectLabel: "văn bản" });
    requestId = ctx.requestId;
    return apiSuccess(await recheckIncomingSignature(ctx.session, ctx.taskId), { requestId });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
