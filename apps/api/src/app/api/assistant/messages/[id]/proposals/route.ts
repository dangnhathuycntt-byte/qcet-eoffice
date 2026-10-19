import { NextRequest } from "next/server";
import { AssistantProposalUpdateRequestSchema } from "@qcet/contracts/assistant";
import { isFeatureEnabled } from "@/features/flags";
import { ApiError } from "@/server/api/errors";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { parseAndValidateJson } from "@/server/api/validation";
import { assertCsrf } from "@/server/security/csrf";
import { assertRateLimit } from "@/server/security/rate-limit";
import { updateMessageProposal } from "@/server/assistant/assistant-conversations";

/**
 * Trạng thái thẻ đề xuất nhiệm vụ của một tin trả lời (ADR-010): bỏ qua/hoàn tác, hoặc đã tạo nhiệm vụ từ thẻ.
 * Không tạo nhiệm vụ ở đây; nhiệm vụ do `POST /api/tasks` tạo và phải do chính người gọi tạo.
 */
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  let requestId: string = crypto.randomUUID();
  try {
    assertCsrf(req);
    const apiCtx = await getApiContext(req);
    requestId = apiCtx.requestId;
    const authUser = requireAuthenticated(apiCtx);
    if (!isFeatureEnabled("assistant")) throw new ApiError(503, "FEATURE_DISABLED", "Trợ lý đang tắt.");
    await assertRateLimit(authUser.id, "MUTATION", { requestId, endpoint: "PATCH /api/assistant/messages/[id]/proposals" });
    const { id } = await props.params;
    const body = await parseAndValidateJson(req, AssistantProposalUpdateRequestSchema, { maxBytes: 1024 });
    const proposal = await updateMessageProposal(authUser.id, id, body);
    return apiSuccess(proposal, { requestId, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: req.nextUrl.pathname });
  }
}
