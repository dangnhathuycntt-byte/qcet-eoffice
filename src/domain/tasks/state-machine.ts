/**
 * Task State Machine & Permission Contract Engine
 *
 * Strict Architectural Separation:
 * - Pure domain entity: Zero external framework imports (No React, No Next.js, No UI components).
 * - Enforces Segregation of Duties (SoD) / Maker-Checker invariants.
 * - Enforces Role Authority & Scope restrictions across School vs Department.
 * - Enforces Terminal State Protection (COMPLETED / CANCELLED).
 */

export type CanonicalTaskStatus =
  | 'NEW'
  | 'IN_PROGRESS'
  | 'WAITING_APPROVAL'
  | 'COMPLETED'
  | 'CANCELLED';

export type TaskStatus =
  | CanonicalTaskStatus
  | 'NOT_STARTED'
  | 'TODO'
  | 'NEEDS_REVIEW'
  | 'DONE'
  | 'CANCELED';

export interface TransitionResult {
  allowed: boolean;
  reason?: string;
  code?: string;
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
  createdById?: string;
  departmentId?: string | null;
  primaryOwnerId?: string | null;
  driId?: string | null;
  assigneeIds?: string[];
  assignees?: TaskAssigneeInfo[];
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

const MANAGER_ROLES = new Set([
  'MANAGER',
  'TRUONG_PHONG',
  'TRUONG_DON_VI',
  'PHO_TRUONG_PHONG',
]);

const STAFF_ROLES = new Set([
  'STAFF',
  'CHUYEN_VIEN',
  'GIANG_VIEN',
]);

export function normalizeTaskStatus(status: TaskStatus | string): CanonicalTaskStatus {
  const s = (status || '').toString().trim().toUpperCase();
  if (s === 'NOT_STARTED' || s === 'TODO' || s === 'NEW') return 'NEW';
  if (s === 'IN_PROGRESS') return 'IN_PROGRESS';
  if (s === 'WAITING_APPROVAL' || s === 'NEEDS_REVIEW') return 'WAITING_APPROVAL';
  if (s === 'COMPLETED' || s === 'DONE') return 'COMPLETED';
  if (s === 'CANCELLED' || s === 'CANCELED') return 'CANCELLED';
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
   * Determine if an actor is a Maker (DRI or deliverable submitter) for the task.
   */
  public isMaker(actor: ActorContext, task: TaskContext): boolean {
    if (!actor.id) return false;

    // 1. Explicit DRI ID
    if (task.driId && task.driId === actor.id) return true;

    // 2. Explicit Primary Owner ID
    if (task.primaryOwnerId && task.primaryOwnerId === actor.id) return true;

    // 3. Primary Owner in assignees array
    if (
      task.assignees?.some(
        (a) => a.userId === actor.id && a.roleInTask?.toUpperCase() === 'PRIMARY_OWNER'
      )
    ) {
      return true;
    }

    // 4. Sole assignee in assigneeIds
    if (task.assigneeIds && task.assigneeIds.length === 1 && task.assigneeIds[0] === actor.id) {
      return true;
    }

    // 5. Sole assignee in assignees objects
    if (task.assignees && task.assignees.length === 1 && task.assignees[0].userId === actor.id) {
      return true;
    }

    // 6. Deliverable creator in uploaded IDs list
    if (task.deliverableUploadedByIds?.includes(actor.id)) {
      return true;
    }

    // 7. Deliverable creator in deliverables objects
    if (task.deliverables?.some((d) => d.uploadedById === actor.id)) {
      return true;
    }

    return false;
  }

  /**
   * Evaluate whether a status transition is permitted given the actor, task, and target state.
   */
  public canTransition(
    actor: ActorContext,
    task: TaskContext,
    fromStatus: TaskStatus | string,
    toStatus: TaskStatus | string
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

    // A. From NEW
    if (from === 'NEW') {
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
          reason: 'Nhiệm vụ cần bắt đầu thực hiện trước khi gửi yêu cầu phê duyệt.',
          code: 'INVALID_TRANSITION',
        };
      }

      if (to === 'IN_PROGRESS') {
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

      if (to === 'NEW') {
        return {
          allowed: false,
          reason: 'Nhiệm vụ đã thực hiện không thể chuyển ngược về Chưa bắt đầu.',
          code: 'INVALID_TRANSITION',
        };
      }

      if (to === 'WAITING_APPROVAL') {
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
      if (to === 'NEW') {
        return {
          allowed: false,
          reason: 'Nhiệm vụ đang chờ duyệt không thể chuyển về Chưa bắt đầu.',
          code: 'INVALID_TRANSITION',
        };
      }

      // Rejection / Send back for rework (WAITING_APPROVAL -> IN_PROGRESS)
      if (to === 'IN_PROGRESS') {
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
        // The person who created the deliverable or is the sole DRI cannot approve the task.
        if (this.isMaker(actor, task)) {
          return {
            allowed: false,
            reason: 'Người thực hiện chính (DRI) hoặc người tạo minh chứng không thể tự phê duyệt nghiệm thu nhiệm vụ (Vi phạm Maker-Checker / Segregation of Duties).',
            code: 'MAKER_CANNOT_BE_CHECKER',
          };
        }

        // 2. Staff cannot approve
        if (isStaff) {
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
}

export const taskStateMachine = new TaskStateMachine();
