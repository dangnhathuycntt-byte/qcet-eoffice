import { NextRequest } from 'next/server';
import { getApiContext, requireAuthenticated } from '@/server/api/request-context';
import { apiError, apiSuccess } from '@/server/api/response';
import { NotificationQuerySchema } from '@qcet/contracts/notifications';
import { toNotificationDTOArray } from '@/server/dto/notification-dto';
import { listNotificationsForUser } from '@/server/notifications/notification-inbox-service';

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
      archived: searchParams.get('archived') ?? undefined,
      category: searchParams.get('category') ?? undefined,
      type: searchParams.get('type') ?? undefined,
      q: searchParams.get('q') ?? undefined,
      triage: searchParams.get('triage') ?? undefined,
      cursor: searchParams.get('cursor') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      pageSize: searchParams.get('limit') ?? searchParams.get('pageSize') ?? undefined,
    });

    const { notifications, unreadCount, filteredTotal, hasMore, nextCursor } =
      await listNotificationsForUser(authUser.id, validatedQuery);

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

// Đánh dấu tất cả đã đọc: dùng chung xử lý với POST /api/notifications/read-all.
export { POST as PATCH } from './read-all/route';
