import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveSessionRequest, type TaskSubresourceContext } from "@/server/api/task-subresource-request";
import { MeetingRecordingService } from "@/server/meetings/recording-service";

export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

/** GET /api/meetings/{id}/recordings/{recordingId} — chi tiết kèm bản chép lời và biên bản đề xuất. */
export async function GET(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveSessionRequest(request, { mutate: false, context });
    requestId = ctx.requestId;
    const { recordingId } = await context.params;
    return apiSuccess(await MeetingRecordingService.get(ctx.id!, recordingId ?? "", ctx.session.id), { requestId, headers: PRIVATE_HEADERS });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}

/** DELETE /api/meetings/{id}/recordings/{recordingId} — xóa bản ghi cùng âm thanh còn lại. */
export async function DELETE(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveSessionRequest(request, { mutate: true, context });
    requestId = ctx.requestId;
    const { recordingId } = await context.params;
    return apiSuccess(await MeetingRecordingService.remove(ctx.id!, recordingId ?? "", ctx.session.id, requestId), { requestId, headers: PRIVATE_HEADERS });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
