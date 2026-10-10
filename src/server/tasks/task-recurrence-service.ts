/**
 * Mẫu nhiệm vụ và nhiệm vụ lặp lại (T-09, Q9, spec task-document-gap-spec.md).
 *
 * - Mẫu thuộc một đơn vị: tiêu đề (có `{thang}`, `{nam}`, `{nam_hoc}`), mô tả, ưu tiên, ngày hạn trong
 *   tháng, tiêu chí hoàn thành và danh sách việc con.
 * - Nhiệm vụ lặp lại gắn một mẫu với người giao, chủ trì, phối hợp, người duyệt và chu kỳ theo tháng.
 *   Bộ quét `runTaskRecurrences` tạo nhiệm vụ của tháng hiện tại, mỗi (lặp lại, kỳ) đúng một lần nhờ
 *   ràng buộc duy nhất; nhiệm vụ sinh ra do chính người giao tạo, qua đúng đường `createTask`
 *   (kiểm quyền, cùng đơn vị, mã, nhật ký, thông báo giao việc).
 * - Quản lý mẫu, lặp lại cần quyền giao việc trong đơn vị của mẫu (`task.assign`: trưởng đơn vị, lãnh đạo).
 */
import { z } from "zod";
import { TaskActorRole, TaskScope, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditService, AuditAction } from "@/lib/db/audit";
import type { SessionPayload } from "@/lib/jwt-session";
import { getAcademicYear } from "@/lib/academic-calendar";
import { authorize } from "@/server/authorization/authorization-engine";
import { loadAuthorizationContext } from "@/server/authorization/authorization-context-service";
import { buildTaskResource } from "@/server/authorization/available-actions";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/api/errors";
import { logger } from "@/server/observability/logger";
import {
  RecurrenceBodySchema,
  TemplateBodySchema,
  dueDateForPeriod,
  isPeriodDue,
  periodKeyOf,
  renderTitle,
} from "@/domain/tasks/recurrence-rules";
import { taskCommandService } from "./task-command-service";

export { RecurrenceBodySchema, TemplateBodySchema };
export const TemplatePatchSchema = TemplateBodySchema.partial().extend({ isActive: z.boolean().optional() }).strict();
export const RecurrencePatchSchema = z
  .object({
    isActive: z.boolean().optional(),
    endPeriod: z.string().nullable().optional(),
    driUserId: z.string().trim().min(1).optional(),
    collaboratorIds: z.array(z.string().trim().min(1)).max(50).optional(),
    reviewerUserId: z.string().trim().min(1).nullable().optional(),
    retryFailed: z.boolean().optional(),
  })
  .strict();

export type TemplateBody = z.infer<typeof TemplateBodySchema>;
export type TemplatePatch = z.infer<typeof TemplatePatchSchema>;
export type RecurrenceBody = z.infer<typeof RecurrenceBodySchema>;
export type RecurrencePatch = z.infer<typeof RecurrencePatchSchema>;

type Db = Prisma.TransactionClient | typeof prisma;

/** Một mẫu chỉ được quản lý bởi người có quyền giao việc (`task.assign`: trưởng đơn vị, lãnh đạo) trong đơn vị đó. */
async function canManageUnit(session: SessionPayload, unitId: string): Promise<boolean> {
  const ctx = await loadAuthorizationContext(session.id, new Date(), { useCache: true, ttlMs: 10_000 });
  return authorize(ctx, "task.assign", buildTaskResource({ scope: TaskScope.DEPARTMENT, leadUnitId: unitId, scopeExplicit: true })).allowed;
}

async function assertCanManageUnit(session: SessionPayload, unitId: string) {
  if (!(await canManageUnit(session, unitId))) {
    throw new ForbiddenError("Chỉ trưởng đơn vị hoặc lãnh đạo mới quản lý mẫu nhiệm vụ của đơn vị");
  }
}

function audit(actorId: string, action: string, entityType: string, entityId: string, before: unknown, after: unknown) {
  return auditService.logEvent(prisma as unknown as Prisma.TransactionClient, {
    actorId,
    action,
    entityType,
    entityId,
    beforeData: before as Prisma.InputJsonValue,
    afterData: after as Prisma.InputJsonValue,
  });
}

// ---------------------------------------------------------------------------
// Mẫu
// ---------------------------------------------------------------------------

function templateDTO(t: { id: string; name: string; unitId: string; title: string; description: string | null; priority: string; dueDay: number; criteria: unknown; subtasks: unknown; isActive: boolean }) {
  return {
    id: t.id,
    name: t.name,
    unitId: t.unitId,
    title: t.title,
    description: t.description,
    priority: t.priority,
    dueDay: t.dueDay,
    criteria: (t.criteria as string[]) ?? [],
    subtasks: (t.subtasks as string[]) ?? [],
    isActive: t.isActive,
  };
}

export async function createTemplate(session: SessionPayload, input: unknown) {
  const body = TemplateBodySchema.parse(input);
  const unit = await prisma.organizationalUnit.findUnique({ where: { id: body.unitId }, select: { id: true } });
  if (!unit) throw new NotFoundError("Đơn vị không tồn tại");
  await assertCanManageUnit(session, body.unitId);
  const row = await prisma.taskTemplate.create({ data: { ...body, description: body.description ?? null, createdById: session.id } });
  await audit(session.id, AuditAction.TASK_TEMPLATE_CHANGED, "TaskTemplate", row.id, null, { name: row.name, unitId: row.unitId });
  return templateDTO(row);
}

export async function listTemplates(session: SessionPayload) {
  const rows = await prisma.taskTemplate.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }], take: 200 });
  const allowedUnits = new Map<string, boolean>();
  const result = [];
  for (const row of rows) {
    if (!allowedUnits.has(row.unitId)) allowedUnits.set(row.unitId, await canManageUnit(session, row.unitId));
    if (allowedUnits.get(row.unitId)) result.push(templateDTO(row));
  }
  return result;
}

export async function updateTemplate(session: SessionPayload, id: string, input: unknown) {
  const patch = TemplatePatchSchema.parse(input);
  const existing = await prisma.taskTemplate.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Không tìm thấy mẫu");
  await assertCanManageUnit(session, existing.unitId);
  if (patch.unitId && patch.unitId !== existing.unitId) {
    await assertCanManageUnit(session, patch.unitId);
    if (await prisma.taskRecurrence.count({ where: { templateId: id } })) {
      throw new ValidationError("Mẫu đã có lịch lặp lại nên không đổi đơn vị", undefined, "TEMPLATE_UNIT_LOCKED");
    }
  }
  const row = await prisma.taskTemplate.update({ where: { id }, data: { ...patch, description: patch.description === undefined ? undefined : patch.description } });
  await audit(session.id, AuditAction.TASK_TEMPLATE_CHANGED, "TaskTemplate", id, { name: existing.name, isActive: existing.isActive }, { name: row.name, isActive: row.isActive });
  return templateDTO(row);
}

// ---------------------------------------------------------------------------
// Lặp lại
// ---------------------------------------------------------------------------

async function assertPeople(db: Db, args: { creatorId: string; driUserId: string; collaboratorIds: string[]; reviewerUserId?: string | null }) {
  const ids = [...new Set([args.driUserId, ...args.collaboratorIds, ...(args.reviewerUserId ? [args.reviewerUserId] : [])])];
  const found = await db.user.findMany({ where: { id: { in: ids }, isActive: true }, select: { id: true } });
  if (found.length !== ids.length) throw new ValidationError("Một hoặc nhiều người được chỉ định không tồn tại hoặc đã bị khóa", undefined, "RECURRENCE_USER_NOT_FOUND");
  if (args.collaboratorIds.includes(args.driUserId)) throw new ValidationError("Người chủ trì không đồng thời là người phối hợp", undefined, "RECURRENCE_DRI_IS_COLLABORATOR");
  if (args.reviewerUserId) {
    // N4: người duyệt không phải người giao hay người thực hiện.
    const executors = [args.creatorId, args.driUserId, ...args.collaboratorIds];
    if (executors.includes(args.reviewerUserId)) {
      throw new ValidationError("Người duyệt không được là người giao hoặc người thực hiện", undefined, "RECURRENCE_REVIEWER_N4");
    }
  }
}

function recurrenceDTO(r: { id: string; templateId: string; createdById: string; driUserId: string; collaboratorIds: string[]; reviewerUserId: string | null; everyMonths: number; startPeriod: string; endPeriod: string | null; isActive: boolean }, runs: Array<{ periodKey: string; taskId: string | null; error: string | null }> = []) {
  const last = runs[0] ?? null;
  return {
    id: r.id,
    templateId: r.templateId,
    createdById: r.createdById,
    driUserId: r.driUserId,
    collaboratorIds: r.collaboratorIds,
    reviewerUserId: r.reviewerUserId,
    everyMonths: r.everyMonths,
    startPeriod: r.startPeriod,
    endPeriod: r.endPeriod,
    isActive: r.isActive,
    lastRun: last ? { periodKey: last.periodKey, taskId: last.taskId, error: last.error, status: last.taskId ? (last.error ? "PARTIAL" : "CREATED") : last.error ? "FAILED" : "CREATING" } : null,
  };
}

export async function createRecurrence(session: SessionPayload, input: unknown) {
  const body = RecurrenceBodySchema.parse(input);
  const template = await prisma.taskTemplate.findUnique({ where: { id: body.templateId } });
  if (!template) throw new NotFoundError("Không tìm thấy mẫu");
  if (!template.isActive) throw new ValidationError("Mẫu đã ngừng dùng", undefined, "TEMPLATE_INACTIVE");
  await assertCanManageUnit(session, template.unitId);
  await assertPeople(prisma, { creatorId: session.id, driUserId: body.driUserId, collaboratorIds: body.collaboratorIds, reviewerUserId: body.reviewerUserId });
  const row = await prisma.taskRecurrence.create({
    data: {
      templateId: body.templateId,
      createdById: session.id,
      driUserId: body.driUserId,
      collaboratorIds: body.collaboratorIds,
      reviewerUserId: body.reviewerUserId ?? null,
      everyMonths: body.everyMonths,
      startPeriod: body.startPeriod,
      endPeriod: body.endPeriod ?? null,
    },
  });
  await audit(session.id, AuditAction.TASK_RECURRENCE_CHANGED, "TaskRecurrence", row.id, null, { templateId: row.templateId, startPeriod: row.startPeriod, everyMonths: row.everyMonths });
  return recurrenceDTO(row);
}

export async function listRecurrences(session: SessionPayload, templateId?: string) {
  const rows = await prisma.taskRecurrence.findMany({
    where: templateId ? { templateId } : {},
    include: { template: { select: { unitId: true } }, runs: { orderBy: { periodKey: "desc" }, take: 1, select: { periodKey: true, taskId: true, error: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const allowed = new Map<string, boolean>();
  const result = [];
  for (const row of rows) {
    if (!allowed.has(row.template.unitId)) allowed.set(row.template.unitId, await canManageUnit(session, row.template.unitId));
    if (allowed.get(row.template.unitId)) result.push(recurrenceDTO(row, row.runs));
  }
  return result;
}

export async function updateRecurrence(session: SessionPayload, id: string, input: unknown, now = new Date()) {
  const patch = RecurrencePatchSchema.parse(input);
  const existing = await prisma.taskRecurrence.findUnique({ where: { id }, include: { template: { select: { unitId: true } } } });
  if (!existing) throw new NotFoundError("Không tìm thấy lịch lặp lại");
  await assertCanManageUnit(session, existing.template.unitId);
  if (patch.endPeriod && !/^\d{4}-(0[1-9]|1[0-2])$/.test(patch.endPeriod)) throw new ValidationError("Kỳ kết thúc phải có dạng YYYY-MM");
  if (patch.endPeriod && patch.endPeriod < existing.startPeriod) throw new ValidationError("Kỳ kết thúc không được trước kỳ bắt đầu");

  const next = {
    driUserId: patch.driUserId ?? existing.driUserId,
    collaboratorIds: patch.collaboratorIds ?? existing.collaboratorIds,
    reviewerUserId: patch.reviewerUserId === undefined ? existing.reviewerUserId : patch.reviewerUserId,
  };
  if (patch.driUserId || patch.collaboratorIds || patch.reviewerUserId !== undefined) {
    await assertPeople(prisma, { creatorId: existing.createdById, ...next });
  }
  await prisma.$transaction(async (tx) => {
    await tx.taskRecurrence.update({
      where: { id },
      data: { ...next, isActive: patch.isActive, endPeriod: patch.endPeriod === undefined ? undefined : patch.endPeriod },
    });
    if (patch.retryFailed) {
      // Xóa dòng lỗi của kỳ hiện tại để bộ quét tạo lại.
      await tx.taskRecurrenceRun.deleteMany({ where: { recurrenceId: id, periodKey: periodKeyOf(now), taskId: null, error: { not: null } } });
    }
  });
  await audit(session.id, AuditAction.TASK_RECURRENCE_CHANGED, "TaskRecurrence", id, { isActive: existing.isActive }, { ...patch });
  const row = await prisma.taskRecurrence.findUniqueOrThrow({ where: { id }, include: { runs: { orderBy: { periodKey: "desc" }, take: 1, select: { periodKey: true, taskId: true, error: true } } } });
  return recurrenceDTO(row, row.runs);
}

// ---------------------------------------------------------------------------
// Bộ quét
// ---------------------------------------------------------------------------

/** Dòng giữ chỗ chưa có nhiệm vụ và chưa có lỗi quá 15 phút coi là treo (tiến trình chết giữa chừng). */
export const STALE_CLAIM_MS = 15 * 60_000;

export interface RecurrenceScanResult {
  considered: number;
  created: number;
  failed: number;
  skippedExisting: number;
}

/** Báo người giao khi lịch lặp lại không sinh được nhiệm vụ (hoặc thiếu việc con), để họ sửa và bấm thử lại. */
async function notifyRecurrenceProblem(
  rec: { id: string; createdById: string; template: { title: string } },
  periodKey: string,
  detail: string
) {
  try {
    await prisma.notification.create({
      data: {
        userId: rec.createdById,
        actorName: "Hệ thống",
        title: `Lịch lặp lại kỳ ${periodKey} chưa tạo đủ nhiệm vụ`,
        body: `${renderTitle(rec.template.title, periodKey)}: ${detail}`.slice(0, 500),
        category: "task",
        type: "task_recurrence_failed",
        linkHref: "/tasks/templates",
      },
    });
  } catch (error) {
    logger.error("task.recurrence.notify_failed", { metadata: { recurrenceId: rec.id, periodKey } }, error);
  }
}

export async function runTaskRecurrences(options: { now?: Date; recurrenceIds?: string[] } = {}): Promise<RecurrenceScanResult> {
  const now = options.now ?? new Date();
  const periodKey = periodKeyOf(now);
  const result: RecurrenceScanResult = { considered: 0, created: 0, failed: 0, skippedExisting: 0 };

  await prisma.taskRecurrenceRun.deleteMany({
    where: { taskId: null, error: null, claimedAt: { lt: new Date(now.getTime() - STALE_CLAIM_MS) }, ...(options.recurrenceIds ? { recurrenceId: { in: options.recurrenceIds } } : {}) },
  });

  const recurrences = await prisma.taskRecurrence.findMany({
    where: { isActive: true, template: { isActive: true }, ...(options.recurrenceIds ? { id: { in: options.recurrenceIds } } : {}) },
    include: { template: true },
  });

  for (const rec of recurrences) {
    if (!isPeriodDue(rec, periodKey)) continue;
    result.considered++;
    const claim = await prisma.taskRecurrenceRun.createMany({ data: [{ recurrenceId: rec.id, periodKey, claimedAt: now }], skipDuplicates: true });
    if (claim.count === 0) {
      result.skippedExisting++;
      continue;
    }
    try {
      const taskId = await generateTask(rec, periodKey, (detail) => notifyRecurrenceProblem(rec, periodKey, detail));
      await prisma.taskRecurrenceRun.updateMany({ where: { recurrenceId: rec.id, periodKey }, data: { taskId } });
      result.created++;
    } catch (error) {
      const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
      await prisma.taskRecurrenceRun.updateMany({ where: { recurrenceId: rec.id, periodKey }, data: { error: message } });
      result.failed++;
      await notifyRecurrenceProblem(rec, periodKey, message);
      logger.error("task.recurrence.generate_failed", { metadata: { recurrenceId: rec.id, periodKey } }, error);
    }
  }
  return result;
}

async function generateTask(
  rec: Awaited<ReturnType<typeof prisma.taskRecurrence.findMany<{ include: { template: true } }>>>[number],
  periodKey: string,
  onPartialFailure: (detail: string) => Promise<void>
): Promise<string> {
  const creator = await prisma.user.findUnique({ where: { id: rec.createdById }, select: { id: true, email: true, name: true, role: true, isActive: true } });
  if (!creator || !creator.isActive) throw new Error("Người giao của lịch lặp lại không còn hoạt động");
  const user = { id: creator.id, email: creator.email, name: creator.name, role: creator.role };
  const tpl = rec.template;
  const dueDate = dueDateForPeriod(periodKey, tpl.dueDay);
  const academicMonth = Number(periodKey.slice(5, 7));
  const academicYear = getAcademicYear(`${periodKey}-15`);

  const parent = await taskCommandService.createTask(
    { user },
    {
      title: renderTitle(tpl.title, periodKey),
      description: tpl.description,
      leadUnitId: tpl.unitId,
      dueDate,
      priority: tpl.priority,
      assigneeId: rec.driUserId,
      collaboratorIds: rec.collaboratorIds,
      academicMonth,
      academicYear,
    }
  );

  const criteria = (tpl.criteria as string[]) ?? [];
  if (criteria.length) {
    await prisma.taskAcceptanceCriterion.createMany({ data: criteria.map((text, position) => ({ taskId: parent.id, position, text })) });
  }
  if (rec.reviewerUserId) {
    await prisma.taskActor.create({ data: { taskId: parent.id, userId: rec.reviewerUserId, role: TaskActorRole.REVIEWER, assignedById: rec.createdById } });
  }
  await audit(rec.createdById, AuditAction.TASK_RECURRENCE_GENERATED, "Task", parent.id, null, { recurrenceId: rec.id, templateId: tpl.id, periodKey });

  const subtasks = (tpl.subtasks as string[]) ?? [];
  const failures: string[] = [];
  for (const title of subtasks) {
    try {
      await taskCommandService.createTask(
        { user },
        { title: renderTitle(title, periodKey), leadUnitId: tpl.unitId, dueDate, priority: tpl.priority, assigneeId: rec.driUserId, parentTaskId: parent.id, academicMonth, academicYear }
      );
    } catch (error) {
      failures.push(title);
      logger.error("task.recurrence.subtask_failed", { metadata: { recurrenceId: rec.id, periodKey } }, error);
    }
  }
  if (failures.length) {
    // Nhiệm vụ cha đã tạo; ghi lỗi để người giao thấy và bổ sung tay, không tạo lại cha.
    const detail = `Chưa tạo được ${failures.length} việc con: ${failures.join("; ")}`.slice(0, 500);
    await prisma.taskRecurrenceRun.updateMany({ where: { recurrenceId: rec.id, periodKey }, data: { error: detail } });
    await onPartialFailure(detail);
  }
  return parent.id;
}
