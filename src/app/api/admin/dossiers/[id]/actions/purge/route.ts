import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveTaskSubresourceRequest, type TaskSubresourceContext } from "@/server/api/task-subresource-request";
import { purgeDossier } from "@/server/dossiers/dossier-disposal-service";

/** POST /api/admin/dossiers/{id}/actions/purge — quản trị hệ thống xóa hẳn hồ sơ đã hủy, có biên bản (V-07). */
export async function POST(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveTaskSubresourceRequest(request, context, { mutate: true, subjectLabel: "hồ sơ" });
    requestId = ctx.requestId;
    return apiSuccess(await purgeDossier(ctx.session, ctx.taskId), { requestId });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
