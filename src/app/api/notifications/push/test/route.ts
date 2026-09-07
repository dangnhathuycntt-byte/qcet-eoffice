import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/jwt-session';
import {
  formatTaskPushPayload,
  sendPushNotificationToUser,
  truncatePushText,
} from '@/lib/push-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);

    const payload = formatTaskPushPayload({
      event: 'TASK_ASSIGNED',
      taskId: 'test-push-notification',
      taskTitle: body?.title || 'Thử nghiệm chuông thông báo',
      actorName: session.name || 'Hệ thống QCET',
      dueDateStr: 'Hôm nay',
      linkHref: body?.linkHref || '/?zone=tasks',
    });

    if (body?.body) {
      payload.body = truncatePushText(body.body, 90);
    }

    // Record an in-app notification for the user
    const notification = await prisma.notification.create({
      data: {
        userId: session.id,
        actorName: session.name || 'Hệ thống QCET',
        title: payload.title,
        body: payload.body,
        category: 'task',
        type: 'test',
        linkHref: payload.data.linkHref,
        isRead: false,
      },
    });

    // Send push notification to user's registered active devices
    const result = await sendPushNotificationToUser(session.id, payload);

    return NextResponse.json({
      success: true,
      result,
      notification,
    });
  } catch (error) {
    console.error('Failed to send test push notification:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
