import { NextRequest } from "next/server";
import { MEETING_RECORDING_PART_MAX_BYTES } from "@qcet/contracts/meeting-recordings";
import { PayloadTooLargeError, ValidationError } from "@/server/api/errors";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { assertCsrf } from "@/server/security/csrf";
import { assertRateLimit } from "@/server/security/rate-limit";
import { MeetingRecordingService } from "@/server/meetings/recording-service";

export const dynamic = "force-dynamic";

interface PartContext {
  params: Promise<{ id: string; recordingId: string; index: string }>;
}

/**
 * PUT /api/meetings/{id}/recordings/{recordingId}/parts/{index} — gửi một phần âm thanh (thân là byte thô, tối đa 8 MB).
 * Gửi lại cùng số thứ tự thì ghi đè nên thử lại an toàn. Ghi trực tiếp gửi một phần mỗi phút nên dùng hạn mức MUTATION (60/phút).
 */
export async function PUT(request: NextRequest, context: PartContext) {
  let requestId = crypto.randomUUID();
  try {
    assertCsrf(request);
    const apiContext = await getApiContext(request);
    requestId = apiContext.requestId;
    const user = requireAuthenticated(apiContext);
    await assertRateLimit(user.id, "MUTATION");

    const { id, recordingId, index: rawIndex } = await context.params;
    if (!/^\d{1,3}$/.test(rawIndex)) throw new ValidationError("Số thứ tự phần không hợp lệ");
    const declared = Number(request.headers.get("content-length") ?? "0");
    if (declared > MEETING_RECORDING_PART_MAX_BYTES) {
      throw new PayloadTooLargeError(`Mỗi phần tối đa ${MEETING_RECORDING_PART_MAX_BYTES / 1024 / 1024} MB`);
    }
    // Next đệm thân yêu cầu và cắt khi quá giới hạn của middleware; thân bị cắt làm đọc lỗi
    let bytes: Buffer;
    try {
      bytes = Buffer.from(await request.arrayBuffer());
    } catch {
      throw new PayloadTooLargeError("Không đọc được phần âm thanh, có thể vượt giới hạn kích thước.");
    }
    const result = await MeetingRecordingService.uploadPart(id, recordingId, Number(rawIndex), bytes, user.id);
    return apiSuccess(result, { requestId, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
