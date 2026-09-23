import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  TaskStatus,
  TaskActorRole,
  DeliverableReviewStatus,
  ApprovalProcessStatus,
  ApprovalStepStatus,
} from "@prisma/client";
import { SessionPayload } from "@/lib/jwt-session";
import {
  auditService,
  AuditAction,
  AuditEntityType,
} from "@/lib/db/audit";
import {
  publishOutboxEvent,
  OutboxEventType,
  OutboxAggregateType,
} from "@/lib/db/outbox";
import {
  setTaskDRI,
  executeApprovalStep,
  SegregationOfDutiesError,
  MakerCheckerError,
  TaskActorAuthorizationError,
  StepProgressionError,
} from "@/lib/services/task-actor-service";
import { authorize } from "@/server/authorization/authorization-engine";
import { loadAuthorizationContext } from "@/server/authorization/authorization-context-service";
import type { AuthorizationResource } from "@/server/authorization/resource";
import type { CapabilityAction } from "@/server/authorization/capability";
import {
  SeparationOfDutiesError,
  SingleDRIError,
} from "@/server/authorization/errors";
import {
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  ConflictError,
  InvalidTransitionError,
  PreconditionFailedError,
} from "@/server/api/errors";
import { recalculateParentTaskProgress } from "@/server/tasks/task-command-service";
import {
  taskStateMachine,
  buildActorContext,
  buildTaskContext,
  getStatusLabel,
} from "@/domain/tasks/state-machine";

// ============================================================================
// Input Validation Schemas
// ============================================================================

export const UpdateStatusInputSchema = z.object({
  status: z.nativeEnum(TaskStatus),
  note: z.string().trim().max(1000).optional(),
  expectedVersion: z.number().int().min(0).optional(),
}).strict();

export type UpdateStatusInput = z.infer<typeof UpdateStatusInputSchema>;

export const SubmitResultInputSchema = z
  .object({
    summary: z.string().optional(),
    title: z.string().optional(),
    note: z.string().optional(),
    reportUrl: z.string().url("Đường dẫn báo cáo không hợp lệ").optional().or(z.literal("")),
    deliverableId: z.string().optional(),
    fileUrl: z.string().optional(),
    fileType: z.string().optional(),
    fileSize: z.number().optional(),
    completionRate: z.number().optional(),
    expectedVersion: z.number().int().min(0).optional(),
  })
  .refine((data) => Boolean(data.summary?.trim() || data.title?.trim() || data.note?.trim()), {
    message: "Tóm tắt kết quả (summary) hoặc tiêu đề minh chứng (title) là bắt buộc",
  }).strict();

export type SubmitResultInput = z.infer<typeof SubmitResultInputSchema>;

export const StartInputSchema = z.object({
  note: z.string().trim().max(1000).optional(),
  expectedVersion: z.number().int().min(0).optional(),
}).strict();

export type StartInput = z.infer<typeof StartInputSchema>;

export const UpdateProgressInputSchema = z.object({
  progressPercent: z.number().min(0, "Tiến độ phải từ 0% đến 100%").max(100, "Tiến độ không được vượt quá 100%"),
  note: z.string().trim().max(1000).optional(),
  expectedVersion: z.number().int().min(0).optional(),
  targetStatus: z.nativeEnum(TaskStatus).optional(),
}).strict();

export type UpdateProgressInput = z.infer<typeof UpdateProgressInputSchema>;

export const CancelInputSchema = z.object({
  reason: z.string().trim().min(3, "Lý do hủy nhiệm vụ tối thiểu 3 ký tự").max(1000),
  note: z.string().trim().max(1000).optional(),
  expectedVersion: z.number().int().min(0).optional(),
}).strict();

export type CancelInput = z.infer<typeof CancelInputSchema>;

export const ReviewInputSchema = z.object({
  resultId: z.string().optional(),
  deliverableId: z.string().optional(),
  stepId: z.string().optional(),
  reviewStatus: z.enum(["APPROVED", "REJECTED", "REVISION_REQUIRED"]).optional(),
  decision: z.enum(["APPROVED", "REJECTED"]).optional(),
  reviewNote: z.string().optional(),
  note: z.string().optional(),
  expectedVersion: z.number().int().min(0).optional(),
}).strict();

export type ReviewInput = z.infer<typeof ReviewInputSchema>;

export const RequestRevisionInputSchema = z.object({
  reason: z.string().min(1, "Lý do yêu cầu làm lại là bắt buộc"),
  note: z.string().optional(),
  deliverableId: z.string().optional(),
  resultId: z.string().optional(),
  stepId: z.string().optional(),
  expectedVersion: z.number().int().min(0),
}).strict();

export type RequestRevisionInput = z.infer<typeof RequestRevisionInputSchema>;

export const ApproveInputSchema = z.object({
  note: z.string().optional(),
  stepId: z.string().optional(),
  expectedVersion: z.number().int().min(0),
}).strict();

export type ApproveInput = z.infer<typeof ApproveInputSchema>;

export const ReassignInputSchema = z.object({
  newAssigneeId: z.string().min(1, "Mã người được chỉ định là bắt buộc"),
  role: z.literal("DRI").optional().default("DRI"),
  isPrimaryDRI: z.boolean().optional().default(true),
  note: z.string().optional(),
  expectedVersion: z.number().int().min(0),
}).strict();

export type ReassignInput = z.infer<typeof ReassignInputSchema>;

export const RemindInputSchema = z.object({
  message: z.string().optional(),
  urgency: z.enum(["NORMAL", "HIGH", "URGENT"]).optional().default("NORMAL"),
  targetUserIds: z.array(z.string()).optional(),
  expectedVersion: z.number().int().min(0),
}).strict();

export type RemindInput = z.infer<typeof RemindInputSchema>;

// ============================================================================
// Context Builders & Helpers
// ============================================================================

async function buildUserContext(session: SessionPayload) {
  return loadAuthorizationContext(session.id, new Date(), { useCache: true, ttlMs: 10_000 });
}

export async function loadTaskAndBuildResource(
  taskId: string,
  extra?: { deliverableId?: string; resultId?: string; stepId?: string }
) {
  const task = await prisma.task.findUnique({
    where: { id: taskId, archivedAt: null },
    include: {
      actors: {
        include: { user: true },
      },
      taskResults: {
        orderBy: { submittedAt: "desc" },
        take: 5,
      },
      deliverables: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      approvalProcesses: {
        where: {
          status: { in: [ApprovalProcessStatus.IN_REVIEW, ApprovalProcessStatus.NOT_STARTED] },
        },
        include: {
          steps: {
            orderBy: { stepOrder: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!task) {
    throw new NotFoundError(`Không tìm thấy nhiệm vụ với ID: ${taskId}`);
  }

  const primaryOwnerActor =
    task.actors.find((a) => a.role === TaskActorRole.DRI && a.isPrimaryDRI) ||
    task.actors.find((a) => a.role === TaskActorRole.DRI);
  const primaryOwnerId = primaryOwnerActor?.userId || undefined;

  const collaboratorIds = Array.from(
    new Set(
      task.actors
        .filter((a) => a.role === TaskActorRole.COLLABORATOR && a.userId)
        .map((a) => a.userId as string)
    )
  );

  const reviewerIds = task.actors
    .filter((a) => a.role === TaskActorRole.REVIEWER && a.userId)
    .map((a) => a.userId as string);

  const approverIds = task.actors
    .filter((a) => a.role === TaskActorRole.APPROVER && a.userId)
    .map((a) => a.userId as string);

  const assigneeIds = Array.from(
    new Set(
      task.actors.map((a) => a.userId).filter(Boolean) as string[]
    )
  );

  let targetDeliverable = extra?.deliverableId
    ? task.deliverables.find((d) => d.id === extra.deliverableId)
    : undefined;
  if (!targetDeliverable && extra?.deliverableId) {
    targetDeliverable =
      (await prisma.taskDeliverable.findFirst({
        where: { id: extra.deliverableId, taskId },
      })) ?? undefined;
    if (!targetDeliverable) {
      throw new NotFoundError("Không tìm thấy tệp bàn giao thuộc nhiệm vụ này");
    }
  }

  let targetResult = extra?.resultId
    ? task.taskResults.find((r) => r.id === extra.resultId)
    : undefined;
  if (!targetResult && extra?.resultId) {
    targetResult =
      (await prisma.taskResult.findFirst({
        where: { id: extra.resultId, taskId },
      })) ?? undefined;
    if (!targetResult) {
      throw new NotFoundError("Không tìm thấy kết quả thuộc nhiệm vụ này");
    }
  }

  if (extra?.stepId) {
    const stepInTask = task.approvalProcesses.some((proc) =>
      proc.steps.some((s) => s.id === extra.stepId)
    );
    if (!stepInTask) {
      const stepWithProcess = await prisma.taskApprovalStep.findFirst({
        where: {
          id: extra.stepId,
          process: { taskId },
        },
      });
      if (!stepWithProcess) {
        throw new NotFoundError("Không tìm thấy bước phê duyệt thuộc nhiệm vụ này");
      }
    }
  }

  const submittedByUserId =
    targetDeliverable?.uploadedById ||
    targetResult?.submittedByUserId ||
    task.taskResults[0]?.submittedByUserId ||
    task.deliverables[0]?.uploadedById ||
    undefined;

  const resource: AuthorizationResource = {
    id: task.id,
    type: "task",
    scope: task.scope.toLowerCase(),
    departmentId: task.departmentId ?? undefined,
    leadDepartmentId: task.leadUnitId ?? undefined,
    createdById: task.createdById,
    assignerId: task.createdById,
    primaryOwnerId,
    collaboratorIds,
    reviewerIds,
    approverIds,
    assigneeIds,
    submittedByUserId,
    uploadedById: targetDeliverable?.uploadedById ?? undefined,
  };

  return { task, resource, targetDeliverable, targetResult, primaryOwnerId };
}

function assertAuthAllowed(
  authResult: Awaited<ReturnType<typeof authorize>>,
  action: CapabilityAction,
  taskId: string
) {
  if (!authResult.allowed) {
    if (
      authResult.rejectionCode === "SOD_VIOLATION" ||
      authResult.rejectionCode === "SEPARATION_OF_DUTIES_VIOLATION"
    ) {
      throw new SeparationOfDutiesError(
        authResult.reason || "Vi phạm nguyên tắc phân lập trách nhiệm (SoD)"
      );
    }
    if (authResult.rejectionCode === "COLLABORATOR_CANNOT_REASSIGN_DRI") {
      throw new SingleDRIError();
    }
    throw new AuthorizationError(authResult.reason || "Bạn không có quyền thực hiện thao tác này");
  }
}

// ============================================================================
// Domain Command Actions Service
// ============================================================================

export class TaskDomainActionService {
  /**
   * Action: update-status
   * POST /api/tasks/[id]/actions/update-status
   * Dedicated domain command for task status transitions.
   * Enforces State Machine rules, Maker-Checker / SoD invariants, OCC, and single activity log.
   */
  async updateStatus(session: SessionPayload, taskId: string, input: UpdateStatusInput) {
    const validated = UpdateStatusInputSchema.parse(input);
    const userContext = await buildUserContext(session);
    const { task, resource, primaryOwnerId } = await loadTaskAndBuildResource(taskId);

    if (validated.expectedVersion !== undefined && task.version !== Number(validated.expectedVersion)) {
      throw new PreconditionFailedError(
        `Task aggregate version conflict: expected version ${validated.expectedVersion}, current version ${task.version}`
      );
    }

    if (task.status === validated.status) {
      return {
        taskId,
        status: task.status,
        progressPercent: task.progressPercent ?? 0,
        version: task.version,
      };
    }

    // 1. Domain State Machine Validation
    const actorContext = buildActorContext({
      id: session.id,
      role: session.role || "STAFF",
      departmentId: session.departmentId,
    });
    const taskContext = buildTaskContext({
      id: task.id,
      scope: task.scope,
      createdById: task.createdById,
      departmentId: task.departmentId,
      primaryOwnerId,
      assignees: task.actors,
      deliverables: task.deliverables,
    });

    const fsmResult = taskStateMachine.canTransition(actorContext, taskContext, task.status, validated.status);
    if (!fsmResult.allowed) {
      throw new InvalidTransitionError(
        fsmResult.reason || "Chuyển đổi trạng thái không hợp lệ",
        fsmResult.code || "INVALID_STATUS_TRANSITION",
        {
          fromStatus: task.status,
          toStatus: validated.status,
          reason: fsmResult.reason,
        }
      );
    }

    const authResult = authorize(userContext, "task.update_execution", resource);
    assertAuthAllowed(authResult, "task.update_execution", taskId);

    const noteText = validated.note?.trim() || null;
    const targetStatus = validated.status;

    return await prisma.$transaction(async (tx) => {
      // Clean up approval processes if moving away from WAITING_APPROVAL
      if (
        task.status === TaskStatus.WAITING_APPROVAL &&
        targetStatus === TaskStatus.IN_PROGRESS &&
        task.approvalProcesses &&
        task.approvalProcesses.length > 0
      ) {
        for (const process of task.approvalProcesses) {
          await tx.taskApprovalStep.updateMany({
            where: {
              processId: process.id,
              status: ApprovalStepStatus.PENDING,
            },
            data: {
              decisionNote: noteText || "Chuyển về trạng thái đang thực hiện",
            },
          });
          await tx.taskApprovalProcess.update({
            where: { id: process.id },
            data: { status: ApprovalProcessStatus.CANCELLED },
          });
        }
      }

      // Auto-approve approval processes if transitioning to COMPLETED
      if (
        targetStatus === TaskStatus.COMPLETED &&
        task.approvalProcesses &&
        task.approvalProcesses.length > 0
      ) {
        for (const process of task.approvalProcesses) {
          await tx.taskApprovalStep.updateMany({
            where: {
              processId: process.id,
              status: ApprovalStepStatus.PENDING,
            },
            data: {
              status: ApprovalStepStatus.APPROVED,
              decidedAt: new Date(),
              reviewerUserId: session.id,
              decisionNote: noteText || "Nghiệm thu hoàn thành nhiệm vụ",
            },
          });
          await tx.taskApprovalProcess.update({
            where: { id: process.id },
            data: { status: ApprovalProcessStatus.APPROVED },
          });
        }
      }

      // Determine progress percent
      let targetProgress = task.progressPercent ?? 0;
      if (targetStatus === TaskStatus.COMPLETED) {
        targetProgress = 100;
      } else if (targetStatus === TaskStatus.NOT_STARTED) {
        targetProgress = 0;
      } else if (targetStatus === TaskStatus.IN_PROGRESS) {
        if (task.status === TaskStatus.COMPLETED) {
          targetProgress = 50;
        } else if (task.status === TaskStatus.WAITING_APPROVAL && targetProgress === 100) {
          targetProgress = 90;
        }
      } else if (targetStatus === TaskStatus.WAITING_APPROVAL) {
        if (targetProgress < 100) {
          targetProgress = 100;
        }
      }

      const updatedTask = await tx.task.update({
        where: { id: taskId },
        data: {
          status: targetStatus,
          progressPercent: targetProgress,
          completedAt: targetStatus === TaskStatus.COMPLETED ? new Date() : null,
          version: { increment: 1 },
          updatedAt: new Date(),
        },
      });

      const fromLabel = getStatusLabel(task.status);
      const toLabel = getStatusLabel(targetStatus);
      const triggerReason = `Chuyển trạng thái từ "${fromLabel}" sang "${toLabel}"${noteText ? ` (${noteText})` : ""}`;

      // Log EXACTLY ONE audit event for status change (no duplicate TASK_UPDATED)
      await auditService.logEvent(tx, {
        actorId: session.id,
        action: AuditAction.TASK_STATUS_CHANGED,
        entityType: AuditEntityType.TASK,
        entityId: taskId,
        beforeData: { status: task.status, progressPercent: task.progressPercent },
        afterData: {
          status: targetStatus,
          progressPercent: targetProgress,
          note: noteText,
          triggerReason,
        },
      });

      await publishOutboxEvent(tx, {
        eventType: OutboxEventType.TASK_STATUS_NOTIFICATION,
        aggregateType: OutboxAggregateType.TASK,
        aggregateId: taskId,
        payload: {
          taskId,
          status: targetStatus,
          progressPercent: targetProgress,
          actorId: session.id,
          note: noteText,
        },
      });

      if (task.parentTaskId) {
        await recalculateParentTaskProgress(tx, task.parentTaskId, session.id);
      }

      return {
        taskId,
        status: targetStatus,
        progressPercent: targetProgress,
        version: updatedTask.version,
      };
    });
  }

  /**
   * Action: start
   * POST /api/tasks/[id]/actions/start
   * Transitions task from NOT_STARTED to IN_PROGRESS.
   */
  async start(session: SessionPayload, taskId: string, input?: StartInput) {
    const validated = StartInputSchema.parse(input || {});
    const userContext = await buildUserContext(session);
    const { task, resource } = await loadTaskAndBuildResource(taskId);

    if (validated?.expectedVersion !== undefined && task.version !== Number(validated.expectedVersion)) {
      throw new PreconditionFailedError(
        `Task aggregate version conflict: expected version ${validated.expectedVersion}, current version ${task.version}`
      );
    }

    const authResult = await authorize(userContext, "task.update_execution", resource);
    assertAuthAllowed(authResult, "task.update_execution", taskId);

    if (task.status === TaskStatus.IN_PROGRESS) {
      return {
        taskId,
        status: TaskStatus.IN_PROGRESS,
        progressPercent: task.progressPercent ?? 0,
        version: task.version,
      };
    }

    const noteText = validated?.note?.trim() || null;

    return await prisma.$transaction(async (tx) => {
      // Nếu nhiệm vụ đang chờ duyệt mà chuyển về đang thực hiện: hủy các pending step để tiếp tục chỉnh sửa
      if (task.status === TaskStatus.WAITING_APPROVAL && task.approvalProcesses && task.approvalProcesses.length > 0) {
        for (const process of task.approvalProcesses) {
          await tx.taskApprovalStep.updateMany({
            where: {
              processId: process.id,
              status: ApprovalStepStatus.PENDING,
            },
            data: {
              decisionNote: noteText || "Chuyển về trạng thái đang thực hiện",
            },
          });
          await tx.taskApprovalProcess.update({
            where: { id: process.id },
            data: { status: ApprovalProcessStatus.CANCELLED },
          });
        }
      }

      const newProgress =
        task.status === TaskStatus.WAITING_APPROVAL && (task.progressPercent ?? 0) === 100
          ? 90
          : task.progressPercent ?? 0;

      const updatedTask = await tx.task.update({
        where: { id: taskId },
        data: {
          status: TaskStatus.IN_PROGRESS,
          progressPercent: newProgress,
          completedAt: null,
          version: { increment: 1 },
          updatedAt: new Date(),
        },
      });

      await auditService.logEvent(tx, {
        actorId: session.id,
        action: AuditAction.TASK_STATUS_CHANGED,
        entityType: AuditEntityType.TASK,
        entityId: taskId,
        beforeData: { status: task.status, progressPercent: task.progressPercent },
        afterData: {
          status: TaskStatus.IN_PROGRESS,
          progressPercent: updatedTask.progressPercent,
          note: noteText,
        },
      });

      await publishOutboxEvent(tx, {
        eventType: OutboxEventType.TASK_STATUS_NOTIFICATION,
        aggregateType: OutboxAggregateType.TASK,
        aggregateId: taskId,
        payload: {
          taskId,
          status: TaskStatus.IN_PROGRESS,
          actorId: session.id,
          note: noteText,
        },
      });

      if (task.parentTaskId) {
        await recalculateParentTaskProgress(tx, task.parentTaskId, session.id);
      }

      return {
        taskId,
        status: TaskStatus.IN_PROGRESS,
        progressPercent: updatedTask.progressPercent,
        version: updatedTask.version,
      };
    });
  }

  /**
   * Action: update-progress
   * POST /api/tasks/[id]/actions/update-progress
   * Updates task progress percentage (0-100) while in IN_PROGRESS state.
   */
  async updateProgress(session: SessionPayload, taskId: string, input: UpdateProgressInput) {
    const validated = UpdateProgressInputSchema.parse(input);
    const userContext = await buildUserContext(session);
    const { task, resource } = await loadTaskAndBuildResource(taskId);

    if (validated.expectedVersion !== undefined && task.version !== Number(validated.expectedVersion)) {
      throw new PreconditionFailedError(
        `Task aggregate version conflict: expected version ${validated.expectedVersion}, current version ${task.version}`
      );
    }

    const authResult = await authorize(userContext, "task.update_execution", resource);
    assertAuthAllowed(authResult, "task.update_execution", taskId);

    if (task.status === TaskStatus.COMPLETED && !validated.targetStatus) {
      throw new InvalidTransitionError(
        "Nhiệm vụ đã hoàn thành, không thể cập nhật tiến độ",
        "TASK_ALREADY_COMPLETED"
      );
    }
    if (task.status === TaskStatus.CANCELLED && !validated.targetStatus) {
      throw new InvalidTransitionError(
        "Nhiệm vụ đã bị hủy, không thể cập nhật tiến độ",
        "TASK_CANCELLED"
      );
    }

    // Tự động xác định trạng thái theo tiến độ (REQ-1 & REQ-4) nếu không chỉ định targetStatus:
    // - NOT_STARTED & progressPercent > 0 -> IN_PROGRESS
    // - progressPercent === 100 -> WAITING_APPROVAL
    // - WAITING_APPROVAL & progressPercent < 100 -> IN_PROGRESS
    let targetStatus = validated.targetStatus || task.status;
    if (!validated.targetStatus) {
      if (validated.progressPercent === 100) {
        targetStatus = TaskStatus.WAITING_APPROVAL;
      } else if (validated.progressPercent > 0) {
        if (task.status === TaskStatus.NOT_STARTED || task.status === TaskStatus.WAITING_APPROVAL) {
          targetStatus = TaskStatus.IN_PROGRESS;
        }
      } else {
        // validated.progressPercent === 0
        if (task.status === TaskStatus.WAITING_APPROVAL) {
          targetStatus = TaskStatus.IN_PROGRESS;
        }
      }
    }

    const noteText = validated.note?.trim() || null;
    const isStatusChanged = targetStatus !== task.status;

    return await prisma.$transaction(async (tx) => {
      const updatedTask = await tx.task.update({
        where: { id: taskId },
        data: {
          progressPercent: validated.progressPercent,
          status: targetStatus,
          completedAt: targetStatus === TaskStatus.COMPLETED ? new Date() : null,
          version: { increment: 1 },
          updatedAt: new Date(),
        },
      });

      if (isStatusChanged) {
        await auditService.logEvent(tx, {
          actorId: session.id,
          action: AuditAction.TASK_STATUS_CHANGED,
          entityType: AuditEntityType.TASK,
          entityId: taskId,
          beforeData: { status: task.status, progressPercent: task.progressPercent },
          afterData: {
            status: targetStatus,
            progressPercent: validated.progressPercent,
            note: noteText,
          },
        });
      } else {
        await auditService.logEvent(tx, {
          actorId: session.id,
          action: AuditAction.TASK_UPDATED,
          entityType: AuditEntityType.TASK,
          entityId: taskId,
          beforeData: { progressPercent: task.progressPercent },
          afterData: {
            progressPercent: validated.progressPercent,
            note: noteText,
          },
        });
      }

      await publishOutboxEvent(tx, {
        eventType: OutboxEventType.TASK_STATUS_NOTIFICATION,
        aggregateType: OutboxAggregateType.TASK,
        aggregateId: taskId,
        payload: {
          taskId,
          status: targetStatus,
          progressPercent: validated.progressPercent,
          actorId: session.id,
          note: noteText,
        },
      });

      if (task.parentTaskId) {
        await recalculateParentTaskProgress(tx, task.parentTaskId, session.id);
      }

      return {
        taskId,
        status: targetStatus,
        progressPercent: validated.progressPercent,
        version: updatedTask.version,
      };
    });
  }

  /**
   * Action 1: submit-result
   * POST /api/tasks/[id]/actions/submit-result
   * Submits result/deliverables, transitions state to WAITING_APPROVAL, enforces Maker-Checker.
   */
  async submitResult(session: SessionPayload, taskId: string, input: SubmitResultInput) {
    const validated = SubmitResultInputSchema.parse(input);
    const userContext = await buildUserContext(session);
    const { task, resource } = await loadTaskAndBuildResource(taskId);

    if (validated.expectedVersion !== undefined && task.version !== Number(validated.expectedVersion)) {
      throw new PreconditionFailedError(
        `Task aggregate version conflict: expected version ${validated.expectedVersion}, current version ${task.version}`
      );
    }

    const authResult = await authorize(userContext, "task.submit_result", resource);
    assertAuthAllowed(authResult, "task.submit_result", taskId);

    if (
      task.status === TaskStatus.COMPLETED ||
      task.status === TaskStatus.CANCELLED
    ) {
      throw new InvalidTransitionError(
        `Không thể nộp kết quả cho nhiệm vụ đã ${
          task.status === TaskStatus.COMPLETED ? "hoàn thành" : "bị hủy"
        }.`
      );
    }

    const summaryText =
      validated.summary?.trim() ||
      validated.title?.trim() ||
      validated.note?.trim() ||
      "Nộp kết quả thực hiện nhiệm vụ";
    const reportUrlText = validated.reportUrl?.trim() || validated.fileUrl?.trim() || null;

    return await prisma.$transaction(async (tx) => {
      const taskResult = await tx.taskResult.create({
        data: {
          taskId,
          submittedByUserId: session.id,
          summary: summaryText,
          reportUrl: reportUrlText,
          submittedAt: new Date(),
        },
        include: {
          submittedByUser: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      let deliverable = null;
      if (validated.title || validated.fileUrl || validated.deliverableId) {
        if (validated.deliverableId) {
          const belongsToTask = await tx.taskDeliverable.findFirst({
            where: { id: validated.deliverableId, taskId },
          });
          if (!belongsToTask) {
            throw new NotFoundError("Không tìm thấy tệp bàn giao thuộc nhiệm vụ này");
          }
          deliverable = await tx.taskDeliverable.update({
            where: { id: validated.deliverableId },
            data: {
              reviewStatus: DeliverableReviewStatus.PENDING,
            },
          });
        } else {
          deliverable = await tx.taskDeliverable.create({
            data: {
              taskId,
              title: validated.title?.trim() || summaryText,
              fileUrl: validated.fileUrl?.trim() || reportUrlText || "",
              fileType: validated.fileType || "LINK",
              fileSize: validated.fileSize ?? null,
              uploadedById: session.id,
              reviewStatus: DeliverableReviewStatus.PENDING,
            },
          });
        }
      }

      const updatedTask = await tx.task.update({
        where: { id: taskId },
        data: {
          status: TaskStatus.WAITING_APPROVAL,
          version: { increment: 1 },
        },
      });

      await auditService.logEvent(tx, {
        actorId: session.id,
        action: AuditAction.DELIVERABLE_SUBMITTED,
        entityType: AuditEntityType.TASK,
        entityId: taskId,
        beforeData: { status: task.status },
        afterData: {
          status: TaskStatus.WAITING_APPROVAL,
          resultId: taskResult.id,
          deliverableId: deliverable?.id ?? null,
          summary: summaryText,
        },
      });

      await publishOutboxEvent(tx, {
        eventType: OutboxEventType.DELIVERABLE_SUBMITTED_NOTIFICATION,
        aggregateType: OutboxAggregateType.TASK,
        aggregateId: taskId,
        payload: {
          taskId,
          resultId: taskResult.id,
          deliverableId: deliverable?.id ?? null,
          submittedById: session.id,
          summary: summaryText,
        },
      });

      if (task.parentTaskId) {
        await recalculateParentTaskProgress(tx, task.parentTaskId, session.id);
      }

      return {
        taskResult,
        deliverable,
        taskStatus: TaskStatus.WAITING_APPROVAL,
        version: updatedTask.version,
      };
    });
  }

  /**
   * Action 2: review
   * POST /api/tasks/[id]/actions/review
   * Review task result/deliverable with approval or change request.
   * Enforces Maker-Checker Invariant: Submitter != Reviewer.
   */
  async review(session: SessionPayload, taskId: string, input: ReviewInput) {
    const validated = ReviewInputSchema.parse(input);
    const userContext = await buildUserContext(session);
    const { task, resource, targetDeliverable, targetResult, primaryOwnerId } =
      await loadTaskAndBuildResource(taskId, {
        deliverableId: validated.deliverableId,
        resultId: validated.resultId,
        stepId: validated.stepId,
      });

    if (validated.expectedVersion !== undefined && task.version !== Number(validated.expectedVersion)) {
      throw new PreconditionFailedError(
        `Task aggregate version conflict: expected version ${validated.expectedVersion}, current version ${task.version}`
      );
    }

    // Maker-Checker Invariant Enforcement:
    // Submitter cannot review/verify own submission
    const isSubmitter =
      targetResult?.submittedByUserId === session.id ||
      targetDeliverable?.uploadedById === session.id ||
      resource.submittedByUserId === session.id ||
      resource.uploadedById === session.id;

    if (isSubmitter) {
      throw new SeparationOfDutiesError(
        "Vi phạm nguyên tắc Maker-Checker (SoD): Cán bộ thực thi hoặc nộp minh chứng không được tự thẩm tra sản phẩm của mình."
      );
    }

    if (primaryOwnerId && primaryOwnerId === session.id) {
      throw new SeparationOfDutiesError(
        "Vi phạm nguyên tắc phân lập trách nhiệm (SoD): Người chịu trách nhiệm chính (DRI) không được tự thẩm tra kết quả nhiệm vụ của mình."
      );
    }

    const authResult = await authorize(userContext, "task.review", resource);
    assertAuthAllowed(authResult, "task.review", taskId);

    const effectiveDecision =
      validated.decision ||
      (validated.reviewStatus === "APPROVED"
        ? "APPROVED"
        : validated.reviewStatus === "REJECTED" || validated.reviewStatus === "REVISION_REQUIRED"
        ? "REJECTED"
        : "APPROVED");

    const effectiveReviewStatus =
      validated.reviewStatus ||
      (effectiveDecision === "APPROVED" ? "APPROVED" : "REVISION_REQUIRED");

    const noteText = validated.note?.trim() || validated.reviewNote?.trim() || null;

    return await prisma.$transaction(async (tx) => {
      let verifiedResult = null;
      if (validated.resultId || targetResult) {
        const rId = validated.resultId || targetResult!.id;
        const resultBelongsToTask = await tx.taskResult.findFirst({
          where: { id: rId, taskId },
        });
        if (!resultBelongsToTask) {
          throw new NotFoundError("Không tìm thấy kết quả thuộc nhiệm vụ này");
        }
        verifiedResult = await tx.taskResult.update({
          where: { id: rId },
          data: {
            verifiedByUserId: session.id,
            verifiedAt: new Date(),
          },
        });
      }

      let reviewedDeliverable = null;
      if (validated.deliverableId || targetDeliverable) {
        const dId = validated.deliverableId || targetDeliverable!.id;
        const belongsToTask = await tx.taskDeliverable.findFirst({
          where: { id: dId, taskId },
        });
        if (!belongsToTask) {
          throw new NotFoundError("Không tìm thấy tệp bàn giao thuộc nhiệm vụ này");
        }
        const mappedStatus =
          effectiveReviewStatus === "APPROVED"
            ? DeliverableReviewStatus.APPROVED
            : DeliverableReviewStatus.REVISION_REQUIRED;

        reviewedDeliverable = await tx.taskDeliverable.update({
          where: { id: dId },
          data: {
            reviewStatus: mappedStatus,
            reviewNote: noteText,
            reviewerId: session.id,
            reviewedAt: new Date(),
          },
        });
      }

      let stepResult = null;
      if (validated.stepId) {
        const stepBelongsToTask = await tx.taskApprovalStep.findFirst({
          where: {
            id: validated.stepId,
            process: { taskId },
          },
        });
        if (!stepBelongsToTask) {
          throw new NotFoundError("Không tìm thấy bước phê duyệt thuộc nhiệm vụ này");
        }
        stepResult = await executeApprovalStep(
          validated.stepId,
          session.id,
          effectiveDecision,
          noteText || undefined,
          undefined,
          tx
        );
      }

      let newStatus = task.status;
      if (effectiveReviewStatus === "REVISION_REQUIRED" || effectiveReviewStatus === "REJECTED") {
        newStatus = TaskStatus.IN_PROGRESS;
      }

      const updatedTask = await tx.task.update({
        where: { id: taskId },
        data: {
          status: newStatus,
          version: { increment: 1 },
        },
      });

      await auditService.logEvent(tx, {
        actorId: session.id,
        action: AuditAction.DELIVERABLE_REVIEWED,
        entityType: AuditEntityType.TASK,
        entityId: taskId,
        beforeData: { status: task.status },
        afterData: {
          decision: effectiveDecision,
          reviewStatus: effectiveReviewStatus,
          note: noteText,
          status: newStatus,
        },
      });

      await publishOutboxEvent(tx, {
        eventType: OutboxEventType.DELIVERABLE_REVIEWED_NOTIFICATION,
        aggregateType: OutboxAggregateType.TASK,
        aggregateId: taskId,
        payload: {
          taskId,
          reviewerId: session.id,
          decision: effectiveDecision,
          reviewStatus: effectiveReviewStatus,
          note: noteText,
        },
      });

      if (task.parentTaskId) {
        await recalculateParentTaskProgress(tx, task.parentTaskId, session.id);
      }

      return {
        decision: effectiveDecision,
        reviewStatus: effectiveReviewStatus,
        taskStatus: newStatus,
        version: updatedTask.version,
        verifiedResult,
        reviewedDeliverable,
        stepResult,
      };
    });
  }

  /**
   * Action 3: request-revision
   * POST /api/tasks/[id]/actions/request-revision
   * Explicitly request rework, reverts task to IN_PROGRESS.
   */
  async requestRevision(session: SessionPayload, taskId: string, input: RequestRevisionInput) {
    const validated = RequestRevisionInputSchema.parse(input);
    const userContext = await buildUserContext(session);
    const { task, resource, targetDeliverable, primaryOwnerId } =
      await loadTaskAndBuildResource(taskId, {
        deliverableId: validated.deliverableId,
        resultId: validated.resultId,
        stepId: validated.stepId,
      });

    // SoD check: Submitter / DRI cannot request revision from themselves
    if (primaryOwnerId && primaryOwnerId === session.id) {
      throw new SeparationOfDutiesError(
        "Vi phạm nguyên tắc phân lập trách nhiệm (SoD): Người chịu trách nhiệm chính không thể tự yêu cầu làm lại cho chính mình."
      );
    }

    if (validated.expectedVersion !== undefined && task.version !== Number(validated.expectedVersion)) {
      throw new PreconditionFailedError(
        `Task aggregate version conflict: expected version ${validated.expectedVersion}, current version ${task.version}`
      );
    }

    const authResult = await authorize(userContext, "task.review", resource);
    assertAuthAllowed(authResult, "task.review", taskId);

    const reasonText = validated.reason.trim();
    const noteText = validated.note?.trim() || reasonText;

    return await prisma.$transaction(async (tx) => {
      const updatedTask = await tx.task.update({
        where: { id: taskId },
        data: {
          status: TaskStatus.IN_PROGRESS,
          completedAt: null,
          version: { increment: 1 },
        },
      });

      let updatedDeliverable = null;
      if (validated.deliverableId || targetDeliverable) {
        const dId = validated.deliverableId || targetDeliverable!.id;
        const belongsToTask = await tx.taskDeliverable.findFirst({
          where: { id: dId, taskId },
        });
        if (!belongsToTask) {
          throw new NotFoundError("Không tìm thấy tệp bàn giao thuộc nhiệm vụ này");
        }
        updatedDeliverable = await tx.taskDeliverable.update({
          where: { id: dId },
          data: {
            reviewStatus: DeliverableReviewStatus.REVISION_REQUIRED,
            reviewNote: reasonText,
            reviewerId: session.id,
            reviewedAt: new Date(),
          },
        });
      }

      if (validated.resultId) {
        const resultBelongsToTask = await tx.taskResult.findFirst({
          where: { id: validated.resultId, taskId },
        });
        if (!resultBelongsToTask) {
          throw new NotFoundError("Không tìm thấy kết quả thuộc nhiệm vụ này");
        }
      }

      let rejectedStep = null;
      if (validated.stepId) {
        const stepBelongsToTask = await tx.taskApprovalStep.findFirst({
          where: {
            id: validated.stepId,
            process: { taskId },
          },
        });
        if (!stepBelongsToTask) {
          throw new NotFoundError("Không tìm thấy bước phê duyệt thuộc nhiệm vụ này");
        }

        rejectedStep = await tx.taskApprovalStep.update({
          where: { id: validated.stepId },
          data: {
            status: ApprovalStepStatus.REJECTED,
            decisionNote: reasonText,
            decidedAt: new Date(),
            reviewerUserId: session.id,
          },
        });

        // Update parent TaskApprovalProcess status to REJECTED
        await tx.taskApprovalProcess.update({
          where: { id: rejectedStep.processId },
          data: {
            status: ApprovalProcessStatus.REJECTED,
          },
        });
      } else {
        // Update any active TaskApprovalProcess for this task to REJECTED
        await tx.taskApprovalProcess.updateMany({
          where: {
            taskId,
            status: {
              in: [ApprovalProcessStatus.NOT_STARTED, ApprovalProcessStatus.IN_REVIEW],
            },
          },
          data: {
            status: ApprovalProcessStatus.REJECTED,
          },
        });
      }

      await auditService.logEvent(tx, {
        actorId: session.id,
        action: AuditAction.TASK_REJECTED,
        entityType: AuditEntityType.TASK,
        entityId: taskId,
        beforeData: { status: task.status },
        afterData: {
          status: TaskStatus.IN_PROGRESS,
          reason: reasonText,
          note: noteText,
        },
      });

      await publishOutboxEvent(tx, {
        eventType: OutboxEventType.TASK_REJECTED_NOTIFICATION,
        aggregateType: OutboxAggregateType.TASK,
        aggregateId: taskId,
        payload: {
          taskId,
          requestedById: session.id,
          reason: reasonText,
          note: noteText,
        },
      });

      if (task.parentTaskId) {
        await recalculateParentTaskProgress(tx, task.parentTaskId, session.id);
      }

      return {
        taskId,
        status: TaskStatus.IN_PROGRESS,
        reason: reasonText,
        version: updatedTask.version,
        deliverable: updatedDeliverable,
        step: rejectedStep,
      };
    });
  }

  /**
   * Action 4: approve
   * POST /api/tasks/[id]/actions/approve
   * Final institutional approval, transitions task to COMPLETED, enforces SoD.
   */
  async approve(session: SessionPayload, taskId: string, input: ApproveInput) {
    const validated = ApproveInputSchema.parse(input);
    const userContext = await buildUserContext(session);
    const { task, resource, primaryOwnerId } = await loadTaskAndBuildResource(taskId, {
      stepId: validated.stepId,
    });

    // SoD Invariant Enforcement: Rule 4.1 Creator != Approver & DRI != Approver
    if (task.createdById === session.id) {
      throw new SeparationOfDutiesError(
        "Vi phạm nguyên tắc phân lập trách nhiệm (SoD): Người tạo lập không được tự phê duyệt nhiệm vụ của mình."
      );
    }

    if (primaryOwnerId && primaryOwnerId === session.id) {
      throw new SeparationOfDutiesError(
        "Vi phạm nguyên tắc phân lập trách nhiệm (SoD): Người chịu trách nhiệm chính (DRI) không được tự phê duyệt nhiệm vụ của mình."
      );
    }

    if (validated.expectedVersion !== undefined && task.version !== Number(validated.expectedVersion)) {
      throw new PreconditionFailedError(
        `Task aggregate version conflict: expected version ${validated.expectedVersion}, current version ${task.version}`
      );
    }

    const authResult = authorize(userContext, "task.approve", resource);
    assertAuthAllowed(authResult, "task.approve", taskId);

    const noteText = validated.note?.trim() || null;

    return await prisma.$transaction(async (tx) => {
      let stepResult = null;
      if (validated.stepId) {
        const stepBelongsToTask = await tx.taskApprovalStep.findFirst({
          where: {
            id: validated.stepId,
            process: { taskId },
          },
        });
        if (!stepBelongsToTask) {
          throw new NotFoundError("Không tìm thấy bước phê duyệt thuộc nhiệm vụ này");
        }

        stepResult = await executeApprovalStep(
          validated.stepId,
          session.id,
          "APPROVED",
          noteText || undefined,
          { allowBypass: false },
          tx
        );
      }

      // Check if all approval steps are completed
      let canComplete = true;
      if (task.approvalProcesses && task.approvalProcesses.length > 0) {
        if (validated.stepId) {
          const remainingSteps = await tx.taskApprovalStep.count({
            where: {
              processId: task.approvalProcesses[0].id,
              status: { in: [ApprovalStepStatus.PENDING] },
            },
          });
          if (remainingSteps > 0) {
            canComplete = false;
          } else {
            await tx.taskApprovalProcess.update({
              where: { id: task.approvalProcesses[0].id },
              data: { status: ApprovalProcessStatus.APPROVED },
            });
          }
        } else {
          // Direct completion from Canvas: mark all pending steps in approval processes as approved
          for (const process of task.approvalProcesses) {
            await tx.taskApprovalStep.updateMany({
              where: {
                processId: process.id,
                status: ApprovalStepStatus.PENDING,
              },
              data: {
                status: ApprovalStepStatus.APPROVED,
                decidedAt: new Date(),
                reviewerUserId: session.id,
                decisionNote: noteText || "Nghiệm thu hoàn thành nhiệm vụ",
              },
            });
            await tx.taskApprovalProcess.update({
              where: { id: process.id },
              data: { status: ApprovalProcessStatus.APPROVED },
            });
          }
          canComplete = true;
        }
      }

      const updatedTask = await tx.task.update({
        where: { id: taskId },
        data: {
          status: TaskStatus.COMPLETED,
          progressPercent: 100,
          completedAt: new Date(),
          version: { increment: 1 },
        },
      });

      await auditService.logEvent(tx, {
        actorId: session.id,
        action: AuditAction.TASK_APPROVED,
        entityType: AuditEntityType.TASK,
        entityId: taskId,
        beforeData: { status: task.status, progressPercent: task.progressPercent },
        afterData: {
          status: canComplete ? TaskStatus.COMPLETED : task.status,
          progressPercent: canComplete ? 100 : task.progressPercent,
          note: noteText,
        },
      });

      await publishOutboxEvent(tx, {
        eventType: OutboxEventType.TASK_APPROVED_NOTIFICATION,
        aggregateType: OutboxAggregateType.TASK,
        aggregateId: taskId,
        payload: {
          taskId,
          approvedById: session.id,
          note: noteText,
          completed: canComplete,
        },
      });

      if (task.parentTaskId) {
        await recalculateParentTaskProgress(tx, task.parentTaskId, session.id);
      }

      return {
        taskId,
        status: canComplete ? TaskStatus.COMPLETED : task.status,
        progressPercent: canComplete ? 100 : task.progressPercent,
        completed: canComplete,
        version: updatedTask.version,
        stepResult,
      };
    });
  }

  /**
   * Action: cancel
   * POST /api/tasks/[id]/actions/cancel
   * Terminal transition: cancels task with reason.
   */
  async cancel(session: SessionPayload, taskId: string, input: CancelInput) {
    const validated = CancelInputSchema.parse(input);
    const userContext = await buildUserContext(session);
    const { task, resource } = await loadTaskAndBuildResource(taskId);

    if (validated.expectedVersion !== undefined && task.version !== Number(validated.expectedVersion)) {
      throw new PreconditionFailedError(
        `Task aggregate version conflict: expected version ${validated.expectedVersion}, current version ${task.version}`
      );
    }

    const authResult = await authorize(userContext, "task.cancel", resource);
    assertAuthAllowed(authResult, "task.cancel", taskId);

    if (task.status === TaskStatus.COMPLETED) {
      throw new InvalidTransitionError(
        "Nhiệm vụ đã hoàn thành, không thể hủy bỏ",
        "CANNOT_CANCEL_COMPLETED"
      );
    }
    if (task.status === TaskStatus.CANCELLED) {
      throw new InvalidTransitionError(
        "Nhiệm vụ đã bị hủy trước đó",
        "ALREADY_CANCELLED"
      );
    }

    const reasonText = validated.reason.trim();
    const noteText = validated.note?.trim() || null;

    return await prisma.$transaction(async (tx) => {
      const updatedTask = await tx.task.update({
        where: { id: taskId },
        data: {
          status: TaskStatus.CANCELLED,
          completedAt: null,
          version: { increment: 1 },
          updatedAt: new Date(),
        },
      });

      await auditService.logEvent(tx, {
        actorId: session.id,
        action: AuditAction.TASK_STATUS_CHANGED,
        entityType: AuditEntityType.TASK,
        entityId: taskId,
        beforeData: { status: task.status },
        afterData: {
          status: TaskStatus.CANCELLED,
          reason: reasonText,
          note: noteText,
        },
      });

      await publishOutboxEvent(tx, {
        eventType: OutboxEventType.TASK_STATUS_NOTIFICATION,
        aggregateType: OutboxAggregateType.TASK,
        aggregateId: taskId,
        payload: {
          taskId,
          status: TaskStatus.CANCELLED,
          reason: reasonText,
          actorId: session.id,
        },
      });

      if (task.parentTaskId) {
        await recalculateParentTaskProgress(tx, task.parentTaskId, session.id);
      }

      return {
        taskId,
        status: TaskStatus.CANCELLED,
        reason: reasonText,
        version: updatedTask.version,
      };
    });
  }

  /**
   * Action 5: reassign
   * POST /api/tasks/[id]/actions/reassign
   * Atomic reassignment of DRI/actor with full history and invariants.
   * Single DRI Rule: Collaborator cannot reassign DRI.
   */
  async reassign(session: SessionPayload, taskId: string, input: ReassignInput) {
    const validated = ReassignInputSchema.parse(input);
    const userContext = await buildUserContext(session);
    const { task, resource } = await loadTaskAndBuildResource(taskId);

    if (validated.expectedVersion !== undefined && task.version !== Number(validated.expectedVersion)) {
      throw new PreconditionFailedError(
        `Task aggregate version conflict: expected version ${validated.expectedVersion}, current version ${task.version}`
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: validated.newAssigneeId },
    });
    if (!targetUser) {
      throw new NotFoundError(
        `Không tìm thấy người dùng mới để phân công (ID: ${validated.newAssigneeId})`
      );
    }

    const authResult = await authorize(userContext, "task.reassign", resource);
    assertAuthAllowed(authResult, "task.reassign", taskId);

    const result = await prisma.$transaction(async (tx) => {
      const primaryDRI = await setTaskDRI(
        taskId,
        validated.newAssigneeId,
        {
          requestedById: session.id,
        },
        undefined,
        tx
      );

      await auditService.logEvent(tx, {
        actorId: session.id,
        action: AuditAction.TASK_ASSIGNED,
        entityType: AuditEntityType.TASK,
        entityId: taskId,
        beforeData: { primaryOwnerId: resource.primaryOwnerId },
        afterData: {
          primaryOwnerId: validated.newAssigneeId,
          note: validated.note?.trim() || null,
        },
      });

      await publishOutboxEvent(tx, {
        eventType: OutboxEventType.TASK_ASSIGNED_NOTIFICATION,
        aggregateType: OutboxAggregateType.TASK,
        aggregateId: taskId,
        payload: {
          taskId,
          assignedById: session.id,
          newAssigneeId: validated.newAssigneeId,
          role: "DRI",
        },
      });

      return {
        taskId,
        primaryDRI,
        newAssigneeId: validated.newAssigneeId,
        role: TaskActorRole.DRI,
      };
    });

    return result;
  }

  /**
   * Action 6: remind
   * POST /api/tasks/[id]/actions/remind
   * Dispatches formal reminder notification through outbox.
   */
  async remind(session: SessionPayload, taskId: string, input: RemindInput) {
    const validated = RemindInputSchema.parse(input);
    const userContext = await buildUserContext(session);
    const { task, resource } = await loadTaskAndBuildResource(taskId);

    const authResult = await authorize(userContext, "task.remind", resource);
    assertAuthAllowed(authResult, "task.remind", taskId);

    // Identify target recipient user IDs (exclude caller)
    let recipientIds: string[] = [];
    if (validated.targetUserIds && validated.targetUserIds.length > 0) {
      recipientIds = validated.targetUserIds.filter((id) => id !== session.id);
    } else {
      const candidates = new Set<string>();
      if (resource.primaryOwnerId && resource.primaryOwnerId !== session.id) {
        candidates.add(resource.primaryOwnerId);
      }
      for (const id of resource.collaboratorIds || []) {
        if (id !== session.id) candidates.add(id);
      }
      for (const id of resource.assigneeIds || []) {
        if (id !== session.id) candidates.add(id);
      }
      recipientIds = Array.from(candidates);
    }

    const messageText = validated.message?.trim() || `Nhắc nhở thực hiện nhiệm vụ: ${task.title}`;

    await prisma.$transaction(async (tx) => {
      const updated = await tx.task.updateMany({
        where: { id: taskId, version: validated.expectedVersion, archivedAt: null },
        data: { version: { increment: 1 } },
      });
      if (updated.count !== 1) {
        throw new PreconditionFailedError(
          `Task aggregate version conflict: expected version ${validated.expectedVersion}`
        );
      }

      await auditService.logEvent(tx, {
        actorId: session.id,
        action: AuditAction.TASK_REMINDED,
        entityType: AuditEntityType.TASK,
        entityId: taskId,
        beforeData: null,
        afterData: { urgency: validated.urgency, recipientIds, message: messageText },
      });

      await publishOutboxEvent(tx, {
        eventType: OutboxEventType.TASK_REMINDER_NOTIFICATION,
        aggregateType: OutboxAggregateType.TASK,
        aggregateId: taskId,
        payload: {
          taskId,
          remindedById: session.id,
          recipientIds,
          urgency: validated.urgency,
          message: messageText,
        },
      });
    });

    return {
      taskId,
      recipientCount: recipientIds.length,
      recipientIds,
      urgency: validated.urgency,
      message: messageText,
      version: validated.expectedVersion + 1,
    };
  }
}

export const taskDomainActionService = new TaskDomainActionService();
export const taskDomainActions = taskDomainActionService;
