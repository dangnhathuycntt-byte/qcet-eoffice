import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveTaskSubresourceRequest, type TaskSubresourceContext } from "@/server/api/task-subresource-request";
import { getSignatureState } from "@/server/documents/signature-verification-service";

export const dynamic = "force-dynamic";

/** GET /api/documents/{id}/signatures — trạng thái chữ ký số: kiểm chữ ký bên gửi (văn bản đến) và chữ ký của hệ thống (V-03). */
export async function GET(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveTaskSubresourceRequest(request, context, { mutate: false, subjectLabel: "văn bản" });
    requestId = ctx.requestId;
    return apiSuccess(await getSignatureState(ctx.session, ctx.taskId), { requestId, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
