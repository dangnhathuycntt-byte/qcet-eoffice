import { prisma } from '@/lib/prisma';
import {
  TaskScope,
  TaskStatus,
  TaskPriority,
  TaskOriginLevel,
  TaskActorRole,
  AssigneeRole,
  DeliverableReviewStatus,
  Prisma,
} from '@prisma/client';
import type { ApiRequestContext, AuthenticatedUser } from '@/server/api/request-context';
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
  PreconditionFailedError,
} from '@/server/api/errors';
import {
  logAuditEvent,
  AuditAction,
  AuditEntityType,
} from '@/lib/db/audit';
import { publishOutboxEvent, OutboxAggregateType } from '@/lib/db/outbox';
import { safeAfter, dispatchTaskAssignedPush } from '@/lib/push-dispatch';
import { generateTaskCodeAtomic } from '@/lib/task-code-generator';
import { getAcademicYear, getSystemReferenceDate, getCurrentAcademicPeriod } from '@/lib/academic-calendar';
import {
  CreateTaskInputSchema,
  UpdateTaskInputSchema,
  SubmitDeliverableInputSchema,
  ReviewDeliverableInputSchema,
  ApproveTaskInputSchema,
} from '@/contracts/tasks';
import { taskStateMachine } from '@/domain/tasks/state-machine';
import { loadAuthorizationContext } from '@/server/authorization/authorization-context-service';
import { authorize } from '@/server/authorization/authorization-engine';
import { buildTaskResource } from '@/server/authorization/available-actions';
import type { CapabilityAction } from '@/server/authorization/capability';

export interface CreateFromMeetingResolutionInput {
  meetingId: string;
  meetingCode?: string | null;
  meetingTitle?: string;
  bodyId?: string | null;
  unitId?: string | null;
  title: string;
  content: string;
  taskTitle?: string;
  leadUnitId?: string | null;
  leadUserId?: string | null;
  deadline?: string | Date | null;
  actorId: string;
  requestId?: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  leadUnitId?: string | null;
  startDate?: string | Date | null;
  dueDate: string | Date;
  priority?: string | TaskPriority;
  scope?: string | TaskScope;
  academicMonth?: number | string;
  academicYear?: string;
  creatorId?: string;
  assigneeId?: string | null;
  parentTaskId?: string | null;
  collaboratorIds?: string[];
  code?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  progressPercent?: number;
  progress?: number;
  status?: string | TaskStatus;
  priority?: string | TaskPriority;
  startDate?: string | Date | null;
  dueDate?: string | Date | null;
  leadUnitId?: string | null;
  assigneeId?: string | null;
  parentTaskId?: string | null;
  collaboratorIds?: string[];
  auditAction?: string;
  academicMonth?: number;
  academicYear?: string;
  resolution?: string;
  comment?: string | null;
  note?: string | null;
  expectedVersion?: number;
}

export interface SubmitDeliverableInput {
  title: string;
  fileUrl: string;
  fileName?: string | null;
  fileType?: string | null;
  fileSize?: number | null;
  uploadedById?: string | null;
  notes?: string | null;
  note?: string | null;
  expectedVersion?: number;
}

export interface ReviewDeliverableInput {
  deliverableId: string;
  reviewStatus: 'APPROVED' | 'REJECTED' | 'REVISION_REQUIRED' | string;
  reviewNote?: string | null;
  expectedVersion?: number;
}

export interface ArchiveTaskInput {
  reason: string;
  expectedVersion: number;
}

function resolveUser(
  ctx: ApiRequestContext | { user: AuthenticatedUser | null }
): AuthenticatedUser {
  if (!ctx.user) {
    throw new AuthenticationError('Unauthorized');
  }
  return ctx.user;
}

async function requireTaskAuthorization(
  userId: string,
  action: CapabilityAction,
  task: Record<string, unknown>
) {
  const authorizationContext = await loadAuthorizationContext(userId);
  const decision = authorize(authorizationContext, action, buildTaskResource(task));
  if (!decision.allowed) {
    throw new AuthorizationError(decision.reason || 'Bạn không có quyền thực hiện thao tác này');
  }
}

/**
 * Tính toán và đồng bộ lại tiến độ tổng hợp cùng trạng thái của nhiệm vụ cha
 * khi các việc thành phần (subtasks) hoàn thành, mở lại, tạo mới, hủy hoặc chuyển cha.
 * Tuân thủ quy chuẩn:
 * - Không còn việc con active: giữ nguyên tiến độ cha, không can thiệp.
 * - Có việc con: progressPercent = Math.round((completed / total) * 100).
 * - Tiến độ 100%: chuyển sang WAITING_APPROVAL (không tự ý bỏ qua bước duyệt).
 * - Việc con mở lại (tiến độ < 100%): mở lại cha về IN_PROGRESS nếu đang COMPLETED hoặc WAITING_APPROVAL.
 */
export async function recalculateParentTaskProgress(
  tx: Prisma.TransactionClient,
  parentTaskId: string,
  actorId?: string | null,
  requestId?: string
): Promise<{ updated: boolean; newProgress?: number; newStatus?: TaskStatus }> {
  const subTasks = await tx.task.findMany({
    where: {
      parentTaskId,
      status: { not: TaskStatus.CANCELLED },
    },
    select: { id: true, status: true },
  });

  if (subTasks.length === 0) {
    return { updated: false };
  }

  const completedCount = subTasks.filter((st) => st.status === TaskStatus.COMPLETED).length;
  const newProgress = Math.round((completedCount / subTasks.length) * 100);

  const parent = await tx.task.findUnique({
    where: { id: parentTaskId },
    select: {
      id: true,
      status: true,
      progressPercent: true,
      version: true,
    },
  });

  if (!parent) return { updated: false };

  let nextStatus = parent.status;

  if (newProgress === 100) {
    if (parent.status === TaskStatus.IN_PROGRESS || parent.status === TaskStatus.NOT_STARTED) {
      nextStatus = TaskStatus.WAITING_APPROVAL;
    }
  } else if (newProgress > 0) {
    if (
      parent.status === TaskStatus.NOT_STARTED ||
      parent.status === TaskStatus.COMPLETED ||
      parent.status === TaskStatus.WAITING_APPROVAL
    ) {
      nextStatus = TaskStatus.IN_PROGRESS;
    }
  } else {
    // newProgress === 0
    if (parent.status === TaskStatus.COMPLETED || parent.status === TaskStatus.WAITING_APPROVAL) {
      nextStatus = TaskStatus.IN_PROGRESS;
    }
  }

  const isProgressChanged = parent.progressPercent !== newProgress;
  const isStatusChanged = parent.status !== nextStatus;

  if (!isProgressChanged && !isStatusChanged) {
    return { updated: false, newProgress, newStatus: parent.status };
  }

  await tx.task.update({
    where: { id: parentTaskId },
    data: {
      progressPercent: newProgress,
      status: nextStatus,
      version: { increment: 1 },
      updatedAt: new Date(),
    },
  });

  await logAuditEvent(tx, {
    actorId: actorId || null,
    action: isStatusChanged ? AuditAction.TASK_STATUS_CHANGED : AuditAction.TASK_UPDATED,
    entityType: AuditEntityType.TASK,
    entityId: parentTaskId,
    requestId,
    beforeData: {
      progressPercent: parent.progressPercent,
      status: parent.status,
    },
    afterData: {
      progressPercent: newProgress,
      status: nextStatus,
      triggerReason: `Tự động tổng hợp từ ${completedCount}/${subTasks.length} việc thành phần`,
    },
    metadata: {
      trigger: 'SUBTASK_PROGRESS_ROLLUP',
      completedSubTasks: completedCount,
      totalSubTasks: subTasks.length,
    },
  });

  return { updated: true, newProgress, newStatus: nextStatus };
}

export class TaskCommandService {
  /**
   * Canonical creation of a Task derived from a Meeting Resolution (Invariant 5.5).
   * Atomically generates task code, binds creator & lead unit, provisions DRI TaskActor,
   * logs audit event, and registers outbox event within the transaction.
   */
  static async createFromMeetingResolution(
    tx: Prisma.TransactionClient,
    input: CreateFromMeetingResolutionInput
  ) {
    const dueDate = input.deadline
      ? new Date(input.deadline)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const { month: academicMonth, academicYear } = getCurrentAcademicPeriod();
    const originLevel = input.bodyId ? TaskOriginLevel.SCHOOL : TaskOriginLevel.UNIT;
    const scope = input.bodyId ? TaskScope.SCHOOL : (input.unitId ? TaskScope.DEPARTMENT : TaskScope.SCHOOL);
    const effectiveUnitId = input.leadUnitId || input.unitId || null;

    const taskTitle =
      input.taskTitle ||
      (input.meetingCode
        ? `[Kết luận ${input.meetingCode}] ${input.title}`
        : `[Kết luận cuộc họp] ${input.title}`);

    let code: string;
    try {
      code = await generateTaskCodeAtomic(tx, {
        year: new Date().getFullYear(),
        month: academicMonth,
        scope,
        departmentCode: effectiveUnitId || undefined,
      });
    } catch {
      code = `RES-TASK-${Date.now()}`;
    }

    const task = await tx.task.create({
      data: {
        code,
        title: taskTitle,
        description: input.content,
        status: TaskStatus.NOT_STARTED,
        originLevel,
        priority: TaskPriority.HIGH,
        scope,
        dueDate,
        academicMonth,
        academicYear,
        createdById: input.actorId,
        leadUnitId: effectiveUnitId,
        ...(input.leadUserId
          ? {
              assignees: {
                create: [
                  {
                    userId: input.leadUserId,
                    roleInTask: AssigneeRole.PRIMARY_OWNER,
                  },
                ],
              },
            }
          : {}),
      },
    });

    if (input.leadUserId) {
      await tx.taskActor.create({
        data: {
          taskId: task.id,
          userId: input.leadUserId,
          unitId: effectiveUnitId,
          role: TaskActorRole.DRI,
          isPrimaryDRI: true,
          assignedById: input.actorId,
        },
      });
    }

    await logAuditEvent(tx, {
      actorId: input.actorId,
      action: AuditAction.TASK_CREATED,
      entityType: AuditEntityType.TASK,
      entityId: task.id,
      requestId: input.requestId,
      afterData: {
        code: task.code,
        title: task.title,
        originLevel: task.originLevel,
        leadUnitId: task.leadUnitId,
        leadUserId: input.leadUserId,
        meetingId: input.meetingId,
      },
    });

    await publishOutboxEvent(tx, {
      eventType: 'TASK_CREATED_FROM_RESOLUTION',
      aggregateType: OutboxAggregateType.TASK,
      aggregateId: task.id,
      payload: {
        taskId: task.id,
        taskCode: task.code,
        taskTitle: task.title,
        meetingId: input.meetingId,
        leadUnitId: effectiveUnitId,
        leadUserId: input.leadUserId,
        createdById: input.actorId,
      },
    });

    return task;
  }

  async createFromMeetingResolution(
    tx: Prisma.TransactionClient,
    input: CreateFromMeetingResolutionInput
  ) {
    return TaskCommandService.createFromMeetingResolution(tx, input);
  }

  /**
   * Tạo nhiệm vụ mới với sinh mã nguyên tử O(1) và kiểm tra toàn vẹn phân cấp.
   */
  async createTask(
    ctx: ApiRequestContext | { user: AuthenticatedUser | null },
    input: CreateTaskInput
  ) {
    const user = resolveUser(ctx);

    const validationResult = CreateTaskInputSchema.safeParse(input);
    if (!validationResult.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of validationResult.error.issues) {
        const key = issue.path.join('.') || '_root';
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      if (!input?.title || !input?.dueDate || (!input?.leadUnitId && !input?.parentTaskId)) {
        throw new ValidationError('Thiếu thông tin bắt buộc (Tiêu đề, Hạn chót, Đơn vị)', fieldErrors);
      }
      throw new ValidationError('Dữ liệu tạo nhiệm vụ không hợp lệ', fieldErrors);
    }

    const {
      title,
      description,
      leadUnitId: inputLeadUnitId,
      startDate,
      dueDate,
      priority,
      scope,
      academicMonth,
      academicYear,
      creatorId,
      assigneeId,
      parentTaskId,
      collaboratorIds,
      code: customCode,
    } = input;

    let parentTask: {
      id: string;
      leadUnitId: string | null;
      academicMonth: number;
      academicYear: string;
      scope: TaskScope;
      dueDate: Date | null;
    } | null = null;

    if (parentTaskId) {
      parentTask = await prisma.task.findUnique({
        where: { id: parentTaskId },
        select: { id: true, leadUnitId: true, academicMonth: true, academicYear: true, scope: true, dueDate: true },
      });
      if (!parentTask) {
        throw new NotFoundError('Không tìm thấy nhiệm vụ cha');
      }
    }

    const effectiveLeadUnitId = inputLeadUnitId || parentTask?.leadUnitId || null;
    const monthNum = academicMonth
      ? Number(academicMonth)
      : (parentTask?.academicMonth ?? (new Date(dueDate).getMonth() + 1 || 9));
    const yearStr =
      academicYear ||
      parentTask?.academicYear ||
      getAcademicYear(dueDate || getSystemReferenceDate());

    if (!title || !dueDate || !effectiveLeadUnitId) {
      throw new ValidationError('Thiếu thông tin bắt buộc (Tiêu đề, Hạn chót, Đơn vị)');
    }

    if (parentTask?.dueDate && new Date(dueDate).getTime() > new Date(parentTask.dueDate).getTime()) {
      throw new ValidationError(
        'Hạn chót của nhiệm vụ con không thể sau hạn chót của nhiệm vụ cha'
      );
    }

    const curYear = new Date().getFullYear();

    let taskScope: TaskScope = parentTask?.scope || (effectiveLeadUnitId ? TaskScope.DEPARTMENT : TaskScope.SCHOOL);
    if (scope) {
      const s = String(scope).toLowerCase();
      if (s === 'department') taskScope = TaskScope.DEPARTMENT;
      else if (s === 'individual') taskScope = TaskScope.INDIVIDUAL;
      else if (s === 'school') taskScope = TaskScope.SCHOOL;
    }

    await requireTaskAuthorization(user.id, 'task.create', {
      scope: taskScope,
      leadUnitId: effectiveLeadUnitId,
      // A subtask inherits its parent's scope; only an explicitly chosen scope
      // is subject to the scope-authority gate (P0-06).
      scopeExplicit: Boolean(scope) || !parentTaskId,
    });

    let taskPriority: TaskPriority = TaskPriority.NORMAL;
    if (priority) {
      const p = String(priority).toLowerCase();
      if (p === 'urgent') taskPriority = TaskPriority.URGENT;
      else if (p === 'high') taskPriority = TaskPriority.HIGH;
      else if (p === 'low') taskPriority = TaskPriority.LOW;
    }

    const validAssigneeId =
      typeof assigneeId === 'string' && assigneeId.trim() ? assigneeId.trim() : null;

    // Phối hợp là dữ liệu phái sinh từ nhiệm vụ con active (Rule 2), không gán thủ công khi tạo
    const assigneesToCreate: { userId: string; roleInTask: AssigneeRole }[] = [];
    if (validAssigneeId) {
      assigneesToCreate.push({
        userId: validAssigneeId,
        roleInTask: AssigneeRole.PRIMARY_OWNER,
      });
    }

    // Thực hiện trong transaction
    const newTask = await prisma.$transaction(async (tx) => {
      if (creatorId && creatorId !== user.id) {
        throw new ValidationError('Không được tạo nhiệm vụ thay danh tính người khác');
      }
      const effectiveCreatorId = user.id;

      // Resolve valid OrganizationalUnit ID to guarantee foreign key integrity
      const orgUnit = await tx.organizationalUnit.findFirst({
        where: {
          OR: [
            { id: effectiveLeadUnitId },
            { code: effectiveLeadUnitId },
          ],
        },
        select: { id: true },
      });
      if (!orgUnit) {
        throw new NotFoundError('Đơn vị được chọn không tồn tại');
      }
      const validLeadUnitId = orgUnit.id;

      // Verify and filter real existing user IDs to prevent Foreign Key constraint violations
      const candidateUserIds = validAssigneeId ? [validAssigneeId] : [];
      const existingUsers =
        candidateUserIds.length > 0
          ? await tx.user.findMany({
              where: { id: { in: candidateUserIds } },
              select: { id: true },
            })
          : [];
      const existingUserIdSet = new Set(existingUsers.map((u) => u.id));

      if (existingUserIdSet.size !== candidateUserIds.length) {
        throw new NotFoundError('Một hoặc nhiều người được phân công không tồn tại');
      }

      const safeAssigneesToCreate = assigneesToCreate.filter((a) =>
        existingUserIdSet.has(a.userId)
      );

      // Sinh mã tự động atomic O(1)
      const code =
        customCode ||
        (await generateTaskCodeAtomic(tx, {
          year: curYear,
          month: monthNum,
          scope: taskScope,
          departmentCode: validLeadUnitId || undefined,
        }));

      const parsedDueDate = new Date(dueDate);
      let validStartDate: Date;
      if (startDate) {
        const parsedStart = new Date(startDate);
        validStartDate = isNaN(parsedStart.getTime()) ? new Date() : parsedStart;
      } else {
        validStartDate = new Date();
      }

      // Enforce database check constraint chk_tasks_due_date_after_start_date: (due_date >= start_date)
      if (validStartDate > parsedDueDate) {
        validStartDate = new Date(parsedDueDate);
      }

      const task = await tx.task.create({
        data: {
          code,
          title,
          description: description || null,
          leadUnitId: validLeadUnitId,
          startDate: validStartDate,
          dueDate: parsedDueDate,
          academicMonth: monthNum,
          academicYear: yearStr,
          scope: taskScope,
          priority: taskPriority,
          createdById: effectiveCreatorId,
          parentTaskId: parentTaskId || null,
          ...(safeAssigneesToCreate.length > 0
            ? {
                assignees: {
                  create: safeAssigneesToCreate,
                },
              }
            : {}),
        },
        include: {
          leadUnit: true,
          assignees: {
            include: {
              user: { select: { id: true, name: true, avatarUrl: true } },
            },
          },
          deliverables: true,
          parentTask: {
            select: { id: true, code: true, title: true, scope: true },
          },
          subTasks: {
            select: {
              id: true,
              code: true,
              title: true,
              status: true,
              progressPercent: true,
              assignees: {
                include: {
                  user: { select: { id: true, name: true, avatarUrl: true } },
                },
              },
            },
          },
        },
      });

      if (validAssigneeId && existingUserIdSet.has(validAssigneeId)) {
        await tx.taskActor.create({
          data: {
            taskId: task.id,
            userId: validAssigneeId,
            unitId: validLeadUnitId,
            role: TaskActorRole.DRI,
            isPrimaryDRI: true,
            assignedById: effectiveCreatorId,
          },
        });
      }

      const requestId =
        ctx && 'requestId' in ctx && typeof ctx.requestId === 'string'
          ? ctx.requestId
          : undefined;

      // 1. Business Audit Event: TASK_CREATED
      await logAuditEvent(tx, {
        actorId: user.id,
        action: AuditAction.TASK_CREATED,
        entityType: AuditEntityType.TASK,
        entityId: task.id,
        requestId,
        beforeData: null,
        afterData: {
          code: task.code,
          title: task.title,
          leadUnitId: task.leadUnitId,
          scope: task.scope,
          priority: task.priority,
          dueDate: task.dueDate.toISOString(),
          createdById: task.createdById,
        },
      });

      // 2. Business Audit Event: TASK_ASSIGNED (if primary owner assigned)
      if (validAssigneeId) {
        await logAuditEvent(tx, {
          actorId: user.id,
          action: AuditAction.TASK_ASSIGNED,
          entityType: AuditEntityType.TASK,
          entityId: task.id,
          requestId,
          beforeData: null,
          afterData: {
            assigneeId: validAssigneeId,
            roleInTask: AssigneeRole.PRIMARY_OWNER,
            collaboratorIds: [],
          },
        });
      }

      // Tự động tính toán lại tiến độ tổng hợp cho nhiệm vụ cha (REQ-4)
      if (task.parentTaskId) {
        await recalculateParentTaskProgress(tx, task.parentTaskId, user.id, requestId);
      }

      return task;
    });

    // Background push notification dispatch via Next.js 15 after()
    safeAfter(async () => {
      const start = Date.now();
      try {
        await dispatchTaskAssignedPush({
          task: newTask,
          assigneeId: validAssigneeId || undefined,
          actorName: user.name,
          actorId: user.id,
        });
      } catch (error) {
        console.error('[after() Task Push Error]', {
          taskId: newTask.id,
          durationMs: Date.now() - start,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    return newTask;
  }

  /**
   * Cập nhật nhiệm vụ với kiểm tra thẩm quyền, phân tách nhiệm vụ (SoD) và đồng bộ quan hệ.
   */
  async updateTask(
    ctx: ApiRequestContext | { user: AuthenticatedUser | null },
    taskId: string,
    input: UpdateTaskInput,
    options?: { auditAction?: string }
  ) {
    const user = resolveUser(ctx);
    const { auditAction: inputAuditAction, ...sanitizedInput } = (input as any) || {};
    const effectiveAuditAction = options?.auditAction || inputAuditAction;

    const validationResult = UpdateTaskInputSchema.safeParse(sanitizedInput);
    if (!validationResult.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of validationResult.error.issues) {
        const key = issue.path.join('.') || '_root';
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      throw new ValidationError('Dữ liệu cập nhật không hợp lệ', fieldErrors);
    }

    const existing = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignees: { select: { userId: true, roleInTask: true } },
      },
    });

    if (!existing) {
      throw new NotFoundError('Không tìm thấy nhiệm vụ');
    }

    await requireTaskAuthorization(user.id, 'task.update_metadata', existing);

    const {
      title,
      description,
      progressPercent,
      progress,
      status,
      priority,
      startDate,
      dueDate,
      assigneeId,
      parentTaskId,
      collaboratorIds,
      academicMonth,
      academicYear,
    } = input;

    const expectedVersion =
      input.expectedVersion !== undefined && input.expectedVersion !== null
        ? Number(input.expectedVersion)
        : undefined;

    if (expectedVersion !== undefined && existing.version !== expectedVersion) {
      throw new PreconditionFailedError(
        `Xung đột phiên bản (Optimistic Concurrency Control): Phiên bản hiện tại là ${existing.version}, nhưng yêu cầu cung cấp phiên bản ${expectedVersion}. Vui lòng tải lại dữ liệu mới nhất.`
      );
    }

    let resolvedParentTaskId: string | null | undefined = undefined;
    if (parentTaskId !== undefined) {
      if (parentTaskId === null || parentTaskId === '' || parentTaskId === 'none') {
        resolvedParentTaskId = null;
      } else if (typeof parentTaskId === 'string') {
        const trimmedParentId = parentTaskId.trim();
        if (trimmedParentId === taskId) {
          throw new ValidationError('Nhiệm vụ không thể là nhiệm vụ cha của chính nó');
        }
        const parentTask = await prisma.task.findUnique({
          where: { id: trimmedParentId },
          select: { id: true },
        });
        if (!parentTask) {
          throw new NotFoundError('Không tìm thấy nhiệm vụ cha');
        }
        resolvedParentTaskId = trimmedParentId;
      }
    }

    const scalarUpdateData: Prisma.TaskUncheckedUpdateManyInput = {
      version: { increment: 1 },
    };

    if (resolvedParentTaskId !== undefined) {
      scalarUpdateData.parentTaskId = resolvedParentTaskId;
    }
    if (typeof title === 'string' && title.trim()) {
      scalarUpdateData.title = title.trim();
    }
    if (description !== undefined) {
      scalarUpdateData.description = description || null;
    }
    if (typeof progressPercent === 'number') {
      scalarUpdateData.progressPercent = Math.min(100, Math.max(0, progressPercent));
    } else if (typeof progress === 'number') {
      scalarUpdateData.progressPercent = Math.min(100, Math.max(0, progress));
    }
    // Ghép dữ liệu ngày tháng với bản ghi hiện tại để validate nghiêm ngặt (phân biệt undefined với null)
    let mergedStartDate: Date | null = existing.startDate ? new Date(existing.startDate) : null;
    if (startDate !== undefined) {
      if (startDate === null) {
        throw new ValidationError('Ngày bắt đầu không được để trống (Start date cannot be empty)');
      }
      mergedStartDate = new Date(startDate);
      if (Number.isNaN(mergedStartDate.getTime())) {
        throw new ValidationError('Ngày bắt đầu không hợp lệ (Invalid start date)');
      }
    }

    let mergedDueDate: Date | null = existing.dueDate ? new Date(existing.dueDate) : null;
    if (dueDate !== undefined) {
      if (dueDate === null) {
        throw new ValidationError('Thời hạn hoàn thành không được để trống (Due date cannot be empty)');
      }
      mergedDueDate = new Date(dueDate);
      if (Number.isNaN(mergedDueDate.getTime())) {
        throw new ValidationError('Thời hạn hoàn thành không hợp lệ (Invalid due date)');
      }
    }

    if (mergedStartDate && mergedDueDate) {
      if (mergedStartDate.getTime() > mergedDueDate.getTime()) {
        throw new ValidationError(
          'Ngày bắt đầu không được sau thời hạn hoàn thành (Start date cannot be after due date)'
        );
      }
    }

    if (startDate) {
      scalarUpdateData.startDate = new Date(startDate);
    }
    if (dueDate) {
      scalarUpdateData.dueDate = new Date(dueDate);
    }
    if (academicMonth !== undefined) {
      scalarUpdateData.academicMonth = Number(academicMonth);
    }
    if (academicYear !== undefined) {
      scalarUpdateData.academicYear = academicYear;
    }

    if (status) {
      const statusMap: Record<string, TaskStatus> = {
        not_started: TaskStatus.NOT_STARTED,
        in_progress: TaskStatus.IN_PROGRESS,
        waiting_approval: TaskStatus.WAITING_APPROVAL,
        completed: TaskStatus.COMPLETED,
        overdue: TaskStatus.OVERDUE,
        cancelled: TaskStatus.CANCELLED,
        NOT_STARTED: TaskStatus.NOT_STARTED,
        IN_PROGRESS: TaskStatus.IN_PROGRESS,
        WAITING_APPROVAL: TaskStatus.WAITING_APPROVAL,
        COMPLETED: TaskStatus.COMPLETED,
        OVERDUE: TaskStatus.OVERDUE,
        CANCELLED: TaskStatus.CANCELLED,
      };

      const mappedStatus = statusMap[status];
      if (mappedStatus) {
        await requireTaskAuthorization(user.id, 'task.update_execution', existing);

        // Canonical State Machine Validation
        const fsmResult = taskStateMachine.canTransition(
          {
            id: user.id,
            role: user.role,
            departmentId: null,
            isDelegated: false,
          },
          {
            id: existing.id,
            scope: existing.scope,
            createdById: existing.createdById,
            departmentId: existing.leadUnitId,
            assignees: existing.assignees,
            assigneeIds: existing.assignees?.map((a) => a.userId),
          },
          existing.status,
          mappedStatus
        );

        if (!fsmResult.allowed) {
          if (
            fsmResult.code === 'INVALID_TRANSITION' ||
            fsmResult.code === 'TERMINAL_STATE_LOCKED' ||
            fsmResult.code === 'INVALID_STATUS'
          ) {
            throw new ValidationError(
              fsmResult.reason || 'Chuyển đổi trạng thái không hợp lệ'
            );
          }
          throw new AuthorizationError(
            fsmResult.reason || 'Bạn không có quyền thực hiện chuyển đổi trạng thái này'
          );
        }

        scalarUpdateData.status = mappedStatus;
        if (mappedStatus === TaskStatus.COMPLETED) {
          scalarUpdateData.completedAt = new Date();
          scalarUpdateData.progressPercent = 100;
        } else {
          scalarUpdateData.completedAt = null;
        }
      }
    }

    if (priority) {
      const priorityMap: Record<string, TaskPriority> = {
        urgent: TaskPriority.URGENT,
        high: TaskPriority.HIGH,
        medium: TaskPriority.NORMAL,
        normal: TaskPriority.NORMAL,
        low: TaskPriority.LOW,
        URGENT: TaskPriority.URGENT,
        HIGH: TaskPriority.HIGH,
        NORMAL: TaskPriority.NORMAL,
        LOW: TaskPriority.LOW,
      };
      const mappedPriority = priorityMap[priority];
      if (mappedPriority) {
        scalarUpdateData.priority = mappedPriority;
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 1. OCC check and version increment directly on Task
      if (expectedVersion !== undefined) {
        const updateResult = await tx.task.updateMany({
          where: { id: taskId, version: expectedVersion },
          data: scalarUpdateData,
        });

        if (updateResult.count === 0) {
          throw new PreconditionFailedError(
            `Task aggregate version conflict: expected version ${expectedVersion}`
          );
        }
      } else {
        await tx.task.updateMany({
          where: { id: taskId },
          data: scalarUpdateData,
        });
      }

      let effectivePrimaryOwnerId: string | null = null;
      let previousAssigneeId: string | null = null;
      let assigneeChanged = false;

      if (assigneeId !== undefined) {
        const existingOwner = await tx.taskAssignee.findFirst({
          where: { taskId, roleInTask: AssigneeRole.PRIMARY_OWNER },
          select: { userId: true },
        });
        previousAssigneeId = existingOwner?.userId || null;

        const validAssigneeId =
          typeof assigneeId === 'string' && assigneeId.trim() ? assigneeId.trim() : null;
        if (validAssigneeId !== previousAssigneeId) {
          assigneeChanged = true;
        }

        if (validAssigneeId) {
          effectivePrimaryOwnerId = validAssigneeId;
          // Synchronize canonical TaskActor
          await tx.taskActor.deleteMany({
            where: { taskId, role: TaskActorRole.DRI },
          });
          await tx.taskActor.deleteMany({
            where: { taskId, userId: validAssigneeId },
          });
          await tx.taskActor.create({
            data: {
              taskId,
              userId: validAssigneeId,
              role: TaskActorRole.DRI,
              isPrimaryDRI: true,
              assignedById: user.id,
            },
          });

          // Legacy TaskAssignee compatibility
          await tx.taskAssignee.deleteMany({
            where: { taskId, roleInTask: AssigneeRole.PRIMARY_OWNER },
          });
          await tx.taskAssignee.deleteMany({
            where: { taskId, userId: validAssigneeId },
          });
          await tx.taskAssignee.create({
            data: {
              taskId,
              userId: validAssigneeId,
              roleInTask: AssigneeRole.PRIMARY_OWNER,
            },
          });
        } else if (assigneeId === null) {
          await tx.taskActor.deleteMany({
            where: { taskId, role: TaskActorRole.DRI },
          });
          await tx.taskAssignee.deleteMany({
            where: { taskId, roleInTask: AssigneeRole.PRIMARY_OWNER },
          });
        }
      } else {
        const existingOwner = await tx.taskActor.findFirst({
          where: { taskId, isPrimaryDRI: true },
          select: { userId: true },
        }) || await tx.taskAssignee.findFirst({
          where: { taskId, roleInTask: AssigneeRole.PRIMARY_OWNER },
          select: { userId: true },
        });
        effectivePrimaryOwnerId = existingOwner?.userId || null;
      }

      // Phối hợp là dữ liệu phái sinh từ nhiệm vụ con active (Rule 2), tuyệt đối không cho mutate thủ công
      if (collaboratorIds !== undefined) {
        throw new ValidationError(
          'Người phối hợp là dữ liệu phái sinh từ các nhiệm vụ con active, không được chỉnh sửa thủ công.'
        );
      }

      const updatedTask = await tx.task.findUniqueOrThrow({
        where: { id: taskId },
        include: {
          leadUnit: true,
          assignees: {
            include: {
              user: { select: { id: true, name: true, avatarUrl: true } },
            },
          },
          deliverables: {
            include: {
              uploadedBy: { select: { id: true, name: true, avatarUrl: true } },
              reviewer: { select: { id: true, name: true, avatarUrl: true } },
            },
          },
          parentTask: {
            select: { id: true, code: true, title: true, scope: true },
          },
          subTasks: {
            include: {
              assignees: {
                include: { user: true },
              },
              deliverables: true,
            },
          },
        },
      });

      const requestId =
        ctx && 'requestId' in ctx && typeof ctx.requestId === 'string'
          ? ctx.requestId
          : undefined;

      let auditLogged = false;

      // 1. Audit trail: TASK_ASSIGNED if primary assignee changed
      if (assigneeChanged) {
        auditLogged = true;
        await logAuditEvent(tx, {
          actorId: user.id,
          action: AuditAction.TASK_ASSIGNED,
          entityType: AuditEntityType.TASK,
          entityId: taskId,
          requestId,
          beforeData: { assigneeId: previousAssigneeId },
          afterData: { assigneeId: effectivePrimaryOwnerId },
        });
      }

      // 2. Audit trail: TASK_DEADLINE_CHANGED if due date changed
      if (scalarUpdateData.dueDate !== undefined) {
        const oldDueTime = existing.dueDate ? new Date(existing.dueDate).getTime() : null;
        const newDueTime = scalarUpdateData.dueDate ? new Date(scalarUpdateData.dueDate as Date).getTime() : null;
        if (oldDueTime !== newDueTime) {
          auditLogged = true;
          await logAuditEvent(tx, {
            actorId: user.id,
            action: AuditAction.TASK_DEADLINE_CHANGED,
            entityType: AuditEntityType.TASK,
            entityId: taskId,
            requestId,
            beforeData: { dueDate: existing.dueDate ? existing.dueDate.toISOString() : null },
            afterData: { dueDate: scalarUpdateData.dueDate ? new Date(scalarUpdateData.dueDate as Date).toISOString() : null },
          });
        }
      }

      // 2b. Audit trail: TASK_START_DATE_CHANGED if start date changed
      if (scalarUpdateData.startDate !== undefined) {
        const oldStartTime = existing.startDate ? new Date(existing.startDate).getTime() : null;
        const newStartTime = scalarUpdateData.startDate ? new Date(scalarUpdateData.startDate as Date).getTime() : null;
        if (oldStartTime !== newStartTime) {
          auditLogged = true;
          await logAuditEvent(tx, {
            actorId: user.id,
            action: AuditAction.TASK_START_DATE_CHANGED,
            entityType: AuditEntityType.TASK,
            entityId: taskId,
            requestId,
            beforeData: { startDate: existing.startDate ? existing.startDate.toISOString() : null },
            afterData: { startDate: scalarUpdateData.startDate ? new Date(scalarUpdateData.startDate as Date).toISOString() : null },
          });
        }
      }

      // 3. Audit trail: TASK_STATUS_CHANGED, TASK_APPROVED, or TASK_REJECTED if status changed
      if (scalarUpdateData.status && scalarUpdateData.status !== existing.status) {
        auditLogged = true;
        const statusAction =
          effectiveAuditAction ||
          (scalarUpdateData.status === TaskStatus.COMPLETED && existing.status === TaskStatus.WAITING_APPROVAL
            ? AuditAction.TASK_APPROVED
            : AuditAction.TASK_STATUS_CHANGED);

        await logAuditEvent(tx, {
          actorId: user.id,
          action: statusAction,
          entityType: AuditEntityType.TASK,
          entityId: taskId,
          requestId,
          beforeData: {
            status: existing.status,
            progressPercent: existing.progressPercent,
          },
          afterData: {
            status: scalarUpdateData.status,
            progressPercent: (scalarUpdateData.progressPercent as number) ?? existing.progressPercent,
          },
        });
      }

      // 4. Audit trail: TASK_UPDATED (or effectiveAuditAction) for general mutations
      if (!auditLogged) {
        await logAuditEvent(tx, {
          actorId: user.id,
          action: effectiveAuditAction || AuditAction.TASK_UPDATED,
          entityType: AuditEntityType.TASK,
          entityId: taskId,
          requestId,
          beforeData: {
            title: existing.title,
            description: existing.description,
            priority: existing.priority,
            progressPercent: existing.progressPercent,
          },
          afterData: {
            title: updatedTask.title,
            description: updatedTask.description,
            priority: updatedTask.priority,
            progressPercent: updatedTask.progressPercent,
          },
        });
      }

      // 5. Tự động tính toán lại tiến độ tổng hợp cho nhiệm vụ cha (REQ-4)
      if (updatedTask.parentTaskId) {
        await recalculateParentTaskProgress(tx, updatedTask.parentTaskId, user.id, requestId);
      }
      if (existing.parentTaskId && existing.parentTaskId !== updatedTask.parentTaskId) {
        await recalculateParentTaskProgress(tx, existing.parentTaskId, user.id, requestId);
      }

      return updatedTask;
    });

    return updated;
  }

  /**
   * Xóa nhiệm vụ và dọn dẹp an toàn cây phân cấp subtasks, văn bản liên kết, phân công.
   */
  async deleteTask(
    ctx: ApiRequestContext | { user: AuthenticatedUser | null },
    taskId: string
  ) {
    const user = resolveUser(ctx);

    const existing = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, createdById: true, parentTaskId: true },
    });

    if (!existing) {
      throw new NotFoundError('Không tìm thấy nhiệm vụ');
    }

    await requireTaskAuthorization(user.id, 'task.archive', existing);

    await prisma.$transaction(async (tx) => {
      // 1. Tìm toàn bộ subtasks đệ quy
      const allSubtaskIds: string[] = [];
      let parentIds = [taskId];
      while (parentIds.length > 0) {
        const children = await tx.task.findMany({
          where: { parentTaskId: { in: parentIds } },
          select: { id: true },
        });
        if (children.length === 0) break;
        const childIds = children.map((c) => c.id);
        allSubtaskIds.push(...childIds);
        parentIds = childIds;
      }

      if (allSubtaskIds.length > 0) {
        await tx.document.updateMany({
          where: { linkedTaskId: { in: allSubtaskIds } },
          data: { linkedTaskId: null },
        });

        await tx.taskActor.deleteMany({ where: { taskId: { in: allSubtaskIds } } });
        await tx.taskAssignee.deleteMany({ where: { taskId: { in: allSubtaskIds } } });
        await tx.taskDeliverable.deleteMany({ where: { taskId: { in: allSubtaskIds } } });
        await tx.delegationScopeRule.deleteMany({ where: { entityType: 'TASK', entityId: { in: allSubtaskIds } } });
        await tx.executiveResolution.deleteMany({ where: { taskId: { in: allSubtaskIds } } });

        await tx.task.deleteMany({ where: { id: { in: allSubtaskIds } } });
      }

      // 2. Gỡ liên kết văn bản của nhiệm vụ gốc
      await tx.document.updateMany({
        where: { linkedTaskId: taskId },
        data: { linkedTaskId: null },
      });

      // 3. Dọn dẹp quan hệ
      await tx.taskActor.deleteMany({ where: { taskId } });
      await tx.taskAssignee.deleteMany({ where: { taskId } });
      await tx.taskDeliverable.deleteMany({ where: { taskId } });
      await tx.delegationScopeRule.deleteMany({ where: { entityType: 'TASK', entityId: taskId } });
      await tx.executiveResolution.deleteMany({ where: { taskId } });

      // 4. Xóa nhiệm vụ chính
      await tx.task.delete({ where: { id: taskId } });

      // Tự động tính toán lại tiến độ tổng hợp cho nhiệm vụ cha nếu xóa việc con (REQ-4)
      if (existing.parentTaskId) {
        const requestId =
          ctx && 'requestId' in ctx && typeof ctx.requestId === 'string'
            ? ctx.requestId
            : undefined;
        await recalculateParentTaskProgress(tx, existing.parentTaskId, user.id, requestId);
      }
    });

    return {
      success: true,
      message: 'Đã xóa nhiệm vụ thành công',
    };
  }

  async archiveTask(
    ctx: ApiRequestContext | { user: AuthenticatedUser | null },
    taskId: string,
    input: ArchiveTaskInput
  ) {
    const user = resolveUser(ctx);
    const existing = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, version: true, archivedAt: true },
    });

    if (!existing) {
      throw new NotFoundError('Không tìm thấy nhiệm vụ');
    }
    if (existing.archivedAt) {
      return { success: true, message: 'Nhiệm vụ đã được lưu trữ', version: existing.version };
    }

    const reason = input.reason.trim();
    const requestId =
      ctx && 'requestId' in ctx && typeof ctx.requestId === 'string' ? ctx.requestId : undefined;

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.task.updateMany({
        where: { id: taskId, version: input.expectedVersion, archivedAt: null },
        data: {
          archivedAt: new Date(),
          archivedById: user.id,
          archiveReason: reason,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new PreconditionFailedError(
          `Task aggregate version conflict: expected version ${input.expectedVersion}`
        );
      }

      await logAuditEvent(tx, {
        actorId: user.id,
        action: AuditAction.TASK_ARCHIVED,
        entityType: AuditEntityType.TASK,
        entityId: taskId,
        requestId,
        beforeData: { archivedAt: null, version: existing.version },
        afterData: { archivedById: user.id, archiveReason: reason },
      });
      await publishOutboxEvent(tx, {
        eventType: 'TASK_ARCHIVED_NOTIFICATION',
        aggregateType: OutboxAggregateType.TASK,
        aggregateId: taskId,
        payload: { taskId, actorId: user.id, reason },
      });

      return { success: true, message: 'Đã lưu trữ nhiệm vụ thành công', version: input.expectedVersion + 1 };
    });

    return result;
  }

  /**
   * Nộp minh chứng nhiệm vụ và tự động chuyển trạng thái sang WAITING_APPROVAL.
   */
  async submitDeliverable(
    ctx: ApiRequestContext | { user: AuthenticatedUser | null },
    taskId: string,
    input: SubmitDeliverableInput
  ) {
    const user = resolveUser(ctx);

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        status: true,
        createdById: true,
        leadUnitId: true,
        assignees: { select: { userId: true } },
      },
    });

    if (!task) {
      throw new NotFoundError('Không tìm thấy nhiệm vụ');
    }

    await requireTaskAuthorization(user.id, 'task.submit_result', task);

    const validationResult = SubmitDeliverableInputSchema.safeParse(input);
    if (!validationResult.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of validationResult.error.issues) {
        const key = issue.path.join('.') || '_root';
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      if (!input?.title || !input?.fileUrl) {
        throw new ValidationError('Tiêu đề và đường dẫn file minh chứng là bắt buộc', fieldErrors);
      }
      throw new ValidationError('Dữ liệu nộp minh chứng không hợp lệ', fieldErrors);
    }

    const { title, fileUrl, fileType, fileSize } = input;
    const expectedVersion =
      input.expectedVersion !== undefined && input.expectedVersion !== null
        ? Number(input.expectedVersion)
        : undefined;

    const uploadedById = user.id;

    const result = await prisma.$transaction(async (tx) => {
      // Atomic OCC check and aggregate version increment
      const taskUpdateData: Prisma.TaskUncheckedUpdateManyInput = {
        version: { increment: 1 },
      };
      if (task.status !== TaskStatus.CANCELLED) {
        taskUpdateData.status = TaskStatus.WAITING_APPROVAL;
      }

      if (expectedVersion !== undefined) {
        const updateResult = await tx.task.updateMany({
          where: { id: taskId, version: expectedVersion },
          data: taskUpdateData,
        });
        if (updateResult.count === 0) {
          throw new PreconditionFailedError(
            `Task aggregate version conflict: expected version ${expectedVersion}`
          );
        }
      } else {
        await tx.task.updateMany({
          where: { id: taskId },
          data: taskUpdateData,
        });
      }

      const deliverable = await tx.taskDeliverable.create({
        data: {
          taskId,
          title,
          fileUrl,
          fileType: fileType || 'LINK',
          fileSize: typeof fileSize === 'number' ? fileSize : null,
          uploadedById,
          reviewStatus: DeliverableReviewStatus.PENDING,
        },
        include: {
          uploadedBy: { select: { id: true, name: true, avatarUrl: true } },
        },
      });

      const requestId =
        ctx && 'requestId' in ctx && typeof ctx.requestId === 'string'
          ? ctx.requestId
          : undefined;

      // 1. Audit trail: DELIVERABLE_SUBMITTED linked to Task
      await logAuditEvent(tx, {
        actorId: user.id,
        action: AuditAction.DELIVERABLE_SUBMITTED,
        entityType: AuditEntityType.TASK,
        entityId: taskId,
        requestId,
        beforeData: null,
        afterData: {
          deliverableId: deliverable.id,
          title: deliverable.title,
          fileUrl: deliverable.fileUrl,
          fileType: deliverable.fileType,
          fileSize: deliverable.fileSize,
        },
      });

      // Chuyển trạng thái sang WAITING_APPROVAL khi nộp minh chứng nếu task chưa bị hủy
      if (task.status !== TaskStatus.CANCELLED && task.status !== TaskStatus.WAITING_APPROVAL) {
        await logAuditEvent(tx, {
          actorId: user.id,
          action: AuditAction.TASK_STATUS_CHANGED,
          entityType: AuditEntityType.TASK,
          entityId: taskId,
          requestId,
          beforeData: { status: task.status },
          afterData: { status: TaskStatus.WAITING_APPROVAL },
        });
      }

      return deliverable;
    });

    return result;
  }

  /**
   * Nghiệm thu minh chứng với kiểm tra phân lập nhiệm vụ (SoD) và cập nhật trạng thái nhiệm vụ.
   */
  async reviewDeliverable(
    ctx: ApiRequestContext | { user: AuthenticatedUser | null },
    taskId: string,
    input: ReviewDeliverableInput
  ) {
    const user = resolveUser(ctx);

    const validationResult = ReviewDeliverableInputSchema.safeParse(input);
    if (!validationResult.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of validationResult.error.issues) {
        const key = issue.path.join('.') || '_root';
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      if (!input?.deliverableId || !input?.reviewStatus) {
        throw new ValidationError('deliverableId và reviewStatus là bắt buộc', fieldErrors);
      }
      throw new ValidationError('Dữ liệu duyệt minh chứng không hợp lệ', fieldErrors);
    }

    const { deliverableId, reviewStatus, reviewNote } = input;

    const deliverable = await prisma.taskDeliverable.findUnique({
      where: { id: deliverableId },
      include: {
        task: {
          include: {
            assignees: true,
          },
        },
      },
    });

    if (!deliverable || deliverable.taskId !== taskId) {
      throw new NotFoundError('Không tìm thấy minh chứng cho nhiệm vụ này');
    }

    await requireTaskAuthorization(user.id, 'task.review', deliverable.task);

    const validStatus =
      reviewStatus === 'APPROVED'
        ? DeliverableReviewStatus.APPROVED
        : reviewStatus === 'REJECTED' || reviewStatus === 'REVISION_REQUIRED'
        ? DeliverableReviewStatus.REVISION_REQUIRED
        : DeliverableReviewStatus.PENDING;

    const expectedVersion =
      input.expectedVersion !== undefined && input.expectedVersion !== null
        ? Number(input.expectedVersion)
        : undefined;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Determine task update & atomic OCC check
      const taskUpdateData: Prisma.TaskUncheckedUpdateManyInput = {
        version: { increment: 1 },
      };

      if (validStatus === DeliverableReviewStatus.APPROVED) {
        // Kiểm tra xem tất cả minh chứng của nhiệm vụ này đã được duyệt hay chưa
        const allDeliverables = await tx.taskDeliverable.findMany({
          where: { taskId },
        });
        const allApproved = allDeliverables.every(
          (d) => d.id === deliverableId || d.reviewStatus === DeliverableReviewStatus.APPROVED
        );

        if (allApproved) {
          taskUpdateData.status = TaskStatus.COMPLETED;
          taskUpdateData.progressPercent = 100;
          taskUpdateData.completedAt = new Date();
        }
      } else if (validStatus === DeliverableReviewStatus.REVISION_REQUIRED) {
        // Bị yêu cầu chỉnh sửa, đưa nhiệm vụ về lại IN_PROGRESS
        taskUpdateData.status = TaskStatus.IN_PROGRESS;
        taskUpdateData.completedAt = null;
      }

      if (expectedVersion !== undefined) {
        const updateResult = await tx.task.updateMany({
          where: { id: taskId, version: expectedVersion },
          data: taskUpdateData,
        });
        if (updateResult.count === 0) {
          throw new PreconditionFailedError(
            `Task aggregate version conflict: expected version ${expectedVersion}`
          );
        }
      } else {
        await tx.task.updateMany({
          where: { id: taskId },
          data: taskUpdateData,
        });
      }

      const updatedDeliverable = await tx.taskDeliverable.update({
        where: { id: deliverableId },
        data: {
          reviewStatus: validStatus,
          reviewNote: reviewNote || null,
          reviewerId: user.id,
          reviewedAt: new Date(),
        },
        include: {
          uploadedBy: { select: { id: true, name: true, avatarUrl: true } },
          reviewer: { select: { id: true, name: true, avatarUrl: true } },
        },
      });

      const requestId =
        ctx && 'requestId' in ctx && typeof ctx.requestId === 'string'
          ? ctx.requestId
          : undefined;

      if (validStatus === DeliverableReviewStatus.APPROVED) {
        if (taskUpdateData.status === TaskStatus.COMPLETED) {
          await logAuditEvent(tx, {
            actorId: user.id,
            action: AuditAction.TASK_APPROVED,
            entityType: AuditEntityType.TASK,
            entityId: taskId,
            requestId,
            beforeData: { status: deliverable.task.status },
            afterData: { status: TaskStatus.COMPLETED, progressPercent: 100 },
            metadata: { deliverableId, reviewNote: reviewNote || null },
          });
        } else {
          await logAuditEvent(tx, {
            actorId: user.id,
            action: AuditAction.DELIVERABLE_REVIEWED,
            entityType: AuditEntityType.TASK,
            entityId: taskId,
            requestId,
            beforeData: { reviewStatus: deliverable.reviewStatus },
            afterData: { reviewStatus: validStatus, reviewNote: reviewNote || null },
            metadata: { deliverableId },
          });
        }
      } else if (validStatus === DeliverableReviewStatus.REVISION_REQUIRED) {
        await logAuditEvent(tx, {
          actorId: user.id,
          action: AuditAction.TASK_REJECTED,
          entityType: AuditEntityType.TASK,
          entityId: taskId,
          requestId,
          beforeData: { status: deliverable.task.status },
          afterData: { status: TaskStatus.IN_PROGRESS },
          metadata: { deliverableId, reviewNote: reviewNote || null },
        });
      }

      return updatedDeliverable;
    });

    return result;
  }

  /**
   * Xóa minh chứng với kiểm tra phân lập và quan hệ task-deliverable an toàn (ngăn IDOR/BOLA).
   */
  async deleteDeliverable(
    ctx: ApiRequestContext | { user: AuthenticatedUser | null },
    taskId: string,
    deliverableId: string
  ) {
    const user = resolveUser(ctx);

    if (!deliverableId || typeof deliverableId !== 'string') {
      throw new ValidationError('Mã minh chứng (deliverableId) là bắt buộc');
    }

    const deliverable = await prisma.taskDeliverable.findUnique({
      where: { id: deliverableId },
      include: {
        task: {
          include: {
            assignees: true,
          },
        },
      },
    });

    if (!deliverable) {
      throw new NotFoundError('Không tìm thấy tài liệu minh chứng');
    }

    // Bảo vệ BOLA/IDOR: Minh chứng phải thuộc đúng taskId yêu cầu
    if (deliverable.taskId !== taskId) {
      throw new AuthorizationError('Minh chứng không thuộc về nhiệm vụ được yêu cầu');
    }

    await requireTaskAuthorization(user.id, 'task.update_execution', deliverable.task);

    const requestId =
      ctx && 'requestId' in ctx && typeof ctx.requestId === 'string'
        ? ctx.requestId
        : undefined;

    const result = await prisma.$transaction(async (tx) => {
      await tx.taskDeliverable.delete({
        where: { id: deliverableId },
      });

      await tx.task.update({
        where: { id: taskId },
        data: { version: { increment: 1 } },
      });

      await logAuditEvent(tx, {
        actorId: user.id,
        action: 'TASK_DELIVERABLE_DELETED',
        entityType: AuditEntityType.TASK,
        entityId: taskId,
        requestId,
        beforeData: {
          deliverableId: deliverable.id,
          title: deliverable.title,
          fileUrl: deliverable.fileUrl,
        },
        afterData: null,
        metadata: {
          deletedAt: new Date().toISOString(),
        },
      });

      return { success: true, deliverableId };
    });

    return result;
  }

  /**
   * Lệnh nghiệm thu nhiệm vụ nguyên tử (chuyển sang COMPLETED).
   */
  async approveTask(
    ctx: ApiRequestContext | { user: AuthenticatedUser | null },
    taskId: string,
    options?: { expectedVersion?: number; note?: string; comment?: string; resolution?: string }
  ) {
    return this.updateTask(
      ctx,
      taskId,
      {
        status: TaskStatus.COMPLETED,
        progressPercent: 100,
        expectedVersion: options?.expectedVersion,
        note: options?.note,
        comment: options?.comment,
        resolution: options?.resolution,
      },
      { auditAction: AuditAction.TASK_APPROVED }
    );
  }

  /**
   * Lệnh từ chối / trả về yêu cầu làm lại (chuyển về IN_PROGRESS).
   */
  async rejectTask(
    ctx: ApiRequestContext | { user: AuthenticatedUser | null },
    taskId: string,
    options?: { expectedVersion?: number; note?: string; comment?: string; resolution?: string }
  ) {
    return this.updateTask(
      ctx,
      taskId,
      {
        status: TaskStatus.IN_PROGRESS,
        expectedVersion: options?.expectedVersion,
        note: options?.note,
        comment: options?.comment,
        resolution: options?.resolution,
      },
      { auditAction: AuditAction.TASK_REJECTED }
    );
  }
}

export const taskCommandService = new TaskCommandService();
