import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiContext, requireAuthenticated } from '@/server/api/request-context';
import { apiError, apiSuccess } from '@/server/api/response';
import { NotificationQuerySchema } from '@/contracts/notifications';
import { toNotificationDTOArray } from '@/server/dto/notification-dto';
import { assertCsrf } from '@/server/security/csrf';
import { assertRateLimit } from '@/server/security/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let requestId = 'req-notifications';
  try {
    const context = await getApiContext(request);
    requestId = context.requestId;
    requireAuthenticated(context);
    const authUser = context.user!;

    const searchParams = request.nextUrl.searchParams;
    const validatedQuery = NotificationQuerySchema.parse({
      unreadOnly: searchParams.get('unreadOnly') ?? undefined,
      read: searchParams.get('read') ?? undefined,
      category: searchParams.get('category') ?? undefined,
      type: searchParams.get('type') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      pageSize: searchParams.get('limit') ?? searchParams.get('pageSize') ?? undefined,
    });

    const isUnreadFilter =
      validatedQuery.unreadOnly === true || validatedQuery.read === false;

    const whereClause: {
      userId: string;
      isRead?: boolean;
      category?: string;
      type?: string;
    } = {
      userId: authUser.id,
      ...(isUnreadFilter ? { isRead: false } : validatedQuery.read === true ? { isRead: true } : {}),
      ...(validatedQuery.category ? { category: validatedQuery.category } : {}),
      ...(validatedQuery.type ? { type: validatedQuery.type } : {}),
    };

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: validatedQuery.pageSize,
        skip: (validatedQuery.page - 1) * validatedQuery.pageSize,
      }),
      prisma.notification.count({
        where: {
          userId: authUser.id,
          isRead: false,
        },
      }),
    ]);

    const dtoList = toNotificationDTOArray(notifications);

    return apiSuccess(
      {
        notifications: dtoList,
        items: dtoList,
        unreadCount,
        total: dtoList.length,
      },
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

export async function PATCH(request: NextRequest) {
  let requestId = 'req-notifications-patch';
  try {
    const context = await getApiContext(request);
    requestId = context.requestId;
    requireAuthenticated(context);
    const authUser = context.user!;

    assertCsrf(request);
    await assertRateLimit(authUser.id, 'MUTATION');

    const result = await prisma.notification.updateMany({
      where: {
        userId: authUser.id,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return apiSuccess(
      {
        count: result.count,
        updatedCount: result.count,
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
