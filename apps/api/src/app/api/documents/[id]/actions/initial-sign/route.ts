import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveTaskSubresourceRequest, type TaskSubresourceContext } from "@/server/api/task-subresource-request";
import { InitialSignSchema, initialSignOutgoing } from "@/server/documents/outgoing-initial-sign";

/** POST /api/documents/{id}/actions/initial-sign — ký nháy văn bản đi, tùy chọn (V-09). */
export async function POST(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveTaskSubresourceRequest(request, context, { mutate: true, schema: InitialSignSchema, subjectLabel: "văn bản" });
    requestId = ctx.requestId;
    return apiSuccess(await initialSignOutgoing(ctx.session, ctx.taskId, ctx.body), { requestId, status: 201 });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
