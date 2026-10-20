import { NextRequest } from "next/server";
import { CreatePersonalNoteSchema, ListPersonalNotesQuerySchema } from "@qcet/contracts/personal-notes";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveSessionRequest } from "@/server/api/task-subresource-request";
import { createPersonalNote, listPersonalNotes } from "@/server/notes/personal-notes-service";

export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

/** GET /api/notes — ghi chú cá nhân của chính người gọi (?q=, ?entityType=&entityId=, ?limit=). */
export async function GET(request: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveSessionRequest(request, { mutate: false });
    requestId = ctx.requestId;
    const query = ListPersonalNotesQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return apiSuccess(await listPersonalNotes(ctx.session.id, query), { requestId, headers: PRIVATE_HEADERS });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}

/** POST /api/notes — tạo ghi chú cá nhân (có thể gắn cuộc họp hoặc nhiệm vụ đọc được). */
export async function POST(request: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveSessionRequest(request, { mutate: true, hasBody: true });
    requestId = ctx.requestId;
    const input = CreatePersonalNoteSchema.parse(ctx.body);
    return apiSuccess(await createPersonalNote(ctx.session.id, input), { requestId, status: 201, headers: PRIVATE_HEADERS });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
