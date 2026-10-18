import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveTaskSubresourceRequest, type TaskSubresourceContext } from "@/server/api/task-subresource-request";
import { ProposeDisposalSchema, proposeDisposal } from "@/server/dossiers/dossier-disposal-service";

/** POST /api/dossiers/{id}/actions/propose-disposal — Văn thư đề nghị xét hủy kèm số biên bản (V-07). */
export async function POST(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveTaskSubresourceRequest(request, context, { mutate: true, schema: ProposeDisposalSchema, subjectLabel: "hồ sơ" });
    requestId = ctx.requestId;
    return apiSuccess(await proposeDisposal(ctx.session, ctx.taskId, ctx.body), { requestId, status: 201 });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
