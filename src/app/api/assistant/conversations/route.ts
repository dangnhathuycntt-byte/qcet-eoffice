import { NextRequest } from "next/server";
import { AssistantConversationListQuerySchema } from "@/contracts/assistant";
import { isFeatureEnabled } from "@/features/flags";
import { ApiError, ValidationError } from "@/server/api/errors";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { listConversations } from "@/server/assistant/assistant-conversations";

/**
 * GET /api/assistant/conversations — danh sách lịch sử chat của chính người dùng (chưa quá hạn lưu giữ).
 * Lỗi trả JSON RFC 9457 kèm mã HTTP; thành công trả `AssistantConversationListDTO`.
 */
export async function GET(req: NextRequest) {
  let requestId: string = crypto.randomUUID();
  try {
    const apiCtx = await getApiContext(req);
    requestId = apiCtx.requestId;
    const authUser = requireAuthenticated(apiCtx);
    if (!isFeatureEnabled("assistant")) {
      throw new ApiError(503, "FEATURE_DISABLED", "Trợ lý đang tắt.");
    }
    const parsed = AssistantConversationListQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message || "Tham số không hợp lệ");
    const list = await listConversations(authUser.id, parsed.data);
    return apiSuccess(list, { requestId, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: req.nextUrl.pathname });
  }
}
