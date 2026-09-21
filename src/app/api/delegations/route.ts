/**
 * API Route: /api/delegations
 * GET - Danh sách văn bản ủy quyền tác nghiệp (Delegation Grants)
 * POST - Thiết lập ủy quyền tác nghiệp mới (Statutory Delegation Grant)
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiContext, requireAuthenticated } from '@/server/api/request-context';
import { apiSuccess, apiError } from '@/server/api/response';
import { ApiError, ForbiddenError, ValidationError } from '@/server/api/errors';
import { DelegationStatus, AssignmentStatus, Prisma } from '@prisma/client';
import { NON_DELEGABLE_CAPABILITIES } from '@/server/authorization/capability';
import { loadAuthorizationContext } from '@/server/authorization/authorization-context-service';
import { isExecutivePosition } from '@/server/authorization/authorization-engine';
import { logAuditEvent, AuditAction, AuditEntityType } from '@/lib/db/audit';
import { authorizationContextCache } from '@/server/authorization/authorization-context-cache';
import type { AuthorizationContext } from '@/server/authorization/authorization-context';

export function isExecutiveAdministrator(context: AuthorizationContext): boolean {
  if (context.isSystemAdmin() || context.user.role === 'ADMIN') {
    return true;
  }
  if (context.user.role === 'BAN_GIAM_HIEU') {
    return true;
  }
  return context.positions.some((pos) => isExecutivePosition(pos.positionCode));
}

export function isNonDelegableAction(action: string): boolean {
  if (!action) return true;
  const trimmed = action.trim();
  const lower = trimmed.toLowerCase();

  // 1. Statutory non-delegable capabilities
  if ((NON_DELEGABLE_CAPABILITIES as readonly string[]).includes(trimmed)) {
    return true;
  }

  // 2. Budget sign-off & treasury disbursement
  if (
    lower.includes('budget') ||
    lower.includes('finance') ||
    lower.includes('disbursement') ||
    lower.includes('treasury') ||
    lower.includes('chi_tieu') ||
    lower.includes('ngan_sach') ||
    lower.includes('tai_chinh')
  ) {
    return true;
  }

  // 3. Disciplinary actions
  if (
    lower.includes('disciplinary') ||
    lower.includes('ky_luat') ||
    lower.includes('kỷ luật')
  ) {
    return true;
  }

  // 4. Institutional leadership & statutory governance
  if (
    lower.includes('position.manage_leadership') ||
    lower.includes('regulation.institutional_amend') ||
    lower.includes('system.configure') ||
    lower.includes('account.manage')
  ) {
    return true;
  }

  return false;
}

/**
 * GET /api/delegations
 * Lists delegations with optional filtering by status, userId, or unitId.
 */
export async function GET(request: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await getApiContext(request);
    requestId = ctx.requestId;
    const authUser = requireAuthenticated(ctx);

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');
    const userIdParam = searchParams.get('userId');
    const unitIdParam = searchParams.get('unitId');

    const authContext = await loadAuthorizationContext(authUser.id);
    const isExecutive = isExecutiveAdministrator(authContext);

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
        where: { userId: authUser.id, status: AssignmentStatus.ACTIVE },
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
      if (!isExecutive && userIdParam !== authUser.id) {
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
        { grantorAssignment: { userId: authUser.id } },
        { granteeAssignment: { userId: authUser.id } },
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

    const delegations = await prisma.delegationGrant.findMany({
      where,
      include: {
        grantorAssignment: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                departmentId: true,
              },
            },
            unit: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            positionDefinition: {
              select: {
                id: true,
                title: true,
                code: true,
              },
            },
          },
        },
        granteeAssignment: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                departmentId: true,
              },
            },
            unit: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            positionDefinition: {
              select: {
                id: true,
                title: true,
                code: true,
              },
            },
          },
        },
        responsibilityArea: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return apiSuccess(delegations, { requestId, status: 200 });
  } catch (error: any) {
    return apiError(error, requestId);
  }
}

/**
 * POST /api/delegations
 * Creates a statutory delegation grant with strict validation.
 * Caller must be the delegator or have executive administration rights.
 * Non-delegable capabilities (budget sign-off, disciplinary) are strictly blocked.
 */
export async function POST(request: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await getApiContext(request);
    requestId = ctx.requestId;
    const authUser = requireAuthenticated(ctx);

    const body = await request.json();

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
    let grantorAssignment = null;

    if (targetGrantorAssignmentId) {
      grantorAssignment = await prisma.positionAssignment.findUnique({
        where: { id: targetGrantorAssignmentId },
        include: { user: true, unit: true, positionDefinition: true },
      });
      if (!grantorAssignment && targetGrantorUserId) {
        grantorAssignment = await prisma.positionAssignment.findFirst({
          where: {
            userId: targetGrantorUserId,
            positionDefinitionId: targetGrantorAssignmentId,
            status: 'ACTIVE',
          },
          include: { user: true, unit: true, positionDefinition: true },
        });
      }
    } else if (targetGrantorUserId) {
      grantorAssignment = await prisma.positionAssignment.findFirst({
        where: { userId: targetGrantorUserId, status: 'ACTIVE' },
        include: { user: true, unit: true, positionDefinition: true },
      });
    } else {
      // Default to session user's active assignment
      grantorAssignment = await prisma.positionAssignment.findFirst({
        where: { userId: authUser.id, status: 'ACTIVE' },
        include: { user: true, unit: true, positionDefinition: true },
      });
    }

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
    let granteeAssignment = null;

    if (targetGranteeAssignmentId) {
      granteeAssignment = await prisma.positionAssignment.findUnique({
        where: { id: targetGranteeAssignmentId },
        include: { user: true, unit: true, positionDefinition: true },
      });
      if (!granteeAssignment && targetGranteeUserId) {
        granteeAssignment = await prisma.positionAssignment.findFirst({
          where: {
            userId: targetGranteeUserId,
            positionDefinitionId: targetGranteeAssignmentId,
            status: 'ACTIVE',
          },
          include: { user: true, unit: true, positionDefinition: true },
        });
      }
    } else if (targetGranteeUserId) {
      granteeAssignment = await prisma.positionAssignment.findFirst({
        where: { userId: targetGranteeUserId, status: 'ACTIVE' },
        include: { user: true, unit: true, positionDefinition: true },
      });
    }

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
    const authContext = await loadAuthorizationContext(authUser.id);
    const isExecutive = isExecutiveAdministrator(authContext);
    const isDelegator = authUser.id === grantorAssignment.userId;

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
        include: {
          grantorAssignment: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
              unit: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
              positionDefinition: {
                select: {
                  id: true,
                  title: true,
                  code: true,
                },
              },
            },
          },
          granteeAssignment: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
              unit: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
              positionDefinition: {
                select: {
                  id: true,
                  title: true,
                  code: true,
                },
              },
            },
          },
          responsibilityArea: true,
        },
      });

      await logAuditEvent(tx, {
        actorId: authUser.id,
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

    return apiSuccess(result, { requestId, status: 201 });
  } catch (error: any) {
    return apiError(error, requestId);
  }
}
