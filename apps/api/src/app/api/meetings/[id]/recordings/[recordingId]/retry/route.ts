import { NextRequest, after } from "next/server";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveSessionRequest, type TaskSubresourceContext } from "@/server/api/task-subresource-request";
import { MeetingRecordingService } from "@/server/meetings/recording-service";
import { runRecordingJobs } from "@/server/meetings/recording-kick";

export const dynamic = "force-dynamic";

/** POST /api/meetings/{id}/recordings/{recordingId}/retry — chạy lại bản ghi bị lỗi từ các đoạn đã chép xong. */
export async function POST(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveSessionRequest(request, { mutate: true, context });
    requestId = ctx.requestId;
    const { recordingId } = await context.params;
    const { recording, jobId } = await MeetingRecordingService.retry(ctx.id!, recordingId ?? "", ctx.session.id);
    after(() => runRecordingJobs(recording.id, jobId));
    return apiSuccess(recording, { requestId, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
