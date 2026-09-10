/**
 * HYBRID AUTHORIZATION & CAPABILITY ENGINE (RBAC + ReBAC + ABAC)
 * Canonical Reference Implementation for QCET E-Office
 *
 * Specifications:
 * - docs/domain/authority.md (QCET-AUTH-SPEC-2026-01)
 * - docs/domain/permission-matrix.md (QCET-AUTH-MATRIX-2026-01)
 * - docs/domain/delegations.md (SPEC-DOMAIN-DEL-2026-01)
 */

// ============================================================================
// 1. TYPED CAPABILITY CATALOG (CANONICAL SOURCE: src/server/authorization/capability.ts)
// ============================================================================

import type {
  CapabilityAction,
  CapabilityCategory,
  MeetingCapabilityAction,
  DocumentCanonicalCapabilityAction,
  DocumentIncomingCapabilityAction,
  DocumentOutgoingCapabilityAction,
  DocumentCapabilityAction,
  TaskCapabilityAction,
  SystemCapabilityAction,
  DossierCapabilityAction,
  HrCapabilityAction,
  StatutoryNonDelegableAction,
  StatutorySigningCapabilityAction,
  CapabilityMetadata,
} from "@/server/authorization/capability";

export type {
  CapabilityAction,
  CapabilityCategory,
  MeetingCapabilityAction,
  DocumentCanonicalCapabilityAction,
  DocumentIncomingCapabilityAction,
  DocumentOutgoingCapabilityAction,
  DocumentCapabilityAction,
  TaskCapabilityAction,
  SystemCapabilityAction,
  DossierCapabilityAction,
  HrCapabilityAction,
  StatutoryNonDelegableAction,
  StatutorySigningCapabilityAction,
  CapabilityMetadata,
};

export {
  authorize as canonicalAuthorize,
  assertAuthorized as canonicalAssertAuthorized,
} from "@/server/authorization/authorization-engine";

import { logger } from "@/server/observability/logger";

import {
  CAPABILITY_CATEGORIES,
  MEETING_CAPABILITIES,
  DOCUMENT_CANONICAL_CAPABILITIES,
  DOCUMENT_INCOMING_CAPABILITIES,
  DOCUMENT_OUTGOING_CAPABILITIES,
  DOCUMENT_CAPABILITIES,
  TASK_CAPABILITIES,
  SYSTEM_CAPABILITIES,
  DOSSIER_CAPABILITIES,
  HR_CAPABILITIES,
  STATUTORY_GOVERNANCE_CAPABILITIES,
  NON_DELEGABLE_CAPABILITIES,
  STATUTORY_SIGNING_CAPABILITIES,
  PORTFOLIO_BOUND_ACTIONS,
  isMeetingCapability,
  isDocumentCapability,
  isTaskCapability,
  isSystemCapability,
  isDossierCapability,
  isHrCapability,
  isStatutorySigningCapability,
  isNonDelegableCapability,
  isValidCapability,
  isCapabilityAction,
  getCapabilityCategory,
  getCapabilityMetadata,
  resolveCanonicalCapability,
} from "@/server/authorization/capability";

export {
  CAPABILITY_CATEGORIES,
  MEETING_CAPABILITIES,
  DOCUMENT_CANONICAL_CAPABILITIES,
  DOCUMENT_INCOMING_CAPABILITIES,
  DOCUMENT_OUTGOING_CAPABILITIES,
  DOCUMENT_CAPABILITIES,
  TASK_CAPABILITIES,
  SYSTEM_CAPABILITIES,
  DOSSIER_CAPABILITIES,
  HR_CAPABILITIES,
  STATUTORY_GOVERNANCE_CAPABILITIES,
  NON_DELEGABLE_CAPABILITIES,
  STATUTORY_SIGNING_CAPABILITIES,
  PORTFOLIO_BOUND_ACTIONS,
  isMeetingCapability,
  isDocumentCapability,
  isTaskCapability,
  isSystemCapability,
  isDossierCapability,
  isHrCapability,
  isStatutorySigningCapability,
  isNonDelegableCapability,
  isValidCapability,
  isCapabilityAction,
  getCapabilityCategory,
  getCapabilityMetadata,
  resolveCanonicalCapability,
};

// ============================================================================
// 2. DOMAIN TYPES & INTERFACES
// ============================================================================

export type DataClassification =
  | "PUBLIC"
  | "INTERNAL"
  | "RESTRICTED"
  | "PERSONAL"
  | "STATE_SECRET"
  | "TUYET_MAT"
  | "TOI_MAT"
  | "MAT"
  | "THUONG";

export type InstitutionalPositionCode =
  | "HIEU_TRUONG"
  | "PHO_HIEU_TRUONG"
  | "PHO_HIEU_TRUONG_DT"
  | "PHO_HIEU_TRUONG_HC"
  | "TRUONG_DON_VI"
  | "PHO_TRUONG_DON_VI"
  | "GIANG_VIEN_CHUYEN_VIEN"
  | "CHUYEN_VIEN"
  | "GIANG_VIEN"
  | "VAN_THU"
  | "LUU_TRU"
  | "QUAN_TRI_HE_THONG"
  | string;

export type InstitutionalPortfolioCode =
  | "ACADEMIC"
  | "ADMINISTRATION_LOGISTICS"
  | "INSTITUTIONAL_STRATEGY"
  | string;

export type ResourceRelationship =
  | "ASSIGNER"
  | "LEAD_UNIT"
  | "DRI" // Directly Responsible Individual / Primary Owner
  | "COLLABORATOR"
  | "FOLLOWER"
  | "REVIEWER"
  | "APPROVER"
  | "OBSERVER";

export type RejectionCode =
  | "UNAUTHENTICATED"
  | "DEACTIVATED_ACCOUNT"
  | "SEPARATION_OF_POWERS_VIOLATION"
  | "STATE_SECRET_STRICT_PROHIBITION"
  | "PERSONAL_DATA_PRIVACY_BREACH"
  | "SOD_VIOLATION"
  | "SEPARATION_OF_DUTIES_VIOLATION"
  | "PORTFOLIO_MISMATCH"
  | "DELEGATION_EXPIRED"
  | "DELEGATION_REVOKED"
  | "NON_DELEGABLE_POWER_VIOLATION"
  | "SINGLE_DRI_VIOLATION"
  | "COLLABORATOR_CANNOT_REASSIGN_DRI"
  | "DEPARTMENT_BOUNDARY_VIOLATION"
  | "UNIT_SCOPE_DENIED"
  | "INSUFFICIENT_RELATIONSHIP"
  | "INSUFFICIENT_CAPABILITY";

export interface ActiveDelegationGrantContext {
  id: string;
  grantorAssignmentId?: string;
  grantorUserId?: string;
  grantorPositionCode?: string;
  grantorPortfolios?: InstitutionalPortfolioCode[];
  granteeAssignmentId?: string;
  granteeUserId: string;
  capability: string; // Action name or "*"
  responsibilityArea?: InstitutionalPortfolioCode;
  resourceScope?: "INSTITUTION_WIDE" | "UNIT_ONLY" | "SPECIFIC_TASK" | "SPECIFIC_DOC_TYPE" | string;
  specificResourceId?: string;
  validFrom: Date | string;
  validUntil: Date | string;
  status: "ACTIVE" | "REVOKED" | "EXPIRED" | "PENDING" | string;
  sourceDocumentNumber?: string;
  noSubDelegation?: boolean;
  revokedAt?: Date | string | null;
  grantorCapabilities?: CapabilityAction[];
}

export interface AuthenticatedUserContext {
  id: string;
  email?: string;
  name?: string;
  isActive?: boolean;
  deactivatedAt?: Date | string | null;
  sessionTokenValid?: boolean;
  systemRole?: string;
  role?: string;
  activePositionCode?: InstitutionalPositionCode;
  activeAssignmentId?: string;
  activeUnitId?: string;
  departmentId?: string;
  departmentCode?: string;
  portfolios?: InstitutionalPortfolioCode[];
  delegationGrants?: ActiveDelegationGrantContext[];
  metadata?: Record<string, unknown>;
}

export interface AuthorizationResource {
  id: string;
  type: "task" | "document_incoming" | "document_outgoing" | "dossier" | "system" | string;
  createdById?: string;
  assignerId?: string;
  departmentId?: string;
  leadDepartmentId?: string;
  owningUnitId?: string;
  scope?: "SCHOOL" | "DEPARTMENT" | "INDIVIDUAL" | "school" | "unit" | "my" | string;
  portfolio?: InstitutionalPortfolioCode;
  classification?: DataClassification;
  securityLevel?: string;
  primaryOwnerId?: string; // Single DRI
  leadUserId?: string;
  collaboratorIds?: string[];
  reviewerIds?: string[];
  approverIds?: string[];
  assigneeIds?: string[];
  followerIds?: string[];
  observerIds?: string[];
  submittedByUserId?: string;
  uploadedById?: string;
  draftingUserId?: string;
  drafterId?: string;
  draftingDeptId?: string;
  formatReviewerId?: string;
  signerId?: string;
  authorizedSignerId?: string;
  signerName?: string;
  numbererId?: string;
  dossierOwnerId?: string;
  archivistId?: string;
  targetUserId?: string;
  metadata?: Record<string, unknown>;
}

export interface AuthorizationContext {
  ipAddress?: string;
  userAgent?: string;
  hasConsentOrLegalBasis?: boolean;
  requestScope?: "school" | "unit" | "my";
  clientTimestamp?: Date | string;
  targetNewPrimaryOwnerId?: string; // For checking DRI reassignments
}

export interface AuditRecord {
  actorId: string;
  action: CapabilityAction;
  resourceType: string;
  resourceId?: string;
  timestamp: Date;
  decision: "ALLOW" | "DENY";
  rejectionCode?: RejectionCode;
  policyMatched?: string;
  ipAddress?: string;
}

export interface AuthorizationResult {
  allowed: boolean;
  granted: boolean; // Canonical alias for allowed matching authority.md
  rejectionCode?: RejectionCode;
  statusCode: RejectionCode | "GRANTED";
  reason?: string;
  auditRecord: AuditRecord;
  delegationContext?: {
    isDelegated: boolean;
    delegationGrantId?: string;
    sourceDocument?: string;
    grantorId?: string;
  };
}

// ============================================================================
// 3. ERROR DEFINITIONS
// ============================================================================

export class HybridAuthorizationError extends Error {
  public readonly rejectionCode: RejectionCode;
  public readonly statusCode: number;
  public readonly action: CapabilityAction;
  public readonly resourceId?: string;
  public readonly auditRecord?: AuditRecord;

  constructor(
    message: string,
    rejectionCode: RejectionCode,
    action: CapabilityAction,
    resourceId?: string,
    statusCode = 403,
    auditRecord?: AuditRecord
  ) {
    super(message);
    this.name = this.constructor.name;
    this.rejectionCode = rejectionCode;
    this.statusCode = statusCode;
    this.action = action;
    this.resourceId = resourceId;
    this.auditRecord = auditRecord;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class SeparationOfPowersError extends HybridAuthorizationError {
  constructor(action: CapabilityAction, resourceId?: string) {
    super(
      "Quản trị viên kỹ thuật (QUAN_TRI_HE_THONG) bị cấm tuyệt đối truy cập hoặc can thiệp nghiệp vụ quản lý, hồ sơ và văn bản điều hành của Nhà trường.",
      "SEPARATION_OF_POWERS_VIOLATION",
      action,
      resourceId,
      403
    );
  }
}

export class SeparationOfDutiesError extends HybridAuthorizationError {
  constructor(message: string, action: CapabilityAction, resourceId?: string) {
    super(
      message,
      "SOD_VIOLATION",
      action,
      resourceId,
      403
    );
  }
}

export class PortfolioMismatchError extends HybridAuthorizationError {
  constructor(action: CapabilityAction, requiredPortfolio?: string, resourceId?: string) {
    super(
      `Thao tác thuộc mảng công tác [${requiredPortfolio || "UNKNOWN"}] nằm ngoài phạm vi phụ trách theo QĐ 420/QĐ-CĐKTCNQN và không có giấy ủy quyền điều hành hợp lệ.`,
      "PORTFOLIO_MISMATCH",
      action,
      resourceId,
      403
    );
  }
}

export class DelegationExpiredError extends HybridAuthorizationError {
  constructor(action: CapabilityAction, resourceId?: string) {
    super(
      "Văn bản ủy quyền tác nghiệp đã hết thời hạn hiệu lực pháp lý.",
      "DELEGATION_EXPIRED",
      action,
      resourceId,
      403
    );
  }
}

export class NonDelegablePowerError extends HybridAuthorizationError {
  constructor(action: CapabilityAction, resourceId?: string) {
    super(
      `Thẩm quyền ${action} là quyền luật định tối cao của Hiệu trưởng, tuyệt đối không được chuyển giao qua ủy quyền tác nghiệp.`,
      "NON_DELEGABLE_POWER_VIOLATION",
      action,
      resourceId,
      403
    );
  }
}

export class SingleDRIError extends HybridAuthorizationError {
  constructor(action: CapabilityAction, resourceId?: string) {
    super(
      "Cán bộ phối hợp không có quyền điều chuyển hoặc thay đổi người chịu trách nhiệm chính (Single DRI Rule).",
      "COLLABORATOR_CANNOT_REASSIGN_DRI",
      action,
      resourceId,
      403
    );
  }
}

// ============================================================================
// 4. HELPER UTILITIES & RELATIONSHIP GRAPH
// ============================================================================

/**
 * Check if the user is a Technical System Administrator
 */
export function isSystemAdminUser(user: AuthenticatedUserContext): boolean {
  const position = (user.activePositionCode || "").toUpperCase();
  const systemRole = (user.systemRole || "").toUpperCase();
  const role = (user.role || "").toUpperCase();

  return (
    position === "QUAN_TRI_HE_THONG" ||
    position === "ADMIN" ||
    systemRole === "SYSTEM_ADMIN" ||
    (role === "ADMIN" && !isExecutivePosition(position))
  );
}

/**
 * Check if position belongs to the Institutional Executive (Ban Giam hieu)
 */
export function isExecutivePosition(positionCode?: string): boolean {
  const code = (positionCode || "").toUpperCase();
  return (
    code === "HIEU_TRUONG" ||
    code === "PHO_HIEU_TRUONG" ||
    code === "PHO_HIEU_TRUONG_DT" ||
    code === "PHO_HIEU_TRUONG_HC" ||
    code === "BGH" ||
    code === "BAN_GIAM_HIEU" ||
    code === "BGH_HT" ||
    code === "BGH_PHT_DT" ||
    code === "BGH_PHT_CSVC"
  );
}

/**
 * Check if position represents a Department / Faculty / Center Head (Truong don vi)
 */
export function isUnitLeaderPosition(positionCode?: string): boolean {
  const code = (positionCode || "").toUpperCase();
  return (
    code === "TRUONG_DON_VI" ||
    code === "TRUONG_PHONG" ||
    code === "TRUONG_KHOA" ||
    code === "GIAM_DOC_TRUNG_TAM"
  );
}

/**
 * Check if position represents a Deputy Head (Pho don vi)
 */
export function isDeputyUnitLeaderPosition(positionCode?: string): boolean {
  const code = (positionCode || "").toUpperCase();
  return (
    code === "PHO_TRUONG_DON_VI" ||
    code === "PHO_TRUONG_PHONG" ||
    code === "PHO_TRUONG_KHOA" ||
    code === "PHO_GIAM_DOC_TRUNG_TAM" ||
    code === "PHO_DON_VI"
  );
}

/**
 * ReBAC: Evaluate relationship graph between User and Resource
 */
export function getResourceRelationships(
  user: AuthenticatedUserContext,
  resource: AuthorizationResource
): Set<ResourceRelationship> {
  const rels = new Set<ResourceRelationship>();

  if (!user?.id || !resource) return rels;

  const userId = user.id;

  // ASSIGNER
  if (
    resource.createdById === userId ||
    resource.assignerId === userId ||
    resource.draftingUserId === userId
  ) {
    rels.add("ASSIGNER");
  }

  // LEAD_UNIT (Department affiliation)
  if (
    user.departmentId &&
    (resource.departmentId === user.departmentId ||
      resource.leadDepartmentId === user.departmentId ||
      resource.draftingDeptId === user.departmentId ||
      resource.owningUnitId === user.departmentId)
  ) {
    rels.add("LEAD_UNIT");
  }

  // DRI (Directly Responsible Individual / Primary Owner)
  if (
    resource.primaryOwnerId === userId ||
    resource.leadUserId === userId ||
    resource.dossierOwnerId === userId
  ) {
    rels.add("DRI");
  }

  // COLLABORATOR
  if (resource.collaboratorIds?.includes(userId)) {
    rels.add("COLLABORATOR");
  }

  // FOLLOWER
  if (resource.followerIds?.includes(userId)) {
    rels.add("FOLLOWER");
  }

  // REVIEWER
  if (resource.reviewerIds?.includes(userId)) {
    rels.add("REVIEWER");
  }

  // APPROVER
  if (resource.approverIds?.includes(userId)) {
    rels.add("APPROVER");
  }

  // OBSERVER
  if (
    resource.observerIds?.includes(userId) ||
    resource.assigneeIds?.includes(userId)
  ) {
    rels.add("OBSERVER");
  }

  return rels;
}

// ============================================================================
// 5. THE 7-STEP EVALUATION ENGINE
// ============================================================================

export async function authorize(
  user: AuthenticatedUserContext,
  action: CapabilityAction,
  resource: AuthorizationResource,
  context: AuthorizationContext = {},
  now: Date = new Date()
): Promise<AuthorizationResult> {
  const baseAuditRecord = {
    actorId: user?.id || "anonymous",
    action,
    resourceType: resource?.type || "unknown",
    resourceId: resource?.id,
    timestamp: now,
    ipAddress: context?.ipAddress,
  };

  // --------------------------------------------------------------------------
  // STEP 1: AUTHENTICATION & IDENTITY STATUS
  // --------------------------------------------------------------------------
  if (!user || !user.id) {
    return {
      allowed: false,
      granted: false,
      rejectionCode: "UNAUTHENTICATED",
      statusCode: "UNAUTHENTICATED",
      reason: "Yêu cầu chưa được xác thực danh tính.",
      auditRecord: {
        ...baseAuditRecord,
        decision: "DENY",
        rejectionCode: "UNAUTHENTICATED",
        policyMatched: "STEP_1_IDENTITY_VERIFICATION",
      },
    };
  }

  if (user.isActive === false || user.deactivatedAt) {
    return {
      allowed: false,
      granted: false,
      rejectionCode: "DEACTIVATED_ACCOUNT",
      statusCode: "DEACTIVATED_ACCOUNT",
      reason: "Tài khoản người dùng đã bị vô hiệu hóa hoặc thu hồi quyền truy cập.",
      auditRecord: {
        ...baseAuditRecord,
        decision: "DENY",
        rejectionCode: "DEACTIVATED_ACCOUNT",
        policyMatched: "STEP_1_DEACTIVATED_ACCOUNT",
      },
    };
  }

  if (user.sessionTokenValid === false) {
    return {
      allowed: false,
      granted: false,
      rejectionCode: "UNAUTHENTICATED",
      statusCode: "UNAUTHENTICATED",
      reason: "Phiên làm việc đã hết hạn hoặc chữ ký JWT không hợp lệ.",
      auditRecord: {
        ...baseAuditRecord,
        decision: "DENY",
        rejectionCode: "UNAUTHENTICATED",
        policyMatched: "STEP_1_SESSION_TOKEN_INVALID",
      },
    };
  }

  // --------------------------------------------------------------------------
  // STEP 2: LEGAL HARD INVARIANTS (DATA CLASSIFICATION & PROHIBITIONS)
  // --------------------------------------------------------------------------
  const classification = resource?.classification || resource?.securityLevel;

  if (
    classification === "STATE_SECRET" ||
    classification === "TUYET_MAT" ||
    classification === "TOI_MAT" ||
    classification === "MAT"
  ) {
    return {
      allowed: false,
      granted: false,
      rejectionCode: "STATE_SECRET_STRICT_PROHIBITION",
      statusCode: "STATE_SECRET_STRICT_PROHIBITION",
      reason:
        "Tài liệu thuộc phạm vi Bí mật nhà nước theo Luật 117/2025/QH15; tuyệt đối cấm xử lý, lưu trữ hoặc số hóa trên môi trường mạng thông thường.",
      auditRecord: {
        ...baseAuditRecord,
        decision: "DENY",
        rejectionCode: "STATE_SECRET_STRICT_PROHIBITION",
        policyMatched: "STEP_2_STATE_SECRET_PROHIBITION",
      },
    };
  }

  if (classification === "PERSONAL") {
    const isSubject =
      resource.targetUserId === user.id ||
      resource.primaryOwnerId === user.id ||
      resource.createdById === user.id;

    if (!isSubject && !context.hasConsentOrLegalBasis) {
      return {
        allowed: false,
        granted: false,
        rejectionCode: "PERSONAL_DATA_PRIVACY_BREACH",
        statusCode: "PERSONAL_DATA_PRIVACY_BREACH",
        reason:
          "Dữ liệu cá nhân được bảo vệ theo Luật 91/2025/QH15 và NĐ 356/2025/NĐ-CP; người dùng không có căn cứ pháp lý hoặc chấp thuận hợp lệ để truy cập.",
        auditRecord: {
          ...baseAuditRecord,
          decision: "DENY",
          rejectionCode: "PERSONAL_DATA_PRIVACY_BREACH",
          policyMatched: "STEP_2_PERSONAL_DATA_PRIVACY",
        },
      };
    }
  }

  // --------------------------------------------------------------------------
  // STEP 3: STRICT SEPARATION OF POWERS (SoP)
  // --------------------------------------------------------------------------
  const isSysAdmin = isSystemAdminUser(user);

  if (isSysAdmin) {
    // Technical Admin can only perform infrastructure and technical audit actions
    const isTechnicalAction =
      action.startsWith("system.") ||
      action.startsWith("account.") ||
      action.startsWith("org.") ||
      action.startsWith("position.") ||
      action.startsWith("audit.") ||
      action === "task.monitor"; // Technical workload/performance observation

    if (!isTechnicalAction) {
      return {
        allowed: false,
        granted: false,
        rejectionCode: "SEPARATION_OF_POWERS_VIOLATION",
        statusCode: "SEPARATION_OF_POWERS_VIOLATION",
        reason:
          "Vi phạm nguyên tắc phân lập quyền lực: Quản trị viên kỹ thuật (QUAN_TRI_HE_THONG) chỉ quản trị hạ tầng, cấm can thiệp hoặc truy cập nghiệp vụ điều hành.",
        auditRecord: {
          ...baseAuditRecord,
          decision: "DENY",
          rejectionCode: "SEPARATION_OF_POWERS_VIOLATION",
          policyMatched: "STEP_3_SEPARATION_OF_POWERS",
        },
      };
    }
  }

  // Non-admin cannot perform core system infrastructure tasks
  if (
    !isSysAdmin &&
    (action === "account.manage" ||
      action === "org.manage" ||
      action === "position.manage" ||
      action === "system.configure" ||
      action.startsWith("system.system."))
  ) {
    return {
      allowed: false,
      granted: false,
      rejectionCode: "INSUFFICIENT_CAPABILITY",
      statusCode: "INSUFFICIENT_CAPABILITY",
      reason: "Hành động quản trị hạ tầng kỹ thuật chỉ dành cho Quản trị viên hệ thống.",
      auditRecord: {
        ...baseAuditRecord,
        decision: "DENY",
        rejectionCode: "INSUFFICIENT_CAPABILITY",
        policyMatched: "STEP_3_NON_ADMIN_INFRASTRUCTURE_GUARD",
      },
    };
  }

  // --------------------------------------------------------------------------
  // STEP 4: SEPARATION OF DUTIES (SoD)
  // --------------------------------------------------------------------------
  // Rule 4.1: Creator != Approver
  if (action === "task.approve") {
    const isCreator = resource.createdById === user.id;
    const isPrimaryOwner = resource.primaryOwnerId === user.id;

    if (isCreator || isPrimaryOwner) {
      return {
        allowed: false,
        granted: false,
        rejectionCode: "SOD_VIOLATION",
        statusCode: "SOD_VIOLATION",
        reason:
          "Vi phạm nguyên tắc phân lập trách nhiệm (SoD): Người tạo lập hoặc người chịu trách nhiệm chính không được tự phê duyệt nhiệm vụ của mình.",
        auditRecord: {
          ...baseAuditRecord,
          decision: "DENY",
          rejectionCode: "SOD_VIOLATION",
          policyMatched: "STEP_4_CREATOR_NOT_APPROVER",
        },
      };
    }
  }

  // Rule 4.2: Executor != Reviewer
  if (action === "task.review") {
    const isPrimaryOwner = resource.primaryOwnerId === user.id;
    const isSubmitter =
      resource.submittedByUserId === user.id || resource.uploadedById === user.id;

    if (isPrimaryOwner || isSubmitter) {
      return {
        allowed: false,
        granted: false,
        rejectionCode: "SOD_VIOLATION",
        statusCode: "SOD_VIOLATION",
        reason:
          "Vi phạm nguyên tắc phân lập trách nhiệm (SoD): Cán bộ thực thi hoặc nộp minh chứng không được tự thẩm tra sản phẩm của mình.",
        auditRecord: {
          ...baseAuditRecord,
          decision: "DENY",
          rejectionCode: "SOD_VIOLATION",
          policyMatched: "STEP_4_EXECUTOR_NOT_REVIEWER",
        },
      };
    }
  }

  // Rule 4.3: Signer != Numberer & Signer != Stamp/Organization Signer
  if (
    action === "document.outgoing.number" ||
    action === "document.outgoing.assign_number" ||
    action === "document.outgoing.organization_sign"
  ) {
    const isSigner =
      resource.signerId === user.id ||
      resource.authorizedSignerId === user.id ||
      (resource.signerName && user.name && resource.signerName === user.name);

    if (isSigner) {
      return {
        allowed: false,
        granted: false,
        rejectionCode: "SOD_VIOLATION",
        statusCode: "SOD_VIOLATION",
        reason:
          "Vi phạm nguyên tắc phân lập trách nhiệm (SoD): Người ký văn bản không được tự cấp số đi hoặc đóng dấu số cơ quan.",
        auditRecord: {
          ...baseAuditRecord,
          decision: "DENY",
          rejectionCode: "SOD_VIOLATION",
          policyMatched: "STEP_4_SIGNER_NOT_NUMBERER",
        },
      };
    }
  }

  if (
    action === "document.outgoing.sign" ||
    action === "document.outgoing.authorized_sign" ||
    action === "document.outgoing.sign_kt" ||
    action === "document.outgoing.sign_tuq"
  ) {
    const isNumberer = resource.numbererId === user.id;
    if (isNumberer) {
      return {
        allowed: false,
        granted: false,
        rejectionCode: "SOD_VIOLATION",
        statusCode: "SOD_VIOLATION",
        reason:
          "Vi phạm nguyên tắc phân lập trách nhiệm (SoD): Cán bộ văn thư cấp số không được tự ký số chức danh lãnh đạo.",
        auditRecord: {
          ...baseAuditRecord,
          decision: "DENY",
          rejectionCode: "SOD_VIOLATION",
          policyMatched: "STEP_4_NUMBERER_NOT_SIGNER",
        },
      };
    }

    // Rule 4.4: Format Checker != Signer
    const isFormatReviewer =
      resource.formatReviewerId === user.id ||
      (resource.reviewerIds && resource.reviewerIds.includes(user.id) && resource.formatReviewerId === user.id);
    if (isFormatReviewer) {
      return {
        allowed: false,
        granted: false,
        rejectionCode: "SOD_VIOLATION",
        statusCode: "SOD_VIOLATION",
        reason:
          "Vi phạm nguyên tắc phân lập trách nhiệm (SoD): Cán bộ kiểm tra thể thức không được tự ký thẩm quyền văn bản.",
        auditRecord: {
          ...baseAuditRecord,
          decision: "DENY",
          rejectionCode: "SOD_VIOLATION",
          policyMatched: "STEP_4_FORMAT_CHECKER_NOT_SIGNER",
        },
      };
    }
  }

  // Rule 4.5: Drafter != Content Reviewer / Approver
  if (
    action === "document.outgoing.review_content" ||
    action === "document.outgoing.approve_content"
  ) {
    const isDrafter =
      resource.createdById === user.id ||
      resource.drafterId === user.id ||
      resource.draftingUserId === user.id ||
      resource.primaryOwnerId === user.id;

    if (isDrafter) {
      return {
        allowed: false,
        granted: false,
        rejectionCode: "SOD_VIOLATION",
        statusCode: "SOD_VIOLATION",
        reason:
          "Vi phạm nguyên tắc phân lập trách nhiệm (SoD): Người soạn thảo không được tự phê duyệt nội dung văn bản đi.",
        auditRecord: {
          ...baseAuditRecord,
          decision: "DENY",
          rejectionCode: "SOD_VIOLATION",
          policyMatched: "STEP_4_DRAFTER_NOT_CONTENT_REVIEWER",
        },
      };
    }
  }

  // Rule 4.6: Submitter != Archivist
  if (action === "dossier.accept_archive" || action === "document.archive") {
    const isSubmitter =
      (resource.submittedByUserId && resource.submittedByUserId === user.id) ||
      (resource.dossierOwnerId && resource.dossierOwnerId === user.id) ||
      (resource.createdById && resource.createdById === user.id) ||
      (resource.primaryOwnerId && resource.primaryOwnerId === user.id);

    if (isSubmitter) {
      return {
        allowed: false,
        granted: false,
        rejectionCode: "SOD_VIOLATION",
        statusCode: "SOD_VIOLATION",
        reason:
          "Vi phạm nguyên tắc phân lập trách nhiệm (SoD): Cán bộ nộp lưu hồ sơ không được tự tiếp nhận hồ sơ vào Lưu trữ cơ quan.",
        auditRecord: {
          ...baseAuditRecord,
          decision: "DENY",
          rejectionCode: "SOD_VIOLATION",
          policyMatched: "STEP_4_SUBMITTER_NOT_ARCHIVIST",
        },
      };
    }
  }

  // --------------------------------------------------------------------------
  // STEP 5: RESOURCE RELATIONSHIP (ReBAC) & SINGLE DRI RULE
  // --------------------------------------------------------------------------
  const relationships = getResourceRelationships(user, resource);

  // Single DRI Rule: Collaborator cannot reassign DRI
  if (action === "task.reassign" || action === "task.assign") {
    const isCollaborator = relationships.has("COLLABORATOR");
    const isDri = relationships.has("DRI");
    const isAssigner = relationships.has("ASSIGNER");
    const isLeader =
      isExecutivePosition(user.activePositionCode) ||
      (isUnitLeaderPosition(user.activePositionCode) && relationships.has("LEAD_UNIT"));

    // If caller is ONLY a collaborator without leadership or assigner rights
    if (isCollaborator && !isAssigner && !isLeader && !isDri) {
      return {
        allowed: false,
        granted: false,
        rejectionCode: "COLLABORATOR_CANNOT_REASSIGN_DRI",
        statusCode: "SINGLE_DRI_VIOLATION",
        reason:
          "Vi phạm quy tắc người chịu trách nhiệm chính duy nhất (Single DRI): Thành viên phối hợp không được quyền điều chuyển DRI.",
        auditRecord: {
          ...baseAuditRecord,
          decision: "DENY",
          rejectionCode: "COLLABORATOR_CANNOT_REASSIGN_DRI",
          policyMatched: "STEP_5_SINGLE_DRI_COLLABORATOR_GUARD",
        },
      };
    }
  }

  // Execution actions require DRI or Collaborator relationship
  if (action === "task.update_execution" || action === "task.submit_result") {
    const canExecute =
      relationships.has("DRI") ||
      relationships.has("COLLABORATOR") ||
      relationships.has("ASSIGNER") ||
      isExecutivePosition(user.activePositionCode);

    if (!canExecute) {
      return {
        allowed: false,
        granted: false,
        rejectionCode: "INSUFFICIENT_RELATIONSHIP",
        statusCode: "INSUFFICIENT_RELATIONSHIP",
        reason:
          "Chỉ người chủ trì (DRI) hoặc thành viên phối hợp mới có quyền cập nhật tiến độ hoặc nộp sản phẩm minh chứng.",
        auditRecord: {
          ...baseAuditRecord,
          decision: "DENY",
          rejectionCode: "INSUFFICIENT_RELATIONSHIP",
          policyMatched: "STEP_5_EXECUTION_RELATIONSHIP_REQUIRED",
        },
      };
    }
  }

  // --------------------------------------------------------------------------
  // STEP 6: ATTRIBUTE-BASED ACCESS CONTROL (ABAC), PORTFOLIO & DELEGATIONS
  // --------------------------------------------------------------------------
  const pos = (user.activePositionCode || "").toUpperCase();
  const isHieuTruong =
    pos === "HIEU_TRUONG" || pos === "BGH_HT" || user.systemRole === "RECTOR";

  // Check Portfolio Alignment for portfolio-bound actions
  let portfolioAligned = false;
  if (PORTFOLIO_BOUND_ACTIONS.includes(action) && resource.portfolio) {
    if (isHieuTruong) {
      // Rector possesses institution-wide strategic authority across all portfolios
      portfolioAligned = true;
    } else {
      const userPortfolios = user.portfolios || [];
      if (userPortfolios.includes(resource.portfolio)) {
        portfolioAligned = true;
      }
    }
  } else {
    portfolioAligned = true;
  }

  // Check Delegation Grant
  const delegationEvaluation = evaluateActiveDelegation(
    user,
    action,
    resource,
    now
  );

  if (delegationEvaluation.hasDelegation) {
    if (!delegationEvaluation.valid) {
      return {
        allowed: false,
        granted: false,
        rejectionCode: delegationEvaluation.rejectionCode,
        statusCode: delegationEvaluation.rejectionCode || "DELEGATION_EXPIRED",
        reason: delegationEvaluation.reason,
        auditRecord: {
          ...baseAuditRecord,
          decision: "DENY",
          rejectionCode: delegationEvaluation.rejectionCode,
          policyMatched: "STEP_6_DELEGATION_EVALUATION_FAILED",
        },
      };
    }

    // If valid delegation covers the portfolio requirement
    if (
      delegationEvaluation.grant?.responsibilityArea === resource.portfolio ||
      delegationEvaluation.grant?.capability === action ||
      delegationEvaluation.grant?.capability === "*"
    ) {
      portfolioAligned = true;
    }
  }

  if (!portfolioAligned) {
    return {
      allowed: false,
      granted: false,
      rejectionCode: "PORTFOLIO_MISMATCH",
      statusCode: "PORTFOLIO_MISMATCH",
      reason: `Hành động nghiệp vụ thuộc mảng [${resource.portfolio}], không thuộc mảng phụ trách của người dùng và không có giấy ủy quyền điều hành.`,
      auditRecord: {
        ...baseAuditRecord,
        decision: "DENY",
        rejectionCode: "PORTFOLIO_MISMATCH",
        policyMatched: "STEP_6_PORTFOLIO_ALIGNMENT_GUARD",
      },
    };
  }

  // --------------------------------------------------------------------------
  // STEP 7: MASTER CAPABILITY MATRIX EVALUATION & AUDIT LOGGING
  // --------------------------------------------------------------------------
  const matrixAllowed = evaluateCapabilityMatrix(
    user,
    action,
    resource,
    relationships,
    delegationEvaluation.valid ? delegationEvaluation.grant : undefined
  );

  if (!matrixAllowed.allowed) {
    return {
      allowed: false,
      granted: false,
      rejectionCode: matrixAllowed.rejectionCode || "INSUFFICIENT_CAPABILITY",
      statusCode: matrixAllowed.rejectionCode || "INSUFFICIENT_CAPABILITY",
      reason:
        matrixAllowed.reason ||
        "Vị trí và thẩm quyền của người dùng không thỏa mãn ma trận năng lực tác nghiệp.",
      auditRecord: {
        ...baseAuditRecord,
        decision: "DENY",
        rejectionCode: matrixAllowed.rejectionCode || "INSUFFICIENT_CAPABILITY",
        policyMatched: "STEP_7_MASTER_MATRIX_DENIAL",
      },
    };
  }

  // Successfully Authorized
  return {
    allowed: true,
    granted: true,
    statusCode: "GRANTED",
    reason: "Thao tác được chấp thuận theo thẩm quyền vị trí và phân công tác nghiệp.",
    auditRecord: {
      ...baseAuditRecord,
      decision: "ALLOW",
      policyMatched: matrixAllowed.policyMatched || "STEP_7_CAPABILITY_GRANTED",
    },
    delegationContext: delegationEvaluation.valid
      ? {
          isDelegated: true,
          delegationGrantId: delegationEvaluation.grant?.id,
          sourceDocument: delegationEvaluation.grant?.sourceDocumentNumber,
          grantorId: delegationEvaluation.grant?.grantorUserId,
        }
      : undefined,
  };
}

// ============================================================================
// 6. INTERNAL DELEGATION & MATRIX EVALUATION HELPERS
// ============================================================================

interface DelegationEvaluationResult {
  hasDelegation: boolean;
  valid: boolean;
  grant?: ActiveDelegationGrantContext;
  rejectionCode?: RejectionCode;
  reason?: string;
}

function getEffectiveAction(action: CapabilityAction): CapabilityAction {
  if (
    action === "document.outgoing.check_format" ||
    action === "document.outgoing.approve_format" ||
    action === "document.review_format"
  ) {
    return "document.outgoing.review_format";
  } else if (action === "document.outgoing.authorized_sign" || action === "document.sign") {
    return "document.outgoing.sign";
  } else if (action === "document.outgoing.assign_number" || action === "document.assign_number") {
    return "document.outgoing.number";
  } else if (action === "document.outgoing.approve_content") {
    return "document.outgoing.review_content";
  } else if (action === "dossier.remove_item") {
    return "dossier.add_item";
  } else if (action === "dossier.submit_archive") {
    return "dossier.transfer_archive";
  } else if (action === "document.archive") {
    return "dossier.accept_archive";
  }
  return action;
}

function evaluateActiveDelegation(
  user: AuthenticatedUserContext,
  action: CapabilityAction,
  resource: AuthorizationResource,
  now: Date
): DelegationEvaluationResult {
  const grants = user.delegationGrants || [];
  if (grants.length === 0) {
    return { hasDelegation: false, valid: false };
  }

  const effAction = getEffectiveAction(action);

  // Find candidate grants that mention this action or portfolio or wildcard
  const candidateGrants = grants.filter(
    (g) =>
      g.capability === action ||
      g.capability === effAction ||
      (action === "dossier.accept_archive" && g.capability === "document.archive") ||
      (action === "document.archive" && g.capability === "dossier.accept_archive") ||
      g.capability === "*" ||
      (resource.portfolio && g.responsibilityArea === resource.portfolio)
  );

  if (candidateGrants.length === 0) {
    return { hasDelegation: false, valid: false };
  }

  for (const grant of candidateGrants) {
    // 1. Check Non-Delegable statutory capabilities
    if (NON_DELEGABLE_CAPABILITIES.includes(action)) {
      return {
        hasDelegation: true,
        valid: false,
        grant,
        rejectionCode: "NON_DELEGABLE_POWER_VIOLATION",
        reason: `Thẩm quyền ${action} là quyền luật định tối cao, tuyệt đối không được chuyển giao qua ủy quyền tác nghiệp.`,
      };
    }

    // 2. Check Revocation
    if (grant.status === "REVOKED" || grant.revokedAt) {
      return {
        hasDelegation: true,
        valid: false,
        grant,
        rejectionCode: "DELEGATION_REVOKED",
        reason: "Văn bản ủy quyền đã bị người giao quyền hoặc Hiệu trưởng thu hồi hiệu lực.",
      };
    }

    // 3. Check Validity Window [validFrom, validUntil]
    const validFrom = new Date(grant.validFrom).getTime();
    const validUntil = new Date(grant.validUntil).getTime();
    const currentTime = now.getTime();

    if (currentTime > validUntil) {
      return {
        hasDelegation: true,
        valid: false,
        grant,
        rejectionCode: "DELEGATION_EXPIRED",
        reason: "Văn bản ủy quyền tác nghiệp đã hết hạn hiệu lực.",
      };
    }

    if (currentTime < validFrom) {
      return {
        hasDelegation: true,
        valid: false,
        grant,
        rejectionCode: "DELEGATION_EXPIRED",
        reason: "Văn bản ủy quyền tác nghiệp chưa đến thời điểm có hiệu lực.",
      };
    }

    // 4. Check Resource Scope if bounded
    if (grant.resourceScope === "SPECIFIC_TASK" && grant.specificResourceId) {
      if (resource.id !== grant.specificResourceId) {
        continue; // Try next grant
      }
    }

    // 5. Check Grantor capability: Grantor must actually possess the capability
    if (grant.grantorCapabilities && !grant.grantorCapabilities.includes(action)) {
      return {
        hasDelegation: true,
        valid: false,
        grant,
        rejectionCode: "INSUFFICIENT_CAPABILITY",
        reason: "Người ủy quyền không nắm giữ thẩm quyền này để có thể ủy thác cho người khác.",
      };
    }

    // Found valid grant!
    return {
      hasDelegation: true,
      valid: true,
      grant,
    };
  }

  return { hasDelegation: false, valid: false };
}

function evaluateCapabilityMatrix(
  user: AuthenticatedUserContext,
  action: CapabilityAction,
  resource: AuthorizationResource,
  relationships: Set<ResourceRelationship>,
  delegation?: ActiveDelegationGrantContext
): { allowed: boolean; rejectionCode?: RejectionCode; reason?: string; policyMatched?: string } {
  const pos = (user.activePositionCode || "").toUpperCase();

  let effAction = getEffectiveAction(action);

  // If action is covered by valid delegation
  if (delegation) {
    // Delegate anti-self-approval rule
    if (action === "task.approve" || action === "task.review") {
      if (
        resource.primaryOwnerId === user.id ||
        resource.createdById === user.id ||
        resource.submittedByUserId === user.id
      ) {
        return {
          allowed: false,
          rejectionCode: "SOD_VIOLATION",
          reason: "Cán bộ nhận ủy quyền không được tự phê duyệt nhiệm vụ do chính mình thực hiện.",
        };
      }
    }

    // Sub-delegation check for signing TUQ
    if (action === "document.outgoing.sign_tuq" && isDeputyUnitLeaderPosition(pos)) {
      return {
        allowed: false,
        rejectionCode: "INSUFFICIENT_CAPABILITY",
        reason: "Cấm tái ủy quyền ký thừa ủy quyền (TUQ.) cho cấp phó đơn vị.",
      };
    }

    return {
      allowed: true,
      policyMatched: `DELEGATION_GRANT_${delegation.id}`,
    };
  }

  // Position-based Matrix Resolution

  // 0. QUAN_TRI_HE_THONG (System Administrator)
  if (isSystemAdminUser(user)) {
    const isTechnicalAction =
      action.startsWith("system.") ||
      action.startsWith("account.") ||
      action.startsWith("org.") ||
      action.startsWith("position.") ||
      action.startsWith("audit.") ||
      action === "task.monitor";

    if (isTechnicalAction) {
      return { allowed: true, policyMatched: "SYSTEM_ADMIN_TECHNICAL_AUTHORITY" };
    }
    return {
      allowed: false,
      rejectionCode: "SEPARATION_OF_POWERS_VIOLATION",
      reason: "Quản trị viên kỹ thuật không được phép can thiệp nghiệp vụ quản lý.",
    };
  }

  // 1. HIEU_TRUONG (Rector)
  if (pos === "HIEU_TRUONG" || pos === "BGH_HT" || user.systemRole === "RECTOR") {
    // Cannot perform clerical operations
    if (
      action === "document.incoming.register" ||
      action === "document.incoming.present" ||
      effAction === "document.outgoing.review_format" ||
      effAction === "document.outgoing.number" ||
      effAction === "document.outgoing.organization_sign" ||
      effAction === "document.outgoing.issue" ||
      effAction === "dossier.accept_archive"
    ) {
      return {
        allowed: false,
        rejectionCode: "INSUFFICIENT_CAPABILITY",
        reason: "Nhiệm vụ này thuộc thẩm quyền nghiệp vụ văn thư hoặc lưu trữ cơ quan.",
      };
    }

    // Rector signs directly, not TUQ or KT
    if (action === "document.outgoing.sign_kt" || action === "document.outgoing.sign_tuq") {
      return {
        allowed: false,
        rejectionCode: "INSUFFICIENT_CAPABILITY",
        reason: "Hiệu trưởng ký số chính thức văn bản, không sử dụng ký thay (KT.) hoặc ký thừa ủy quyền (TUQ.).",
      };
    }

    return { allowed: true, policyMatched: "RECTOR_INSTITUTIONAL_AUTHORITY" };
  }

  // 2. PHO_HIEU_TRUONG (Vice Rector)
  if (
    pos === "PHO_HIEU_TRUONG" ||
    pos === "PHO_HIEU_TRUONG_DT" ||
    pos === "PHO_HIEU_TRUONG_HC" ||
    pos === "BGH_PHT_DT" ||
    pos === "BGH_PHT_CSVC"
  ) {
    if (
      action === "document.incoming.register" ||
      action === "document.incoming.present" ||
      effAction === "document.outgoing.review_format" ||
      effAction === "document.outgoing.number" ||
      effAction === "document.outgoing.organization_sign" ||
      effAction === "document.outgoing.issue" ||
      effAction === "dossier.accept_archive"
    ) {
      return {
        allowed: false,
        rejectionCode: "INSUFFICIENT_CAPABILITY",
        reason: "Nhiệm vụ này thuộc thẩm quyền nghiệp vụ văn thư hoặc lưu trữ cơ quan.",
      };
    }

    // Vice Rector signs KT. (Ký thay Hiệu trưởng)
    if (effAction === "document.outgoing.sign") {
      return {
        allowed: false,
        rejectionCode: "INSUFFICIENT_CAPABILITY",
        reason: "Phó Hiệu trưởng ký thay Hiệu trưởng sử dụng quyền ký KT. (document.outgoing.sign_kt).",
      };
    }

    if (action === "document.outgoing.sign_tuq") {
      return {
        allowed: false,
        rejectionCode: "INSUFFICIENT_CAPABILITY",
        reason: "Phó Hiệu trưởng ký văn bản với tư cách KT. Hiệu trưởng theo phân công, không dùng TUQ.",
      };
    }

    return { allowed: true, policyMatched: "VICE_RECTOR_PORTFOLIO_AUTHORITY" };
  }

  // 3. TRUONG_DON_VI (Department Head / Dean)
  if (isUnitLeaderPosition(pos)) {
    // Task capabilities within unit
    if (
      action === "task.view" ||
      action === "task.monitor" ||
      action === "task.remind"
    ) {
      const isSchoolScope = resource.scope === "SCHOOL" || resource.scope === "school";
      const hasUnitAffiliation = relationships.has("LEAD_UNIT");
      const hasDirectRelationship =
        relationships.has("DRI") ||
        relationships.has("COLLABORATOR") ||
        relationships.has("ASSIGNER") ||
        relationships.has("OBSERVER") ||
        relationships.has("REVIEWER") ||
        relationships.has("APPROVER");

      if (isSchoolScope || hasUnitAffiliation || hasDirectRelationship) {
        return { allowed: true, policyMatched: "UNIT_LEADER_TASK_AUTHORITY" };
      }

      return {
        allowed: false,
        rejectionCode: "UNIT_SCOPE_DENIED",
        reason: "Trưởng đơn vị chỉ được xem nhiệm vụ thuộc đơn vị mình phụ trách hoặc nhiệm vụ cấp trường.",
      };
    }

    if (action === "task.create") {
      return { allowed: true, policyMatched: "UNIT_LEADER_TASK_CREATE" };
    }

    if (action === "task.assign" || action === "task.reassign") {
      if (relationships.has("LEAD_UNIT") || relationships.has("ASSIGNER")) {
        return { allowed: true, policyMatched: "UNIT_LEADER_ASSIGN_AUTHORITY" };
      }
      return {
        allowed: false,
        rejectionCode: "DEPARTMENT_BOUNDARY_VIOLATION",
        reason: "Trưởng đơn vị chỉ có quyền giao việc hoặc phân công trong phạm vi đơn vị mình quản lý.",
      };
    }

    if (action === "task.review" || action === "task.approve" || action === "task.close") {
      // Must be unit lead or assigner
      if (relationships.has("LEAD_UNIT") || relationships.has("ASSIGNER")) {
        return { allowed: true, policyMatched: "UNIT_LEADER_APPROVAL_AUTHORITY" };
      }
      return {
        allowed: false,
        rejectionCode: "DEPARTMENT_BOUNDARY_VIOLATION",
        reason: "Trưởng đơn vị chỉ có quyền phê duyệt nhiệm vụ thuộc đơn vị mình quản lý.",
      };
    }

    if (action === "task.cancel") {
      if (relationships.has("ASSIGNER") && relationships.has("LEAD_UNIT")) {
        return { allowed: true, policyMatched: "UNIT_LEADER_CANCEL_AUTHORITY" };
      }
      return {
        allowed: false,
        rejectionCode: "DEPARTMENT_BOUNDARY_VIOLATION",
        reason: "Trưởng đơn vị chỉ có thể hủy nhiệm vụ do chính đơn vị mình tạo lập.",
      };
    }

    if (action === "document.incoming.assign_person") {
      return { allowed: true, policyMatched: "UNIT_LEADER_ASSIGN_PERSON" };
    }

    if (action === "document.incoming.execute") {
      return { allowed: true, policyMatched: "UNIT_LEADER_EXECUTE_DOC" };
    }

    if (action === "document.incoming.file" || action === "document.file") {
      return { allowed: true, policyMatched: "UNIT_LEADER_FILE_DOC" };
    }

    if (
      effAction === "document.outgoing.draft" ||
      effAction === "document.outgoing.review_content" ||
      effAction === "document.outgoing.submit_content_review" ||
      effAction === "document.outgoing.submit_format_check"
    ) {
      return { allowed: true, policyMatched: "UNIT_LEADER_OUTGOING_REVIEW" };
    }

    if (action === "document.outgoing.sign_tuq") {
      return {
        allowed: false,
        rejectionCode: "INSUFFICIENT_CAPABILITY",
        reason: "Trưởng đơn vị chỉ được ký thừa ủy quyền (TUQ.) khi có văn bản ủy quyền hợp lệ từ Hiệu trưởng.",
      };
    }

    if (
      effAction === "dossier.open" ||
      effAction === "dossier.add_item" ||
      effAction === "dossier.close" ||
      effAction === "dossier.transfer_archive"
    ) {
      const isOwningUnit =
        resource.owningUnitId &&
        (user.activeUnitId === resource.owningUnitId ||
         user.departmentId === resource.owningUnitId ||
         relationships.has("LEAD_UNIT"));
      if (!resource.owningUnitId || isOwningUnit) {
        return { allowed: true, policyMatched: "UNIT_LEADER_DOSSIER_MANAGEMENT" };
      }
      return {
        allowed: false,
        rejectionCode: "UNIT_SCOPE_DENIED",
        reason: "Trưởng đơn vị chỉ được quản lý hồ sơ công việc thuộc đơn vị mình.",
      };
    }

    if (action === "task.update_execution" || action === "task.submit_result") {
      if (relationships.has("DRI") || relationships.has("COLLABORATOR")) {
        return { allowed: true, policyMatched: "UNIT_LEADER_SELF_EXECUTION" };
      }
    }

    return { allowed: false, rejectionCode: "INSUFFICIENT_CAPABILITY" };
  }

  // 4. PHO_TRUONG_DON_VI (Deputy Head)
  if (isDeputyUnitLeaderPosition(pos)) {
    if (
      action === "task.view" ||
      action === "task.monitor" ||
      action === "task.remind"
    ) {
      const isSchoolScope = resource.scope === "SCHOOL" || resource.scope === "school";
      const hasUnitAffiliation = relationships.has("LEAD_UNIT");
      const hasDirectRelationship =
        relationships.has("DRI") ||
        relationships.has("COLLABORATOR") ||
        relationships.has("ASSIGNER") ||
        relationships.has("OBSERVER") ||
        relationships.has("REVIEWER") ||
        relationships.has("APPROVER");

      if (isSchoolScope || hasUnitAffiliation || hasDirectRelationship) {
        return { allowed: true, policyMatched: "DEPUTY_LEADER_BASE_AUTHORITY" };
      }

      return {
        allowed: false,
        rejectionCode: "UNIT_SCOPE_DENIED",
        reason: "Phó Trưởng đơn vị chỉ được xem nhiệm vụ thuộc đơn vị mình phụ trách hoặc nhiệm vụ cấp trường.",
      };
    }

    if (
      effAction === "dossier.open" ||
      effAction === "dossier.add_item" ||
      effAction === "dossier.close" ||
      effAction === "dossier.transfer_archive"
    ) {
      const isOwningUnit =
        resource.owningUnitId &&
        (user.activeUnitId === resource.owningUnitId ||
         user.departmentId === resource.owningUnitId ||
         relationships.has("LEAD_UNIT"));
      if (!resource.owningUnitId || isOwningUnit) {
        return { allowed: true, policyMatched: "DEPUTY_LEADER_DOSSIER_MANAGEMENT" };
      }
      return {
        allowed: false,
        rejectionCode: "UNIT_SCOPE_DENIED",
        reason: "Phó Trưởng đơn vị chỉ được quản lý hồ sơ công việc thuộc đơn vị mình.",
      };
    }

    if (
      action === "task.create" ||
      action === "document.incoming.execute" ||
      action === "document.outgoing.draft"
    ) {
      return { allowed: true, policyMatched: "DEPUTY_LEADER_BASE_AUTHORITY" };
    }

    if (action === "task.update_execution" || action === "task.submit_result") {
      if (relationships.has("DRI") || relationships.has("COLLABORATOR")) {
        return { allowed: true, policyMatched: "DEPUTY_LEADER_EXECUTION" };
      }
    }

    if (
      action === "task.assign" ||
      action === "task.reassign" ||
      action === "task.review" ||
      action === "task.approve" ||
      action === "document.incoming.assign_person" ||
      action === "document.outgoing.review_content"
    ) {
      return {
        allowed: false,
        rejectionCode: "INSUFFICIENT_CAPABILITY",
        reason: "Phó Trưởng đơn vị chỉ thực hiện quyền duyệt và giao việc khi có văn bản ủy quyền của Trưởng đơn vị.",
      };
    }

    return { allowed: false, rejectionCode: "INSUFFICIENT_CAPABILITY" };
  }

  // 5. GIANG_VIEN_CHUYEN_VIEN (Staff / Lecturer / Specialist)
  if (
    pos === "GIANG_VIEN_CHUYEN_VIEN" ||
    pos === "CHUYEN_VIEN" ||
    pos === "GIANG_VIEN" ||
    pos === "VIEN_CHUC" ||
    user.role === "STAFF"
  ) {
    if (action === "task.view") {
      const isSchoolScope = resource.scope === "SCHOOL" || resource.scope === "school";
      if (
        isSchoolScope ||
        relationships.has("DRI") ||
        relationships.has("COLLABORATOR") ||
        relationships.has("ASSIGNER") ||
        relationships.has("LEAD_UNIT") ||
        relationships.has("OBSERVER")
      ) {
        return { allowed: true, policyMatched: "STAFF_TASK_VIEW" };
      }
      return {
        allowed: false,
        rejectionCode: "UNIT_SCOPE_DENIED",
        reason: "Viên chức chỉ được xem các nhiệm vụ được phân công hoặc thuộc đơn vị công tác.",
      };
    }

    if (action === "task.create") {
      // Staff can create personal/individual tasks
      return { allowed: true, policyMatched: "STAFF_TASK_CREATE_INDIVIDUAL" };
    }

    if (action === "task.update_execution" || action === "task.submit_result") {
      if (relationships.has("DRI") || relationships.has("COLLABORATOR")) {
        return { allowed: true, policyMatched: "STAFF_EXECUTION_AND_SUBMIT" };
      }
      return {
        allowed: false,
        rejectionCode: "INSUFFICIENT_RELATIONSHIP",
        reason: "Chỉ người chịu trách nhiệm chính hoặc thành viên phối hợp mới có thể cập nhật tiến độ hoặc nộp sản phẩm.",
      };
    }

    if (action === "task.monitor") {
      return { allowed: true, policyMatched: "STAFF_MONITOR_PERSONAL" };
    }

    if (action === "document.incoming.execute") {
      if (relationships.has("DRI") || relationships.has("OBSERVER")) {
        return { allowed: true, policyMatched: "STAFF_DOCUMENT_EXECUTE" };
      }
    }

    if (action === "document.incoming.file" || action === "document.file") {
      if (relationships.has("DRI") || resource.leadUserId === user.id || resource.primaryOwnerId === user.id) {
        return { allowed: true, policyMatched: "STAFF_DOCUMENT_FILE" };
      }
    }

    if (
      effAction === "document.outgoing.draft" ||
      effAction === "document.outgoing.submit_content_review" ||
      effAction === "document.outgoing.submit_format_check"
    ) {
      return { allowed: true, policyMatched: "STAFF_DOCUMENT_DRAFT" };
    }

    if (
      effAction === "dossier.open" ||
      effAction === "dossier.add_item" ||
      effAction === "dossier.close" ||
      effAction === "dossier.transfer_archive"
    ) {
      if (
        relationships.has("DRI") ||
        resource.dossierOwnerId === user.id ||
        resource.createdById === user.id
      ) {
        return { allowed: true, policyMatched: "STAFF_DOSSIER_MANAGEMENT" };
      }
    }

    return {
      allowed: false,
      rejectionCode: "INSUFFICIENT_CAPABILITY",
      reason: "Viên chức không có quyền thực hiện hành động quản lý hoặc phê duyệt này.",
    };
  }

  // 6. VAN_THU (Clerk / Records Specialist)
  if (pos === "VAN_THU" || pos === "CLERK") {
    if (
      action === "document.incoming.register" ||
      action === "document.incoming.present" ||
      action === "document.incoming.file" ||
      action === "document.file" ||
      effAction === "document.outgoing.review_format" ||
      effAction === "document.outgoing.number" ||
      effAction === "document.outgoing.organization_sign" ||
      effAction === "document.outgoing.issue" ||
      effAction === "document.outgoing.submit_format_check" ||
      effAction === "dossier.open" ||
      effAction === "dossier.add_item" ||
      effAction === "dossier.close" ||
      effAction === "dossier.transfer_archive" ||
      effAction === "dossier.accept_archive" ||
      action === "task.view"
    ) {
      return { allowed: true, policyMatched: "CLERK_OFFICIAL_DUTIES" };
    }

    return {
      allowed: false,
      rejectionCode: "INSUFFICIENT_CAPABILITY",
      reason: "Hành động này nằm ngoài thẩm quyền nghiệp vụ văn thư cơ quan.",
    };
  }

  // 7. LUU_TRU (Archivist)
  if (pos === "LUU_TRU" || pos === "ARCHIVIST") {
    if (
      effAction === "dossier.accept_archive" ||
      effAction === "dossier.open" ||
      effAction === "dossier.add_item" ||
      effAction === "dossier.close" ||
      effAction === "dossier.transfer_archive" ||
      action === "task.view"
    ) {
      return { allowed: true, policyMatched: "ARCHIVIST_OFFICIAL_DUTIES" };
    }

    return {
      allowed: false,
      rejectionCode: "INSUFFICIENT_CAPABILITY",
      reason: "Hành động này nằm ngoài thẩm quyền nghiệp vụ lưu trữ cơ quan.",
    };
  }

  return {
    allowed: false,
    rejectionCode: "INSUFFICIENT_CAPABILITY",
    reason: "Vị trí của người dùng không có thẩm quyền thực hiện hành động này.",
  };
}

// ============================================================================
// 7. PUBLIC CONVENIENCE HELPERS
// ============================================================================

/**
 * Assert that an action is authorized, throwing a strongly-typed HybridAuthorizationError on rejection.
 */
export async function assertAuthorized(
  user: AuthenticatedUserContext,
  action: CapabilityAction,
  resource: AuthorizationResource,
  context: AuthorizationContext = {},
  now: Date = new Date()
): Promise<AuthorizationResult> {
  const result = await authorize(user, action, resource, context, now);

  if (!result.allowed) {
    const code = result.rejectionCode || "INSUFFICIENT_CAPABILITY";
    const reason = result.reason || "Access denied by authorization engine.";

    logger.authorizationDenied({
      userId: user?.id || null,
      action,
      resourceId: resource?.id,
      reason,
      metadata: {
        rejectionCode: code,
        resourceType: resource?.type,
        policyMatched: result.auditRecord?.policyMatched,
      },
    });

    switch (code) {
      case "SEPARATION_OF_POWERS_VIOLATION":
        throw new SeparationOfPowersError(action, resource?.id);
      case "SOD_VIOLATION":
      case "SEPARATION_OF_DUTIES_VIOLATION":
        throw new SeparationOfDutiesError(reason, action, resource?.id);
      case "PORTFOLIO_MISMATCH":
        throw new PortfolioMismatchError(action, resource?.portfolio, resource?.id);
      case "DELEGATION_EXPIRED":
        throw new DelegationExpiredError(action, resource?.id);
      case "NON_DELEGABLE_POWER_VIOLATION":
        throw new NonDelegablePowerError(action, resource?.id);
      case "COLLABORATOR_CANNOT_REASSIGN_DRI":
      case "SINGLE_DRI_VIOLATION":
        throw new SingleDRIError(action, resource?.id);
      default:
        throw new HybridAuthorizationError(
          reason,
          code,
          action,
          resource?.id,
          code === "UNAUTHENTICATED" ? 401 : 403,
          result.auditRecord
        );
    }
  }

  return result;
}

/**
 * Boolean-returning authorization check
 */
export async function isAuthorized(
  user: AuthenticatedUserContext,
  action: CapabilityAction,
  resource: AuthorizationResource,
  context: AuthorizationContext = {},
  now: Date = new Date()
): Promise<boolean> {
  const result = await authorize(user, action, resource, context, now);
  return result.allowed;
}

/**
 * Standalone verification of Separation of Duties (SoD)
 */
export function checkSeparationOfDuties(
  user: AuthenticatedUserContext,
  action: CapabilityAction,
  resource: AuthorizationResource
): { valid: boolean; rejectionCode?: RejectionCode; reason?: string } {
  if (action === "task.approve") {
    if (resource.createdById === user.id || resource.primaryOwnerId === user.id) {
      return {
        valid: false,
        rejectionCode: "SOD_VIOLATION",
        reason: "Người tạo hoặc người chịu trách nhiệm chính không được tự duyệt nhiệm vụ (Creator != Approver).",
      };
    }
  }

  if (action === "task.review") {
    if (
      resource.primaryOwnerId === user.id ||
      resource.submittedByUserId === user.id ||
      resource.uploadedById === user.id
    ) {
      return {
        valid: false,
        rejectionCode: "SOD_VIOLATION",
        reason: "Cán bộ thực hiện hoặc nộp minh chứng không được tự thẩm tra (Executor != Reviewer).",
      };
    }
  }

  if (
    action === "document.outgoing.number" ||
    action === "document.outgoing.assign_number" ||
    action === "document.outgoing.organization_sign"
  ) {
    if (
      resource.signerId === user.id ||
      resource.authorizedSignerId === user.id ||
      (resource.signerName && user.name && resource.signerName === user.name)
    ) {
      return {
        valid: false,
        rejectionCode: "SOD_VIOLATION",
        reason: "Người ký văn bản không được tự cấp số hoặc đóng dấu số cơ quan (Signer != Numberer).",
      };
    }
  }

  if (
    action === "document.outgoing.sign" ||
    action === "document.outgoing.authorized_sign" ||
    action === "document.outgoing.sign_kt" ||
    action === "document.outgoing.sign_tuq"
  ) {
    if (resource.numbererId === user.id) {
      return {
        valid: false,
        rejectionCode: "SOD_VIOLATION",
        reason: "Văn thư cấp số không được tự ký số chức danh lãnh đạo (Signer != Numberer).",
      };
    }

    if (resource.formatReviewerId === user.id) {
      return {
        valid: false,
        rejectionCode: "SOD_VIOLATION",
        reason: "Cán bộ kiểm tra thể thức không được tự ký thẩm quyền văn bản (Format Checker != Signer).",
      };
    }
  }

  if (
    action === "document.outgoing.review_content" ||
    action === "document.outgoing.approve_content"
  ) {
    if (
      resource.createdById === user.id ||
      resource.drafterId === user.id ||
      resource.draftingUserId === user.id ||
      resource.primaryOwnerId === user.id
    ) {
      return {
        valid: false,
        rejectionCode: "SOD_VIOLATION",
        reason: "Người soạn thảo không được tự phê duyệt nội dung văn bản đi (Drafter != Content Reviewer).",
      };
    }
  }

  return { valid: true };
}

/**
 * Standalone verification of Portfolio Alignment under QD 420
 */
export function checkPortfolioAlignment(
  user: AuthenticatedUserContext,
  action: CapabilityAction,
  resource: AuthorizationResource
): { valid: boolean; reason?: string } {
  if (!PORTFOLIO_BOUND_ACTIONS.includes(action) || !resource.portfolio) {
    return { valid: true };
  }

  const pos = (user.activePositionCode || "").toUpperCase();
  if (pos === "HIEU_TRUONG" || pos === "BGH_HT" || user.systemRole === "RECTOR") {
    return { valid: true };
  }

  const userPortfolios = user.portfolios || [];
  if (userPortfolios.includes(resource.portfolio)) {
    return { valid: true };
  }

  return {
    valid: false,
    reason: `Nhiệm vụ thuộc mảng [${resource.portfolio}], không thuộc mảng phụ trách của người dùng.`,
  };
}
