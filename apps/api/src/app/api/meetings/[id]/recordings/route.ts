import { NextRequest } from "next/server";
import { CreateMeetingRecordingSchema } from "@qcet/contracts/meeting-recordings";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveSessionRequest, type TaskSubresourceContext } from "@/server/api/task-subresource-request";
import { MeetingRecordingService } from "@/server/meetings/recording-service";

export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

/** GET /api/meetings/{id}/recordings — các bản ghi âm của cuộc họp (chủ tọa, thư ký, người tổ chức). */
export async function GET(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveSessionRequest(request, { mutate: false, context });
    requestId = ctx.requestId;
    return apiSuccess(await MeetingRecordingService.list(ctx.id!, ctx.session.id), { requestId, headers: PRIVATE_HEADERS });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}

/** POST /api/meetings/{id}/recordings — mở một bản ghi âm mới (cần xác nhận đã thông báo cho người dự họp). */
export async function POST(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveSessionRequest(request, { mutate: true, hasBody: true, context });
    requestId = ctx.requestId;
    const input = CreateMeetingRecordingSchema.parse(ctx.body);
    const recording = await MeetingRecordingService.create(ctx.id!, input, ctx.session.id, requestId);
    return apiSuccess(recording, { requestId, status: 201, headers: PRIVATE_HEADERS });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
