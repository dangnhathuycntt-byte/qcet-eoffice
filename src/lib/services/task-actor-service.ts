import {
  prisma,
} from "../prisma";
import {
  Prisma,
  TaskActor,
  TaskActorRole,
  TaskResult,
  TaskApprovalProcess,
  TaskApprovalStep,
  ApprovalProcessStatus,
  ApprovalStepStatus,
  TaskStatus,
  UserRole,
  AssigneeRole,
  AssignmentStatus,
} from "@prisma/client";

export interface TaskActorContext {
  requestedById: string;
}

export interface TaskActorsGroup {
  assigner?: TaskActor;
  leadUnit?: TaskActor;
  dri?: TaskActor;
  collaborators: TaskActor[];
  observers: TaskActor[];
}

export class TaskActorAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskActorAuthorizationError";
  }
}

export class SegregationOfDutiesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SegregationOfDutiesError";
  }
}

export class MakerCheckerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MakerCheckerError";
  }
}

export class StepProgressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StepProgressionError";
  }
}

/**
 * Checks whether a user is authorized to manage DRI for a specific task.
 * Permitted callers:
 * 1. Executive Leadership (BAN_GIAM_HIEU, ADMIN)
 * 2. ASSIGNER (task creator or actor with ASSIGNER role)
 * 3. LEAD_UNIT leader (Department Head / Unit Leader of the task's lead unit)
 *
 * Explicit Invariant: Collaborators CANNOT reassign DRI.
 */
async function verifyDRIReassignmentAuthority(
  taskId: string,
  requestingUserId: string,
  txClient?: Prisma.TransactionClient
): Promise<void> {
  const client = txClient || prisma;
  const requestingUser = await client.user.findUnique({
    where: { id: requestingUserId },
    include: {
      positionAssignments: {
        where: { status: AssignmentStatus.ACTIVE },
        include: { positionDefinition: true },
      },
    },
  });

  if (!requestingUser) {
    throw new TaskActorAuthorizationError(
      `Requesting user '${requestingUserId}' not found.`
    );
  }

  // 1. Executive Leadership
  if (
    requestingUser.role === UserRole.BAN_GIAM_HIEU ||
    requestingUser.role === UserRole.ADMIN
  ) {
    return;
  }

  const task = await client.task.findUnique({
    where: { id: taskId },
    include: {
      actors: true,
      leadUnit: true,
    },
  });

  if (!task) {
    throw new TaskActorAuthorizationError(`Task '${taskId}' not found.`);
  }

  // 2. ASSIGNER check: task creator or ASSIGNER role actor
  const isAssigner =
    task.createdById === requestingUserId ||
    task.actors.some(
      (a) => a.userId === requestingUserId && a.role === TaskActorRole.ASSIGNER
    );

  if (isAssigner) {
    return;
  }

  // 3. LEAD_UNIT leader check
  const isLeadUnitLeaderByAssignment =
    task.leadUnitId !== null &&
    requestingUser.positionAssignments.some(
      (pa) => pa.unitId === task.leadUnitId && pa.positionDefinition.isLeadership
    );

  const isLeadUnitLeaderByDept =
    requestingUser.role === UserRole.TRUONG_PHONG &&
    ((task.leadUnit && requestingUser.departmentId === task.leadUnit.code) ||
      (task.departmentId && requestingUser.departmentId === task.departmentId));

  if (isLeadUnitLeaderByAssignment || isLeadUnitLeaderByDept) {
    return;
  }

  // Check if caller is a collaborator (explicitly forbidden)
  const isCollaborator = task.actors.some(
    (a) => a.userId === requestingUserId && a.role === TaskActorRole.COLLABORATOR
  );

  if (isCollaborator) {
    throw new TaskActorAuthorizationError(
      "Unauthorized: Collaborators cannot reassign DRI. Only ASSIGNER, Lead Unit Leader, or Executive Leadership can reassign DRI."
    );
  }

  throw new TaskActorAuthorizationError(
    "Unauthorized: Only ASSIGNER, Lead Unit Leader, or Executive Leadership can reassign DRI."
  );
}

/**
 * Enforces Single DRI Invariant: Exactly 1 primary DRI per task.
 * If an existing DRI exists, transitions them to COLLABORATOR and sets the new DRI.
 * Caller must be authorized (ASSIGNER, LEAD_UNIT leader, or Executive Leadership).
 */
export async function setTaskDRI(
  taskId: string,
  userId: string,
  actorContext: TaskActorContext,
  unitId?: string,
  txClient?: Prisma.TransactionClient
): Promise<TaskActor> {
  await verifyDRIReassignmentAuthority(taskId, actorContext.requestedById, txClient);

  const executeOperation = async (tx: Prisma.TransactionClient) => {
    // 0. Atomic row-lock and aggregate version increment
    await tx.task.update({
      where: { id: taskId },
      data: { version: { increment: 1 } },
    });

    // 1. Demote any other DRI or primary actor on this task to COLLABORATOR
    await tx.taskActor.updateMany({
      where: {
        taskId,
        userId: { not: userId },
        OR: [
          { role: TaskActorRole.DRI },
          { isPrimaryDRI: true },
        ],
      },
      data: {
        role: TaskActorRole.COLLABORATOR,
        isPrimaryDRI: false,
        notes: `Chuyển giao vai trò DRI sang cộng tác viên ngày ${new Date().toISOString()}`,
      },
    });

    // 2. Fetch or create target user actor
    const existingUserActor = await tx.taskActor.findFirst({
      where: {
        taskId,
        userId,
      },
    });

    let primaryDRI: TaskActor;
    if (existingUserActor) {
      primaryDRI = await tx.taskActor.update({
        where: { id: existingUserActor.id },
        data: {
          role: TaskActorRole.DRI,
          isPrimaryDRI: true,
          unitId: unitId !== undefined ? unitId : existingUserActor.unitId,
          assignedById: actorContext.requestedById,
          appointedAt: new Date(),
          notes: null,
        },
      });
    } else {
      primaryDRI = await tx.taskActor.create({
        data: {
          taskId,
          userId,
          unitId: unitId ?? null,
          role: TaskActorRole.DRI,
          isPrimaryDRI: true,
          assignedById: actorContext.requestedById,
          appointedAt: new Date(),
        },
      });
    }

    // 3. Post-condition invariant: enforce strictly only 1 primary DRI
    await tx.taskActor.updateMany({
      where: {
        taskId,
        id: { not: primaryDRI.id },
        isPrimaryDRI: true,
      },
      data: {
        isPrimaryDRI: false,
        role: TaskActorRole.COLLABORATOR,
      },
    });

    // 4. Keep legacy TaskAssignee synchronized for backward compatibility
    await tx.taskAssignee.deleteMany({
      where: {
        taskId,
        roleInTask: AssigneeRole.PRIMARY_OWNER,
      },
    });

    await tx.taskAssignee.upsert({
      where: {
        task_user_role_unique: {
          taskId,
          userId,
          roleInTask: AssigneeRole.PRIMARY_OWNER,
        },
      },
      update: {},
      create: {
        taskId,
        userId,
        roleInTask: AssigneeRole.PRIMARY_OWNER,
      },
    });

    return primaryDRI;
  };

  if (txClient) {
    return await executeOperation(txClient);
  }
  return await prisma.$transaction(executeOperation);
}

/**
 * Adds or updates a collaborator actor for the task.
 */
export async function addTaskCollaborator(
  taskId: string,
  userId: string,
  actorContext: TaskActorContext,
  unitId?: string
): Promise<TaskActor> {
  const existingActor = await prisma.taskActor.findFirst({
    where: {
      taskId,
      userId,
    },
  });

  if (existingActor?.role === TaskActorRole.DRI && existingActor.isPrimaryDRI) {
    throw new TaskActorAuthorizationError(
      "Cannot add primary DRI as collaborator. Reassign DRI first."
    );
  }

  return await prisma.$transaction(async (tx) => {
    let collaborator: TaskActor;
    if (existingActor) {
      collaborator = await tx.taskActor.update({
        where: { id: existingActor.id },
        data: {
          role: TaskActorRole.COLLABORATOR,
          isPrimaryDRI: false,
          unitId: unitId !== undefined ? unitId : existingActor.unitId,
          assignedById: actorContext.requestedById,
        },
      });
    } else {
      collaborator = await tx.taskActor.create({
        data: {
          taskId,
          userId,
          unitId: unitId ?? null,
          role: TaskActorRole.COLLABORATOR,
          isPrimaryDRI: false,
          assignedById: actorContext.requestedById,
          appointedAt: new Date(),
        },
      });
    }

    // Synchronize legacy TaskAssignee
    await tx.taskAssignee.upsert({
      where: {
        task_user_role_unique: {
          taskId,
          userId,
          roleInTask: AssigneeRole.COLLABORATOR,
        },
      },
      update: {},
      create: {
        taskId,
        userId,
        roleInTask: AssigneeRole.COLLABORATOR,
      },
    });

    return collaborator;
  });
}

/**
 * Adds or updates an observer actor for the task.
 */
export async function addTaskObserver(
  taskId: string,
  userId: string,
  actorContext: TaskActorContext
): Promise<TaskActor> {
  const existingActor = await prisma.taskActor.findFirst({
    where: {
      taskId,
      userId,
    },
  });

  if (existingActor) {
    return await prisma.taskActor.update({
      where: { id: existingActor.id },
      data: {
        role: TaskActorRole.OBSERVER,
        isPrimaryDRI: false,
        assignedById: actorContext.requestedById,
      },
    });
  }

  return await prisma.taskActor.create({
    data: {
      taskId,
      userId,
      role: TaskActorRole.OBSERVER,
      isPrimaryDRI: false,
      assignedById: actorContext.requestedById,
      appointedAt: new Date(),
    },
  });
}

/**
 * Retrieves all canonical actors for a task grouped by role.
 */
export async function getTaskActors(taskId: string): Promise<TaskActorsGroup> {
  const actors = await prisma.taskActor.findMany({
    where: { taskId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          departmentId: true,
        },
      },
      unit: true,
    },
    orderBy: { appointedAt: "asc" },
  });

  return {
    assigner: actors.find((a) => a.role === TaskActorRole.ASSIGNER),
    leadUnit: actors.find((a) => a.role === TaskActorRole.LEAD_UNIT),
    dri:
      actors.find((a) => a.role === TaskActorRole.DRI && a.isPrimaryDRI) ??
      actors.find((a) => a.role === TaskActorRole.DRI),
    collaborators: actors.filter((a) => a.role === TaskActorRole.COLLABORATOR),
    observers: actors.filter((a) => a.role === TaskActorRole.OBSERVER),
  };
}

/**
 * Validates the Single DRI Invariant: Exactly 1 primary DRI per task.
 */
export async function validateSingleDRI(taskId: string): Promise<boolean> {
  const driActors = await prisma.taskActor.findMany({
    where: {
      taskId,
      role: TaskActorRole.DRI,
      isPrimaryDRI: true,
    },
  });
  return driActors.length === 1;
}

/**
 * Submits task completion deliverable / result summary.
 * Enforces Maker-Checker Invariant: Verifier != Submitter.
 */
export async function submitTaskResult(
  taskId: string,
  submittedByUserId: string,
  data: {
    summary: string;
    reportUrl?: string;
    verifiedByUserId?: string;
  }
): Promise<TaskResult> {
  if (data.verifiedByUserId && data.verifiedByUserId === submittedByUserId) {
    throw new MakerCheckerError(
      `Maker-Checker violation: Submitter (${submittedByUserId}) cannot verify their own task result.`
    );
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
  });

  if (!task) {
    throw new Error(`Task with id '${taskId}' not found.`);
  }

  return await prisma.taskResult.create({
    data: {
      taskId,
      submittedByUserId,
      summary: data.summary,
      reportUrl: data.reportUrl ?? null,
      submittedAt: new Date(),
      verifiedByUserId: data.verifiedByUserId ?? null,
      verifiedAt: data.verifiedByUserId ? new Date() : null,
    },
  });
}

/**
 * Verifies an existing task result.
 * Enforces Maker-Checker Invariant: Verifier != Submitter.
 */
export async function verifyTaskResult(
  resultId: string,
  verifiedByUserId: string,
  _note?: string
): Promise<TaskResult> {
  const result = await prisma.taskResult.findUnique({
    where: { id: resultId },
  });

  if (!result) {
    throw new Error(`TaskResult with id '${resultId}' not found.`);
  }

  if (result.submittedByUserId === verifiedByUserId) {
    throw new MakerCheckerError(
      `Maker-Checker violation: Submitter (${result.submittedByUserId}) cannot verify their own task result.`
    );
  }

  return await prisma.taskResult.update({
    where: { id: resultId },
    data: {
      verifiedByUserId,
      verifiedAt: new Date(),
    },
  });
}

/**
 * Initiates a multi-step task approval workflow.
 */
export async function initiateApprovalProcess(
  taskId: string,
  steps: Array<{
    title: string;
    reviewerUserId?: string;
    reviewerAssignmentId?: string;
  }>
): Promise<TaskApprovalProcess & { steps: TaskApprovalStep[] }> {
  if (!steps || steps.length === 0) {
    throw new Error("Approval process must define at least one approval step.");
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
  });

  if (!task) {
    throw new Error(`Task with id '${taskId}' not found.`);
  }

  return await prisma.$transaction(async (tx) => {
    const process = await tx.taskApprovalProcess.create({
      data: {
        taskId,
        status: ApprovalProcessStatus.IN_REVIEW,
        totalSteps: steps.length,
        currentStepIndex: 0,
      },
    });

    const createdSteps: TaskApprovalStep[] = [];
    for (let i = 0; i < steps.length; i++) {
      const stepData = steps[i];
      const step = await tx.taskApprovalStep.create({
        data: {
          processId: process.id,
          stepOrder: i + 1,
          title: stepData.title,
          reviewerUserId: stepData.reviewerUserId ?? null,
          reviewerAssignmentId: stepData.reviewerAssignmentId ?? null,
          status: ApprovalStepStatus.PENDING,
        },
      });
      createdSteps.push(step);
    }

    await tx.task.update({
      where: { id: taskId },
      data: { status: TaskStatus.WAITING_APPROVAL, completedAt: null },
    });

    return {
      ...process,
      steps: createdSteps,
    };
  });
}

/**
 * Executes a single review/approval step.
 * Enforces Segregation of Duties (SoD): Task Creator and DRI cannot approve their own task.
 */
export async function executeApprovalStep(
  stepId: string,
  reviewerUserId: string,
  decision: "APPROVED" | "REJECTED",
  note?: string,
  options?: { allowBypass?: boolean },
  txClient?: Prisma.TransactionClient
): Promise<TaskApprovalStep> {
  const client = txClient || prisma;
  const step = await client.taskApprovalStep.findUnique({
    where: { id: stepId },
    include: {
      process: {
        include: {
          task: {
            include: {
              actors: true,
            },
          },
          steps: {
            orderBy: { stepOrder: "asc" },
          },
        },
      },
    },
  });

  if (!step) {
    throw new Error(`TaskApprovalStep with id '${stepId}' not found.`);
  }

  const task = step.process.task;

  // 1. Segregation of Duties (SoD) Invariant
  const isCreator = task.createdById === reviewerUserId;
  const isDRI = task.actors.some(
    (actor) =>
      actor.userId === reviewerUserId &&
      actor.role === TaskActorRole.DRI &&
      actor.isPrimaryDRI
  );

  if (isCreator || isDRI) {
    throw new SegregationOfDutiesError(
      `Segregation of Duties (SoD) violation: Task creator and DRI cannot approve their own task. (User: ${reviewerUserId})`
    );
  }

  // 2. Designated Reviewer validation (if assigned)
  if (step.reviewerUserId && step.reviewerUserId !== reviewerUserId) {
    const reviewer = await client.user.findUnique({
      where: { id: reviewerUserId },
    });
    const isExecutive =
      reviewer?.role === UserRole.BAN_GIAM_HIEU ||
      reviewer?.role === UserRole.ADMIN;
    if (!isExecutive) {
      throw new TaskActorAuthorizationError(
        `Unauthorized: Only designated reviewer '${step.reviewerUserId}' or Executive Leadership can execute this step.`
      );
    }
  }

  // 3. Step Progression Invariant: Cannot bypass intermediate steps without explicit bypass authority
  const priorPendingSteps = step.process.steps.filter(
    (s) =>
      s.stepOrder < step.stepOrder &&
      s.status !== ApprovalStepStatus.APPROVED &&
      s.status !== ApprovalStepStatus.BYPASSED
  );

  if (priorPendingSteps.length > 0) {
    const reviewer = await client.user.findUnique({
      where: { id: reviewerUserId },
    });
    const isExecutive =
      reviewer?.role === UserRole.BAN_GIAM_HIEU ||
      reviewer?.role === UserRole.ADMIN;

    if (!isExecutive || !options?.allowBypass) {
      throw new StepProgressionError(
        `Step progression violation: Step ${step.stepOrder} cannot be executed while prior steps (${priorPendingSteps.map((s) => s.stepOrder).join(", ")}) are still pending without explicit bypass authority.`
      );
    }
  }

  const executeOperation = async (tx: Prisma.TransactionClient) => {
    // If executive bypass was exercised, mark prior pending steps as BYPASSED
    if (priorPendingSteps.length > 0 && options?.allowBypass) {
      await tx.taskApprovalStep.updateMany({
        where: {
          processId: step.processId,
          stepOrder: { lt: step.stepOrder },
          status: ApprovalStepStatus.PENDING,
        },
        data: {
          status: ApprovalStepStatus.BYPASSED,
          decidedAt: new Date(),
          decisionNote: `Được phê chuẩn vượt cấp bởi Lãnh đạo (User: ${reviewerUserId})`,
        },
      });
    }

    const nextStatus =
      decision === "APPROVED"
        ? ApprovalStepStatus.APPROVED
        : ApprovalStepStatus.REJECTED;

    const updatedStep = await tx.taskApprovalStep.update({
      where: { id: stepId },
      data: {
        status: nextStatus,
        reviewerUserId,
        decisionNote: note ?? null,
        decidedAt: new Date(),
      },
    });

    if (decision === "REJECTED") {
      await tx.taskApprovalProcess.update({
        where: { id: step.processId },
        data: {
          status: ApprovalProcessStatus.REJECTED,
        },
      });

      await tx.task.update({
        where: { id: task.id },
        data: { status: TaskStatus.IN_PROGRESS, completedAt: null },
      });
    } else {
      // Step APPROVED: Check if next step exists
      const remainingSteps = step.process.steps.filter(
        (s) => s.stepOrder > step.stepOrder
      );

      if (remainingSteps.length > 0) {
        await tx.taskApprovalProcess.update({
          where: { id: step.processId },
          data: {
            currentStepIndex: step.stepOrder,
            status: ApprovalProcessStatus.IN_REVIEW,
          },
        });
      } else {
        // All approval steps successfully executed
        await tx.taskApprovalProcess.update({
          where: { id: step.processId },
          data: {
            status: ApprovalProcessStatus.APPROVED,
          },
        });

        await tx.task.update({
          where: { id: task.id },
          data: {
            status: TaskStatus.COMPLETED,
            completedAt: new Date(),
            progressPercent: 100,
          },
        });
      }
    }

    return updatedStep;
  };

  if (txClient) {
    return await executeOperation(txClient);
  }
  return await prisma.$transaction(executeOperation);
}
