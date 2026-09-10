import type {
  ApprovalAuditLog,
  DelegationRule,
  DelegationScope,
} from "../types/delegation";

function normalizeDateString(date?: string | Date): string {
  if (!date) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (typeof date === "string") {
    return date.slice(0, 10);
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isDelegationActive(
  rule: DelegationRule,
  referenceDate?: string | Date
): boolean {
  if (rule.status !== "ACTIVE") {
    return false;
  }
  const ref = normalizeDateString(referenceDate);
  return ref >= rule.startDate && ref <= rule.endDate;
}

export interface CanUserApproveTaskParams {
  actor: {
    id: string;
    name: string;
    role: string;
    departmentCode?: string;
  };
  task: {
    id: string;
    departmentCode: string;
    assigneeId?: string;
  };
  activeDelegations: DelegationRule[];
  referenceDate?: string | Date;
}

export interface CanUserApproveTaskResult {
  allowed: boolean;
  reason?: string;
  isDelegated?: boolean;
  rule?: DelegationRule;
}

export function canUserApproveTask(
  params: CanUserApproveTaskParams
): CanUserApproveTaskResult {
  const { actor, task, activeDelegations, referenceDate } = params;

  // 1. Separation of Duties: Self-Approval Prevention
  if (task.assigneeId && actor.id === task.assigneeId) {
    return {
      allowed: false,
      reason:
        "Theo quy định quản trị và phân lập nhiệm vụ (Separation of Duties), người thực hiện không được tự phê duyệt công việc của mình.",
    };
  }

  // 2. School Admin approval
  if (actor.role === "ADMIN") {
    return { allowed: true, isDelegated: false };
  }

  // 3. Department Manager direct approval
  if (actor.role === "MANAGER" && actor.departmentCode === task.departmentCode) {
    return { allowed: true, isDelegated: false };
  }

  // 4. Valid Delegation Rule
  const matchingRule = activeDelegations.find((rule) => {
    const isGrantee = rule.granteeId === actor.id;
    const isDeptMatch = rule.departmentCode === task.departmentCode;
    const isScopeMatch =
      rule.scope === "DACUM_REVIEW_STEP1" ||
      rule.scope === "FULL_DEPARTMENT_APPROVAL";
    const isActive = isDelegationActive(rule, referenceDate);
    return isGrantee && isDeptMatch && isScopeMatch && isActive;
  });

  if (matchingRule) {
    return {
      allowed: true,
      isDelegated: true,
      rule: matchingRule,
    };
  }

  // 5. Default unauthorized
  return {
    allowed: false,
    reason:
      "Bạn không có quyền phê duyệt công việc này hoặc thời gian ủy quyền đã hết hiệu lực.",
  };
}

export interface RecordDelegatedApprovalParams {
  taskId: string;
  action: "APPROVE_DACUM_STEP1" | "REJECT_DACUM_STEP1" | "APPROVE_SCHOOL_TASK";
  actor: {
    id: string;
    name: string;
    role: string;
  };
  rule?: DelegationRule;
  timestamp?: string;
  notes?: string;
}

export function recordDelegatedApproval(
  params: RecordDelegatedApprovalParams
): ApprovalAuditLog {
  const isDelegated = Boolean(params.rule);
  return {
    taskId: params.taskId,
    action: params.action,
    performedByUserId: params.actor.id,
    performedByUserName: params.actor.name,
    performedByUserRole: params.actor.role,
    isDelegated,
    delegatedByGrantorId: params.rule?.grantorId,
    delegatedByGrantorName: params.rule?.grantorName,
    timestamp: params.timestamp || new Date().toISOString(),
    notes: params.notes,
  };
}

export interface CanPerformActionParams {
  user: { id: string; role: string; departmentCode?: string };
  requiredScope: DelegationScope;
  departmentCode: string;
  delegations: DelegationRule[];
  referenceDate?: string | Date;
}

/**
 * Kiểm tra phân quyền thực thi theo thẩm quyền hoặc ủy quyền hợp lệ
 */
export function canPerformAction(params: CanPerformActionParams): boolean {
  const { user, requiredScope, departmentCode, delegations, referenceDate } = params;
  if (user.role === "ADMIN") return true;
  if (user.role === "MANAGER" && user.departmentCode === departmentCode) return true;

  return delegations.some((rule) => {
    if (rule.granteeId !== user.id) return false;
    if (rule.departmentCode !== departmentCode) return false;
    if (!isDelegationActive(rule, referenceDate)) return false;

    // Toàn quyền quản lý đơn vị (Quyền Trưởng đơn vị) bao quát mọi thẩm quyền
    if (rule.scope === "FULL_DEPARTMENT_APPROVAL") return true;
    return rule.scope === requiredScope;
  });
}

export interface SignerDesignation {
  prefix: string; // "KT. TRƯỞNG KHOA" hoặc "TL. HIỆU TRƯỞNG"
  signerName: string;
  documentRef?: string;
  signerTitle: string;
}

/**
 * Chuẩn hóa thể thức đề ký thừa lệnh / ký thay (KT./TL.) theo Nghị định 30/2020/NĐ-CP
 */
export function resolveSignerDesignation(params: {
  grantorRole: string;
  granteeName: string;
  delegation?: DelegationRule;
  granteeTitle?: string;
}): SignerDesignation {
  const { grantorRole, granteeName, delegation, granteeTitle } = params;
  const isRector = /hiệu trưởng|bgh|admin/i.test(grantorRole);

  const prefix = isRector
    ? "TL. HIỆU TRƯỞNG"
    : `KT. ${grantorRole.trim().toUpperCase()}`;

  const defaultTitle = isRector
    ? "TRƯỞNG PHÒNG ĐƯỢC ỦY QUYỀN"
    : "PHÓ TRƯỞNG ĐƠN VỊ";

  return {
    prefix,
    signerName: granteeName,
    documentRef: delegation?.documentRef,
    signerTitle: granteeTitle || defaultTitle,
  };
}

