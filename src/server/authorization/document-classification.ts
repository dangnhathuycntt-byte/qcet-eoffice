/**
 * CANONICAL DOCUMENT CLASSIFICATION & ACCESS AUTHORIZATION
 *
 * Statutory Basis & Normative Framework:
 * - Law on Protection of State Secrets (Luật Bảo vệ bí mật nhà nước số 117/2025/QH15):
 *   Strict prohibition of handling, storing, or transmitting state secrets (TUYET_MAT, TOI_MAT, MAT)
 *   on standard civil information networks without approved specialized cryptography/policy.
 * - Decree 30/2020/NĐ-CP on Clerical Works:
 *   Official incoming/outgoing document lifecycle, registration books, executive directives, and access scope.
 * - Decree 13/2023/NĐ-CP on Personal Data Protection:
 *   Strict control over personal data processing (PERSONAL_DATA), requiring legal basis or data subject consent.
 * - College Regulations (QĐ 283/QĐ-CĐKTCNQN & QĐ 420/QĐ-CĐKTCNQN):
 *   Institutional governance, executive portfolio boundaries, unit jurisdictional scopes.
 *
 * Invariants:
 * 1. Default DENY for MAT / TOI_MAT / TUYET_MAT on civil systems.
 * 2. VAN_THU (Clerk) does NOT automatically read MAT/TOI_MAT/TUYET_MAT.
 * 3. SYSTEM_ADMIN does NOT automatically read MAT/TOI_MAT/TUYET_MAT or RESTRICTED documents (Separation of Powers).
 * 4. PUBLIC documents: any active authenticated institution user can access.
 * 5. INTERNAL documents: requires unit membership, institutional leadership, or direct relationship.
 * 6. RESTRICTED / PERSONAL_DATA: requires explicit direct relation, explicit capability, or valid active delegation.
 *    Unit membership alone is NOT enough!
 */

import { DocumentSecurityLevel } from '@prisma/client';
import type {
  AuthorizationContext,
  ActiveDelegationGrant,
  ActivePositionAssignment,
} from './authorization-context';
import { AuthorizationContextModel, SystemRole } from './authorization-context';
import type { AuthenticatedUser } from '@/server/api/request-context';
import { isExecutivePosition } from './authorization-engine';

export type DocumentApplicationClassification =
  | 'PUBLIC'
  | 'INTERNAL'
  | 'RESTRICTED'
  | 'PERSONAL_DATA';

export type DocumentLegalMarking =
  | 'THUONG'
  | 'MAT'
  | 'TOI_MAT'
  | 'TUYET_MAT';

export interface DocumentClassificationTarget {
  id?: string;
  type?: string;
  securityLevel?: DocumentSecurityLevel | string | null;
  classification?: DocumentApplicationClassification | string | null;
  isPublic?: boolean | null;
  scope?: string | null;
  departmentId?: string | null;
  leadDepartmentId?: string | null;
  draftingDeptId?: string | null;
  leadUnitId?: string | null;
  draftingUnitId?: string | null;
  owningUnitId?: string | null;
  unitId?: string | null;
  creatorId?: string | null;
  createdById?: string | null;
  registeredById?: string | null;
  signerId?: string | null;
  signerName?: string | null;
  drafterId?: string | null;
  draftingUserId?: string | null;
  leadUserId?: string | null;
  targetUserId?: string | null;
  primaryOwnerId?: string | null;
  notes?: string | null;
  hasApprovedStatutorySecretPolicy?: boolean;
  hasConsentOrLegalBasis?: boolean;
  directives?: any[] | null;
  incomingWorkflow?: any | null;
  [key: string]: any;
}

export interface DocumentClassificationResolution {
  applicationClassification: DocumentApplicationClassification;
  legalMarking: DocumentLegalMarking;
  isStateSecret: boolean;
}

export interface DocumentClassificationAccessResult {
  allowed: boolean;
  reason: string;
}

/**
 * Resolves application classification and statutory legal markings for a document.
 */
export function resolveDocumentApplicationClassification(
  document: DocumentClassificationTarget
): DocumentClassificationResolution {
  const rawSecurity = (document.securityLevel || '').toString().trim().toUpperCase();
  const rawClassification = (document.classification || '').toString().trim().toUpperCase();
  const rawNotes = (document.notes || '').toString().trim().toUpperCase();
  const scopeUpper = (document.scope || '').toString().trim().toUpperCase();

  let isStateSecret = false;
  let legalMarking: DocumentLegalMarking = 'THUONG';

  if (
    rawSecurity === 'MAT' ||
    rawSecurity === 'TOI_MAT' ||
    rawSecurity === 'TUYET_MAT' ||
    rawClassification === 'MAT' ||
    rawClassification === 'TOI_MAT' ||
    rawClassification === 'TUYET_MAT' ||
    rawClassification === 'STATE_SECRET'
  ) {
    isStateSecret = true;
    if (rawSecurity === 'TUYET_MAT' || rawClassification === 'TUYET_MAT') {
      legalMarking = 'TUYET_MAT';
    } else if (rawSecurity === 'TOI_MAT' || rawClassification === 'TOI_MAT') {
      legalMarking = 'TOI_MAT';
    } else {
      legalMarking = 'MAT';
    }
  }

  let applicationClassification: DocumentApplicationClassification = 'INTERNAL';

  if (rawClassification === 'PUBLIC') {
    applicationClassification = 'PUBLIC';
  } else if (rawClassification === 'RESTRICTED') {
    applicationClassification = 'RESTRICTED';
  } else if (rawClassification === 'PERSONAL_DATA' || rawClassification === 'PERSONAL') {
    applicationClassification = 'PERSONAL_DATA';
  } else if (rawClassification === 'INTERNAL') {
    applicationClassification = 'INTERNAL';
  } else if (rawNotes === 'RESTRICTED' || rawNotes.includes('GIỚI HẠN') || rawNotes.includes('GIOI_HAN')) {
    applicationClassification = 'RESTRICTED';
  } else if (document.isPublic === true || scopeUpper === 'PUBLIC' || scopeUpper === 'SCHOOL') {
    applicationClassification = 'PUBLIC';
  } else {
    // Default for regular non-public documents under THUONG
    applicationClassification = 'INTERNAL';
  }

  return {
    applicationClassification,
    legalMarking,
    isStateSecret,
  };
}

/**
 * Normalizes an AuthenticatedUser or partial context into an AuthorizationContext.
 */
export function normalizeToAuthorizationContext(
  contextOrUser: AuthorizationContext | AuthenticatedUser
): AuthorizationContext {
  if (
    contextOrUser &&
    typeof (contextOrUser as any).hasPosition === 'function' &&
    Array.isArray((contextOrUser as any).positions)
  ) {
    return contextOrUser as AuthorizationContext;
  }

  const user = contextOrUser as AuthenticatedUser;
  const roleUpper = (user?.role || '').toUpperCase();
  const posCode = (user?.positionCode || roleUpper).toUpperCase();
  const isSysAdmin = roleUpper === 'ADMIN';

  const isBgh =
    posCode === 'HIEU_TRUONG' ||
    posCode === 'PHO_HIEU_TRUONG' ||
    roleUpper === 'BAN_GIAM_HIEU' ||
    roleUpper === 'HIEU_TRUONG' ||
    roleUpper === 'PHO_HIEU_TRUONG';

  const isClerk = roleUpper === 'VAN_THU' || roleUpper === 'CLERK' || posCode === 'VAN_THU';
  const isDeptHead = roleUpper === 'MANAGER' || roleUpper === 'TRUONG_PHONG' || posCode === 'TRUONG_PHONG';

  const positions: ActivePositionAssignment[] = [];
  if (user?.id && !isSysAdmin) {
    if (isBgh) {
      positions.push({
        id: `pos_bgh_${user.id}`,
        userId: user.id,
        positionDefinitionId: `def_${posCode}`,
        positionCode: posCode === 'PHO_HIEU_TRUONG' ? 'PHO_HIEU_TRUONG' : 'HIEU_TRUONG',
        positionTitle: user.title || 'Ban Giám hiệu',
        positionLevel: 1,
        isLeadership: true,
        unitId: user.departmentId || 'BGH_UNIT',
        unitCode: 'BGH',
        unitName: 'Ban Giám hiệu',
        unitType: 'BOARD' as any,
        unitStatus: 'ACTIVE' as any,
        type: 'PRIMARY' as any,
        isActing: false,
        effectiveFrom: new Date('2020-01-01'),
        effectiveTo: null,
        status: 'ACTIVE' as any,
        sourceDecisionNumber: 'QD-BGH',
      });
    } else if (isClerk) {
      positions.push({
        id: `pos_clerk_${user.id}`,
        userId: user.id,
        positionDefinitionId: 'def_van_thu',
        positionCode: 'VAN_THU',
        positionTitle: user.title || 'Văn thư',
        positionLevel: 3,
        isLeadership: false,
        unitId: user.departmentId || 'HC_UNIT',
        unitCode: 'HC',
        unitName: 'Hành chính',
        unitType: 'DEPARTMENT' as any,
        unitStatus: 'ACTIVE' as any,
        type: 'PRIMARY' as any,
        isActing: false,
        effectiveFrom: new Date('2020-01-01'),
        effectiveTo: null,
        status: 'ACTIVE' as any,
        sourceDecisionNumber: 'QD-VT',
      });
    } else if (isDeptHead) {
      positions.push({
        id: `pos_head_${user.id}`,
        userId: user.id,
        positionDefinitionId: 'def_truong_phong',
        positionCode: 'TRUONG_PHONG',
        positionTitle: user.title || 'Trưởng phòng',
        positionLevel: 2,
        isLeadership: true,
        unitId: user.departmentId || 'DEPT_UNIT',
        unitCode: 'DEPT',
        unitName: 'Đơn vị',
        unitType: 'DEPARTMENT' as any,
        unitStatus: 'ACTIVE' as any,
        type: 'PRIMARY' as any,
        isActing: false,
        effectiveFrom: new Date('2020-01-01'),
        effectiveTo: null,
        status: 'ACTIVE' as any,
        sourceDecisionNumber: 'QD-TP',
      });
    } else {
      positions.push({
        id: `pos_staff_${user.id}`,
        userId: user.id,
        positionDefinitionId: 'def_staff',
        positionCode: posCode || 'CHUYEN_VIEN',
        positionTitle: user.title || 'Chuyên viên',
        positionLevel: 4,
        isLeadership: false,
        unitId: user.departmentId || 'DEFAULT_UNIT',
        unitCode: 'UNIT',
        unitName: 'Đơn vị',
        unitType: 'DEPARTMENT' as any,
        unitStatus: 'ACTIVE' as any,
        type: 'PRIMARY' as any,
        isActing: false,
        effectiveFrom: new Date('2020-01-01'),
        effectiveTo: null,
        status: 'ACTIVE' as any,
        sourceDecisionNumber: 'QD-CV',
      });
    }
  }

  return new AuthorizationContextModel({
    userId: user?.id || 'anonymous',
    user: {
      id: user?.id || 'anonymous',
      email: user?.email || '',
      name: user?.name || '',
      isActive: true,
    },
    systemRoles: isSysAdmin ? [SystemRole.SYSTEM_ADMIN] : [],
    positions,
    responsibilityAreas: [],
    portfolios: [],
    delegations: [],
    bodyMemberships: [],
    primaryUnitIds: user?.departmentId ? [user.departmentId] : [],
    generatedAt: new Date(),
  });
}

function hasDirectDocumentRelationship(
  userId: string,
  doc: DocumentClassificationTarget
): boolean {
  if (!userId) return false;

  if (doc.creatorId === userId || doc.createdById === userId) return true;
  if (doc.registeredById === userId) return true;
  if (doc.signerId === userId) return true;
  if (doc.drafterId === userId || doc.draftingUserId === userId) return true;
  if (doc.leadUserId === userId) return true;
  if (doc.targetUserId === userId) return true;
  if (doc.primaryOwnerId === userId) return true;

  // Directives matching
  if (Array.isArray(doc.directives)) {
    const matchedDirective = doc.directives.some((d) => {
      if (d.leaderId === userId) return true;
      if (typeof d.collaboratorIds === 'string') {
        const ids = d.collaboratorIds.split(',').map((s: string) => s.trim());
        if (ids.includes(userId)) return true;
      }
      return false;
    });
    if (matchedDirective) return true;
  }

  // Incoming workflow assignments
  if (doc.incomingWorkflow) {
    if (doc.incomingWorkflow.leaderId === userId) return true;
    if (doc.incomingWorkflow.presentedById === userId) return true;
    if (Array.isArray(doc.incomingWorkflow.unitAssignments)) {
      const matchedAssignment = doc.incomingWorkflow.unitAssignments.some((a: any) => {
        if (a.driUserId === userId) return true;
        if (Array.isArray(a.collaboratorUserIds) && a.collaboratorUserIds.includes(userId)) {
          return true;
        }
        return false;
      });
      if (matchedAssignment) return true;
    }
  }

  return false;
}

function hasValidActiveDelegation(
  delegations: ActiveDelegationGrant[] | undefined,
  now: Date,
  documentId?: string
): boolean {
  if (!delegations || delegations.length === 0) return false;

  return delegations.some((d) => {
    if (d.status !== 'ACTIVE') return false;
    if (d.revokedAt !== null) return false;

    const from = d.validFrom instanceof Date ? d.validFrom : new Date(d.validFrom);
    const until = d.validUntil instanceof Date ? d.validUntil : new Date(d.validUntil);
    if (now < from || now > until) return false;

    const action = d.action;
    const isDocReadAction =
      action === 'document.read_restricted' ||
      action === 'document.read' ||
      action === 'document.view' ||
      action === '*';

    if (!isDocReadAction) return false;

    if (documentId && Array.isArray(d.scopeRules) && d.scopeRules.length > 0) {
      const docMatch = d.scopeRules.some(
        (r) => !r.entityId || r.entityId === documentId
      );
      if (!docMatch) return false;
    }

    return true;
  });
}

function extractDocumentUnitIds(doc: DocumentClassificationTarget): string[] {
  const units: string[] = [];
  // Phase 9: chỉ còn `OrganizationalUnit` là đơn vị canonical.
  if (doc.leadUnitId) units.push(doc.leadUnitId);
  if (doc.draftingUnitId) units.push(doc.draftingUnitId);
  if (doc.owningUnitId) units.push(doc.owningUnitId);
  if (doc.unitId) units.push(doc.unitId);

  if (Array.isArray(doc.directives)) {
    for (const d of doc.directives) {
      // Bút phê không còn cột đơn vị; đơn vị nhận chỉ đạo là đơn vị của nhiệm vụ
      // được sinh ra (đọc trực tiếp trên linkedTask nếu có).
      if (d?.leadUnitId) units.push(d.leadUnitId);
      else if (d?.linkedTask?.leadUnitId) units.push(d.linkedTask.leadUnitId);
    }
  }

  if (doc.incomingWorkflow) {
    if (doc.incomingWorkflow.leadUnitId) units.push(doc.incomingWorkflow.leadUnitId);
    if (Array.isArray(doc.incomingWorkflow.unitAssignments)) {
      for (const a of doc.incomingWorkflow.unitAssignments) {
        if (a.unitId) units.push(a.unitId);
      }
    }
  }

  return units;
}

/**
 * Evaluates whether the given AuthorizationContext has permission to access
 * the document under the canonical classification authorization model (F15).
 */
export function canAccessClassification(
  contextOrUser: AuthorizationContext | AuthenticatedUser,
  document: DocumentClassificationTarget,
  now: Date = new Date()
): DocumentClassificationAccessResult {
  // 1. Identity & Active Context Validation
  if (!contextOrUser) {
    return { allowed: false, reason: 'Yêu cầu chưa được xác thực danh tính.' };
  }

  const context = normalizeToAuthorizationContext(contextOrUser);

  if (!context.userId || !context.user) {
    return { allowed: false, reason: 'Yêu cầu chưa được xác thực danh tính.' };
  }

  if (context.user.isActive === false) {
    return { allowed: false, reason: 'Tài khoản người dùng đã bị vô hiệu hóa hoặc tạm khóa.' };
  }

  if (!document) {
    return { allowed: false, reason: 'Tài nguyên văn bản không tồn tại.' };
  }

  const { applicationClassification, isStateSecret } =
    resolveDocumentApplicationClassification(document);

  // 2. State Secret Prohibition (Luật 117/2025/QH15 - Default DENY)
  // Strict prohibition on regular civil systems unless approved statutory secret policy
  if (isStateSecret) {
    if (document.hasApprovedStatutorySecretPolicy !== true) {
      return {
        allowed: false,
        reason:
          'Tài liệu mang dấu mật (MAT/TOI_MAT/TUYET_MAT) theo Luật 117/2025/QH15; tuyệt đối cấm xử lý trên hệ thống thông tin thông thường khi chưa có chính sách đặc thù được phê duyệt.',
      };
    }
  }

  const isSysAdmin =
    context.isSystemAdmin?.() ||
    context.hasSystemRole?.(SystemRole.SYSTEM_ADMIN) ||
    context.systemRoles?.includes(SystemRole.SYSTEM_ADMIN);

  const hasDirectRelation = hasDirectDocumentRelationship(context.userId, document);

  // 3. Technical Admin Restriction (Separation of Powers)
  // SYSTEM_ADMIN cannot access operational/governance documents without specific business relationship
  if (isSysAdmin && !hasDirectRelation && context.positions.length === 0) {
    if (applicationClassification !== 'PUBLIC') {
      return {
        allowed: false,
        reason:
          'Quản trị viên kỹ thuật (SYSTEM_ADMIN) không có thẩm quyền nghiệp vụ truy cập văn bản nội bộ hoặc giới hạn.',
      };
    }
  }

  // 4. PUBLIC Classification: accessible to all active institution users
  if (applicationClassification === 'PUBLIC') {
    return {
      allowed: true,
      reason: 'Văn bản công khai hoặc toàn trường được phép truy cập.',
    };
  }

  // 5. RESTRICTED & PERSONAL_DATA Classification
  // Strictly requires: direct relationship OR explicit capability OR valid delegation.
  // Unit membership alone is NOT enough!
  if (
    applicationClassification === 'RESTRICTED' ||
    applicationClassification === 'PERSONAL_DATA'
  ) {
    if (hasDirectRelation) {
      return {
        allowed: true,
        reason: 'Người dùng có mối quan hệ trực tiếp với văn bản giới hạn/dữ liệu cá nhân.',
      };
    }

    if (hasValidActiveDelegation(context.delegations, now, document.id)) {
      return {
        allowed: true,
        reason: 'Người dùng có ủy quyền hợp lệ để tiếp cận văn bản giới hạn.',
      };
    }

    // Institutional head (HIEU_TRUONG) has statutory institutional supervision
    const isRector = context.positions.some((p) => p.positionCode === 'HIEU_TRUONG');
    if (isRector) {
      return {
        allowed: true,
        reason: 'Hiệu trưởng có thẩm quyền giám sát toàn bộ văn bản của Nhà trường.',
      };
    }

    if (
      applicationClassification === 'PERSONAL_DATA' &&
      document.hasConsentOrLegalBasis === true
    ) {
      return {
        allowed: true,
        reason: 'Có căn cứ pháp lý hoặc chấp thuận hợp lệ theo Nghị định 13/2023/NĐ-CP.',
      };
    }

    return {
      allowed: false,
      reason:
        'Văn bản giới hạn (RESTRICTED/PERSONAL_DATA) yêu cầu mối quan hệ trực tiếp, thẩm quyền được giao hoặc ủy quyền hợp lệ; thành viên đơn vị không đương nhiên được truy cập.',
    };
  }

  // 6. INTERNAL Classification
  // Requires: direct relationship OR unit membership OR executive leadership OR valid delegation
  if (applicationClassification === 'INTERNAL') {
    if (hasDirectRelation) {
      return {
        allowed: true,
        reason: 'Người dùng có mối quan hệ trực tiếp với văn bản nội bộ.',
      };
    }

    if (hasValidActiveDelegation(context.delegations, now, document.id)) {
      return {
        allowed: true,
        reason: 'Người dùng có ủy quyền hợp lệ.',
      };
    }

    // Institutional executive leadership (HIEU_TRUONG, PHO_HIEU_TRUONG)
    const isExecutive = context.positions.some((p) => isExecutivePosition(p.positionCode));
    if (isExecutive) {
      return {
        allowed: true,
        reason: 'Lãnh đạo Nhà trường có quyền giám sát văn bản nội bộ.',
      };
    }

    // Clerical staff (Văn thư) with registry duties
    const isClerk = context.positions.some(
      (p) => p.positionCode === 'VAN_THU' || p.positionCode === 'CLERK'
    );
    if (isClerk) {
      return {
        allowed: true,
        reason: 'Cán bộ văn thư có thẩm quyền vào sổ đăng ký và tiếp nhận văn bản.',
      };
    }

    // Unit membership check (Organizational Scope)
    const userUnitIds = new Set<string>();
    for (const u of context.primaryUnitIds || []) {
      userUnitIds.add(u);
    }
    for (const p of context.positions || []) {
      if (p.unitId) userUnitIds.add(p.unitId);
    }
    if ((context.user as any)?.departmentId) {
      userUnitIds.add((context.user as any).departmentId);
    }

    const docUnitIds = extractDocumentUnitIds(document);
    const hasUnitMatch = docUnitIds.some((uId) => userUnitIds.has(uId));

    if (hasUnitMatch) {
      return {
        allowed: true,
        reason: 'Người dùng thuộc đơn vị xử lý hoặc phối hợp văn bản nội bộ.',
      };
    }

    return {
      allowed: false,
      reason:
        'Văn bản nội bộ chỉ cho phép truy cập trong phạm vi đơn vị xử lý, lãnh đạo phụ trách hoặc người có liên quan trực tiếp.',
    };
  }

  return {
    allowed: false,
    reason: 'Không đủ điều kiện truy cập tài nguyên văn bản.',
  };
}
