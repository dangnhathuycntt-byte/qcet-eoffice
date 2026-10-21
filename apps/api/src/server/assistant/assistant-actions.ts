/**
 * Hành động ghi của Trợ lý, luôn qua bước duyệt (ADR-012).
 *
 * Mô hình chỉ soạn thẻ (`createPendingAction`, gọi từ công cụ propose_*), không thực hiện gì. Người dùng bấm nút trên thẻ (duyệt) thì
 * máy chủ thực hiện đúng nội dung đã lưu bằng service sẵn có với phiên của người dùng, nên quyền được kiểm lại lúc đó
 * như khi họ tự bấm trên giao diện. Client chỉ gửi quyết định (duyệt, bỏ qua, hoàn tác), không gửi nội dung hành động,
 * nên không giả được một hành động khác. Thẻ quá ASSISTANT_ACTION_TTL_HOURS thì hết hạn.
 *
 * Theo "Agents Rule of Two": Trợ lý đọc dữ liệu riêng tư và nội dung không tin cậy (văn bản, bình luận), nên quyền ghi
 * chỉ hợp lệ khi có người duyệt từng hành động.
 */
import type { AssistantAction, Prisma } from "@prisma/client";
import { TaskStatus } from "@prisma/client";
import {
  ASSISTANT_ACTION_TTL_HOURS,
  type AssistantActionDecision,
  type AssistantActionDTO,
  type AssistantActionKind,
  type AssistantActionStatus,
  type AssistantActionView,
} from "@qcet/contracts/assistant";
import { prisma } from "@qcet/db/prisma";
import { AuditAction, AuditEntityType, logAuditEvent } from "@qcet/db/audit";
import type { SessionPayload } from "@/lib/jwt-session";
import { ApiError, NotFoundError } from "@/server/api/errors";
import { logger } from "@/server/observability/logger";
import { createTaskComment, deleteTaskComment } from "@/server/tasks/task-comment-service";
import { taskDomainActionService } from "@/server/tasks/task-domain-actions";
import { addAssistantMemory, deleteAssistantMemory } from "@/server/assistant/assistant-profile";
import { MeetingService } from "@/server/services/meeting-service";

const ACTION_KINDS: readonly AssistantActionKind[] = ["task_comment", "task_status", "task_remind", "memory_save", "meeting_minutes"];
const STATUSES: readonly AssistantActionStatus[] = ["pending", "done", "rejected", "failed", "undone", "expired"];
/**
 * Loại hành động hoàn tác được sau khi đã thực hiện. Nhắc việc đã gửi thì không thu hồi được; đổi trạng thái cũng không,
 * vì luật chuyển trạng thái không cho người thực hiện quay lại (đang làm về chưa bắt đầu, chờ duyệt về đang làm chỉ người
 * duyệt được), nên nút Hoàn tác sẽ luôn lỗi. Biên bản cũng không: xóa dự thảo đưa cuộc họp về Đã họp và mất cả dự thảo cũ
 * nếu thẻ đã thay một dự thảo có sẵn.
 */
const UNDOABLE: ReadonlySet<AssistantActionKind> = new Set(["task_comment", "memory_save"]);
const FAILED_MESSAGE = "Chưa thực hiện được. Thầy/Cô thử lại hoặc làm trực tiếp trên màn hình.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function kindOf(row: Pick<AssistantAction, "kind">): AssistantActionKind | null {
  return (ACTION_KINDS as readonly string[]).includes(row.kind) ? (row.kind as AssistantActionKind) : null;
}

function statusOf(row: Pick<AssistantAction, "status">): AssistantActionStatus {
  return (STATUSES as readonly string[]).includes(row.status) ? (row.status as AssistantActionStatus) : "failed";
}

/** Nội dung thẻ lưu trong `payload`; bản ghi hỏng thì null (không hiện, không thực hiện được). */
function viewOf(row: Pick<AssistantAction, "kind" | "payload">): AssistantActionView | null {
  const kind = kindOf(row);
  return kind && isRecord(row.payload) && row.payload.kind === kind ? (row.payload as unknown as AssistantActionView) : null;
}

function isExpired(row: Pick<AssistantAction, "createdAt">, now: Date): boolean {
  return now.getTime() - row.createdAt.getTime() > ASSISTANT_ACTION_TTL_HOURS * 3_600_000;
}

export function toActionDTO(row: AssistantAction, now: Date = new Date()): AssistantActionDTO | null {
  const view = viewOf(row);
  if (!view) return null;
  const stored = statusOf(row);
  const status: AssistantActionStatus = stored === "pending" && isExpired(row, now) ? "expired" : stored;
  return {
    id: row.id,
    status,
    view,
    undoable: status === "done" && UNDOABLE.has(view.kind),
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
  };
}

/** Lưu thẻ chờ duyệt (gọi từ công cụ, sau khi đã kiểm người hỏi có quyền làm việc đó). */
export async function createPendingAction(input: {
  userId: string;
  conversationId: string;
  view: AssistantActionView;
}): Promise<AssistantActionDTO> {
  const row = await prisma.assistantAction.create({
    data: {
      userId: input.userId,
      conversationId: input.conversationId,
      kind: input.view.kind,
      payload: input.view as unknown as Prisma.InputJsonValue,
    },
  });
  return toActionDTO(row)!;
}

/** Gắn các thẻ của lượt vào tin trả lời vừa lưu, để mở lại cuộc vẫn thấy. Chỉ thẻ của chính người hỏi, chưa gắn. */
export async function linkActionsToMessage(userId: string, actionIds: string[], messageId: string): Promise<void> {
  if (actionIds.length === 0) return;
  await prisma.assistantAction.updateMany({ where: { id: { in: actionIds }, userId, messageId: null }, data: { messageId } });
}

/** Thẻ của các tin trả lời, theo mã tin (cũ trước). */
export async function listMessageActions(messageIds: string[], now: Date = new Date()): Promise<Map<string, AssistantActionDTO[]>> {
  const out = new Map<string, AssistantActionDTO[]>();
  if (messageIds.length === 0) return out;
  const rows = await prisma.assistantAction.findMany({
    where: { messageId: { in: messageIds } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  for (const row of rows) {
    const dto = toActionDTO(row, now);
    if (!dto || !row.messageId) continue;
    out.set(row.messageId, [...(out.get(row.messageId) ?? []), dto]);
  }
  return out;
}

/** Lỗi nghiệp vụ của service (không quyền, sai trạng thái, xung đột phiên bản) thành câu cho người dùng; lỗi lạ thì câu chung. */
function userMessageOf(error: unknown): string {
  if (error instanceof ApiError && error.statusCode < 500) return error.message.slice(0, 300);
  return FAILED_MESSAGE;
}

/** Thực hiện hành động đã duyệt bằng service với phiên của người dùng; trả dữ liệu để hoàn tác. */
async function execute(session: SessionPayload, view: AssistantActionView): Promise<Record<string, unknown>> {
  switch (view.kind) {
    case "task_comment": {
      const comment = await createTaskComment(session, view.task.id, { body: view.body });
      return { commentId: comment.id };
    }
    case "task_status": {
      const task = await prisma.task.findUnique({ where: { id: view.task.id }, select: { status: true, version: true } });
      if (!task) throw new NotFoundError("Không tìm thấy nhiệm vụ");
      // Trạng thái đã đổi từ lúc soạn: không chồng lên thay đổi của người khác
      if (task.status !== view.from) {
        throw new ApiError(409, "ACTION_STALE", "Trạng thái nhiệm vụ đã thay đổi từ lúc soạn. Thầy/Cô hỏi lại Trợ lý để soạn thẻ mới.");
      }
      await taskDomainActionService.updateStatus(session, view.task.id, {
        status: view.to as TaskStatus,
        expectedVersion: task.version,
      });
      return {};
    }
    case "task_remind": {
      const task = await prisma.task.findUnique({ where: { id: view.task.id }, select: { version: true } });
      if (!task) throw new NotFoundError("Không tìm thấy nhiệm vụ");
      await taskDomainActionService.remind(session, view.task.id, {
        message: view.message,
        urgency: "NORMAL",
        expectedVersion: task.version,
      });
      return {};
    }
    case "memory_save": {
      const memory = await addAssistantMemory(session.id, view.content, "assistant");
      return { memoryId: memory.id };
    }
    case "meeting_minutes": {
      const meeting = await prisma.meeting.findUnique({ where: { id: view.meeting.id }, select: { status: true, updatedAt: true } });
      if (!meeting) throw new NotFoundError("Không tìm thấy cuộc họp");
      // Cuộc họp đã đổi từ lúc soạn (có người vừa lưu, sửa hay duyệt biên bản): không lưu chồng lên
      if (meeting.status !== view.from || meeting.updatedAt.toISOString() !== view.baseUpdatedAt) {
        throw new ApiError(409, "ACTION_STALE", "Biên bản cuộc họp đã thay đổi từ lúc soạn. Thầy/Cô hỏi lại Trợ lý để soạn thẻ mới.");
      }
      await MeetingService.draftMinutes(view.meeting.id, { minutes: view.minutes }, session.id);
      return {};
    }
  }
}

/** Hoàn tác hành động đã thực hiện (chỉ loại trong UNDOABLE): xóa bình luận, xóa ghi nhớ. */
async function revert(session: SessionPayload, view: AssistantActionView, result: Record<string, unknown>): Promise<void> {
  if (view.kind === "task_comment") {
    await deleteTaskComment(session, view.task.id, String(result.commentId ?? ""));
  } else if (view.kind === "memory_save") {
    await deleteAssistantMemory(session.id, String(result.memoryId ?? ""));
  } else {
    throw new ApiError(409, "ACTION_NOT_UNDOABLE", "Hành động này không hoàn tác được.");
  }
}

/**
 * Duyệt, bỏ qua hoặc hoàn tác một thẻ của chính người gọi. Khóa bản ghi trong lúc quyết định để bấm hai lần không thực
 * hiện hai lần; service chạy ngoài transaction (có transaction riêng) nên trạng thái "đang thực hiện" được giữ bằng khóa.
 */
export async function decideAssistantAction(
  session: SessionPayload,
  actionId: string,
  decision: AssistantActionDecision,
  options: { requestId?: string; now?: Date } = {},
): Promise<AssistantActionDTO> {
  const now = options.now ?? new Date();
  const claimed = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM assistant_actions WHERE id = ${actionId} AND user_id = ${session.id} FOR UPDATE`;
    if (rows.length === 0) throw new NotFoundError("Không tìm thấy thẻ hành động.");
    const row = await tx.assistantAction.findUniqueOrThrow({ where: { id: actionId } });
    const view = viewOf(row);
    if (!view) throw new ApiError(409, "ACTION_INVALID", "Thẻ hành động không còn hợp lệ.");
    const status = statusOf(row);

    if (decision === "undo") {
      if (status !== "done" || !UNDOABLE.has(view.kind)) throw new ApiError(409, "ACTION_NOT_UNDOABLE", "Hành động này không hoàn tác được.");
      // Đánh dấu đang hoàn tác bằng chính trạng thái cuối; lỗi thì trả về "done"
      await tx.assistantAction.update({ where: { id: actionId }, data: { status: "undone", decidedAt: now } });
      return { row, view, run: "undo" as const };
    }
    if (status !== "pending") throw new ApiError(409, "ACTION_DECIDED", "Thẻ này đã được xử lý.");
    if (isExpired(row, now)) {
      // Ghi hết hạn rồi mới báo lỗi (sau khi transaction xong); ném trong transaction thì việc ghi bị hoàn lại
      await tx.assistantAction.update({ where: { id: actionId }, data: { status: "expired", decidedAt: now } });
      return { row, view, run: "expired" as const };
    }
    if (decision === "reject") {
      return { row: await tx.assistantAction.update({ where: { id: actionId }, data: { status: "rejected", decidedAt: now } }), view, run: null };
    }
    // Giữ chỗ trước khi thực hiện: lần bấm thứ hai thấy "done" và dừng ở trên
    await tx.assistantAction.update({ where: { id: actionId }, data: { status: "done", decidedAt: now } });
    return { row, view, run: "approve" as const };
  });

  if (!claimed.run) return toActionDTO(claimed.row, now)!;
  if (claimed.run === "expired") {
    throw new ApiError(409, "ACTION_EXPIRED", `Thẻ đã quá ${ASSISTANT_ACTION_TTL_HOURS} giờ nên hết hạn. Thầy/Cô hỏi lại Trợ lý để soạn thẻ mới.`);
  }

  let updated: AssistantAction;
  if (claimed.run === "approve") {
    try {
      const result = await execute(session, claimed.view);
      updated = await prisma.assistantAction.update({
        where: { id: actionId },
        data: { result: result as Prisma.InputJsonValue, error: null },
      });
    } catch (error) {
      logger.warn("assistant.action.failed", { requestId: options.requestId, metadata: { kind: claimed.view.kind, errorName: error instanceof Error ? error.name : "unknown" } });
      updated = await prisma.assistantAction.update({ where: { id: actionId }, data: { status: "failed", error: userMessageOf(error) } });
    }
  } else {
    try {
      await revert(session, claimed.view, isRecord(claimed.row.result) ? claimed.row.result : {});
      updated = await prisma.assistantAction.findUniqueOrThrow({ where: { id: actionId } });
    } catch (error) {
      // Hoàn tác không được: giữ trạng thái đã thực hiện, báo lý do
      await prisma.assistantAction.update({ where: { id: actionId }, data: { status: "done" } });
      throw error instanceof ApiError ? error : new ApiError(500, "ACTION_UNDO_FAILED", FAILED_MESSAGE);
    }
  }

  await recordActionAudit(session.id, updated, decision, options.requestId);
  return toActionDTO(updated, now)!;
}

/** Audit không chứa nội dung (chữ bình luận, lời nhắc, ghi nhớ): chỉ loại, kết quả và nhiệm vụ liên quan. */
async function recordActionAudit(userId: string, row: AssistantAction, decision: AssistantActionDecision, requestId?: string): Promise<void> {
  const view = viewOf(row);
  try {
    await logAuditEvent({
      actorId: userId,
      action: AuditAction.ASSISTANT_ACTION_DECIDED,
      entityType: AuditEntityType.ASSISTANT_CONVERSATION,
      entityId: row.conversationId,
      requestId,
      metadata: {
        actionId: row.id,
        kind: row.kind,
        decision,
        status: row.status,
        ...(view && "task" in view ? { taskId: view.task.id } : {}),
        ...(view && "meeting" in view ? { meetingId: view.meeting.id } : {}),
      },
    });
  } catch {
    logger.warn("assistant.action.audit_failed", { requestId });
  }
}
