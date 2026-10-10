import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveSessionRequest } from "@/server/api/task-subresource-request";
import { createRecurrence, listRecurrences } from "@/server/tasks/task-recurrence-service";

export const dynamic = "force-dynamic";

/** GET /api/task-recurrences?templateId= — lịch lặp lại người dùng quản lý được, kèm kết quả kỳ gần nhất (T-09). */
export async function GET(request: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveSessionRequest(request, { mutate: false });
    requestId = ctx.requestId;
    const templateId = request.nextUrl.searchParams.get("templateId") || undefined;
    return apiSuccess({ recurrences: await listRecurrences(ctx.session, templateId) }, { requestId, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}

/** POST /api/task-recurrences — gắn mẫu với người thực hiện và chu kỳ theo tháng (T-09). */
export async function POST(request: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveSessionRequest(request, { mutate: true, hasBody: true });
    requestId = ctx.requestId;
    return apiSuccess(await createRecurrence(ctx.session, ctx.body), { requestId, status: 201 });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
