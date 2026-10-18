/**
 * API Route: /api/organization/bodies
 * GET - Danh sách hội đồng, ban chỉ đạo, tổ công tác
 * POST - Tạo mới hội đồng/ban chỉ đạo
 */

import { NextRequest } from 'next/server';
import { getApiContext, requireAuthenticated } from '@/server/api/request-context';
import { apiSuccess, apiError } from '@/server/api/response';
import { CreateOrganizationalBodySchema, ListOrganizationalBodiesQuerySchema } from '@qcet/contracts/meeting';
import { loadAuthorizationContext } from '@/server/authorization/authorization-context-service';
import { assertCanManageOrganizationalBodies } from '@/server/policies';
import { assertCsrf } from '@/server/security/csrf';
import { assertRateLimit } from '@/server/security/rate-limit';
import { parseAndValidateJson } from '@/server/api/validation';
import {
  createOrganizationalBody,
  listOrganizationalBodies,
} from '@/server/organization/organizational-body-service';

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
    const query = ListOrganizationalBodiesQuerySchema.parse({
      type: searchParams.get('type') || undefined,
      status: searchParams.get('status') || undefined,
    });

    const bodies = await listOrganizationalBodies(query);

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

    const created = await createOrganizationalBody({
      input,
      actorId: authUser.id,
      requestId,
    });

    return apiSuccess(created, { requestId, status: 201 });
  } catch (error: any) {
    return apiError(error, requestId);
  }
}
