import { NextRequest } from 'next/server';
import { resolveCurrentSession } from '@/server/auth/current-session';
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
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();
  try {
    // 1. Authenticate and validate session & user against live DB truth
    // Rejects missing/expired/revoked session or deactivated accounts with 401
    const session = await resolveCurrentSession(req);

    // 2. Load canonical authorization context & map to UI response DTO
    const context = await UserContextService.getUserContext(session.userId);

    return apiSuccess(context, {
      requestId,
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (error: any) {
    return apiError(error, requestId);
  }
}
