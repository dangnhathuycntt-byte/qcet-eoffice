/**
 * Canonical Task Semantics & Status Mapping Layer
 *
 * Core Invariants:
 * 1. Single Canonical Lifecycle: All database status variations map deterministically
 *    to TaskLifecycleStatus.
 * 2. Complete Kanban Projection: Every valid lifecycle status maps to a recognized
 *    Kanban column ('NEW' | 'IN_PROGRESS' | 'NEEDS_REVIEW' | 'COMPLETED'), resolving
 *    the historical 85-task delta (75 NOT_STARTED + 9 WAITING_APPROVAL).
 * 3. Light-only token alignment, zero emojis.
 */

import type {
  TaskLifecycleStatus,
  KanbanColumnId,
  KanbanColumnMapping,
  DetailedKanbanProjection,
} from '@qcet/contracts/workspace-semantic';
import { normalizeTaskStatus } from './state-machine';

export type { TaskLifecycleStatus, KanbanColumnId, KanbanColumnMapping, DetailedKanbanProjection };
export { normalizeTaskStatus };

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
 * - CANCELLED -> 'COMPLETED' (closed / terminal state)
 */
export function mapLifecycleToKanbanColumn(status: TaskLifecycleStatus): KanbanColumnId {
  switch (status) {
    case 'NOT_STARTED':
      return 'NEW';

    case 'IN_PROGRESS':
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
    total85DeltaRecovered: number;
  };
}

