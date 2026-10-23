/**
 * Mô hình thuần của giao diện Trợ lý: đọc tham số ngữ cảnh, đổi DTO thành tin hiển thị, gom sự kiện NDJSON
 * vào một lượt trả lời và quyết định phím gửi. Không React, không gọi mạng nên kiểm bằng test thường.
 */
import {
  ASSISTANT_MAX_PROPOSALS_PER_TURN,
  ASSISTANT_MESSAGE_MAX,
  AssistantContextRefSchema,
  type AssistantActionDTO,
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
import { dedupeSources } from "@qcet/shared/domain/assistant/assistant-sources";

/**
 * `?prompt=` (bản tin sáng trong Hộp thư, ADR-012): câu hỏi điền sẵn vào ô soạn để người dùng tự gửi; không tự gửi từ
 * đường dẫn. Một dòng, cắt theo độ dài tối đa của câu hỏi.
 */
export function parseAssistantPromptParam(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, ASSISTANT_MESSAGE_MAX);
}

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
 * Sự kiện trong tab khi một cuộc được mở, đổi tên hay bị xóa ở trang Trợ lý, để khung chat nổi (thanh dưới) đưa cuộc
 * đang mở lên chip, cập nhật tên và không giữ cuộc đã xóa.
 */
export const ASSISTANT_CONVERSATION_EVENT = "qcet:assistant-conversation";
export type AssistantConversationEventDetail =
  | { id: string; title: string }
  | { id: string; deleted: true }
  | { id: string; title: string | null; opened: true };

/**
 * "Hỏi Trợ lý" về một mục (menu nhiệm vụ): khung chat nổi trên trang đang xem mở cuộc mới với mục đó làm ngữ cảnh, không
 * chuyển sang trang Trợ lý (người dùng yêu cầu 19/10/2026). Khung nhận thì đặt `handled`.
 */
export const ASSISTANT_ASK_EVENT = "qcet:assistant-ask";
export interface AssistantAsk {
  prompt: string;
  /**
   * Gửi luôn thay vì điền sẵn vào ô soạn. Chỉ dùng khi chính người dùng vừa bấm một nút nói rõ việc cần làm ("Tạo biên
   * bản", người dùng yêu cầu 21/10/2026); kỹ năng và bản tin sáng vẫn chỉ điền sẵn.
   */
  send?: boolean;
}
export interface AssistantAskEventDetail extends Partial<AssistantAsk> {
  /** `null`: hỏi chung, không gắn mục nào (Tab trong hộp Tìm kiếm nhanh, như "Ask Linear") */
  context: AssistantContextRef | null;
  handled: boolean;
}

/** Mở khung chat nổi hỏi về `context`; không có khung (điện thoại, trang Trợ lý) thì trả false để nơi gọi chuyển trang. */
export function askAssistantInDock(context: AssistantContextRef | null, ask?: AssistantAsk): boolean {
  if (typeof window === "undefined") return false;
  const detail: AssistantAskEventDetail = { context, ...ask, handled: false };
  window.dispatchEvent(new CustomEvent<AssistantAskEventDetail>(ASSISTANT_ASK_EVENT, { detail }));
  return detail.handled;
}

/**
 * Không có khung nổi mà cần gửi luôn: câu hỏi chuyển sang trang Trợ lý qua `sessionStorage` (cùng tab, cùng tên miền),
 * không qua đường dẫn, để một liên kết từ nơi khác không gửi được câu hỏi thay người dùng. Trang chỉ gửi khi đúng ngữ
 * cảnh của đường dẫn và câu còn mới.
 */
const AUTO_SEND_KEY = "qcet.assistant.autoSend";
const AUTO_SEND_MAX_AGE_MS = 60_000;

export function queueAssistantAutoSend(context: AssistantContextRef, prompt: string, now = Date.now()): void {
  try {
    window.sessionStorage.setItem(AUTO_SEND_KEY, JSON.stringify({ ...context, prompt, at: now }));
  } catch {
    // Không lưu được (chế độ riêng tư chặn): trang Trợ lý mở với ngữ cảnh, người dùng tự hỏi
  }
}

export function parseQueuedAutoSend(raw: string | null, context: AssistantContextRef, now: number): string | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { type?: unknown; id?: unknown; prompt?: unknown; at?: unknown };
    if (value.type !== context.type || value.id !== context.id || typeof value.at !== "number") return null;
    if (now - value.at < 0 || now - value.at > AUTO_SEND_MAX_AGE_MS) return null;
    return typeof value.prompt === "string" ? parseAssistantPromptParam(value.prompt) || null : null;
  } catch {
    return null;
  }
}

/** Lấy (và xóa) câu hỏi chờ gửi của đúng ngữ cảnh này; mỗi câu chỉ gửi một lần. */
export function takeAssistantAutoSend(context: AssistantContextRef, now = Date.now()): string | null {
  try {
    const raw = window.sessionStorage.getItem(AUTO_SEND_KEY);
    window.sessionStorage.removeItem(AUTO_SEND_KEY);
    return parseQueuedAutoSend(raw, context, now);
  } catch {
    return null;
  }
}

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
  /** Lúc gửi câu hỏi (ms) của tin đang chạy, để đếm thời gian trực tiếp; tin mở từ lịch sử không có. */
  startedAt?: number;
  /** Số lời gọi propose_task mô hình đã bắt đầu viết trong lượt đang chạy (thẻ tới sau, khi cả vòng xong). */
  proposalsStarted?: number;
  /** Công cụ của vòng hiện tại đang chạy (từ `tool_start` tới `step`); false là mô hình đang nghĩ hoặc viết. */
  toolsRunning?: boolean;
  /** Thẻ hành động chờ duyệt của lượt trả lời (ADR-012): bình luận, đổi trạng thái, nhắc việc, ghi nhớ. */
  actions?: AssistantActionDTO[];
}

export type { AssistantProposalTask } from "@qcet/contracts/assistant";

/** Thẻ đề xuất thứ `index` của tin trả lời `replyKey`: mở hộp tạo nhiệm vụ hoặc lưu trạng thái thẻ theo vị trí này. */
export interface ProposalTarget {
  replyKey: string;
  index: number;
  proposal: AssistantTaskProposal;
}

/** Một đề xuất của cả cuộc trò chuyện, kèm trạng thái thẻ; `streaming`: lượt chưa xong, chưa thao tác được. */
export interface ConversationProposalItem extends ProposalTarget {
  created: AssistantProposalTask | null;
  dismissed: boolean;
  streaming: boolean;
}

/** Một dòng của thẻ Tiến trình. Bước soạn đề xuất liền nhau gom một dòng ("Soạn 23 đề xuất"). */
export interface ProgressStep {
  label: string;
  state: "done" | "running" | "failed";
}

/** Tiến trình của lượt trả lời gần nhất có làm việc (đọc dữ liệu, đọc tệp, soạn đề xuất), như thẻ Progress của Claude. */
export interface ConversationProgress {
  replyKey: string;
  status: ThreadMessage["status"];
  steps: ProgressStep[];
  startedAt?: number;
  durationMs: number | null;
}

/** Những gì cuộc trò chuyện đã sinh ra và dùng tới, cho bảng bên của trang Trợ lý (như Progress/Outputs của Claude). */
export interface ConversationOutline {
  /** Lượt trả lời cuối nếu nó có bước làm việc hoặc đang chạy; không thì null. */
  progress: ConversationProgress | null;
  proposals: ConversationProposalItem[];
  /** Tệp đã lưu của các câu hỏi, theo thứ tự gửi, không trùng. */
  files: AssistantAttachmentDTO[];
  /** Nguồn Trợ lý đã dẫn trong các câu trả lời, theo thứ tự xuất hiện, không trùng. */
  sources: AssistantSourceRef[];
}

export function conversationOutline(thread: readonly ThreadMessage[]): ConversationOutline {
  const proposals: ConversationProposalItem[] = [];
  const files = new Map<string, AssistantAttachmentDTO>();
  const sources: AssistantSourceRef[] = [];
  for (const message of thread) {
    for (const file of message.storedAttachments ?? []) if (!files.has(file.id)) files.set(file.id, file);
    if (message.role !== "assistant") continue;
    sources.push(...message.sources);
    message.proposals?.forEach((proposal, index) => {
      proposals.push({
        replyKey: message.key,
        index,
        proposal,
        created: message.proposalTasks?.[index] ?? null,
        dismissed: message.dismissedProposals?.includes(index) ?? false,
        streaming: message.status === "streaming",
      });
    });
  }
  return { progress: replyProgress(thread), proposals, files: [...files.values()], sources: dedupeSources(sources) };
}

/**
 * Các bước của tin trả lời cuối thành dòng của thẻ Tiến trình. Bước soạn đề xuất liền nhau gom một dòng; đang chạy thì
 * đề xuất mô hình đang viết dở (proposal_started) cũng đếm, dòng cuối là bước đang làm, và khi chữ trả lời đã bắt đầu
 * thì thêm dòng "Viết câu trả lời". Chưa có bước nào mà đang chạy thì là "Suy nghĩ".
 */
function replyProgress(thread: readonly ThreadMessage[]): ConversationProgress | null {
  const reply = thread[thread.length - 1];
  if (!reply || reply.role !== "assistant") return null;
  const streaming = reply.status === "streaming";
  if (!streaming && reply.steps.length === 0) return null;

  const groups: Array<{ tool: AssistantStep["tool"]; label: string; count: number; ok: boolean }> = [];
  for (const step of reply.steps) {
    const last = groups[groups.length - 1];
    if (step.tool === "propose_task" && last?.tool === "propose_task") {
      last.count += 1;
      last.ok ||= step.ok;
    } else {
      groups.push({ tool: step.tool, label: step.label, count: 1, ok: step.ok });
    }
  }
  if (streaming) {
    // Đề xuất đang viết dở chưa có bước: cộng vào dòng soạn cuối, hoặc mở dòng soạn mới
    const proposeSteps = reply.steps.filter((step) => step.tool === "propose_task").length;
    const extra = Math.max(0, (reply.proposalsStarted ?? 0) - proposeSteps);
    const last = groups[groups.length - 1];
    if (extra > 0 && last?.tool === "propose_task") last.count += extra;
    else if (extra > 0) groups.push({ tool: "propose_task", label: "", count: extra, ok: true });
  }

  const steps: ProgressStep[] = groups.map((group) => ({
    label: group.tool === "propose_task" ? `Soạn ${group.count} đề xuất` : group.label,
    state: group.ok ? "done" : "failed",
  }));
  if (streaming) {
    if (reply.content.trim()) steps.push({ label: "Viết câu trả lời", state: "running" });
    else if (steps.length === 0) steps.push({ label: "Suy nghĩ", state: "running" });
    else steps[steps.length - 1] = { ...steps[steps.length - 1], state: "running" };
  }
  return {
    replyKey: reply.key,
    status: reply.status,
    steps,
    ...(reply.startedAt === undefined ? {} : { startedAt: reply.startedAt }),
    durationMs: reply.durationMs,
  };
}

/** Đề xuất còn chờ tạo: chưa tạo, chưa bỏ qua, lượt đã xong. "Tạo tất cả" chỉ nhận những đề xuất này. */
export function pendingProposals(items: readonly ConversationProposalItem[]): ConversationProposalItem[] {
  return items.filter((item) => !item.created && !item.dismissed && !item.streaming);
}

/** Bỏ qua hoặc hoàn tác bỏ qua đề xuất thứ `index` của tin `replyKey`. */
export function setProposalDismissed(thread: ThreadMessage[], replyKey: string, index: number, dismissed: boolean): ThreadMessage[] {
  return thread.map((message) => {
    if (message.key !== replyKey || !message.proposals?.[index]) return message;
    const others = (message.dismissedProposals ?? []).filter((item) => item !== index);
    return { ...message, dismissedProposals: dismissed ? [...others, index] : others };
  });
}

/** Thay thẻ hành động (sau khi duyệt, bỏ qua, hoàn tác) ở mọi tin đang có thẻ đó. */
export function replaceThreadAction(thread: ThreadMessage[], action: AssistantActionDTO): ThreadMessage[] {
  return thread.map((message) =>
    message.actions?.some((item) => item.id === action.id)
      ? { ...message, actions: message.actions.map((item) => (item.id === action.id ? action : item)) }
      : message,
  );
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

export function streamingThreadMessage(key: string, startedAt?: number): ThreadMessage {
  return { ...baseMessage(key, "assistant"), status: "streaming", ...(startedAt === undefined ? {} : { startedAt }) };
}

/**
 * Thời lượng đọc được: dưới một phút ghi giây ("45 giây"), từ một phút ghi phút và giây ("3 phút 58 giây"); lượt soạn
 * kế hoạch dài chạy vài phút, "238 giây" khó hình dung.
 */
export function formatDurationVi(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total} giây`;
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${minutes} phút` : `${minutes} phút ${rest} giây`;
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
    ...(dto.actions?.length ? { actions: dto.actions } : {}),
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
    case "tool_start":
      return { ...reply, toolsRunning: true };
    case "step":
      return { ...reply, steps: [...reply.steps, event.step], toolsRunning: false };
    case "thinking":
      return { ...reply, thinking: reply.thinking + event.delta, toolsRunning: false };
    case "text":
      return { ...reply, content: reply.content + event.delta, toolsRunning: false };
    case "sources":
      return { ...reply, sources: event.sources };
    case "proposal":
      return { ...reply, proposals: [...(reply.proposals ?? []), event.proposal] };
    case "proposal_started":
      return { ...reply, proposalsStarted: (reply.proposalsStarted ?? 0) + 1 };
    case "action":
      return { ...reply, actions: [...(reply.actions ?? []), event.action] };
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

export interface FollowUpSuggestion {
  label: string;
  /** Câu gửi cho Trợ lý khi bấm. */
  prompt: string;
}

/**
 * Gợi ý bước tiếp theo dưới tin trả lời cuối, như "what to ask next" của mẫu Streaming answer (Halaska UI) và "Continue"
 * sau khi dừng của DeepSeek (Northbase: dừng là một trạng thái, giữ phần đã có và cho làm tiếp). Chỉ suy từ trạng thái
 * lượt, không do mô hình nghĩ ra, tối đa một gợi ý:
 * - lượt soạn đề xuất chưa xong (chạm trần một lượt, bị dừng hay lỗi giữa chừng): soạn tiếp phần còn lại;
 * - lượt bị dừng khi đang viết: viết tiếp;
 * - câu hỏi kèm tệp, trả lời xong mà chưa soạn đề xuất nào: soạn nhiệm vụ từ tệp đó.
 */
export function followUpSuggestions(
  question: ThreadMessage | null,
  reply: ThreadMessage,
  maxProposals: number = ASSISTANT_MAX_PROPOSALS_PER_TURN,
): FollowUpSuggestion[] {
  const proposals = reply.proposals?.length ?? 0;
  if (proposals > 0 && (proposals >= maxProposals || reply.status === "aborted" || reply.status === "error")) {
    return [{ label: "Soạn tiếp phần còn lại", prompt: "Soạn tiếp các đầu việc còn lại" }];
  }
  if (reply.status === "aborted" && reply.content.trim()) {
    return [{ label: "Tiếp tục", prompt: "Tiếp tục phần trả lời đang dở" }];
  }
  const withFiles = Boolean(question?.attachments?.length || question?.storedAttachments?.length);
  if (reply.status === "complete" && proposals === 0 && withFiles) {
    return [{ label: "Soạn nhiệm vụ từ tệp này", prompt: "Soạn nhiệm vụ cho các việc cần làm trong tệp đính kèm" }];
  }
  return [];
}

/**
 * Câu hỏi cuối chưa có trả lời (đã lưu ở máy chủ): lượt của nó còn chạy ở máy chủ (người dùng rời trang, tải lại) thì
 * nối lại; không còn lượt nào thì lượt đã bị gián đoạn. Có tin trả lời rồi thì không nối lại, để không hiện hai lần.
 */
export function unansweredQuestion(thread: readonly ThreadMessage[]): ThreadMessage | null {
  const last = thread[thread.length - 1];
  return last && last.role === "user" && last.id ? last : null;
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
  if (type === "meeting") return (data as { title?: string | null }).title || null;
  const doc = data as DocumentContextPayload;
  return [doc.originalNumber, doc.summary].filter(Boolean).join(" · ") || null;
}

export function contextTypeLabel(type: AssistantContextType): string {
  return type === "task" ? "nhiệm vụ" : type === "meeting" ? "cuộc họp" : "văn bản";
}
