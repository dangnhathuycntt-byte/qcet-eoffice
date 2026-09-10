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
 */
export function isUserAuthorizedApprover(task: any, userContext: UserContext): boolean {
  if (userContext.canApprove) return true;
  if (isUserExecutive(userContext)) return true;

  const status = mapDbStatusToLifecycle(task.status);

  // Executive-only approval level
  if (status === 'PENDING_EXECUTIVE_APPROVAL') {
    return false;
  }

  // Department-level / Waiting approval
  const taskDeptId = task.departmentId || task.leadDepartmentId || null;
  if (isUserUnitHead(userContext, taskDeptId)) {
    return true;
  }

  return false;
}

/**
 * Evaluates whether the user is a maker (creator, lead assignee, co-assignee, submitter).
 *
 * Separation of Duties Invariant:
 * Any maker is strictly prohibited from approving their own task.
 */
export function isTaskMaker(task: any, userId: string): boolean {
  if (!userId || !task) return false;

  // 1. Creator check
  if (task.createdById === userId || task.creatorId === userId) {
    return true;
  }

  // 2. Lead Assignee / DRI / Primary Owner check
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

  // 3. Assignees & Collaborators check
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

  // 4. Submitter / Deliverable Uploader check
  if (task.submittedByUserId === userId) {
    return true;
  }
  if (
    Array.isArray(task.deliverableUploadedByIds) &&
    task.deliverableUploadedByIds.includes(userId)
  ) {
    return true;
  }
  if (
    Array.isArray(task.deliverables) &&
    task.deliverables.some((d: any) => d?.uploadedById === userId)
  ) {
    return true;
  }

  return false;
}

/**
 * Evaluates whether the user is an assigned executor (lead assignee or co-assignee).
 */
export function isTaskAssignee(task: any, userId: string): boolean {
  if (!userId || !task) return false;

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

  const isMaker = isTaskMaker(task, userId);
  const isAssignee = isTaskAssignee(task, userId);

  const isOverdue =
    status === 'OVERDUE' ||
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
  // When user is assignee/co-assignee and task is NOT_STARTED or IN_PROGRESS (or OVERDUE)
  if (isAssignee) {
    if (status === 'NOT_STARTED' || status === 'IN_PROGRESS' || status === 'OVERDUE') {
      attentions.push('requires_my_action');
    }
  }

  // 4. Checker Attention: 'requires_my_approval'
  // Enforcing SoD: A task creator / lead assignee / submitter CANNOT have 'requires_my_approval'
  if (status === 'WAITING_APPROVAL' || status === 'PENDING_EXECUTIVE_APPROVAL') {
    if (!isMaker) {
      if (isUserAuthorizedApprover(task, userContext)) {
        attentions.push('requires_my_approval');
      }
    }
  }

  // 5. Blocked Attention: 'blocked'
  if (task.status === 'BLOCKED' || task.isBlocked === true) {
    attentions.push('blocked');
  }

  // Deduplicate results while preserving deterministic order
  return Array.from(new Set(attentions));
}
