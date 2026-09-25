import { NextRequest } from 'next/server';
import { getApiContext, requireAuthenticated } from '@/server/api/request-context';
import { apiError, apiSuccess } from '@/server/api/response';
import { UserContextService } from '@/server/services/user-context-service';

/**
 * GET /api/me/context
 *
 * INSTITUTIONAL INVARIANT:
 * This endpoint returns a display context DTO strictly for client-side UI rendering
 * (navigation visibility, layout adaptation, scope filtering).
 *
 * CRITICAL SECURITY INVARIANT:
 * Server mutations MUST NEVER trust client-provided context, roles, scopes,
 * or client.availableActions. All server-side mutations and privileged operations
 * MUST independently invoke the canonical authorization engine (AuthorizationContextService,
 * AuthorityResolutionService, and domain policies) with server database truth.
 */
export async function GET(req: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(req);
    requestId = context.requestId;

    const authUser = requireAuthenticated(context);

    // Load canonical authorization context & map to UI response DTO
    const userContext = await UserContextService.getUserContext(authUser.id);

    return apiSuccess(userContext, {
      requestId,
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (error: any) {
    return apiError(error, requestId);
  }
}
