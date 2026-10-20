import { NextRequest, after } from "next/server";
import { CompleteMeetingRecordingSchema } from "@qcet/contracts/meeting-recordings";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveSessionRequest, type TaskSubresourceContext } from "@/server/api/task-subresource-request";
import { MeetingRecordingService } from "@/server/meetings/recording-service";
import { runRecordingJobs } from "@/server/meetings/recording-kick";

export const dynamic = "force-dynamic";

/** POST /api/meetings/{id}/recordings/{recordingId}/complete — ghép các phần đã gửi và xếp việc chép lời. */
export async function POST(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveSessionRequest(request, { mutate: true, hasBody: true, context });
    requestId = ctx.requestId;
    const { recordingId } = await context.params;
    const input = CompleteMeetingRecordingSchema.parse(ctx.body);
    const { recording, jobId } = await MeetingRecordingService.complete(ctx.id!, recordingId ?? "", input, ctx.session.id);
    // Chạy việc chép lời sau khi trả lời (production còn có worker thăm dò; dev không có worker)
    after(() => runRecordingJobs(recording.id, jobId));
    return apiSuccess(recording, { requestId, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
