/**
 * Xin gia hạn nhiệm vụ (T-01, spec task-document-gap-spec.md).
 *
 * - Người thực hiện chính xin (task.request_extension) khi nhiệm vụ chưa bắt đầu hoặc đang
 *   thực hiện; hạn mới sau hạn hiện tại; mỗi nhiệm vụ một yêu cầu đang mở.
 * - Người giao (task.decide_extension) đồng ý, từ chối (lý do bắt buộc) hoặc đề xuất hạn khác.
 *   Người xin không tự quyết định yêu cầu của mình (ADR-001).
 * - Đề xuất hạn khác: người xin nhận hoặc không nhận. Hạn chỉ đổi khi đồng ý hoặc khi nhận.
 * - Đổi hạn tăng version nhiệm vụ, ghi audit trong cùng transaction; thông báo đi qua outbox.
 */
import { z } from "zod";
import { ExtensionRequestStatus, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditService, AuditAction, AuditEntityType } from "@/lib/db/audit";
import { publishOutboxEvent, OutboxEventType, OutboxAggregateType } from "@/lib/db/outbox";
import type { SessionPayload } from "@/lib/jwt-session";
import {
  ConflictError,
  InvalidTransitionError,
  NotFoundError,
  PreconditionFailedError,
  ValidationError,
} from "@/server/api/errors";
import { ForbiddenError } from "@/server/api/errors";
import { SeparationOfDutiesError } from "@/server/authorization/errors";
import {
  EXTENSION_DATE_ERROR_MESSAGE,
  EXTENSION_REQUESTABLE_STATUSES,
  formatDueDateVi,
  isRepeatedExtension,
  parseDueDateInput,
  validateRequestedDueDate,
} from "@/domain/tasks/extension-rules";
import { authorizeOnTask, can, loadTaskWithActors } from "./authorize-on-task";

const DUE_DATE_INPUT = z.union([z.string().trim().min(1), z.date()]);
const REASON = z.string().trim().min(3, "Lý do tối thiểu 3 ký tự").max(1000, "Lý do tối đa 1000 ký tự");

export const RequestExtensionSchema = z
  .object({
    requestedDueDate: DUE_DATE_INPUT,
    reason: REASON,
    expectedVersion: z.number().int().min(0),
  })
  .strict();

export const DecideExtensionSchema = z
  .object({
    requestId: z.string().trim().min(1),
    decision: z.enum(["APPROVE", "REJECT", "COUNTER", "ACCEPT", "DECLINE"]),
    newDueDate: DUE_DATE_INPUT.optional(),
    note: z.string().trim().max(1000).optional(),
    expectedVersion: z.number().int().min(0).optional(),
  })
  .strict();

export type RequestExtensionInput = z.infer<typeof RequestExtensionSchema>;
export type DecideExtensionInput = z.infer<typeof DecideExtensionSchema>;

const OPEN_STATUSES: ExtensionRequestStatus[] = [ExtensionRequestStatus.PENDING, ExtensionRequestStatus.COUNTERED];
const APPLIED_STATUSES: ExtensionRequestStatus[] = [ExtensionRequestStatus.APPROVED, ExtensionRequestStatus.ACCEPTED];

export interface ExtensionRequestDTO {
  id: string;
  status: ExtensionRequestStatus;
  requestedBy: { id: string; name: string };
  decidedBy: { id: string; name: string } | null;
  previousDueDate: string;
  requestedDueDate: string;
  counterDueDate: string | null;
  reason: string;
  decisionNote: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface TaskExtensionView {
  active: ExtensionRequestDTO | null;
  history: ExtensionRequestDTO[];
  /** Số lần gia hạn đã áp dụng cho nhiệm vụ. */
  appliedCount: number;
  canRequest: boolean;
  canDecide: boolean;
  canRespond: boolean;
  /** Đổi hạn trực tiếp được (người giao, trưởng đơn vị, lãnh đạo); người thực hiện phải xin gia hạn. */
  canChangeDeadlineDirectly: boolean;
  version: number;
  dueDate: string;
}

type RequestRow = Awaited<ReturnType<typeof loadRequest>>;

const USER_SELECT = { select: { id: true, name: true } } as const;

function loadRequest(id: string) {
  return prisma.taskExtensionRequest.findUnique({
    where: { id },
    include: { requestedBy: USER_SELECT, decidedBy: USER_SELECT },
  });
}

function toDTO(row: NonNullable<RequestRow>): ExtensionRequestDTO {
  return {
    id: row.id,
    status: row.status,
    requestedBy: { id: row.requestedBy.id, name: row.requestedBy.name },
    decidedBy: row.decidedBy ? { id: row.decidedBy.id, name: row.decidedBy.name } : null,
    previousDueDate: row.previousDueDate.toISOString(),
    requestedDueDate: row.requestedDueDate.toISOString(),
    counterDueDate: row.counterDueDate ? row.counterDueDate.toISOString() : null,
    reason: row.reason,
    decisionNote: row.decisionNote,
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
  };
}

function isTerminal(task: { status: TaskStatus; archivedAt: Date | null }): boolean {
  return task.status === TaskStatus.COMPLETED || task.status === TaskStatus.CANCELLED || Boolean(task.archivedAt);
}

async function parentDueDateOf(parentTaskId: string | null): Promise<Date | null> {
  if (!parentTaskId) return null;
  const parent = await prisma.task.findUnique({ where: { id: parentTaskId }, select: { dueDate: true } });
  return parent?.dueDate ?? null;
}

function requireDate(value: string | Date, label: string): Date {
  const date = parseDueDateInput(value);
  if (!date) throw new ValidationError(`${label} không hợp lệ`);
  return date;
}

function assertDateAllowed(current: Date, requested: Date, parentDue: Date | null) {
  const error = validateRequestedDueDate({ currentDueDate: current, requestedDueDate: requested, parentDueDate: parentDue });
  if (error) throw new ValidationError(EXTENSION_DATE_ERROR_MESSAGE[error]);
}

export async function getTaskExtensions(session: SessionPayload, taskId: string): Promise<TaskExtensionView> {
  const task = await authorizeOnTask(session, taskId, "task.read");
  const rows = await prisma.taskExtensionRequest.findMany({
    where: { taskId },
    include: { requestedBy: USER_SELECT, decidedBy: USER_SELECT },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const appliedCount = await prisma.taskExtensionRequest.count({ where: { taskId, status: { in: APPLIED_STATUSES } } });
  const activeRow = rows.find((r) => OPEN_STATUSES.includes(r.status)) ?? null;

  const open = !isTerminal(task);
  const canRequestCap = (await can(session, "task.request_extension", task)).allowed;
  const canDecideCap = activeRow?.status === "PENDING" && open && (await can(session, "task.decide_extension", task)).allowed;

  return {
    active: activeRow ? toDTO(activeRow) : null,
    history: rows.filter((r) => r.id !== activeRow?.id).map(toDTO),
    appliedCount,
    canRequest: canRequestCap && !activeRow && EXTENSION_REQUESTABLE_STATUSES.has(task.status) && !task.archivedAt,
    canDecide: Boolean(canDecideCap) && activeRow?.requestedById !== session.id,
    canRespond: Boolean(activeRow && activeRow.status === "COUNTERED" && activeRow.requestedById === session.id && open && canRequestCap),
    canChangeDeadlineDirectly: open && (await can(session, "task.assign", task)).allowed,
    version: task.version,
    dueDate: task.dueDate.toISOString(),
  };
}

export async function requestExtension(
  session: SessionPayload,
  taskId: string,
  input: RequestExtensionInput
): Promise<ExtensionRequestDTO & { version: number }> {
  const validated = RequestExtensionSchema.parse(input);
  const task = await authorizeOnTask(session, taskId, "task.request_extension");

  if (!EXTENSION_REQUESTABLE_STATUSES.has(task.status) || task.archivedAt) {
    throw new InvalidTransitionError("Chỉ xin gia hạn khi nhiệm vụ chưa bắt đầu hoặc đang thực hiện");
  }
  if (task.version !== validated.expectedVersion) {
    throw new PreconditionFailedError(
      `Task aggregate version conflict: expected version ${validated.expectedVersion}, current version ${task.version}`
    );
  }
  const requested = requireDate(validated.requestedDueDate, "Hạn mới");
  assertDateAllowed(task.dueDate, requested, await parentDueDateOf(task.parentTaskId));

  const open = await prisma.taskExtensionRequest.findFirst({ where: { taskId, status: { in: OPEN_STATUSES } } });
  if (open) throw new ConflictError("Nhiệm vụ đang có yêu cầu gia hạn chưa xử lý xong", "EXTENSION_ALREADY_OPEN");

  return prisma.$transaction(async (tx) => {
    // Khóa phiên bản nhiệm vụ để hai yêu cầu đồng thời không cùng được tạo.
    const bumped = await tx.task.updateMany({
      where: { id: taskId, version: validated.expectedVersion, archivedAt: null },
      data: { version: { increment: 1 } },
    });
    if (bumped.count !== 1) {
      throw new PreconditionFailedError(`Task aggregate version conflict: expected version ${validated.expectedVersion}`);
    }

    const row = await tx.taskExtensionRequest.create({
      data: {
        taskId,
        requestedById: session.id,
        previousDueDate: task.dueDate,
        requestedDueDate: requested,
        reason: validated.reason,
      },
      include: { requestedBy: USER_SELECT, decidedBy: USER_SELECT },
    });

    await auditService.logEvent(tx, {
      actorId: session.id,
      action: AuditAction.TASK_EXTENSION_REQUESTED,
      entityType: AuditEntityType.TASK,
      entityId: taskId,
      beforeData: { dueDate: task.dueDate.toISOString() },
      afterData: { requestId: row.id, requestedDueDate: requested.toISOString(), reason: validated.reason },
    });

    await publishOutboxEvent(tx, {
      eventType: OutboxEventType.TASK_EXTENSION_REQUESTED_NOTIFICATION,
      aggregateType: OutboxAggregateType.TASK,
      aggregateId: taskId,
      payload: { taskId, requestId: row.id, requestedById: session.id },
    });

    return { ...toDTO(row), version: validated.expectedVersion + 1 };
  });
}

interface Applied {
  version: number;
}

/** Áp dụng hạn mới cho nhiệm vụ: tăng version, đổi hạn, ghi audit, và nhãn "gia hạn nhiều lần" nếu có. */
async function applyNewDueDate(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  args: { session: SessionPayload; taskId: string; expectedVersion: number; from: Date; to: Date; requestId: string }
): Promise<Applied> {
  const updated = await tx.task.updateMany({
    where: { id: args.taskId, version: args.expectedVersion, archivedAt: null },
    data: { dueDate: args.to, version: { increment: 1 } },
  });
  if (updated.count !== 1) {
    throw new PreconditionFailedError(`Task aggregate version conflict: expected version ${args.expectedVersion}`);
  }
  await auditService.logEvent(tx, {
    actorId: args.session.id,
    action: AuditAction.TASK_DEADLINE_CHANGED,
    entityType: AuditEntityType.TASK,
    entityId: args.taskId,
    beforeData: { dueDate: args.from.toISOString() },
    afterData: { dueDate: args.to.toISOString(), requestId: args.requestId },
  });
  return { version: args.expectedVersion + 1 };
}

export async function decideExtension(
  session: SessionPayload,
  taskId: string,
  input: DecideExtensionInput
): Promise<ExtensionRequestDTO & { version: number }> {
  const validated = DecideExtensionSchema.parse(input);
  const task = await loadTaskWithActors(taskId);
  if (isTerminal(task)) {
    throw new InvalidTransitionError("Nhiệm vụ đã kết thúc nên không xử lý yêu cầu gia hạn");
  }

  const request = await prisma.taskExtensionRequest.findFirst({ where: { id: validated.requestId, taskId } });
  if (!request) throw new NotFoundError("Không tìm thấy yêu cầu gia hạn");

  const respondedByRequester = validated.decision === "ACCEPT" || validated.decision === "DECLINE";
  const needsVersion = validated.decision === "APPROVE" || validated.decision === "ACCEPT";
  if (needsVersion && validated.expectedVersion === undefined) {
    throw new ValidationError("Cần phiên bản mới nhất của nhiệm vụ để đổi hạn");
  }
  if (needsVersion && task.version !== validated.expectedVersion) {
    throw new PreconditionFailedError(
      `Task aggregate version conflict: expected version ${validated.expectedVersion}, current version ${task.version}`
    );
  }

  if (respondedByRequester) {
    // Chỉ người xin trả lời đề xuất hạn khác, và vẫn phải còn là người thực hiện chính.
    await authorizeOnTask(session, taskId, "task.request_extension");
    if (request.requestedById !== session.id) throw new ForbiddenError("Chỉ người xin gia hạn được trả lời đề xuất");
    if (request.status !== ExtensionRequestStatus.COUNTERED || !request.counterDueDate) {
      throw new ConflictError("Yêu cầu không ở trạng thái chờ trả lời đề xuất hạn khác", "EXTENSION_NOT_COUNTERED");
    }
  } else {
    await authorizeOnTask(session, taskId, "task.decide_extension");
    if (request.requestedById === session.id) {
      throw new SeparationOfDutiesError("Người xin gia hạn không tự quyết định yêu cầu của mình");
    }
    if (request.status !== ExtensionRequestStatus.PENDING) {
      throw new ConflictError("Yêu cầu gia hạn đã được xử lý", "EXTENSION_ALREADY_DECIDED");
    }
    if (validated.decision === "REJECT" && (validated.note ?? "").length < 3) {
      throw new ValidationError("Lý do từ chối bắt buộc, tối thiểu 3 ký tự");
    }
  }

  const parentDue = await parentDueDateOf(task.parentTaskId);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const claim = async (from: ExtensionRequestStatus, data: Parameters<typeof tx.taskExtensionRequest.updateMany>[0]["data"]) => {
      const res = await tx.taskExtensionRequest.updateMany({ where: { id: request.id, status: from }, data });
      if (res.count !== 1) throw new ConflictError("Yêu cầu gia hạn vừa được xử lý bởi người khác", "EXTENSION_ALREADY_DECIDED");
    };

    let version = task.version;
    let message = "";
    let notifyUserId: string = request.requestedById;
    let applied = false;

    switch (validated.decision) {
      case "APPROVE": {
        assertDateAllowed(task.dueDate, request.requestedDueDate, parentDue);
        await claim(ExtensionRequestStatus.PENDING, {
          status: ExtensionRequestStatus.APPROVED,
          decidedById: session.id,
          decidedAt: now,
          decisionNote: validated.note || null,
        });
        ({ version } = await applyNewDueDate(tx, {
          session,
          taskId,
          expectedVersion: validated.expectedVersion as number,
          from: task.dueDate,
          to: request.requestedDueDate,
          requestId: request.id,
        }));
        applied = true;
        message = `Đồng ý gia hạn đến ${formatDueDateVi(request.requestedDueDate)}`;
        break;
      }
      case "REJECT": {
        await claim(ExtensionRequestStatus.PENDING, {
          status: ExtensionRequestStatus.REJECTED,
          decidedById: session.id,
          decidedAt: now,
          decisionNote: validated.note || null,
        });
        message = `Từ chối gia hạn: ${validated.note}`;
        break;
      }
      case "COUNTER": {
        if (!validated.newDueDate) throw new ValidationError("Cần nhập hạn đề xuất");
        const counter = requireDate(validated.newDueDate, "Hạn đề xuất");
        assertDateAllowed(task.dueDate, counter, parentDue);
        if (counter.getTime() === request.requestedDueDate.getTime()) {
          throw new ValidationError("Hạn đề xuất trùng hạn đã xin; chọn Đồng ý");
        }
        await claim(ExtensionRequestStatus.PENDING, {
          status: ExtensionRequestStatus.COUNTERED,
          counterDueDate: counter,
          decidedById: session.id,
          decidedAt: now,
          decisionNote: validated.note || null,
        });
        message = `Đề xuất hạn khác: ${formatDueDateVi(counter)}`;
        break;
      }
      case "ACCEPT": {
        const counter = request.counterDueDate as Date;
        assertDateAllowed(task.dueDate, counter, parentDue);
        await claim(ExtensionRequestStatus.COUNTERED, { status: ExtensionRequestStatus.ACCEPTED, respondedAt: now });
        ({ version } = await applyNewDueDate(tx, {
          session,
          taskId,
          expectedVersion: validated.expectedVersion as number,
          from: task.dueDate,
          to: counter,
          requestId: request.id,
        }));
        applied = true;
        notifyUserId = request.decidedById ?? task.createdById;
        message = `Nhận hạn đề xuất ${formatDueDateVi(counter)}`;
        break;
      }
      case "DECLINE": {
        await claim(ExtensionRequestStatus.COUNTERED, { status: ExtensionRequestStatus.DECLINED, respondedAt: now });
        notifyUserId = request.decidedById ?? task.createdById;
        message = "Không nhận hạn đề xuất, giữ hạn cũ";
        break;
      }
    }

    await auditService.logEvent(tx, {
      actorId: session.id,
      action: AuditAction.TASK_EXTENSION_DECIDED,
      entityType: AuditEntityType.TASK,
      entityId: taskId,
      beforeData: { status: request.status },
      afterData: { requestId: request.id, decision: validated.decision, note: validated.note ?? null },
    });

    if (applied) {
      const appliedCount = await tx.taskExtensionRequest.count({ where: { taskId, status: { in: APPLIED_STATUSES } } });
      if (isRepeatedExtension(appliedCount)) {
        await auditService.logEvent(tx, {
          actorId: session.id,
          action: AuditAction.TASK_EXTENSION_REPEATED,
          entityType: AuditEntityType.TASK,
          entityId: taskId,
          beforeData: null,
          afterData: { requestId: request.id, appliedCount },
        });
      }
    }

    await publishOutboxEvent(tx, {
      eventType: OutboxEventType.TASK_EXTENSION_DECIDED_NOTIFICATION,
      aggregateType: OutboxAggregateType.TASK,
      aggregateId: taskId,
      payload: { taskId, requestId: request.id, actorId: session.id, notifyUserId, message },
    });

    const row = await tx.taskExtensionRequest.findUniqueOrThrow({
      where: { id: request.id },
      include: { requestedBy: USER_SELECT, decidedBy: USER_SELECT },
    });
    return { ...toDTO(row), version };
  });
}
