import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveSessionRequest } from "@/server/api/task-subresource-request";
import { listUnitRequestInbox } from "@/server/tasks/task-unit-request-service";

export const dynamic = "force-dynamic";

/** GET /api/task-unit-requests — yêu cầu phối hợp đang chờ gửi cho các đơn vị người dùng làm trưởng (T-12). */
export async function GET(request: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await resolveSessionRequest(request, { mutate: false });
    requestId = ctx.requestId;
    return apiSuccess({ requests: await listUnitRequestInbox(ctx.session) }, { requestId, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
