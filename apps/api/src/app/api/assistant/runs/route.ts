import { NextRequest } from "next/server";
import { AssistantConversationActivityQuerySchema, type AssistantConversationActivityDTO } from "@qcet/contracts/assistant";
import { isFeatureEnabled } from "@/features/flags";
import { ApiError, ValidationError } from "@/server/api/errors";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { assertRateLimit } from "@/server/security/rate-limit";
import { listConversationLastMessageAt } from "@/server/assistant/assistant-conversations";
import { hasActiveConversationRun } from "@/server/assistant/assistant-runs";

/**
 * GET /api/assistant/runs?ids=<mã cuộc>,… — hoạt động của các cuộc đang có chip ở thanh dưới của khung nổi: đang có lượt
 * chạy ở máy chủ không, mốc tin mới nhất (khung nổi so với lần xem trước để hiện chấm chưa đọc). Cuộc không thấy được của
 * người gọi thì không có trong kết quả.
 */
export async function GET(req: NextRequest) {
  let requestId: string = crypto.randomUUID();
  try {
    const apiCtx = await getApiContext(req);
    requestId = apiCtx.requestId;
    const authUser = requireAuthenticated(apiCtx);
    if (!isFeatureEnabled("assistant")) throw new ApiError(503, "FEATURE_DISABLED", "Trợ lý đang tắt.");
    await assertRateLimit(authUser.id, "STANDARD_READ", { requestId, endpoint: "GET /api/assistant/runs" });
    const raw = req.nextUrl.searchParams.get("ids") ?? "";
    const parsed = AssistantConversationActivityQuerySchema.safeParse({ ids: raw.split(",").filter(Boolean) });
    if (!parsed.success) throw new ValidationError("Danh sách cuộc trò chuyện không hợp lệ.");
    const rows = await listConversationLastMessageAt(authUser.id, parsed.data.ids);
    const items: AssistantConversationActivityDTO[] = rows.map((row) => ({
      id: row.id,
      running: hasActiveConversationRun(authUser.id, row.id),
      lastMessageAt: row.lastMessageAt.toISOString(),
    }));
    return apiSuccess({ items }, { requestId, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: req.nextUrl.pathname });
  }
}
