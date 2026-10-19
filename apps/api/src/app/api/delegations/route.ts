/**
 * API Route: /api/delegations
 * GET - Danh sách văn bản ủy quyền tác nghiệp (Delegation Grants)
 * POST - Thiết lập ủy quyền tác nghiệp mới (Statutory Delegation Grant)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getApiContext, requireAuthenticated } from '@/server/api/request-context';
import { apiSuccess, apiError } from '@/server/api/response';
import { parseAndValidateJson } from '@/server/api/validation';
import { assertCsrf } from '@/server/security/csrf';
import { loadAuthorizationContext } from '@/server/authorization/authorization-context-service';
import { isExecutiveAdministrator } from '@/server/authorization/delegation-policy';
import {
  createDelegationGrant,
  listDelegationGrants,
} from '@/server/authorization/delegation-grant-service';
import type { AuthorizationContext } from '@/server/authorization/authorization-context';


const CreateDelegationSchema = z
  .object({
    grantorAssignmentId: z.string().trim().optional().nullable(),
    grantorUserId: z.string().trim().optional().nullable(),
    grantorId: z.string().trim().optional().nullable(),
    delegatorPositionId: z.string().trim().optional().nullable(),
    delegatorAssignmentId: z.string().trim().optional().nullable(),
    delegatorUserId: z.string().trim().optional().nullable(),
    delegatorId: z.string().trim().optional().nullable(),
    granteeAssignmentId: z.string().trim().optional().nullable(),
    granteeUserId: z.string().trim().optional().nullable(),
    granteeId: z.string().trim().optional().nullable(),
    delegateePositionId: z.string().trim().optional().nullable(),
    delegateeAssignmentId: z.string().trim().optional().nullable(),
    delegateeUserId: z.string().trim().optional().nullable(),
    delegateeId: z.string().trim().optional().nullable(),
    responsibilityAreaId: z.string().trim().optional().nullable(),
    action: z.string().trim().optional().nullable(),
    capability: z.string().trim().optional().nullable(),
    capabilities: z.array(z.string()).optional().nullable(),
    resourceScope: z.string().trim().optional().nullable(),
    validFrom: z.any().optional().nullable(),
    validUntil: z.any().optional().nullable(),
    sourceDocumentNumber: z.any().optional().nullable(),
    reason: z.string().trim().optional().nullable(),
  })
  .passthrough();

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

    const delegations = await listDelegationGrants({
      actorId: authUser.id,
      isExecutive,
      status: statusParam,
      userId: userIdParam,
      unitId: unitIdParam,
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
    assertCsrf(request);
    const ctx = await getApiContext(request);
    requestId = ctx.requestId;
    const authUser = requireAuthenticated(ctx);

    const body = (await parseAndValidateJson(request, CreateDelegationSchema)) as Record<string, any>;

    const result = await createDelegationGrant({ actorId: authUser.id, requestId, body });

    return apiSuccess(result, { requestId, status: 201 });
  } catch (error: any) {
    return apiError(error, requestId);
  }
}
