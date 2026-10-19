/**
 * Khung chung cho route thiết lập và thẻ hành động của Trợ lý (ADR-012): xác thực, bật tính năng, CSRF và giới hạn tốc
 * độ khi ghi, lỗi theo RFC 9457, không lưu cache. `handle` nhận phiên của người gọi; dữ liệu luôn lọc theo `session.id`.
 */
import type { NextRequest } from "next/server";
import { isFeatureEnabled } from "@/features/flags";
import type { SessionPayload } from "@/lib/jwt-session";
import { ApiError } from "@/server/api/errors";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { assertCsrf } from "@/server/security/csrf";
import { assertRateLimit } from "@/server/security/rate-limit";

export interface AssistantRouteRequest {
  session: SessionPayload;
  requestId: string;
}

export async function assistantRoute<T>(
  req: NextRequest,
  options: { endpoint: string; mutate: boolean; status?: number },
  handle: (request: AssistantRouteRequest) => Promise<T>,
): Promise<Response> {
  let requestId: string = crypto.randomUUID();
  try {
    if (options.mutate) assertCsrf(req);
    const apiCtx = await getApiContext(req);
    requestId = apiCtx.requestId;
    const user = requireAuthenticated(apiCtx);
    if (!isFeatureEnabled("assistant")) throw new ApiError(503, "FEATURE_DISABLED", "Trợ lý đang tắt.");
    if (options.mutate) await assertRateLimit(user.id, "MUTATION", { requestId, endpoint: options.endpoint });
    const data = await handle({ session: user as unknown as SessionPayload, requestId });
    return apiSuccess(data, { requestId, status: options.status, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: req.nextUrl.pathname });
  }
}
