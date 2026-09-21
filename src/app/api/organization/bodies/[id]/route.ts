/**
 * API Route: /api/organization/bodies/[id]
 * GET - Chi tiết hội đồng/ban chỉ đạo
 * POST - Thêm thành viên vào hội đồng (CHAIR, VICE_CHAIR, SECRETARY, MEMBER)
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiContext, requireAuthenticated } from '@/server/api/request-context';
import { apiSuccess, apiError } from '@/server/api/response';
import { AddBodyMembershipSchema } from '@/contracts/meeting';
import { logAuditEvent, AuditAction } from '@/lib/db/audit';
import { NotFoundError } from '@/server/api/errors';
import { loadAuthorizationContext } from '@/server/authorization/authorization-context-service';
import { assertCanManageOrganizationalBodies, assertCanAppointBodyMember, canManageOrganizationalBodies } from '@/server/policies';

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  let requestId = crypto.randomUUID();
  try {
    const params = await props.params;
    const ctx = await getApiContext(request);
    requestId = ctx.requestId;
    const authUser = requireAuthenticated(ctx);

    const body = await prisma.organizationalBody.findUnique({
      where: { id: params.id },
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
        meetings: {
          orderBy: { startTime: 'desc' },
          take: 10,
        },
      },
    });

    if (!body) {
      throw new NotFoundError('Hội đồng / Ban chỉ đạo không tồn tại');
    }

    // Intended visibility (Issue #28): the body roster is an institution-
    // internal directory visible to any authenticated user, but the recent
    // meetings payload is only disclosed to body members and users with
    // body-management authority. Unaffiliated callers receive the roster
    // with an empty meetings list instead of meeting contents.
    const authContext = await loadAuthorizationContext(authUser.id);
    const isPrivileged =
      canManageOrganizationalBodies(authContext) ||
      body.memberships.some((m) => m.userId != null && m.userId === authUser.id);

    if (!isPrivileged) {
      const { meetings: _withheld, ...roster } = body;
      return apiSuccess({ ...roster, meetings: [] }, { requestId, status: 200 });
    }

    return apiSuccess(body, { requestId, status: 200 });
  } catch (error: any) {
    return apiError(error, requestId);
  }
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  let requestId = crypto.randomUUID();
  try {
    const params = await props.params;
    const ctx = await getApiContext(request);
    requestId = ctx.requestId;
    const authUser = requireAuthenticated(ctx);

    const authContext = await loadAuthorizationContext(authUser.id);
    assertCanManageOrganizationalBodies(authContext);

    const existingBody = await prisma.organizationalBody.findUnique({
      where: { id: params.id },
      select: { id: true },
    });
    if (!existingBody) {
      throw new NotFoundError('Hội đồng / Ban chỉ đạo không tồn tại');
    }

    const reqBody = await request.json();
    const input = AddBodyMembershipSchema.parse(reqBody);

    assertCanAppointBodyMember(authContext, input.userId, input.role);

    const membership = await prisma.bodyMembership.create({
      data: {
        bodyId: params.id,
        userId: input.userId,
        positionAssignmentId: input.positionAssignmentId,
        role: input.role,
        appointedAt: input.appointedAt ? new Date(input.appointedAt) : undefined,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      },
    });

    await logAuditEvent({
      actorId: authUser.id,
      action: AuditAction.USER_ROLE_CHANGED,
      entityType: 'BodyMembership',
      entityId: membership.id,
      requestId,
      afterData: { bodyId: params.id, userId: input.userId, role: input.role },
    });

    return apiSuccess(membership, { requestId, status: 201 });
  } catch (error: any) {
    return apiError(error, requestId);
  }
}
