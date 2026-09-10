/**
 * CANONICAL UNIFIED AUTHORIZATION ENGINE FOR QCET E-OFFICE
 *
 * Specifications & Statutory Basis:
 * - Law on Vocational Education (Luat Giao duc nghe nghiep)
 * - College Charter & Organization Regulation (QD 283/QD-CDKTCNQN)
 * - Executive Work Assignment Regulation (QD 420/QD-CDKTCNQN)
 * - Decree 30/2020/ND-CP on Clerical Works
 * - Decree 13/2023/ND-CP on Personal Data Protection
 * - Law 117/2025/QH15 on State Secret Protection
 *
 * Evaluation Pipeline (Strict 10-step order):
 *  1. Account/session valid?
 *  2. Resource classification allowed?
 *  3. Explicit technical-admin restriction (Separation of Powers)?
 *  4. Direct resource relationship?
 *  5. Position capability?
 *  6. Portfolio responsibility?
 *  7. Organizational scope?
 *  8. Valid delegation?
 *  9. Workflow state?
 * 10. Separation of Duties (Anti-Self-Approval & Role Conflicts)?
 * Default: DENY.
 */

import type { CapabilityAction } from './capability';
import {
  NON_DELEGABLE_CAPABILITIES,
  PORTFOLIO_BOUND_ACTIONS,
  resolveCanonicalCapability,
} from './capability';
import type {
  AuthorizationContext,
  ActivePositionAssignment,
  ActiveDelegationGrant,
} from './authorization-context';
import { SystemRole } from './authorization-context';
import type {
  AuthorizationResource,
  AuthorizationResult,
  AuditRecord,
  DataClassification,
  RejectionCode,
} from './resource';

export type {
  AuthorizationResource,
  AuthorizationResult,
  AuditRecord,
  DataClassification,
  RejectionCode,
};
import {
  SeparationOfPowersError,
  SeparationOfDutiesError,
  PortfolioMismatchError,
  DelegationExpiredError,
  DelegationRevokedError,
  NonDelegablePowerError,
  SingleDRIError,
  InvalidWorkflowStateError,
  StateSecretProhibitionError,
  PersonalDataPrivacyBreachError,
  UnitScopeDeniedError,
  InsufficientCapabilityError,
  AccountDisabledAuthError,
  AccountNotFoundError,
  AuthorizationError,
} from './errors';

// ============================================================================
// HELPERS
// ============================================================================

export function isExecutivePosition(posCode?: string): boolean {
  const code = (posCode || '').toUpperCase();
  return (
    code === 'HIEU_TRUONG' ||
    code === 'PHO_HIEU_TRUONG' ||
    code === 'PHO_HIEU_TRUONG_DT' ||
    code === 'PHO_HIEU_TRUONG_HC' ||
    code === 'BGH' ||
    code === 'BAN_GIAM_HIEU' ||
    code === 'BGH_HT' ||
    code === 'BGH_PHT_DT' ||
    code === 'BGH_PHT_CSVC'
  );
}

export function isUnitLeaderPosition(posCode?: string): boolean {
  const code = (posCode || '').toUpperCase();
  return (
    code === 'TRUONG_DON_VI' ||
    code === 'TRUONG_PHONG' ||
    code === 'TRUONG_KHOA' ||
    code === 'GIAM_DOC_TRUNG_TAM'
  );
}

function isDeputyUnitLeaderPosition(posCode?: string): boolean {
  const code = (posCode || '').toUpperCase();
  return (
    code === 'PHO_TRUONG_DON_VI' ||
    code === 'PHO_TRUONG_PHONG' ||
    code === 'PHO_TRUONG_KHOA' ||
    code === 'PHO_GIAM_DOC_TRUNG_TAM' ||
    code === 'PHO_DON_VI'
  );
}

function isClerkPosition(posCode?: string): boolean {
  const code = (posCode || '').toUpperCase();
  return code === 'VAN_THU' || code === 'CLERK';
}

function isArchivistPosition(posCode?: string): boolean {
  const code = (posCode || '').toUpperCase();
  return code === 'LUU_TRU' || code === 'ARCHIVIST';
}

// ============================================================================
// CANONICAL AUTHORIZE FUNCTION
// ============================================================================

export function authorize(
  context: AuthorizationContext,
  rawAction: CapabilityAction,
  resource?: AuthorizationResource,
  now: Date = new Date()
): AuthorizationResult {
  const action = resolveCanonicalCapability(rawAction);

  const baseAuditRecord: Omit<AuditRecord, 'decision'> = {
    actorId: context?.userId || 'anonymous',
    action,
    resourceType: resource?.type || 'unknown',
    resourceId: resource?.id,
    timestamp: now,
  };

  // --------------------------------------------------------------------------
  // STEP 1: ACCOUNT / SESSION VALIDATION
  // --------------------------------------------------------------------------
  if (!context || !context.userId || !context.user) {
    return {
      allowed: false,
      granted: false,
      rejectionCode: 'UNAUTHENTICATED',
      statusCode: 'UNAUTHENTICATED',
      reason: 'Yêu cầu chưa được xác thực danh tính.',
      auditRecord: {
        ...baseAuditRecord,
        decision: 'DENY',
        rejectionCode: 'UNAUTHENTICATED',
        policyMatched: 'STEP_1_IDENTITY_VERIFICATION',
      },
    };
  }

  if (context.user.isActive === false) {
    return {
      allowed: false,
      granted: false,
      rejectionCode: 'DEACTIVATED_ACCOUNT',
      statusCode: 'DEACTIVATED_ACCOUNT',
      reason: 'Tài khoản người dùng đã bị vô hiệu hóa hoặc tạm khóa.',
      auditRecord: {
        ...baseAuditRecord,
        decision: 'DENY',
        rejectionCode: 'DEACTIVATED_ACCOUNT',
        policyMatched: 'STEP_1_DEACTIVATED_ACCOUNT',
      },
    };
  }

  // --------------------------------------------------------------------------
  // STEP 2: RESOURCE CLASSIFICATION ALLOWED
  // --------------------------------------------------------------------------
  const classification =
    resource?.classification ||
    (resource?.securityLevel as DataClassification | undefined);

  if (
    classification === 'STATE_SECRET' ||
    classification === 'TUYET_MAT' ||
    classification === 'TOI_MAT'
  ) {
    return {
      allowed: false,
      granted: false,
      rejectionCode: 'STATE_SECRET_STRICT_PROHIBITION',
      statusCode: 'STATE_SECRET_STRICT_PROHIBITION',
      reason:
        'Tài liệu thuộc phạm vi Bí mật nhà nước theo Luật 117/2025/QH15; tuyệt đối cấm xử lý, lưu trữ hoặc số hóa trên môi trường mạng thông thường.',
      auditRecord: {
        ...baseAuditRecord,
        decision: 'DENY',
        rejectionCode: 'STATE_SECRET_STRICT_PROHIBITION',
        policyMatched: 'STEP_2_STATE_SECRET_PROHIBITION',
      },
    };
  }

  if (classification === 'MAT' || classification === 'RESTRICTED') {
    const isDirectActor =
      resource &&
      (resource.organizerId === context.userId ||
        resource.participantIds?.includes(context.userId) ||
        resource.chairIds?.includes(context.userId) ||
        resource.secretaryIds?.includes(context.userId) ||
        resource.primaryOwnerId === context.userId ||
        resource.leadUserId === context.userId ||
        resource.creatorId === context.userId ||
        resource.createdById === context.userId ||
        resource.drafterId === context.userId ||
        resource.reviewerIds?.includes(context.userId) ||
        resource.approverIds?.includes(context.userId) ||
        resource.signerId === context.userId ||
        (resource.bodyId &&
          context.bodyMemberships?.some((bm) => bm.bodyId === resource.bodyId)));

    const hasExplicitReadCapability =
      action === 'document.read_restricted' ||
      context.positions.some((p) => p.positionCode === 'HIEU_TRUONG');

    if (!isDirectActor && !hasExplicitReadCapability) {
      const code: RejectionCode =
        classification === 'MAT'
          ? 'STATE_SECRET_STRICT_PROHIBITION'
          : 'CLASSIFICATION_DENIED';
      return {
        allowed: false,
        granted: false,
        rejectionCode: code,
        statusCode: code,
        reason:
          'Tài nguyên được bảo vệ theo cấp độ bảo mật; người dùng không có mối quan hệ trực tiếp hoặc quyền truy cập giới hạn.',
        auditRecord: {
          ...baseAuditRecord,
          decision: 'DENY',
          rejectionCode: code,
          policyMatched: 'STEP_2_CLASSIFICATION_GUARD',
        },
      };
    }
  }

  if (classification === 'PERSONAL' || classification === 'PERSONAL_DATA') {
    const isSubject =
      resource &&
      (resource.targetUserId === context.userId ||
        resource.primaryOwnerId === context.userId ||
        resource.creatorId === context.userId ||
        resource.createdById === context.userId);

    const hasLegalBasis =
      Boolean((resource as Record<string, unknown> | undefined)?.hasConsentOrLegalBasis) ||
      action === 'user.view_sensitive_personal_data';

    if (!isSubject && !hasLegalBasis) {
      return {
        allowed: false,
        granted: false,
        rejectionCode: 'PERSONAL_DATA_PRIVACY_BREACH',
        statusCode: 'PERSONAL_DATA_PRIVACY_BREACH',
        reason:
          'Dữ liệu cá nhân được bảo vệ theo Nghị định 13/2023/NĐ-CP; người dùng không có căn cứ pháp lý hoặc chấp thuận hợp lệ để truy cập.',
        auditRecord: {
          ...baseAuditRecord,
          decision: 'DENY',
          rejectionCode: 'PERSONAL_DATA_PRIVACY_BREACH',
          policyMatched: 'STEP_2_PERSONAL_DATA_PRIVACY',
        },
      };
    }
  }

  // --------------------------------------------------------------------------
  // STEP 3: EXPLICIT TECHNICAL-ADMIN RESTRICTION (SEPARATION OF POWERS)
  // --------------------------------------------------------------------------
  const isSysAdmin =
    context.isSystemAdmin?.() ||
    context.hasSystemRole?.(SystemRole.SYSTEM_ADMIN) ||
    context.systemRoles?.includes(SystemRole.SYSTEM_ADMIN);

  if (isSysAdmin) {
    const isTechnicalAction =
      action.startsWith('system.') ||
      action.startsWith('account.') ||
      action.startsWith('org.') ||
      action.startsWith('position.') ||
      action.startsWith('audit.') ||
      action === 'task.monitor';

    if (!isTechnicalAction) {
      return {
        allowed: false,
        granted: false,
        rejectionCode: 'SEPARATION_OF_POWERS_VIOLATION',
        statusCode: 'SEPARATION_OF_POWERS_VIOLATION',
        reason:
          'Quản trị viên kỹ thuật (SYSTEM_ADMIN) bị nghiêm cấm can thiệp hoặc thực hiện nghiệp vụ quản lý, hồ sơ và văn bản điều hành của Nhà trường.',
        auditRecord: {
          ...baseAuditRecord,
          decision: 'DENY',
          rejectionCode: 'SEPARATION_OF_POWERS_VIOLATION',
          policyMatched: 'STEP_3_SEPARATION_OF_POWERS',
        },
      };
    }

    // Technical action for System Admin is allowed
    return {
      allowed: true,
      granted: true,
      statusCode: 'GRANTED',
      reason: 'Quản trị viên kỹ thuật được phép thực hiện chức năng quản trị hệ thống.',
      auditRecord: {
        ...baseAuditRecord,
        decision: 'ALLOW',
        policyMatched: 'STEP_3_SYSTEM_ADMIN_TECHNICAL_AUTHORITY',
      },
    };
  }

  // Non-admin attempting system administration
  if (
    !isSysAdmin &&
    (action === 'account.manage' ||
      action === 'org.manage' ||
      action === 'position.manage' ||
      action === 'system.configure' ||
      action.startsWith('system.system.'))
  ) {
    return {
      allowed: false,
      granted: false,
      rejectionCode: 'INSUFFICIENT_CAPABILITY',
      statusCode: 'INSUFFICIENT_CAPABILITY',
      reason: 'Hành động quản trị hạ tầng kỹ thuật chỉ dành cho Quản trị viên hệ thống.',
      auditRecord: {
        ...baseAuditRecord,
        decision: 'DENY',
        rejectionCode: 'INSUFFICIENT_CAPABILITY',
        policyMatched: 'STEP_3_NON_ADMIN_INFRASTRUCTURE_GUARD',
      },
    };
  }

  // --------------------------------------------------------------------------
  // STEP 4: DIRECT RESOURCE RELATIONSHIP & ACTOR GUARDS
  // --------------------------------------------------------------------------
  const userId = context.userId;
  let candidateAllowed = false;
  let candidatePolicy = '';
  let candidatePosition: ActivePositionAssignment | undefined;
  let candidateGrant: ActiveDelegationGrant | undefined;

  const isOrganizer = resource?.organizerId === userId;
  const isParticipant =
    resource?.participantIds?.includes(userId) ||
    resource?.organizerId === userId;
  const isChair =
    resource?.chairIds?.includes(userId) ||
    resource?.chairId === userId ||
    Boolean(
      resource?.bodyId &&
        context.bodyMemberships?.some(
          (bm) =>
            bm.bodyId === resource.bodyId &&
            (bm.role === 'CHAIR' || bm.role === 'VICE_CHAIR')
        )
    );
  const isSecretary =
    resource?.secretaryIds?.includes(userId) ||
    resource?.secretaryId === userId ||
    Boolean(
      resource?.bodyId &&
        context.bodyMemberships?.some(
          (bm) => bm.bodyId === resource.bodyId && bm.role === 'SECRETARY'
        )
    );
  const isBodyMember = Boolean(
    resource?.bodyId &&
      (context.bodyMemberships?.some((bm) => bm.bodyId === resource.bodyId) ||
        resource?.bodyMemberIds?.includes(userId))
  );
  const isDRI =
    resource?.primaryOwnerId === userId ||
    resource?.leadUserId === userId ||
    resource?.dossierOwnerId === userId;
  const isCollaborator = resource?.collaboratorIds?.includes(userId);
  const isAssigner =
    resource?.creatorId === userId ||
    resource?.createdById === userId ||
    resource?.assignerId === userId;
  const isDrafter =
    resource?.drafterId === userId ||
    resource?.draftingUserId === userId ||
    resource?.creatorId === userId;
  const isSigner =
    resource?.signerId === userId || resource?.authorizedSignerId === userId;
  const isFollower = resource?.followerIds?.includes(userId);
  const isObserver =
    resource?.observerIds?.includes(userId) ||
    resource?.assigneeIds?.includes(userId);

  // Single DRI Rule: Collaborator cannot reassign DRI
  if (action === 'task.reassign' || action === 'task.assign') {
    const hasExecutive = context.positions?.some((p) => isExecutivePosition(p.positionCode));
    const hasUnitLeader = context.positions?.some((p) => isUnitLeaderPosition(p.positionCode));
    if (isCollaborator && !isAssigner && !isDRI && !hasExecutive && !hasUnitLeader) {
      return {
        allowed: false,
        granted: false,
        rejectionCode: 'COLLABORATOR_CANNOT_REASSIGN_DRI',
        statusCode: 'SINGLE_DRI_VIOLATION',
        reason:
          'Vi phạm quy tắc người chịu trách nhiệm chính duy nhất (Single DRI): Cán bộ phối hợp không có quyền điều chuyển DRI.',
        auditRecord: {
          ...baseAuditRecord,
          decision: 'DENY',
          rejectionCode: 'COLLABORATOR_CANNOT_REASSIGN_DRI',
          policyMatched: 'STEP_4_SINGLE_DRI_COLLABORATOR_GUARD',
        },
      };
    }
  }

  // Observer cannot mutate tasks
  if (
    isObserver &&
    !isDRI &&
    !isCollaborator &&
    !isAssigner &&
    (action === 'task.update_execution' ||
      action === 'task.submit_result' ||
      action === 'task.approve' ||
      action === 'task.reassign' ||
      action === 'task.cancel')
  ) {
    return {
      allowed: false,
      granted: false,
      rejectionCode: 'INSUFFICIENT_RELATIONSHIP',
      statusCode: 'INSUFFICIENT_RELATIONSHIP',
      reason: 'Người theo dõi hoặc quan sát không có quyền thay đổi dữ liệu tác vụ.',
      auditRecord: {
        ...baseAuditRecord,
        decision: 'DENY',
        rejectionCode: 'INSUFFICIENT_RELATIONSHIP',
        policyMatched: 'STEP_4_OBSERVER_READ_ONLY_GUARD',
      },
    };
  }

  // Direct relationship permissions
  if (action === 'meeting.read') {
    if (isOrganizer || isParticipant || isChair || isSecretary || isBodyMember) {
      candidateAllowed = true;
      candidatePolicy = 'STEP_4_MEETING_DIRECT_RELATION';
    }
  } else if (action === 'meeting.create') {
    if (
      isOrganizer ||
      (resource?.bodyId && (isChair || isSecretary))
    ) {
      candidateAllowed = true;
      candidatePolicy = 'STEP_4_MEETING_CREATION_AUTHORITY';
    }
  } else if (action === 'meeting.draft_minutes') {
    if (isSecretary || isChair || isOrganizer) {
      candidateAllowed = true;
      candidatePolicy = 'STEP_4_MEETING_SECRETARY_DRAFT';
    }
  } else if (action === 'meeting.confirm_minutes') {
    if (isChair) {
      candidateAllowed = true;
      candidatePolicy = 'STEP_4_MEETING_CHAIR_CONFIRM';
    }
  } else if (action === 'meeting.create_resolution') {
    if (isChair) {
      candidateAllowed = true;
      candidatePolicy = 'STEP_4_MEETING_CHAIR_RESOLUTION';
    }
  } else if (action === 'meeting.manage_participants' || action === 'meeting.update') {
    if (isOrganizer || isChair) {
      candidateAllowed = true;
      candidatePolicy = 'STEP_4_MEETING_ORGANIZER_OR_CHAIR';
    }
  } else if (action === 'task.read') {
    if (isDRI || isCollaborator || isAssigner || isFollower || isObserver) {
      candidateAllowed = true;
      candidatePolicy = 'STEP_4_TASK_DIRECT_RELATION';
    }
  } else if (action === 'task.update_execution' || action === 'task.submit_result') {
    if (isDRI || isCollaborator || isAssigner) {
      candidateAllowed = true;
      candidatePolicy = 'STEP_4_TASK_EXECUTION';
    }
  } else if (action === 'document.outgoing.draft') {
    if (isDrafter || isAssigner) {
      candidateAllowed = true;
      candidatePolicy = 'STEP_4_DOCUMENT_DRAFT';
    }
  } else if (action === 'document.sign') {
    if (isSigner) {
      candidateAllowed = true;
      candidatePolicy = 'STEP_4_DOCUMENT_SIGNER';
    }
  } else if (
    action === 'dossier.open' ||
    action === 'dossier.add_item' ||
    action === 'dossier.close' ||
    action === 'dossier.transfer_archive'
  ) {
    if (isDRI || isAssigner || resource?.dossierOwnerId === userId) {
      candidateAllowed = true;
      candidatePolicy = 'STEP_4_DOSSIER_OWNER';
    }
  }

  // --------------------------------------------------------------------------
  // STEP 5: POSITION CAPABILITY
  // --------------------------------------------------------------------------
  const positions = context.positions || [];

  for (const pos of positions) {
    const code = pos.positionCode.toUpperCase();

    // HIEU_TRUONG (Rector)
    if (code === 'HIEU_TRUONG' || code === 'BGH_HT') {
      // Clerical prohibitions
      if (
        action === 'document.register' ||
        action === 'document.incoming.register' ||
        action === 'document.incoming.present' ||
        action === 'document.review_format' ||
        action === 'document.assign_number' ||
        action === 'document.organization_sign' ||
        action === 'document.issue' ||
        action === 'document.archive' ||
        action === 'dossier.accept_archive'
      ) {
        return {
          allowed: false,
          granted: false,
          rejectionCode: 'INSUFFICIENT_CAPABILITY',
          statusCode: 'INSUFFICIENT_CAPABILITY',
          reason: 'Nhiệm vụ này thuộc thẩm quyền nghiệp vụ văn thư hoặc lưu trữ cơ quan.',
          auditRecord: {
            ...baseAuditRecord,
            decision: 'DENY',
            rejectionCode: 'INSUFFICIENT_CAPABILITY',
            policyMatched: 'STEP_5_RECTOR_CLERICAL_PROHIBITION',
          },
        };
      }

      if (action === 'document.outgoing.sign_kt' || action === 'document.outgoing.sign_tuq') {
        return {
          allowed: false,
          granted: false,
          rejectionCode: 'INSUFFICIENT_CAPABILITY',
          statusCode: 'INSUFFICIENT_CAPABILITY',
          reason: 'Hiệu trưởng ký số chính thức văn bản, không sử dụng ký thay (KT.) hoặc ký thừa ủy quyền (TUQ.).',
          auditRecord: {
            ...baseAuditRecord,
            decision: 'DENY',
            rejectionCode: 'INSUFFICIENT_CAPABILITY',
            policyMatched: 'STEP_5_RECTOR_SIGN_PROHIBITION',
          },
        };
      }

      candidateAllowed = true;
      candidatePolicy = 'STEP_5_RECTOR_INSTITUTIONAL_AUTHORITY';
      candidatePosition = pos;
      break;
    }

    // PHO_HIEU_TRUONG (Vice Rector)
    if (
      code === 'PHO_HIEU_TRUONG' ||
      code === 'PHO_HIEU_TRUONG_DT' ||
      code === 'PHO_HIEU_TRUONG_HC' ||
      code === 'BGH_PHT_DT' ||
      code === 'BGH_PHT_CSVC'
    ) {
      if (
        action === 'document.register' ||
        action === 'document.incoming.register' ||
        action === 'document.review_format' ||
        action === 'document.assign_number' ||
        action === 'document.organization_sign' ||
        action === 'document.issue' ||
        action === 'document.archive' ||
        action === 'dossier.accept_archive'
      ) {
        return {
          allowed: false,
          granted: false,
          rejectionCode: 'INSUFFICIENT_CAPABILITY',
          statusCode: 'INSUFFICIENT_CAPABILITY',
          reason: 'Nhiệm vụ này thuộc thẩm quyền nghiệp vụ văn thư hoặc lưu trữ cơ quan.',
          auditRecord: {
            ...baseAuditRecord,
            decision: 'DENY',
            rejectionCode: 'INSUFFICIENT_CAPABILITY',
            policyMatched: 'STEP_5_VICE_RECTOR_CLERICAL_PROHIBITION',
          },
        };
      }

      candidateAllowed = true;
      candidatePolicy = 'STEP_5_VICE_RECTOR_AUTHORITY';
      candidatePosition = pos;
      break;
    }

    // TRUONG_DON_VI (Department Head / Dean)
    if (isUnitLeaderPosition(code)) {
      if (
        action === 'task.read' ||
        action === 'task.create' ||
        action === 'task.assign' ||
        action === 'task.reassign' ||
        action === 'task.review' ||
        action === 'task.approve' ||
        action === 'task.monitor' ||
        action === 'task.remind' ||
        action === 'task.close' ||
        action === 'task.cancel' ||
        action === 'document.incoming.assign_person' ||
        action === 'document.incoming.execute' ||
        action === 'document.incoming.file' ||
        action === 'document.file' ||
        action === 'document.outgoing.draft' ||
        action === 'document.review_content' ||
        action === 'document.outgoing.review_content' ||
        action === 'meeting.create' ||
        action === 'meeting.read' ||
        action === 'meeting.create_resolution' ||
        action === 'meeting.manage_participants' ||
        action === 'meeting.update' ||
        action === 'dossier.open' ||
        action === 'dossier.add_item' ||
        action === 'dossier.close' ||
        action === 'dossier.transfer_archive'
      ) {
        candidateAllowed = true;
        candidatePolicy = 'STEP_5_UNIT_LEADER_AUTHORITY';
        candidatePosition = pos;
        break;
      }
    }

    // PHO_TRUONG_DON_VI (Deputy Head)
    if (isDeputyUnitLeaderPosition(code)) {
      if (
        action === 'task.read' ||
        action === 'task.create' ||
        action === 'task.monitor' ||
        action === 'task.remind' ||
        action === 'document.incoming.execute' ||
        action === 'document.outgoing.draft' ||
        action === 'dossier.open'
      ) {
        candidateAllowed = true;
        candidatePolicy = 'STEP_5_DEPUTY_LEADER_BASE_AUTHORITY';
        candidatePosition = pos;
        break;
      }
    }

    // GIANG_VIEN_CHUYEN_VIEN (Staff / Lecturer)
    if (
      code === 'GIANG_VIEN_CHUYEN_VIEN' ||
      code === 'CHUYEN_VIEN' ||
      code === 'GIANG_VIEN' ||
      code === 'VIEN_CHUC'
    ) {
      if (
        action === 'task.read' ||
        action === 'task.create' ||
        action === 'task.monitor' ||
        action === 'document.incoming.execute' ||
        action === 'document.outgoing.draft' ||
        action === 'dossier.open'
      ) {
        candidateAllowed = true;
        candidatePolicy = 'STEP_5_STAFF_BASE_AUTHORITY';
        candidatePosition = pos;
        break;
      }
    }

    // VAN_THU (Clerk)
    if (isClerkPosition(code)) {
      if (
        action === 'document.register' ||
        action === 'document.incoming.register' ||
        action === 'document.incoming.present' ||
        action === 'document.incoming.file' ||
        action === 'document.file' ||
        action === 'document.review_format' ||
        action === 'document.outgoing.review_format' ||
        action === 'document.assign_number' ||
        action === 'document.outgoing.number' ||
        action === 'document.outgoing.assign_number' ||
        action === 'document.organization_sign' ||
        action === 'document.outgoing.organization_sign' ||
        action === 'document.issue' ||
        action === 'document.outgoing.issue' ||
        action === 'document.archive' ||
        action === 'dossier.open' ||
        action === 'dossier.add_item' ||
        action === 'dossier.close' ||
        action === 'dossier.transfer_archive' ||
        action === 'dossier.accept_archive' ||
        action === 'task.read'
      ) {
        candidateAllowed = true;
        candidatePolicy = 'STEP_5_CLERK_OFFICIAL_DUTIES';
        candidatePosition = pos;
        break;
      }

      if (action === 'document.direct' || action === 'document.incoming.direct') {
        return {
          allowed: false,
          granted: false,
          rejectionCode: 'INSUFFICIENT_CAPABILITY',
          statusCode: 'INSUFFICIENT_CAPABILITY',
          reason: 'Cán bộ văn thư không có thẩm quyền cho ý kiến chỉ đạo văn bản đến.',
          auditRecord: {
            ...baseAuditRecord,
            decision: 'DENY',
            rejectionCode: 'INSUFFICIENT_CAPABILITY',
            policyMatched: 'STEP_5_CLERK_CANNOT_DIRECT',
          },
        };
      }
    }

    // LUU_TRU (Archivist)
    if (isArchivistPosition(code)) {
      if (
        action === 'dossier.accept_archive' ||
        action === 'document.archive' ||
        action === 'dossier.open' ||
        action === 'dossier.add_item' ||
        action === 'dossier.close' ||
        action === 'dossier.transfer_archive' ||
        action === 'task.read'
      ) {
        candidateAllowed = true;
        candidatePolicy = 'STEP_5_ARCHIVIST_OFFICIAL_DUTIES';
        candidatePosition = pos;
        break;
      }
    }
  }

  // --------------------------------------------------------------------------
  // STEP 6: PORTFOLIO RESPONSIBILITY BOUNDARY
  // --------------------------------------------------------------------------
  const isPortfolioBound = (PORTFOLIO_BOUND_ACTIONS as readonly string[]).includes(action);
  const resourcePortfolio = resource?.portfolio;
  let portfolioMismatch = false;
  let portfolioMismatchReason = '';

  if (isPortfolioBound && resourcePortfolio) {
    const isRector = positions.some(
      (p) => p.positionCode === 'HIEU_TRUONG' || p.positionCode === 'BGH_HT'
    );

    if (!isRector) {
      const hasMatchingPortfolio =
        context.portfolios?.some(
          (p) =>
            p.responsibilityArea?.code === resourcePortfolio ||
            p.responsibilityAreaId === resourcePortfolio
        ) ||
        context.responsibilityAreas?.some((ra) => ra.code === resourcePortfolio) ||
        context.hasResponsibilityArea?.(resourcePortfolio);

      if (!hasMatchingPortfolio) {
        portfolioMismatch = true;
        portfolioMismatchReason = `Thao tác thuộc mảng công tác [${resourcePortfolio}] nằm ngoài phạm vi phụ trách theo QĐ 420/QĐ-CĐKTCNQN và không có giấy ủy quyền điều hành hợp lệ.`;
      }
    }
  }

  // --------------------------------------------------------------------------
  // STEP 7: ORGANIZATIONAL SCOPE BOUNDARY
  // --------------------------------------------------------------------------
  const isUnitLeader = positions.some((p) => isUnitLeaderPosition(p.positionCode));
  const resourceUnitId =
    resource?.leadUnitId ||
    resource?.draftingUnitId ||
    resource?.unitId ||
    resource?.departmentId;

  let scopeDenied = false;
  let scopeDeniedReason = '';
  let scopeDeniedCode: RejectionCode = 'DEPARTMENT_BOUNDARY_VIOLATION';

  if (isUnitLeader && resourceUnitId) {
    const userUnitIds = new Set([
      ...positions.map((p) => p.unitId),
      ...(context.primaryUnitIds || []),
    ]);

    const isOwnUnit = userUnitIds.has(resourceUnitId);
    const isSchoolWide =
      resource?.scope === 'SCHOOL' || resource?.scope === 'school';
    const isDirectParty =
      isAssigner ||
      isDRI ||
      isDrafter ||
      isChair ||
      isOrganizer ||
      isParticipant ||
      isSecretary ||
      isBodyMember;

    if (
      !isOwnUnit &&
      !isSchoolWide &&
      !isDirectParty &&
      (action.startsWith('meeting.') ||
        action === 'task.assign' ||
        action === 'task.reassign' ||
        action === 'task.approve' ||
        action === 'task.review' ||
        action === 'task.cancel' ||
        action === 'task.close')
    ) {
      scopeDenied = true;
      scopeDeniedCode = 'DEPARTMENT_BOUNDARY_VIOLATION';
      scopeDeniedReason =
        'Trưởng đơn vị chỉ có quyền trong phạm vi đơn vị mình quản lý.';
    }
  }

  // --------------------------------------------------------------------------
  // STEP 8: VALID DELEGATION FALLBACK
  // --------------------------------------------------------------------------
  const delegations = context.delegations || [];

  if (delegations.length > 0) {
    for (const grant of delegations) {
      const matchesAction =
        grant.action === action ||
        grant.action === rawAction ||
        grant.action === '*';

      const matchesPortfolio =
        !resourcePortfolio ||
        !grant.responsibilityArea ||
        grant.responsibilityArea.code === resourcePortfolio;

      let matchesResource = true;
      if (grant.resourceScope === 'SPECIFIC_TASK' && resource?.id) {
        const rule = grant.scopeRules?.find((r) => r.entityType === 'task');
        if (rule && rule.entityId && rule.entityId !== resource.id) {
          matchesResource = false;
        }
      }

      if (matchesAction && matchesPortfolio && matchesResource) {
        // 1. Statutory non-delegable capabilities check
        if ((NON_DELEGABLE_CAPABILITIES as readonly string[]).includes(action)) {
          return {
            allowed: false,
            granted: false,
            rejectionCode: 'NON_DELEGABLE_POWER_VIOLATION',
            statusCode: 'NON_DELEGABLE_POWER_VIOLATION',
            reason: `Thẩm quyền ${action} là quyền luật định tối cao của Hiệu trưởng, tuyệt đối không được chuyển giao qua ủy quyền tác nghiệp.`,
            auditRecord: {
              ...baseAuditRecord,
              decision: 'DENY',
              rejectionCode: 'NON_DELEGABLE_POWER_VIOLATION',
              policyMatched: 'STEP_8_NON_DELEGABLE_POWER',
            },
          };
        }

        // 2. Revocation check
        if (grant.status === 'REVOKED' || grant.revokedAt !== null) {
          return {
            allowed: false,
            granted: false,
            rejectionCode: 'DELEGATION_REVOKED',
            statusCode: 'DELEGATION_REVOKED',
            reason: 'Văn bản ủy quyền đã bị người giao quyền hoặc Hiệu trưởng thu hồi hiệu lực.',
            auditRecord: {
              ...baseAuditRecord,
              decision: 'DENY',
              rejectionCode: 'DELEGATION_REVOKED',
              policyMatched: 'STEP_8_DELEGATION_REVOKED',
            },
          };
        }

        // 3. Timeframe check
        const validFromTime = new Date(grant.validFrom).getTime();
        const validUntilTime = new Date(grant.validUntil).getTime();
        const nowTime = now.getTime();

        if (nowTime > validUntilTime || grant.status === 'EXPIRED') {
          return {
            allowed: false,
            granted: false,
            rejectionCode: 'DELEGATION_EXPIRED',
            statusCode: 'DELEGATION_EXPIRED',
            reason: 'Văn bản ủy quyền tác nghiệp đã hết thời hạn hiệu lực pháp lý.',
            auditRecord: {
              ...baseAuditRecord,
              decision: 'DENY',
              rejectionCode: 'DELEGATION_EXPIRED',
              policyMatched: 'STEP_8_DELEGATION_EXPIRED',
            },
          };
        }

        if (nowTime < validFromTime) {
          return {
            allowed: false,
            granted: false,
            rejectionCode: 'DELEGATION_EXPIRED',
            statusCode: 'DELEGATION_EXPIRED',
            reason: 'Văn bản ủy quyền tác nghiệp chưa đến thời điểm có hiệu lực.',
            auditRecord: {
              ...baseAuditRecord,
              decision: 'DENY',
              rejectionCode: 'DELEGATION_EXPIRED',
              policyMatched: 'STEP_8_DELEGATION_NOT_YET_VALID',
            },
          };
        }

        // Valid delegation grant matched! Overcomes position/scope/portfolio bounds
        candidateAllowed = true;
        candidateGrant = grant;
        candidatePolicy = `STEP_8_DELEGATION_GRANT_${grant.id}`;
        portfolioMismatch = false;
        scopeDenied = false;
        break;
      }
    }
  }

  // If portfolio mismatch occurred and was not overcome by delegation
  if (portfolioMismatch) {
    return {
      allowed: false,
      granted: false,
      rejectionCode: 'PORTFOLIO_MISMATCH',
      statusCode: 'PORTFOLIO_MISMATCH',
      reason: portfolioMismatchReason,
      auditRecord: {
        ...baseAuditRecord,
        decision: 'DENY',
        rejectionCode: 'PORTFOLIO_MISMATCH',
        policyMatched: 'STEP_6_PORTFOLIO_ALIGNMENT_GUARD',
      },
    };
  }

  // If scope denied occurred and was not overcome by delegation
  if (scopeDenied) {
    return {
      allowed: false,
      granted: false,
      rejectionCode: scopeDeniedCode,
      statusCode: scopeDeniedCode,
      reason: scopeDeniedReason,
      auditRecord: {
        ...baseAuditRecord,
        decision: 'DENY',
        rejectionCode: scopeDeniedCode,
        policyMatched: 'STEP_7_UNIT_BOUNDARY_GUARD',
      },
    };
  }

  // If not allowed, check if action requires direct relationship
  if (!candidateAllowed) {
    const isMeetingAction = action.startsWith('meeting.');
    const isTaskAction = action.startsWith('task.');

    if (isMeetingAction) {
      if (action === 'meeting.confirm_minutes') {
        return {
          allowed: false,
          granted: false,
          rejectionCode: 'INSUFFICIENT_CAPABILITY',
          statusCode: 'INSUFFICIENT_CAPABILITY',
          reason: 'Chỉ chủ tọa (Chair) hoặc người có thẩm quyền/được ủy quyền mới có quyền xác nhận biên bản cuộc họp.',
          auditRecord: {
            ...baseAuditRecord,
            decision: 'DENY',
            rejectionCode: 'INSUFFICIENT_CAPABILITY',
            policyMatched: 'STEP_4_MEETING_CHAIR_REQUIRED',
          },
        };
      }
      if (action === 'meeting.create_resolution' || action === 'meeting.publish_resolution') {
        return {
          allowed: false,
          granted: false,
          rejectionCode: 'INSUFFICIENT_CAPABILITY',
          statusCode: 'INSUFFICIENT_CAPABILITY',
          reason: 'Người dùng không có thẩm quyền ban hành quyết nghị/kết luận cuộc họp.',
          auditRecord: {
            ...baseAuditRecord,
            decision: 'DENY',
            rejectionCode: 'INSUFFICIENT_CAPABILITY',
            policyMatched: 'STEP_4_MEETING_RESOLUTION_AUTHORITY_REQUIRED',
          },
        };
      }
      return {
        allowed: false,
        granted: false,
        rejectionCode: 'INSUFFICIENT_RELATIONSHIP',
        statusCode: 'INSUFFICIENT_RELATIONSHIP',
        reason: 'Người dùng không có thẩm quyền hoặc mối quan hệ hợp lệ với cuộc họp để thực hiện thao tác này.',
        auditRecord: {
          ...baseAuditRecord,
          decision: 'DENY',
          rejectionCode: 'INSUFFICIENT_RELATIONSHIP',
          policyMatched: 'STEP_4_MEETING_RELATIONSHIP_REQUIRED',
        },
      };
    }

    if (isTaskAction && action === 'task.read' && resource?.id) {
      return {
        allowed: false,
        granted: false,
        rejectionCode: 'INSUFFICIENT_RELATIONSHIP',
        statusCode: 'INSUFFICIENT_RELATIONSHIP',
        reason: 'Người dùng không có mối quan hệ trực tiếp với nhiệm vụ.',
        auditRecord: {
          ...baseAuditRecord,
          decision: 'DENY',
          rejectionCode: 'INSUFFICIENT_RELATIONSHIP',
          policyMatched: 'STEP_4_TASK_RELATIONSHIP_REQUIRED',
        },
      };
    }

    return {
      allowed: false,
      granted: false,
      rejectionCode: 'INSUFFICIENT_CAPABILITY',
      statusCode: 'INSUFFICIENT_CAPABILITY',
      reason: 'Người dùng không có thẩm quyền thực hiện hành động này.',
      auditRecord: {
        ...baseAuditRecord,
        decision: 'DENY',
        rejectionCode: 'INSUFFICIENT_CAPABILITY',
        policyMatched: 'DEFAULT_DENY',
      },
    };
  }

  // --------------------------------------------------------------------------
  // STEP 9: WORKFLOW STATE PREREQUISITE
  // --------------------------------------------------------------------------
  const status = (resource?.status || '').toUpperCase();

  // Document signing: cannot sign if draft is not approved
  if (
    action === 'document.sign' ||
    action === 'document.outgoing.sign' ||
    action === 'document.outgoing.sign_kt' ||
    action === 'document.outgoing.sign_tuq'
  ) {
    if (status === 'DRAFT' || status === 'REJECTED' || status === 'PENDING_REVIEW') {
      return {
        allowed: false,
        granted: false,
        rejectionCode: 'INVALID_WORKFLOW_STATE',
        statusCode: 'INVALID_WORKFLOW_STATE',
        reason: 'Văn bản chưa được phê duyệt nội dung, không thể ký ban hành.',
        auditRecord: {
          ...baseAuditRecord,
          decision: 'DENY',
          rejectionCode: 'INVALID_WORKFLOW_STATE',
          policyMatched: 'STEP_9_DOC_SIGN_DRAFT_PROHIBITED',
        },
      };
    }
  }

  // Meeting minutes confirmation: meeting must be in MINUTES_DRAFT or HELD
  if (action === 'meeting.confirm_minutes') {
    if (status !== 'MINUTES_DRAFT' && status !== 'HELD') {
      return {
        allowed: false,
        granted: false,
        rejectionCode: 'INVALID_WORKFLOW_STATE',
        statusCode: 'INVALID_WORKFLOW_STATE',
        reason: 'Chỉ có thể xác nhận biên bản khi cuộc họp đang ở trạng thái dự thảo biên bản hoặc đã tổ chức (MINUTES_DRAFT hoặc HELD).',
        auditRecord: {
          ...baseAuditRecord,
          decision: 'DENY',
          rejectionCode: 'INVALID_WORKFLOW_STATE',
          policyMatched: 'STEP_9_MEETING_MINUTES_INVALID_STATE',
        },
      };
    }
  }

  // Meeting draft minutes: meeting must be in HELD or MINUTES_DRAFT
  if (action === 'meeting.draft_minutes') {
    if (status !== 'HELD' && status !== 'MINUTES_DRAFT') {
      return {
        allowed: false,
        granted: false,
        rejectionCode: 'INVALID_WORKFLOW_STATE',
        statusCode: 'INVALID_WORKFLOW_STATE',
        reason: 'Biên bản chỉ được soạn khi cuộc họp đã diễn ra (HELD hoặc MINUTES_DRAFT).',
        auditRecord: {
          ...baseAuditRecord,
          decision: 'DENY',
          rejectionCode: 'INVALID_WORKFLOW_STATE',
          policyMatched: 'STEP_9_MEETING_DRAFT_MINUTES_INVALID_STATE',
        },
      };
    }
  }

  // Meeting resolution: cannot create resolution before allowed state (must be MINUTES_CONFIRMED)
  if (
    action === 'meeting.create_resolution' ||
    action === 'meeting.publish_resolution'
  ) {
    if (status !== 'MINUTES_CONFIRMED') {
      return {
        allowed: false,
        granted: false,
        rejectionCode: 'INVALID_WORKFLOW_STATE',
        statusCode: 'INVALID_WORKFLOW_STATE',
        reason: 'Nghị quyết hoặc kết luận cuộc họp chỉ được ban hành sau khi biên bản cuộc họp đã được xác nhận (MINUTES_CONFIRMED).',
        auditRecord: {
          ...baseAuditRecord,
          decision: 'DENY',
          rejectionCode: 'INVALID_WORKFLOW_STATE',
          policyMatched: 'STEP_9_MEETING_RESOLUTION_INVALID_STATE',
        },
      };
    }
  }

  // Task approval: cannot approve if cancelled or draft
  if (action === 'task.approve') {
    if (status === 'CANCELLED' || status === 'DRAFT') {
      return {
        allowed: false,
        granted: false,
        rejectionCode: 'INVALID_WORKFLOW_STATE',
        statusCode: 'INVALID_WORKFLOW_STATE',
        reason: 'Nhiệm vụ ở trạng thái không thể phê duyệt.',
        auditRecord: {
          ...baseAuditRecord,
          decision: 'DENY',
          rejectionCode: 'INVALID_WORKFLOW_STATE',
          policyMatched: 'STEP_9_TASK_APPROVE_INVALID_STATE',
        },
      };
    }
  }

  // --------------------------------------------------------------------------
  // STEP 10: SEPARATION OF DUTIES (ANTI-SELF-APPROVAL & ROLE CONFLICTS)
  // --------------------------------------------------------------------------
  // Rule 10.1: Drafter != Signer
  if (
    action === 'document.sign' ||
    action === 'document.outgoing.sign' ||
    action === 'document.outgoing.sign_kt' ||
    action === 'document.outgoing.sign_tuq'
  ) {
    if (
      resource?.drafterId === userId ||
      resource?.draftingUserId === userId ||
      (resource?.creatorId === userId && resource?.signerId !== userId)
    ) {
      return {
        allowed: false,
        granted: false,
        rejectionCode: 'SOD_VIOLATION',
        statusCode: 'SOD_VIOLATION',
        reason:
          'Vi phạm nguyên tắc phân lập trách nhiệm (SoD): Cán bộ soạn thảo không được tự ký ban hành văn bản.',
        auditRecord: {
          ...baseAuditRecord,
          decision: 'DENY',
          rejectionCode: 'SOD_VIOLATION',
          policyMatched: 'STEP_10_DRAFTER_NOT_SIGNER',
        },
      };
    }

    // Numberer != Signer
    if (resource?.numbererId === userId) {
      return {
        allowed: false,
        granted: false,
        rejectionCode: 'SOD_VIOLATION',
        statusCode: 'SOD_VIOLATION',
        reason:
          'Vi phạm nguyên tắc phân lập trách nhiệm (SoD): Cán bộ văn thư cấp số không được tự ký số chức danh lãnh đạo.',
        auditRecord: {
          ...baseAuditRecord,
          decision: 'DENY',
          rejectionCode: 'SOD_VIOLATION',
          policyMatched: 'STEP_10_NUMBERER_NOT_SIGNER',
        },
      };
    }

    // Format Reviewer != Signer
    if (resource?.formatReviewerId === userId) {
      return {
        allowed: false,
        granted: false,
        rejectionCode: 'SOD_VIOLATION',
        statusCode: 'SOD_VIOLATION',
        reason:
          'Vi phạm nguyên tắc phân lập trách nhiệm (SoD): Cán bộ kiểm tra thể thức không được tự ký thẩm quyền văn bản.',
        auditRecord: {
          ...baseAuditRecord,
          decision: 'DENY',
          rejectionCode: 'SOD_VIOLATION',
          policyMatched: 'STEP_10_FORMAT_CHECKER_NOT_SIGNER',
        },
      };
    }
  }

  // Rule 10.2: Drafter != Content Reviewer / Approver
  if (
    action === 'document.review_content' ||
    action === 'document.outgoing.review_content' ||
    action === 'document.outgoing.approve_content'
  ) {
    if (
      resource?.drafterId === userId ||
      resource?.draftingUserId === userId ||
      resource?.creatorId === userId
    ) {
      return {
        allowed: false,
        granted: false,
        rejectionCode: 'SOD_VIOLATION',
        statusCode: 'SOD_VIOLATION',
        reason:
          'Vi phạm nguyên tắc phân lập trách nhiệm (SoD): Người soạn thảo không được tự phê duyệt nội dung văn bản đi.',
        auditRecord: {
          ...baseAuditRecord,
          decision: 'DENY',
          rejectionCode: 'SOD_VIOLATION',
          policyMatched: 'STEP_10_DRAFTER_NOT_CONTENT_REVIEWER',
        },
      };
    }
  }

  // Rule 10.3: Creator / Primary Owner != Approver
  if (action === 'task.approve') {
    if (
      resource?.creatorId === userId ||
      resource?.createdById === userId ||
      resource?.primaryOwnerId === userId ||
      resource?.leadUserId === userId
    ) {
      return {
        allowed: false,
        granted: false,
        rejectionCode: 'SOD_VIOLATION',
        statusCode: 'SOD_VIOLATION',
        reason:
          'Vi phạm nguyên tắc phân lập trách nhiệm (SoD): Người tạo lập hoặc người chịu trách nhiệm chính không được tự phê duyệt nhiệm vụ của mình.',
        auditRecord: {
          ...baseAuditRecord,
          decision: 'DENY',
          rejectionCode: 'SOD_VIOLATION',
          policyMatched: 'STEP_10_CREATOR_NOT_APPROVER',
        },
      };
    }
  }

  // Rule 10.4: Executor != Reviewer
  if (action === 'task.review') {
    if (
      resource?.primaryOwnerId === userId ||
      resource?.submittedByUserId === userId ||
      resource?.uploadedById === userId
    ) {
      return {
        allowed: false,
        granted: false,
        rejectionCode: 'SOD_VIOLATION',
        statusCode: 'SOD_VIOLATION',
        reason:
          'Vi phạm nguyên tắc phân lập trách nhiệm (SoD): Cán bộ thực thi hoặc nộp minh chứng không được tự thẩm tra sản phẩm của mình.',
        auditRecord: {
          ...baseAuditRecord,
          decision: 'DENY',
          rejectionCode: 'SOD_VIOLATION',
          policyMatched: 'STEP_10_EXECUTOR_NOT_REVIEWER',
        },
      };
    }
  }

  // Rule 10.5: Signer != Numberer & Signer != Organization Signer
  if (
    action === 'document.assign_number' ||
    action === 'document.outgoing.number' ||
    action === 'document.outgoing.assign_number' ||
    action === 'document.organization_sign' ||
    action === 'document.outgoing.organization_sign'
  ) {
    if (
      resource?.signerId === userId ||
      resource?.authorizedSignerId === userId
    ) {
      return {
        allowed: false,
        granted: false,
        rejectionCode: 'SOD_VIOLATION',
        statusCode: 'SOD_VIOLATION',
        reason:
          'Vi phạm nguyên tắc phân lập trách nhiệm (SoD): Người ký văn bản không được tự cấp số đi hoặc đóng dấu số cơ quan.',
        auditRecord: {
          ...baseAuditRecord,
          decision: 'DENY',
          rejectionCode: 'SOD_VIOLATION',
          policyMatched: 'STEP_10_SIGNER_NOT_NUMBERER',
        },
      };
    }
  }

  // Rule 10.6: Submitter != Archivist
  if (action === 'dossier.accept_archive' || action === 'document.archive') {
    if (
      resource?.submittedByUserId === userId ||
      resource?.dossierOwnerId === userId ||
      resource?.creatorId === userId ||
      resource?.primaryOwnerId === userId
    ) {
      return {
        allowed: false,
        granted: false,
        rejectionCode: 'SOD_VIOLATION',
        statusCode: 'SOD_VIOLATION',
        reason:
          'Vi phạm nguyên tắc phân lập trách nhiệm (SoD): Cán bộ nộp lưu hồ sơ không được tự tiếp nhận hồ sơ vào Lưu trữ cơ quan.',
        auditRecord: {
          ...baseAuditRecord,
          decision: 'DENY',
          rejectionCode: 'SOD_VIOLATION',
          policyMatched: 'STEP_10_SUBMITTER_NOT_ARCHIVIST',
        },
      };
    }
  }

  // --------------------------------------------------------------------------
  // GRANTED
  // --------------------------------------------------------------------------
  return {
    allowed: true,
    granted: true,
    statusCode: 'GRANTED',
    reason: 'Thao tác được chấp thuận theo thẩm quyền vị trí và phân công tác nghiệp.',
    delegationUsed: candidateGrant?.id,
    actingPositionId: candidatePosition?.id,
    auditRecord: {
      ...baseAuditRecord,
      decision: 'ALLOW',
      policyMatched: candidatePolicy || 'CAPABILITY_GRANTED',
    },
    delegationContext: candidateGrant
      ? {
          isDelegated: true,
          delegationGrantId: candidateGrant.id,
          sourceDocument: candidateGrant.sourceDocumentNumber,
          grantorId: candidateGrant.grantorUserId,
        }
      : undefined,
  };
}

// ============================================================================
// CANONICAL ASSERT FUNCTION
// ============================================================================

export function assertAuthorized(
  context: AuthorizationContext,
  action: CapabilityAction,
  resource?: AuthorizationResource,
  now: Date = new Date()
): void {
  const result = authorize(context, action, resource, now);

  if (!result.allowed) {
    const code = result.rejectionCode || 'INSUFFICIENT_CAPABILITY';
    const reason = result.reason || 'Truy cập bị từ chối';

    switch (code) {
      case 'SEPARATION_OF_POWERS_VIOLATION':
        throw new SeparationOfPowersError(reason);
      case 'SOD_VIOLATION':
      case 'SEPARATION_OF_DUTIES_VIOLATION':
        throw new SeparationOfDutiesError(reason);
      case 'PORTFOLIO_MISMATCH':
        throw new PortfolioMismatchError(reason);
      case 'DELEGATION_EXPIRED':
        throw new DelegationExpiredError(reason);
      case 'DELEGATION_REVOKED':
        throw new DelegationRevokedError(reason);
      case 'NON_DELEGABLE_POWER_VIOLATION':
        throw new NonDelegablePowerError(reason);
      case 'COLLABORATOR_CANNOT_REASSIGN_DRI':
      case 'SINGLE_DRI_VIOLATION':
        throw new SingleDRIError(reason);
      case 'INVALID_WORKFLOW_STATE':
        throw new InvalidWorkflowStateError(reason);
      case 'STATE_SECRET_STRICT_PROHIBITION':
        throw new StateSecretProhibitionError(reason);
      case 'PERSONAL_DATA_PRIVACY_BREACH':
        throw new PersonalDataPrivacyBreachError(reason);
      case 'UNIT_SCOPE_DENIED':
      case 'DEPARTMENT_BOUNDARY_VIOLATION':
        throw new UnitScopeDeniedError(reason);
      case 'DEACTIVATED_ACCOUNT':
        throw new AccountDisabledAuthError(reason);
      case 'UNAUTHENTICATED':
        throw new AccountNotFoundError(reason);
      case 'INSUFFICIENT_CAPABILITY':
        throw new InsufficientCapabilityError(action, reason);
      default:
        throw new AuthorizationError(reason, code);
    }
  }
}
