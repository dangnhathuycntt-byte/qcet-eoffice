/**
 * API Route: /api/delegations/[id]/revoke
 * POST - Thu hồi hiệu lực văn bản ủy quyền tác nghiệp (Revoke Delegation Grant)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getApiContext, requireAuthenticated } from '@/server/api/request-context';
import { apiSuccess, apiError } from '@/server/api/response';
import { ApiError, ForbiddenError } from '@/server/api/errors';
import { parseAndValidateJson } from '@/server/api/validation';
import { assertCsrf } from '@/server/security/csrf';
import { loadAuthorizationContext } from '@/server/authorization/authorization-context-service';
import { isExecutiveAdministrator } from '@/server/authorization/delegation-policy';
import {
  loadDelegationGrantForRevoke,
  revokeDelegationGrant,
} from '@/server/authorization/delegation-grant-service';

const RevokeDelegationSchema = z
  .object({
    reason: z.string().trim().optional().nullable(),
  })
  .passthrough();

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
    assertCsrf(request);
    const params = await props.params;
    const ctx = await getApiContext(request);
    requestId = ctx.requestId;
    const authUser = requireAuthenticated(ctx);

    const { id } = params;

    if (!id) {
      throw new ApiError(400, 'ID_REQUIRED', 'Thiếu mã định danh ủy quyền (id)');
    }

    const { delegation, alreadyRevoked } = await loadDelegationGrantForRevoke(id);

    if (alreadyRevoked) {
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
      const body = await parseAndValidateJson(request, RevokeDelegationSchema, { allowEmpty: true });
      if (body && typeof body.reason === 'string') {
        reason = body.reason.trim();
      }
    } catch {
      // Body is optional
    }

    const updated = await revokeDelegationGrant({ delegation, actorId: authUser.id, reason, requestId });

    return apiSuccess(updated, { requestId, status: 200 });
  } catch (error: any) {
    return apiError(error, requestId);
  }
}
