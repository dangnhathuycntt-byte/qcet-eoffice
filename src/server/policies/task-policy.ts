import { type AuthenticatedUser, normalizeRole } from '@/server/api/request-context';

export interface TaskEntity {
  id: string;
  departmentId?: string | null;
  creatorId?: string | null;
  createdById?: string | null;
  assigneeId?: string | null;
  collaboratorIds?: string[] | string | null;
  assignees?: Array<{ userId: string; roleInTask?: string }> | null;
  status?: string | null;
  scope?: string | null;
  [key: string]: any;
}

function isAdmin(user: AuthenticatedUser): boolean {
  return normalizeRole(user.role) === 'ADMIN';
}

function isManager(user: AuthenticatedUser): boolean {
  return normalizeRole(user.role) === 'MANAGER';
}

function isStaff(user: AuthenticatedUser): boolean {
  return normalizeRole(user.role) === 'STAFF';
}

function getCreatorId(task: TaskEntity): string | null {
  return task.creatorId || task.createdById || null;
}

function getAssigneeId(task: TaskEntity): string | null {
  if (task.assigneeId) return task.assigneeId;
  if (Array.isArray(task.assignees)) {
    const primary = task.assignees.find((a: any) => a.roleInTask === 'PRIMARY_OWNER');
    if (primary) return primary.userId;
  }
  return null;
}

function isCollaborator(
  user: AuthenticatedUser,
  collaboratorIds?: string[] | string | null
): boolean {
  if (!collaboratorIds || !user.id) return false;

  if (Array.isArray(collaboratorIds)) {
    return collaboratorIds.includes(user.id);
  }

  if (typeof collaboratorIds === 'string') {
    const trimmed = collaboratorIds.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.includes(user.id);
        }
      } catch {
        // Fall back to comma-separated parsing
      }
    }
    return trimmed
      .split(',')
      .map((item) => item.trim())
      .includes(user.id);
  }

  return false;
}

function isUserCollaborator(user: AuthenticatedUser, task: TaskEntity): boolean {
  if (isCollaborator(user, task.collaboratorIds)) return true;
  if (Array.isArray(task.assignees)) {
    return task.assignees.some(
      (a: any) => a.roleInTask === 'COLLABORATOR' && a.userId === user.id
    );
  }
  return false;
}

/**
 * Checks if user can read the specified task.
 * Enforces OWASP API1 (BOLA) and role boundaries.
 */
export function canReadTask(user: AuthenticatedUser, task: TaskEntity): boolean {
  if (!user || !task) return false;

  // 1. Privileged institutional leadership / Admin
  if (isAdmin(user)) return true;

  // 2. Direct participants (Creator, Assignee, Collaborator)
  const creatorId = getCreatorId(task);
  const assigneeId = getAssigneeId(task);
  if (creatorId && creatorId === user.id) return true;
  if (assigneeId && assigneeId === user.id) return true;
  if (isUserCollaborator(user, task)) return true;

  // 3. Department boundary: Members of the same department can view department tasks
  if (task.departmentId && user.departmentId && task.departmentId === user.departmentId) {
    return true;
  }

  return false;
}

/**
 * Checks if user can create a task in the given department.
 * Prevents unauthorized cross-department task creation.
 */
export function canCreateTask(
  user: AuthenticatedUser,
  departmentId?: string | null
): boolean {
  if (!user) return false;

  if (isAdmin(user)) return true;

  // If assigning to a department, user must belong to that department
  if (departmentId) {
    return Boolean(user.departmentId && user.departmentId === departmentId);
  }

  // Personal tasks (no department) can be created by any authenticated user
  return true;
}

/**
 * Checks if user can update core attributes of the task.
 */
export function canUpdateTask(user: AuthenticatedUser, task: TaskEntity): boolean {
  if (!user || !task) return false;

  if (isAdmin(user)) return true;

  const creatorId = getCreatorId(task);
  const assigneeId = getAssigneeId(task);

  // Creator can update
  if (creatorId && creatorId === user.id) return true;

  // Assignee can update
  if (assigneeId && assigneeId === user.id) return true;

  // Department manager of the task's department can update
  if (
    isManager(user) &&
    user.departmentId &&
    task.departmentId &&
    user.departmentId === task.departmentId
  ) {
    return true;
  }

  return false;
}

/**
 * Checks if user can approve/accept completion of the task.
 * Strictly enforces Segregation of Duties (SoD):
 * - STAFF cannot approve.
 * - Non-admin assignees cannot self-approve.
 * - Department managers can approve tasks in their department (when not the assignee).
 * - ADMIN / BAN_GIAM_HIEU can approve.
 */
export function canApproveTask(user: AuthenticatedUser, task: TaskEntity): boolean {
  if (!user || !task) return false;

  // STAFF is barred from approving tasks
  if (isStaff(user)) return false;

  // ADMIN / BAN_GIAM_HIEU has institutional approval authority
  if (isAdmin(user)) return true;

  const assigneeId = getAssigneeId(task);

  // Self-approval check: Assignee cannot approve their own task unless ADMIN
  if (assigneeId && assigneeId === user.id) {
    return false;
  }

  // Department manager can approve tasks within their own department
  if (
    isManager(user) &&
    user.departmentId &&
    task.departmentId &&
    user.departmentId === task.departmentId
  ) {
    return true;
  }

  return false;
}

/**
 * Checks if user can transition task to a new status.
 */
export function canChangeTaskStatus(
  user: AuthenticatedUser,
  task: TaskEntity,
  nextStatus: string
): boolean {
  if (!user || !task || !nextStatus) return false;

  const statusUpper = nextStatus.trim().toUpperCase();

  // Completion / Approval requires canApproveTask
  if (
    statusUpper === 'COMPLETED' ||
    statusUpper === 'DONE' ||
    statusUpper === 'HOAN_THANH'
  ) {
    return canApproveTask(user, task);
  }

  const creatorId = getCreatorId(task);

  // Cancellation requires Admin, Dept Manager, or Creator
  if (statusUpper === 'CANCELLED' || statusUpper === 'HUY') {
    if (isAdmin(user)) return true;
    if (creatorId && creatorId === user.id) return true;
    if (
      isManager(user) &&
      user.departmentId &&
      task.departmentId &&
      user.departmentId === task.departmentId
    ) {
      return true;
    }
    return false;
  }

  // General operational status changes (IN_PROGRESS, PENDING_REVIEW, etc.)
  if (isAdmin(user)) return true;
  if (creatorId && creatorId === user.id) return true;
  const assigneeId = getAssigneeId(task);
  if (assigneeId && assigneeId === user.id) return true;
  if (isUserCollaborator(user, task)) return true;
  if (
    isManager(user) &&
    user.departmentId &&
    task.departmentId &&
    user.departmentId === task.departmentId
  ) {
    return true;
  }

  return false;
}

/**
 * Checks if user can submit deliverables/evidence for the task.
 * Permitted for assignee, collaborator, department manager, or admin.
 * Denied if task is CANCELLED.
 */
export function canSubmitDeliverable(
  user: AuthenticatedUser,
  task: TaskEntity
): boolean {
  if (!user || !task) return false;

  if (task.status && task.status.trim().toUpperCase() === 'CANCELLED') {
    return false;
  }

  if (isAdmin(user)) return true;
  const assigneeId = getAssigneeId(task);
  if (assigneeId && assigneeId === user.id) return true;
  if (isUserCollaborator(user, task)) return true;

  if (
    isManager(user) &&
    user.departmentId &&
    task.departmentId &&
    user.departmentId === task.departmentId
  ) {
    return true;
  }

  return false;
}

/**
 * Checks if user can delete the task.
 */
export function canDeleteTask(user: AuthenticatedUser, task: TaskEntity): boolean {
  if (!user || !task) return false;

  if (isAdmin(user)) return true;

  const creatorId = getCreatorId(task);
  if (creatorId && creatorId === user.id) return true;

  if (
    isManager(user) &&
    user.departmentId &&
    task.departmentId &&
    user.departmentId === task.departmentId
  ) {
    return true;
  }

  return false;
}

export const taskPolicy = {
  canReadTask,
  canCreateTask,
  canUpdateTask,
  canApproveTask,
  canChangeTaskStatus,
  canSubmitDeliverable,
  canDeleteTask,
};
