/**
 * Vòng hội thoại của Trợ lý (chỉ đọc): ghi câu hỏi, nạp lịch sử, gọi mô hình qua gateway có công cụ đọc dữ liệu (và
 * propose_task chỉ soạn đề xuất nhiệm vụ, ADR-010), phát sự kiện NDJSON, rồi lưu tin trả lời và ghi audit. Không ném lỗi: mọi lỗi thành sự kiện `error` và trạng thái tin.
 * Không ghi câu hỏi, câu trả lời hay dữ liệu công cụ vào log hay audit.
 */
import type { AssistantConversation, AssistantMessage } from "@prisma/client";
import {
  ASSISTANT_CONTEXT_TYPES,
  ASSISTANT_MAX_PROPOSALS_PER_TURN,
  ASSISTANT_TOOL_NAMES,
  type AssistantAttachmentDTO,
  type AssistantContextRef,
  type AssistantContextType,
  type AssistantMessageStatus,
  type AssistantSourceRef,
  type AssistantStep,
  type AssistantStreamEvent,
  type AssistantTaskProposal,
  type AssistantToolName,
} from "@qcet/contracts/assistant";
import type { AuthorizationContext } from "@/server/authorization/authorization-context";
import type { AssistantToolContext, describeAssistantContext, runAssistantTool } from "@/server/assistant/assistant-tools";
import { AuditAction, AuditEntityType, logAuditEvent } from "@qcet/db/audit";
import { formatIsoDate } from "@qcet/shared/lib/format/date";
import { ApiError } from "@/server/api/errors";
import { logger } from "@/server/observability/logger";
import { ToolFailure } from "@/server/assistant/assistant-tool-shared";
import {
  appendMessage,
  replaceLastQuestion,
  applyGeneratedTitle,
  createConversation,
  getConversation,
  loadModelHistoryEntries,
  toConversationSummaryDTO,
} from "@/server/assistant/assistant-conversations";
import {
  linkAssistantAttachments,
  loadHistoryAttachmentParts,
  storeAssistantAttachment,
  toAssistantAttachmentDTO,
} from "@/server/assistant/assistant-attachments";
import {
  callGateway,
  readGatewayConfig,
  toAssistantToolCallMessage,
  toTextOnlyMessages,
  type GatewayCompletion,
  type GatewayConfig,
  type GatewayMessage,
  type GatewayToolCall,
  type GatewayToolDefinition,
} from "@/server/services/agent-gateway";
import { buildAssistantSystemPrompt, assistantDateFrame } from "@qcet/shared/domain/assistant/assistant-prompt";
import { deriveConversationTitle } from "@qcet/shared/domain/assistant/assistant-history";
import { generateConversationTitle } from "@/server/assistant/assistant-title";
import type { TaskAgentContentPart } from "@qcet/shared/domain/tasks/task-agent-draft";
import type { TaskAgentAttachmentKind } from "@qcet/shared/domain/tasks/task-agent-attachments";
import { dedupeSources, selectCitedSources } from "@qcet/shared/domain/assistant/assistant-sources";

/** Giới hạn của một lượt; đổi ở đây, không rải số trong luồng. */
export const ASSISTANT_LIMITS = {
  maxRounds: 6,
  maxToolCallsPerRound: 4,
  maxToolCharsPerTurn: 24_000,
  roundTimeoutMs: 180_000,
  turnTimeoutMs: 300_000,
  historyMessages: 12,
  historyChars: 16_000,
  /**
   * Số đề xuất nhiệm vụ (thẻ) tối đa trong một lượt; quá thì mô hình nhận lỗi, không hiện thêm thẻ. Lần gọi propose_task
   * không đọc dữ liệu nên không tính vào `maxToolCallsPerRound` và `maxToolCharsPerTurn` (kế hoạch vài chục đầu việc).
   */
  maxProposalsPerTurn: ASSISTANT_MAX_PROPOSALS_PER_TURN,
  /**
   * Token cho phần trả lời và lời gọi công cụ của mỗi vòng (ngoài ngân sách suy nghĩ): mặc định của gateway (3000) chỉ đủ
   * vài đề xuất có việc con, kế hoạch năm cần nhiều đề xuất trong một vòng.
   */
  outputTokens: 12_000,
  /**
   * Trả lời xong mà tên do mô hình đặt chưa có: chờ thêm tối đa chừng này trước `done`. Quá thì tên vẫn được ghi khi có
   * nhưng không báo trong lượt (luồng đóng ở `done`); danh sách tải lại sẽ có tên mới.
   */
  titleGraceMs: 2_500,
} as const;

const EMPTY_ANSWER_MESSAGE = "Trợ lý chưa trả lời được câu này. Thầy/Cô thử hỏi lại cụ thể hơn.";
const TURN_TIMEOUT_MESSAGE = "Trợ lý phản hồi quá lâu. Thầy/Cô thử lại sau ít phút.";
const UNAVAILABLE_MESSAGE = "Trợ lý chưa trả lời được. Thầy/Cô thử lại sau.";
const TRUNCATED_MESSAGE = "Câu trả lời bị cắt vì quá dài. Thầy/Cô hỏi hẹp hơn để xem đủ.";
/** Lời nhắc cuối của vòng không công cụ (lịch sử đã đổi sang chữ thuần, xem toTextOnlyMessages). */
const FINAL_ROUND_NOTE =
  "Không đọc thêm dữ liệu nữa. Trả lời ngay câu hỏi của Thầy/Cô bằng dữ liệu đã có ở trên, theo đúng các quy tắc; thiếu dữ liệu thì nói rõ phần chưa đọc được.";
const TOOL_FAILED_CONTENT = '{"error":"Lỗi đọc dữ liệu, thử lại sau."}';
const PROPOSAL_LIMIT_CONTENT = JSON.stringify({
  error: `Mỗi lượt chỉ soạn tối đa ${ASSISTANT_LIMITS.maxProposalsPerTurn} đề xuất. Đề xuất này chưa được soạn; Thầy/Cô hỏi tiếp ở lượt sau.`,
});
const TOO_MANY_TOOLS_CONTENT = '{"error":"Quá nhiều công cụ trong một lượt, hãy gọi ít hơn."}';
const TOOL_BUDGET_CONTENT = '{"error":"Đã đọc đủ dữ liệu cho lượt này, hãy trả lời với dữ liệu đã có."}';
const CONTEXT_FORBIDDEN_MESSAGE = "Không tìm thấy hoặc Thầy/Cô không có quyền xem mục này.";
const NOT_FOUND_MESSAGE = "Không tìm thấy cuộc trò chuyện.";
const REPLACE_STALE_MESSAGE = "Cuộc trò chuyện đã có câu hỏi mới hơn. Thầy/Cô tải lại trang rồi thử lại.";
const CONTEXT_NOUN: Record<AssistantSourceRef["type"], string> = { task: "nhiệm vụ", document: "văn bản", meeting: "cuộc họp" };

export interface AssistantTurnInput {
  userId: string;
  authz: AuthorizationContext;
  conversationId?: string;
  /** "Tạo lại"/"Sửa": câu hỏi cuối của cuộc được thay bằng câu hỏi của lượt này (replaceLastQuestion). */
  replacesMessageId?: string;
  message: string;
  /** Chỉ dùng khi mở cuộc trò chuyện mới; server kiểm lại quyền đọc. */
  context?: AssistantContextRef;
  /**
   * Ảnh/tệp gửi kèm lượt này (đã kiểm nội dung): gửi gateway và lưu gắn với câu hỏi (lượt sau, mở lại cuộc vẫn còn);
   * không ghi tên hay nội dung vào log.
   */
  attachments?: AssistantTurnAttachment[];
  requestId: string;
  now?: Date;
}

export interface AssistantTurnAttachment {
  kind: TaskAgentAttachmentKind;
  bytes: number;
  /** Nhãn bước ("Đọc tệp a.pdf", "Xem ảnh b.png"), lưu cùng tin trả lời. */
  step: string;
  parts: TaskAgentContentPart[];
  /** Tên (đã làm sạch) và nội dung tệp mới để lưu; không có thì không lưu. */
  name?: string;
  data?: Buffer;
  /** Tệp đã lưu gửi lại khi "Thử lại": gắn thêm câu hỏi mới vào tệp đó, không lưu bản mới. */
  storedId?: string;
}

export interface AssistantTurnDeps {
  callGateway: typeof callGateway;
  runTool: typeof runAssistantTool;
  toolDefinitions: GatewayToolDefinition[];
  describeContext: typeof describeAssistantContext;
  readConfig: () => GatewayConfig;
  /** Đặt tên cuộc mới; không có thì giữ tên lấy từ câu hỏi. */
  generateTitle?: typeof generateConversationTitle;
}

export interface AssistantTurnOptions {
  signal?: AbortSignal;
  deps?: Partial<AssistantTurnDeps>;
  /** Chỉ để kiểm thử nhánh hết giờ; mặc định lấy từ ASSISTANT_LIMITS. */
  timeouts?: { turnTimeoutMs?: number; roundTimeoutMs?: number; titleGraceMs?: number };
}

/** Kết quả đã đọc của một lần gọi công cụ, dạng dùng trong vòng lặp. */
interface ToolRun {
  content: string;
  step: AssistantStep;
  sources: AssistantSourceRef[];
  detailed: boolean;
  ok: boolean;
  proposal?: AssistantTaskProposal;
}

interface DescribedContext {
  source: AssistantSourceRef;
  summary: string;
}

/**
 * Nạp phần phụ thuộc: mặc định là gateway thật và công cụ thật. Công cụ chỉ được nạp khi người gọi không truyền đủ,
 * để bài test với deps giả không kéo mô-đun công cụ vào.
 */
async function resolveDeps(partial: Partial<AssistantTurnDeps> = {}): Promise<AssistantTurnDeps> {
  const gateway = partial.callGateway ?? callGateway;
  const readConfig = partial.readConfig ?? (() => readGatewayConfig("Trợ lý"));
  // Gateway giả (kiểm thử) mà không truyền generateTitle thì không đặt tên, để lần gọi đặt tên không lấy kịch bản của lượt
  const generateTitle = partial.generateTitle ?? (partial.callGateway ? undefined : generateConversationTitle);
  if (partial.runTool && partial.toolDefinitions && partial.describeContext) {
    return {
      callGateway: gateway,
      readConfig,
      generateTitle,
      runTool: partial.runTool,
      toolDefinitions: partial.toolDefinitions,
      describeContext: partial.describeContext,
    };
  }
  const tools = await import("@/server/assistant/assistant-tools");
  return {
    callGateway: gateway,
    readConfig,
    generateTitle,
    runTool: partial.runTool ?? tools.runAssistantTool,
    toolDefinitions: partial.toolDefinitions ?? tools.ASSISTANT_TOOL_DEFINITIONS,
    describeContext: partial.describeContext ?? tools.describeAssistantContext,
  };
}

/**
 * Mô tả ngữ cảnh; lỗi hoặc mất quyền đều coi như không còn ngữ cảnh. `onRestricted` nhận câu riêng khi người hỏi
 * đọc được mục đó nhưng Trợ lý không được đọc (văn bản hạn chế), để không báo nhầm là không có quyền.
 */
async function describeSafely(
  deps: AssistantTurnDeps,
  ctx: AssistantToolContext,
  ref: AssistantContextRef,
  onRestricted?: (message: string) => void,
): Promise<DescribedContext | null> {
  try {
    return await deps.describeContext(ctx, ref);
  } catch (error) {
    if (error instanceof ToolFailure) onRestricted?.(error.userMessage);
    return null;
  }
}

/** Lời gọi soạn đề xuất nhiệm vụ: không đọc dữ liệu, chỉ chịu giới hạn số đề xuất của lượt. */
function isProposalCall(call: Pick<GatewayToolCall, "name">): boolean {
  return call.name === "propose_task";
}

/** Mã loại công cụ dùng cho bước hiển thị; tên lạ thành "unknown". */
function toolNameOf(name: string): AssistantToolName | "unknown" {
  return (ASSISTANT_TOOL_NAMES as readonly string[]).includes(name) ? (name as AssistantToolName) : "unknown";
}

/** Chờ `pending` nhưng dừng ngay khi lượt bị hủy (hết giờ hoặc client ngắt), không giữ cả lượt vì một công cụ treo. */
function untilAborted<T>(pending: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new Error("Lượt đã hủy"));
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
    pending.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

/** Chạy một công cụ, không để lỗi thoát ra ngoài: lỗi bất ngờ hoặc quá giờ của lượt thành kết quả thất bại. */
async function runToolSafely(deps: AssistantTurnDeps, call: GatewayToolCall, ctx: AssistantToolContext, signal: AbortSignal): Promise<ToolRun> {
  try {
    const outcome = await untilAborted(deps.runTool(call.name, call.arguments, ctx), signal);
    return {
      content: outcome.content,
      step: outcome.step,
      sources: outcome.sources,
      detailed: outcome.detailed,
      ok: outcome.ok,
      ...(outcome.proposal ? { proposal: outcome.proposal } : {}),
    };
  } catch {
    return {
      content: TOOL_FAILED_CONTENT,
      step: { tool: toolNameOf(call.name), label: "Đọc dữ liệu không thành công", count: null, ok: false },
      sources: [],
      detailed: false,
      ok: false,
    };
  }
}

function isContextType(value: string | null): value is AssistantContextType {
  return (ASSISTANT_CONTEXT_TYPES as readonly string[]).includes(value ?? "");
}

/** Ngữ cảnh đã gắn với cuộc trò chuyện; cột lưu chuỗi tự do nên chỉ nhận loại đã biết. */
function contextRefOf(row: AssistantConversation): AssistantContextRef | null {
  return isContextType(row.contextType) && row.contextId ? { type: row.contextType, id: row.contextId } : null;
}

function contextLabel(source: AssistantSourceRef): string {
  return `${CONTEXT_NOUN[source.type]} ${source.code ? `${source.code} ` : ""}${source.title}`;
}

/** Nhãn lưu vào audit: loại và id, không có tiêu đề hay nội dung. */
function refsOf(sources: AssistantSourceRef[]): Array<{ type: string; id: string }> {
  return dedupeSources(sources).map(({ type, id }) => ({ type, id }));
}

/**
 * Chạy một lượt hội thoại và phát sự kiện qua `emit`. Không ném lỗi.
 * Thứ tự: đọc cấu hình → ngữ cảnh → ghi câu hỏi → nạp lịch sử (bỏ câu hỏi vừa ghi) → vòng gọi mô hình → lưu → audit.
 */
export async function runAssistantTurn(
  input: AssistantTurnInput,
  emit: (event: AssistantStreamEvent) => void,
  options: AssistantTurnOptions = {},
): Promise<void> {
  const startedAt = Date.now();
  const progress: TurnProgress = { conversationId: null, replySaved: false };
  try {
    await runTurn(input, emit, options, progress);
  } catch (error) {
    // Chỉ ghi tên lỗi: thông báo lỗi CSDL có thể chứa dữ liệu
    logger.error("assistant.turn.failed", { requestId: input.requestId, errorName: error instanceof Error ? error.name : "unknown" });
    // Câu hỏi đã lưu mà chưa có trả lời: ghi một tin lỗi để lịch sử không còn câu hỏi bỏ dở
    const failed =
      progress.conversationId && !progress.replySaved
        ? await saveFailedReply(progress.conversationId, input.requestId, Date.now() - startedAt)
        : null;
    emit({ type: "error", error: { code: "AGENT_UNAVAILABLE", message: UNAVAILABLE_MESSAGE }, ...(failed ? { messageId: failed.id } : {}) });
  }
}

/** Tiến độ ghi của một lượt, để nhánh lỗi biết câu hỏi đã vào CSDL mà trả lời còn thiếu hay không. */
interface TurnProgress {
  conversationId: string | null;
  replySaved: boolean;
}

/** Ghi tin trả lời lỗi (rỗng) khi trả lời không lưu được. Lỗi ghi chỉ được log, không ném tiếp. */
async function saveFailedReply(conversationId: string, requestId: string, durationMs: number): Promise<AssistantMessage | null> {
  try {
    return await appendMessage(conversationId, { role: "assistant", content: "", status: "error", durationMs });
  } catch {
    logger.warn("assistant.turn.reply_save_failed", { requestId });
    return null;
  }
}

async function runTurn(
  input: AssistantTurnInput,
  emit: (event: AssistantStreamEvent) => void,
  options: AssistantTurnOptions,
  progress: TurnProgress,
): Promise<void> {
  const startedAt = Date.now();
  const now = input.now ?? new Date();
  const deps = await resolveDeps(options.deps);
  const today = formatIsoDate(now);
  const toolCtx: AssistantToolContext = { authz: input.authz, userId: input.userId, today };

  let config: GatewayConfig;
  try {
    config = deps.readConfig();
  } catch (error) {
    const known = error instanceof ApiError ? error : null;
    emit({ type: "error", error: { code: known?.code ?? "AGENT_NOT_CONFIGURED", message: known?.message ?? UNAVAILABLE_MESSAGE } });
    return;
  }

  // Hủy: do client ngắt, hoặc hết giờ cả lượt. Phân biệt hai trường hợp khi báo lỗi.
  const turn = new AbortController();
  const onClientAbort = () => turn.abort();
  if (options.signal?.aborted) turn.abort();
  options.signal?.addEventListener("abort", onClientAbort, { once: true });
  const turnTimeoutMs = options.timeouts?.turnTimeoutMs ?? ASSISTANT_LIMITS.turnTimeoutMs;
  const roundTimeoutMs = options.timeouts?.roundTimeoutMs ?? ASSISTANT_LIMITS.roundTimeoutMs;
  const turnDeadline = startedAt + turnTimeoutMs;
  const turnTimer = setTimeout(() => turn.abort(), turnTimeoutMs);
  const clientAborted = () => options.signal?.aborted === true;
  const turnExpired = () => !clientAborted() && (turn.signal.aborted || Date.now() >= turnDeadline);
  // Sự kiện tên chỉ phát khi luồng còn mở: tắt trước `done` và khi lượt kết thúc vì bất kỳ lý do nào
  let titleOpen = true;
  // Sự kiện tệp đã lưu cũng vậy
  let attachmentsOpen = true;

  try {
    // Ngữ cảnh: cuộc có sẵn lấy từ bản ghi (bỏ input.context), mô tả lại mỗi lượt; cuộc mới phải đọc được mới tạo
    let conversation: AssistantConversation;
    let described: DescribedContext | null = null;
    if (input.conversationId) {
      const existing = await getConversation(input.userId, input.conversationId, now);
      if (!existing) {
        emit({ type: "error", error: { code: "NOT_FOUND", message: NOT_FOUND_MESSAGE } });
        return;
      }
      conversation = existing;
      const ref = contextRefOf(existing);
      described = ref ? await describeSafely(deps, toolCtx, ref) : null;
      // Client đã rời: không ghi tin hỏi và tin trả lời rỗng cho người không còn nhận
      if (clientAborted()) return;
    } else {
      if (input.context) {
        let restrictedMessage: string | null = null;
        described = await describeSafely(deps, toolCtx, input.context, (message) => {
          restrictedMessage = message;
        });
        if (!described) {
          emit({ type: "error", error: { code: "CONTEXT_FORBIDDEN", message: restrictedMessage ?? CONTEXT_FORBIDDEN_MESSAGE } });
          return;
        }
      }
      // Client đã ngắt trước khi tạo: không tạo cuộc, không lưu tin, kết thúc lặng lẽ
      if (clientAborted()) return;
      conversation = await createConversation(input.userId, {
        title: deriveConversationTitle(input.message),
        context: input.context ?? null,
      });
    }

    const userMessage =
      input.replacesMessageId && input.conversationId
        ? await replaceLastQuestion(conversation.id, input.replacesMessageId, input.message)
        : await appendMessage(conversation.id, { role: "user", content: input.message });
    // Câu hỏi cần thay không còn là câu hỏi cuối (cuộc đã có lượt mới ở tab khác): không đổi gì
    if (!userMessage) {
      emit({ type: "error", error: { code: "REPLACE_STALE", message: REPLACE_STALE_MESSAGE } });
      return;
    }
    progress.conversationId = conversation.id;
    // Tệp của câu hỏi lưu song song với câu trả lời (lưu lỗi không làm hỏng lượt); báo trước `done` để mở lại cuộc vẫn có
    const savingAttachments = saveTurnAttachments(input, conversation.id, userMessage.id).then((stored) => {
      if (stored.length > 0 && attachmentsOpen) emit({ type: "attachments", messageId: userMessage.id, attachments: stored });
    });
    emit({
      type: "conversation",
      conversation: toConversationSummaryDTO({ ...conversation, lastMessageAt: userMessage.createdAt }),
      userMessageId: userMessage.id,
    });
    if (described) emit({ type: "context", source: described.source });

    // Cuộc mới: mô hình đặt tên song song với câu trả lời
    const titleTask =
      !input.conversationId && deps.generateTitle
        ? nameConversation(deps.generateTitle, conversation, input, described, config, (row) => {
            if (titleOpen) emit({ type: "title", conversation: toConversationSummaryDTO(row) });
          })
        : null;

    const history = await loadModelHistoryEntries(conversation.id, {
      maxMessages: ASSISTANT_LIMITS.historyMessages,
      maxChars: ASSISTANT_LIMITS.historyChars,
      excludeMessageId: userMessage.id,
    });
    // Tệp đã lưu của các câu hỏi còn trong lịch sử gửi lại cùng câu hỏi đó (tệp gửi lại ở lượt này thì không lặp)
    const historyFiles = await loadHistoryAttachmentParts(
      input.userId,
      conversation.id,
      history.filter((item) => item.role === "user").map((item) => item.id),
      new Set((input.attachments ?? []).flatMap((attachment) => (attachment.storedId ? [attachment.storedId] : []))),
    ).catch(() => {
      logger.warn("assistant.attachment.history_failed", { requestId: input.requestId });
      return new Map<string, TaskAgentContentPart[]>();
    });
    const system = buildAssistantSystemPrompt({
      today,
      ...assistantDateFrame(today),
      userName: input.authz.user.name,
      positions: input.authz.positions.map((p) => ({ title: p.positionTitle, unitName: p.unitName })),
      context: described ? { label: contextLabel(described.source), summary: described.summary } : null,
    });
    const attachmentParts = (input.attachments ?? []).flatMap((attachment) => attachment.parts);
    const withParts = (text: string, parts: TaskAgentContentPart[] | undefined): GatewayMessage =>
      ({ role: "user", content: parts?.length ? [{ type: "text", text }, ...parts] : text }) as GatewayMessage;
    const messages: GatewayMessage[] = [
      { role: "system", content: system },
      ...history.map((item): GatewayMessage => (item.role === "user" ? withParts(item.content, historyFiles.get(item.id)) : { role: "assistant", content: item.content })),
      withParts(input.message, attachmentParts),
    ];

    const read: AssistantSourceRef[] = [];
    const detailed: AssistantSourceRef[] = described ? [described.source] : [];
    const steps: AssistantStep[] = [];
    let answer = "";
    let toolChars = 0;
    const proposals: AssistantTaskProposal[] = [];
    // Ngân sách ký tự công cụ của cả lượt: hết (đủ trần, hoặc một kết quả đã bị loại vì vượt) thì các lần đọc sau không chạy nữa
    let budgetUsed = false;
    let rounds = 0;
    let status: AssistantMessageStatus = "complete";
    let errorEvent: { code: string; message: string } | null = null;
    // Bước đọc tệp đứng đầu nhật ký của lượt, như Agent tạo nhiệm vụ
    for (const attachment of input.attachments ?? []) {
      const step: AssistantStep = { tool: "attachment", label: attachment.step, count: null, ok: true };
      emit({ type: "step", step });
      steps.push(step);
    }

    // Mô hình gọi công cụ không được khai báo: chuyển sang vòng trả lời không công cụ thay vì báo lỗi
    let forceFinal = false;
    for (let round = 1; round <= ASSISTANT_LIMITS.maxRounds; round++) {
      rounds = round;
      // Vòng cuối không kèm công cụ và gửi lịch sử dạng chữ thuần để buộc mô hình trả lời
      const lastRound = round === ASSISTANT_LIMITS.maxRounds || forceFinal;
      // Chữ của vòng sau nối vào sau chữ đã có bằng "\n\n"; sự kiện text cũng phát đúng như vậy để hai bên khớp nhau
      let needsSeparator = answer.trim() !== "";
      const appendAnswer = (chunk: string) => {
        answer += chunk;
        emit({ type: "text", delta: chunk });
      };
      const onContent = (delta: string) => {
        if (!delta) return;
        if (needsSeparator && delta.trim()) {
          needsSeparator = false;
          appendAnswer("\n\n");
        }
        appendAnswer(delta);
      };

      let completion: GatewayCompletion;
      try {
        completion = await deps.callGateway(lastRound ? toTextOnlyMessages(messages, FINAL_ROUND_NOTE) : messages, {
          tools: lastRound ? undefined : deps.toolDefinitions,
          outputTokens: ASSISTANT_LIMITS.outputTokens,
          signal: turn.signal,
          timeoutMs: Math.max(1, Math.min(roundTimeoutMs, turnDeadline - Date.now())),
          onThinking: (delta) => emit({ type: "thinking", delta }),
          onContent,
          onToolCallStart: (name) => {
            if (isProposalCall({ name })) emit({ type: "proposal_started" });
          },
          config,
          subject: "Trợ lý",
        });
      } catch (error) {
        if (!lastRound && error instanceof ApiError && error.code === "AGENT_TOOL_CONTRACT" && !clientAborted() && !turnExpired()) {
          forceFinal = true;
          continue;
        }
        if (clientAborted()) {
          status = "aborted";
        } else {
          status = "error";
          if (turnExpired()) {
            errorEvent = { code: "AGENT_TIMEOUT", message: TURN_TIMEOUT_MESSAGE };
          } else if (error instanceof ApiError) {
            errorEvent = { code: error.code, message: error.message };
          } else {
            errorEvent = { code: "AGENT_UNAVAILABLE", message: UNAVAILABLE_MESSAGE };
          }
        }
        break;
      }

      if (clientAborted()) {
        status = "aborted";
        break;
      }
      // Không có tool call (kể cả finish_reason "tool_calls" mà danh sách rỗng) hoặc đã tới vòng cuối: kết thúc lượt
      if (lastRound || completion.toolCalls.length === 0) {
        // Mô hình dừng vì hết độ dài: giữ phần chữ đã có nhưng không lưu như một trả lời hoàn tất
        if (completion.finishReason === "length") {
          status = "error";
          errorEvent = { code: "AGENT_TRUNCATED", message: TRUNCATED_MESSAGE };
        }
        break;
      }

      // Tool call không có id thì đặt id theo vòng và thứ tự; id trùng trong cùng vòng thì đặt lại thành `<id>_<thứ tự>`.
      // Cùng id dùng cho tin assistant lẫn tin tool, nên mô hình không nhận hai kết quả cùng một tool_call_id.
      const usedIds = new Set<string>();
      const calls = completion.toolCalls.map((call, index) => {
        const base = call.id || `call_${round}_${index + 1}`;
        let id = base;
        for (let n = index + 1; usedIds.has(id); n++) id = `${base}_${n}`;
        usedIds.add(id);
        return { ...call, id };
      });
      messages.push(toAssistantToolCallMessage(completion.content, calls));

      // Đề xuất không đọc dữ liệu: không tính vào trần công cụ mỗi vòng (giới hạn riêng maxProposalsPerTurn)
      const batch: typeof calls = [];
      const overflow: typeof calls = [];
      let readCalls = 0;
      for (const call of calls) {
        if (isProposalCall(call) || readCalls++ < ASSISTANT_LIMITS.maxToolCallsPerRound) batch.push(call);
        else overflow.push(call);
      }
      // Cả batch vẫn chạy song song; kết quả đọc dữ liệu chỉ được gửi theo thứ tự gọi khi còn trong ngân sách của cả lượt
      const runs = await Promise.all(
        batch.map((call) => (budgetUsed && !isProposalCall(call) ? null : runToolSafely(deps, call, toolCtx, turn.signal))),
      );
      for (const [index, call] of batch.entries()) {
        let run = runs[index];
        const proposalCall = isProposalCall(call);
        // Kết quả vượt phần còn lại không gửi cho mô hình, không thêm bước và nguồn của nó
        if (!run || (!proposalCall && (budgetUsed || toolChars + run.content.length > ASSISTANT_LIMITS.maxToolCharsPerTurn))) {
          budgetUsed = true;
          messages.push({ role: "tool", tool_call_id: call.id, content: TOOL_BUDGET_CONTENT });
          continue;
        }
        if (run.proposal && proposals.length >= ASSISTANT_LIMITS.maxProposalsPerTurn) {
          run = { ...run, ok: false, proposal: undefined, content: PROPOSAL_LIMIT_CONTENT, step: { ...run.step, ok: false } };
        }
        if (!proposalCall) {
          toolChars += run.content.length;
          budgetUsed = toolChars >= ASSISTANT_LIMITS.maxToolCharsPerTurn;
        }
        emit({ type: "step", step: run.step });
        steps.push(run.step);
        messages.push({ role: "tool", tool_call_id: call.id, content: run.content });
        if (run.ok) {
          read.push(...run.sources);
          if (run.detailed) detailed.push(...run.sources);
          // Thẻ đề xuất hiện ngay dưới bước của nó và lưu cùng tin trả lời (mở lại cuộc vẫn còn)
          if (run.proposal) {
            proposals.push(run.proposal);
            emit({ type: "proposal", proposal: run.proposal });
          }
        }
      }
      for (const call of overflow) messages.push({ role: "tool", tool_call_id: call.id, content: TOO_MANY_TOOLS_CONTENT });
    }

    // Không có chữ trả lời: báo lỗi một lần qua sự kiện error (giao diện hiện ở khung lỗi), không chèn thêm chữ
    if (status === "complete" && !answer.trim()) {
      status = "error";
      errorEvent = { code: "EMPTY_ANSWER", message: EMPTY_ANSWER_MESSAGE };
    }

    // Tên thường xong trước câu trả lời (lượt có đọc dữ liệu); chưa xong thì chờ thêm một chút, rồi thôi báo
    if (titleTask && !clientAborted()) await settledWithin(titleTask, options.timeouts?.titleGraceMs ?? ASSISTANT_LIMITS.titleGraceMs);
    titleOpen = false;
    // Lưu tệp không bao giờ ném lỗi (saveTurnAttachments tự bắt); chờ xong để sự kiện tệp đứng trước `done`
    await savingAttachments;
    attachmentsOpen = false;

    const content = answer.trim();
    const sources = selectCitedSources(content, read, detailed);
    emit({ type: "sources", sources });
    const durationMs = Date.now() - startedAt;
    const saved = await appendMessage(conversation.id, {
      role: "assistant",
      content,
      status,
      sources,
      steps,
      proposals: proposals.map((proposal) => ({ proposal, task: null, dismissed: false })),
      durationMs,
    });
    progress.replySaved = true;
    if (errorEvent) emit({ type: "error", error: errorEvent, messageId: saved.id });
    emit({ type: "done", messageId: saved.id, status, durationMs });

    await recordTurnAudit(input, conversation.id, {
      status,
      rounds,
      durationMs,
      model: config.model,
      steps,
      refs: refsOf([...read, ...detailed]),
    });
  } finally {
    titleOpen = false;
    attachmentsOpen = false;
    clearTimeout(turnTimer);
    options.signal?.removeEventListener("abort", onClientAbort);
  }
}

/**
 * Đặt tên cuộc mới bằng mô hình và ghi khi người dùng chưa tự đổi tên. Không ném lỗi; lỗi chỉ log tên lỗi, không ghi câu
 * hỏi hay tên vào log.
 */
async function nameConversation(
  generate: typeof generateConversationTitle,
  conversation: AssistantConversation,
  input: AssistantTurnInput,
  described: DescribedContext | null,
  config: GatewayConfig,
  onTitled: (row: AssistantConversation) => void,
): Promise<void> {
  try {
    const title = await generate(
      {
        message: input.message,
        context: described ? contextLabel(described.source) : null,
        attachments: (input.attachments ?? []).map((attachment) => attachment.step),
      },
      config,
    );
    if (!title || title === conversation.title) return;
    const row = await applyGeneratedTitle(conversation.id, title);
    if (row) onTitled(row);
  } catch (error) {
    logger.warn("assistant.title.failed", { requestId: input.requestId, errorName: error instanceof Error ? error.name : "unknown" });
  }
}

/**
 * Lưu tệp mới của câu hỏi và gắn câu hỏi vào tệp đã lưu gửi lại; trả các tệp theo thứ tự gửi (tệp lưu lỗi bị bỏ).
 * Không ném lỗi.
 */
async function saveTurnAttachments(input: AssistantTurnInput, conversationId: string, messageId: string): Promise<AssistantAttachmentDTO[]> {
  const out: AssistantAttachmentDTO[] = [];
  try {
    const reused = (input.attachments ?? []).flatMap((attachment) => (attachment.storedId ? [attachment.storedId] : []));
    if (reused.length > 0) await linkAssistantAttachments(reused, messageId);
    for (const attachment of input.attachments ?? []) {
      if (attachment.storedId && attachment.name) {
        out.push(toAssistantAttachmentDTO({ id: attachment.storedId, originalName: attachment.name, byteSize: BigInt(attachment.bytes) }));
      } else if (attachment.name && attachment.data) {
        const stored = await storeAssistantAttachment({
          userId: input.userId,
          conversationId,
          messageId,
          name: attachment.name,
          data: attachment.data,
          requestId: input.requestId,
        });
        if (stored) out.push(stored);
      }
    }
  } catch (error) {
    logger.warn("assistant.attachment.save_failed", { requestId: input.requestId, errorName: error instanceof Error ? error.name : "unknown" });
  }
  return out;
}

/** Chờ `pending` xong hoặc hết `ms`, cái nào tới trước; không ném lỗi. */
async function settledWithin(pending: Promise<void>, ms: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([pending, new Promise<void>((resolve) => (timer = setTimeout(resolve, ms)))]);
  clearTimeout(timer);
}

/** Ghi audit của lượt. Lỗi ghi audit chỉ được log, không làm hỏng lượt đã lưu. */
async function recordTurnAudit(
  input: AssistantTurnInput,
  conversationId: string,
  detail: {
    status: AssistantMessageStatus;
    rounds: number;
    durationMs: number;
    model: string;
    steps: AssistantStep[];
    refs: Array<{ type: string; id: string }>;
  },
): Promise<void> {
  try {
    await logAuditEvent({
      actorId: input.userId,
      action: AuditAction.ASSISTANT_TURN,
      entityType: AuditEntityType.ASSISTANT_CONVERSATION,
      entityId: conversationId,
      requestId: input.requestId,
      metadata: {
        status: detail.status,
        rounds: detail.rounds,
        durationMs: detail.durationMs,
        model: detail.model,
        tools: detail.steps.filter((step) => step.tool !== "attachment").map(({ tool, ok, count }) => ({ tool, ok, count })),
        refs: detail.refs,
        // Chỉ loại và dung lượng, không ghi tên hay nội dung tệp
        ...(input.attachments?.length ? { attachments: input.attachments.map(({ kind, bytes }) => ({ kind, bytes })) } : {}),
      },
    });
  } catch {
    logger.warn("assistant.audit.failed", { requestId: input.requestId });
  }
}
