import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiContext, requireAuthenticated } from '@/server/api/request-context';
import { apiError, apiSuccess } from '@/server/api/response';
import { NotFoundError, AuthorizationError } from '@/server/api/errors';
import { canReadNotification } from '@/server/policies/notification-policy';
import { toNotificationDTO } from '@/server/dto/notification-dto';
import { assertCsrf } from '@/server/security/csrf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

async function markNotificationAsRead(request: NextRequest, context: RouteContext) {
  let requestId = 'req-notification-read';
  try {
    const apiContext = await getApiContext(request);
    requestId = apiContext.requestId;
    requireAuthenticated(apiContext);
    const authUser = apiContext.user!;

    assertCsrf(request);

    const resolvedParams = await Promise.resolve(context.params);
    const id = resolvedParams?.id?.trim();
    if (!id) {
      throw new NotFoundError('Không tìm thấy thông báo');
    }

    const existing = await prisma.notification.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError('Không tìm thấy thông báo');
    }

    if (!canReadNotification(authUser, existing)) {
      throw new AuthorizationError('Không có quyền thao tác trên thông báo này');
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    const dto = toNotificationDTO(updated);

    return apiSuccess(
      {
        notification: dto,
        data: dto,
      },
      {
        requestId,
        legacyCompat: true,
      }
    );
  } catch (error) {
    return apiError(error, requestId, { legacyCompat: true });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return markNotificationAsRead(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return markNotificationAsRead(request, context);
}
