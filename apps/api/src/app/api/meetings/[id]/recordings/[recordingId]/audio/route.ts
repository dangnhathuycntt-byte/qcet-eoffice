import { NextRequest } from "next/server";
import { MEETING_RECORDING_FILE_EXTENSIONS, type MeetingRecordingMimeType } from "@qcet/contracts/meeting-recordings";
import { apiError } from "@/server/api/response";
import { streamLocalFile } from "@/server/api/file-response";
import { resolveSessionRequest, type TaskSubresourceContext } from "@/server/api/task-subresource-request";
import { MeetingRecordingService } from "@/server/meetings/recording-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/meetings/{id}/recordings/{recordingId}/audio — nghe lại bản ghi (thẻ `<audio>` của trang chi tiết), cùng quyền với
 * xem bản ghi (chủ tọa, thư ký, người tạo cuộc họp). Hỗ trợ `Range` để tua; không lưu đệm.
 */
export async function GET(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveSessionRequest(request, { mutate: false, context });
    requestId = ctx.requestId;
    const { recordingId } = await context.params;
    const audio = await MeetingRecordingService.audio(ctx.id!, recordingId ?? "", ctx.session.id);
    const extension = MEETING_RECORDING_FILE_EXTENSIONS[audio.mimeType as MeetingRecordingMimeType] ?? "bin";
    return await streamLocalFile(request, audio.path, requestId, { type: "inline", filename: `ghi-am.${extension}` }, audio.mimeType);
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
