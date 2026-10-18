import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveTaskSubresourceRequest, type TaskSubresourceContext } from "@/server/api/task-subresource-request";
import { getDocumentReturnsForUser } from "@/server/documents/incoming-document-routing-service";

export const dynamic = "force-dynamic";

/** GET /api/documents/{id}/returns — lịch sử trả lại và chuyển lại văn bản đến cho đơn vị khác (V-01). */
export async function GET(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveTaskSubresourceRequest(request, context, { mutate: false, subjectLabel: "văn bản" });
    requestId = ctx.requestId;
    return apiSuccess({ returns: await getDocumentReturnsForUser(ctx.session, ctx.taskId) }, { requestId, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
