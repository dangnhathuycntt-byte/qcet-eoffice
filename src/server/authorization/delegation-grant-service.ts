/**
 * Văn bản ủy quyền tác nghiệp (Delegation Grant): liệt kê theo phạm vi, thiết lập, thu hồi.
 * Dùng cho /api/delegations và /api/delegations/[id]/revoke.
 */

import { prisma } from '@/lib/prisma';
import { ApiError, ForbiddenError, NotFoundError, ValidationError } from '@/server/api/errors';
import { DelegationStatus, AssignmentStatus, Prisma } from '@prisma/client';
import { loadAuthorizationContext } from '@/server/authorization/authorization-context-service';
import {
  isExecutiveAdministrator,
  isNonDelegableAction,
} from '@/server/authorization/delegation-policy';
import { logAuditEvent, AuditAction, AuditEntityType } from '@/lib/db/audit';
import { authorizationContextCache } from '@/server/authorization/authorization-context-cache';

const ASSIGNMENT_INCLUDE = {
  user: { select: { id: true, name: true, email: true, role: true } },
  unit: { select: { id: true, name: true, code: true } },
  positionDefinition: { select: { id: true, title: true, code: true } },
} as const;

const DELEGATION_INCLUDE = {
  grantorAssignment: { include: ASSIGNMENT_INCLUDE },
  granteeAssignment: { include: ASSIGNMENT_INCLUDE },
  responsibilityArea: true,
} as const;

/**
 * Tìm quyết định phân công còn hiệu lực: theo id (hoặc positionDefinitionId kèm user), theo user,
 * hoặc `fallbackUserId` khi không chỉ định gì.
 */
async function resolveAssignment(assignmentId?: string | null, userId?: string | null, fallbackUserId?: string) {
  const include = { user: true, unit: true, positionDefinition: true } as const;
  if (assignmentId) {
    const byId = await prisma.positionAssignment.findUnique({ where: { id: assignmentId }, include });
    if (byId || !userId) return byId;
    return prisma.positionAssignment.findFirst({
      where: { userId, positionDefinitionId: assignmentId, status: 'ACTIVE' },
      include,
    });
  }
  const targetUserId = userId || fallbackUserId;
  if (!targetUserId) return null;
  return prisma.positionAssignment.findFirst({ where: { userId: targetUserId, status: 'ACTIVE' }, include });
}

/**
 * Danh sách văn bản ủy quyền theo `status` (mặc định ACTIVE, `ALL` = mọi trạng thái), `userId`, `unitId`.
 * Người không thuộc cấp điều hành chỉ thấy ủy quyền của mình hoặc đơn vị mình; tham số ngoài phạm vi → 403.
 */
export async function listDelegationGrants({
  actorId,
  isExecutive,
  status: statusParam,
  userId: userIdParam,
  unitId: unitIdParam,
}: {
  actorId: string;
  isExecutive: boolean;
  status: string | null;
  userId: string | null;
  unitId: string | null;
}) {
  // Visibility policy (Issue #28, corrective review): non-executive callers
  // see delegations involving themselves OR their own organizational units
  // (self + own-unit scope). `User.departmentId` references the Department
  // table while delegation assignments reference OrganizationalUnit, so the
  // authorized unit scope is resolved ONCE here from the caller's active
  // PositionAssignments (OrganizationalUnit id-space) and reused for the
  // default listing and for every `unitId` query filter below.
  // Client-controlled params may only intersect/narrow this scope.
  let allowedUnitIds: string[] = [];
  if (!isExecutive) {
    const ownAssignments = await prisma.positionAssignment.findMany({
      where: { userId: actorId, status: AssignmentStatus.ACTIVE },
      select: { unitId: true },
    });
    allowedUnitIds = [...new Set(ownAssignments.map((a) => a.unitId))];
  }

  const where: Prisma.DelegationGrantWhereInput = {};

  if (statusParam) {
    if (statusParam !== 'ALL') {
      where.status = statusParam as DelegationStatus;
    }
  } else {
    where.status = DelegationStatus.ACTIVE;
  }

  if (userIdParam) {
    // BOLA guard (Issue #28): client-controlled `userId` must only narrow
    // the caller's authorized scope, never widen it. Non-executive callers
    // may only query their own delegations; executive/statutory authority
    // keeps full query capability per policy.
    if (!isExecutive && userIdParam !== actorId) {
      throw new ForbiddenError(
        'Bạn không có quyền liệt kê văn bản ủy quyền của người dùng khác'
      );
    }
    where.OR = [
      { grantorAssignment: { userId: userIdParam } },
      { granteeAssignment: { userId: userIdParam } },
    ];
  } else if (!isExecutive) {
    // Default non-executive scope: self + own organizational units.
    const conditions: Prisma.DelegationGrantWhereInput[] = [
      { grantorAssignment: { userId: actorId } },
      { granteeAssignment: { userId: actorId } },
    ];
    if (allowedUnitIds.length > 0) {
      conditions.push(
        { grantorAssignment: { unitId: { in: allowedUnitIds } } },
        { granteeAssignment: { unitId: { in: allowedUnitIds } } }
      );
    }
    where.OR = conditions;
  }

  if (unitIdParam) {
    // BOLA guard (Issue #28): client-controlled `unitId` must only narrow
    // the already-resolved authorized scope. Non-executive callers may only
    // narrow to one of their own units; any other unit is denied fail-closed.
    if (!isExecutive && !allowedUnitIds.includes(unitIdParam)) {
      throw new ForbiddenError(
        'Bạn không có quyền liệt kê văn bản ủy quyền của đơn vị khác'
      );
    }
    const unitFilter: Prisma.DelegationGrantWhereInput = {
      OR: [
        { grantorAssignment: { unitId: unitIdParam } },
        { granteeAssignment: { unitId: unitIdParam } },
      ],
    };
    if (where.AND) {
      if (Array.isArray(where.AND)) {
        where.AND.push(unitFilter);
      } else {
        where.AND = [where.AND, unitFilter];
      }
    } else {
      where.AND = [unitFilter];
    }
  }

  return prisma.delegationGrant.findMany({
    where,
    include: DELEGATION_INCLUDE,
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Thiết lập ủy quyền từ body đã parse: kiểm tra thẩm quyền bất khả ủy quyền, số văn bản, thời gian
 * hiệu lực, tìm phân công hai bên, chặn tự ủy quyền, rồi mới kiểm quyền người gọi (là người ủy quyền
 * hoặc cấp điều hành). Tạo bản ghi và audit trong cùng transaction; xóa cache quyền sau khi commit.
 */
export async function createDelegationGrant({
  actorId,
  requestId,
  body,
}: {
  actorId: string;
  requestId: string;
  body: Record<string, any>;
}) {
  const {
    grantorAssignmentId,
    grantorUserId,
    grantorId,
    granteeAssignmentId,
    granteeUserId,
    granteeId,
    responsibilityAreaId,
    action,
    resourceScope,
    validFrom,
    validUntil,
    sourceDocumentNumber,
    reason,
  } = body;

  // 1. Resolve and validate action / capabilities
  const rawAction = action || body.capability;
  const rawCapabilities: string[] = Array.isArray(body.capabilities)
    ? body.capabilities
    : (typeof rawAction === 'string' && rawAction.trim() ? [rawAction.trim()] : []);

  if (rawCapabilities.length === 0) {
    throw new ValidationError('Hành vi ủy quyền (action/capabilities) là bắt buộc');
  }

  // 2. Strict Check: Non-delegable capabilities (budget sign-off, disciplinary, etc.)
  for (const cap of rawCapabilities) {
    if (!cap || typeof cap !== 'string' || !cap.trim()) {
      throw new ValidationError('Thẩm quyền ủy quyền không hợp lệ');
    }
    if (isNonDelegableAction(cap)) {
      throw new ApiError(
        403,
        'NON_DELEGABLE_POWER',
        `Thẩm quyền [${cap}] thuộc diện bất khả ủy quyền theo quy định pháp luật và Điều lệ Trường (không được ủy quyền ký duyệt tài chính/ngân sách hoặc xử lý kỷ luật)`
      );
    }
  }

  const resolvedAction = rawCapabilities[0].trim();

  if (!sourceDocumentNumber || typeof sourceDocumentNumber !== 'string' || !sourceDocumentNumber.trim()) {
    throw new ApiError(
      400,
      'SOURCE_DOCUMENT_REQUIRED',
      'Số văn bản / Quyết định ủy quyền (sourceDocumentNumber) là bắt buộc theo Nghị định 30/2020/NĐ-CP'
    );
  }

  if (!validFrom || !validUntil) {
    throw new ValidationError('Thời gian hiệu lực (validFrom, validUntil) là bắt buộc');
  }

  const fromDate = new Date(validFrom);
  const untilDate = new Date(validUntil);

  if (isNaN(fromDate.getTime()) || isNaN(untilDate.getTime())) {
    throw new ValidationError('Định dạng thời gian hiệu lực không hợp lệ');
  }

  if (untilDate.getTime() <= fromDate.getTime()) {
    throw new ApiError(
      400,
      'INVALID_DELEGATION_TIMEFRAME',
      'Thời gian kết thúc ủy quyền (validUntil) phải sau thời gian bắt đầu (validFrom)'
    );
  }

  // 3. Resolve Grantor Assignment
  const targetGrantorAssignmentId =
    grantorAssignmentId || body.delegatorPositionId || body.delegatorAssignmentId;
  const targetGrantorUserId =
    grantorUserId || grantorId || body.delegatorUserId || body.delegatorId;
  // Mặc định lấy quyết định phân công đang hiệu lực của người đang đăng nhập.
  const grantorAssignment = await resolveAssignment(targetGrantorAssignmentId, targetGrantorUserId, actorId);

  if (!grantorAssignment) {
    throw new ApiError(
      400,
      'GRANTOR_ASSIGNMENT_NOT_FOUND',
      'Không tìm thấy quyết định phân công/bổ nhiệm (PositionAssignment) còn hiệu lực của người ủy quyền'
    );
  }

  // 4. Resolve Grantee Assignment
  const targetGranteeAssignmentId =
    granteeAssignmentId || body.delegateePositionId || body.delegateeAssignmentId;
  const targetGranteeUserId =
    granteeUserId || granteeId || body.delegateeUserId || body.delegateeId;
  const granteeAssignment = await resolveAssignment(targetGranteeAssignmentId, targetGranteeUserId);

  if (!granteeAssignment) {
    throw new ApiError(
      400,
      'GRANTEE_ASSIGNMENT_NOT_FOUND',
      'Không tìm thấy quyết định phân công/bổ nhiệm (PositionAssignment) còn hiệu lực của người nhận ủy quyền'
    );
  }

  // 5. Anti-Self-Delegation Guard
  if (grantorAssignment.userId === granteeAssignment.userId) {
    throw new ApiError(
      400,
      'SELF_DELEGATION_PROHIBITED',
      'Không thể tự ủy quyền cho chính mình (Vi phạm nguyên tắc phân lập quyền hạn)'
    );
  }

  // 6. Authority check: Caller must be the delegator or have executive administration rights
  const authContext = await loadAuthorizationContext(actorId);
  const isExecutive = isExecutiveAdministrator(authContext);
  const isDelegator = actorId === grantorAssignment.userId;

  if (!isDelegator && !isExecutive) {
    throw new ForbiddenError(
      'Chỉ người ủy quyền hoặc Ban Giám hiệu / Quản trị viên mới có quyền thiết lập ủy quyền'
    );
  }

  // 7. Execute in transaction with Audit Log
  const result = await prisma.$transaction(async (tx) => {
    const delegation = await tx.delegationGrant.create({
      data: {
        grantorAssignmentId: grantorAssignment.id,
        granteeAssignmentId: granteeAssignment.id,
        responsibilityAreaId: responsibilityAreaId || null,
        action: resolvedAction,
        resourceScope: (resourceScope || 'UNIT').trim(),
        validFrom: fromDate,
        validUntil: untilDate,
        sourceDocumentNumber: sourceDocumentNumber.trim(),
        reason: reason ? String(reason).trim() : null,
        status: DelegationStatus.ACTIVE,
      },
      include: DELEGATION_INCLUDE,
    });

    await logAuditEvent(tx, {
      actorId,
      action: AuditAction.DELEGATION_CREATED,
      entityType: AuditEntityType.DELEGATION_GRANT,
      entityId: delegation.id,
      requestId,
      afterData: {
        grantorAssignmentId: delegation.grantorAssignmentId,
        granteeAssignmentId: delegation.granteeAssignmentId,
        action: delegation.action,
        resourceScope: delegation.resourceScope,
        validFrom: delegation.validFrom.toISOString(),
        validUntil: delegation.validUntil.toISOString(),
        sourceDocumentNumber: delegation.sourceDocumentNumber,
        status: delegation.status,
      },
      metadata: {
        grantorUserId: grantorAssignment.userId,
        granteeUserId: granteeAssignment.userId,
        sourceDocumentNumber: delegation.sourceDocumentNumber,
      },
    });

    return delegation;
  });

  authorizationContextCache.invalidateAuthorizationContextCache(grantorAssignment.userId);
  authorizationContextCache.invalidateAuthorizationContextCache(granteeAssignment.userId);

  return result;
}

/**
 * Văn bản ủy quyền cần thu hồi (kèm phân công hai bên, không kèm lĩnh vực phụ trách);
 * không có → 404. `alreadyRevoked` cho route trả sớm trước khi kiểm quyền.
 */
export async function loadDelegationGrantForRevoke(id: string) {
  const delegation = await prisma.delegationGrant.findUnique({
    where: { id },
    include: {
      grantorAssignment: {
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
          unit: { select: { id: true, name: true, code: true } },
          positionDefinition: { select: { id: true, title: true, code: true } },
        },
      },
      granteeAssignment: {
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
          unit: { select: { id: true, name: true, code: true } },
          positionDefinition: { select: { id: true, title: true, code: true } },
        },
      },
    },
  });

  if (!delegation) {
    throw new NotFoundError('Không tìm thấy văn bản ủy quyền');
  }

  return { delegation, alreadyRevoked: delegation.status === DelegationStatus.REVOKED };
}

type RevocableDelegationGrant = Awaited<ReturnType<typeof loadDelegationGrantForRevoke>>['delegation'];

/** Chuyển sang REVOKED và ghi audit trong cùng transaction; xóa cache quyền hai bên sau khi commit. */
export async function revokeDelegationGrant({
  delegation,
  actorId,
  reason,
  requestId,
}: {
  delegation: RevocableDelegationGrant;
  actorId: string;
  reason: string | undefined;
  requestId: string;
}) {
  const now = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.delegationGrant.update({
      where: { id: delegation.id },
      data: {
        status: DelegationStatus.REVOKED,
        revokedAt: now,
        revokedReason: reason || 'Thu hồi hiệu lực văn bản ủy quyền',
      },
      include: {
        grantorAssignment: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
            unit: { select: { id: true, name: true, code: true } },
            positionDefinition: { select: { id: true, title: true, code: true } },
          },
        },
        granteeAssignment: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
            unit: { select: { id: true, name: true, code: true } },
            positionDefinition: { select: { id: true, title: true, code: true } },
          },
        },
        responsibilityArea: true,
      },
    });

    await logAuditEvent(tx, {
      actorId,
      action: AuditAction.DELEGATION_REVOKED,
      entityType: AuditEntityType.DELEGATION_GRANT,
      entityId: res.id,
      requestId,
      beforeData: {
        status: delegation.status,
        revokedAt: delegation.revokedAt ? delegation.revokedAt.toISOString() : null,
      },
      afterData: {
        status: res.status,
        revokedAt: res.revokedAt ? res.revokedAt.toISOString() : null,
        revokedReason: res.revokedReason,
      },
      metadata: {
        grantorUserId: delegation.grantorAssignment.userId,
        granteeUserId: delegation.granteeAssignment.userId,
        sourceDocumentNumber: delegation.sourceDocumentNumber,
      },
    });

    return res;
  });

  authorizationContextCache.invalidateAuthorizationContextCache(delegation.grantorAssignment.userId);
  authorizationContextCache.invalidateAuthorizationContextCache(delegation.granteeAssignment.userId);

  return updated;
}
