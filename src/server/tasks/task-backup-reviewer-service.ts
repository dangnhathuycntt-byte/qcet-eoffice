/**
 * Người duyệt dự phòng của nhiệm vụ (T-05, D12, spec task-document-gap-spec.md).
 *
 * - Người giao (task.assign) chỉ định hoặc gỡ người dự phòng; người dự phòng chịu N4
 *   (không phải người tạo, người thực hiện, người nộp kết quả, người duyệt chính).
 * - Người dự phòng KHÔNG có quyền duyệt cho đến khi nhiệm vụ chờ duyệt đủ 96 giờ. Lúc đó bộ quét
 *   nhắc hạn (T-06) gọi `activateBackupReviewer`, thêm một TaskActor REVIEWER cho người này nên
 *   mọi chỗ kiểm quyền hiện có (authorize, availableActions) dùng được ngay mà không phải sửa.
 * - Hết đợt chờ duyệt (đã duyệt, trả lại, nộp lại) thì `revokeStaleBackupReviewers` gỡ quyền.
 *
 * Khác spec: cột nằm ở bảng riêng `task_backup_reviewers` theo nhiệm vụ, không ở
 * `TaskApprovalStep`, vì luồng duyệt thực tế chỉ dùng TaskActor REVIEWER/APPROVER và không
 * tạo TaskApprovalStep.
 */
import { z } from "zod";
import { TaskActorRole, TaskStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditService, AuditAction, AuditEntityType } from "@/lib/db/audit";
import type { SessionPayload } from "@/lib/jwt-session";
import { InvalidTransitionError, NotFoundError, ValidationError } from "@/server/api/errors";
import { BACKUP_REJECTION_MESSAGE, checkBackupCandidate, isBackupDue } from "@/domain/tasks/backup-reviewer-rules";
import { partitionTaskActorUserIds } from "@/domain/tasks/task-actor-roles";
import { authorizeOnTask, can } from "./authorize-on-task";

type Db = Prisma.TransactionClient | typeof prisma;

export const SetBackupReviewerSchema = z
  .object({ userId: z.string().trim().min(1).nullable() })
  .strict();
export type SetBackupReviewerInput = z.infer<typeof SetBackupReviewerSchema>;

export interface BackupReviewerView {
  backup: { userId: string; name: string; active: boolean } | null;
  canEdit: boolean;
}

const CLOSED: ReadonlySet<TaskStatus> = new Set([TaskStatus.COMPLETED, TaskStatus.CANCELLED]);

async function taskFacts(db: Db, taskId: string) {
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: {
      actors: true,
      taskResults: { select: { submittedByUserId: true } },
      deliverables: { select: { uploadedById: true } },
    },
  });
  if (!task) throw new NotFoundError("Không tìm thấy nhiệm vụ");
  const sets = partitionTaskActorUserIds(task.actors);
  return {
    task,
    executorIds: task.actors.filter((a) => a.role === TaskActorRole.DRI || a.role === TaskActorRole.COLLABORATOR).map((a) => a.userId).filter((x): x is string => Boolean(x)),
    submitterIds: [...task.taskResults.map((r) => r.submittedByUserId), ...task.deliverables.map((d) => d.uploadedById)].filter((x): x is string => Boolean(x)),
    reviewerIds: [...sets.reviewerIds, ...sets.approverIds],
  };
}

export async function getBackupReviewer(session: SessionPayload, taskId: string): Promise<BackupReviewerView> {
  const task = await authorizeOnTask(session, taskId, "task.read");
  const row = await prisma.taskBackupReviewer.findUnique({ where: { taskId }, include: { backupUser: { select: { id: true, name: true } } } });
  const canEdit = !CLOSED.has(task.status) && !task.archivedAt && (await can(session, "task.assign", task)).allowed;
  return {
    backup: row ? { userId: row.backupUser.id, name: row.backupUser.name, active: Boolean(row.activatedAt) } : null,
    canEdit,
  };
}

export async function setBackupReviewer(session: SessionPayload, taskId: string, input: SetBackupReviewerInput): Promise<BackupReviewerView> {
  const { userId } = SetBackupReviewerSchema.parse(input);
  const task = await authorizeOnTask(session, taskId, "task.assign");
  if (CLOSED.has(task.status) || task.archivedAt) {
    throw new InvalidTransitionError("Nhiệm vụ đã kết thúc, không chỉ định người duyệt dự phòng");
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.taskBackupReviewer.findUnique({ where: { taskId } });
    if (userId === null) {
      if (!existing) return;
      await revoke(tx, existing);
      await tx.taskBackupReviewer.delete({ where: { taskId } });
      await audit(tx, session.id, taskId, existing.backupUserId, null);
      return;
    }
    const candidate = await tx.user.findUnique({ where: { id: userId }, select: { id: true, isActive: true } });
    if (!candidate || !candidate.isActive) throw new ValidationError("Người dự phòng không tồn tại hoặc đã bị khóa", undefined, "BACKUP_USER_NOT_FOUND");
    const facts = await taskFacts(tx, taskId);
    const rejected = checkBackupCandidate({
      candidateId: userId,
      creatorId: facts.task.createdById,
      executorIds: facts.executorIds,
      submitterIds: facts.submitterIds,
      reviewerIds: facts.reviewerIds,
    });
    if (rejected) throw new ValidationError(BACKUP_REJECTION_MESSAGE[rejected], undefined, `BACKUP_${rejected}`);

    if (existing && existing.backupUserId === userId) return;
    // Đổi người: gỡ quyền của người cũ nếu đã kích hoạt, rồi chỉ định lại từ đầu.
    if (existing) await revoke(tx, existing);
    await tx.taskBackupReviewer.upsert({
      where: { taskId },
      create: { taskId, backupUserId: userId, designatedById: session.id },
      update: { backupUserId: userId, designatedById: session.id, actorId: null, activatedAt: null, activatedForSince: null },
    });
    await audit(tx, session.id, taskId, existing?.backupUserId ?? null, userId);
  });

  return getBackupReviewer(session, taskId);
}

async function audit(tx: Prisma.TransactionClient, actorId: string, taskId: string, from: string | null, to: string | null) {
  await auditService.logEvent(tx, {
    actorId,
    action: AuditAction.TASK_BACKUP_REVIEWER_SET,
    entityType: AuditEntityType.TASK,
    entityId: taskId,
    beforeData: { backupUserId: from },
    afterData: { backupUserId: to },
  });
}

/** Gỡ TaskActor REVIEWER đã thêm khi kích hoạt (nếu có) và xóa dấu kích hoạt. */
async function revoke(tx: Db, row: { id: string; actorId: string | null }) {
  if (row.actorId) await tx.taskActor.deleteMany({ where: { id: row.actorId } });
  await tx.taskBackupReviewer.update({ where: { id: row.id }, data: { actorId: null, activatedAt: null, activatedForSince: null } });
}

export type ActivationOutcome = "ACTIVATED" | "ALREADY_ACTIVE" | "NO_BACKUP" | "INELIGIBLE";

/**
 * Kích hoạt người dự phòng cho đợt chờ duyệt bắt đầu từ `waitingSince`. Gọi khi đã đủ 96 giờ.
 * Kiểm lại N4 tại thời điểm này vì người dự phòng có thể đã trở thành người thực hiện hay người nộp.
 */
export async function activateBackupReviewer(
  db: Db,
  taskId: string,
  waitingSince: Date,
  now: Date
): Promise<{ outcome: ActivationOutcome; userId?: string }> {
  const row = await db.taskBackupReviewer.findUnique({ where: { taskId } });
  if (!row) return { outcome: "NO_BACKUP" };
  if (row.activatedAt && row.activatedForSince?.getTime() === waitingSince.getTime()) return { outcome: "ALREADY_ACTIVE", userId: row.backupUserId };
  if (row.activatedAt) await revoke(db, row); // đợt chờ duyệt cũ

  const facts = await taskFacts(db, taskId);
  const rejected = checkBackupCandidate({
    candidateId: row.backupUserId,
    creatorId: facts.task.createdById,
    executorIds: facts.executorIds,
    submitterIds: facts.submitterIds,
    reviewerIds: facts.reviewerIds,
  });
  if (rejected) return { outcome: "INELIGIBLE", userId: row.backupUserId };

  // Ghi dấu kích hoạt trước bằng cập nhật có điều kiện: quét song song chỉ một bên thắng.
  const claim = await db.taskBackupReviewer.updateMany({
    where: { id: row.id, activatedAt: null },
    data: { activatedAt: now, activatedForSince: waitingSince },
  });
  if (claim.count !== 1) return { outcome: "ALREADY_ACTIVE", userId: row.backupUserId };
  const actor = await db.taskActor.create({
    data: {
      taskId,
      userId: row.backupUserId,
      role: TaskActorRole.REVIEWER,
      assignedById: row.designatedById,
      notes: "Người duyệt dự phòng, kích hoạt sau 96 giờ chờ duyệt",
    },
  });
  await db.taskBackupReviewer.update({ where: { id: row.id }, data: { actorId: actor.id } });
  await auditService.logEvent(db as Prisma.TransactionClient, {
    actorId: null,
    action: AuditAction.TASK_BACKUP_REVIEWER_ACTIVATED,
    entityType: AuditEntityType.TASK,
    entityId: taskId,
    beforeData: null,
    afterData: { backupUserId: row.backupUserId, waitingSince: waitingSince.toISOString() },
  });
  return { outcome: "ACTIVATED", userId: row.backupUserId };
}

/**
 * Đối soát một nhiệm vụ đang chờ duyệt từ `waitingSince`: gỡ quyền đã kích hoạt cho đợt chờ cũ
 * (đã nộp lại), và kích hoạt nếu đợt hiện tại đã đủ 96 giờ.
 */
export async function reconcileBackupReviewer(
  db: Db,
  taskId: string,
  waitingSince: Date,
  now: Date
): Promise<{ outcome: ActivationOutcome | "NOT_DUE"; userId?: string }> {
  const row = await db.taskBackupReviewer.findUnique({ where: { taskId } });
  if (!row) return { outcome: "NO_BACKUP" };
  if (row.activatedAt && row.activatedForSince?.getTime() !== waitingSince.getTime()) await revoke(db, row);
  if (!isBackupDue(waitingSince, now)) return { outcome: "NOT_DUE" };
  return activateBackupReviewer(db, taskId, waitingSince, now);
}

/** Gỡ quyền của người dự phòng đã kích hoạt khi nhiệm vụ không còn chờ duyệt. */
export async function revokeStaleBackupReviewers(db: Db, taskIds?: string[]): Promise<number> {
  const rows = await db.taskBackupReviewer.findMany({
    where: {
      activatedAt: { not: null },
      ...(taskIds ? { taskId: { in: taskIds } } : {}),
      task: { status: { not: TaskStatus.WAITING_APPROVAL } },
    },
    select: { id: true, actorId: true },
  });
  for (const row of rows) await revoke(db, row);
  return rows.length;
}
