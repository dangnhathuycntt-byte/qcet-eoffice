/**
 * Bulk lifecycle capability (plan P0-07 / R-T07-bulk).
 *
 * A bulk lifecycle action may be offered ONLY when it is valid for EVERY task
 * in the selection. Offering a transition that only SOME of the selection
 * permits lets an actor launder authority: select N tasks where one happens to
 * be approvable, and the single batch call carries all N through the same
 * server gate.
 *
 * This module is a thin aggregation layer. It owns NO authority logic of its
 * own — every per-task verdict comes from the canonical capability engine
 * (`evaluateTaskCapabilityMatrix`, src/domain/tasks/contract.ts), which already
 * enforces lifecycle state, approval authority and the Separation of Duties
 * anti-self-approval rule. Duplicating any of that here would create a second
 * capability channel.
 */

import type { TaskStatus } from "@/types/dashboard";
import {
  CAN_APPROVE,
  CAN_EDIT,
  CAN_REJECT,
  CAN_SUBMIT,
  evaluateTaskCapabilityMatrix,
  type DelegationContract,
  type TaskActorContract,
  type TaskCapabilityType,
  type TaskEntityContract,
} from "./contract";
import { mapDbStatusToLifecycle } from "./canonical-semantics";

/**
 * The capability a bulk transition into each canonical lifecycle state requires.
 * Keyed by lifecycle state so DB and UI spellings of the same status agree.
 */
const REQUIRED_CAPABILITY_BY_TARGET: Readonly<
  Record<string, TaskCapabilityType>
> = {
  COMPLETED: CAN_APPROVE,
  PENDING_EXECUTIVE_APPROVAL: CAN_APPROVE,
  NEEDS_REVIEW: CAN_REJECT,
  WAITING_APPROVAL: CAN_SUBMIT,
  IN_PROGRESS: CAN_EDIT,
  NOT_STARTED: CAN_EDIT,
  CANCELLED: CAN_EDIT,
  OVERDUE: CAN_EDIT,
};

export interface BulkTransitionVerdict {
  /** True only when EVERY task in the selection permits the transition. */
  allowed: boolean;
  /** Ids of the tasks withholding the transition (empty when allowed). */
  blockedTaskIds: string[];
  /** Why the transition was withheld, or null when allowed. */
  reason: BulkBlockReason | null;
}

export type BulkBlockReason =
  | "no-selection"
  | "no-authenticated-actor"
  | "unknown-target"
  | "selection-lacks-capability";

/**
 * Answers whether an actor may apply `targetStatus` to the WHOLE selection.
 *
 * Every task must independently hold the capability the target demands; one
 * dissenting task withholds the entire batch.
 */
export function canBulkTransition(
  tasks: readonly TaskEntityContract[],
  targetStatus: TaskStatus,
  actor: TaskActorContract | null | undefined,
  delegations: readonly DelegationContract[] = []
): BulkTransitionVerdict {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return { allowed: false, blockedTaskIds: [], reason: "no-selection" };
  }

  if (!actor?.id) {
    return {
      allowed: false,
      blockedTaskIds: tasks.map((task) => task.id),
      reason: "no-authenticated-actor",
    };
  }

  const requiredCapability =
    REQUIRED_CAPABILITY_BY_TARGET[mapDbStatusToLifecycle(targetStatus)];

  if (!requiredCapability) {
    return {
      allowed: false,
      blockedTaskIds: tasks.map((task) => task.id),
      reason: "unknown-target",
    };
  }

  const blockedTaskIds = tasks
    .filter(
      (task) =>
        !evaluateTaskCapabilityMatrix(actor, task, [...delegations]).matrix[
          requiredCapability
        ]
    )
    .map((task) => task.id);

  if (blockedTaskIds.length > 0) {
    return {
      allowed: false,
      blockedTaskIds,
      reason: "selection-lacks-capability",
    };
  }

  return { allowed: true, blockedTaskIds: [], reason: null };
}

/**
 * Filters candidate lifecycle targets down to those valid for the entire
 * selection, so a bulk control can render only what it may actually apply.
 */
export function filterBulkTransitionTargets(
  tasks: readonly TaskEntityContract[],
  candidateTargets: readonly TaskStatus[],
  actor: TaskActorContract | null | undefined,
  delegations: readonly DelegationContract[] = []
): TaskStatus[] {
  return candidateTargets.filter(
    (target) => canBulkTransition(tasks, target, actor, delegations).allowed
  );
}
