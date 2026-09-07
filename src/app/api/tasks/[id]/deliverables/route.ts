import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { TaskStatus, DeliverableReviewStatus } from '@prisma/client';
import { verifySessionToken, SESSION_COOKIE_NAME, SessionPayload } from '@/lib/jwt-session';

function getSessionPayload(request: NextRequest): SessionPayload | null {
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value || bearerToken;
  if (!token) return null;
  return verifySessionToken(token);
}

interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = getSessionPayload(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id: taskId } = await Promise.resolve(context.params);

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, status: true }
    });

    if (!task) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy nhiệm vụ' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { title, fileUrl, fileType, fileSize, uploadedById } = body;

    if (!title || !fileUrl) {
      return NextResponse.json(
        { success: false, error: 'Tiêu đề và đường dẫn file minh chứng là bắt buộc' },
        { status: 400 }
      );
    }

    const effectiveUserId = uploadedById || session.id || (await prisma.user.findFirst({ select: { id: true } }))?.id;

    const result = await prisma.$transaction(async (tx) => {
      const deliverable = await tx.taskDeliverable.create({
        data: {
          taskId,
          title,
          fileUrl,
          fileType: fileType || 'LINK',
          fileSize: typeof fileSize === 'number' ? fileSize : null,
          uploadedById: effectiveUserId,
          reviewStatus: DeliverableReviewStatus.PENDING
        },
        include: {
          uploadedBy: { select: { id: true, name: true, avatarUrl: true } }
        }
      });

      // Chuyển trạng thái sang WAITING_APPROVAL khi nộp minh chứng nếu task chưa bị hủy
      if (task.status !== TaskStatus.CANCELLED) {
        await tx.task.update({
          where: { id: taskId },
          data: { status: TaskStatus.WAITING_APPROVAL }
        });
      }

      return deliverable;
    });

    return NextResponse.json(
      { success: true, deliverable: result, data: result },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating deliverable:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
