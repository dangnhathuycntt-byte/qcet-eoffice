import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/jwt-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = getSessionFromRequest(request);
    if (!session?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await Promise.resolve(context.params);
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing notification id' },
        { status: 400 }
      );
    }

    const existing = await prisma.notification.findUnique({
      where: { id },
    });

    if (!existing || existing.userId !== session.id) {
      return NextResponse.json(
        { success: false, error: 'Notification not found' },
        { status: 404 }
      );
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      notification: updated,
    });
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
