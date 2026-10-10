/**
 * Từ chối nhận việc (T-02, spec task-document-gap-spec.md).
 *
 * ADR-003 không có trạng thái "từ chối", và nhiệm vụ không thể không có người phụ trách,
 * nên (quyết định Q1) người chủ trì giữ nguyên cho đến khi người giao giao lại. Từ chối chỉ:
 * ghi lý do, ghi Hoạt động và báo người giao. Chỉ từ chối được khi nhiệm vụ còn NOT_STARTED.
 */
import { z } from "zod";
import { TaskActorRole, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditService, AuditAction, AuditEntityType } from "@/lib/db/audit";
import { publishOutboxEvent, OutboxEventType, OutboxAggregateType } from "@/lib/db/outbox";
import type { SessionPayload } from "@/lib/jwt-session";
import { ConflictError, InvalidTransitionError, PreconditionFailedError } from "@/server/api/errors";
import { authorizeOnTask, can } from "./authorize-on-task";

export const DeclineTaskSchema = z
  .object({
    reason: z.string().trim().min(3, "Lý do tối thiểu 3 ký tự").max(1000, "Lý do tối đa 1000 ký tự"),
    expectedVersion: z.number().int().min(0),
  })
  .strict();

export type DeclineTaskInput = z.infer<typeof DeclineTaskSchema>;

export interface DeclineState {
  /** Thông báo từ chối còn hiệu lực: do người chủ trì hiện tại gửi, sau lần bổ nhiệm gần nhất. */
  declined: { by: { id: string; name: string }; reason: string; at: string } | null;
  canDecline: boolean;
  version: number;
}

/** Thông báo từ chối còn hiệu lực của nhiệm vụ (do chủ trì hiện tại gửi sau lần bổ nhiệm gần nhất). */
export async function findActiveDecline(taskId: string) {
  const dri = await prisma.taskActor.findFirst({
    where: { taskId, role: TaskActorRole.DRI, userId: { not: null } },
    orderBy: [{ isPrimaryDRI: "desc" }, { appointedAt: "desc" }],
  });
  if (!dri?.userId) return null;
  const notice = await prisma.taskDeclineNotice.findFirst({
    where: { taskId, userId: dri.userId, createdAt: { gte: dri.appointedAt } },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, name: true } } },
  });
  return notice;
}

export async function getDeclineState(session: SessionPayload, taskId: string): Promise<DeclineState> {
  const task = await authorizeOnTask(session, taskId, "task.read");
  const notice = await findActiveDecline(taskId);
  const canDeclineCap = (await can(session, "task.decline", task)).allowed;
  return {
    declined: notice
      ? { by: { id: notice.user.id, name: notice.user.name }, reason: notice.reason, at: notice.createdAt.toISOString() }
      : null,
    canDecline: canDeclineCap && task.status === TaskStatus.NOT_STARTED && !task.archivedAt && !notice,
    version: task.version,
  };
}

export async function declineTask(
  session: SessionPayload,
  taskId: string,
  input: DeclineTaskInput
): Promise<{ taskId: string; version: number }> {
  const validated = DeclineTaskSchema.parse(input);
  const task = await authorizeOnTask(session, taskId, "task.decline");

  if (task.status !== TaskStatus.NOT_STARTED || task.archivedAt) {
    throw new InvalidTransitionError("Chỉ từ chối nhận việc khi nhiệm vụ chưa bắt đầu");
  }
  if (task.version !== validated.expectedVersion) {
    throw new PreconditionFailedError(
      `Task aggregate version conflict: expected version ${validated.expectedVersion}, current version ${task.version}`
    );
  }
  if (await findActiveDecline(taskId)) {
    throw new ConflictError("Bạn đã từ chối nhận việc này; đang chờ người giao giao lại", "TASK_ALREADY_DECLINED");
  }

  return prisma.$transaction(async (tx) => {
    const bumped = await tx.task.updateMany({
      where: { id: taskId, version: validated.expectedVersion, archivedAt: null, status: TaskStatus.NOT_STARTED },
      data: { version: { increment: 1 } },
    });
    if (bumped.count !== 1) {
      throw new PreconditionFailedError(`Task aggregate version conflict: expected version ${validated.expectedVersion}`);
    }

    const notice = await tx.taskDeclineNotice.create({
      data: { taskId, userId: session.id, reason: validated.reason },
    });

    await auditService.logEvent(tx, {
      actorId: session.id,
      action: AuditAction.TASK_DECLINED,
      entityType: AuditEntityType.TASK,
      entityId: taskId,
      beforeData: null,
      afterData: { noticeId: notice.id, reason: validated.reason },
    });

    await publishOutboxEvent(tx, {
      eventType: OutboxEventType.TASK_DECLINED_NOTIFICATION,
      aggregateType: OutboxAggregateType.TASK,
      aggregateId: taskId,
      payload: { taskId, noticeId: notice.id, declinedById: session.id, reason: validated.reason },
    });

    return { taskId, version: validated.expectedVersion + 1 };
  });
}
