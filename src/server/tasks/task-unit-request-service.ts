/**
 * Giao việc sang đơn vị khác qua trưởng đơn vị (T-12, D06, spec task-document-gap-spec.md).
 *
 * Người dùng chỉ thêm được người phối hợp thuộc đơn vị chủ trì (xem `assertCollaboratorInLeadUnit`).
 * Muốn có người của đơn vị khác, người giao (task.assign) gửi yêu cầu cho đơn vị đó; trưởng đơn vị
 * (task.fulfill_unit_request, đúng đơn vị được yêu cầu) cử một người của đơn vị mình làm người phối hợp
 * hoặc từ chối kèm lý do. Người giao rút lại được khi còn chờ. Mỗi (nhiệm vụ, đơn vị) chỉ một yêu cầu chờ.
 */
import { z } from "zod";
import { AssignmentStatus, TaskActorRole, TaskStatus, TaskUnitRequestStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditService, AuditAction, AuditEntityType } from "@/lib/db/audit";
import { publishOutboxEvent, OutboxEventType, OutboxAggregateType } from "@/lib/db/outbox";
import type { SessionPayload } from "@/lib/jwt-session";
import { authorize, isExecutivePosition, isUnitLeaderPosition } from "@/server/authorization/authorization-engine";
import { loadAuthorizationContext } from "@/server/authorization/authorization-context-service";
import type { AuthorizationContext } from "@/server/authorization/authorization-context";
import { buildTaskResource } from "@/server/authorization/available-actions";
import { ConflictError, ForbiddenError, InvalidTransitionError, NotFoundError, ValidationError } from "@/server/api/errors";
import { authorizeOnTask, loadTaskWithActors } from "./authorize-on-task";

/** Mặc định đơn vị được yêu cầu có 3 ngày để trả lời. */
export const DEFAULT_RESPOND_IN_DAYS = 3;

export const CreateUnitRequestSchema = z
  .object({
    targetUnitId: z.string().trim().min(1),
    note: z.string().trim().max(1000).optional(),
    /** Số ngày đơn vị được yêu cầu có để trả lời; quá hạn thì nhắc trưởng đơn vị và báo người giao. */
    respondInDays: z.number().int().min(1).max(30).optional(),
  })
  .strict();

export const DecideUnitRequestSchema = z
  .object({
    requestId: z.string().trim().min(1),
    decision: z.enum(["ASSIGN", "DECLINE", "CANCEL"]),
    assigneeUserId: z.string().trim().min(1).optional(),
    note: z.string().trim().max(1000).optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.decision === "ASSIGN" && !v.assigneeUserId) ctx.addIssue({ code: "custom", message: "Cần chọn người của đơn vị để cử phối hợp", path: ["assigneeUserId"] });
    if (v.decision === "DECLINE" && (v.note?.length ?? 0) < 3) ctx.addIssue({ code: "custom", message: "Cần nêu lý do từ chối", path: ["note"] });
  });

export type CreateUnitRequestInput = z.infer<typeof CreateUnitRequestSchema>;
export type DecideUnitRequestInput = z.infer<typeof DecideUnitRequestSchema>;

const CLOSED: ReadonlySet<TaskStatus> = new Set([TaskStatus.COMPLETED, TaskStatus.CANCELLED]);

/** Đơn vị mà người dùng đang làm trưởng (hoặc lãnh đạo trường, được coi là trưởng mọi đơn vị). */
function ledUnits(ctx: AuthorizationContext): { all: boolean; unitIds: Set<string> } {
  const now = new Date();
  const unitIds = new Set<string>();
  let all = false;
  for (const pos of ctx.positions ?? []) {
    if (pos.effectiveTo && new Date(pos.effectiveTo) < now) continue;
    if (isExecutivePosition(pos.positionCode)) all = true;
    else if (pos.unitId && (pos.isLeadership || isUnitLeaderPosition(pos.positionCode))) unitIds.add(pos.unitId);
  }
  return { all, unitIds };
}

async function loadContext(session: SessionPayload) {
  return loadAuthorizationContext(session.id, new Date(), { useCache: true, ttlMs: 10_000 });
}

/** Người này làm được việc của trưởng đơn vị `unitId` không (capability + đúng đơn vị). */
function canFulfillFor(ctx: AuthorizationContext, task: Parameters<typeof buildTaskResource>[0], unitId: string): boolean {
  const led = ledUnits(ctx);
  if (!led.all && !led.unitIds.has(unitId)) return false;
  // Trưởng đơn vị hành động trong đơn vị mình: dựng tài nguyên với đơn vị đó để không vướng ranh giới đơn vị chủ trì.
  const resource = { ...buildTaskResource(task), leadUnitId: unitId, leadDepartmentId: unitId, departmentId: unitId };
  return authorize(ctx, "task.fulfill_unit_request", resource).allowed;
}

/** Người nhận có đang thuộc đơn vị (phân công hiệu lực) không. */
export async function isActiveMemberOfUnit(db: Pick<typeof prisma, "positionAssignment">, userId: string, unitId: string): Promise<boolean> {
  const now = new Date();
  const count = await db.positionAssignment.count({
    where: { userId, unitId, status: AssignmentStatus.ACTIVE, effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] },
  });
  return count > 0;
}

/**
 * Người phối hợp phải thuộc đơn vị chủ trì, trừ lãnh đạo trường hoặc người được ủy quyền giao việc
 * (cùng chính sách với tạo nhiệm vụ). Người khác đơn vị đi qua yêu cầu cho trưởng đơn vị.
 */
export async function assertCollaboratorInLeadUnit(session: SessionPayload, task: { leadUnitId: string | null }, collaboratorId: string) {
  if (!task.leadUnitId) return;
  const ctx = await loadAuthorizationContext(session.id);
  const isBgh = ctx.positions?.some((p) => isExecutivePosition(p.positionCode));
  const now = Date.now();
  const delegated = ctx.delegations?.some(
    (d) =>
      d.granteeUserId === session.id &&
      (d.action === "*" || d.action === "task.create" || d.action === "task.assign") &&
      d.status === "ACTIVE" &&
      d.revokedAt === null &&
      new Date(d.validFrom).getTime() <= now &&
      new Date(d.validUntil).getTime() >= now
  );
  if (isBgh || delegated) return;
  if (!(await isActiveMemberOfUnit(prisma, collaboratorId, task.leadUnitId))) {
    throw new ValidationError(
      "Người này không thuộc đơn vị chủ trì. Muốn có người của đơn vị khác, hãy gửi yêu cầu phối hợp cho trưởng đơn vị đó.",
      undefined,
      "CROSS_UNIT_REQUIRES_UNIT_HEAD"
    );
  }
}

export interface UnitRequestDTO {
  id: string;
  taskId: string;
  targetUnit: { id: string; name: string };
  requestedBy: { id: string; name: string };
  note: string | null;
  status: TaskUnitRequestStatus;
  assignee: { id: string; name: string } | null;
  decisionNote: string | null;
  createdAt: string;
  /** Hạn trả lời (ISO) và đã quá hạn chưa; chỉ có ý nghĩa khi yêu cầu còn chờ. */
  respondBy: string | null;
  overdue: boolean;
  /** Người xem là trưởng đơn vị được yêu cầu và yêu cầu còn chờ. */
  canFulfill: boolean;
  /** Người xem là người giao của yêu cầu còn chờ. */
  canCancel: boolean;
}

const include = {
  targetUnit: { select: { id: true, name: true } },
  requestedBy: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true } },
} satisfies Prisma.TaskUnitRequestInclude;

type Row = Prisma.TaskUnitRequestGetPayload<{ include: typeof include }>;

function toDTO(row: Row, ctx: AuthorizationContext, task: Parameters<typeof buildTaskResource>[0], viewerId: string): UnitRequestDTO {
  const pending = row.status === TaskUnitRequestStatus.PENDING;
  return {
    id: row.id,
    taskId: row.taskId,
    targetUnit: row.targetUnit,
    requestedBy: row.requestedBy,
    note: row.note,
    status: row.status,
    assignee: row.assignee,
    decisionNote: row.decisionNote,
    createdAt: row.createdAt.toISOString(),
    respondBy: row.respondBy?.toISOString() ?? null,
    overdue: pending && row.respondBy !== null && row.respondBy.getTime() < Date.now(),
    canFulfill: pending && canFulfillFor(ctx, task, row.targetUnitId),
    canCancel: pending && row.requestedById === viewerId,
  };
}

export async function listTaskUnitRequests(session: SessionPayload, taskId: string): Promise<{ requests: UnitRequestDTO[]; canRequest: boolean }> {
  const task = await authorizeOnTask(session, taskId, "task.read");
  const ctx = await loadContext(session);
  const rows = await prisma.taskUnitRequest.findMany({ where: { taskId }, include, orderBy: { createdAt: "desc" } });
  const canRequest =
    !CLOSED.has(task.status) && !task.archivedAt && authorize(ctx, "task.assign", buildTaskResource(task)).allowed;
  return { requests: rows.map((r) => toDTO(r, ctx, task, session.id)), canRequest };
}

/** Yêu cầu đang chờ gửi cho các đơn vị người xem làm trưởng; kèm thông tin nhiệm vụ tối thiểu để quyết định. */
export async function listUnitRequestInbox(session: SessionPayload) {
  const ctx = await loadContext(session);
  const led = ledUnits(ctx);
  if (!led.all && led.unitIds.size === 0) return [];
  const rows = await prisma.taskUnitRequest.findMany({
    where: { status: TaskUnitRequestStatus.PENDING, ...(led.all ? {} : { targetUnitId: { in: [...led.unitIds] } }) },
    include: { ...include, task: { select: { id: true, code: true, title: true, dueDate: true, leadUnit: { select: { name: true } } } } },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  return rows.map((r) => ({
    id: r.id,
    taskId: r.taskId,
    task: { code: r.task.code, title: r.task.title, dueDate: r.task.dueDate.toISOString(), leadUnitName: r.task.leadUnit?.name ?? null },
    targetUnit: r.targetUnit,
    requestedBy: r.requestedBy,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
    respondBy: r.respondBy?.toISOString() ?? null,
    overdue: r.respondBy !== null && r.respondBy.getTime() < Date.now(),
  }));
}

export async function createTaskUnitRequest(session: SessionPayload, taskId: string, input: unknown): Promise<UnitRequestDTO> {
  const body = CreateUnitRequestSchema.parse(input);
  const task = await authorizeOnTask(session, taskId, "task.assign");
  if (CLOSED.has(task.status) || task.archivedAt) throw new InvalidTransitionError("Nhiệm vụ đã kết thúc, không gửi yêu cầu phối hợp");
  if (body.targetUnitId === task.leadUnitId) throw new ValidationError("Đây là đơn vị chủ trì; thêm người phối hợp trực tiếp", undefined, "UNIT_REQUEST_LEAD_UNIT");
  const unit = await prisma.organizationalUnit.findUnique({ where: { id: body.targetUnitId }, select: { id: true, status: true } });
  if (!unit || unit.status !== "ACTIVE") throw new NotFoundError("Đơn vị được yêu cầu không tồn tại hoặc đã ngừng hoạt động");

  const row = await prisma.$transaction(async (tx) => {
    // Khóa dòng nhiệm vụ để hai yêu cầu đồng thời không cùng qua bước kiểm tra "chưa có yêu cầu chờ".
    await tx.$queryRaw`SELECT id FROM tasks WHERE id = ${taskId} FOR UPDATE`;
    const pending = await tx.taskUnitRequest.findFirst({ where: { taskId, targetUnitId: body.targetUnitId, status: TaskUnitRequestStatus.PENDING }, select: { id: true } });
    if (pending) throw new ConflictError("Đã có yêu cầu phối hợp đang chờ đơn vị này trả lời", "UNIT_REQUEST_PENDING");
    const created = await tx.taskUnitRequest.create({ data: { taskId, targetUnitId: body.targetUnitId, requestedById: session.id, note: body.note ?? null, respondBy: new Date(Date.now() + (body.respondInDays ?? DEFAULT_RESPOND_IN_DAYS) * 86_400_000) }, include });
    await auditService.logEvent(tx, {
      actorId: session.id,
      action: AuditAction.TASK_UNIT_REQUESTED,
      entityType: AuditEntityType.TASK,
      entityId: taskId,
      beforeData: null,
      afterData: { requestId: created.id, targetUnitId: body.targetUnitId },
    });
    await publishOutboxEvent(tx, {
      eventType: OutboxEventType.TASK_UNIT_REQUESTED_NOTIFICATION,
      aggregateType: OutboxAggregateType.TASK,
      aggregateId: taskId,
      payload: { taskId, requestId: created.id, requestedById: session.id, targetUnitId: body.targetUnitId },
    });
    return created;
  });
  const ctx = await loadContext(session);
  return toDTO(row, ctx, task, session.id);
}

export async function decideTaskUnitRequest(session: SessionPayload, taskId: string, input: unknown): Promise<UnitRequestDTO> {
  const body = DecideUnitRequestSchema.parse(input);
  const task = await loadTaskWithActors(taskId);
  const request = await prisma.taskUnitRequest.findFirst({ where: { id: body.requestId, taskId }, include });
  if (!request) throw new NotFoundError("Không tìm thấy yêu cầu phối hợp");
  const ctx = await loadContext(session);

  if (body.decision === "CANCEL") {
    if (request.requestedById !== session.id) throw new ForbiddenError("Chỉ người gửi yêu cầu mới rút lại được");
  } else if (!canFulfillFor(ctx, task, request.targetUnitId)) {
    // Không tiết lộ chi tiết nhiệm vụ cho người không phải trưởng đơn vị được yêu cầu.
    throw new ForbiddenError("Chỉ trưởng đơn vị được yêu cầu mới trả lời yêu cầu này");
  }
  if (request.status !== TaskUnitRequestStatus.PENDING) throw new ConflictError("Yêu cầu này đã được xử lý", "UNIT_REQUEST_CLOSED");
  if (CLOSED.has(task.status) || task.archivedAt) throw new InvalidTransitionError("Nhiệm vụ đã kết thúc");

  const status =
    body.decision === "ASSIGN" ? TaskUnitRequestStatus.ASSIGNED : body.decision === "DECLINE" ? TaskUnitRequestStatus.DECLINED : TaskUnitRequestStatus.CANCELLED;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM tasks WHERE id = ${taskId} FOR UPDATE`;
    const claim = await tx.taskUnitRequest.updateMany({
      where: { id: request.id, status: TaskUnitRequestStatus.PENDING },
      data: { status, decidedById: session.id, decidedAt: new Date(), decisionNote: body.note ?? null, assigneeUserId: body.decision === "ASSIGN" ? body.assigneeUserId : null },
    });
    if (claim.count !== 1) throw new ConflictError("Yêu cầu này đã được xử lý", "UNIT_REQUEST_CLOSED");

    if (body.decision === "ASSIGN") {
      const assigneeId = body.assigneeUserId!;
      const user = await tx.user.findUnique({ where: { id: assigneeId }, select: { isActive: true } });
      if (!user || !user.isActive) throw new ValidationError("Người được cử không tồn tại hoặc đã bị khóa", undefined, "UNIT_REQUEST_ASSIGNEE_INVALID");
      if (!(await isActiveMemberOfUnit(tx as unknown as typeof prisma, assigneeId, request.targetUnitId))) {
        throw new ValidationError("Người được cử phải thuộc đơn vị được yêu cầu", undefined, "UNIT_REQUEST_ASSIGNEE_NOT_IN_UNIT");
      }
      const existing = await tx.taskActor.findMany({ where: { taskId, userId: assigneeId } });
      const protectedRole = existing.find((a) => a.role !== TaskActorRole.COLLABORATOR && a.role !== TaskActorRole.FOLLOWER && a.role !== TaskActorRole.OBSERVER);
      if (protectedRole) throw new ValidationError("Người này đang giữ vai trò khác trên nhiệm vụ nên không thể cử làm người phối hợp", undefined, "UNIT_REQUEST_ASSIGNEE_ROLE");
      if (existing.some((a) => a.role === TaskActorRole.COLLABORATOR)) {
        // Đã là người phối hợp: không thêm dòng thứ hai.
      } else if (existing.length > 0) {
        await tx.taskActor.update({ where: { id: existing[0].id }, data: { role: TaskActorRole.COLLABORATOR, unitId: request.targetUnitId, assignedById: session.id } });
      } else {
        await tx.taskActor.create({ data: { taskId, userId: assigneeId, unitId: request.targetUnitId, role: TaskActorRole.COLLABORATOR, isPrimaryDRI: false, assignedById: session.id } });
      }
      await tx.task.update({ where: { id: taskId }, data: { version: { increment: 1 } } });
      await publishOutboxEvent(tx, {
        eventType: OutboxEventType.TASK_ASSIGNED_NOTIFICATION,
        aggregateType: OutboxAggregateType.TASK,
        aggregateId: taskId,
        payload: { taskId, assignedById: session.id, newAssigneeId: assigneeId, role: "COLLABORATOR" },
      });
    }

    await auditService.logEvent(tx, {
      actorId: session.id,
      action: AuditAction.TASK_UNIT_REQUEST_DECIDED,
      entityType: AuditEntityType.TASK,
      entityId: taskId,
      beforeData: { status: TaskUnitRequestStatus.PENDING },
      afterData: { requestId: request.id, status, assigneeUserId: body.assigneeUserId ?? null },
    });
    if (body.decision !== "CANCEL") {
      await publishOutboxEvent(tx, {
        eventType: OutboxEventType.TASK_UNIT_REQUEST_DECIDED_NOTIFICATION,
        aggregateType: OutboxAggregateType.TASK,
        aggregateId: taskId,
        payload: { taskId, requestId: request.id, decidedById: session.id, status },
      });
    }
    return tx.taskUnitRequest.findUniqueOrThrow({ where: { id: request.id }, include });
  });
  return toDTO(updated, ctx, task, session.id);
}
