import { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/jwt-session';
import { apiError, apiSuccess } from '@/server/api/response';
import { AuthenticationError } from '@/server/api/errors';
import { ActionInboxService } from '@/server/services/action-inbox-service';

export async function GET(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();
  try {
    const session = await getSessionFromRequest(req as any);
    if (!session || !session.id) {
      return apiError(new AuthenticationError('Chưa xác thực người dùng', 'UNAUTHORIZED'), requestId);
    }

    const inbox = await ActionInboxService.getActionInbox(session.id);
    return apiSuccess(inbox, {
      requestId,
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (error: any) {
    return apiError(error, requestId);
  }
}
