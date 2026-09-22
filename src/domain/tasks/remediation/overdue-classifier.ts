/**
 * OVERDUE Task Lifecycle Remediation Classifier
 *
 * Implements the recoverable per-task remediation algorithm under ADR-003 ACCEPTED:
 * - Hard Invariant 1: Lifecycle != Attention.
 * - Hard Invariant 2: STRICTLY FORBIDDEN: Blind batch update (UPDATE tasks SET status='IN_PROGRESS' WHERE status='OVERDUE').
 * - Hard Invariant 3: Every OVERDUE task must be analyzed and safely classified into a recoverable
 *   lifecycle state (IN_PROGRESS, NOT_STARTED, WAITING_APPROVAL, or MANUAL_REMEDIATION) with isOverdue=true.
 *
 * Rules:
 * - Rule 1: If isSubmittedForApproval === true or deliverablesCount > 0 -> WAITING_APPROVAL
 * - Rule 2: If progress > 0 or hasActivityLog === true -> IN_PROGRESS
 * - Rule 3: If progress === 0 and !hasActivityLog and !deliverablesCount -> NOT_STARTED
 * - Rule 4: Ambiguous/conflicting state -> MANUAL_REMEDIATION
 */

export type TargetLifecycleStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'WAITING_APPROVAL'
  | 'MANUAL_REMEDIATION';

export interface OverdueTaskInput {
  status: string;
  progress?: number;
  deliverablesCount?: number;
  hasActivityLog?: boolean;
  isSubmittedForApproval?: boolean;
  [key: string]: unknown;
}

export interface OverdueClassificationResult {
  targetLifecycle: TargetLifecycleStatus;
  isOverdue: true;
  reason: string;
}

/**
 * Classifies an OVERDUE task into a safe, recoverable canonical lifecycle state.
 *
 * @param task The task record to analyze
 * @returns Classification decision with targetLifecycle, isOverdue=true, and reason
 */
export function classifyOverdueTask(
  task: OverdueTaskInput
): OverdueClassificationResult {
  // Guard 0: Input validation
  if (!task || typeof task !== 'object') {
    return {
      targetLifecycle: 'MANUAL_REMEDIATION',
      isOverdue: true,
      reason: 'Rule 4: Invalid task payload (non-object or null)',
    };
  }

  // Guard 1: Status verification
  const normalizedStatus = typeof task.status === 'string' ? task.status.trim().toUpperCase() : '';
  if (normalizedStatus !== 'OVERDUE') {
    return {
      targetLifecycle: 'MANUAL_REMEDIATION',
      isOverdue: true,
      reason: `Rule 4: Task status '${task.status}' is not OVERDUE; manual inspection required`,
    };
  }

  // Guard 2: Numeric boundary & sanity checks
  if (task.progress !== undefined && task.progress !== null) {
    if (
      typeof task.progress !== 'number' ||
      Number.isNaN(task.progress) ||
      !Number.isFinite(task.progress)
    ) {
      return {
        targetLifecycle: 'MANUAL_REMEDIATION',
        isOverdue: true,
        reason: 'Rule 4: Invalid progress value: non-numeric or NaN',
      };
    }
    if (task.progress < 0 || task.progress > 100) {
      return {
        targetLifecycle: 'MANUAL_REMEDIATION',
        isOverdue: true,
        reason: `Rule 4: Conflicting progress value out of range [0, 100]: ${task.progress}`,
      };
    }
  }

  if (task.deliverablesCount !== undefined && task.deliverablesCount !== null) {
    if (
      typeof task.deliverablesCount !== 'number' ||
      Number.isNaN(task.deliverablesCount) ||
      !Number.isFinite(task.deliverablesCount) ||
      task.deliverablesCount < 0
    ) {
      return {
        targetLifecycle: 'MANUAL_REMEDIATION',
        isOverdue: true,
        reason: `Rule 4: Invalid deliverablesCount value: ${task.deliverablesCount}`,
      };
    }
  }

  // Guard 3: Explicit conflict / corruption indicators
  if (
    task.hasConflict === true ||
    task.isConflicted === true ||
    task.conflictDetected === true ||
    task.requiresManualReview === true ||
    task.isCorrupted === true
  ) {
    return {
      targetLifecycle: 'MANUAL_REMEDIATION',
      isOverdue: true,
      reason: 'Rule 4: Explicit conflict or manual review flag present on task',
    };
  }

  // Guard 4: Conflicting lifecycle state flags (e.g. marked completed or cancelled while status is OVERDUE)
  if (task.isCompleted === true || task.isCancelled === true || task.deletedAt != null) {
    return {
      targetLifecycle: 'MANUAL_REMEDIATION',
      isOverdue: true,
      reason: 'Rule 4: Conflicting termination state: task has completed/cancelled/deleted flag with OVERDUE status',
    };
  }

  // Guard 5: Insufficient signals (Ambiguous state where no progress, deliverable, or activity is supplied)
  const hasProgress = task.progress !== undefined && task.progress !== null;
  const hasDeliverablesCount = task.deliverablesCount !== undefined && task.deliverablesCount !== null;
  const hasActivityLog = task.hasActivityLog !== undefined && task.hasActivityLog !== null;
  const hasApprovalSubmission = task.isSubmittedForApproval !== undefined && task.isSubmittedForApproval !== null;

  if (!hasProgress && !hasDeliverablesCount && !hasActivityLog && !hasApprovalSubmission) {
    return {
      targetLifecycle: 'MANUAL_REMEDIATION',
      isOverdue: true,
      reason: 'Rule 4: Ambiguous state: insufficient data signals (progress, deliverables, activity, approval all missing)',
    };
  }

  // Rule 1: If isSubmittedForApproval === true or deliverablesCount > 0 -> WAITING_APPROVAL
  const deliverables = typeof task.deliverablesCount === 'number' ? task.deliverablesCount : 0;
  if (task.isSubmittedForApproval === true || deliverables > 0) {
    return {
      targetLifecycle: 'WAITING_APPROVAL',
      isOverdue: true,
      reason: 'Rule 1: Task has submitted deliverables or pending approval prior to deadline expiry',
    };
  }

  // Rule 2: If progress > 0 or hasActivityLog === true -> IN_PROGRESS
  const progressVal = typeof task.progress === 'number' ? task.progress : 0;
  if (progressVal > 0 || task.hasActivityLog === true) {
    return {
      targetLifecycle: 'IN_PROGRESS',
      isOverdue: true,
      reason: 'Rule 2: Task has recorded execution progress or logged user activity',
    };
  }

  // Rule 3: If progress === 0 and !hasActivityLog and !deliverablesCount -> NOT_STARTED
  if (progressVal === 0 && deliverables === 0) {
    // If progress was explicitly 0, or if activity was explicitly false and deliverables 0
    if (hasProgress || task.hasActivityLog === false) {
      return {
        targetLifecycle: 'NOT_STARTED',
        isOverdue: true,
        reason: 'Rule 3: Task has zero progress and no recorded activity or deliverables',
      };
    }
  }

  // Rule 4: Ambiguous/conflicting state fallback -> MANUAL_REMEDIATION
  return {
    targetLifecycle: 'MANUAL_REMEDIATION',
    isOverdue: true,
    reason: 'Rule 4: Ambiguous or unresolvable lifecycle state; routed to manual queue',
  };
}

/**
 * Checks whether the target lifecycle is auto-recoverable without manual intervention.
 */
export function isAutoRecoverableLifecycle(
  targetLifecycle: TargetLifecycleStatus
): boolean {
  return targetLifecycle === 'NOT_STARTED' ||
    targetLifecycle === 'IN_PROGRESS' ||
    targetLifecycle === 'WAITING_APPROVAL';
}
