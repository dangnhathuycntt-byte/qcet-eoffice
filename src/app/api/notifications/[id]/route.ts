import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiContext, requireAuthenticated } from '@/server/api/request-context';
import { apiError, apiSuccess } from '@/server/api/response';
import { NotFoundError } from '@/server/api/errors';
import { canReadNotification } from '@/server/policies/notification-policy';
import { toNotificationDTO } from '@/server/dto/notification-dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  let requestId = 'req-notification-detail';
  try {
    const apiContext = await getApiContext(request);
    requestId = apiContext.requestId;
    requireAuthenticated(apiContext);
    const authUser = apiContext.user!;

    const { id } = await Promise.resolve(context.params);
    const trimmedId = id?.trim();
    if (!trimmedId) throw new NotFoundError('Không tìm thấy thông báo');

    const notification = await prisma.notification.findUnique({ where: { id: trimmedId } });
    // Thông báo của người khác trả cùng lỗi với thông báo không tồn tại để không lộ sự tồn tại.
    if (!notification || !canReadNotification(authUser, notification)) {
      throw new NotFoundError('Không tìm thấy thông báo');
    }

    const dto = toNotificationDTO(notification);
    return apiSuccess(
      { notification: dto, data: dto },
      {
        requestId,
        headers: { 'Cache-Control': 'private, no-store' },
        legacyCompat: true,
      }
    );
  } catch (error) {
    return apiError(error, requestId, { legacyCompat: true });
  }
}
