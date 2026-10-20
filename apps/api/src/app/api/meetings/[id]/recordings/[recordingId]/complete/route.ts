import { NextRequest, after } from "next/server";
import { CompleteMeetingRecordingSchema } from "@qcet/contracts/meeting-recordings";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveSessionRequest, type TaskSubresourceContext } from "@/server/api/task-subresource-request";
import { MeetingRecordingService } from "@/server/meetings/recording-service";

export const dynamic = "force-dynamic";

/** POST /api/meetings/{id}/recordings/{recordingId}/complete — ghép các phần đã gửi (UPLOADED, chờ "Tạo biên bản"). */
export async function POST(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveSessionRequest(request, { mutate: true, hasBody: true, context });
    requestId = ctx.requestId;
    const { recordingId } = await context.params;
    const input = CompleteMeetingRecordingSchema.parse(ctx.body);
    const { recording } = await MeetingRecordingService.complete(ctx.id!, recordingId ?? "", input, ctx.session.id);
    // Đo sóng âm sau khi trả lời (bản 2 giờ mất vài giây); giao diện chờ tới khi có
    after(() => MeetingRecordingService.measureWaveform(recording.id));
    return apiSuccess(recording, { requestId, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
