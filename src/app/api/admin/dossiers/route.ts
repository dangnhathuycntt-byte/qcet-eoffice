import { NextRequest } from "next/server";
import { getApiContext } from "@/server/api/context";
import { requireAuthenticated } from "@/server/api/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import { listDisposedDossiers } from "@/server/dossiers/dossier-disposal-service";

export const dynamic = "force-dynamic";

/** GET /api/admin/dossiers — hồ sơ đã có quyết định hủy, chờ quản trị hệ thống xóa hẳn (V-07). */
export async function GET(request: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(request);
    requestId = context.requestId;
    const session = requireAuthenticated(context);
    return apiSuccess(await listDisposedDossiers(session), { requestId, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
