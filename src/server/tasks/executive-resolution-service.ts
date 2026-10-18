/**
 * Nghị quyết / chỉ đạo điều hành của Ban Giám Hiệu trên nhiệm vụ.
 *
 * Quyền ban hành (mandate điều hành) do route kiểm trước khi gọi service; service kiểm quyền
 * trên từng nhiệm vụ qua canonical engine, kiểm phiên bản (OCC), ghi nghị quyết cùng audit
 * trong một transaction và gửi push sau khi transaction xong.
 */
import type { z } from 'zod';
import prisma from '@/lib/prisma';
import { ResolutionType, TaskPriority, TaskStatus } from '@prisma/client';
import { logAuditEvent } from '@/lib/db/audit';
import type { AuthenticatedUser } from '@/server/api/request-context';
import { ForbiddenError, NotFoundError, PreconditionFailedError, ValidationError } from '@/server/api/errors';
import { authorize } from '@/server/authorization/authorization-engine';
import { buildTaskResource } from '@/server/authorization/available-actions';
import type { AuthorizationContext } from '@/server/authorization/authorization-context';
import type { CapabilityAction } from '@/server/authorization/capability';
import type { CreateExecutiveResolutionSchema } from '@/contracts/executive';
import { safeAfter, dispatchExecutiveDirectivePush } from '@/server/notifications/push-dispatch';

/**
 * Maps each executive resolution type to the canonical task capability that
 * carries the same business power. There is no `executive.*` capability in
 * the canonical catalog by design: executive direction is expressed through
 * the task verbs it actually exercises.
 */
const RESOLUTION_TASK_ACTION: Record<string, CapabilityAction> = {
  EXTEND_DEADLINE: 'task.update_execution',
  REASSIGN_OWNER: 'task.reassign',
  DIRECTIVE_NOTE: 'task.review',
  DISMISS_BOTTLENECK: 'task.update_execution',
};

function mapResolutionType(rawType: string): ResolutionType | null {
  const upper = rawType?.toUpperCase();
  if (upper === 'EXTEND_DEADLINE') return ResolutionType.EXTEND_DEADLINE;
  if (upper === 'REASSIGN' || upper === 'REASSIGN_OWNER')
    return ResolutionType.REASSIGN_OWNER;
  if (
    upper === 'DIRECTIVE_NOTE' ||
    upper === 'DEMAND_EXPLANATION' ||
    upper === 'DIRECT_DIRECTIVE'
  ) {
    return ResolutionType.DIRECTIVE_NOTE;
  }
  if (upper === 'DISMISS_BOTTLENECK') return ResolutionType.DISMISS_BOTTLENECK;
  if (Object.values(ResolutionType).includes(upper as ResolutionType)) {
    return upper as ResolutionType;
  }
  return null;
}

function normalizeTaskStatus(rawStatus?: string | null): TaskStatus | null {
  if (!rawStatus) return null;
  const upper = rawStatus.toUpperCase();
  const statusMap: Record<string, TaskStatus> = {
    NOT_STARTED: TaskStatus.NOT_STARTED,
    IN_PROGRESS: TaskStatus.IN_PROGRESS,
    WAITING_APPROVAL: TaskStatus.WAITING_APPROVAL,
    COMPLETED: TaskStatus.COMPLETED,
    CANCELLED: TaskStatus.CANCELLED,
  };
  return statusMap[upper] || null;
}

function normalizeTaskPriority(rawPriority?: string | null): TaskPriority | null {
  if (!rawPriority) return null;
  const upper = rawPriority.toUpperCase();
  const priorityMap: Record<string, TaskPriority> = {
    URGENT: TaskPriority.URGENT,
    HIGH: TaskPriority.HIGH,
    NORMAL: TaskPriority.NORMAL,
    MEDIUM: TaskPriority.NORMAL,
    LOW: TaskPriority.LOW,
    NONE: TaskPriority.NONE,
  };
  return priorityMap[upper] || null;
}

export async function listExecutiveResolutions({
  taskId,
  resolutionType,
  departmentId,
  limit,
}: {
  taskId?: string;
  resolutionType?: string;
  departmentId?: string;
  limit: number;
}) {
  const where: any = {};
  if (taskId) {
    where.taskId = taskId;
  }
  if (resolutionType) {
    const normalized = mapResolutionType(resolutionType);
    if (normalized) {
      where.resolutionType = normalized;
    }
  }
  if (departmentId) {
    where.task = { ...(where.task || {}), leadUnitId: departmentId };
  }

  return await prisma.executiveResolution.findMany({
    where,
    include: {
      actor: {
        select: {
          id: true,
          name: true,
          role: true,
          avatarUrl: true,
        },
      },
      task: {
        select: {
          id: true,
          code: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          leadUnitId: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function createExecutiveResolution({
  authContext,
  authUser,
  input: validated,
  expectedVersion,
  requestId,
}: {
  authContext: AuthorizationContext;
  authUser: AuthenticatedUser;
  input: z.infer<typeof CreateExecutiveResolutionSchema>;
  expectedVersion: number | undefined;
  requestId: string;
}) {
  const rawType =
    validated.resolutionType || validated.actionType || validated.type;
  const mappedResolutionType = mapResolutionType(rawType!);
  if (!mappedResolutionType) {
    throw new ValidationError(`Loại can thiệp không hợp lệ: ${rawType}`);
  }

  const grantedDays = validated.grantedDays || validated.extensionDays;

  const task = await prisma.task.findUnique({
    where: { id: validated.taskId },
    include: { leadUnit: true },
  });

  if (!task) {
    throw new NotFoundError('Không tìm thấy nhiệm vụ');
  }

  // Object-level authorization: the executive mandate (route) decides WHO may
  // direct; this decides WHAT power may be exercised on THIS task, through
  // the canonical engine (scope, portfolio, workflow, SoD — and a second,
  // independent denial for technical admins via separation-of-powers).
  const taskAction: CapabilityAction =
    RESOLUTION_TASK_ACTION[mappedResolutionType] ?? 'task.update_execution';
  const actionDecision = authorize(authContext, taskAction, buildTaskResource(task));
  if (!actionDecision.allowed) {
    throw new ForbiddenError(
      actionDecision.reason || 'Bạn không có quyền ban hành chỉ đạo này trên nhiệm vụ'
    );
  }

  if (expectedVersion !== undefined && task.version !== expectedVersion) {
    throw new PreconditionFailedError(
      `Task aggregate version conflict: expected version ${expectedVersion}`
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    let previousDueDate: Date | null = null;
    let newDueDate: Date | null = null;
    let previousOwnerId: string | null = null;

    const taskUpdateData: any = {};

    if (
      mappedResolutionType === ResolutionType.EXTEND_DEADLINE &&
      grantedDays
    ) {
      const days = Number(grantedDays);
      if (!isNaN(days) && days > 0) {
        previousDueDate = task.dueDate;
        newDueDate = new Date(
          task.dueDate.getTime() + days * 24 * 60 * 60 * 1000
        );
        taskUpdateData.dueDate = newDueDate;

        if ((task.status as string) === 'OVERDUE') {
          taskUpdateData.status = TaskStatus.IN_PROGRESS;
        }
      }
    } else if (
      mappedResolutionType === ResolutionType.REASSIGN_OWNER &&
      validated.newOwnerId
    ) {
      previousOwnerId = task.leadUnitId;
      // Phase 9: Department model dropped — update leadUnitId directly
      taskUpdateData.leadUnitId = validated.newOwnerId;
      if ((task.status as string) === 'OVERDUE') {
        taskUpdateData.status = TaskStatus.IN_PROGRESS;
      }
    } else if (mappedResolutionType === ResolutionType.DIRECTIVE_NOTE) {
      taskUpdateData.priority = TaskPriority.URGENT;
    } else if (mappedResolutionType === ResolutionType.DISMISS_BOTTLENECK) {
      taskUpdateData.status = TaskStatus.IN_PROGRESS;
    }

    const explicitStatus = normalizeTaskStatus(
      validated.status || validated.taskStatus
    );
    if (explicitStatus) {
      taskUpdateData.status = explicitStatus;
      if (explicitStatus === TaskStatus.COMPLETED) {
        taskUpdateData.completedAt = new Date();
      }
    }

    const explicitPriority = normalizeTaskPriority(
      validated.priority || validated.taskPriority
    );
    if (explicitPriority) {
      taskUpdateData.priority = explicitPriority;
    }

    // Enforce atomic OCC and aggregate version increment
    const occWhere = expectedVersion !== undefined
      ? { id: validated.taskId, version: expectedVersion }
      : { id: validated.taskId, version: task.version };

    const updateResult = await tx.task.updateMany({
      where: occWhere,
      data: {
        ...taskUpdateData,
        version: { increment: 1 },
      },
    });

    if (updateResult.count === 0) {
      throw new PreconditionFailedError(
        expectedVersion !== undefined
          ? `Task aggregate version conflict: expected version ${expectedVersion}`
          : 'Task aggregate version conflict: task was concurrently modified'
      );
    }

    const updatedTask = await tx.task.findUniqueOrThrow({
      where: { id: validated.taskId },
      include: { leadUnit: true },
    });

    const resolution = await tx.executiveResolution.create({
      data: {
        taskId: validated.taskId,
        actorId: authUser.id,
        resolutionType: mappedResolutionType,
        directiveNote: validated.directiveNote || null,
        grantedDays: grantedDays ? Number(grantedDays) : null,
        previousDueDate,
        newDueDate,
        previousOwnerId,
        newOwnerId: validated.newOwnerId || null,
      },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            role: true,
            avatarUrl: true,
          },
        },
        task: {
          select: {
            id: true,
            code: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
            leadUnitId: true,
          },
        },
      },
    });

    // Immutable audit log
    await logAuditEvent(tx, {
      action: 'EXECUTIVE_RESOLUTION_CREATED',
      entityType: 'ExecutiveResolution',
      entityId: resolution.id,
      actorId: authUser.id,
      requestId,
      metadata: {
        actorRole: authUser.role,
        taskId: validated.taskId,
        resolutionType: mappedResolutionType,
        directiveNote: validated.directiveNote || null,
        newOwnerId: validated.newOwnerId || null,
        grantedDays: grantedDays ? Number(grantedDays) : null,
      },
    });

    return { resolution, updatedTask };
  });

  // Background push notification dispatch via Next.js 15 after()
  safeAfter(async () => {
    const start = Date.now();
    try {
      await dispatchExecutiveDirectivePush({
        taskId: task.id,
        taskTitle: task.title,
        resolutionType: mappedResolutionType,
        directiveNote: validated.directiveNote || null,
        actorName: authUser.name || 'Ban Giám Hiệu',
        actorId: authUser.id,
        departmentId: result.updatedTask.leadUnitId || task.leadUnitId,
        newOwnerId: validated.newOwnerId || null,
      });
    } catch (pushError) {
      console.error('[after() Executive Directive Push Error]', {
        taskId: task.id,
        resolutionId: result.resolution.id,
        durationMs: Date.now() - start,
        error: pushError instanceof Error ? pushError.message : String(pushError),
      });
    }
  });

  return result;
}
