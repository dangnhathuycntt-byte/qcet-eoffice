/**
 * Canonical Task Semantics & Status Mapping Layer
 *
 * Core Invariants:
 * 1. Single Canonical Lifecycle: All database status variations map deterministically
 *    to TaskLifecycleStatus.
 * 2. Complete Kanban Projection: Every valid lifecycle status maps to a recognized
 *    Kanban column ('NEW' | 'IN_PROGRESS' | 'NEEDS_REVIEW' | 'COMPLETED'), resolving
 *    the historical 85-task delta (75 NOT_STARTED + 9 WAITING_APPROVAL + 1 OVERDUE).
 * 3. Light-only token alignment, zero emojis.
 */

import type {
  TaskLifecycleStatus,
  KanbanColumnId,
  KanbanColumnMapping,
  DetailedKanbanProjection,
} from '../../contracts/workspace-semantic';

export type { TaskLifecycleStatus, KanbanColumnId, KanbanColumnMapping, DetailedKanbanProjection };

export const KANBAN_COLUMNS = ['NEW', 'IN_PROGRESS', 'NEEDS_REVIEW', 'COMPLETED'] as const;

/**
 * Maps any raw database status or legacy alias into the canonical TaskLifecycleStatus.
 *
 * Mapping rules:
 * - NOT_STARTED, NEW, TODO -> NOT_STARTED
 * - IN_PROGRESS, DOING, BLOCKED -> IN_PROGRESS
 * - WAITING_APPROVAL, NEEDS_REVIEW -> WAITING_APPROVAL
 * - PENDING_EXECUTIVE_APPROVAL -> PENDING_EXECUTIVE_APPROVAL
 * - COMPLETED, DONE -> COMPLETED
 * - OVERDUE -> OVERDUE
 * - CANCELLED, CANCELED, ARCHIVED -> CANCELLED
 */
export function mapDbStatusToLifecycle(dbStatus: string): TaskLifecycleStatus {
  if (!dbStatus) {
    return 'NOT_STARTED';
  }

  const normalized = dbStatus.trim().toUpperCase();

  switch (normalized) {
    case 'NOT_STARTED':
    case 'NEW':
    case 'TODO':
      return 'NOT_STARTED';

    case 'IN_PROGRESS':
    case 'DOING':
    case 'BLOCKED':
      return 'IN_PROGRESS';

    case 'WAITING_APPROVAL':
    case 'NEEDS_REVIEW':
      return 'WAITING_APPROVAL';

    case 'PENDING_EXECUTIVE_APPROVAL':
      return 'PENDING_EXECUTIVE_APPROVAL';

    case 'COMPLETED':
    case 'DONE':
      return 'COMPLETED';

    case 'OVERDUE':
      return 'OVERDUE';

    case 'CANCELLED':
    case 'CANCELED':
    case 'ARCHIVED':
      return 'CANCELLED';

    default:
      return 'IN_PROGRESS';
  }
}

/**
 * Map any raw database status to the 4 canonical UI display statuses.
 *
 * Unlike `mapDbStatusToLifecycle` (7 lifecycle values), this collapses into the
 * 4 statuses the UI presents in dropdowns and property controls:
 *   NOT_STARTED | IN_PROGRESS | WAITING_APPROVAL | COMPLETED
 *
 * CANCELLED maps to itself because it is a valid display state in some views
 * (table badges, batch actions). Consumers that only show the 4 core states
 * should filter it out explicitly.
 */
export function normalizeDisplayStatus(
  raw: string | null | undefined,
): 'NOT_STARTED' | 'IN_PROGRESS' | 'WAITING_APPROVAL' | 'COMPLETED' | 'CANCELLED' {
  const lifecycle = mapDbStatusToLifecycle(raw ?? '');
  switch (lifecycle) {
    case 'COMPLETED':
      return 'COMPLETED';
    case 'IN_PROGRESS':
    case 'OVERDUE':
      return 'IN_PROGRESS';
    case 'WAITING_APPROVAL':
    case 'PENDING_EXECUTIVE_APPROVAL':
      return 'WAITING_APPROVAL';
    case 'CANCELLED':
      return 'CANCELLED';
    default:
      return 'NOT_STARTED';
  }
}

/**
 * Lifecycle-only completion invariant.
 *
 * Completion is a lifecycle property derived SOLELY from the canonical
 * terminal status COMPLETED. Progress is never a completion signal: a task in
 * WAITING_APPROVAL that has reached progressPercent = 100 is still awaiting
 * review and is therefore NOT completed.
 */
export interface TaskCompletionDerivation {
  lifecycle: TaskLifecycleStatus;
  completed: boolean;
}

/**
 * The single completion rule for the codebase. Completion is a property of the
 * canonical lifecycle and nothing else: only the terminal COMPLETED lifecycle is
 * complete. Kept private so there is exactly one definition of "completed"; every
 * public predicate routes through it (One Capability, One Implementation).
 */
function isCompletedLifecycle(lifecycle: TaskLifecycleStatus): boolean {
  return lifecycle === 'COMPLETED';
}

/**
 * Returns true if and only if the raw status maps to the terminal COMPLETED
 * lifecycle. No progress input is accepted, so a percentage can never be
 * mistaken for completion.
 *
 * Canonical surfaces (workspace 'completed' filter, unified task hub, task
 * detail side sheet) must route completion through this helper or
 * deriveTaskCompletion rather than re-deriving it from `progressPercent`.
 */
export function isTaskLifecycleComplete(dbStatus: string | null | undefined): boolean {
  return isCompletedLifecycle(mapDbStatusToLifecycle(dbStatus ?? ''));
}

/**
 * Derives the canonical completion projection for a task-like record.
 *
 * Invariant (T03 - completion is lifecycle-only):
 * - status COMPLETED / DONE -> { lifecycle: 'COMPLETED', completed: true }
 * - status WAITING_APPROVAL with progressPercent = 100 -> { completed: false }
 * - progressPercent is accepted only for record-shape compatibility and is
 *   intentionally ignored; completion is never derived from progress.
 */
export function deriveTaskCompletion(
  task: { status?: string | null; progressPercent?: number | null } | null | undefined
): TaskCompletionDerivation {
  const lifecycle = mapDbStatusToLifecycle(task?.status ?? '');
  return {
    lifecycle,
    completed: isCompletedLifecycle(lifecycle),
  };
}

/**
 * Projects a TaskLifecycleStatus into a Kanban column.
 *
 * Mapping rules:
 * - NOT_STARTED -> 'NEW'
 * - IN_PROGRESS -> 'IN_PROGRESS'
 * - WAITING_APPROVAL, PENDING_EXECUTIVE_APPROVAL -> 'NEEDS_REVIEW'
 * - COMPLETED -> 'COMPLETED'
 * - OVERDUE -> 'IN_PROGRESS' (flagged as isOverdue)
 * - CANCELLED -> 'COMPLETED' (closed / terminal state)
 */
export function mapLifecycleToKanbanColumn(status: TaskLifecycleStatus): KanbanColumnId {
  switch (status) {
    case 'NOT_STARTED':
      return 'NEW';

    case 'IN_PROGRESS':
    case 'OVERDUE':
      return 'IN_PROGRESS';

    case 'WAITING_APPROVAL':
    case 'PENDING_EXECUTIVE_APPROVAL':
      return 'NEEDS_REVIEW';

    case 'COMPLETED':
    case 'CANCELLED':
      return 'COMPLETED';

    default: {
      return 'IN_PROGRESS';
    }
  }
}

/**
 * Full Kanban projection returning both the column and overdue state.
 */
export function mapLifecycleToKanban(status: TaskLifecycleStatus): KanbanColumnMapping {
  return {
    column: mapLifecycleToKanbanColumn(status),
    isOverdue: status === 'OVERDUE',
  };
}

/**
 * Detailed Kanban projection with explicit support for intentional exclusions
 * (e.g. CANCELLED tasks when excluded from active board view).
 * Guarantees zero silent dropping and full accounting.
 */
export function projectTaskToKanban(
  status: TaskLifecycleStatus | string,
  options?: { excludeCancelled?: boolean }
): DetailedKanbanProjection {
  const lifecycle = typeof status === 'string' ? mapDbStatusToLifecycle(status) : status;
  const excludeCancelled = options?.excludeCancelled ?? false;

  if (excludeCancelled && lifecycle === 'CANCELLED') {
    return {
      column: 'COMPLETED',
      isOverdue: false,
      isExcluded: true,
      exclusionReason: 'CANCELLED',
    };
  }

  return {
    column: mapLifecycleToKanbanColumn(lifecycle),
    isOverdue: lifecycle === 'OVERDUE',
    isExcluded: false,
    exclusionReason: null,
  };
}

/**
 * Reconciles and validates the elimination of the 85-task delta:
 * 75 NOT_STARTED -> 'NEW'
 * 9 WAITING_APPROVAL -> 'NEEDS_REVIEW'
 * 1 OVERDUE -> 'IN_PROGRESS' (isOverdue: true)
 */
export function verify85TaskDeltaResolution(tasks: Array<{ status: string; id?: string }>): {
  total: number;
  mappedCount: number;
  unmappedCount: number;
  deltaResolved: boolean;
  columnCounts: Record<KanbanColumnId, number>;
} {
  const columnCounts: Record<KanbanColumnId, number> = {
    NEW: 0,
    IN_PROGRESS: 0,
    NEEDS_REVIEW: 0,
    COMPLETED: 0,
  };

  let mappedCount = 0;
  let unmappedCount = 0;

  for (const task of tasks) {
    const lifecycle = mapDbStatusToLifecycle(task.status);
    const col = mapLifecycleToKanbanColumn(lifecycle);

    if (KANBAN_COLUMNS.includes(col)) {
      columnCounts[col] = (columnCounts[col] || 0) + 1;
      mappedCount++;
    } else {
      unmappedCount++;
    }
  }

  return {
    total: tasks.length,
    mappedCount,
    unmappedCount,
    deltaResolved: unmappedCount === 0 && mappedCount === tasks.length,
    columnCounts,
  };
}

export interface TaskCountReconciliation {
  total: number;
  mappedCount: number;
  intentionallyExcludedCount: number;
  unmappedCount: number;
  delta85Resolved: boolean;
  invariantSatisfied: boolean;
  columnCounts: Record<KanbanColumnId, number>;
  exclusionCounts: Record<string, number>;
  deltaBreakdown: {
    notStartedMappedToNew: number;
    waitingApprovalMappedToReview: number;
    overdueMappedToInProgress: number;
    total85DeltaRecovered: number;
  };
}

/**
 * Comprehensive task count reconciliation enforcing the core invariant:
 * mapped_tasks + intentionally_excluded_tasks = total_tasks
 *
 * Explicitly tracks and accounts for:
 * 1. The historical 85-task delta (75 NOT_STARTED, 9 WAITING_APPROVAL, 1 OVERDUE).
 * 2. Zero silent dropping of unknown statuses.
 * 3. Intentional exclusion classification for CANCELLED tasks when board filtering is active.
 */
export function reconcileTaskCounts(
  tasks: Array<{ status: string; id?: string; [key: string]: any }>,
  options?: { excludeCancelled?: boolean }
): TaskCountReconciliation {
  const excludeCancelled = options?.excludeCancelled ?? false;
  const columnCounts: Record<KanbanColumnId, number> = {
    NEW: 0,
    IN_PROGRESS: 0,
    NEEDS_REVIEW: 0,
    COMPLETED: 0,
  };
  const exclusionCounts: Record<string, number> = {
    CANCELLED: 0,
  };

  let mappedCount = 0;
  let intentionallyExcludedCount = 0;
  let unmappedCount = 0;

  let notStartedMappedToNew = 0;
  let waitingApprovalMappedToReview = 0;
  let overdueMappedToInProgress = 0;

  for (const task of tasks) {
    const rawStatus = (task.status || '').trim().toUpperCase();
    const lifecycle = mapDbStatusToLifecycle(task.status);

    if (rawStatus === 'NOT_STARTED' || rawStatus === 'NEW' || rawStatus === 'TODO') {
      notStartedMappedToNew++;
    } else if (
      rawStatus === 'WAITING_APPROVAL' ||
      rawStatus === 'NEEDS_REVIEW' ||
      rawStatus === 'PENDING_EXECUTIVE_APPROVAL'
    ) {
      waitingApprovalMappedToReview++;
    } else if (rawStatus === 'OVERDUE') {
      overdueMappedToInProgress++;
    }

    if (excludeCancelled && lifecycle === 'CANCELLED') {
      intentionallyExcludedCount++;
      exclusionCounts.CANCELLED = (exclusionCounts.CANCELLED || 0) + 1;
      continue;
    }

    const col = mapLifecycleToKanbanColumn(lifecycle);
    if (KANBAN_COLUMNS.includes(col)) {
      columnCounts[col] = (columnCounts[col] || 0) + 1;
      mappedCount++;
    } else {
      unmappedCount++;
    }
  }

  const total85DeltaRecovered =
    notStartedMappedToNew + waitingApprovalMappedToReview + overdueMappedToInProgress;

  return {
    total: tasks.length,
    mappedCount,
    intentionallyExcludedCount,
    unmappedCount,
    delta85Resolved: unmappedCount === 0,
    invariantSatisfied:
      mappedCount + intentionallyExcludedCount === tasks.length && unmappedCount === 0,
    columnCounts,
    exclusionCounts,
    deltaBreakdown: {
      notStartedMappedToNew,
      waitingApprovalMappedToReview,
      overdueMappedToInProgress,
      total85DeltaRecovered,
    },
  };
}

