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

/**
 * Maps legacy AssigneeRole to canonical TaskActorRole & primary DRI flag.
 *
 * FAILS CLOSED on unknown role rather than silently falling back to COLLABORATOR,
 * preventing security/privilege misassignment (RFC-01 / ADR-005 requirement).
 */
export function mapAssigneeRoleToActorRole(role: unknown): {
  role: TaskActorRole;
  isPrimaryDRI: boolean;
} {
  if (typeof role !== 'string' || !role.trim()) {
    throw new Error(
      `Invalid AssigneeRole: role must be a non-empty string, received ${typeof role}`
    );
  }

  const normalized = role.trim().toUpperCase();

  switch (normalized) {
    case AssigneeRole.PRIMARY_OWNER:
      return { role: TaskActorRole.DRI, isPrimaryDRI: true };
    case AssigneeRole.COLLABORATOR:
      return { role: TaskActorRole.COLLABORATOR, isPrimaryDRI: false };
    case AssigneeRole.SUPERVISOR:
      return { role: TaskActorRole.OBSERVER, isPrimaryDRI: false };
    default:
      throw new Error(
        `Unknown AssigneeRole: '${role}'. Migration must fail closed to prevent privilege misassignment.`
      );
  }
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
 */
export async function syncAssigneeToActor(
  db: DbClient,
  assignee: TaskAssigneeInput
): Promise<{ actorId: string; created: boolean }> {
  const { role, isPrimaryDRI } = mapAssigneeRoleToActorRole(assignee.roleInTask);

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

  // Create new TaskActor preserving exact appointedAt timestamp
  const created = await (db as any).taskActor.create({
    data: {
      taskId: assignee.taskId,
      userId: assignee.userId,
      role,
      isPrimaryDRI: targetIsPrimaryDRI,
      appointedAt: assignee.assignedAt ?? new Date(),
      notes: assignee.id ? `Migrated from TaskAssignee [${assignee.id}]` : 'Dual-write from TaskAssignee',
    },
  });

  return { actorId: created.id, created: true };
}

/**
 * Batch backfills all TaskAssignee records into TaskActor table idempotently.
 * Preserves timestamps, validates roles, and enforces Single Primary DRI invariant.
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
      orderBy: { id: 'asc' },
    });

    if (assignees.length === 0) {
      break;
    }

    cursor = assignees[assignees.length - 1].id;
    if (assignees.length < batchSize) {
      hasMore = false;
    }

    for (const assignee of assignees) {
      stats.totalProcessed++;
      try {
        const { role, isPrimaryDRI } = mapAssigneeRoleToActorRole(assignee.roleInTask);

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

        // Single Primary DRI preservation: Check if task already has a DRI
        let targetIsPrimaryDRI = isPrimaryDRI;
        if (targetIsPrimaryDRI) {
          const existingDRI = await (db as any).taskActor.findFirst({
            where: { taskId: assignee.taskId, isPrimaryDRI: true },
          });
          if (existingDRI) {
            targetIsPrimaryDRI = false;
          }
        }

        if (!dryRun) {
          await (db as any).taskActor.create({
            data: {
              taskId: assignee.taskId,
              userId: assignee.userId,
              role,
              isPrimaryDRI: targetIsPrimaryDRI,
              appointedAt: assignee.assignedAt,
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
}

/**
 * Verifies parity between TaskAssignee and TaskActor tables:
 * - 100% of TaskAssignee rows have equivalent TaskActor rows.
 * - Single Primary DRI invariant is satisfied (at most 1 DRI per task).
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
      const { role } = mapAssigneeRoleToActorRole(assignee.roleInTask);

      const actor = await (db as any).taskActor.findFirst({
        where: {
          taskId: assignee.taskId,
          userId: assignee.userId,
          role,
        },
      });

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

  return {
    isParityMatched:
      unmatchedAssigneeIds.length === 0 && tasksWithMultipleDRIs.length === 0,
    totalAssignees: assignees.length,
    totalMatchedActors,
    unmatchedAssigneeIds,
    tasksWithMultipleDRIs,
  };
}
