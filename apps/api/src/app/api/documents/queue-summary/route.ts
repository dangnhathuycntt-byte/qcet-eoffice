import { NextRequest } from "next/server";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiSuccess, apiError } from "@/server/api/response";
import { assertRateLimit } from "@/server/security/rate-limit";
import { countOutgoingAwaitingViewer } from "@/server/documents/document-service";
import { loadCachedAuthorizationContext } from "@/server/authorization/authorization-context-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Việc đang chờ chính người xem ở sổ văn bản: số đếm cho chấm báo ở sidebar (không phải số liệu Báo cáo). */
export async function GET(request: NextRequest): Promise<Response> {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(request);
    requestId = context.requestId;
    const authUser = requireAuthenticated(context);
    await assertRateLimit(authUser.id, "DEFAULT_API");

    const authContext = await loadCachedAuthorizationContext(authUser.id);
    const outgoingAwaiting = await countOutgoingAwaitingViewer(authContext);

    return apiSuccess(
      { success: true, data: { outgoingAwaiting } },
      { headers: { "Cache-Control": "private, no-store" }, requestId }
    );
  } catch (error) {
    return apiError(error, requestId, {
      headers: { "Cache-Control": "private, no-store" },
      legacyCompat: true,
    });
  }
}
