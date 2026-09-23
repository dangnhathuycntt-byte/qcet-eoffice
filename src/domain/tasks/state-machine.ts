/**
 * Task State Machine & Permission Contract Engine
 *
 * Strict Architectural Separation:
 * - Pure domain entity: Zero external framework imports (No React, No Next.js, No UI components).
 * - Enforces Segregation of Duties (SoD) / Maker-Checker invariants.
 * - Enforces Role Authority & Scope restrictions across School vs Department.
 * - Enforces Terminal State Protection (COMPLETED / CANCELLED).
 */

import { checkAntiSelfApproval } from './contract';

export type CanonicalTaskStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'WAITING_APPROVAL'
  | 'COMPLETED'
  | 'CANCELLED';

export type TaskStatus =
  | CanonicalTaskStatus
  | 'NEW'
  | 'TODO'
  | 'NEEDS_REVIEW'
  | 'DONE'
  | 'CANCELED';

export interface TransitionResult {
  allowed: boolean;
  reason?: string;
  code?: string;
}

/**
 * Pure Domain Authorization Decision interface (ADR-002)
 * Decouples domain state machine from server capability engine and static role strings.
 */
export interface TaskAuthorizationDecision {
  canApprove?: boolean;
  canReject?: boolean;
  canCancel?: boolean;
  canStart?: boolean;
  canSubmit?: boolean;
}

export interface ActorContext {
  id: string;
  role: string;
  departmentId?: string | null;
  delegatedTaskIds?: string[];
  isDelegated?: boolean;
}

export interface TaskAssigneeInfo {
  userId: string;
  roleInTask?: string;
}

export interface TaskDeliverableInfo {
  uploadedById?: string | null;
}

export interface TaskContext {
  id: string;
  scope?: string;
  creatorId?: string | null;
  createdById?: string | null;
  departmentId?: string | null;
  primaryOwnerId?: string | null;
  driId?: string | null;
  assigneeIds?: string[];
  assignees?: TaskAssigneeInfo[];
  submittedByUserId?: string | null;
  deliverableUploadedByIds?: string[];
  deliverables?: TaskDeliverableInfo[];
}

export type RoleCategory = 'EXECUTIVE' | 'MANAGER' | 'STAFF' | 'OTHER';

const EXECUTIVE_ROLES = new Set([
  'ADMIN',
  'BAN_GIAM_HIEU',
  'BGH',
  'HIEU_TRUONG',
  'PHO_HIEU_TRUONG',
]);

// TEMPORARY COMPAT SHIM — remove after WI-3.3 authority delegation
// Syncs unit leader roles with attention-resolver.ts:UNIT_HEAD_ROLES to prevent
// deans (TRUONG_KHOA) and center directors (GIAM_DOC_TRUNG_TAM) from being misclassified as OTHER.
const MANAGER_ROLES = new Set([
  'MANAGER',
  'TRUONG_PHONG',
  'TRUONG_DON_VI',
  'PHO_TRUONG_PHONG',
  'TRUONG_KHOA',
  'PHO_TRUONG_KHOA',
  'GIAM_DOC_TRUNG_TAM',
  'PHO_GIAM_DOC_TRUNG_TAM',
]);

const STAFF_ROLES = new Set([
  'STAFF',
  'CHUYEN_VIEN',
  'GIANG_VIEN',
]);

export function normalizeTaskStatus(status: TaskStatus | string): CanonicalTaskStatus {
  const s = (status || '').toString().trim().toUpperCase();
  if (s === 'NOT_STARTED' || s === 'TODO' || s === 'NEW') return 'NOT_STARTED';
  if (s === 'IN_PROGRESS' || s === 'DOING' || s === 'BLOCKED') return 'IN_PROGRESS';
  if (s === 'WAITING_APPROVAL' || s === 'NEEDS_REVIEW' || s === 'PENDING_EXECUTIVE_APPROVAL') return 'WAITING_APPROVAL';
  if (s === 'COMPLETED' || s === 'DONE') return 'COMPLETED';
  if (s === 'CANCELLED' || s === 'CANCELED' || s === 'ARCHIVED') return 'CANCELLED';
  return s as CanonicalTaskStatus;
}

export function categorizeRole(role: string): RoleCategory {
  const norm = (role || '').trim().toUpperCase();
  if (EXECUTIVE_ROLES.has(norm)) return 'EXECUTIVE';
  if (MANAGER_ROLES.has(norm)) return 'MANAGER';
  if (STAFF_ROLES.has(norm)) return 'STAFF';
  return 'OTHER';
}

export function normalizeScope(scope?: string): 'SCHOOL' | 'DEPARTMENT' | 'INDIVIDUAL' {
  const s = (scope || '').trim().toUpperCase();
  if (s === 'TRUONG' || s === 'SCHOOL') return 'SCHOOL';
  if (s === 'DON_VI' || s === 'DEPARTMENT' || s === 'UNIT') return 'DEPARTMENT';
  if (s === 'CA_NHAN' || s === 'INDIVIDUAL' || s === 'PERSONAL') return 'INDIVIDUAL';
  return 'SCHOOL'; // Default scope in QCET schema
}

export class TaskStateMachine {
  /**
   * Determine if an actor is a Maker (creator, DRI, assignee, submitter, deliverable uploader) for the task.
   * Delegates to the canonical checkAntiSelfApproval SoD guard.
   */
  public isMaker(actor: ActorContext, task: TaskContext): boolean {
    if (!actor.id) return false;

    const sodResult = checkAntiSelfApproval({
      userId: actor.id,
      creatorId: task.creatorId,
      createdById: task.createdById,
      primaryOwnerId: task.primaryOwnerId,
      driId: task.driId,
      assigneeIds: task.assigneeIds,
      assignees: task.assignees,
      submittedByUserId: task.submittedByUserId,
      deliverableUploadedByIds: task.deliverableUploadedByIds,
      deliverables: task.deliverables,
    });

    return !sodResult.allowed;
  }

  /**
   * Evaluate whether a status transition is permitted given the actor, task, and target state.
   */
  public canTransition(
    actor: ActorContext,
    task: TaskContext,
    fromStatus: TaskStatus | string,
    toStatus: TaskStatus | string,
    authDecision?: TaskAuthorizationDecision
  ): TransitionResult {
    const from = normalizeTaskStatus(fromStatus);
    const to = normalizeTaskStatus(toStatus);

    // No-op transition
    if (from === to) {
      return { allowed: true, reason: 'Trạng thái không đổi.' };
    }

    const roleCategory = categorizeRole(actor.role);
    const isExecutive = roleCategory === 'EXECUTIVE';
    const isManager = roleCategory === 'MANAGER';
    const isStaff = roleCategory === 'STAFF';
    const taskScope = normalizeScope(task.scope);

    const hasDelegation = Boolean(
      actor.isDelegated || (task.id && actor.delegatedTaskIds?.includes(task.id))
    );

    // ------------------------------------------------------------------------
    // 1. Terminal State Protection (COMPLETED / CANCELLED)
    // ------------------------------------------------------------------------
    if (from === 'COMPLETED' || from === 'CANCELLED') {
      // Terminal tasks can only be reopened to IN_PROGRESS
      if (to !== 'IN_PROGRESS') {
        return {
          allowed: false,
          reason: 'Nhiệm vụ đã ở trạng thái kết thúc, chỉ có thể mở lại về trạng thái Đang thực hiện.',
          code: 'TERMINAL_STATE_LOCKED',
        };
      }

      // Only Executive (ADMIN / BAN_GIAM_HIEU) can reopen terminal tasks
      if (!isExecutive) {
        return {
          allowed: false,
          reason: 'Chỉ Ban Giám hiệu hoặc Quản trị viên mới có thẩm quyền mở lại nhiệm vụ đã hoàn thành hoặc hủy.',
          code: 'TERMINAL_STATE_LOCKED',
        };
      }

      return { allowed: true };
    }

    // ------------------------------------------------------------------------
    // 2. Cancellation Transitions (-> CANCELLED)
    // ------------------------------------------------------------------------
    if (to === 'CANCELLED') {
      if (authDecision?.canCancel !== undefined) {
        if (authDecision.canCancel) {
          return { allowed: true };
        }
        return {
          allowed: false,
          reason: 'Chỉ Ban Giám hiệu, Quản trị viên hoặc người tạo nhiệm vụ mới có quyền hủy nhiệm vụ.',
          code: 'UNAUTHORIZED_CANCELLATION',
        };
      }

      const isCreator = task.createdById === actor.id;
      if (!isExecutive && !isCreator && !hasDelegation) {
        return {
          allowed: false,
          reason: 'Chỉ Ban Giám hiệu, Quản trị viên hoặc người tạo nhiệm vụ mới có quyền hủy nhiệm vụ.',
          code: 'UNAUTHORIZED_CANCELLATION',
        };
      }
      return { allowed: true };
    }

    // ------------------------------------------------------------------------
    // 3. State Transition Graph Validation
    // ------------------------------------------------------------------------

    // A. From NOT_STARTED
    if (from === 'NOT_STARTED') {
      if (to === 'COMPLETED') {
        return {
          allowed: false,
          reason: 'Nhiệm vụ mới không thể nhảy trực tiếp sang Hoàn thành mà không qua thực hiện và phê duyệt.',
          code: 'INVALID_TRANSITION',
        };
      }

      if (to === 'WAITING_APPROVAL') {
        return {
          allowed: false,
          reason: 'Nhiệm vụ mới không thể gửi duyệt trực tiếp mà chưa qua thực hiện.',
          code: 'INVALID_TRANSITION',
        };
      }

      if (to === 'IN_PROGRESS') {
        if (authDecision?.canStart !== undefined) {
          if (authDecision.canStart) {
            return { allowed: true };
          }
          return {
            allowed: false,
            reason: 'Bạn không có quyền bắt đầu thực hiện nhiệm vụ này.',
            code: 'UNAUTHORIZED_ACTION',
          };
        }
        // Anyone assigned, manager, or executive can start the task
        return { allowed: true };
      }

      return {
        allowed: false,
        reason: `Chuyển đổi trạng thái không hợp lệ: ${from} -> ${to}.`,
        code: 'INVALID_TRANSITION',
      };
    }

    // B. From IN_PROGRESS
    if (from === 'IN_PROGRESS') {
      if (to === 'COMPLETED') {
        return {
          allowed: false,
          reason: 'Nhiệm vụ đang thực hiện phải được gửi yêu cầu nghiệm thu (WAITING_APPROVAL) trước khi hoàn thành.',
          code: 'INVALID_TRANSITION',
        };
      }

      if (to === 'NOT_STARTED') {
        return {
          allowed: false,
          reason: 'Nhiệm vụ đã thực hiện không thể chuyển ngược về Chưa bắt đầu.',
          code: 'INVALID_TRANSITION',
        };
      }

      if (to === 'WAITING_APPROVAL') {
        if (authDecision?.canSubmit !== undefined) {
          if (authDecision.canSubmit) {
            return { allowed: true };
          }
          return {
            allowed: false,
            reason: 'Bạn không có quyền gửi yêu cầu nghiệm thu nhiệm vụ này.',
            code: 'UNAUTHORIZED_ACTION',
          };
        }
        // Staff, Manager, or Executive can submit deliverable / request review
        return { allowed: true };
      }

      return {
        allowed: false,
        reason: `Chuyển đổi trạng thái không hợp lệ: ${from} -> ${to}.`,
        code: 'INVALID_TRANSITION',
      };
    }

    // C. From WAITING_APPROVAL
    if (from === 'WAITING_APPROVAL') {
      if (to === 'NOT_STARTED') {
        return {
          allowed: false,
          reason: 'Nhiệm vụ đang chờ duyệt không thể chuyển về Chưa bắt đầu.',
          code: 'INVALID_TRANSITION',
        };
      }

      // Rejection / Send back for rework (WAITING_APPROVAL -> IN_PROGRESS)
      if (to === 'IN_PROGRESS') {
        if (authDecision?.canReject !== undefined) {
          if (authDecision.canReject) {
            return { allowed: true };
          }
          return {
            allowed: false,
            reason: 'Không đủ quyền để từ chối hoặc yêu cầu chỉnh sửa nhiệm vụ.',
            code: 'UNAUTHORIZED_APPROVER',
          };
        }

        if (isStaff) {
          return {
            allowed: false,
            reason: 'Chuyên viên hoặc giảng viên không có thẩm quyền từ chối hoặc yêu cầu chỉnh sửa.',
            code: 'UNAUTHORIZED_APPROVER',
          };
        }

        // Manager can reject department tasks
        if (isManager) {
          if (taskScope === 'SCHOOL' && !hasDelegation) {
            return {
              allowed: false,
              reason: 'Trưởng phòng không thể từ chối hoặc can thiệp nhiệm vụ cấp trường.',
              code: 'SCHOOL_SCOPE_REQUIRES_EXECUTIVE',
            };
          }
          if (
            task.departmentId &&
            actor.departmentId &&
            task.departmentId !== actor.departmentId &&
            !hasDelegation
          ) {
            return {
              allowed: false,
              reason: 'Trưởng phòng chỉ có thẩm quyền trên nhiệm vụ của đơn vị mình.',
              code: 'DEPARTMENT_MISMATCH',
            };
          }
          return { allowed: true };
        }

        if (isExecutive || hasDelegation) {
          return { allowed: true };
        }

        return {
          allowed: false,
          reason: 'Không đủ quyền để từ chối hoặc yêu cầu chỉnh sửa nhiệm vụ.',
          code: 'UNAUTHORIZED_APPROVER',
        };
      }

      // Approval (WAITING_APPROVAL -> COMPLETED)
      if (to === 'COMPLETED') {
        // 1. Maker-Checker / Segregation of Duties (SoD) Invariant:
        // A maker (creator, DRI, assignee, submitter, deliverable uploader) MUST NEVER approve the task.
        // Delegation MUST NEVER bypass Maker-Checker SoD.
        // HARD INVARIANT: Maker cannot approve, even if AuthorizationDecision says canApprove: true.
        if (this.isMaker(actor, task)) {
          return {
            allowed: false,
            reason: 'Người tạo, người thực hiện chính (DRI), thành viên thực hiện hoặc người nộp minh chứng không thể tự phê duyệt nghiệm thu nhiệm vụ (Vi phạm Maker-Checker / Segregation of Duties).',
            code: 'MAKER_CANNOT_BE_CHECKER',
          };
        }

        // 2. Pure domain authority via TaskAuthorizationDecision interface (ADR-002)
        if (authDecision?.canApprove !== undefined) {
          if (authDecision.canApprove) {
            return { allowed: true };
          }
          return {
            allowed: false,
            reason: 'Bạn không có thẩm quyền nghiệm thu nhiệm vụ này.',
            code: 'UNAUTHORIZED_APPROVER',
          };
        }

        // 3. Fall back to existing role category checks for backward compatibility
        // Staff cannot approve unless delegated
        if (isStaff && !hasDelegation) {
          return {
            allowed: false,
            reason: 'Chuyên viên / Giảng viên không có thẩm quyền phê duyệt nghiệm thu nhiệm vụ.',
            code: 'UNAUTHORIZED_APPROVER',
          };
        }

        // 3. School Scope Tasks
        if (taskScope === 'SCHOOL') {
          if (!isExecutive && !hasDelegation) {
            return {
              allowed: false,
              reason: 'Chỉ Ban Giám hiệu hoặc Quản trị viên mới có thẩm quyền phê duyệt nhiệm vụ cấp trường.',
              code: 'SCHOOL_SCOPE_REQUIRES_EXECUTIVE',
            };
          }
          return { allowed: true };
        }

        // 4. Department / Unit Scope Tasks
        if (isManager) {
          if (
            task.departmentId &&
            actor.departmentId &&
            task.departmentId !== actor.departmentId &&
            !hasDelegation
          ) {
            return {
              allowed: false,
              reason: 'Trưởng phòng chỉ được phê duyệt nhiệm vụ thuộc đơn vị quản lý của mình.',
              code: 'DEPARTMENT_MISMATCH',
            };
          }
          return { allowed: true };
        }

        if (isExecutive || hasDelegation) {
          return { allowed: true };
        }

        return {
          allowed: false,
          reason: 'Bạn không có thẩm quyền nghiệm thu nhiệm vụ này.',
          code: 'UNAUTHORIZED_APPROVER',
        };
      }

      return {
        allowed: false,
        reason: `Chuyển đổi trạng thái không hợp lệ: ${from} -> ${to}.`,
        code: 'INVALID_TRANSITION',
      };
    }

    return {
      allowed: false,
      reason: `Trạng thái không được nhận diện: ${from}.`,
      code: 'INVALID_STATUS',
    };
  }

  /**
   * Returns validation results for all canonical target statuses.
   */
  public getAllowedTransitions(
    actor: ActorContext,
    task: TaskContext,
    fromStatus: TaskStatus | string,
    authDecision?: TaskAuthorizationDecision
  ): Array<{ status: CanonicalTaskStatus; allowed: boolean; reason?: string; code?: string }> {
    const canonicalTargets: CanonicalTaskStatus[] = [
      'NOT_STARTED',
      'IN_PROGRESS',
      'WAITING_APPROVAL',
      'COMPLETED',
      'CANCELLED',
    ];

    return canonicalTargets.map((to) => {
      const result = this.canTransition(actor, task, fromStatus, to, authDecision);
      return {
        status: to,
        allowed: result.allowed,
        reason: result.reason,
        code: result.code,
      };
    });
  }
}

export const taskStateMachine = new TaskStateMachine();

/**
 * Standard status labels in administrative Vietnamese
 */
export function getStatusLabel(status: TaskStatus | string): string {
  const norm = normalizeTaskStatus(status);
  switch (norm) {
    case 'NOT_STARTED':
      return 'Mới';
    case 'IN_PROGRESS':
      return 'Đang thực hiện';
    case 'WAITING_APPROVAL':
      return 'Chờ duyệt';
    case 'COMPLETED':
      return 'Hoàn thành';
    case 'CANCELLED':
      return 'Đã hủy';
    default:
      return String(status);
  }
}

/**
 * Construct ActorContext safely from partial user object or session
 */
export function buildActorContext(user?: {
  id?: string;
  role?: string;
  departmentId?: string | null;
  department?: string | null;
  isDelegated?: boolean;
  delegatedTaskIds?: string[];
} | null): ActorContext {
  if (!user || !user.id) {
    return {
      id: '',
      role: 'STAFF',
      departmentId: null,
      isDelegated: false,
      delegatedTaskIds: [],
    };
  }
  return {
    id: user.id,
    role: user.role || 'STAFF',
    departmentId: user.departmentId || user.department || null,
    isDelegated: Boolean(user.isDelegated),
    delegatedTaskIds: user.delegatedTaskIds || [],
  };
}

/**
 * Construct TaskContext safely from any Task DTO or Entity
 */
export function buildTaskContext(task: any): TaskContext {
  if (!task) {
    return { id: '' };
  }

  const assigneeIds: string[] = [];
  const assignees: TaskAssigneeInfo[] = [];

  const addAssignee = (userId: unknown, roleInTask?: unknown) => {
    if (typeof userId !== 'string' || !userId || roleInTask === 'REVIEWER') return;
    if (!assigneeIds.includes(userId)) assigneeIds.push(userId);
    if (!assignees.some((a) => a.userId === userId)) {
      assignees.push({ userId, roleInTask: typeof roleInTask === 'string' ? roleInTask : undefined });
    }
  };

  if (Array.isArray(task.actors)) {
    for (const actor of task.actors) {
      addAssignee(actor.userId || actor.user?.id, actor.role);
    }
  }

  if (Array.isArray(task.assignees)) {
    for (const a of task.assignees) {
      addAssignee(
        typeof a === 'string' ? a : (a.userId || a.id || a.user?.id),
        typeof a === 'object' ? (a.roleInTask || a.role) : undefined,
      );
    }
  }

  if (Array.isArray(task.assigneeIds)) {
    for (const id of task.assigneeIds) addAssignee(id);
  }

  const taskResults = Array.isArray(task.taskResults) ? task.taskResults : [];
  const deliverableUploadedByIds: string[] = [];
  if (Array.isArray(task.deliverables)) {
    for (const d of task.deliverables) {
      const uId = d.uploadedById || d.uploadedBy?.id || d.uploadedByUserId;
      if (uId && !deliverableUploadedByIds.includes(uId)) {
        deliverableUploadedByIds.push(uId);
      }
    }
  }

  if (Array.isArray(task.deliverableUploadedByIds)) {
    for (const id of task.deliverableUploadedByIds) {
      if (typeof id === 'string' && !deliverableUploadedByIds.includes(id)) {
        deliverableUploadedByIds.push(id);
      }
    }
  }

  return {
    id: task.id || '',
    scope: task.scope,
    creatorId: task.creatorId || task.createdById || null,
    createdById: task.createdById || task.creatorId || null,
    departmentId: task.leadUnitId || task.departmentId || task.department?.id || null,
    primaryOwnerId:
      task.primaryOwnerId ||
      task.driId ||
      task.leadUserId ||
      task.actors?.find((a: any) => a.role === 'DRI' && a.isPrimaryDRI)?.userId ||
      task.leadAssignee?.id ||
      task.leadAssignee?.userId ||
      null,
    driId:
      task.driId ||
      task.leadUserId ||
      task.actors?.find((a: any) => a.role === 'DRI' && a.isPrimaryDRI)?.userId ||
      null,
    assigneeIds,
    assignees,
    submittedByUserId: task.submittedByUserId || taskResults[0]?.submittedByUserId || null,
    deliverableUploadedByIds,
    deliverables: task.deliverables,
  };
}
