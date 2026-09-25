/**
 * API Route: /api/organization/bodies
 * GET - Danh sách hội đồng, ban chỉ đạo, tổ công tác
 * POST - Tạo mới hội đồng/ban chỉ đạo
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiContext, requireAuthenticated } from '@/server/api/request-context';
import { apiSuccess, apiError } from '@/server/api/response';
import { CreateOrganizationalBodySchema } from '@/contracts/meeting';
import { logAuditEvent, AuditAction, AuditEntityType } from '@/lib/db/audit';
import { loadAuthorizationContext } from '@/server/authorization/authorization-context-service';
import { assertCanManageOrganizationalBodies } from '@/server/policies';
import { assertCsrf } from '@/server/security/csrf';
import { assertRateLimit } from '@/server/security/rate-limit';
import { parseAndValidateJson } from '@/server/api/validation';

export async function GET(request: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await getApiContext(request);
    requestId = ctx.requestId;
    requireAuthenticated(ctx);

    // Intended visibility (Issue #28): this collection is an institution-
    // internal directory (roster + meeting counts only, no meeting contents).
    // Meeting contents on the detail endpoint additionally require body
    // membership or body-management authority (see bodies/[id] GET).
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as any;
    const status = searchParams.get('status') as any;

    const where: any = {};
    if (type) where.type = type;
    if (status) where.status = status;

    const bodies = await prisma.organizationalBody.findMany({
      where,
      include: {
        memberships: {
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
            positionAssignment: {
              include: {
                positionDefinition: true,
                unit: true,
              },
            },
          },
        },
        _count: {
          select: { meetings: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return apiSuccess(bodies, { requestId, status: 200 });
  } catch (error: any) {
    return apiError(error, requestId);
  }
}

export async function POST(request: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    assertCsrf(request);

    const ctx = await getApiContext(request);
    requestId = ctx.requestId;
    const authUser = requireAuthenticated(ctx);

    await assertRateLimit(authUser.id, 'MUTATIONS_SENSITIVE', {
      requestId,
      endpoint: 'POST /api/organization/bodies',
      userId: authUser.id,
    });

    const authContext = await loadAuthorizationContext(authUser.id);
    assertCanManageOrganizationalBodies(authContext);

    const input = await parseAndValidateJson(request, CreateOrganizationalBodySchema);

    const created = await prisma.organizationalBody.create({
      data: {
        code: input.code,
        name: input.name,
        type: input.type,
        establishedBy: input.establishedBy,
        effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : undefined,
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : undefined,
        status: input.status,
      },
    });

    await logAuditEvent({
      actorId: authUser.id,
      action: AuditAction.ORGANIZATIONAL_BODY_CREATED,
      entityType: AuditEntityType.ORGANIZATIONAL_BODY,
      entityId: created.id,
      requestId,
      afterData: { code: created.code, name: created.name, type: created.type },
    });

    return apiSuccess(created, { requestId, status: 201 });
  } catch (error: any) {
    return apiError(error, requestId);
  }
}
