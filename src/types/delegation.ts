export type DelegationScope =
  | "DACUM_REVIEW_STEP1"
  | "TASK_ASSIGNMENT"
  | "FULL_DEPARTMENT_APPROVAL";

export type DelegationStatus = "ACTIVE" | "EXPIRED" | "REVOKED";

export interface DelegationRule {
  id: string;
  grantorId: string;
  grantorName: string;
  grantorRole: "ADMIN" | "MANAGER";
  granteeId: string;
  granteeName: string;
  granteeRole: "MANAGER" | "STAFF";
  departmentCode: string;
  scope: DelegationScope;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: DelegationStatus;
  reason: string;
  createdAt: string;
  revokedAt?: string;
}

export interface ApprovalAuditLog {
  taskId: string;
  action: "APPROVE_DACUM_STEP1" | "REJECT_DACUM_STEP1" | "APPROVE_SCHOOL_TASK";
  performedByUserId: string;
  performedByUserName: string;
  performedByUserRole: string;
  isDelegated: boolean;
  delegatedByGrantorId?: string;
  delegatedByGrantorName?: string;
  timestamp: string;
  notes?: string;
}
