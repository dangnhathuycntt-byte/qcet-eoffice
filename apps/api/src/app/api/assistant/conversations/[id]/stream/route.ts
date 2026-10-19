import { NextRequest } from "next/server";
import { isFeatureEnabled } from "@/features/flags";
import { ApiError } from "@/server/api/errors";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError } from "@/server/api/response";
import { assertRateLimit } from "@/server/security/rate-limit";
import { assistantRunHeaders, assistantRunResponseBody, findConversationRun } from "@/server/assistant/assistant-runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/assistant/conversations/[id]/stream — nối lại lượt của cuộc (mở lại cuộc khi lượt chưa xong, sau khi chuyển
 * trang hay tải lại): phát lại mọi sự kiện từ đầu lượt rồi nhận tiếp tới khi xong, cùng NDJSON và tiêu đề như
 * `POST /api/assistant/chat`. Không có lượt (hoặc cuộc của người khác) thì 204.
 */
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  let requestId: string = crypto.randomUUID();
  try {
    const apiCtx = await getApiContext(req);
    requestId = apiCtx.requestId;
    const authUser = requireAuthenticated(apiCtx);
    if (!isFeatureEnabled("assistant")) throw new ApiError(503, "FEATURE_DISABLED", "Trợ lý đang tắt.");
    await assertRateLimit(authUser.id, "STANDARD_READ", { requestId, endpoint: "GET /api/assistant/conversations/[id]/stream" });
    const { id } = await props.params;
    const run = findConversationRun(authUser.id, id);
    if (!run) return new Response(null, { status: 204, headers: { "Cache-Control": "private, no-store", "x-request-id": requestId } });
    return new Response(assistantRunResponseBody(run), { headers: assistantRunHeaders(run, requestId) });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: req.nextUrl.pathname });
  }
}
