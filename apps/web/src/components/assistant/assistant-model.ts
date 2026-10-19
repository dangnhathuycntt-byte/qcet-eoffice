/**
 * Mô hình thuần của giao diện Trợ lý: đọc tham số ngữ cảnh, đổi DTO thành tin hiển thị, gom sự kiện NDJSON
 * vào một lượt trả lời và quyết định phím gửi. Không React, không gọi mạng nên kiểm bằng test thường.
 */
import {
  AssistantContextRefSchema,
  type AssistantAttachmentDTO,
  type AssistantContextRef,
  type AssistantContextType,
  type AssistantMessageDTO,
  type AssistantMessageRole,
  type AssistantMessageStatus,
  type AssistantProposalTask,
  type AssistantSourceRef,
  type AssistantStep,
  type AssistantStreamEvent,
  type AssistantTaskProposal,
} from "@qcet/contracts/assistant";
import type { ChatAttachment } from "@/components/agent-chat/agent-attachments";

/** Câu gửi khi chỉ đính kèm tệp, không gõ chữ (như Agent tạo nhiệm vụ). */
export const ASSISTANT_ATTACHMENT_ONLY_PROMPT = "Tóm tắt tệp đính kèm.";
export const ASSISTANT_RETRY_ATTACHMENTS_GONE = "Tệp của câu hỏi này không còn. Thầy/Cô đính kèm lại rồi gửi.";

export interface AssistantExample {
  id: "create-task" | "due-soon" | "pending-documents";
  title: string;
  description: string;
  /** Câu gửi cho Trợ lý khi bấm thẻ; không có là thẻ tạo nhiệm vụ (mở hộp tạo nhiệm vụ của app, Trợ lý không ghi). */
  prompt?: string;
}

/**
 * Thẻ ví dụ ở màn đầu, như "Get started with some examples" của Linear Agent (người dùng gửi ảnh và yêu cầu bỏ bốn
 * dòng gợi ý cũ, cho tạo nhiệm vụ ngay, 17/10/2026).
 */
export const ASSISTANT_EXAMPLES: readonly AssistantExample[] = [
  { id: "create-task", title: "Tạo nhiệm vụ", description: "Soạn nhiệm vụ mới và giao cho người chủ trì" },
  {
    id: "due-soon",
    title: "Việc sắp tới hạn",
    description: "Danh sách việc của Thầy/Cô tới hạn trong tuần",
    prompt: "Việc của tôi sắp tới hạn tuần này",
  },
  {
    id: "pending-documents",
    title: "Văn bản chờ xử lý",
    description: "Danh sách văn bản đến còn chờ xử lý",
    prompt: "Văn bản đến đang chờ xử lý",
  },
];

/**
 * Sự kiện trong tab khi một cuộc đổi tên hay bị xóa ở trang Trợ lý, để khung chat nổi (thanh dưới) cập nhật chip và
 * không giữ cuộc đã xóa.
 */
export const ASSISTANT_CONVERSATION_EVENT = "qcet:assistant-conversation";
export type AssistantConversationEventDetail = { id: string; title: string } | { id: string; deleted: true };

export const ASSISTANT_RATE_LIMIT_MESSAGE = "Thầy/Cô gửi hơi nhanh. Chờ một phút rồi thử lại.";
export const ASSISTANT_NO_ANSWER_MESSAGE = "Trợ lý chưa trả lời xong. Thầy/Cô thử hỏi lại.";
export const ASSISTANT_INTERRUPTED_MESSAGE = "Kết nối tới Trợ lý bị gián đoạn. Thầy/Cô thử hỏi lại.";
export const ASSISTANT_FALLBACK_ERROR = "Trợ lý chưa trả lời được. Thầy/Cô thử lại sau.";
/** Lỗi phía máy chủ (5xx): câu chung, không đưa chuỗi kỹ thuật của máy chủ ra màn hình. */
export const ASSISTANT_SERVER_ERROR_MESSAGE = "Trợ lý đang gặp sự cố. Thầy/Cô thử lại sau.";

/**
 * `?context=task:<id>` hoặc `document:<id>`. Sai dạng thì bỏ qua; server vẫn kiểm quyền khi gửi.
 */
export function parseAssistantContextParam(raw: string | string[] | undefined | null): AssistantContextRef | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  const colon = value.indexOf(":");
  if (colon <= 0) return null;
  const parsed = AssistantContextRefSchema.safeParse({ type: value.slice(0, colon), id: value.slice(colon + 1) });
  return parsed.success ? parsed.data : null;
}

/**
 * Lời thông báo lỗi HTTP từ Problem Details. 429 có câu riêng; 5xx và mã `INTERNAL_ERROR` dùng câu chung
 * (máy chủ hay trả chuỗi như "Internal server error"); lỗi 4xx giữ `detail` (rồi `message`), cuối cùng là câu dự phòng.
 */
export function assistantHttpErrorMessage(
  status: number,
  body: { detail?: unknown; message?: unknown; code?: unknown } | null,
): string {
  if (status === 429) return ASSISTANT_RATE_LIMIT_MESSAGE;
  if (status >= 500 || body?.code === "INTERNAL_ERROR") return ASSISTANT_SERVER_ERROR_MESSAGE;
  const detail = typeof body?.detail === "string" ? body.detail.trim() : "";
  if (detail) return detail;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  return message || ASSISTANT_FALLBACK_ERROR;
}

/** Tin đang hiển thị. `key` ổn định trong suốt lượt; `id` là mã bản ghi trên server khi đã lưu. */
export interface ThreadMessage {
  key: string;
  id: string | null;
  role: AssistantMessageRole;
  content: string;
  status: AssistantMessageStatus | "streaming";
  sources: AssistantSourceRef[];
  steps: AssistantStep[];
  thinking: string;
  durationMs: number | null;
  /** Lý do lỗi riêng của lượt (từ sự kiện error); không có thì dùng câu chung. */
  errorMessage: string | null;
  /** Ảnh/tệp gửi kèm câu hỏi còn trong phiên đang mở (bản `File`, có ảnh xem trước). */
  attachments?: ChatAttachment[];
  /** Tệp của câu hỏi đã lưu ở máy chủ (từ 19/10/2026): mở lại cuộc vẫn còn, "Thử lại" gửi mã tệp thay cho tệp. */
  storedAttachments?: AssistantAttachmentDTO[];
  /** Đề xuất nhiệm vụ của lượt trả lời (propose_task); lưu cùng tin nên mở lại cuộc vẫn còn, kèm hai trạng thái dưới. */
  proposals?: AssistantTaskProposal[];
  /** Nhiệm vụ đã tạo từ đề xuất thứ i (người dùng bấm Tạo trong hộp), để thẻ báo "Đã tạo" kèm lối mở. */
  proposalTasks?: Record<number, AssistantProposalTask>;
  /** Vị trí các đề xuất người dùng bấm "Bỏ qua" (thẻ thu gọn, hoàn tác được). */
  dismissedProposals?: number[];
}

export type { AssistantProposalTask } from "@qcet/contracts/assistant";

/** Bỏ qua hoặc hoàn tác bỏ qua đề xuất thứ `index` của tin `replyKey`. */
export function setProposalDismissed(thread: ThreadMessage[], replyKey: string, index: number, dismissed: boolean): ThreadMessage[] {
  return thread.map((message) => {
    if (message.key !== replyKey || !message.proposals?.[index]) return message;
    const others = (message.dismissedProposals ?? []).filter((item) => item !== index);
    return { ...message, dismissedProposals: dismissed ? [...others, index] : others };
  });
}

/** Ghi nhận đề xuất thứ `index` của tin `replyKey` đã thành nhiệm vụ; tin không còn trong luồng thì giữ nguyên. */
export function markProposalCreated(thread: ThreadMessage[], replyKey: string, index: number, task: AssistantProposalTask): ThreadMessage[] {
  return thread.map((message) =>
    message.key === replyKey && message.proposals?.[index]
      ? { ...message, proposalTasks: { ...message.proposalTasks, [index]: task } }
      : message,
  );
}

function baseMessage(key: string, role: AssistantMessageRole): ThreadMessage {
  return { key, id: null, role, content: "", status: "complete", sources: [], steps: [], thinking: "", durationMs: null, errorMessage: null };
}

export function userThreadMessage(
  key: string,
  content: string,
  attachments: ChatAttachment[] = [],
  storedAttachments: AssistantAttachmentDTO[] = [],
): ThreadMessage {
  return {
    ...baseMessage(key, "user"),
    content,
    ...(attachments.length > 0 ? { attachments } : {}),
    ...(storedAttachments.length > 0 ? { storedAttachments } : {}),
  };
}

export function streamingThreadMessage(key: string): ThreadMessage {
  return { ...baseMessage(key, "assistant"), status: "streaming" };
}

export function threadMessageFromDto(dto: AssistantMessageDTO): ThreadMessage {
  const message: ThreadMessage = {
    key: dto.id,
    id: dto.id,
    role: dto.role,
    content: dto.content,
    status: dto.status,
    sources: dto.sources,
    steps: dto.steps,
    thinking: "",
    durationMs: dto.durationMs,
    errorMessage: null,
    ...(dto.attachments?.length ? { storedAttachments: dto.attachments } : {}),
  };
  if (dto.proposals.length === 0) return message;
  // Thẻ đề xuất và trạng thái đã chọn (đã tạo, bỏ qua) lưu ở máy chủ: thoát ra vào lại vẫn như lúc rời
  const proposalTasks: Record<number, AssistantProposalTask> = {};
  const dismissedProposals: number[] = [];
  dto.proposals.forEach((item, index) => {
    if (item.task) proposalTasks[index] = item.task;
    if (item.dismissed) dismissedProposals.push(index);
  });
  return {
    ...message,
    proposals: dto.proposals.map((item) => item.proposal),
    ...(Object.keys(proposalTasks).length > 0 ? { proposalTasks } : {}),
    ...(dismissedProposals.length > 0 ? { dismissedProposals } : {}),
  };
}

/** Áp một sự kiện của lượt lên tin trả lời đang chạy. Sự kiện `conversation`/`context` do khung chat xử lý. */
export function reduceAssistantReply(reply: ThreadMessage, event: AssistantStreamEvent): ThreadMessage {
  switch (event.type) {
    case "step":
      return { ...reply, steps: [...reply.steps, event.step] };
    case "thinking":
      return { ...reply, thinking: reply.thinking + event.delta };
    case "text":
      return { ...reply, content: reply.content + event.delta };
    case "sources":
      return { ...reply, sources: event.sources };
    case "proposal":
      return { ...reply, proposals: [...(reply.proposals ?? []), event.proposal] };
    case "done":
      return { ...reply, id: event.messageId, status: event.status, durationMs: event.durationMs };
    case "error":
      return { ...reply, id: event.messageId ?? reply.id, status: "error", errorMessage: event.error.message };
    default:
      return reply;
  }
}

/** Tin trả lời bị ngắt giữa chừng (mất kết nối, luồng đóng sớm). Tin đã kết thúc giữ nguyên. */
export function markReplyInterrupted(reply: ThreadMessage): ThreadMessage {
  if (reply.status !== "streaming") return reply;
  return { ...reply, status: "error", errorMessage: ASSISTANT_INTERRUPTED_MESSAGE };
}

/** Người dùng bấm Dừng: tin đang chạy thành "Đã dừng", giữ phần chữ đã có. */
export function markReplyAborted(reply: ThreadMessage): ThreadMessage {
  if (reply.status !== "streaming") return reply;
  return { ...reply, status: "aborted" };
}

/**
 * Câu hỏi từng gửi kèm tệp (tin trả lời có bước đọc tệp) mà tệp không còn trong phiên lẫn ở máy chủ (cuộc trước khi lưu
 * tệp, hoặc lưu lỗi): thử lại sẽ thiếu tệp. Tin trả lời lỗi trước khi lưu bước thì không biết được, khi đó thử lại gửi
 * chữ và mô hình được dặn xin gửi lại tệp.
 */
export function retryMissesAttachments(question: ThreadMessage, reply: ThreadMessage | undefined): boolean {
  return (
    !question.attachments?.length &&
    !question.storedAttachments?.length &&
    Boolean(reply?.steps.some((step) => step.tool === "attachment"))
  );
}

/** Tin hỏi ngay trước một tin trả lời, để "Thử lại" gửi lại đúng câu đó cùng tệp đã gửi trong phiên. */
export function questionMessageBefore(thread: ThreadMessage[], replyKey: string): ThreadMessage | null {
  const index = thread.findIndex((message) => message.key === replyKey);
  if (index < 0) return null;
  for (let i = index - 1; i >= 0; i -= 1) {
    if (thread[i].role === "user") return thread[i];
  }
  return null;
}

/** Enter gửi, Shift+Enter xuống dòng. Đang gõ IME (chọn chữ, Enter để chốt) thì không gửi. */
export function isSendKey(event: { key: string; shiftKey: boolean; isComposing: boolean; keyCode: number }): boolean {
  if (event.isComposing || event.keyCode === 229) return false;
  return event.key === "Enter" && !event.shiftKey;
}

/** Esc dừng lượt, trừ khi đang chốt chữ IME (Esc hủy phần gõ dở) hoặc đã có ô khác xử lý phím này. */
export function isStopKey(event: { key: string; defaultPrevented: boolean; isComposing: boolean }): boolean {
  return event.key === "Escape" && !event.defaultPrevented && !event.isComposing;
}

/** Cuộc trò chuyện theo đường dẫn `/assistant/<id>`; `/assistant` (cuộc mới) trả null. */
export function conversationIdFromPath(pathname: string): string | null {
  const prefix = "/assistant/";
  if (!pathname.startsWith(prefix)) return null;
  const rest = pathname.slice(prefix.length).replace(/\/+$/, "");
  if (!rest) return null;
  try {
    return decodeURIComponent(rest);
  } catch {
    return null;
  }
}

/**
 * Đổi tên xong (sau chờ mạng): tiêu đề mới chỉ áp lên thanh đầu khi vẫn đang mở đúng cuộc vừa đổi tên.
 * Trong lúc chờ người dùng có thể đã mở cuộc khác.
 */
export function shouldApplyRenamedTitle(openId: string | null, renamedId: string): boolean {
  return openId !== null && openId === renamedId;
}

/**
 * Nối trang lịch sử mới vào danh sách cũ, bỏ mục đã có: con trỏ đổi mốc (cuộc vừa có tin mới) thì trang sau có thể
 * trả lại mục đã hiện.
 */
export function appendUniqueById<T extends { id: string }>(prev: T[], next: T[]): T[] {
  const seen = new Set(prev.map((item) => item.id));
  return [...prev, ...next.filter((item) => !seen.has(item.id))];
}

interface TaskContextPayload {
  code?: string | null;
  title?: string | null;
}

interface DocumentContextPayload {
  originalNumber?: string | null;
  summary?: string | null;
}

/** Nhãn ngắn của mục đang hỏi ("NV-2026-09-001 Tên việc"), lấy từ chi tiết nhiệm vụ hoặc văn bản đã có quyền xem. */
export function describeContextTarget(type: AssistantContextType, data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  if (type === "task") {
    const task = data as TaskContextPayload;
    return [task.code, task.title].filter(Boolean).join(" ") || null;
  }
  const doc = data as DocumentContextPayload;
  return [doc.originalNumber, doc.summary].filter(Boolean).join(" · ") || null;
}

export function contextTypeLabel(type: AssistantContextType): string {
  return type === "task" ? "nhiệm vụ" : "văn bản";
}
