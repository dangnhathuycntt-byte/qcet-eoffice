import { ApiError } from "@/server/api/errors";
import {
  buildTaskAgentMessages,
  parseTaskAgentOutput,
  type TaskAgentContentPart,
  type TaskAgentContext,
  type TaskAgentMessage,
  type TaskAgentResult,
} from "@/domain/tasks/task-agent-draft";
import { createGatewaySseParser } from "@/domain/tasks/task-agent-stream";

const AGENT_TIMEOUT_MS = 45_000;

interface GatewayConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Ngân sách token suy nghĩ: Claude Sonnet 4.6 cần để trả reasoning; Gemini 3.8 vẫn nên đặt để suy nghĩ không ăn hết `max_tokens`. */
  thinkingBudget: number | null;
}

function readGatewayConfig(): GatewayConfig {
  const baseUrl = process.env.TASK_AGENT_BASE_URL?.trim();
  const apiKey = process.env.TASK_AGENT_API_KEY?.trim();
  const model = process.env.TASK_AGENT_MODEL?.trim();
  if (!baseUrl || !apiKey || !model) {
    throw new ApiError(503, "AGENT_NOT_CONFIGURED", "Agent soạn nhiệm vụ chưa được cấu hình trên máy chủ.");
  }
  const budget = Number.parseInt(process.env.TASK_AGENT_THINKING_BUDGET ?? "", 10);
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey, model, thinkingBudget: Number.isFinite(budget) && budget >= 1024 ? budget : null };
}

/**
 * Thân yêu cầu gateway. Có ngân sách suy nghĩ: gửi `thinking` (không kèm `reasoning_effort`, chưa thử cặp này)
 * và `max_tokens` phải lớn hơn ngân sách (Sonnet 4.6 và Gemini 3.8 Flash đều nhận). Không có: cấu hình cũ, `max_tokens` 1200.
 */
function buildGatewayBody(config: GatewayConfig, messages: unknown) {
  return config.thinkingBudget
    ? { model: config.model, messages, stream: true, thinking: { type: "enabled", budget_tokens: config.thinkingBudget }, max_tokens: config.thinkingBudget + 3000 }
    : { model: config.model, messages, stream: true, reasoning_effort: "low", max_tokens: 1200 };
}

export interface TaskAgentDraftOptions {
  /** Phần ảnh/tệp gắn vào tin nhắn người dùng theo vị trí. */
  attachments?: ReadonlyMap<number, TaskAgentContentPart[]>;
  signal?: AbortSignal;
  /** Nhận từng đoạn suy nghĩ khi gateway trả `reasoning_content`. */
  onThinking?: (delta: string) => void;
}

/**
 * Gọi gateway chuẩn OpenAI (`/chat/completions`, streaming) để soạn nháp. Không dùng `tools`/`response_format`:
 * gateway hiện bỏ qua `response_format` và treo khi có `tools`, nên yêu cầu JSON ngay trong prompt.
 * Gateway không stream (trả JSON) thì vẫn đọc được. Không ghi log nội dung prompt, tệp hay câu trả lời.
 */
export async function draftTaskWithAgent(
  ctx: TaskAgentContext,
  messages: TaskAgentMessage[],
  options: TaskAgentDraftOptions = {},
): Promise<TaskAgentResult & { thinking?: string }> {
  const { attachments, signal, onThinking } = options;
  const config = readGatewayConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);

  let content = "";
  let thinking = "";
  try {
    let response: Response;
    try {
      response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify(buildGatewayBody(config, buildTaskAgentMessages(ctx, messages, attachments))),
        signal: controller.signal,
        cache: "no-store",
      });
    } catch {
      throw controller.signal.aborted && !signal?.aborted
        ? new ApiError(504, "AGENT_TIMEOUT", "Agent phản hồi quá lâu. Thầy/Cô thử lại sau ít phút.")
        : new ApiError(502, "AGENT_UNAVAILABLE", "Chưa kết nối được tới Agent. Thầy/Cô thử lại sau.");
    }
    if (!response.ok) {
      throw new ApiError(502, "AGENT_UNAVAILABLE", `Agent trả lỗi (${response.status}). Thầy/Cô thử lại sau.`);
    }

    if (!(response.headers.get("content-type") ?? "").includes("text/event-stream") || !response.body) {
      const payload = (await response.json().catch(() => null)) as
        | { choices?: Array<{ message?: { content?: unknown; reasoning_content?: unknown } }> }
        | null;
      const message = payload?.choices?.[0]?.message;
      content = typeof message?.content === "string" ? message.content : "";
      thinking = typeof message?.reasoning_content === "string" ? message.reasoning_content : "";
    } else {
      const parser = createGatewaySseParser();
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const take = (deltas: ReturnType<typeof parser.push>) => {
        for (const delta of deltas) {
          if (delta.reasoning) {
            thinking += delta.reasoning;
            onThinking?.(delta.reasoning);
          }
          if (delta.content) content += delta.content;
        }
      };
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          take(parser.push(decoder.decode(value, { stream: true })));
        }
        take(parser.push(decoder.decode()));
        take(parser.flush());
      } catch {
        throw controller.signal.aborted && !signal?.aborted
          ? new ApiError(504, "AGENT_TIMEOUT", "Agent phản hồi quá lâu. Thầy/Cô thử lại sau ít phút.")
          : new ApiError(502, "AGENT_UNAVAILABLE", "Mất kết nối với Agent giữa chừng. Thầy/Cô thử lại.");
      }
    }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }

  const result = parseTaskAgentOutput(content, ctx.personnel, {
    allowSubtasks: !ctx.parentTaskTitle,
    parentDueDate: ctx.draft.dueDate,
  });
  return thinking.trim() ? { ...result, thinking: thinking.trim() } : result;
}
