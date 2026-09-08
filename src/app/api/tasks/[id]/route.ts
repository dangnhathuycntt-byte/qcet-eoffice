import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { mapPrismaTaskToSchoolTask } from '@/lib/adapters/task-db-adapter';
import { TaskStatus, TaskPriority, AssigneeRole } from '@prisma/client';
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

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = getSessionPayload(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await Promise.resolve(context.params);
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        department: true,
        assignees: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } }
          }
        },
        deliverables: {
          include: {
            uploadedBy: { select: { id: true, name: true, avatarUrl: true } },
            reviewer: { select: { id: true, name: true, avatarUrl: true } }
          }
        },
        resolutions: {
          include: {
            actor: { select: { id: true, name: true } }
          }
        }
      }
    });

    if (!task) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy nhiệm vụ' },
        { status: 404 }
      );
    }

    const mapped = mapPrismaTaskToSchoolTask(task);
    return NextResponse.json({
      success: true,
      task: mapped,
      data: mapped,
      raw: task
    });
  } catch (error: any) {
    console.error('Error fetching task details:', error);
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

    const { id } = await Promise.resolve(context.params);
    const existing = await prisma.task.findUnique({
      where: { id },
      include: {
        assignees: { select: { userId: true } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy nhiệm vụ' },
        { status: 404 }
      );
    }

    const isPrivileged = ["BAN_GIAM_HIEU", "ADMIN"].includes(session.role);
    const isCreator = existing.createdById === session.id;
    const isAssignee = existing.assignees.some((a) => a.userId === session.id);
    const isDepartmentLeader =
      session.role === "TRUONG_PHONG" &&
      Boolean(session.departmentId && existing.departmentId === session.departmentId);

    if (!isPrivileged && !isCreator && !isAssignee && !isDepartmentLeader) {
      return NextResponse.json(
        { success: false, error: "Bạn không có quyền chỉnh sửa nhiệm vụ này" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      title,
      description,
      progressPercent,
      progress,
      status,
      priority,
      dueDate,
      departmentId,
      assigneeId
    } = body;

    const updateData: any = {};

    if (typeof title === 'string' && title.trim()) {
      updateData.title = title.trim();
    }
    if (description !== undefined) {
      updateData.description = description || null;
    }
    if (typeof progressPercent === 'number') {
      updateData.progressPercent = Math.min(100, Math.max(0, progressPercent));
    } else if (typeof progress === 'number') {
      updateData.progressPercent = Math.min(100, Math.max(0, progress));
    }
    if (dueDate) {
      updateData.dueDate = new Date(dueDate);
    }
    if (departmentId) {
      updateData.departmentId = departmentId;
    }

    if (status) {
      const statusMap: Record<string, TaskStatus> = {
        not_started: TaskStatus.NOT_STARTED,
        in_progress: TaskStatus.IN_PROGRESS,
        waiting_approval: TaskStatus.WAITING_APPROVAL,
        completed: TaskStatus.COMPLETED,
        overdue: TaskStatus.OVERDUE,
        cancelled: TaskStatus.CANCELLED,
        NOT_STARTED: TaskStatus.NOT_STARTED,
        IN_PROGRESS: TaskStatus.IN_PROGRESS,
        WAITING_APPROVAL: TaskStatus.WAITING_APPROVAL,
        COMPLETED: TaskStatus.COMPLETED,
        OVERDUE: TaskStatus.OVERDUE,
        CANCELLED: TaskStatus.CANCELLED,
      };

      const mappedStatus = statusMap[status];
      if (mappedStatus) {
        updateData.status = mappedStatus;
        if (mappedStatus === TaskStatus.COMPLETED) {
          updateData.completedAt = new Date();
          if (updateData.progressPercent === undefined) {
            updateData.progressPercent = 100;
          }
        } else if (existing.status === TaskStatus.COMPLETED) {
          updateData.completedAt = null;
        }
      }
    }

    if (priority) {
      const priorityMap: Record<string, TaskPriority> = {
        urgent: TaskPriority.URGENT,
        high: TaskPriority.HIGH,
        medium: TaskPriority.NORMAL,
        normal: TaskPriority.NORMAL,
        low: TaskPriority.LOW,
        URGENT: TaskPriority.URGENT,
        HIGH: TaskPriority.HIGH,
        NORMAL: TaskPriority.NORMAL,
        LOW: TaskPriority.LOW,
      };
      const mappedPriority = priorityMap[priority];
      if (mappedPriority) {
        updateData.priority = mappedPriority;
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (assigneeId) {
        // Upsert primary owner
        const existingAssignee = await tx.taskAssignee.findFirst({
          where: { taskId: id, roleInTask: AssigneeRole.PRIMARY_OWNER }
        });
        if (existingAssignee) {
          await tx.taskAssignee.update({
            where: { id: existingAssignee.id },
            data: { userId: assigneeId }
          });
        } else {
          await tx.taskAssignee.create({
            data: {
              taskId: id,
              userId: assigneeId,
              roleInTask: AssigneeRole.PRIMARY_OWNER
            }
          });
        }
      }

      return tx.task.update({
        where: { id },
        data: updateData,
        include: {
          department: true,
          assignees: {
            include: {
              user: { select: { id: true, name: true, avatarUrl: true } }
            }
          },
          deliverables: {
            include: {
              uploadedBy: { select: { id: true, name: true, avatarUrl: true } },
              reviewer: { select: { id: true, name: true, avatarUrl: true } }
            }
          }
        }
      });
    });

    const mapped = mapPrismaTaskToSchoolTask(updated);
    return NextResponse.json({
      success: true,
      task: mapped,
      data: mapped,
      raw: updated
    });
  } catch (error: any) {
    console.error('Error updating task:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = getSessionPayload(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await Promise.resolve(context.params);
    const existing = await prisma.task.findUnique({
      where: { id },
      select: { id: true, createdById: true }
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy nhiệm vụ' },
        { status: 404 }
      );
    }

    const isPrivileged = ["BAN_GIAM_HIEU", "ADMIN"].includes(session.role);
    const isCreator = existing.createdById === session.id;

    if (!isPrivileged && !isCreator) {
      return NextResponse.json(
        { success: false, error: "Bạn không có quyền xóa nhiệm vụ này" },
        { status: 403 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // Unlink any document linked to this task
      await tx.document.updateMany({
        where: { linkedTaskId: id },
        data: { linkedTaskId: null }
      });

      // Cleanup cascaded relations safely
      await tx.taskAssignee.deleteMany({ where: { taskId: id } });
      await tx.taskDeliverable.deleteMany({ where: { taskId: id } });
      await tx.dacumDelegation.deleteMany({ where: { taskId: id } });
      await tx.executiveResolution.deleteMany({ where: { taskId: id } });
      await tx.task.delete({ where: { id } });
    });

    return NextResponse.json({
      success: true,
      message: 'Đã xóa nhiệm vụ thành công'
    });
  } catch (error: any) {
    console.error('Error deleting task:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
