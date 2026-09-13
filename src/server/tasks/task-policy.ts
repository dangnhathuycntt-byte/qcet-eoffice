/**
 * LEGACY TASK POLICY (Transitional / Sprint 2 Bridge)
 *
 * ARCHITECTURAL NOTICE:
 * This file contains legacy task validation helpers.
 * In accordance with Phase 0 Domain Freeze & Sprint 2 Architecture:
 * - `isPrivilegedUser` checks legacy ADMIN role string, but does NOT grant statutory
 *   institutional governance authority (HIEU_TRUONG / PHO_HIEU_TRUONG).
 * - Canonical business authorization is evaluated by `src/server/authorization/authorization-engine.ts`.
 * - Do not import role equivalence into new business logic.
 */

import { TaskScope, TaskStatus } from '@prisma/client';
import { type AuthenticatedUser, normalizeRole } from '@/server/api/request-context';

export function isPrivilegedUser(user: { role: string }): boolean {
  const norm = normalizeRole(user.role);
  return norm === 'ADMIN';
}

export function isDepartmentLeader(
  user: { role: string; departmentId?: string | null },
  departmentId?: string | null
): boolean {
  if (!departmentId || !user.departmentId) return false;
  const norm = normalizeRole(user.role);
  return norm === 'MANAGER' && user.departmentId === departmentId;
}

export async function checkActiveDelegation(
  tx: any,
  userId: string,
  taskId?: string | null,
  departmentId?: string | null
): Promise<boolean> {
  const now = new Date();

  // Canonical V2 DelegationGrant check
  if (tx.delegationGrant) {
    const grant = await tx.delegationGrant.findFirst({
      where: {
        granteeAssignment: {
          userId,
          status: 'ACTIVE',
        },
        status: 'ACTIVE',
        validFrom: { lte: now },
        validUntil: { gte: now },
      },
      select: { id: true },
    });
    if (grant) return true;
  }

  // Fallback to legacy DacumDelegation
  if (tx.dacumDelegation) {
    const delegation = await tx.dacumDelegation.findFirst({
      where: {
        delegateId: userId,
        isActive: true,
        expiresAt: { gte: now },
        OR: [
          { startDate: null },
          { startDate: { lte: now } },
        ],
        AND: [
          {
            OR: [
              ...(taskId ? [{ taskId }] : []),
              ...(departmentId ? [{ departmentId }] : []),
              { departmentId: null },
            ],
          },
        ],
      },
      select: { id: true },
    });
    return Boolean(delegation);
  }

  return false;
}

export function canUserCreateTask(
  user: AuthenticatedUser,
  input: {
    scope?: string | TaskScope;
    departmentId?: string | null;
    /**
     * False when the scope was INHERITED from a parent task rather than chosen
     * by the caller. A subtask inherits its parent's scope, so the scope-authority
     * gates below must not re-adjudicate it — otherwise a staff member could not
     * add a subtask to a unit task they legitimately work on. Defaults to true
     * (treat as explicitly chosen), so a caller that omits this cannot widen
     * its own authority by accident.
     */
    scopeExplicit?: boolean;
  }
): { allowed: boolean; reason?: string } {
  const isPrivileged = isPrivilegedUser(user);
  const scopeStr = (input.scope || 'SCHOOL').toString().toUpperCase();
  const scopeExplicit = input.scopeExplicit !== false;

  // Nhiệm vụ cấp trường (TaskScope.SCHOOL): Chỉ Ban Giám hiệu hoặc Quản trị viên mới được tạo
  if (scopeStr === 'SCHOOL' && !isPrivileged) {
    return {
      allowed: false,
      reason: 'Chỉ Ban Giám hiệu hoặc Quản trị viên mới có quyền tạo nhiệm vụ cấp trường.',
    };
  }

  // Nhiệm vụ cấp đơn vị (TaskScope.DEPARTMENT): requires authority over that
  // unit — its leader, or a privileged actor.
  //
  // P0-06 product policy: an actor without institutional authority creates
  // PERSONAL tasks only. This gate aligns the submit-level rule with the UI's
  // documented intent (create-task-modal.tsx resolveCreateTaskPolicy, PERSONAL
  // mode); previously DEPARTMENT scope was ungated here, so a staff account
  // could create a unit task by calling the API directly even though the form
  // never offers it.
  if (
    scopeStr === 'DEPARTMENT' &&
    scopeExplicit &&
    !isPrivileged &&
    !isDepartmentLeader(user, input.departmentId)
  ) {
    return {
      allowed: false,
      reason:
        'Chỉ Trưởng đơn vị hoặc Ban Giám hiệu mới có quyền tạo nhiệm vụ cấp đơn vị. Bạn chỉ có thể tạo nhiệm vụ cá nhân.',
    };
  }

  return { allowed: true };
}

export function canUserUpdateTask(
  user: AuthenticatedUser,
  task: {
    createdById: string;
    departmentId?: string | null;
    assignees?: Array<{ userId: string }>;
  }
): { allowed: boolean; reason?: string } {
  const isPrivileged = isPrivilegedUser(user);
  const isCreator = task.createdById === user.id;
  const isAssignee = Boolean(task.assignees?.some((a) => a.userId === user.id));
  const isDeptLeader = isDepartmentLeader(user, task.departmentId);

  if (!isPrivileged && !isCreator && !isAssignee && !isDeptLeader) {
    return {
      allowed: false,
      reason: 'Bạn không có quyền chỉnh sửa nhiệm vụ này',
    };
  }

  return { allowed: true };
}

export function canUserApproveTask(
  user: AuthenticatedUser,
  task: {
    scope: TaskScope | string;
    createdById: string;
    departmentId?: string | null;
    assignees?: Array<{ userId: string }>;
  },
  options?: {
    activeDelegation?: boolean;
    newAssigneeId?: string | null;
  }
): { allowed: boolean; reason?: string } {
  const isPrivileged = isPrivilegedUser(user);
  const activeDelegation = Boolean(options?.activeDelegation);
  const isAssignee = Boolean(
    task.assignees?.some((a) => a.userId === user.id) ||
    (options?.newAssigneeId !== undefined && options.newAssigneeId === user.id)
  );

  // 1. Chống tự duyệt (Segregation of Duties): Người thực hiện không được tự hoàn thành nhiệm vụ trừ khi có ủy quyền hợp lệ hoặc quyền quản trị
  if (isAssignee && !isPrivileged && !activeDelegation) {
    return {
      allowed: false,
      reason: 'Theo quy định phân lập nhiệm vụ (Segregation of Duties), người thực hiện không được tự nghiệm thu hoàn thành nhiệm vụ của chính mình.',
    };
  }

  // 2. Nhiệm vụ cấp Trường (TaskScope.SCHOOL): Chỉ Ban Giám hiệu hoặc Quản trị viên (hoặc người được ủy quyền) mới có quyền nghiệm thu
  const scopeUpper = (task.scope || '').toString().toUpperCase();
  if (scopeUpper === 'SCHOOL') {
    if (!isPrivileged && !activeDelegation) {
      return {
        allowed: false,
        reason: 'Chỉ Ban Giám hiệu hoặc Quản trị viên mới có quyền nghiệm thu nhiệm vụ cấp trường.',
      };
    }
  } else {
    // 3. Nhiệm vụ cấp Đơn vị hoặc Cá nhân: Ban Giám hiệu, Quản trị viên, Trưởng đơn vị quản lý, người được ủy quyền hoặc người tạo (không phải người thực hiện)
    const isDeptLeader = isDepartmentLeader(user, task.departmentId);
    const isCreator = task.createdById === user.id;
    const canApprove =
      isPrivileged ||
      isDeptLeader ||
      activeDelegation ||
      (isCreator && !isAssignee);

    if (!canApprove) {
      return {
        allowed: false,
        reason: 'Chỉ Ban Giám hiệu, Quản trị viên, Trưởng đơn vị hoặc người được ủy quyền mới có quyền nghiệm thu hoàn thành nhiệm vụ.',
      };
    }
  }

  return { allowed: true };
}

export function canUserDeleteTask(
  user: AuthenticatedUser,
  task: { createdById: string }
): { allowed: boolean; reason?: string } {
  const isPrivileged = isPrivilegedUser(user);
  const isCreator = task.createdById === user.id;

  if (!isPrivileged && !isCreator) {
    return {
      allowed: false,
      reason: 'Bạn không có quyền xóa nhiệm vụ này',
    };
  }

  return { allowed: true };
}

export function canUserSubmitDeliverable(
  user: AuthenticatedUser,
  task: {
    createdById: string;
    departmentId?: string | null;
    status: TaskStatus | string;
    assignees?: Array<{ userId: string }>;
  }
): { allowed: boolean; reason?: string } {
  if (task.status === TaskStatus.CANCELLED) {
    return {
      allowed: false,
      reason: 'Không thể nộp minh chứng cho nhiệm vụ đã bị hủy.',
    };
  }

  const isPrivileged = isPrivilegedUser(user);
  const isCreator = task.createdById === user.id;
  const isAssignee = Boolean(task.assignees?.some((a) => a.userId === user.id));
  const isDeptMember = Boolean(user.departmentId && task.departmentId === user.departmentId);

  if (!isPrivileged && !isCreator && !isAssignee && !isDeptMember) {
    return {
      allowed: false,
      reason: 'Bạn không có quyền nộp minh chứng cho nhiệm vụ này',
    };
  }

  return { allowed: true };
}

export function canUserReviewDeliverable(
  user: AuthenticatedUser,
  deliverable: { uploadedById: string },
  task: {
    createdById: string;
    departmentId?: string | null;
  },
  options?: { activeDelegation?: boolean }
): { allowed: boolean; reason?: string } {
  // 1. Separation of Duties (SoD): Submitter cannot approve their own deliverable
  if (deliverable.uploadedById === user.id) {
    return {
      allowed: false,
      reason: 'Người nộp minh chứng không thể tự duyệt minh chứng của chính mình (Vi phạm Separation of Duties)',
    };
  }

  // 2. Reviewer must have authority (BAN_GIAM_HIEU, ADMIN, or TRUONG_PHONG of the task department, or task creator, or active delegation)
  const isPrivileged = isPrivilegedUser(user);
  const isDeptLeader = isDepartmentLeader(user, task.departmentId);
  const isTaskCreator = task.createdById === user.id;
  const activeDelegation = Boolean(options?.activeDelegation);

  if (!isPrivileged && !isDeptLeader && !isTaskCreator && !activeDelegation) {
    return {
      allowed: false,
      reason: 'Bạn không có thẩm quyền nghiệm thu minh chứng này',
    };
  }

  return { allowed: true };
}

export function canUserTransitionStatus(
  user: AuthenticatedUser,
  task: {
    scope: TaskScope | string;
    status: TaskStatus | string;
    createdById: string;
    departmentId?: string | null;
    assignees?: Array<{ userId: string }>;
  },
  toStatus: TaskStatus,
  options?: {
    activeDelegation?: boolean;
    newAssigneeId?: string | null;
  }
): { allowed: boolean; reason?: string } {
  if (toStatus === TaskStatus.COMPLETED) {
    return canUserApproveTask(user, task, options);
  }

  if (toStatus === TaskStatus.CANCELLED) {
    const isPrivileged = isPrivilegedUser(user);
    const isCreator = task.createdById === user.id;
    if (!isPrivileged && !isCreator) {
      return {
        allowed: false,
        reason: 'Chỉ người tạo hoặc Quản trị viên mới có quyền hủy nhiệm vụ.',
      };
    }
  }

  return { allowed: true };
}

export const taskPolicy = {
  isPrivilegedUser,
  isDepartmentLeader,
  checkActiveDelegation,
  canUserCreateTask,
  canUserUpdateTask,
  canUserApproveTask,
  canUserDeleteTask,
  canUserSubmitDeliverable,
  canUserReviewDeliverable,
  canUserTransitionStatus,
};

