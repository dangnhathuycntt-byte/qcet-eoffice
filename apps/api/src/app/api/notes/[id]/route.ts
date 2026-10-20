import { NextRequest } from "next/server";
import { UpdatePersonalNoteSchema } from "@qcet/contracts/personal-notes";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveSessionRequest, type TaskSubresourceContext } from "@/server/api/task-subresource-request";
import { deletePersonalNote, getPersonalNote, updatePersonalNote } from "@/server/notes/personal-notes-service";

export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

/** GET /api/notes/{id} — nội dung đầy đủ của một ghi chú của chính người gọi. */
export async function GET(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveSessionRequest(request, { mutate: false, context });
    requestId = ctx.requestId;
    return apiSuccess(await getPersonalNote(ctx.session.id, ctx.id!), { requestId, headers: PRIVATE_HEADERS });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}

/** PATCH /api/notes/{id} — sửa tiêu đề, nội dung, ghim hoặc liên kết. */
export async function PATCH(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveSessionRequest(request, { mutate: true, hasBody: true, context });
    requestId = ctx.requestId;
    const input = UpdatePersonalNoteSchema.parse(ctx.body);
    return apiSuccess(await updatePersonalNote(ctx.session.id, ctx.id!, input), { requestId, headers: PRIVATE_HEADERS });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}

/** DELETE /api/notes/{id} — xóa hẳn ghi chú của chính người gọi. */
export async function DELETE(request: NextRequest, context: TaskSubresourceContext) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveSessionRequest(request, { mutate: true, context });
    requestId = ctx.requestId;
    return apiSuccess(await deletePersonalNote(ctx.session.id, ctx.id!), { requestId, headers: PRIVATE_HEADERS });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
