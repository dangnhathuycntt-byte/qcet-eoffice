/**
 * QCET E-Office: TaskAssignee to TaskActor Migration Track (WI-8.1 / RFC-01 / ADR-005)
 *
 * Implements Stage A (Backfill & Parity Verification) and Stage B (Dual-Write Adapter)
 * for migrating legacy TaskAssignee records to canonical TaskActor (ReBAC) model.
 */

import {
  AssigneeRole,
  TaskActorRole,
  type PrismaClient,
  type Prisma,
} from '@prisma/client';

export type DbClient = PrismaClient | Prisma.TransactionClient;

/** Sentinel returned for SUPERVISOR so callers can resolve context before persisting. */
export interface ActorRoleResolution {
  role: TaskActorRole;
  isPrimaryDRI: boolean;
  /** When true, caller must resolve context (check approvalProcesses / deliverables) before using role. */
  requiresContextResolution: boolean;
}

/**
 * Maps legacy AssigneeRole to canonical TaskActorRole & primary DRI flag.
 *
 * FAILS CLOSED on unknown role rather than silently falling back to COLLABORATOR,
 * preventing security/privilege misassignment (RFC-01 / ADR-005 requirement).
 *
 * SUPERVISOR returns requiresContextResolution=true — caller must resolve actual role
 * via resolveActorRoleForSupervisor() before persisting.
 */
export function mapAssigneeRoleToActorRole(role: unknown): ActorRoleResolution {
  if (typeof role !== 'string' || !role.trim()) {
    throw new Error(
      `Invalid AssigneeRole: role must be a non-empty string, received ${typeof role}`
    );
  }

  const normalized = role.trim().toUpperCase();

  switch (normalized) {
    case AssigneeRole.PRIMARY_OWNER:
      return { role: TaskActorRole.DRI, isPrimaryDRI: true, requiresContextResolution: false };
    case AssigneeRole.COLLABORATOR:
      return { role: TaskActorRole.COLLABORATOR, isPrimaryDRI: false, requiresContextResolution: false };
    case AssigneeRole.SUPERVISOR:
      // Default to OBSERVER; caller must check context to promote to REVIEWER (RFC-01 §5.2.1)
      return { role: TaskActorRole.OBSERVER, isPrimaryDRI: false, requiresContextResolution: true };
    default:
      throw new Error(
        `Unknown AssigneeRole: '${role}'. Migration must fail closed to prevent privilege misassignment.`
      );
  }
}

/**
 * Resolves the actual TaskActorRole for a SUPERVISOR assignee by querying task context.
 * Maps to REVIEWER when the task has approvalProcesses or non-rejected deliverables, else OBSERVER.
 * (RFC-01 §5.2.1)
 */
async function resolveActorRoleForSupervisor(
  db: DbClient,
  taskId: string
): Promise<TaskActorRole> {
  const task = await (db as any).task.findUnique({
    where: { id: taskId },
    select: {
      approvalProcesses: { select: { id: true } },
      deliverables: { select: { id: true } },
    },
  });

  if (!task) return TaskActorRole.OBSERVER;

  const hasApprovalProcesses = task.approvalProcesses.length > 0;
  const hasDeliverables = task.deliverables.length > 0;

  return hasApprovalProcesses || hasDeliverables
    ? TaskActorRole.REVIEWER
    : TaskActorRole.OBSERVER;
}

export interface TaskAssigneeInput {
  id?: string;
  taskId: string;
  userId: string;
  roleInTask: AssigneeRole | string;
  assignedAt?: Date;
}

export interface BackfillStats {
  totalProcessed: number;
  created: number;
  skipped: number;
  errors: number;
  errorDetails: Array<{ assigneeId: string; message: string }>;
}

export interface BackfillOptions {
  batchSize?: number;
  dryRun?: boolean;
  onProgress?: (processed: number) => void;
}

/**
 * Synchronizes a single TaskAssignee record to TaskActor (Dual-Write helper for Stage B).
 * Inactive in Stage A until Stage B cutover is explicitly authorized.
 *
 * FIX 1: Resolves SUPERVISOR context before persisting.
 * FIX 3: Falls back to task.createdAt when assignee.assignedAt is null.
 */
export async function syncAssigneeToActor(
  db: DbClient,
  assignee: TaskAssigneeInput
): Promise<{ actorId: string; created: boolean }> {
  const resolution = mapAssigneeRoleToActorRole(assignee.roleInTask);

  // FIX 1: Resolve SUPERVISOR context
  let role = resolution.role;
  if (resolution.requiresContextResolution) {
    role = await resolveActorRoleForSupervisor(db, assignee.taskId);
  }

  const { isPrimaryDRI } = resolution;

  // Single Primary DRI invariant: Check if task already has an active primary DRI
  let targetIsPrimaryDRI = isPrimaryDRI;
  if (targetIsPrimaryDRI) {
    const existingDRI = await (db as any).taskActor.findFirst({
      where: {
        taskId: assignee.taskId,
        isPrimaryDRI: true,
      },
    });
    if (existingDRI && existingDRI.userId !== assignee.userId) {
      targetIsPrimaryDRI = false;
    }
  }

  // Check if an actor record already exists for this task, user and role (idempotency)
  const existing = await (db as any).taskActor.findFirst({
    where: {
      taskId: assignee.taskId,
      userId: assignee.userId,
      role,
    },
  });

  if (existing) {
    if (existing.isPrimaryDRI !== targetIsPrimaryDRI) {
      await (db as any).taskActor.update({
        where: { id: existing.id },
        data: { isPrimaryDRI: targetIsPrimaryDRI },
      });
    }
    return { actorId: existing.id, created: false };
  }

  // FIX 3: Fallback to task.createdAt when assignee.assignedAt is null
  let appointedAt = assignee.assignedAt;
  if (!appointedAt) {
    const task = await (db as any).task.findUnique({
      where: { id: assignee.taskId },
      select: { createdAt: true },
    });
    appointedAt = task?.createdAt ?? new Date();
  }

  // Create new TaskActor preserving exact appointedAt timestamp
  const created = await (db as any).taskActor.create({
    data: {
      taskId: assignee.taskId,
      userId: assignee.userId,
      role,
      isPrimaryDRI: targetIsPrimaryDRI,
      appointedAt,
      notes: assignee.id ? `Migrated from TaskAssignee [${assignee.id}]` : 'Dual-write from TaskAssignee',
    },
  });

  return { actorId: created.id, created: true };
}

/**
 * Batch backfills all TaskAssignee records into TaskActor table idempotently.
 * Preserves timestamps, validates roles, and enforces Single Primary DRI invariant.
 *
 * FIX 1: Resolves SUPERVISOR context per-task.
 * FIX 2: Sorts PRIMARY_OWNER assignees by assignedAt DESC per task; latest becomes DRI.
 * FIX 3: Falls back to task.createdAt when assignee.assignedAt is null.
 */
export async function backfillTaskAssigneesToActors(
  db: DbClient,
  options: BackfillOptions = {}
): Promise<BackfillStats> {
  const batchSize = options.batchSize ?? 500;
  const dryRun = options.dryRun ?? false;

  const stats: BackfillStats = {
    totalProcessed: 0,
    created: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [],
  };

  let cursor: string | undefined = undefined;
  let hasMore = true;

  while (hasMore) {
    // FIX 2: Order by assignedAt ASC for cursor-based pagination; we resolve DRI ordering per-task below
    const assignees: Array<{
      id: string;
      taskId: string;
      userId: string;
      roleInTask: AssigneeRole;
      assignedAt: Date;
    }> = await (db as any).taskAssignee.findMany({
      take: batchSize,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { assignedAt: 'asc' },
    });

    if (assignees.length === 0) {
      break;
    }

    cursor = assignees[assignees.length - 1].id;
    if (assignees.length < batchSize) {
      hasMore = false;
    }

    // FIX 2: Group PRIMARY_OWNER assignees per task and determine which is the most recent (DRI)
    // Build a map: taskId -> sorted assignedAt DESC for PRIMARY_OWNER users
    const primaryOwnersByTask = new Map<string, string>(); // taskId -> userId with latest assignedAt
    for (const a of assignees) {
      if (a.roleInTask === AssigneeRole.PRIMARY_OWNER) {
        const current = primaryOwnersByTask.get(a.taskId);
        if (!current) {
          primaryOwnersByTask.set(a.taskId, a.id); // store assignee.id to look up later
        }
        // Since we ordered by assignedAt ASC, the last one in the batch wins (most recent)
        primaryOwnersByTask.set(a.taskId, a.id);
      }
    }

    for (const assignee of assignees) {
      stats.totalProcessed++;
      try {
        const resolution = mapAssigneeRoleToActorRole(assignee.roleInTask);

        // FIX 1: Resolve SUPERVISOR context
        let role = resolution.role;
        if (resolution.requiresContextResolution) {
          role = await resolveActorRoleForSupervisor(db, assignee.taskId);
        }

        // Check idempotency: already exists?
        const existing = await (db as any).taskActor.findFirst({
          where: {
            taskId: assignee.taskId,
            userId: assignee.userId,
            role,
          },
        });

        if (existing) {
          stats.skipped++;
          continue;
        }

        // FIX 2: Determine isPrimaryDRI based on ordering
        // Only the most-recent PRIMARY_OWNER (last by assignedAt) per task gets DRI
        let targetIsPrimaryDRI = resolution.isPrimaryDRI;
        if (targetIsPrimaryDRI) {
          // Check if this assignee is the designated DRI (most recent PRIMARY_OWNER for this task)
          const designatedDRIAssigneeId = primaryOwnersByTask.get(assignee.taskId);
          if (designatedDRIAssigneeId !== assignee.id) {
            // This is not the most recent PRIMARY_OWNER — downgrade to COLLABORATOR
            role = TaskActorRole.COLLABORATOR;
            targetIsPrimaryDRI = false;
          } else {
            // This is the designated DRI — check if another DRI already exists in TaskActor
            const existingDRI = await (db as any).taskActor.findFirst({
              where: { taskId: assignee.taskId, isPrimaryDRI: true },
            });
            if (existingDRI) {
              targetIsPrimaryDRI = false;
            }
          }
        }

        // FIX 3: Fallback to task.createdAt when assignee.assignedAt is null
        let appointedAt: Date = assignee.assignedAt;
        if (!appointedAt) {
          const task = await (db as any).task.findUnique({
            where: { id: assignee.taskId },
            select: { createdAt: true },
          });
          appointedAt = task?.createdAt ?? new Date();
        }

        if (!dryRun) {
          await (db as any).taskActor.create({
            data: {
              taskId: assignee.taskId,
              userId: assignee.userId,
              role,
              isPrimaryDRI: targetIsPrimaryDRI,
              appointedAt,
              notes: `Migrated from TaskAssignee [${assignee.id}]`,
            },
          });
        }
        stats.created++;
      } catch (err: any) {
        stats.errors++;
        stats.errorDetails.push({
          assigneeId: assignee.id,
          message: err?.message || 'Unknown error',
        });
      }
    }

    if (options.onProgress) {
      options.onProgress(stats.totalProcessed);
    }
  }

  return stats;
}

export interface ParityVerificationResult {
  isParityMatched: boolean;
  totalAssignees: number;
  totalMatchedActors: number;
  unmatchedAssigneeIds: string[];
  tasksWithMultipleDRIs: string[];
  /** FIX 4: Actor records from migration that have no corresponding TaskAssignee. */
  unmatchedActorIds: string[];
}

/**
 * Verifies parity between TaskAssignee and TaskActor tables:
 * - 100% of TaskAssignee rows have equivalent TaskActor rows.
 * - Single Primary DRI invariant is satisfied (at most 1 DRI per task).
 * - FIX 4: Two-way check — migrated TaskActor rows have a corresponding TaskAssignee.
 */
export async function verifyTaskAssigneeParity(
  db: DbClient
): Promise<ParityVerificationResult> {
  const assignees: Array<{
    id: string;
    taskId: string;
    userId: string;
    roleInTask: AssigneeRole;
  }> = await (db as any).taskAssignee.findMany({
    select: {
      id: true,
      taskId: true,
      userId: true,
      roleInTask: true,
    },
  });

  const unmatchedAssigneeIds: string[] = [];
  let totalMatchedActors = 0;

  for (const assignee of assignees) {
    try {
      const resolution = mapAssigneeRoleToActorRole(assignee.roleInTask);

      // For SUPERVISOR, check both possible roles (REVIEWER or OBSERVER)
      let actor: any = null;
      if (resolution.requiresContextResolution) {
        // Try REVIEWER first, then OBSERVER
        actor = await (db as any).taskActor.findFirst({
          where: {
            taskId: assignee.taskId,
            userId: assignee.userId,
            role: { in: [TaskActorRole.REVIEWER, TaskActorRole.OBSERVER] },
          },
        });
      } else {
        actor = await (db as any).taskActor.findFirst({
          where: {
            taskId: assignee.taskId,
            userId: assignee.userId,
            role: resolution.role,
          },
        });
      }

      if (actor) {
        totalMatchedActors++;
      } else {
        unmatchedAssigneeIds.push(assignee.id);
      }
    } catch {
      unmatchedAssigneeIds.push(assignee.id);
    }
  }

  // Verify Single Primary DRI invariant across all tasks
  const multiDRIActors: Array<{ taskId: string }> = await (db as any).taskActor.groupBy({
    by: ['taskId'],
    where: { isPrimaryDRI: true },
    _count: { id: true },
    having: {
      id: { _count: { gt: 1 } },
    },
  });

  const tasksWithMultipleDRIs = multiDRIActors.map((m) => m.taskId);

  // FIX 4: Reverse check — migrated actors should have a corresponding TaskAssignee
  const migratedActors: Array<{
    id: string;
    taskId: string;
    userId: string;
    role: TaskActorRole;
    notes: string | null;
  }> = await (db as any).taskActor.findMany({
    where: {
      notes: { contains: 'Migrated from TaskAssignee [' },
    },
    select: {
      id: true,
      taskId: true,
      userId: true,
      role: true,
      notes: true,
    },
  });

  const unmatchedActorIds: string[] = [];
  for (const actor of migratedActors) {
    // Extract assignee id from notes: "Migrated from TaskAssignee [<id>]"
    const match = actor.notes?.match(/Migrated from TaskAssignee \[([^\]]+)\]/);
    if (!match) continue;
    const assigneeId = match[1];

    const assigneeExists = await (db as any).taskAssignee.findFirst({
      where: { id: assigneeId },
      select: { id: true },
    });

    if (!assigneeExists) {
      unmatchedActorIds.push(actor.id);
    }
  }

  return {
    isParityMatched:
      unmatchedAssigneeIds.length === 0 &&
      tasksWithMultipleDRIs.length === 0 &&
      unmatchedActorIds.length === 0,
    totalAssignees: assignees.length,
    totalMatchedActors,
    unmatchedAssigneeIds,
    tasksWithMultipleDRIs,
    unmatchedActorIds,
  };
}
