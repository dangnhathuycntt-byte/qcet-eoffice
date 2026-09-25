import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiContext, requireAuthenticated } from '@/server/api/request-context';
import { apiError, apiSuccess } from '@/server/api/response';
import { AuthorizationError } from '@/server/api/errors';
import { parseAndValidateJson } from '@/server/api/validation';
import { TestPushSchema } from '@/contracts/notifications';
import {
  formatTaskPushPayload,
  sendPushNotificationToUser,
  truncatePushText,
} from '@/lib/push-service';
import { assertCsrf } from '@/server/security/csrf';
import { assertRateLimit } from '@/server/security/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    assertCsrf(request);
    const context = await getApiContext(request);
    requestId = context.requestId;
    requireAuthenticated(context);
    const authUser = context.user!;

    // Privileged / Dev-only guard: Reject with 403 if NODE_ENV === 'production' unless caller has ADMIN role
    if (process.env.NODE_ENV === 'production' && authUser.role !== 'ADMIN') {
      throw new AuthorizationError('Tính năng này chỉ khả dụng cho Quản trị viên trong môi trường sản xuất');
    }

    await assertRateLimit(authUser.id, 'PUSH_TEST');

    const body = await parseAndValidateJson(request, TestPushSchema, { allowEmpty: true });

    let safeLinkHref = '/tasks';
    if (body.linkHref) {
      const raw = body.linkHref.trim();
      if (raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\') && !raw.includes('://')) {
        safeLinkHref = raw;
      }
    }

    const payload = formatTaskPushPayload({
      event: 'TASK_ASSIGNED',
      taskId: 'test-push-notification',
      taskTitle: body.title || 'Thử nghiệm chuông thông báo',
      actorName: authUser.name || 'Hệ thống QCET',
      dueDateStr: 'Hôm nay',
      linkHref: safeLinkHref,
    });

    if (body.title) {
      payload.title = truncatePushText(body.title, 35);
    }

    if (body.body) {
      payload.body = truncatePushText(body.body, 90);
    }

    // Record an in-app notification for the user
    const notification = await prisma.notification.create({
      data: {
        userId: authUser.id,
        actorName: authUser.name || 'Hệ thống QCET',
        title: payload.title,
        body: payload.body,
        category: 'task',
        type: 'test',
        linkHref: payload.data.linkHref,
        isRead: false,
      },
    });

    // Send push notification to user's registered active devices
    const result = await sendPushNotificationToUser(authUser.id, payload);

    return apiSuccess(
      {
        result,
        notification,
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
