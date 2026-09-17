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
import {
  canUserCreateTask,
  canUserUpdateTask,
  canUserDeleteTask,
  canUserSubmitDeliverable,
  canUserReviewDeliverable,
  canUserTransitionStatus,
  checkActiveDelegation,
  isPrivilegedUser,
} from './task-policy';
import { taskStateMachine } from '@/domain/tasks/state-machine';

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
  departmentId?: string | null;
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
  departmentId?: string | null;
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

function resolveUser(
  ctx: ApiRequestContext | { user: AuthenticatedUser | null }
): AuthenticatedUser {
  if (!ctx.user) {
    throw new AuthenticationError('Unauthorized');
  }
  return ctx.user;
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

    let validDepartmentId: string | null = null;
    if (effectiveUnitId) {
      const dept = await tx.department.findUnique({
        where: { id: effectiveUnitId },
        select: { id: true },
      });
      if (dept) {
        validDepartmentId = dept.id;
      }
    }

    const task = await tx.task.create({
      data: {
        code,
        title: taskTitle,
        description: input.content,
        status: TaskStatus.IN_PROGRESS,
        originLevel,
        priority: TaskPriority.HIGH,
        scope,
        dueDate,
        academicMonth,
        academicYear,
        createdById: input.actorId,
        leadUnitId: effectiveUnitId,
        departmentId: validDepartmentId,
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
      if (!input?.title || !input?.dueDate || (!input?.departmentId && !input?.parentTaskId)) {
        throw new ValidationError('Thiếu thông tin bắt buộc (Tiêu đề, Hạn chót, Đơn vị)', fieldErrors);
      }
      throw new ValidationError('Dữ liệu tạo nhiệm vụ không hợp lệ', fieldErrors);
    }

    const {
      title,
      description,
      departmentId,
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
      departmentId: string | null;
      academicMonth: number;
      academicYear: string;
      scope: TaskScope;
    } | null = null;

    if (parentTaskId) {
      parentTask = await prisma.task.findUnique({
        where: { id: parentTaskId },
        select: { id: true, departmentId: true, academicMonth: true, academicYear: true, scope: true },
      });
      if (!parentTask) {
        throw new NotFoundError('Không tìm thấy nhiệm vụ cha');
      }
    }

    const effectiveDepartmentId = departmentId || parentTask?.departmentId || null;
    const monthNum = academicMonth
      ? Number(academicMonth)
      : (parentTask?.academicMonth ?? (new Date(dueDate).getMonth() + 1 || 9));
    const yearStr =
      academicYear ||
      parentTask?.academicYear ||
      getAcademicYear(dueDate || getSystemReferenceDate());

    if (!title || !dueDate || !effectiveDepartmentId) {
      throw new ValidationError('Thiếu thông tin bắt buộc (Tiêu đề, Hạn chót, Đơn vị)');
    }

    const curYear = new Date().getFullYear();

    let taskScope: TaskScope = parentTask?.scope || TaskScope.SCHOOL;
    if (scope) {
      const s = String(scope).toLowerCase();
      if (s === 'department') taskScope = TaskScope.DEPARTMENT;
      else if (s === 'individual') taskScope = TaskScope.INDIVIDUAL;
      else if (s === 'school') taskScope = TaskScope.SCHOOL;
    }

    const createCheck = canUserCreateTask(user, {
      scope: taskScope,
      departmentId: effectiveDepartmentId,
      // A subtask inherits its parent's scope; only an explicitly chosen scope
      // is subject to the scope-authority gate (P0-06).
      scopeExplicit: Boolean(scope) || !parentTaskId,
    });
    if (!createCheck.allowed) {
      throw new AuthorizationError(
        createCheck.reason || 'Forbidden: Insufficient authority to create task'
      );
    }

    let taskPriority: TaskPriority = TaskPriority.NORMAL;
    if (priority) {
      const p = String(priority).toLowerCase();
      if (p === 'urgent') taskPriority = TaskPriority.URGENT;
      else if (p === 'high') taskPriority = TaskPriority.HIGH;
      else if (p === 'low') taskPriority = TaskPriority.LOW;
    }

    const validAssigneeId =
      typeof assigneeId === 'string' && assigneeId.trim() ? assigneeId.trim() : null;
    const validCollaboratorIds = Array.isArray(collaboratorIds)
      ? Array.from(new Set(collaboratorIds)).filter(
          (id): id is string =>
            typeof id === 'string' && Boolean(id.trim()) && id.trim() !== validAssigneeId
        )
      : [];

    const assigneesToCreate: { userId: string; roleInTask: AssigneeRole }[] = [];
    if (validAssigneeId) {
      assigneesToCreate.push({
        userId: validAssigneeId,
        roleInTask: AssigneeRole.PRIMARY_OWNER,
      });
    }
    for (const cId of validCollaboratorIds) {
      assigneesToCreate.push({
        userId: cId,
        roleInTask: AssigneeRole.COLLABORATOR,
      });
    }

    // Thực hiện trong transaction
    const newTask = await prisma.$transaction(async (tx) => {
      const effectiveCreatorId = isPrivilegedUser(user) && creatorId ? creatorId : user.id;

      // Resolve valid department ID against database to guarantee foreign key integrity
      let validDepartmentId: string = effectiveDepartmentId;
      const dept = await tx.department.findFirst({
        where: {
          OR: [
            { id: effectiveDepartmentId },
            { id: effectiveDepartmentId.toUpperCase() },
            { id: effectiveDepartmentId.toLowerCase() },
            { shortName: effectiveDepartmentId },
            { name: effectiveDepartmentId },
          ],
        },
        select: { id: true },
      });
      if (dept) {
        validDepartmentId = dept.id;
      }

      // Sinh mã tự động atomic O(1)
      const code =
        customCode ||
        (await generateTaskCodeAtomic(tx, {
          year: curYear,
          month: monthNum,
          scope: taskScope,
          departmentCode: validDepartmentId,
        }));

      const task = await tx.task.create({
        data: {
          code,
          title,
          description: description || null,
          departmentId: validDepartmentId,
          dueDate: new Date(dueDate),
          academicMonth: monthNum,
          academicYear: yearStr,
          scope: taskScope,
          priority: taskPriority,
          createdById: effectiveCreatorId,
          parentTaskId: parentTaskId || null,
          ...(assigneesToCreate.length > 0
            ? {
                assignees: {
                  create: assigneesToCreate,
                },
              }
            : {}),
        },
        include: {
          department: true,
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

      // Synchronize TaskActors enforcing Single Primary DRI invariant
      const matchedOrgUnit = await tx.organizationalUnit.findFirst({
        where: {
          OR: [
            { id: effectiveDepartmentId },
            { code: effectiveDepartmentId },
          ],
        },
        select: { id: true },
      });
      const resolvedUnitId = matchedOrgUnit?.id || null;

      if (validAssigneeId) {
        await tx.taskActor.create({
          data: {
            taskId: task.id,
            userId: validAssigneeId,
            unitId: resolvedUnitId,
            role: TaskActorRole.DRI,
            isPrimaryDRI: true,
            assignedById: effectiveCreatorId,
          },
        });
      }
      for (const cId of validCollaboratorIds) {
        if (cId !== validAssigneeId) {
          await tx.taskActor.create({
            data: {
              taskId: task.id,
              userId: cId,
              unitId: resolvedUnitId,
              role: TaskActorRole.COLLABORATOR,
              isPrimaryDRI: false,
              assignedById: effectiveCreatorId,
            },
          });
        }
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
          departmentId: task.departmentId,
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
            collaboratorIds: validCollaboratorIds,
          },
        });
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

    const updateCheck = canUserUpdateTask(user, existing);
    if (!updateCheck.allowed) {
      throw new AuthorizationError(
        updateCheck.reason || 'Bạn không có quyền chỉnh sửa nhiệm vụ này'
      );
    }

    const {
      title,
      description,
      progressPercent,
      progress,
      status,
      priority,
      startDate,
      dueDate,
      departmentId,
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
    if (departmentId !== undefined) {
      scalarUpdateData.departmentId =
        typeof departmentId === 'string' && departmentId.trim() ? departmentId.trim() : null;
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
        const hasDelegation = await checkActiveDelegation(
          prisma,
          user.id,
          taskId,
          existing.departmentId
        );

        // Canonical State Machine Validation
        const fsmResult = taskStateMachine.canTransition(
          {
            id: user.id,
            role: user.role,
            departmentId: user.departmentId,
            isDelegated: hasDelegation,
          },
          {
            id: existing.id,
            scope: existing.scope,
            createdById: existing.createdById,
            departmentId: existing.departmentId,
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

        const transitionCheck = canUserTransitionStatus(
          user,
          existing,
          mappedStatus,
          {
            activeDelegation: hasDelegation,
            newAssigneeId: assigneeId !== undefined ? assigneeId : undefined,
          }
        );

        if (!transitionCheck.allowed) {
          throw new AuthorizationError(
            transitionCheck.reason || 'Bạn không có quyền thực hiện chuyển đổi trạng thái này'
          );
        }

        scalarUpdateData.status = mappedStatus;
        if (mappedStatus === TaskStatus.COMPLETED) {
          scalarUpdateData.completedAt = new Date();
          if (scalarUpdateData.progressPercent === undefined) {
            scalarUpdateData.progressPercent = 100;
          }
        } else if (existing.status === TaskStatus.COMPLETED) {
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

      if (collaboratorIds !== undefined) {
        const validCollabIds = Array.isArray(collaboratorIds)
          ? Array.from(new Set(collaboratorIds)).filter(
              (cId): cId is string =>
                typeof cId === 'string' &&
                Boolean(cId.trim()) &&
                cId.trim() !== effectivePrimaryOwnerId
            )
          : [];

        // Synchronize canonical TaskActor
        await tx.taskActor.deleteMany({
          where: { taskId, role: TaskActorRole.COLLABORATOR },
        });
        if (validCollabIds.length > 0) {
          await tx.taskActor.createMany({
            data: validCollabIds.map((cId) => ({
              taskId,
              userId: cId,
              role: TaskActorRole.COLLABORATOR,
              isPrimaryDRI: false,
              assignedById: user.id,
            })),
            skipDuplicates: true,
          });
        }

        // Legacy TaskAssignee compatibility
        await tx.taskAssignee.deleteMany({
          where: { taskId, roleInTask: AssigneeRole.COLLABORATOR },
        });

        if (validCollabIds.length > 0) {
          await tx.taskAssignee.createMany({
            data: validCollabIds.map((cId) => ({
              taskId,
              userId: cId,
              roleInTask: AssigneeRole.COLLABORATOR,
            })),
            skipDuplicates: true,
          });
        }
      }

      const updatedTask = await tx.task.findUniqueOrThrow({
        where: { id: taskId },
        include: {
          department: true,
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
      if (scalarUpdateData.dueDate) {
        const oldDueTime = existing.dueDate ? new Date(existing.dueDate).getTime() : null;
        const newDueDate = new Date(scalarUpdateData.dueDate as Date);
        if (oldDueTime !== newDueDate.getTime()) {
          auditLogged = true;
          await logAuditEvent(tx, {
            actorId: user.id,
            action: AuditAction.TASK_DEADLINE_CHANGED,
            entityType: AuditEntityType.TASK,
            entityId: taskId,
            requestId,
            beforeData: { dueDate: existing.dueDate ? existing.dueDate.toISOString() : null },
            afterData: { dueDate: newDueDate.toISOString() },
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
      select: { id: true, createdById: true },
    });

    if (!existing) {
      throw new NotFoundError('Không tìm thấy nhiệm vụ');
    }

    const deleteCheck = canUserDeleteTask(user, existing);
    if (!deleteCheck.allowed) {
      throw new AuthorizationError(
        deleteCheck.reason || 'Bạn không có quyền xóa nhiệm vụ này'
      );
    }

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
        await tx.dacumDelegation.deleteMany({ where: { taskId: { in: allSubtaskIds } } });
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
      await tx.dacumDelegation.deleteMany({ where: { taskId } });
      await tx.executiveResolution.deleteMany({ where: { taskId } });

      // 4. Xóa nhiệm vụ chính
      await tx.task.delete({ where: { id: taskId } });
    });

    return {
      success: true,
      message: 'Đã xóa nhiệm vụ thành công',
    };
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
        departmentId: true,
        assignees: { select: { userId: true } },
      },
    });

    if (!task) {
      throw new NotFoundError('Không tìm thấy nhiệm vụ');
    }

    const authCheck = canUserSubmitDeliverable(user, task);
    if (!authCheck.allowed) {
      throw new AuthorizationError(
        authCheck.reason || 'Forbidden: Insufficient authority to submit deliverable'
      );
    }

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

    const hasDelegation = await checkActiveDelegation(
      prisma,
      user.id,
      taskId,
      deliverable.task.departmentId
    );

    const reviewCheck = canUserReviewDeliverable(
      user,
      deliverable,
      deliverable.task,
      { activeDelegation: hasDelegation }
    );

    if (!reviewCheck.allowed) {
      throw new AuthorizationError(
        reviewCheck.reason || 'Bạn không có thẩm quyền nghiệm thu minh chứng này'
      );
    }

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
