/**
 * CANONICAL BUSINESS CONTRACT & CAPABILITY MATRIX FOR TASKS
 *
 * Architecture & Governance Reference:
 * - Law on Vocational Education (Luật Giáo dục nghề nghiệp)
 * - College Charter & Organization Regulation (QĐ 283/QĐ-CĐKTCNQN)
 * - Executive Work Assignment Regulation (QĐ 420/QĐ-CĐKTCNQN)
 * - Separation of Duties (SoD) & Maker-Checker Invariants
 *
 * Invariants:
 * 1. Role Is Not Scope: Visual filtering must never grant operational authority.
 * 2. Separation of Duties: Makers (creators, assignees, submitters) CANNOT approve.
 * 3. Terminal State Protection: Completed and Cancelled tasks are immutable.
 * 4. 8 Canonical Capabilities: CAN_VIEW, CAN_EDIT, CAN_SUBMIT, CAN_APPROVE,
 *    CAN_REJECT, CAN_DELEGATE, CAN_DELETE, CAN_DOWNLOAD.
 */

// ============================================================================
// 1. CANONICAL CAPABILITY MATRIX CONSTANTS & TYPES
// ============================================================================

export const TaskCapability = {
  CAN_VIEW: 'CAN_VIEW',
  CAN_EDIT: 'CAN_EDIT',
  CAN_SUBMIT: 'CAN_SUBMIT',
  CAN_APPROVE: 'CAN_APPROVE',
  CAN_REJECT: 'CAN_REJECT',
  CAN_DELEGATE: 'CAN_DELEGATE',
  CAN_DELETE: 'CAN_DELETE',
  CAN_DOWNLOAD: 'CAN_DOWNLOAD',
} as const;

export type TaskCapabilityType = (typeof TaskCapability)[keyof typeof TaskCapability];

export const {
  CAN_VIEW,
  CAN_EDIT,
  CAN_SUBMIT,
  CAN_APPROVE,
  CAN_REJECT,
  CAN_DELEGATE,
  CAN_DELETE,
  CAN_DOWNLOAD,
} = TaskCapability;

export const ALL_TASK_CAPABILITIES: readonly TaskCapabilityType[] = [
  CAN_VIEW,
  CAN_EDIT,
  CAN_SUBMIT,
  CAN_APPROVE,
  CAN_REJECT,
  CAN_DELEGATE,
  CAN_DELETE,
  CAN_DOWNLOAD,
] as const;

export type TaskCapabilityMatrix = Record<TaskCapabilityType, boolean>;

export interface TaskCapabilityEvaluationResult {
  matrix: TaskCapabilityMatrix;
  reasons: Partial<Record<TaskCapabilityType, string>>;
}

// ============================================================================
// 2. SEPARATION OF DUTIES (SoD) ANTI-SELF-APPROVAL RULE
// ============================================================================

export interface SoDEvaluationContext {
  userId: string;
  creatorId?: string | null;
  createdById?: string | null;
  primaryOwnerId?: string | null;
  driId?: string | null;
  assigneeIds?: string[];
  assignees?: Array<{ userId: string; roleInTask?: string }>;
  submittedByUserId?: string | null;
  deliverables?: Array<{ uploadedById?: string | null }>;
  deliverableUploadedByIds?: string[];
}

export interface SoDCheckResult {
  allowed: boolean;
  violationCode?: string;
  reason?: string;
}

/**
 * Strictly verifies the Separation of Duties (SoD) anti-self-approval rule.
 *
 * Invariant:
 * An actor who created, was assigned to execute (as primary owner DRI or collaborator),
 * or uploaded/submitted deliverables for a task MUST NEVER be allowed to approve or reject that task.
 */
export function checkAntiSelfApproval(context: SoDEvaluationContext): SoDCheckResult {
  const {
    userId,
    creatorId,
    createdById,
    primaryOwnerId,
    driId,
    assigneeIds,
    assignees,
    submittedByUserId,
    deliverables,
    deliverableUploadedByIds,
  } = context;

  if (!userId) {
    return {
      allowed: false,
      violationCode: 'ANONYMOUS_ACTOR',
      reason: 'Người thao tác không hợp lệ hoặc chưa xác thực danh tính.',
    };
  }

  // 1. Creator anti-self-approval guard
  const isCreator =
    (creatorId && creatorId === userId) || (createdById && createdById === userId);
  if (isCreator) {
    return {
      allowed: false,
      violationCode: 'SOD_CREATOR_CANNOT_APPROVE',
      reason:
        'Vi phạm nguyên tắc phân lập trách nhiệm (SoD): Người khởi tạo nhiệm vụ không được tự phê duyệt.',
    };
  }

  // 2. Primary Owner (DRI) anti-self-approval guard
  const isDRI =
    (primaryOwnerId && primaryOwnerId === userId) || (driId && driId === userId);
  if (isDRI) {
    return {
      allowed: false,
      violationCode: 'SOD_DRI_CANNOT_APPROVE',
      reason:
        'Vi phạm nguyên tắc phân lập trách nhiệm (SoD): Người trực tiếp chịu trách nhiệm chính (DRI) không được tự phê duyệt nhiệm vụ của mình.',
    };
  }

  // 3. Executor / Assignee anti-self-approval guard
  const isAssignee =
    (assigneeIds && assigneeIds.includes(userId)) ||
    (assignees && assignees.some((a) => a.userId === userId));
  if (isAssignee) {
    return {
      allowed: false,
      violationCode: 'SOD_ASSIGNEE_CANNOT_APPROVE',
      reason:
        'Vi phạm nguyên tắc phân lập trách nhiệm (SoD): Cán bộ được phân công thực hiện nhiệm vụ không được tự phê duyệt.',
    };
  }

  // 4. Submitter / Deliverable uploader anti-self-approval guard
  const isSubmitter =
    (submittedByUserId && submittedByUserId === userId) ||
    (deliverableUploadedByIds && deliverableUploadedByIds.includes(userId)) ||
    (deliverables && deliverables.some((d) => d.uploadedById === userId));
  if (isSubmitter) {
    return {
      allowed: false,
      violationCode: 'SOD_SUBMITTER_CANNOT_APPROVE',
      reason:
        'Vi phạm nguyên tắc phân lập trách nhiệm (SoD): Cán bộ nộp báo cáo hoặc tài liệu kết quả không được tự phê duyệt.',
    };
  }

  return {
    allowed: true,
  };
}

/**
 * Asserts anti-self-approval, throwing an Error if the invariant is violated.
 */
export function assertAntiSelfApproval(context: SoDEvaluationContext): void {
  const result = checkAntiSelfApproval(context);
  if (!result.allowed) {
    const error = new Error(
      result.reason || 'Vi phạm nguyên tắc phân lập trách nhiệm (SoD)'
    );
    (error as any).code = result.violationCode || 'SOD_VIOLATION';
    throw error;
  }
}

// ============================================================================
// 3. TASK CAPABILITY MATRIX EVALUATION
// ============================================================================

export interface TaskActorContract {
  id: string;
  role?: string;
  departmentId?: string | null;
  positions?: Array<{ positionCode: string; unitId?: string | null }>;
  isExecutive?: boolean;
  isAdmin?: boolean;
  isUnitHead?: boolean;
}

export interface TaskEntityContract {
  id: string;
  status: string;
  scope?: string;
  createdById?: string | null;
  creatorId?: string | null;
  primaryOwnerId?: string | null;
  driId?: string | null;
  departmentId?: string | null;
  assigneeIds?: string[];
  assignees?: Array<{ userId: string; roleInTask?: string }>;
  submittedByUserId?: string | null;
  deliverables?: Array<{ id?: string; uploadedById?: string | null; fileUrl?: string | null }>;
  deliverableUploadedByIds?: string[];
}

export interface DelegationContract {
  action: string;
  granteeUserId: string;
  validFrom: Date | string;
  validUntil: Date | string;
  status: string;
  resourceScope?: string;
  revokedAt?: Date | string | null;
}

const EXECUTIVE_ROLE_NAMES = new Set([
  'ADMIN',
  'BAN_GIAM_HIEU',
  'BGH',
  'HIEU_TRUONG',
  'PHO_HIEU_TRUONG',
]);

const UNIT_HEAD_ROLE_NAMES = new Set([
  'MANAGER',
  'TRUONG_PHONG',
  'TRUONG_DON_VI',
  'TRUONG_KHOA',
  'GIAM_DOC_TRUNG_TAM',
]);

function isActorExecutive(actor: TaskActorContract): boolean {
  if (actor.isAdmin || actor.isExecutive) return true;
  const r = (actor.role || '').toUpperCase();
  if (EXECUTIVE_ROLE_NAMES.has(r)) return true;
  return (
    actor.positions?.some((p) => {
      const c = p.positionCode.toUpperCase();
      return (
        c === 'HIEU_TRUONG' ||
        c === 'PHO_HIEU_TRUONG' ||
        c === 'BGH' ||
        c === 'BAN_GIAM_HIEU'
      );
    }) ?? false
  );
}

function isActorUnitHead(actor: TaskActorContract, unitId?: string | null): boolean {
  if (actor.isUnitHead) return true;
  const r = (actor.role || '').toUpperCase();
  if (UNIT_HEAD_ROLE_NAMES.has(r)) {
    if (!unitId || !actor.departmentId) return true;
    return actor.departmentId === unitId;
  }
  return (
    actor.positions?.some((p) => {
      const c = p.positionCode.toUpperCase();
      const isLeaderCode =
        c === 'TRUONG_PHONG' ||
        c === 'TRUONG_KHOA' ||
        c === 'TRUONG_DON_VI' ||
        c === 'GIAM_DOC_TRUNG_TAM';
      if (!isLeaderCode) return false;
      if (!unitId || !p.unitId) return true;
      return p.unitId === unitId;
    }) ?? false
  );
}

/**
 * Evaluates the full 8-point canonical capability matrix for an actor on a task.
 */
export function evaluateTaskCapabilityMatrix(
  actor: TaskActorContract,
  task: TaskEntityContract,
  delegations: DelegationContract[] = []
): TaskCapabilityEvaluationResult {
  const normStatus = (task.status || '').toUpperCase();
  const isTerminalState = normStatus === 'COMPLETED' || normStatus === 'CANCELLED';

  const isCreator =
    (task.creatorId && task.creatorId === actor.id) ||
    (task.createdById && task.createdById === actor.id);

  const isPrimaryDRI =
    (task.primaryOwnerId && task.primaryOwnerId === actor.id) ||
    (task.driId && task.driId === actor.id);

  const isAssignee =
    isPrimaryDRI ||
    (task.assigneeIds && task.assigneeIds.includes(actor.id)) ||
    (task.assignees && task.assignees.some((a) => a.userId === actor.id));

  const executive = isActorExecutive(actor);
  const unitHead = isActorUnitHead(actor, task.departmentId);
  const sameDepartment =
    Boolean(actor.departmentId) &&
    Boolean(task.departmentId) &&
    actor.departmentId === task.departmentId;

  // Active delegations check
  const now = Date.now();
  const hasValidDelegation = (actionName: string) => {
    return delegations.some((d) => {
      if (d.granteeUserId !== actor.id) return false;
      if (d.status !== 'ACTIVE' || d.revokedAt) return false;
      const vf = new Date(d.validFrom).getTime();
      const vu = new Date(d.validUntil).getTime();
      if (now < vf || now > vu) return false;
      return d.action === actionName || d.action === '*' || d.action === 'FULL_DEPARTMENT_APPROVAL';
    });
  };

  const matrix: TaskCapabilityMatrix = {
    CAN_VIEW: false,
    CAN_EDIT: false,
    CAN_SUBMIT: false,
    CAN_APPROVE: false,
    CAN_REJECT: false,
    CAN_DELEGATE: false,
    CAN_DELETE: false,
    CAN_DOWNLOAD: false,
  };

  const reasons: Partial<Record<TaskCapabilityType, string>> = {};

  // --------------------------------------------------------------------------
  // 1. CAN_VIEW
  // --------------------------------------------------------------------------
  if (executive || isCreator || isAssignee || unitHead || sameDepartment || hasValidDelegation('task.read') || hasValidDelegation('task.view')) {
    matrix.CAN_VIEW = true;
  } else {
    reasons.CAN_VIEW = 'Không thuộc phạm vi theo dõi nhiệm vụ.';
  }

  // --------------------------------------------------------------------------
  // 2. CAN_EDIT
  // --------------------------------------------------------------------------
  if (isTerminalState) {
    matrix.CAN_EDIT = false;
    reasons.CAN_EDIT = 'Nhiệm vụ đã kết thúc (COMPLETED hoặc CANCELLED), dữ liệu được đóng băng.';
  } else if (executive || unitHead || isCreator) {
    matrix.CAN_EDIT = true;
  } else if (isPrimaryDRI && (normStatus === 'NOT_STARTED' || normStatus === 'NEW' || normStatus === 'IN_PROGRESS')) {
    matrix.CAN_EDIT = true;
  } else {
    matrix.CAN_EDIT = false;
    reasons.CAN_EDIT = 'Chỉ Ban Giám hiệu, Trưởng đơn vị, người tạo hoặc người chịu trách nhiệm chính mới có quyền chỉnh sửa.';
  }

  // --------------------------------------------------------------------------
  // 3. CAN_SUBMIT
  // --------------------------------------------------------------------------
  if (isTerminalState) {
    matrix.CAN_SUBMIT = false;
    reasons.CAN_SUBMIT = 'Nhiệm vụ đã kết thúc, không thể nộp kết quả.';
  } else if (normStatus !== 'IN_PROGRESS' && normStatus !== 'WAITING_APPROVAL' && normStatus !== 'NEEDS_REVIEW') {
    matrix.CAN_SUBMIT = false;
    reasons.CAN_SUBMIT = 'Nhiệm vụ phải ở trạng thái đang thực hiện (IN_PROGRESS) để nộp kết quả.';
  } else if (isAssignee || isPrimaryDRI) {
    matrix.CAN_SUBMIT = true;
  } else {
    matrix.CAN_SUBMIT = false;
    reasons.CAN_SUBMIT = 'Chỉ người chịu trách nhiệm chính hoặc thành viên thực hiện mới có quyền nộp kết quả.';
  }

  // --------------------------------------------------------------------------
  // 4 & 5. CAN_APPROVE & CAN_REJECT (Enforcing SoD Anti-Self-Approval!)
  // --------------------------------------------------------------------------
  const sodResult = checkAntiSelfApproval({
    userId: actor.id,
    creatorId: task.creatorId,
    createdById: task.createdById,
    primaryOwnerId: task.primaryOwnerId,
    driId: task.driId,
    assigneeIds: task.assigneeIds,
    assignees: task.assignees,
    submittedByUserId: task.submittedByUserId,
    deliverables: task.deliverables,
    deliverableUploadedByIds: task.deliverableUploadedByIds,
  });

  const hasApprovalAuthority =
    executive ||
    unitHead ||
    hasValidDelegation('task.approve');

  if (isTerminalState) {
    matrix.CAN_APPROVE = false;
    matrix.CAN_REJECT = false;
    reasons.CAN_APPROVE = 'Nhiệm vụ đã kết thúc.';
    reasons.CAN_REJECT = 'Nhiệm vụ đã kết thúc.';
  } else if (normStatus !== 'WAITING_APPROVAL' && normStatus !== 'NEEDS_REVIEW') {
    matrix.CAN_APPROVE = false;
    matrix.CAN_REJECT = false;
    reasons.CAN_APPROVE = 'Nhiệm vụ chưa được nộp duyệt (chưa ở trạng thái WAITING_APPROVAL).';
    reasons.CAN_REJECT = 'Nhiệm vụ chưa được nộp duyệt.';
  } else if (!hasApprovalAuthority) {
    matrix.CAN_APPROVE = false;
    matrix.CAN_REJECT = false;
    reasons.CAN_APPROVE = 'Không có thẩm quyền phê duyệt nhiệm vụ này.';
    reasons.CAN_REJECT = 'Không có thẩm quyền từ chối nhiệm vụ này.';
  } else if (!sodResult.allowed) {
    // SoD Violation blocks both CAN_APPROVE and CAN_REJECT
    matrix.CAN_APPROVE = false;
    matrix.CAN_REJECT = false;
    reasons.CAN_APPROVE = sodResult.reason;
    reasons.CAN_REJECT = sodResult.reason;
  } else {
    matrix.CAN_APPROVE = true;
    matrix.CAN_REJECT = true;
  }

  // --------------------------------------------------------------------------
  // 6. CAN_DELEGATE
  // --------------------------------------------------------------------------
  if (isTerminalState) {
    matrix.CAN_DELEGATE = false;
    reasons.CAN_DELEGATE = 'Nhiệm vụ đã kết thúc.';
  } else if (executive || unitHead) {
    matrix.CAN_DELEGATE = true;
  } else {
    matrix.CAN_DELEGATE = false;
    reasons.CAN_DELEGATE = 'Chỉ cán bộ lãnh đạo quản lý mới có quyền ủy quyền phê duyệt hoặc điều hành nhiệm vụ.';
  }

  // --------------------------------------------------------------------------
  // 7. CAN_DELETE
  // --------------------------------------------------------------------------
  if (normStatus !== 'NOT_STARTED' && normStatus !== 'NEW') {
    matrix.CAN_DELETE = false;
    reasons.CAN_DELETE = 'Chỉ có thể xóa nhiệm vụ chưa bắt đầu thực hiện.';
  } else if (executive || isCreator) {
    matrix.CAN_DELETE = true;
  } else {
    matrix.CAN_DELETE = false;
    reasons.CAN_DELETE = 'Chỉ người khởi tạo hoặc Ban Giám hiệu mới có quyền xóa nhiệm vụ.';
  }

  // --------------------------------------------------------------------------
  // 8. CAN_DOWNLOAD
  // --------------------------------------------------------------------------
  if (matrix.CAN_VIEW && (task.deliverables?.length || 0) > 0) {
    matrix.CAN_DOWNLOAD = true;
  } else if (!matrix.CAN_VIEW) {
    matrix.CAN_DOWNLOAD = false;
    reasons.CAN_DOWNLOAD = 'Không có quyền xem nhiệm vụ để tải tệp đính kèm.';
  } else {
    matrix.CAN_DOWNLOAD = false;
    reasons.CAN_DOWNLOAD = 'Nhiệm vụ không có tệp đính kèm hoặc kết quả bàn giao.';
  }

  return {
    matrix,
    reasons,
  };
}
