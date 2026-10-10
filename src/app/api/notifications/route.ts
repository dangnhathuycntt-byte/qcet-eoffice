import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiContext, requireAuthenticated } from '@/server/api/request-context';
import { apiError, apiSuccess } from '@/server/api/response';
import { NotificationQuerySchema } from '@/contracts/notifications';
import { toNotificationDTOArray } from '@/server/dto/notification-dto';
import {
  buildNotificationWhere,
  decodeNotificationCursor,
  encodeNotificationCursor,
} from '@/lib/notification-inbox';
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
      q: searchParams.get('q') ?? undefined,
      triage: searchParams.get('triage') ?? undefined,
      cursor: searchParams.get('cursor') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      pageSize: searchParams.get('limit') ?? searchParams.get('pageSize') ?? undefined,
    });

    const filter = {
      userId: authUser.id,
      unreadOnly: validatedQuery.unreadOnly,
      read: validatedQuery.read,
      category: validatedQuery.category,
      type: validatedQuery.type,
      triage: validatedQuery.triage,
      q: validatedQuery.q,
      cursor: validatedQuery.cursor,
    };
    const usesCursor = Boolean(decodeNotificationCursor(validatedQuery.cursor));

    const [rows, unreadCount, filteredTotal] = await Promise.all([
      prisma.notification.findMany({
        where: buildNotificationWhere(filter),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: validatedQuery.pageSize + 1,
        skip: usesCursor ? 0 : (validatedQuery.page - 1) * validatedQuery.pageSize,
      }),
      prisma.notification.count({
        where: {
          userId: authUser.id,
          isRead: false,
        },
      }),
      prisma.notification.count({ where: buildNotificationWhere(filter, false) }),
    ]);

    const hasMore = rows.length > validatedQuery.pageSize;
    const notifications = hasMore ? rows.slice(0, validatedQuery.pageSize) : rows;
    const last = notifications[notifications.length - 1];
    const nextCursor = hasMore && last ? encodeNotificationCursor(last.createdAt, last.id) : null;

    const dtoList = toNotificationDTOArray(notifications);

    return apiSuccess(
      {
        notifications: dtoList,
        items: dtoList,
        unreadCount,
        total: dtoList.length,
        filteredTotal,
        hasMore,
        nextCursor,
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
  let requestId = crypto.randomUUID();
  try {
    assertCsrf(request);
    const context = await getApiContext(request);
    requestId = context.requestId;
    requireAuthenticated(context);
    const authUser = context.user!;

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
