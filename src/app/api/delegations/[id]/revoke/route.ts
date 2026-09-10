/**
 * API Route: /api/delegations/[id]/revoke
 * POST - Thu hồi hiệu lực văn bản ủy quyền tác nghiệp (Revoke Delegation Grant)
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiContext, requireAuthenticated } from '@/server/api/request-context';
import { apiSuccess, apiError } from '@/server/api/response';
import { ApiError, ForbiddenError, NotFoundError } from '@/server/api/errors';
import { DelegationStatus } from '@prisma/client';
import { loadAuthorizationContext } from '@/server/authorization/authorization-context-service';
import { logAuditEvent, AuditAction, AuditEntityType } from '@/lib/db/audit';
import { authorizationContextCache } from '@/server/authorization/authorization-context-cache';
import { isExecutiveAdministrator } from '@/app/api/delegations/route';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * POST /api/delegations/[id]/revoke
 * Revokes an existing statutory delegation grant.
 * Caller must be the delegator or have executive administration rights.
 * Sets status = REVOKED, revokedAt timestamp, and records audit log.
 */
export async function POST(request: NextRequest, props: RouteParams) {
  let requestId = crypto.randomUUID();
  try {
    const params = await props.params;
    const ctx = await getApiContext(request);
    requestId = ctx.requestId;
    const authUser = requireAuthenticated(ctx);

    const { id } = params;

    if (!id) {
      throw new ApiError(400, 'ID_REQUIRED', 'Thiếu mã định danh ủy quyền (id)');
    }

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

    if (delegation.status === DelegationStatus.REVOKED) {
      return apiSuccess(delegation, {
        requestId,
        status: 200,
      });
    }

    // Check authority: Caller must be the grantor or executive admin
    const authContext = await loadAuthorizationContext(authUser.id);
    const isExecutive = isExecutiveAdministrator(authContext);
    const isDelegator = authUser.id === delegation.grantorAssignment.userId;

    if (!isDelegator && !isExecutive) {
      throw new ForbiddenError(
        'Chỉ người ủy quyền hoặc Ban Giám hiệu / Quản trị viên mới có quyền thu hồi ủy quyền'
      );
    }

    // Read reason if provided
    let reason: string | undefined;
    try {
      const body = await request.json();
      if (body && typeof body.reason === 'string') {
        reason = body.reason.trim();
      }
    } catch {
      // Body is optional
    }

    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.delegationGrant.update({
        where: { id },
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
        actorId: authUser.id,
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

    return apiSuccess(updated, { requestId, status: 200 });
  } catch (error: any) {
    return apiError(error, requestId);
  }
}
