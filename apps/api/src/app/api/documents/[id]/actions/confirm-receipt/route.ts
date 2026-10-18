import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveTaskSubresourceRequest, type TaskSubresourceContext } from "@/server/api/task-subresource-request";
import { ConfirmReceiptSchema, confirmReceipt } from "@/server/documents/outgoing-recipients";

/** POST /api/documents/{id}/actions/confirm-receipt — Văn thư ghi nhận một nơi nhận đã tiếp nhận (V-05). */
export async function POST(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveTaskSubresourceRequest(request, context, { mutate: true, schema: ConfirmReceiptSchema, subjectLabel: "văn bản" });
    requestId = ctx.requestId;
    const result = await confirmReceipt(ctx.session, ctx.taskId, ctx.body);
    return apiSuccess(result, { requestId, status: 200 });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
