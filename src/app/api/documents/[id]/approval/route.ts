import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveTaskSubresourceRequest, type TaskSubresourceContext } from "@/server/api/task-subresource-request";
import { getApprovalState, markApprovalOpened } from "@/server/documents/submission-approval-service";

export const dynamic = "force-dynamic";

/** GET /api/documents/{id}/approval — luồng duyệt tờ trình và quyền của người xem (V-06). */
export async function GET(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveTaskSubresourceRequest(request, context, { mutate: false, subjectLabel: "văn bản" });
    requestId = ctx.requestId;
    const state = await getApprovalState(ctx.session, ctx.taskId);
    // Người duyệt mở tờ trình thì không còn rút lại được; đọc xong mới đánh dấu để lần đọc đầu vẫn thấy đúng.
    await markApprovalOpened(ctx.session, ctx.taskId);
    return apiSuccess(state, { requestId, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
