/**
 * Gọi API Trợ lý từ trình duyệt. Mọi lỗi HTTP thành `AssistantRequestError` với lời tiếng Việt từ server;
 * lỗi mạng và hủy giữ nguyên để nơi gọi phân biệt. Không giữ trạng thái.
 */
import {
  parseAssistantStreamEvent,
  type AssistantChatRequest,
  type AssistantConversationActivityDTO,
  type AssistantConversationDetailDTO,
  type AssistantConversationListDTO,
  type AssistantConversationSummaryDTO,
  type AssistantMessageProposalDTO,
  type AssistantProposalUpdateRequest,
  type AssistantStreamEvent,
} from "@qcet/contracts/assistant";
import { splitNdjson } from "@qcet/shared/domain/tasks/task-agent-stream";
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

/** Lưu trạng thái thẻ đề xuất (bỏ qua/hoàn tác một hay nhiều thẻ, đã tạo nhiệm vụ) của tin trả lời `messageId`. */
export function updateProposalRequest(
  messageId: string,
  change: AssistantProposalUpdateRequest,
): Promise<AssistantMessageProposalDTO | AssistantMessageProposalDTO[]> {
  return requestJson<AssistantMessageProposalDTO | AssistantMessageProposalDTO[]>(`/api/assistant/messages/${encodeURIComponent(messageId)}/proposals`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(change),
  });
}

/** Lượt chạy ở máy chủ (tiêu đề phản hồi): mã để dừng, mốc bắt đầu cho đồng hồ. */
export interface AssistantRunInfo {
  id: string;
  startedAt: number;
}

function runInfo(res: Response): AssistantRunInfo | null {
  const id = res.headers.get("x-assistant-run-id");
  const startedAt = Number(res.headers.get("x-assistant-run-started-at"));
  return id ? { id, startedAt: Number.isFinite(startedAt) && startedAt > 0 ? startedAt : Date.now() } : null;
}

/** Đọc thân NDJSON của một lượt tới hết luồng; ném lỗi hủy hoặc lỗi mạng khi đọc dở. */
async function readTurnEvents(body: ReadableStream<Uint8Array>, onEvent: (event: AssistantStreamEvent) => void): Promise<void> {
  const reader = body.getReader();
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

/**
 * Gửi một lượt và đọc NDJSON từng dòng. Ném `AssistantRequestError` khi server từ chối trước khi trả luồng
 * (đăng nhập, cờ tắt, giới hạn tần suất, tệp không hợp lệ, cuộc đang có lượt chạy); ném lỗi hủy hoặc lỗi mạng khi đọc
 * dở. Hủy `signal` chỉ là rời đi: lượt ở máy chủ vẫn chạy, muốn dừng thì gọi `stopAssistantRunRequest`. Có tệp thì gửi
 * multipart: `payload` là JSON của lượt, các trường `files` là tệp.
 */
export async function streamAssistantTurn(
  body: AssistantChatRequest,
  signal: AbortSignal,
  onEvent: (event: AssistantStreamEvent) => void,
  files: File[] = [],
  onRun?: (run: AssistantRunInfo) => void,
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
  const run = runInfo(res);
  if (run) onRun?.(run);
  await readTurnEvents(res.body, onEvent);
}

/**
 * Nối lại lượt đang chạy (hoặc vừa xong) của cuộc `conversationId`: máy chủ phát lại từ đầu lượt rồi gửi tiếp. Trả false
 * khi cuộc không có lượt nào (204); `onRun` chạy trước sự kiện đầu tiên.
 */
export async function resumeAssistantTurn(
  conversationId: string,
  signal: AbortSignal,
  onRun: (run: AssistantRunInfo) => void,
  onEvent: (event: AssistantStreamEvent) => void,
): Promise<boolean> {
  const res = await fetch(`${conversationUrl(conversationId)}/stream`, { credentials: "same-origin", cache: "no-store", signal });
  if (res.status === 204) return false;
  if (!res.ok || !res.body) {
    throw new AssistantRequestError(res.status, assistantHttpErrorMessage(res.status, await readProblem(res)));
  }
  const run = runInfo(res);
  if (run) onRun(run);
  await readTurnEvents(res.body, onEvent);
  return true;
}

/** Hoạt động của các cuộc có chip ở thanh dưới: đang chạy, mốc tin mới nhất (chấm chưa đọc). */
export function conversationActivityRequest(ids: string[], signal?: AbortSignal): Promise<{ items: AssistantConversationActivityDTO[] }> {
  const params = new URLSearchParams({ ids: ids.join(",") });
  return requestJson<{ items: AssistantConversationActivityDTO[] }>(`/api/assistant/runs?${params}`, { signal, cache: "no-store" });
}

/** Nút Dừng: hủy lượt ở máy chủ (máy chủ lưu phần chữ đã có với trạng thái "Đã dừng"). */
export function stopAssistantRunRequest(runId: string): Promise<{ stopped: boolean }> {
  return requestJson<{ stopped: boolean }>(`/api/assistant/runs/${encodeURIComponent(runId)}/stop`, { method: "POST" });
}
