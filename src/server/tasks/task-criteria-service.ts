/**
 * Tiêu chí hoàn thành của nhiệm vụ (T-04, spec task-document-gap-spec.md).
 *
 * - Người giao (task.assign: người giao, trưởng đơn vị, lãnh đạo; người thực hiện không sửa được
 *   tiêu chuẩn dùng để chấm mình) ghi tối đa 20 tiêu chí, mỗi tiêu chí tối đa 300
 *   ký tự, khi nhiệm vụ còn NOT_STARTED hoặc IN_PROGRESS.
 * - Người duyệt (task.review) đánh dấu từng tiêu chí khi nhiệm vụ WAITING_APPROVAL.
 *   Quy tắc phân tách (người thực hiện không tự thẩm tra) do authorize() bước 10 giữ.
 * - Duyệt không bị chặn khi còn tiêu chí chưa đạt (quyết định Q3): chỉ ghi số tiêu chí
 *   chưa đạt vào nhật ký duyệt.
 */
import { z } from "zod";
import { TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditService, AuditAction, AuditEntityType } from "@/lib/db/audit";
import type { SessionPayload } from "@/lib/jwt-session";
import { InvalidTransitionError, NotFoundError, PreconditionFailedError } from "@/server/api/errors";
import { authorizeOnTask, can } from "./authorize-on-task";

export const MAX_CRITERIA = 20;

export const ReplaceCriteriaSchema = z
  .object({
    criteria: z
      .array(
        z
          .object({
            id: z.string().trim().min(1).optional(),
            text: z.string().trim().min(1, "Tiêu chí không được để trống").max(300, "Mỗi tiêu chí tối đa 300 ký tự"),
          })
          .strict()
      )
      .max(MAX_CRITERIA, `Tối đa ${MAX_CRITERIA} tiêu chí`),
    expectedVersion: z.number().int().min(0),
  })
  .strict();

export const CheckCriterionSchema = z.object({ checked: z.boolean() }).strict();

export type ReplaceCriteriaInput = z.infer<typeof ReplaceCriteriaSchema>;
export type CheckCriterionInput = z.infer<typeof CheckCriterionSchema>;

export interface CriterionDTO {
  id: string;
  position: number;
  text: string;
  checked: boolean;
  checkedAt: string | null;
}

export interface TaskCriteriaView {
  criteria: CriterionDTO[];
  unmet: number;
  /** Người dùng này sửa được danh sách tiêu chí lúc này. */
  canEdit: boolean;
  /** Người dùng này đánh dấu được tiêu chí lúc này (đang chờ duyệt và có quyền thẩm tra). */
  canCheck: boolean;
  version: number;
}

const EDITABLE: ReadonlySet<TaskStatus> = new Set([TaskStatus.NOT_STARTED, TaskStatus.IN_PROGRESS]);

function toDTO(row: { id: string; position: number; text: string; checked: boolean; checkedAt: Date | null }): CriterionDTO {
  return {
    id: row.id,
    position: row.position,
    text: row.text,
    checked: row.checked,
    checkedAt: row.checkedAt ? row.checkedAt.toISOString() : null,
  };
}

/** Số tiêu chí chưa đạt của nhiệm vụ; dùng khi duyệt để ghi nhật ký. */
export async function countUnmetCriteria(
  client: Pick<typeof prisma, "taskAcceptanceCriterion">,
  taskId: string
): Promise<number> {
  return client.taskAcceptanceCriterion.count({ where: { taskId, checked: false } });
}

export async function getTaskCriteria(session: SessionPayload, taskId: string): Promise<TaskCriteriaView> {
  const task = await authorizeOnTask(session, taskId, "task.read");
  const rows = await prisma.taskAcceptanceCriterion.findMany({ where: { taskId }, orderBy: { position: "asc" } });
  const canEdit = EDITABLE.has(task.status) && !task.archivedAt && (await can(session, "task.assign", task)).allowed;
  const canCheck =
    task.status === TaskStatus.WAITING_APPROVAL && !task.archivedAt && rows.length > 0 && (await can(session, "task.review", task)).allowed;
  const criteria = rows.map(toDTO);
  return { criteria, unmet: criteria.filter((c) => !c.checked).length, canEdit, canCheck, version: task.version };
}

export async function replaceTaskCriteria(
  session: SessionPayload,
  taskId: string,
  input: ReplaceCriteriaInput
): Promise<TaskCriteriaView> {
  const validated = ReplaceCriteriaSchema.parse(input);
  const task = await authorizeOnTask(session, taskId, "task.assign");
  if (!EDITABLE.has(task.status) || task.archivedAt) {
    throw new InvalidTransitionError("Chỉ sửa tiêu chí khi nhiệm vụ chưa bắt đầu hoặc đang thực hiện");
  }
  if (task.version !== validated.expectedVersion) {
    throw new PreconditionFailedError(
      `Task aggregate version conflict: expected version ${validated.expectedVersion}, current version ${task.version}`
    );
  }

  await prisma.$transaction(async (tx) => {
    const bumped = await tx.task.updateMany({
      where: { id: taskId, version: validated.expectedVersion, archivedAt: null },
      data: { version: { increment: 1 } },
    });
    if (bumped.count !== 1) {
      throw new PreconditionFailedError(`Task aggregate version conflict: expected version ${validated.expectedVersion}`);
    }

    const existing = await tx.taskAcceptanceCriterion.findMany({ where: { taskId } });
    const byId = new Map(existing.map((row) => [row.id, row]));
    const keptIds = new Set<string>();

    for (const [index, item] of validated.criteria.entries()) {
      const current = item.id ? byId.get(item.id) : undefined;
      if (item.id && !current) throw new NotFoundError("Tiêu chí không thuộc nhiệm vụ này");
      if (current) {
        keptIds.add(current.id);
        // Đổi nội dung thì kết quả đánh dấu trước đó không còn đúng nữa.
        const textChanged = current.text !== item.text;
        await tx.taskAcceptanceCriterion.update({
          where: { id: current.id },
          data: {
            position: index,
            text: item.text,
            ...(textChanged ? { checked: false, checkedById: null, checkedAt: null } : {}),
          },
        });
      } else {
        await tx.taskAcceptanceCriterion.create({ data: { taskId, position: index, text: item.text } });
      }
    }

    const removed = existing.filter((row) => !keptIds.has(row.id)).map((row) => row.id);
    if (removed.length > 0) await tx.taskAcceptanceCriterion.deleteMany({ where: { id: { in: removed } } });

    await auditService.logEvent(tx, {
      actorId: session.id,
      action: AuditAction.TASK_CRITERIA_UPDATED,
      entityType: AuditEntityType.TASK,
      entityId: taskId,
      beforeData: { count: existing.length },
      afterData: { count: validated.criteria.length },
    });
  });

  return getTaskCriteria(session, taskId);
}

export async function setTaskCriterionChecked(
  session: SessionPayload,
  taskId: string,
  criterionId: string,
  input: CheckCriterionInput
): Promise<TaskCriteriaView> {
  const validated = CheckCriterionSchema.parse(input);
  const task = await authorizeOnTask(session, taskId, "task.review");
  if (task.status !== TaskStatus.WAITING_APPROVAL || task.archivedAt) {
    throw new InvalidTransitionError("Chỉ đánh dấu tiêu chí khi nhiệm vụ đang chờ duyệt");
  }
  const criterion = await prisma.taskAcceptanceCriterion.findFirst({ where: { id: criterionId, taskId } });
  if (!criterion) throw new NotFoundError("Không tìm thấy tiêu chí");

  if (criterion.checked !== validated.checked) {
    await prisma.$transaction(async (tx) => {
      await tx.taskAcceptanceCriterion.update({
        where: { id: criterion.id },
        data: validated.checked
          ? { checked: true, checkedById: session.id, checkedAt: new Date() }
          : { checked: false, checkedById: null, checkedAt: null },
      });
      await auditService.logEvent(tx, {
        actorId: session.id,
        action: AuditAction.TASK_CRITERION_CHECKED,
        entityType: AuditEntityType.TASK,
        entityId: taskId,
        beforeData: { criterionId: criterion.id, checked: criterion.checked },
        afterData: { criterionId: criterion.id, checked: validated.checked },
      });
    });
  }
  return getTaskCriteria(session, taskId);
}
