import { NextRequest } from "next/server";
import { isFeatureEnabled } from "@/features/flags";
import { ApiError } from "@/server/api/errors";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { assertCsrf } from "@/server/security/csrf";
import { assertRateLimit } from "@/server/security/rate-limit";
import { findAssistantRun, stopAssistantRun } from "@/server/assistant/assistant-runs";

/**
 * POST /api/assistant/runs/[id]/stop — nút Dừng (Esc) của Trợ lý: hủy lượt, máy chủ lưu phần chữ đã có với trạng thái
 * "aborted". Lượt đã xong, không có hoặc của người khác thì `stopped: false` (gọi lại nhiều lần vẫn an toàn).
 */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  let requestId: string = crypto.randomUUID();
  try {
    assertCsrf(req);
    const apiCtx = await getApiContext(req);
    requestId = apiCtx.requestId;
    const authUser = requireAuthenticated(apiCtx);
    if (!isFeatureEnabled("assistant")) throw new ApiError(503, "FEATURE_DISABLED", "Trợ lý đang tắt.");
    await assertRateLimit(authUser.id, "MUTATION", { requestId, endpoint: "POST /api/assistant/runs/[id]/stop" });
    const { id } = await props.params;
    const stopped = stopAssistantRun(findAssistantRun(authUser.id, id));
    return apiSuccess({ stopped }, { requestId, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: req.nextUrl.pathname });
  }
}
