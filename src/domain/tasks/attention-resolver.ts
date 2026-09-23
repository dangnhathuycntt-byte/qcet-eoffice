/**
 * Canonical Task User Attention Resolver
 *
 * Implements the subjective user action backlog resolution:
 * 1. Segregation of Duties (SoD): A task maker (creator, lead assignee, co-assignee,
 *    submitter) CANNOT have 'requires_my_approval' on their own task.
 * 2. Maker Attention: 'requires_my_action' when user is assignee/co-assignee and task
 *    is NOT_STARTED or IN_PROGRESS.
 * 3. Checker Attention: 'requires_my_approval' when task is WAITING_APPROVAL or
 *    PENDING_EXECUTIVE_APPROVAL, user has approval authority, and is NOT a maker.
 * 4. Temporal Attention: 'overdue' when dueDate < now and status !== 'COMPLETED'.
 * 5. Light-only token alignment, zero emojis.
 */

import type {
  UserAttentionType,
  UserAttentionContext,
  AttentionResolverFn,
} from '../../contracts/workspace-semantic';
import { mapDbStatusToLifecycle } from './canonical-semantics';
import {
  isTaskPastDue,
  getSystemReferenceDate,
  parseDateParts,
} from '../../lib/academic-calendar';
import { checkAntiSelfApproval } from './contract';

export type { UserAttentionType, UserAttentionContext, AttentionResolverFn };
export type UserContext = UserAttentionContext;

const EXECUTIVE_ROLES = new Set([
  'ADMIN',
  'EXECUTIVE',
  'BGH',
  'BAN_GIAM_HIEU',
  'HIEU_TRUONG',
  'PHO_HIEU_TRUONG',
]);

const EXECUTIVE_POSITION_CODES = new Set([
  'HIEU_TRUONG',
  'PHO_HIEU_TRUONG',
  'BGH',
  'BAN_GIAM_HIEU',
]);

const UNIT_HEAD_ROLES = new Set([
  'MANAGER',
  'TRUONG_PHONG',
  'TRUONG_DON_VI',
  'TRUONG_KHOA',
  'GIAM_DOC_TRUNG_TAM',
]);

const UNIT_HEAD_POSITION_CODES = new Set([
  'TRUONG_PHONG',
  'PHO_TRUONG_PHONG',
  'TRUONG_KHOA',
  'PHO_TRUONG_KHOA',
  'TRUONG_DON_VI',
  'GIAM_DOC_TRUNG_TAM',
]);

/**
 * Checks if a user context qualifies as an institutional executive.
 */
export function isUserExecutive(context: UserContext): boolean {
  if (context.isAdmin || context.isExecutive) return true;
  const role = (context.role || '').trim().toUpperCase();
  if (EXECUTIVE_ROLES.has(role)) return true;
  const pos = (context.positionCode || '').trim().toUpperCase();
  if (EXECUTIVE_POSITION_CODES.has(pos)) return true;
  return false;
}

/**
 * Checks if a user context qualifies as a unit head / department manager.
 */
export function isUserUnitHead(context: UserContext, unitId?: string | null): boolean {
  if (context.isUnitHead) {
    if (!unitId || !context.departmentId) return true;
    return context.departmentId === unitId;
  }
  const role = (context.role || '').trim().toUpperCase();
  if (UNIT_HEAD_ROLES.has(role)) {
    if (!unitId || !context.departmentId) return true;
    return context.departmentId === unitId;
  }
  const pos = (context.positionCode || '').trim().toUpperCase();
  if (UNIT_HEAD_POSITION_CODES.has(pos)) {
    if (!unitId || !context.departmentId) return true;
    return context.departmentId === unitId;
  }
  return false;
}

/**
 * Verifies if the user is an authorized checker/approver for the given task.
 *
 * Capability resolution order (INT-9):
 *   1. An explicit server denial (`canApprove === false`) always wins - it must
 *      never be re-granted by role membership.
 *   2. The PENDING_EXECUTIVE_APPROVAL executive-only guard is evaluated BEFORE
 *      any generic user-level capability grant, so a coarse `canApprove`
 *      boolean can never widen institutional executive-only authority to a
 *      unit-scoped actor. Only an institutional executive, or an explicit
 *      task-level server grant, may approve this lifecycle level.
 *   3. Otherwise an explicit server grant (`canApprove === true`) is
 *      authoritative for unit-level (WAITING_APPROVAL) approval.
 *   4. With no explicit verdict, the legacy role/position heuristics apply.
 *
 * Note: `canApprove` on {@link UserAttentionContext} is a single per-actor
 * boolean (see src/contracts/workspace-semantic.ts). Fully modelling approval
 * capability per task/scope requires a frozen-contract revision owned by the
 * contracts shard; this module must not invent a second capability channel.
 */
export function isUserAuthorizedApprover(task: any, userContext: UserContext): boolean {
  // Server Truth Wins: an explicit denial is authoritative at every approval
  // level and MUST NOT be re-granted by role/position membership.
  if (userContext.canApprove === false) return false;

  const status = mapDbStatusToLifecycle(task.status);

  // Executive-only approval level (INT-9). The executive-only guard precedes
  // the generic capability grant so a unit-scoped `canApprove` boolean cannot
  // bypass it; only an institutional executive or an explicit server grant
  // may approve.
  if (status === 'PENDING_EXECUTIVE_APPROVAL') {
    if (isUserExecutive(userContext)) return true;
    return userContext.canApprove === true;
  }

  // Server Truth Wins: an explicit server capability grant overrides the
  // legacy role/position heuristics.
  if (userContext.canApprove === true) return true;

  if (isUserExecutive(userContext)) return true;

  // Department-level / Waiting approval
  const taskDeptId = task.departmentId || task.leadDepartmentId || null;
  if (isUserUnitHead(userContext, taskDeptId)) {
    return true;
  }

  return false;
}

/**
 * Canonical actor-specific review-capability gate (T04).
 *
 * Answers, for a specific authenticated actor, whether the approval of this
 * task is genuinely "waiting for them". It requires ALL of:
 *   1. Actor identity - an authenticated userId is present.
 *   2. Approvable lifecycle - status is WAITING_APPROVAL or
 *      PENDING_EXECUTIVE_APPROVAL.
 *   3. Capability + SoD - the actor holds approval capability (explicit server
 *      verdict when supplied, otherwise the legacy authority heuristics) AND
 *      is not a maker of the task.
 *
 * Consequence (T04): a user who cannot review never sees the task as
 * waiting-for-them, even when the status is WAITING_APPROVAL.
 *
 * Single canonical owner (One Capability, One Implementation): consumers must
 * import THIS gate rather than re-implementing a role/status review check, so
 * Segregation of Duties and lifecycle gating can never be silently bypassed.
 */
export function canUserReviewTask(task: any, userContext: UserContext): boolean {
  if (!task || !userContext || !userContext.userId) return false;

  const status = mapDbStatusToLifecycle(task.status);
  if (status !== 'WAITING_APPROVAL' && status !== 'PENDING_EXECUTIVE_APPROVAL') {
    return false;
  }

  if (isTaskMaker(task, userContext.userId)) return false;

  return isUserAuthorizedApprover(task, userContext);
}

/**
 * Evaluates whether the user is a maker (creator, lead assignee, co-assignee, submitter, deliverable uploader).
 *
 * Canonical adapter wrapping the unified checkAntiSelfApproval SoD guard,
 * preserving 100% parity for all recognized task maker shapes.
 *
 * Separation of Duties Invariant:
 * Any maker is strictly prohibited from approving their own task.
 */
export function isTaskMaker(task: any, userId: string): boolean {
  if (!userId || !task) return false;

  // 1. Resolve Creator
  const creatorId =
    task.creatorId ||
    (typeof task.creator === 'string'
      ? task.creator
      : task.creator?.userId || task.creator?.id) ||
    null;
  const createdById = task.createdById || null;

  // 2. Resolve Primary Owner / DRI & assignedTo variants
  const primaryOwnerId =
    task.primaryOwnerId ||
    task.driId ||
    task.assigneeId ||
    task.leadAssigneeId ||
    task.assignedToId ||
    (typeof task.assignedTo === 'string'
      ? task.assignedTo
      : task.assignedTo?.userId || task.assignedTo?.id) ||
    (typeof task.primaryOwner === 'string'
      ? task.primaryOwner
      : task.primaryOwner?.userId || task.primaryOwner?.id) ||
    null;
  const driId = task.driId || null;

  // 3. Resolve Assignees, Collaborators & Co-Assignees
  const assigneeIds: string[] = [];
  if (Array.isArray(task.assigneeIds)) {
    for (const id of task.assigneeIds) {
      if (typeof id === 'string') assigneeIds.push(id);
    }
  }
  // Include assignedTo variants into assigneeIds to ensure complete coverage
  if (typeof task.assigneeId === 'string') assigneeIds.push(task.assigneeId);
  if (typeof task.leadAssigneeId === 'string') assigneeIds.push(task.leadAssigneeId);
  if (typeof task.assignedToId === 'string') assigneeIds.push(task.assignedToId);
  if (typeof task.assignedTo === 'string') {
    assigneeIds.push(task.assignedTo);
  } else if (task.assignedTo?.userId) {
    assigneeIds.push(task.assignedTo.userId);
  } else if (task.assignedTo?.id) {
    assigneeIds.push(task.assignedTo.id);
  }
  if (task.primaryOwner?.userId) assigneeIds.push(task.primaryOwner.userId);
  if (task.primaryOwner?.id) assigneeIds.push(task.primaryOwner.id);
  if (typeof task.primaryOwner === 'string') assigneeIds.push(task.primaryOwner);

  const assignees = Array.isArray(task.assignees) ? task.assignees : undefined;
  const collaborators = Array.isArray(task.collaborators) ? task.collaborators : undefined;
  const coAssigneeIds = Array.isArray(task.coAssigneeIds) ? task.coAssigneeIds : undefined;
  const coAssignees = Array.isArray(task.coAssignees) ? task.coAssignees : undefined;

  // 4. Resolve Submitter
  const submittedByUserId = task.submittedByUserId || null;

  // 5. Resolve Deliverables & Uploaders
  const deliverableUploadedByIds = Array.isArray(task.deliverableUploadedByIds)
    ? task.deliverableUploadedByIds
    : undefined;
  const deliverables = Array.isArray(task.deliverables) ? task.deliverables : undefined;
  const uploadedById = task.uploadedById || null;

  const result = checkAntiSelfApproval({
    userId,
    creatorId,
    createdById,
    primaryOwnerId,
    driId,
    assigneeIds,
    assignees,
    collaborators,
    coAssigneeIds,
    coAssignees,
    submittedByUserId,
    deliverables,
    deliverableUploadedByIds,
    uploadedById,
  });

  return !result.allowed;
}

/**
 * Evaluates whether the user is an assigned executor (lead assignee or co-assignee).
 */
export function isTaskAssignee(task: any, userId: string): boolean {
  if (!userId || !task) return false;

  // Phase 9: TaskAssignee table dropped — sole authority is TaskActor.
  if (Array.isArray(task.actors) && task.actors.length > 0) {
    return task.actors.some(
      (a: any) =>
        a.userId === userId &&
        (a.role === 'DRI' || a.role === 'COLLABORATOR' || a.role === 'REVIEWER' || a.isPrimaryDRI)
    );
  }

  // Fallback for DTOs that carry flattened fields (no actors relation loaded)
  if (
    task.assigneeId === userId ||
    task.leadAssigneeId === userId ||
    task.primaryOwnerId === userId ||
    task.driId === userId ||
    task.assignedToId === userId ||
    (typeof task.assignedTo === 'string' && task.assignedTo === userId) ||
    task.assignedTo?.userId === userId ||
    task.assignedTo?.id === userId ||
    task.primaryOwner?.userId === userId ||
    task.primaryOwner?.id === userId
  ) {
    return true;
  }

  if (Array.isArray(task.assigneeIds) && task.assigneeIds.includes(userId)) {
    return true;
  }
  if (
    Array.isArray(task.assignees) &&
    task.assignees.some((a: any) =>
      typeof a === 'string' ? a === userId : (a?.userId || a?.id) === userId
    )
  ) {
    return true;
  }
  if (
    Array.isArray(task.collaborators) &&
    task.collaborators.some((c: any) =>
      typeof c === 'string' ? c === userId : (c?.userId || c?.id) === userId
    )
  ) {
    return true;
  }
  if (Array.isArray(task.coAssigneeIds) && task.coAssigneeIds.includes(userId)) {
    return true;
  }
  if (
    Array.isArray(task.coAssignees) &&
    task.coAssignees.some((ca: any) =>
      typeof ca === 'string' ? ca === userId : (ca?.userId || ca?.id) === userId
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Checks if the task due date is strictly in the past using ICT timezone boundaries.
 */
function isDatePast(dueDate: string | Date | null | undefined, referenceNow?: Date | string | number): boolean {
  if (!dueDate) return false;

  const refDateStr = referenceNow
    ? typeof referenceNow === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(referenceNow.slice(0, 10))
      ? referenceNow.slice(0, 10)
      : new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Ho_Chi_Minh',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date(referenceNow))
    : getSystemReferenceDate();

  return isTaskPastDue(dueDate, refDateStr);
}

/**
 * Checks if the task due date is within the specified days window (default 3 days)
 * from the reference date in ICT timezone, and not yet overdue.
 *
 * Requirements:
 * - Compares date boundaries in Indochina Time (ICT, UTC+7).
 * - Avoids UTC midnight drift.
 * - Returns false if task is already overdue, dueDate is missing, or invalid.
 */
export function isTaskDueSoon(
  dueDate: string | Date | null | undefined,
  referenceNow?: Date | string | number,
  daysWindow: number = 3
): boolean {
  if (!dueDate) return false;

  const refDateStr = referenceNow
    ? typeof referenceNow === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(referenceNow.slice(0, 10))
      ? referenceNow.slice(0, 10)
      : new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Ho_Chi_Minh',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date(referenceNow))
    : getSystemReferenceDate();

  if (isTaskPastDue(dueDate, refDateStr)) {
    return false;
  }

  const dueParts = parseDateParts(dueDate);
  const refParts = parseDateParts(refDateStr);
  if (!dueParts || !refParts) {
    return false;
  }

  const dueUtc = Date.UTC(dueParts.year, dueParts.month - 1, dueParts.day);
  const refUtc = Date.UTC(refParts.year, refParts.month - 1, refParts.day);
  const diffDays = Math.round((dueUtc - refUtc) / (1000 * 60 * 60 * 24));

  return diffDays >= 0 && diffDays <= daysWindow;
}

/**
 * Resolves the subjective attention types for a user on a given task.
 *
 * @param task The task domain entity, DTO, or ViewModel.
 * @param userContext Context of the inspecting user.
 * @returns Array of applicable UserAttentionType items.
 */
export function resolveUserAttention(
  task: any,
  userContext: UserContext
): UserAttentionType[] {
  if (!task || !userContext || !userContext.userId) {
    return [];
  }

  const { userId } = userContext;
  const status = mapDbStatusToLifecycle(task.status);
  const attentions: UserAttentionType[] = [];

  const isAssignee = isTaskAssignee(task, userId);

  const isOverdue =
    task.isOverdue === true ||
    isDatePast(task.dueDate, userContext.now);

  // 1. Temporal Attention: 'overdue'
  // When dueDate < now and status !== 'COMPLETED' (and !== 'CANCELLED')
  if (status !== 'COMPLETED' && status !== 'CANCELLED') {
    if (isOverdue) {
      attentions.push('overdue');
    }
  }

  // 2. Temporal Attention: 'due_soon'
  // Active task, not overdue, and dueDate within 3 days in ICT
  if (status !== 'COMPLETED' && status !== 'CANCELLED' && !isOverdue) {
    if (isTaskDueSoon(task.dueDate, userContext.now, 3)) {
      attentions.push('due_soon');
    }
  }

  // 3. Maker Attention: 'requires_my_action'
  // When user is assignee/co-assignee and task is NOT_STARTED or IN_PROGRESS
  if (isAssignee) {
    if (status === 'NOT_STARTED' || status === 'IN_PROGRESS') {
      attentions.push('requires_my_action');
    }
  }

  // 4. Checker Attention: 'requires_my_approval'
  // Actor-specific, server-capability gated, and SoD-enforced via the single
  // canonical review gate (T04).
  if (canUserReviewTask(task, userContext)) {
    attentions.push('requires_my_approval');
  }

  // 5. Blocked Attention: 'blocked'
  if (task.status === 'BLOCKED' || task.isBlocked === true) {
    attentions.push('blocked');
  }

  // Deduplicate results while preserving deterministic order
  return Array.from(new Set(attentions));
}
