import { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/jwt-session';
import { apiError, apiSuccess } from '@/server/api/response';
import { AuthenticationError, NotFoundError, ApiError } from '@/server/api/errors';
import { UserContextService } from '@/server/services/user-context-service';

export async function GET(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();
  try {
    const session = getSessionFromRequest(req as any);
    if (!session || !session.id) {
      return apiError(new AuthenticationError('Chưa xác thực người dùng', 'UNAUTHORIZED'), requestId);
    }

    const context = await UserContextService.getUserContext(session.id);
    return apiSuccess(context, {
      requestId,
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (error: any) {
    if (error.message === 'USER_NOT_FOUND') {
      return apiError(new NotFoundError('Không tìm thấy thông tin người dùng'), requestId);
    }
    return apiError(error, requestId);
  }
}
