import { NextRequest } from "next/server";
import { AssistantChatRequestSchema, type AssistantStreamEvent } from "@/contracts/assistant";
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
import { callGateway, readGatewayConfig } from "@/server/services/agent-gateway";
import { getAgentModelCatalog } from "@/config/runtime";
import { isAllowedAgentModel } from "@/domain/agent/agent-models";
import { ASSISTANT_ATTACHMENT_WORDING, checkTaskAgentAttachments } from "@/domain/tasks/task-agent-attachments";
import { prepareTaskAgentAttachment } from "@/server/services/task-agent-attachments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Phải lớn hơn turnTimeoutMs (300 giây, xem ASSISTANT_LIMITS) để còn thời gian lưu tin và ghi audit
export const maxDuration = 330;

const MAX_BODY_BYTES = 32 * 1024;

/**
 * Ảnh/tệp gửi kèm lượt hỏi: cùng loại và giới hạn với Agent tạo nhiệm vụ nhưng tính theo lượt (Trợ lý không gửi lại tệp
 * của lượt trước). Kiểm nội dung trước khi trả luồng: tệp hỏng là 400, không tạo cuộc hay tin nào.
 */
async function prepareAttachments(files: File[]): Promise<AssistantTurnAttachment[]> {
  const named = files.map((file) => ({ file, name: cleanAttachmentFileName(file.name) }));
  const problem = checkTaskAgentAttachments(
    named.map(({ file, name }) => ({ name, size: file.size })),
    ASSISTANT_ATTACHMENT_WORDING,
  );
  if (problem) throw new ValidationError(problem);
  const prepared: AssistantTurnAttachment[] = [];
  for (const { file, name } of named) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const { kind, step, parts } = await prepareTaskAgentAttachment(name, bytes);
    prepared.push({ kind, bytes: bytes.length, step, parts });
  }
  return prepared;
}

/**
 * POST /api/assistant/chat — một lượt hỏi đáp với Trợ lý (chỉ đọc).
 * Lỗi trước khi trả lời (CSRF, đăng nhập, cờ, cấu hình, giới hạn tần suất, dữ liệu) trả JSON RFC 9457 kèm mã HTTP;
 * sau đó trả NDJSON (`AssistantStreamEvent`), mỗi dòng một sự kiện. Client ngắt thì hủy lượt phía server.
 */
export async function POST(req: NextRequest) {
  let requestId: string = crypto.randomUUID();
  // Gắn trước mọi lệnh await: client ngắt trong lúc xác thực vẫn hủy được lượt (sự kiện có thể đã phát trước khi gắn)
  const upstream = new AbortController();
  const onClientAbort = () => upstream.abort();
  req.signal.addEventListener("abort", onClientAbort);
  if (req.signal.aborted) upstream.abort();
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
    const turnConfig = body.model ? { ...config, model: body.model } : config;
    const attachments = await prepareAttachments(files);
    const authz = await loadCachedAuthorizationContext(authUser.id);

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: AssistantStreamEvent) => {
          if (!upstream.signal.aborted) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        };
        try {
          await runAssistantTurn(
            {
              userId: authUser.id,
              authz,
              conversationId: body.conversationId,
              message: body.message,
              context: body.context,
              ...(attachments.length > 0 ? { attachments } : {}),
              requestId,
            },
            send,
            {
              signal: upstream.signal,
              deps: {
                callGateway,
                // Audit của lượt ghi đúng model đã dùng (turnConfig.model)
                readConfig: () => turnConfig,
                runTool: runAssistantTool,
                toolDefinitions: ASSISTANT_TOOL_DEFINITIONS,
                describeContext: describeAssistantContext,
              },
            },
          );
        } finally {
          req.signal.removeEventListener("abort", onClientAbort);
          try {
            controller.close();
          } catch {
            // Luồng đã đóng do trình duyệt hủy
          }
        }
      },
      cancel() {
        upstream.abort();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Accel-Buffering": "no",
        "x-request-id": requestId,
      },
    });
  } catch (error) {
    req.signal.removeEventListener("abort", onClientAbort);
    return apiError(error, requestId, { rfc9457: true, instance: req.nextUrl.pathname });
  }
}
