/**
 * API Route: /api/organization/bodies/[id]
 * GET - Chi tiết hội đồng/ban chỉ đạo
 * POST - Thêm thành viên vào hội đồng (CHAIR, VICE_CHAIR, SECRETARY, MEMBER)
 */

import { NextRequest } from 'next/server';
import { getApiContext, requireAuthenticated } from '@/server/api/request-context';
import { apiSuccess, apiError } from '@/server/api/response';
import { AddBodyMembershipSchema } from '@qcet/contracts/meeting';
import { loadAuthorizationContext } from '@/server/authorization/authorization-context-service';
import { assertCanManageOrganizationalBodies, assertCanAppointBodyMember, canManageOrganizationalBodies } from '@/server/policies';
import { assertCsrf } from '@/server/security/csrf';
import { assertRateLimit } from '@/server/security/rate-limit';
import { parseAndValidateJson } from '@/server/api/validation';
import {
  addBodyMembership,
  assertOrganizationalBodyExists,
  getOrganizationalBodyDetail,
} from '@/server/organization/organizational-body-service';

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

    const body = await getOrganizationalBodyDetail(params.id);

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
    assertCsrf(request);

    const params = await props.params;
    const ctx = await getApiContext(request);
    requestId = ctx.requestId;
    const authUser = requireAuthenticated(ctx);

    await assertRateLimit(authUser.id, 'MUTATIONS_SENSITIVE', {
      requestId,
      endpoint: `POST /api/organization/bodies/${params.id}`,
      userId: authUser.id,
    });

    const authContext = await loadAuthorizationContext(authUser.id);
    assertCanManageOrganizationalBodies(authContext);

    await assertOrganizationalBodyExists(params.id);

    const input = await parseAndValidateJson(request, AddBodyMembershipSchema);

    assertCanAppointBodyMember(authContext, input.userId, input.role);

    const membership = await addBodyMembership({
      bodyId: params.id,
      input,
      actorId: authUser.id,
      requestId,
    });

    return apiSuccess(membership, { requestId, status: 201 });
  } catch (error: any) {
    return apiError(error, requestId);
  }
}
