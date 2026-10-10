/**
 * Luồng duyệt nhiều bước của nhiệm vụ (T-05, D12, spec task-document-gap-spec.md).
 *
 * - Người giao (task.assign) lập luồng khi nhiệm vụ đang chờ duyệt: mỗi bước có người duyệt chính và tùy chọn
 *   người dự phòng. Bước chạy lần lượt; người dự phòng chỉ duyệt được khi bước đã chờ đủ 96 giờ (N4 vẫn áp dụng).
 * - Quyền duyệt đi qua các lệnh có sẵn (`review`, `approve`, `requestRevision`) vốn cần TaskActor REVIEWER.
 *   `syncStepReviewerActors` giữ đúng một dấu REVIEWER cho người của bước hiện tại (và người dự phòng khi đã tới
 *   hạn), đánh dấu bằng `notes` để gỡ khi bước qua đi hoặc luồng kết thúc, không đụng tới REVIEWER thủ công.
 * - Khi luồng đang chạy, lệnh duyệt không gửi `stepId` được tự gắn vào bước hiện tại.
 */
import { z } from "zod";
import { ApprovalProcessStatus, ApprovalStepStatus, TaskActorRole, TaskStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditService, AuditAction, AuditEntityType } from "@/lib/db/audit";
import { publishOutboxEvent, OutboxEventType, OutboxAggregateType } from "@/lib/db/outbox";
import type { SessionPayload } from "@/lib/jwt-session";
import { ConflictError, InvalidTransitionError, ValidationError } from "@/server/api/errors";
import { BACKUP_REJECTION_MESSAGE, checkBackupCandidate, isBackupDue } from "@/domain/tasks/backup-reviewer-rules";
import { initiateApprovalProcess, stepWaitingSince } from "@/lib/services/task-actor-service";
import { authorizeOnTask, can } from "./authorize-on-task";

type Db = Prisma.TransactionClient | typeof prisma;

export const MAX_APPROVAL_STEPS = 5;
const STEP_ACTOR_NOTE = "Bước duyệt:";

export const DefineApprovalProcessSchema = z
  .object({
    steps: z
      .array(
        z
          .object({
            title: z.string().trim().min(1, "Cần đặt tên bước").max(255),
            reviewerUserId: z.string().trim().min(1),
            backupReviewerUserId: z.string().trim().min(1).nullable().optional(),
          })
          .strict()
      )
      .min(1, "Cần ít nhất một bước")
      .max(MAX_APPROVAL_STEPS, `Tối đa ${MAX_APPROVAL_STEPS} bước`),
  })
  .strict();
export type DefineApprovalProcessInput = z.infer<typeof DefineApprovalProcessSchema>;

export interface ApprovalProcessView {
  process: {
    id: string;
    status: ApprovalProcessStatus;
    steps: Array<{
      id: string;
      order: number;
      title: string;
      status: ApprovalStepStatus;
      reviewer: { id: string; name: string } | null;
      backupReviewer: { id: string; name: string } | null;
      decidedAt: string | null;
      decisionNote: string | null;
      current: boolean;
      /** Đã chờ đủ 96 giờ nên người dự phòng duyệt được (chỉ có ý nghĩa ở bước hiện tại). */
      backupDue: boolean;
    }>;
  } | null;
  /** Người xem lập được luồng mới: có quyền giao, nhiệm vụ đang chờ duyệt và chưa có luồng đang chạy. */
  canDefine: boolean;
}

const stepInclude = {
  reviewerUser: { select: { id: true, name: true } },
  backupReviewerUser: { select: { id: true, name: true } },
} satisfies Prisma.TaskApprovalStepInclude;

function currentStepOf<T extends { stepOrder: number; status: ApprovalStepStatus }>(steps: T[]): T | null {
  return [...steps].sort((a, b) => a.stepOrder - b.stepOrder).find((s) => s.status === ApprovalStepStatus.PENDING) ?? null;
}

/** Bước đang chờ của luồng đang chạy, để các lệnh duyệt không gửi `stepId` vẫn đi đúng bước. */
export async function resolveActiveStepId(db: Db, taskId: string): Promise<string | null> {
  const process = await db.taskApprovalProcess.findFirst({
    where: { taskId, status: ApprovalProcessStatus.IN_REVIEW },
    orderBy: { createdAt: "desc" },
    include: { steps: true },
  });
  return process ? currentStepOf(process.steps)?.id ?? null : null;
}

export async function getApprovalProcess(session: SessionPayload, taskId: string, now = new Date()): Promise<ApprovalProcessView> {
  const task = await authorizeOnTask(session, taskId, "task.read");
  const process = await prisma.taskApprovalProcess.findFirst({
    where: { taskId },
    orderBy: { createdAt: "desc" },
    include: { steps: { orderBy: { stepOrder: "asc" }, include: stepInclude } },
  });
  const active = process?.status === ApprovalProcessStatus.IN_REVIEW;
  const canAssign = (await can(session, "task.assign", task)).allowed;
  const canDefine = canAssign && !task.archivedAt && task.status === TaskStatus.WAITING_APPROVAL && !active;
  if (!process) return { process: null, canDefine };
  const current = active ? currentStepOf(process.steps) : null;
  return {
    process: {
      id: process.id,
      status: process.status,
      steps: process.steps.map((s) => ({
        id: s.id,
        order: s.stepOrder,
        title: s.title,
        status: s.status,
        reviewer: s.reviewerUser,
        backupReviewer: s.backupReviewerUser,
        decidedAt: s.decidedAt?.toISOString() ?? null,
        decisionNote: s.decisionNote,
        current: current?.id === s.id,
        backupDue: current?.id === s.id && Boolean(s.backupReviewerUserId) && isBackupDue(stepWaitingSince(s, process.steps, process.createdAt), now),
      })),
    },
    canDefine,
  };
}

async function assertReviewerEligible(db: Db, taskId: string, userId: string, label: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { isActive: true } });
  if (!user || !user.isActive) throw new ValidationError(`${label} không tồn tại hoặc đã bị khóa`, undefined, "APPROVAL_USER_NOT_FOUND");
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: { actors: true, taskResults: { select: { submittedByUserId: true } }, deliverables: { select: { uploadedById: true } } },
  });
  if (!task) throw new ValidationError("Không tìm thấy nhiệm vụ");
  const rejected = checkBackupCandidate({
    candidateId: userId,
    creatorId: task.createdById,
    executorIds: task.actors.filter((a) => a.role === TaskActorRole.DRI || a.role === TaskActorRole.COLLABORATOR).map((a) => a.userId).filter((x): x is string => Boolean(x)),
    submitterIds: [...task.taskResults.map((r) => r.submittedByUserId), ...task.deliverables.map((d) => d.uploadedById)].filter((x): x is string => Boolean(x)),
    reviewerIds: [],
  });
  if (rejected) throw new ValidationError(`${label}: ${BACKUP_REJECTION_MESSAGE[rejected]}`, undefined, `APPROVAL_${rejected}`);
}

export async function defineApprovalProcess(session: SessionPayload, taskId: string, input: unknown): Promise<ApprovalProcessView> {
  const body = DefineApprovalProcessSchema.parse(input);
  const task = await authorizeOnTask(session, taskId, "task.assign");
  if (task.archivedAt || task.status !== TaskStatus.WAITING_APPROVAL) {
    throw new InvalidTransitionError("Chỉ lập luồng duyệt khi nhiệm vụ đang chờ duyệt", "APPROVAL_PROCESS_NOT_WAITING");
  }
  const running = await prisma.taskApprovalProcess.count({ where: { taskId, status: ApprovalProcessStatus.IN_REVIEW } });
  if (running > 0) throw new ConflictError("Nhiệm vụ đã có luồng duyệt đang chạy", "APPROVAL_PROCESS_RUNNING");

  for (const [index, step] of body.steps.entries()) {
    const label = `Bước ${index + 1}`;
    if (step.backupReviewerUserId && step.backupReviewerUserId === step.reviewerUserId) {
      throw new ValidationError(`${label}: người dự phòng phải khác người duyệt chính`, undefined, "APPROVAL_BACKUP_SAME");
    }
    await assertReviewerEligible(prisma, taskId, step.reviewerUserId, `${label}, người duyệt`);
    if (step.backupReviewerUserId) await assertReviewerEligible(prisma, taskId, step.backupReviewerUserId, `${label}, người dự phòng`);
  }

  const process = await initiateApprovalProcess(
    taskId,
    body.steps.map((s) => ({ title: s.title, reviewerUserId: s.reviewerUserId, backupReviewerUserId: s.backupReviewerUserId ?? undefined }))
  );
  await prisma.$transaction(async (tx) => {
    await auditService.logEvent(tx, {
      actorId: session.id,
      action: AuditAction.TASK_APPROVAL_PROCESS_DEFINED,
      entityType: AuditEntityType.TASK,
      entityId: taskId,
      beforeData: null,
      afterData: { processId: process.id, steps: body.steps },
    });
    await onApprovalStepAdvanced(tx, taskId, session.id);
  });
  return getApprovalProcess(session, taskId);
}

export interface SyncOutcome {
  /** Người dự phòng vừa được cấp quyền ở lần đồng bộ này (để báo cho họ). */
  backupActivated: { userId: string; stepId: string } | null;
}

/** Giữ dấu REVIEWER đúng cho người của bước hiện tại; gỡ dấu của bước đã qua hoặc luồng đã kết thúc. */
export async function syncStepReviewerActors(db: Db, taskId: string, now = new Date()): Promise<SyncOutcome> {
  const process = await db.taskApprovalProcess.findFirst({
    where: { taskId, status: ApprovalProcessStatus.IN_REVIEW },
    orderBy: { createdAt: "desc" },
    include: { steps: true },
  });
  const current = process ? currentStepOf(process.steps) : null;
  const wanted = new Map<string, string>(); // userId -> stepId
  let backupUserId: string | null = null;
  if (process && current) {
    if (current.reviewerUserId) wanted.set(current.reviewerUserId, current.id);
    if (current.backupReviewerUserId && isBackupDue(stepWaitingSince(current, process.steps, process.createdAt), now)) {
      backupUserId = current.backupReviewerUserId;
      wanted.set(backupUserId, current.id);
    }
  }

  const marked = await db.taskActor.findMany({ where: { taskId, role: TaskActorRole.REVIEWER, notes: { startsWith: STEP_ACTOR_NOTE } } });
  for (const actor of marked) {
    if (!actor.userId || wanted.get(actor.userId) !== actor.notes?.slice(STEP_ACTOR_NOTE.length).trim()) {
      await db.taskActor.delete({ where: { id: actor.id } });
    }
  }
  const markedKeep = new Set(marked.filter((a) => a.userId && wanted.get(a.userId) === a.notes?.slice(STEP_ACTOR_NOTE.length).trim()).map((a) => a.userId as string));

  let backupActivated: SyncOutcome["backupActivated"] = null;
  for (const [userId, stepId] of wanted) {
    if (markedKeep.has(userId)) continue;
    const existing = await db.taskActor.count({ where: { taskId, userId, role: { in: [TaskActorRole.REVIEWER, TaskActorRole.APPROVER] } } });
    if (existing > 0) continue; // đã là người duyệt thủ công: không đụng tới
    await db.taskActor.create({ data: { taskId, userId, role: TaskActorRole.REVIEWER, notes: `${STEP_ACTOR_NOTE} ${stepId}` } });
    if (userId === backupUserId) backupActivated = { userId, stepId };
  }
  return { backupActivated };
}

/**
 * Gọi trong giao dịch sau khi luồng đổi bước (lập luồng, một bước được quyết): đồng bộ quyền và báo người
 * duyệt của bước hiện tại. Hết luồng thì chỉ gỡ quyền.
 */
export async function onApprovalStepAdvanced(tx: Prisma.TransactionClient, taskId: string, actorId: string | null) {
  await syncStepReviewerActors(tx, taskId);
  const process = await tx.taskApprovalProcess.findFirst({
    where: { taskId, status: ApprovalProcessStatus.IN_REVIEW },
    orderBy: { createdAt: "desc" },
    include: { steps: true },
  });
  const current = process ? currentStepOf(process.steps) : null;
  if (!process || !current?.reviewerUserId) return;
  await publishOutboxEvent(tx, {
    eventType: OutboxEventType.TASK_REMINDER_NOTIFICATION,
    aggregateType: OutboxAggregateType.TASK,
    aggregateId: taskId,
    payload: {
      taskId,
      recipientIds: [current.reviewerUserId],
      remindedById: actorId,
      message: `Đến lượt bạn duyệt: ${current.title} (bước ${current.stepOrder}/${process.steps.length})`,
    },
  });
}

/** Người yêu cầu làm lại đóng luồng đang chạy: bước hiện tại ghi là bị trả lại. */
export async function closeActiveProcessOnRevision(tx: Prisma.TransactionClient, taskId: string, actorId: string, reason: string) {
  const processes = await tx.taskApprovalProcess.findMany({ where: { taskId, status: ApprovalProcessStatus.IN_REVIEW }, include: { steps: true } });
  for (const process of processes) {
    const current = currentStepOf(process.steps);
    if (current) {
      await tx.taskApprovalStep.update({
        where: { id: current.id },
        data: { status: ApprovalStepStatus.REJECTED, decidedAt: new Date(), decisionNote: reason, reviewerUserId: current.reviewerUserId ?? actorId },
      });
    }
    await tx.taskApprovalProcess.update({ where: { id: process.id }, data: { status: ApprovalProcessStatus.REJECTED } });
  }
  if (processes.length > 0) await syncStepReviewerActors(tx, taskId);
}

