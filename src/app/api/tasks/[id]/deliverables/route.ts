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

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = getSessionPayload(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id: taskId } = await Promise.resolve(context.params);
    const body = await request.json();
    const { deliverableId, reviewStatus, reviewNote } = body;

    if (!deliverableId || !reviewStatus) {
      return NextResponse.json(
        { success: false, error: 'deliverableId và reviewStatus là bắt buộc' },
        { status: 400 }
      );
    }

    const deliverable = await prisma.taskDeliverable.findUnique({
      where: { id: deliverableId },
      include: {
        task: {
          include: {
            assignees: true,
          }
        }
      }
    });

    if (!deliverable || deliverable.taskId !== taskId) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy minh chứng cho nhiệm vụ này' },
        { status: 404 }
      );
    }

    // Separation of Duties (SoD):
    // 1. Submitter cannot approve their own deliverable
    if (deliverable.uploadedById === session.id) {
      return NextResponse.json(
        { success: false, error: 'Người nộp minh chứng không thể tự duyệt minh chứng của chính mình (Vi phạm Separation of Duties)' },
        { status: 403 }
      );
    }

    // 2. Reviewer must have authority (BAN_GIAM_HIEU, ADMIN, or TRUONG_PHONG of the task department, or task creator)
    const isPrivileged = ['BAN_GIAM_HIEU', 'ADMIN'].includes(session.role);
    const isDepartmentLeader =
      session.role === 'TRUONG_PHONG' &&
      Boolean(session.departmentId && deliverable.task.departmentId === session.departmentId);
    const isTaskCreator = deliverable.task.createdById === session.id;

    if (!isPrivileged && !isDepartmentLeader && !isTaskCreator) {
      return NextResponse.json(
        { success: false, error: 'Bạn không có thẩm quyền nghiệm thu minh chứng này' },
        { status: 403 }
      );
    }

    const validStatus =
      reviewStatus === 'APPROVED' ? DeliverableReviewStatus.APPROVED :
      (reviewStatus === 'REJECTED' || reviewStatus === 'REVISION_REQUIRED') ? DeliverableReviewStatus.REVISION_REQUIRED :
      DeliverableReviewStatus.PENDING;

    const result = await prisma.$transaction(async (tx) => {
      const updatedDeliverable = await tx.taskDeliverable.update({
        where: { id: deliverableId },
        data: {
          reviewStatus: validStatus,
          reviewNote: reviewNote || null,
          reviewerId: session.id,
          reviewedAt: new Date(),
        },
        include: {
          uploadedBy: { select: { id: true, name: true, avatarUrl: true } },
          reviewer: { select: { id: true, name: true, avatarUrl: true } },
        }
      });

      if (validStatus === DeliverableReviewStatus.APPROVED) {
        // Check if all deliverables for this task are approved
        const allDeliverables = await tx.taskDeliverable.findMany({
          where: { taskId }
        });
        const allApproved = allDeliverables.every(d => d.id === deliverableId || d.reviewStatus === DeliverableReviewStatus.APPROVED);

        if (allApproved) {
          await tx.task.update({
            where: { id: taskId },
            data: {
              status: TaskStatus.COMPLETED,
              progressPercent: 100,
              completedAt: new Date(),
            }
          });
        }
      } else if (validStatus === DeliverableReviewStatus.REVISION_REQUIRED) {
        // Deliverable rejected, send task back to IN_PROGRESS
        await tx.task.update({
          where: { id: taskId },
          data: {
            status: TaskStatus.IN_PROGRESS,
          }
        });
      }

      return updatedDeliverable;
    });

    return NextResponse.json({ success: true, deliverable: result, data: result });
  } catch (error: any) {
    console.error('Error reviewing deliverable:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
