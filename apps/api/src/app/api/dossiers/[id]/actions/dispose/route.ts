import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveTaskSubresourceRequest, type TaskSubresourceContext } from "@/server/api/task-subresource-request";
import { DecideDisposalSchema, decideDisposal } from "@/server/dossiers/dossier-disposal-service";

/** POST /api/dossiers/{id}/actions/dispose — lãnh đạo quyết định hủy hoặc gia hạn bảo quản (V-07). */
export async function POST(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveTaskSubresourceRequest(request, context, { mutate: true, schema: DecideDisposalSchema, subjectLabel: "hồ sơ" });
    requestId = ctx.requestId;
    return apiSuccess(await decideDisposal(ctx.session, ctx.taskId, ctx.body), { requestId });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
