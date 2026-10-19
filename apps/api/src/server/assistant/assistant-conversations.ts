import { Prisma, type AssistantConversation, type AssistantMessage } from "@prisma/client";
import { prisma } from "@qcet/db/prisma";
import { AuditAction, AuditEntityType, logAuditEvent } from "@qcet/db/audit";
import { logger } from "@/server/observability/logger";
import { NotFoundError, ValidationError } from "@/server/api/errors";
import {
  ASSISTANT_CONTEXT_TYPES,
  ASSISTANT_RETENTION_DAYS,
  ASSISTANT_TOOL_NAMES,
  type AssistantContextRef,
  type AssistantContextType,
  type AssistantAttachmentDTO,
  type AssistantMessageProposalDTO,
  type AssistantConversationDetailDTO,
  type AssistantConversationListDTO,
  type AssistantConversationListQuery,
  type AssistantConversationSummaryDTO,
  type AssistantMessageDTO,
  type AssistantMessageRole,
  type AssistantMessageStatus,
  type AssistantProposalUpdateRequest,
  type AssistantSourceRef,
  type AssistantSourceType,
  type AssistantStep,
} from "@qcet/contracts/assistant";
import { retentionCutoff } from "@qcet/shared/domain/assistant/assistant-history";
import { normalizeTaskProposal } from "@qcet/shared/domain/assistant/assistant-task-proposal";
import { ProposeTaskArgs } from "@/server/assistant/assistant-tool-proposal";
import { listConversationAttachments, requestAssistantAttachmentPurges } from "@/server/assistant/assistant-attachments";

/** Số tin và ký tự gần nhất đưa lại cho mô hình trong một lượt (đặc tả W1-C). */
const HISTORY_MESSAGES = 12;
const HISTORY_CHARS = 16_000;

const SOURCE_TYPES: readonly string[] = ["task", "document", "meeting"];
const MESSAGE_STATUSES: readonly string[] = ["complete", "error", "aborted"];
const STEP_TOOLS: readonly string[] = [...ASSISTANT_TOOL_NAMES, "attachment", "unknown"];

/** Điều kiện chung: chỉ chủ nhân thấy, và tin cuối chưa quá hạn lưu giữ. */
function visibleScope(userId: string, now: Date): Prisma.AssistantConversationWhereInput {
  return { userId, lastMessageAt: { gte: retentionCutoff(now) } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Cột lưu dạng chuỗi tự do; giá trị lạ coi như không gắn ngữ cảnh. */
function toContextType(value: string | null): AssistantContextType | null {
  return (ASSISTANT_CONTEXT_TYPES as readonly string[]).includes(value ?? "") ? (value as AssistantContextType) : null;
}

function toContextRef(type: string | null, id: string | null): AssistantContextRef | null {
  const contextType = toContextType(type);
  return contextType && id ? { type: contextType, id } : null;
}

/** Bỏ phần tử sai dạng khi đọc JSON từ CSDL, không làm hỏng cả tin nhắn. */
function parseJsonList<T>(value: unknown, parse: (item: unknown) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  return value.map(parse).filter((item): item is T => item !== null);
}

function parseSourceRef(value: unknown): AssistantSourceRef | null {
  if (!isRecord(value)) return null;
  const { type, id, code, title, href } = value;
  if (typeof type !== "string" || !SOURCE_TYPES.includes(type)) return null;
  if (typeof id !== "string" || !id || typeof title !== "string" || typeof href !== "string") return null;
  // Link trong DTO chỉ được là đường dẫn nội bộ; href lạ (javascript:, URL ngoài) trong CSDL bị bỏ
  if (!href.startsWith("/") || href.startsWith("//")) return null;
  return { type: type as AssistantSourceType, id, code: typeof code === "string" ? code : null, title, href };
}

function parseStep(value: unknown): AssistantStep | null {
  if (!isRecord(value)) return null;
  const { tool, label, count, ok } = value;
  if (typeof tool !== "string" || !STEP_TOOLS.includes(tool)) return null;
  if (typeof label !== "string" || typeof ok !== "boolean") return null;
  if (count != null && (typeof count !== "number" || !Number.isFinite(count))) return null;
  return { tool: tool as AssistantStep["tool"], label, count: typeof count === "number" ? count : null, ok };
}

/** Thẻ đề xuất đọc từ CSDL: đề xuất phải qua lại đúng tham số của propose_task; nhiệm vụ đã tạo chỉ giữ id và mã. */
function parseProposal(value: unknown): AssistantMessageProposalDTO | null {
  if (!isRecord(value)) return null;
  const parsed = ProposeTaskArgs.safeParse(value.proposal);
  if (!parsed.success) return null;
  const { task } = value;
  const created =
    isRecord(task) && typeof task.id === "string" && task.id ? { id: task.id, code: typeof task.code === "string" ? task.code : null } : null;
  return { proposal: normalizeTaskProposal(parsed.data), task: created, dismissed: value.dismissed === true };
}

export function toConversationSummaryDTO(row: AssistantConversation): AssistantConversationSummaryDTO {
  const contextType = toContextType(row.contextType);
  return {
    id: row.id,
    title: row.title,
    titleEdited: row.titleEdited,
    contextType,
    // Loại lạ thì bỏ cả mã, để cặp (loại, mã) không bao giờ lệch nhau
    contextId: contextType ? row.contextId : null,
    createdAt: row.createdAt.toISOString(),
    lastMessageAt: row.lastMessageAt.toISOString(),
  };
}

/** `attachments`: tệp đã lưu của câu hỏi này (chỉ tin người dùng có). */
export function toMessageDTO(row: AssistantMessage, attachments: AssistantAttachmentDTO[] = []): AssistantMessageDTO {
  return {
    id: row.id,
    role: row.role === "user" ? "user" : "assistant",
    // Cột là chuỗi tự do; giá trị lạ (không xảy ra trong thực tế) hiển thị như trả lời thành công
    status: MESSAGE_STATUSES.includes(row.status) ? (row.status as AssistantMessageStatus) : "complete",
    content: row.content,
    sources: parseJsonList(row.sources, parseSourceRef),
    steps: parseJsonList(row.steps, parseStep),
    proposals: parseJsonList(row.proposals, parseProposal),
    ...(attachments.length > 0 ? { attachments } : {}),
    durationMs: row.durationMs ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Con trỏ phân trang: mốc `lastMessageAt` (ms) và id của tin cuối trang, mã hóa base64url. Mốc nằm trong con trỏ
 * nên cuộc đã xóa hay vừa có tin mới vẫn cho trang sau đúng, không tra lại CSDL.
 */
export function encodeConversationCursor(row: { lastMessageAt: Date; id: string }): string {
  return Buffer.from(`${row.lastMessageAt.getTime()}:${row.id}`).toString("base64url");
}

function decodeConversationCursor(cursor: string): { lastMessageAt: Date; id: string } {
  const match = /^(\d{1,15}):([\w-]{1,64})$/.exec(Buffer.from(cursor, "base64url").toString("utf8"));
  if (!match) throw new ValidationError("Con trỏ không hợp lệ");
  return { lastMessageAt: new Date(Number(match[1])), id: match[2] };
}

/** Danh sách theo thứ tự tin mới nhất; phân trang keyset theo (lastMessageAt, id) đã mã hóa trong con trỏ. */
export async function listConversations(
  userId: string,
  query: AssistantConversationListQuery,
  now: Date = new Date(),
): Promise<AssistantConversationListDTO> {
  const filters: Prisma.AssistantConversationWhereInput[] = [visibleScope(userId, now)];
  // Prisma không escape ký tự đại diện của LIKE: % và _ do người dùng gõ phải được coi là chữ thường
  if (query.q) filters.push({ title: { contains: query.q.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" } });
  if (query.contextType && query.contextId) filters.push({ contextType: query.contextType, contextId: query.contextId });
  if (query.cursor) {
    const anchor = decodeConversationCursor(query.cursor);
    filters.push({
      OR: [{ lastMessageAt: { lt: anchor.lastMessageAt } }, { lastMessageAt: anchor.lastMessageAt, id: { lt: anchor.id } }],
    });
  }

  const rows = await prisma.assistantConversation.findMany({
    where: { AND: filters },
    orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
  });
  const page = rows.slice(0, query.limit);
  return {
    items: page.map(toConversationSummaryDTO),
    nextCursor: rows.length > query.limit ? encodeConversationCursor(page[page.length - 1]) : null,
    retentionDays: ASSISTANT_RETENTION_DAYS,
  };
}

export async function getConversation(userId: string, id: string, now: Date = new Date()): Promise<AssistantConversation | null> {
  return prisma.assistantConversation.findFirst({ where: { id, ...visibleScope(userId, now) } });
}

/**
 * Chi tiết kèm tin nhắn theo thời gian tăng dần. Ngữ cảnh chỉ trả khi `resolveContext` còn đọc được mục đó;
 * lỗi tra cứu coi như mất quyền để không làm hỏng cả cuộc trò chuyện.
 */
export async function getConversationDetail(
  userId: string,
  id: string,
  resolveContext: (ref: AssistantContextRef) => Promise<AssistantSourceRef | null>,
  now: Date = new Date(),
): Promise<AssistantConversationDetailDTO | null> {
  const row = await prisma.assistantConversation.findFirst({
    where: { id, ...visibleScope(userId, now) },
    include: { messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
  });
  if (!row) return null;

  const attachments = await listConversationAttachments(userId, id);
  const ref = toContextRef(row.contextType, row.contextId);
  const context = ref
    ? await resolveContext(ref).catch(() => {
        logger.warn("assistant.context.resolve_failed", { conversationId: id });
        return null;
      })
    : null;
  return {
    ...toConversationSummaryDTO(row),
    messages: row.messages.map((message) => toMessageDTO(message, message.role === "user" ? attachments.get(message.id) : undefined)),
    context,
  };
}

export async function createConversation(
  userId: string,
  input: { title: string; context?: AssistantContextRef | null },
): Promise<AssistantConversation> {
  return prisma.assistantConversation.create({
    data: {
      userId,
      title: input.title,
      contextType: input.context?.type ?? null,
      contextId: input.context?.id ?? null,
    },
  });
}

export interface AppendMessageInput {
  role: AssistantMessageRole;
  content: string;
  status?: AssistantMessageStatus;
  sources?: AssistantSourceRef[];
  steps?: AssistantStep[];
  proposals?: AssistantMessageProposalDTO[];
  durationMs?: number | null;
}

/** Thêm tin và đặt `lastMessageAt` của cuộc trò chuyện cùng một thời điểm, trong một transaction. */
export async function appendMessage(conversationId: string, data: AppendMessageInput): Promise<AssistantMessage> {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const message = await tx.assistantMessage.create({
      data: {
        conversationId,
        role: data.role,
        content: data.content,
        status: data.status ?? "complete",
        // Cột JSON: truyền mảng đối tượng đã kiểm kiểu; ép kiểu vì interface không khớp chữ ký JSON của Prisma
        sources: data.sources ? (data.sources as unknown as Prisma.InputJsonValue) : undefined,
        steps: data.steps ? (data.steps as unknown as Prisma.InputJsonValue) : undefined,
        proposals: data.proposals?.length ? (data.proposals as unknown as Prisma.InputJsonValue) : undefined,
        durationMs: data.durationMs ?? null,
        createdAt: now,
      },
    });
    await tx.assistantConversation.update({ where: { id: conversationId }, data: { lastMessageAt: now } });
    return message;
  });
}

export interface ModelHistoryOptions {
  maxMessages?: number;
  maxChars?: number;
  /** Tin đang hỏi (đã ghi trước khi nạp lịch sử) không được đưa lại, nếu không câu hỏi sẽ gửi hai lần. */
  excludeMessageId?: string;
}

/** Lịch sử gửi cho mô hình: các tin gần nhất theo thời gian tăng dần, trong giới hạn số tin và ký tự. */
export async function loadModelHistory(
  conversationId: string,
  options: ModelHistoryOptions = {},
): Promise<Array<{ role: AssistantMessageRole; content: string }>> {
  return (await loadModelHistoryEntries(conversationId, options)).map(({ role, content }) => ({ role, content }));
}

/** Như `loadModelHistory`, kèm mã tin để lượt mới gắn lại tệp đã lưu vào đúng câu hỏi. */
export async function loadModelHistoryEntries(
  conversationId: string,
  options: ModelHistoryOptions = {},
): Promise<Array<{ id: string; role: AssistantMessageRole; content: string }>> {
  const maxMessages = options.maxMessages ?? HISTORY_MESSAGES;
  const maxChars = options.maxChars ?? HISTORY_CHARS;
  const rows = await prisma.assistantMessage.findMany({
    where: {
      conversationId,
      content: { not: "" },
      // Tin trả lời lỗi không đưa lại; tin bị dừng (aborted) giữ phần đã có
      NOT: [{ role: "assistant", status: "error" }],
      ...(options.excludeMessageId ? { id: { not: options.excludeMessageId } } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: maxMessages,
    select: { id: true, role: true, content: true },
  });

  const picked: Array<{ id: string; role: AssistantMessageRole; content: string }> = [];
  let chars = 0;
  // Rà từ mới về cũ: câu hỏi chỉ giữ khi tin trả lời ngay sau nó (mới hơn) đã được giữ, để không gửi hai tin user liền nhau
  let replyKept = false;
  for (const row of rows) {
    const keep: boolean = row.content.trim() !== "" && (row.role === "assistant" || replyKept);
    replyKept = keep && row.role === "assistant";
    if (!keep) continue;
    // Tin mới nhất đã vượt ngân sách thì dừng; các tin cũ hơn cũng bị bỏ
    if (chars + row.content.length > maxChars) break;
    chars += row.content.length;
    picked.push({ id: row.id, role: row.role === "user" ? "user" : "assistant", content: row.content });
  }
  return picked.reverse();
}

/**
 * Ghi trạng thái thẻ đề xuất thứ `index` của tin trả lời `messageId`: bỏ qua/hoàn tác, hoặc đã tạo nhiệm vụ. Tin phải
 * thuộc cuộc còn hạn của người gọi. Nhiệm vụ phải do chính người gọi tạo; mã nhiệm vụ lấy từ CSDL, không nhận từ client.
 * Không thấy tin, thẻ hay nhiệm vụ đều trả 404 như nhau.
 */
export async function updateMessageProposal(
  userId: string,
  messageId: string,
  change: AssistantProposalUpdateRequest,
  now: Date = new Date(),
): Promise<AssistantMessageProposalDTO> {
  return prisma.$transaction(async (tx) => {
    // Khóa dòng trước khi đọc: "Tạo tất cả" lưu nhiều thẻ của cùng tin liền nhau, đọc rồi ghi cả mảng mà không khóa thì
    // lần ghi sau đè mất thẻ vừa lưu
    await tx.$queryRaw`SELECT 1 FROM assistant_messages WHERE id = ${messageId} FOR UPDATE`;
    const row = await tx.assistantMessage.findFirst({
      where: { id: messageId, role: "assistant", conversation: visibleScope(userId, now) },
      select: { id: true, proposals: true },
    });
    // Thẻ hỏng bị bỏ khi đọc nên vị trí theo danh sách đã đọc, cùng danh sách giao diện đang hiện
    const items = row ? parseJsonList(row.proposals, parseProposal) : [];
    const current = items[change.index];
    if (!row || !current) throw new NotFoundError("Không tìm thấy đề xuất.");
    let next: AssistantMessageProposalDTO;
    if ("taskId" in change) {
      const task = await tx.task.findFirst({ where: { id: change.taskId, createdById: userId }, select: { id: true, code: true } });
      if (!task) throw new NotFoundError("Không tìm thấy nhiệm vụ.");
      next = { ...current, task: { id: task.id, code: task.code }, dismissed: false };
    } else {
      next = { ...current, dismissed: change.dismissed };
    }
    items[change.index] = next;
    await tx.assistantMessage.update({ where: { id: row.id }, data: { proposals: items as unknown as Prisma.InputJsonValue } });
    return next;
  });
}

/** Ghi tên do mô hình đặt khi người dùng chưa tự đổi tên; trả null nếu không ghi (đã đổi tên, cuộc đã xóa). */
export async function applyGeneratedTitle(conversationId: string, title: string): Promise<AssistantConversation | null> {
  const { count } = await prisma.assistantConversation.updateMany({
    where: { id: conversationId, titleEdited: false },
    data: { title },
  });
  return count === 0 ? null : prisma.assistantConversation.findUnique({ where: { id: conversationId } });
}

/** Đổi tên chỉ khi còn là cuộc của người gọi và chưa quá hạn; điều kiện nằm trong câu ghi nên không có cuộc đua với xóa. */
export async function renameConversation(userId: string, id: string, title: string): Promise<AssistantConversation | null> {
  const { count } = await prisma.assistantConversation.updateMany({
    where: { id, ...visibleScope(userId, new Date()) },
    data: { title, titleEdited: true },
  });
  if (count === 0) return null;
  return prisma.assistantConversation.findUnique({ where: { id } });
}

/**
 * Xóa cuộc trò chuyện (tin nhắn xóa theo khóa ngoại, tệp gửi kèm xóa qua outbox) và ghi audit chỉ kèm số tin, không kèm
 * tiêu đề hay nội dung.
 * Xóa đồng thời hai lần: lần sau đếm được 0 dòng và trả false (404), không ném lỗi và không ghi audit trùng.
 */
export async function deleteConversation(userId: string, id: string, requestId?: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const conversation = await tx.assistantConversation.findFirst({
      where: { id, ...visibleScope(userId, new Date()) },
      select: { _count: { select: { messages: true } } },
    });
    if (!conversation) return false;
    const { count } = await tx.assistantConversation.deleteMany({ where: { id, ...visibleScope(userId, new Date()) } });
    if (count === 0) return false;
    await requestAssistantAttachmentPurges(tx, [id], userId);
    await logAuditEvent(tx, {
      actorId: userId,
      action: AuditAction.ASSISTANT_CONVERSATION_DELETED,
      entityType: AuditEntityType.ASSISTANT_CONVERSATION,
      entityId: id,
      requestId: requestId ?? null,
      metadata: { messageCount: conversation._count.messages },
    });
    return true;
  });
}

/** Xóa hẳn các cuộc trò chuyện quá hạn lưu giữ (tin nhắn xóa theo khóa ngoại, tệp qua outbox). Trả về số cuộc đã xóa. */
export async function purgeExpiredConversations(now: Date = new Date(), days: number = ASSISTANT_RETENTION_DAYS): Promise<number> {
  const where = { lastMessageAt: { lt: retentionCutoff(now, days) } };
  return prisma.$transaction(async (tx) => {
    const expired = await tx.assistantConversation.findMany({ where, select: { id: true } });
    if (expired.length === 0) return 0;
    const ids = expired.map((row) => row.id);
    const { count } = await tx.assistantConversation.deleteMany({ where: { id: { in: ids }, ...where } });
    await requestAssistantAttachmentPurges(tx, ids, null);
    return count;
  });
}
