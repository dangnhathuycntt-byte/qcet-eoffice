/**
 * Luồng trả lời của Agent soạn nhiệm vụ. Thuần, không gọi mạng.
 * - Gateway → server: SSE chuẩn OpenAI (`data: {...}`), suy nghĩ nằm ở `delta.reasoning_content` (Claude Sonnet 4.6
 *   chỉ trả khi bật `thinking`; Gemini 3.8 Flash qua gateway local trả cả khi không bật, thử 17/10/2026).
 * - Server → trình duyệt: NDJSON, mỗi dòng một `TaskAgentStreamEvent`.
 */
import type { TaskAgentResult } from "@/domain/tasks/task-agent-draft";

export interface TaskAgentStreamResult extends TaskAgentResult {
  /** Suy nghĩ thật của mô hình (reasoning), không có khi model không trả. */
  thinking?: string;
  /** Bước máy chủ đã làm trước khi hỏi mô hình (đọc tệp, xem ảnh). */
  steps: string[];
  durationMs: number;
}

export type TaskAgentStreamEvent =
  | { type: "step"; label: string }
  | { type: "thinking"; delta: string }
  | { type: "result"; data: TaskAgentStreamResult }
  | { type: "error"; error: { code: string; message: string } };

export interface GatewayDelta {
  reasoning?: string;
  content?: string;
}

/** Đọc dần SSE của gateway: nhận từng khúc chữ, trả các delta đã đủ dòng; khúc dở dang giữ lại cho lần sau. */
export function createGatewaySseParser() {
  let buffer = "";
  const readLine = (line: string): GatewayDelta | null => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return null;
    const data = trimmed.slice(5).trim();
    if (!data || data === "[DONE]") return null;
    try {
      const choice = (JSON.parse(data) as { choices?: Array<{ delta?: Record<string, unknown>; message?: Record<string, unknown> }> })
        .choices?.[0];
      const delta = choice?.delta ?? choice?.message ?? {};
      const reasoning = delta.reasoning_content ?? delta.reasoning;
      const out: GatewayDelta = {};
      if (typeof reasoning === "string" && reasoning) out.reasoning = reasoning;
      if (typeof delta.content === "string" && delta.content) out.content = delta.content;
      return out.reasoning || out.content ? out : null;
    } catch {
      return null;
    }
  };
  return {
    push(chunk: string): GatewayDelta[] {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      return lines.map(readLine).filter((d): d is GatewayDelta => d !== null);
    },
    flush(): GatewayDelta[] {
      const rest = buffer;
      buffer = "";
      const last = readLine(rest);
      return last ? [last] : [];
    },
  };
}

/** Tách NDJSON: trả các dòng đủ và phần còn dở. */
export function splitNdjson(buffer: string): { lines: string[]; rest: string } {
  const parts = buffer.split("\n");
  const rest = parts.pop() ?? "";
  return { lines: parts.map((l) => l.trim()).filter(Boolean), rest };
}

export function parseTaskAgentStreamEvent(line: string): TaskAgentStreamEvent | null {
  try {
    const event = JSON.parse(line) as { type?: unknown };
    return event && typeof event.type === "string" ? (event as TaskAgentStreamEvent) : null;
  } catch {
    return null;
  }
}
