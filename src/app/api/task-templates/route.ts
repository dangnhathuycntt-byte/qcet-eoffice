import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveSessionRequest } from "@/server/api/task-subresource-request";
import { createTemplate, listTemplates } from "@/server/tasks/task-recurrence-service";

export const dynamic = "force-dynamic";

/** GET /api/task-templates — mẫu nhiệm vụ của các đơn vị người dùng quản lý được (T-09). */
export async function GET(request: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveSessionRequest(request, { mutate: false });
    requestId = ctx.requestId;
    return apiSuccess({ templates: await listTemplates(ctx.session) }, { requestId, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}

/** POST /api/task-templates — tạo mẫu nhiệm vụ cho một đơn vị (T-09). */
export async function POST(request: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveSessionRequest(request, { mutate: true, hasBody: true });
    requestId = ctx.requestId;
    return apiSuccess(await createTemplate(ctx.session, ctx.body), { requestId, status: 201 });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
