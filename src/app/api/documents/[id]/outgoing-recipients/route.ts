import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveTaskSubresourceRequest, type TaskSubresourceContext } from "@/server/api/task-subresource-request";
import { getRecipientsState } from "@/server/documents/outgoing-recipients";

export const dynamic = "force-dynamic";

/** GET /api/documents/{id}/outgoing-recipients — nơi nhận, thu hồi, thay thế và quyền của người xem (V-05). */
export async function GET(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveTaskSubresourceRequest(request, context, { mutate: false, subjectLabel: "văn bản" });
    requestId = ctx.requestId;
    return apiSuccess(await getRecipientsState(ctx.session, ctx.taskId), { requestId, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
