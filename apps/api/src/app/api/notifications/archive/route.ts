import { NextRequest } from 'next/server';
import { NotificationArchiveSchema } from '@qcet/contracts/notifications';
import { getApiContext, requireAuthenticated } from '@/server/api/request-context';
import { apiError, apiSuccess } from '@/server/api/response';
import { parseAndValidateJson } from '@/server/api/validation';
import { assertCsrf } from '@/server/security/csrf';
import { assertRateLimit } from '@/server/security/rate-limit';
import { archiveNotifications, countUnreadNotifications } from '@/server/notifications/notification-inbox-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Lưu trữ / bỏ lưu trữ thông báo của chính người gọi; trả số đã đổi và số chưa đọc mới cho nút Hộp thư. */
export async function POST(request: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    assertCsrf(request);
    const context = await getApiContext(request);
    requestId = context.requestId;
    requireAuthenticated(context);
    const authUser = context.user!;

    await assertRateLimit(authUser.id, 'MUTATION');

    const body = await parseAndValidateJson(request, NotificationArchiveSchema);
    const count = await archiveNotifications(authUser.id, body);
    const unreadCount = await countUnreadNotifications(authUser.id);

    return apiSuccess({ count, unreadCount }, { requestId });
  } catch (error) {
    return apiError(error, requestId);
  }
}
