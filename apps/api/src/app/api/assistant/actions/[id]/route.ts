import { NextRequest } from "next/server";
import { AssistantActionDecisionSchema } from "@qcet/contracts/assistant";
import { parseAndValidateJson } from "@/server/api/validation";
import { decideAssistantAction } from "@/server/assistant/assistant-actions";
import { assistantRoute } from "@/server/assistant/assistant-route";

/**
 * Duyệt, bỏ qua hoặc hoàn tác thẻ hành động do Trợ lý soạn (ADR-012). Client chỉ gửi quyết định; nội dung hành động lấy
 * từ thẻ đã lưu ở máy chủ, và quyền được kiểm lại bằng chính service của thao tác đó.
 */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  return assistantRoute(req, { endpoint: "POST /api/assistant/actions/[id]", mutate: true }, async ({ session, requestId }) => {
    const { id } = await props.params;
    const body = await parseAndValidateJson(req, AssistantActionDecisionSchema, { maxBytes: 1024 });
    return decideAssistantAction(session, id, body.decision, { requestId });
  });
}
