import { NextRequest } from "next/server";
import { AssistantChatRequestSchema, type AssistantStreamEvent } from "@qcet/contracts/assistant";
import { isFeatureEnabled } from "@/features/flags";
import { ApiError, ValidationError } from "@/server/api/errors";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError } from "@/server/api/response";
import { cleanAttachmentFileName, readJsonOrMultipart } from "@/server/api/json-or-multipart";
import { loadCachedAuthorizationContext } from "@/server/authorization/authorization-context-service";
import { assertCsrf } from "@/server/security/csrf";
import { assertRateLimit } from "@/server/security/rate-limit";
import { runAssistantTurn, type AssistantTurnAttachment } from "@/server/assistant/assistant-service";
import { ASSISTANT_TOOL_DEFINITIONS, describeAssistantContext, runAssistantTool } from "@/server/assistant/assistant-tools";
import { generateConversationTitle } from "@/server/assistant/assistant-title";
import { callGateway, readGatewayConfig } from "@/server/services/agent-gateway";
import { getAgentModelCatalog } from "@/config/runtime";
import { isAllowedAgentModel } from "@qcet/shared/domain/agent/agent-models";
import { ASSISTANT_ATTACHMENT_WORDING, checkTaskAgentAttachments } from "@qcet/shared/domain/tasks/task-agent-attachments";
import { prepareTaskAgentAttachment } from "@/server/services/task-agent-attachments";
import { findConversationAttachments, readStoredAttachment } from "@/server/assistant/assistant-attachments";
import {
  assistantRunHeaders,
  assistantRunResponseBody,
  emitRunEvent,
  finishAssistantRun,
  hasActiveConversationRun,
  startAssistantRun,
} from "@/server/assistant/assistant-runs";
import { logger } from "@/server/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Phải lớn hơn turnTimeoutMs (300 giây, xem ASSISTANT_LIMITS) để còn thời gian lưu tin và ghi audit
export const maxDuration = 330;

const MAX_BODY_BYTES = 32 * 1024;

/**
 * Ảnh/tệp gửi kèm lượt hỏi: cùng loại và giới hạn với Agent tạo nhiệm vụ, tính theo lượt (tệp mới cộng tệp đã lưu gửi lại
 * khi "Thử lại"). Tệp mới được lưu gắn với câu hỏi; tệp đã lưu phải thuộc chính cuộc này của người hỏi. Kiểm nội dung
 * trước khi trả luồng: tệp hỏng hay mã tệp lạ là 400, không tạo cuộc hay tin nào.
 */
async function prepareAttachments(
  files: File[],
  stored: { userId: string; conversationId?: string; ids?: string[] },
): Promise<AssistantTurnAttachment[]> {
  const ids = stored.ids ?? [];
  if (ids.length > 0 && !stored.conversationId) throw new ValidationError("Tệp đã lưu chỉ gửi lại được trong cuộc trò chuyện của nó.");
  const reused = stored.conversationId ? await findConversationAttachments(stored.userId, stored.conversationId, ids) : [];
  if (reused.length !== new Set(ids).size) throw new ValidationError("Tệp đính kèm không còn. Thầy/Cô đính kèm lại rồi gửi.");
  const named = files.map((file) => ({ file, name: cleanAttachmentFileName(file.name) }));
  const problem = checkTaskAgentAttachments(
    [
      ...reused.map((row) => ({ name: row.originalName, size: Number(row.byteSize) })),
      ...named.map(({ file, name }) => ({ name, size: file.size })),
    ],
    ASSISTANT_ATTACHMENT_WORDING,
  );
  if (problem) throw new ValidationError(problem);
  const prepared: AssistantTurnAttachment[] = [];
  for (const row of reused) {
    let data: Buffer;
    try {
      data = await readStoredAttachment(row);
    } catch {
      throw new ValidationError("Tệp đính kèm không còn. Thầy/Cô đính kèm lại rồi gửi.");
    }
    const { kind, step, parts } = await prepareTaskAgentAttachment(row.originalName, data);
    prepared.push({ kind, bytes: data.length, step, parts, name: row.originalName, storedId: row.id });
  }
  for (const { file, name } of named) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const { kind, step, parts } = await prepareTaskAgentAttachment(name, bytes);
    prepared.push({ kind, bytes: bytes.length, step, parts, name, data: bytes });
  }
  return prepared;
}

/**
 * POST /api/assistant/chat — một lượt hỏi đáp với Trợ lý (chỉ đọc).
 * Lỗi trước khi trả lời (CSRF, đăng nhập, cờ, cấu hình, giới hạn tần suất, dữ liệu, cuộc đang có lượt chạy) trả JSON
 * RFC 9457 kèm mã HTTP; sau đó trả NDJSON (`AssistantStreamEvent`), mỗi dòng một sự kiện. Lượt chạy độc lập với kết
 * nối (`assistant-runs`): trình duyệt rời đi thì lượt vẫn chạy và lưu, mở lại cuộc thì nối lại qua
 * `GET /api/assistant/conversations/[id]/stream`; chỉ `POST /api/assistant/runs/[id]/stop` mới dừng lượt.
 */
export async function POST(req: NextRequest) {
  let requestId: string = crypto.randomUUID();
  try {
    assertCsrf(req);
    const apiCtx = await getApiContext(req);
    requestId = apiCtx.requestId;
    const authUser = requireAuthenticated(apiCtx);
    if (!isFeatureEnabled("assistant")) {
      throw new ApiError(503, "FEATURE_DISABLED", "Trợ lý đang tắt.");
    }
    // Thiếu khóa gateway thì báo 503 trước khi trừ lượt gọi
    const config = readGatewayConfig("Trợ lý");
    await assertRateLimit(authUser.id, "AI_CHAT", { requestId, endpoint: "POST /api/assistant/chat" });
    // Có tệp thì multipart (payload JSON + files), không thì JSON
    const { body, files } = await readJsonOrMultipart(req, AssistantChatRequestSchema, {
      jsonMaxBytes: MAX_BODY_BYTES,
      invalidMessage: "Dữ liệu gửi Trợ lý không hợp lệ",
    });
    // Model do trình duyệt chọn: chỉ nhận mã trong danh sách của máy chủ, không tin danh sách phía trình duyệt
    if (body.model && !isAllowedAgentModel(getAgentModelCatalog(), body.model)) {
      throw new ApiError(400, "MODEL_NOT_ALLOWED", "Model này không dùng được cho Trợ lý. Thầy/Cô chọn model khác.");
    }
    if (body.replacesMessageId && !body.conversationId) {
      throw new ValidationError("Chỉ tạo lại hoặc sửa được câu hỏi trong một cuộc trò chuyện có sẵn.");
    }
    // Hai lượt song song trên một cuộc (tab khác, hay vừa rời trang mà lượt cũ chưa xong) làm lẫn lịch sử
    if (body.conversationId && hasActiveConversationRun(authUser.id, body.conversationId)) {
      throw new ApiError(409, "RUN_IN_PROGRESS", "Cuộc trò chuyện đang có câu trả lời chưa xong. Thầy/Cô chờ xong hoặc bấm Dừng rồi hỏi tiếp.");
    }
    const turnConfig = body.model ? { ...config, model: body.model } : config;
    const attachments = await prepareAttachments(files, { userId: authUser.id, conversationId: body.conversationId, ids: body.attachmentIds });
    const authz = await loadCachedAuthorizationContext(authUser.id);

    // Trình duyệt đã hủy trước khi lượt bắt đầu (bấm Dừng ngay khi gửi): không tạo cuộc, không lưu tin, không gọi mô hình.
    // Sau khi lượt bắt đầu, ngắt kết nối chỉ là rời đi.
    if (req.signal.aborted) {
      return new Response(null, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "x-request-id": requestId } });
    }

    const run = startAssistantRun(authUser.id);
    void runAssistantTurn(
      {
        userId: authUser.id,
        authz,
        conversationId: body.conversationId,
        ...(body.replacesMessageId ? { replacesMessageId: body.replacesMessageId } : {}),
        ...(body.skillId ? { skillId: body.skillId } : {}),
        message: body.message,
        context: body.context,
        ...(attachments.length > 0 ? { attachments } : {}),
        requestId,
      },
      (event) => emitRunEvent(run, event),
      {
        // Chỉ nút Dừng hủy lượt (không phải kết nối của request này)
        signal: run.controller.signal,
        deps: {
          callGateway,
          // Audit của lượt ghi đúng model đã dùng (turnConfig.model)
          readConfig: () => turnConfig,
          runTool: runAssistantTool,
          toolDefinitions: ASSISTANT_TOOL_DEFINITIONS,
          describeContext: describeAssistantContext,
          generateTitle: generateConversationTitle,
        },
      },
    )
      .catch((error: unknown) => {
        // runAssistantTurn tự bắt lỗi và phát sự kiện error; tới đây là lỗi không lường trước
        logger.error("assistant.run.failed", { requestId, errorName: error instanceof Error ? error.name : "unknown" });
      })
      .finally(() => finishAssistantRun(run));

    return new Response(assistantRunResponseBody(run), { headers: assistantRunHeaders(run, requestId) });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: req.nextUrl.pathname });
  }
}
