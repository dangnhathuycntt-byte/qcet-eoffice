import { NextRequest } from "next/server";
import { AssistantRenameRequestSchema } from "@qcet/contracts/assistant";
import { isFeatureEnabled } from "@/features/flags";
import { ApiError, NotFoundError } from "@/server/api/errors";
import { loadCachedAuthorizationContext } from "@/server/authorization/authorization-context-service";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { parseAndValidateJson } from "@/server/api/validation";
import { assertCsrf } from "@/server/security/csrf";
import { assertRateLimit } from "@/server/security/rate-limit";
import {
  deleteConversation,
  getConversationDetail,
  renameConversation,
  toConversationSummaryDTO,
} from "@/server/assistant/assistant-conversations";
import { resolveAssistantContextSource } from "@/server/assistant/assistant-tools";
import { findConversationRun, stopAssistantRun } from "@/server/assistant/assistant-runs";

const NOT_FOUND_MESSAGE = "Không tìm thấy cuộc trò chuyện.";

function assertAssistantEnabled(): void {
  if (!isFeatureEnabled("assistant")) {
    throw new ApiError(503, "FEATURE_DISABLED", "Trợ lý đang tắt.");
  }
}

/** Chi tiết cuộc trò chuyện. Không thấy, đã quá hạn hoặc của người khác đều trả 404 như nhau. */
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  let requestId: string = crypto.randomUUID();
  try {
    const apiCtx = await getApiContext(req);
    requestId = apiCtx.requestId;
    const authUser = requireAuthenticated(apiCtx);
    assertAssistantEnabled();
    const { id } = await props.params;
    const authz = await loadCachedAuthorizationContext(authUser.id);
    const detail = await getConversationDetail(authUser.id, id, (ref) => resolveAssistantContextSource(authz, ref));
    if (!detail) throw new NotFoundError(NOT_FOUND_MESSAGE);
    return apiSuccess(detail, { requestId, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: req.nextUrl.pathname });
  }
}

/** Đổi tên cuộc trò chuyện (người dùng tự đặt, không bị tự động đổi nữa). */
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  let requestId: string = crypto.randomUUID();
  try {
    assertCsrf(req);
    const apiCtx = await getApiContext(req);
    requestId = apiCtx.requestId;
    const authUser = requireAuthenticated(apiCtx);
    assertAssistantEnabled();
    await assertRateLimit(authUser.id, "MUTATION", { requestId, endpoint: "PATCH /api/assistant/conversations/[id]" });
    const { id } = await props.params;
    const body = await parseAndValidateJson(req, AssistantRenameRequestSchema, { maxBytes: 4 * 1024 });
    const row = await renameConversation(authUser.id, id, body.title);
    if (!row) throw new NotFoundError(NOT_FOUND_MESSAGE);
    return apiSuccess(toConversationSummaryDTO(row), { requestId, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: req.nextUrl.pathname });
  }
}

/** Xóa cuộc trò chuyện và toàn bộ tin nhắn (dừng lượt đang chạy của cuộc); ghi audit không kèm tiêu đề hay nội dung. */
export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  let requestId: string = crypto.randomUUID();
  try {
    assertCsrf(req);
    const apiCtx = await getApiContext(req);
    requestId = apiCtx.requestId;
    const authUser = requireAuthenticated(apiCtx);
    assertAssistantEnabled();
    await assertRateLimit(authUser.id, "MUTATION", { requestId, endpoint: "DELETE /api/assistant/conversations/[id]" });
    const { id } = await props.params;
    // Lượt đang chạy của cuộc dừng trước, để không ghi câu trả lời vào cuộc đã xóa
    stopAssistantRun(findConversationRun(authUser.id, id));
    const deleted = await deleteConversation(authUser.id, id, requestId);
    if (!deleted) throw new NotFoundError(NOT_FOUND_MESSAGE);
    return apiSuccess({ deleted: true }, { requestId, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: req.nextUrl.pathname });
  }
}
