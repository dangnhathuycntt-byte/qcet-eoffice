import {
  buildTaskAgentMessages,
  parseTaskAgentOutput,
  type TaskAgentContentPart,
  type TaskAgentContext,
  type TaskAgentGatewayMessage,
  type TaskAgentMessage,
  type TaskAgentResult,
} from "@qcet/shared/domain/tasks/task-agent-draft";
import { callGateway, type GatewayConfig, type GatewayMessage } from "@/server/services/agent-gateway";

/** Tin của Agent chỉ có chữ (tệp chỉ gắn vào tin người dùng), nên phần không phải chữ được bỏ qua. */
function toGatewayMessages(list: TaskAgentGatewayMessage[]): GatewayMessage[] {
  return list.map((m): GatewayMessage => {
    if (m.role !== "assistant") return { role: m.role, content: m.content };
    const text = typeof m.content === "string" ? m.content : m.content.map((part) => (part.type === "text" ? part.text : "")).join("");
    return { role: "assistant", content: text };
  });
}

export interface TaskAgentDraftOptions {
  /** Phần ảnh/tệp gắn vào tin nhắn người dùng theo vị trí. */
  attachments?: ReadonlyMap<number, TaskAgentContentPart[]>;
  /** Cấu hình gateway của lượt (model chọn ở ô soạn); không có thì đọc từ môi trường. */
  config?: GatewayConfig;
  signal?: AbortSignal;
  /** Nhận từng đoạn suy nghĩ khi gateway trả `reasoning_content`. */
  onThinking?: (delta: string) => void;
}

/**
 * Soạn nháp nhiệm vụ qua `callGateway`, không dùng tool: Agent soạn nhiệm vụ vẫn yêu cầu JSON trong prompt
 * (gateway chạy được tools, thử 17/10/2026, nhưng Trợ lý mới là nơi dùng tool). Không ghi log nội dung prompt, tệp hay câu trả lời.
 */
export async function draftTaskWithAgent(
  ctx: TaskAgentContext,
  messages: TaskAgentMessage[],
  options: TaskAgentDraftOptions = {},
): Promise<TaskAgentResult & { thinking?: string }> {
  const { attachments, config, signal, onThinking } = options;
  const completion = await callGateway(toGatewayMessages(buildTaskAgentMessages(ctx, messages, attachments)), { config, signal, onThinking });
  const result = parseTaskAgentOutput(completion.content, ctx.personnel, {
    allowSubtasks: !ctx.parentTaskTitle,
    parentDueDate: ctx.draft.dueDate,
  });
  const thinking = completion.thinking.trim();
  return thinking ? { ...result, thinking } : result;
}
