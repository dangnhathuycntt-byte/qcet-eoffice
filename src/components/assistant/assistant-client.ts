/**
 * Gọi API Trợ lý từ trình duyệt. Mọi lỗi HTTP thành `AssistantRequestError` với lời tiếng Việt từ server;
 * lỗi mạng và hủy giữ nguyên để nơi gọi phân biệt. Không giữ trạng thái.
 */
import {
  parseAssistantStreamEvent,
  type AssistantChatRequest,
  type AssistantConversationDetailDTO,
  type AssistantConversationListDTO,
  type AssistantConversationSummaryDTO,
  type AssistantMessageProposalDTO,
  type AssistantProposalUpdateRequest,
  type AssistantStreamEvent,
} from "@/contracts/assistant";
import { splitNdjson } from "@/domain/tasks/task-agent-stream";
import { assistantHttpErrorMessage } from "@/components/assistant/assistant-model";

export class AssistantRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AssistantRequestError";
    this.status = status;
  }
}

/** Lời hiển thị cho lỗi bất kỳ: lỗi của Trợ lý giữ nguyên câu; lỗi khác (mạng) dùng câu dự phòng tiếng Việt. */
export function assistantErrorText(error: unknown, fallback: string): string {
  return error instanceof AssistantRequestError ? error.message : fallback;
}

type ProblemBody = { detail?: unknown; message?: unknown; code?: unknown };

async function readProblem(res: Response): Promise<ProblemBody | null> {
  return (await res.json().catch(() => null)) as ProblemBody | null;
}

async function requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin", ...init });
  if (!res.ok) {
    throw new AssistantRequestError(res.status, assistantHttpErrorMessage(res.status, await readProblem(res)));
  }
  return (await res.json()) as T;
}

function conversationUrl(id: string): string {
  return `/api/assistant/conversations/${encodeURIComponent(id)}`;
}

export interface ConversationListQuery {
  q?: string;
  cursor?: string;
  contextType?: "task" | "document";
  contextId?: string;
}

export function listConversationsRequest(query: ConversationListQuery, signal?: AbortSignal): Promise<AssistantConversationListDTO> {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.contextType && query.contextId) {
    params.set("contextType", query.contextType);
    params.set("contextId", query.contextId);
  }
  const qs = params.toString();
  return requestJson<AssistantConversationListDTO>(`/api/assistant/conversations${qs ? `?${qs}` : ""}`, {
    signal,
    cache: "no-store",
  });
}

export function getConversationRequest(id: string, signal?: AbortSignal): Promise<AssistantConversationDetailDTO> {
  return requestJson<AssistantConversationDetailDTO>(conversationUrl(id), { signal, cache: "no-store" });
}

export function renameConversationRequest(id: string, title: string): Promise<AssistantConversationSummaryDTO> {
  return requestJson<AssistantConversationSummaryDTO>(conversationUrl(id), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
}

export function deleteConversationRequest(id: string): Promise<{ deleted: true }> {
  return requestJson<{ deleted: true }>(conversationUrl(id), { method: "DELETE" });
}

/** Lưu trạng thái thẻ đề xuất (bỏ qua/hoàn tác, đã tạo nhiệm vụ) của tin trả lời `messageId`. */
export function updateProposalRequest(messageId: string, change: AssistantProposalUpdateRequest): Promise<AssistantMessageProposalDTO> {
  return requestJson<AssistantMessageProposalDTO>(`/api/assistant/messages/${encodeURIComponent(messageId)}/proposals`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(change),
  });
}

/**
 * Gửi một lượt và đọc NDJSON từng dòng. Ném `AssistantRequestError` khi server từ chối trước khi trả luồng
 * (đăng nhập, cờ tắt, giới hạn tần suất, tệp không hợp lệ); ném lỗi hủy hoặc lỗi mạng khi đọc dở. Có tệp thì gửi
 * multipart: `payload` là JSON của lượt, các trường `files` là tệp.
 */
export async function streamAssistantTurn(
  body: AssistantChatRequest,
  signal: AbortSignal,
  onEvent: (event: AssistantStreamEvent) => void,
  files: File[] = [],
): Promise<void> {
  let init: RequestInit;
  if (files.length > 0) {
    const form = new FormData();
    form.append("payload", JSON.stringify(body));
    files.forEach((file) => form.append("files", file, file.name));
    init = { body: form };
  } else {
    init = { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
  }
  const res = await fetch("/api/assistant/chat", { method: "POST", credentials: "same-origin", signal, ...init });
  if (!res.ok || !res.body) {
    throw new AssistantRequestError(res.status, assistantHttpErrorMessage(res.status, await readProblem(res)));
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const emit = (lines: string[]) => {
    for (const line of lines) {
      const event = parseAssistantStreamEvent(line);
      if (event) onEvent(event);
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const split = splitNdjson(buffer + decoder.decode(value, { stream: true }));
    buffer = split.rest;
    emit(split.lines);
  }
  // Dòng cuối có thể không kết thúc bằng xuống dòng
  emit(splitNdjson(buffer + decoder.decode() + "\n").lines);
}
