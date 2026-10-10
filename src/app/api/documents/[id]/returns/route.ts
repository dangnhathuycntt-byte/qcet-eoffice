import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveTaskSubresourceRequest, type TaskSubresourceContext } from "@/server/api/task-subresource-request";
import { NotFoundError } from "@/server/api/errors";
import { buildDocumentReadWhere } from "@/server/policies/document-policy";
import { loadContext } from "@/server/documents/authorize-on-document";
import { listDocumentReturns } from "@/lib/services/incoming-document-routing-service";

export const dynamic = "force-dynamic";

/** GET /api/documents/{id}/returns — lịch sử trả lại và chuyển lại văn bản đến cho đơn vị khác (V-01). */
export async function GET(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveTaskSubresourceRequest(request, context, { mutate: false, subjectLabel: "văn bản" });
    requestId = ctx.requestId;
    const authz = await loadContext(ctx.session);
    const readable = await prisma.document.findFirst({ where: { AND: [{ id: ctx.taskId }, buildDocumentReadWhere(authz)] }, select: { id: true } });
    if (!readable) throw new NotFoundError("Không tìm thấy văn bản", "DOCUMENT_NOT_FOUND");
    return apiSuccess({ returns: await listDocumentReturns(ctx.taskId) }, { requestId, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
