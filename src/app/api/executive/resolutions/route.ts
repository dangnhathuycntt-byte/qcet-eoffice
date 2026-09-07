import { NextRequest, NextResponse, after } from 'next/server';
import prisma from '@/lib/prisma';
import { ResolutionType, TaskPriority, TaskStatus, UserRole } from '@prisma/client';
import { verifySessionToken, SESSION_COOKIE_NAME, SessionPayload } from '@/lib/jwt-session';
import { sendPushNotificationToUser, formatTaskPushPayload } from '@/lib/push-service';
import { safeAfter, dispatchExecutiveDirectivePush } from '@/lib/push-dispatch';

function getSessionPayload(request: NextRequest): SessionPayload | null {
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value || bearerToken;
  if (!token) return null;
  return verifySessionToken(token);
}

function mapResolutionType(rawType: string): ResolutionType | null {
  const upper = rawType?.toUpperCase();
  if (upper === 'EXTEND_DEADLINE') return ResolutionType.EXTEND_DEADLINE;
  if (upper === 'REASSIGN' || upper === 'REASSIGN_OWNER') return ResolutionType.REASSIGN_OWNER;
  if (upper === 'DIRECTIVE_NOTE' || upper === 'DEMAND_EXPLANATION' || upper === 'DIRECT_DIRECTIVE') {
    return ResolutionType.DIRECTIVE_NOTE;
  }
  if (upper === 'DISMISS_BOTTLENECK') return ResolutionType.DISMISS_BOTTLENECK;
  if (Object.values(ResolutionType).includes(upper as ResolutionType)) {
    return upper as ResolutionType;
  }
  return null;
}
const normalizeResolutionType = mapResolutionType;

function normalizeTaskStatus(rawStatus: string): TaskStatus | null {
  if (!rawStatus) return null;
  const upper = rawStatus.toUpperCase();
  const statusMap: Record<string, TaskStatus> = {
    NOT_STARTED: TaskStatus.NOT_STARTED,
    IN_PROGRESS: TaskStatus.IN_PROGRESS,
    WAITING_APPROVAL: TaskStatus.WAITING_APPROVAL,
    COMPLETED: TaskStatus.COMPLETED,
    OVERDUE: TaskStatus.OVERDUE,
    CANCELLED: TaskStatus.CANCELLED,
  };
  return statusMap[upper] || null;
}

function normalizeTaskPriority(rawPriority: string): TaskPriority | null {
  if (!rawPriority) return null;
  const upper = rawPriority.toUpperCase();
  const priorityMap: Record<string, TaskPriority> = {
    URGENT: TaskPriority.URGENT,
    HIGH: TaskPriority.HIGH,
    NORMAL: TaskPriority.NORMAL,
    MEDIUM: TaskPriority.NORMAL,
    LOW: TaskPriority.LOW,
  };
  return priorityMap[upper] || null;
}

export async function GET(request: NextRequest) {
  try {
    const session = getSessionPayload(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Chưa đăng nhập (Unauthorized)' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const taskId = searchParams.get('taskId');
    const resolutionType = searchParams.get('resolutionType');
    const departmentId = searchParams.get('departmentId') || searchParams.get('dept');
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    const where: any = {};
    if (taskId) {
      where.taskId = taskId;
    }
    if (resolutionType) {
      const normalized = normalizeResolutionType(resolutionType);
      if (normalized) {
        where.resolutionType = normalized;
      }
    }
    if (departmentId) {
      where.task = { ...(where.task || {}), departmentId };
    }

    const resolutions = await prisma.executiveResolution.findMany({
      where,
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            role: true,
            avatarUrl: true,
          },
        },
        task: {
          select: {
            id: true,
            code: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
            departmentId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      resolutions,
      data: resolutions,
      total: resolutions.length,
    });
  } catch (error: any) {
    console.error('Error fetching executive resolutions:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionPayload(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Chưa đăng nhập (Unauthorized)' },
        { status: 401 }
      );
    }
    const effectiveActorId = session.id;
    const actorRole = session.role;

    // Role check: Only BGH or ADMIN can issue resolutions
    const isBghOrAdmin =
      actorRole === UserRole.BAN_GIAM_HIEU ||
      actorRole === UserRole.ADMIN ||
      actorRole === 'BAN_GIAM_HIEU' ||
      actorRole === 'ADMIN';

    if (!isBghOrAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Chỉ Ban Giám Hiệu hoặc Quản trị viên mới có quyền ban hành lệnh điều hành' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const {
      taskId,
      directiveNote,
      newOwnerId,
      status,
      taskStatus,
      priority,
      taskPriority,
    } = body;

    const rawType = body.resolutionType || body.actionType || body.type;
    const grantedDays = body.grantedDays || body.extensionDays;

    if (!taskId || !rawType) {
      return NextResponse.json(
        { success: false, error: 'Thiếu thông tin bắt buộc (taskId, resolutionType/actionType)' },
        { status: 400 }
      );
    }

    const mappedResolutionType = mapResolutionType(rawType);
    if (!mappedResolutionType) {
      return NextResponse.json(
        { success: false, error: `Loại can thiệp không hợp lệ: ${rawType}` },
        { status: 400 }
      );
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { department: true },
    });

    if (!task) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy nhiệm vụ' },
        { status: 404 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      let previousDueDate: Date | null = null;
      let newDueDate: Date | null = null;
      let previousOwnerId: string | null = null;

      const taskUpdateData: any = {};

      if (mappedResolutionType === ResolutionType.EXTEND_DEADLINE && grantedDays) {
        const days = parseInt(String(grantedDays), 10);
        if (!isNaN(days) && days > 0) {
          previousDueDate = task.dueDate;
          newDueDate = new Date(task.dueDate.getTime() + days * 24 * 60 * 60 * 1000);
          taskUpdateData.dueDate = newDueDate;

          // If task was overdue or blocked, transition to IN_PROGRESS
          if (task.status === TaskStatus.OVERDUE) {
            taskUpdateData.status = TaskStatus.IN_PROGRESS;
          }
        }
      } else if (mappedResolutionType === ResolutionType.REASSIGN_OWNER && newOwnerId) {
        previousOwnerId = task.departmentId;
        // Check if newOwnerId is a Department ID
        const dept = await tx.department.findUnique({ where: { id: newOwnerId } });
        if (dept) {
          taskUpdateData.departmentId = newOwnerId;
        } else {
          // Check if newOwnerId is a User ID
          const user = await tx.user.findUnique({ where: { id: newOwnerId } });
          if (user && user.departmentId) {
            taskUpdateData.departmentId = user.departmentId;
          }
        }
        if (task.status === TaskStatus.OVERDUE) {
          taskUpdateData.status = TaskStatus.IN_PROGRESS;
        }
      } else if (mappedResolutionType === ResolutionType.DIRECTIVE_NOTE) {
        taskUpdateData.priority = TaskPriority.URGENT;
      } else if (mappedResolutionType === ResolutionType.DISMISS_BOTTLENECK) {
        taskUpdateData.status = TaskStatus.IN_PROGRESS;
      }

      // Allow explicitly mandated status from request (e.g. WAITING_APPROVAL, IN_PROGRESS)
      const explicitStatus = normalizeTaskStatus(status || taskStatus);
      if (explicitStatus) {
        taskUpdateData.status = explicitStatus;
        if (explicitStatus === TaskStatus.COMPLETED) {
          taskUpdateData.completedAt = new Date();
        }
      }

      // Allow explicitly mandated priority from request
      const explicitPriority = normalizeTaskPriority(priority || taskPriority);
      if (explicitPriority) {
        taskUpdateData.priority = explicitPriority;
      }

      let updatedTask = task;
      if (Object.keys(taskUpdateData).length > 0) {
        updatedTask = await tx.task.update({
          where: { id: taskId },
          data: taskUpdateData,
          include: { department: true },
        });
      }

      const resolution = await tx.executiveResolution.create({
        data: {
          taskId,
          actorId: effectiveActorId!,
          resolutionType: mappedResolutionType,
          directiveNote: directiveNote || null,
          grantedDays: grantedDays ? parseInt(String(grantedDays), 10) : null,
          previousDueDate,
          newDueDate,
          previousOwnerId,
          newOwnerId: newOwnerId || null,
        },
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              role: true,
              avatarUrl: true,
            },
          },
          task: {
            select: {
              id: true,
              code: true,
              title: true,
              status: true,
              priority: true,
              dueDate: true,
              departmentId: true,
            },
          },
        },
      });

      return { resolution, updatedTask };
    });

    // Background push notification dispatch via Next.js 15 after()
    safeAfter(async () => {
      const start = Date.now();
      try {
        await dispatchExecutiveDirectivePush({
          taskId: task.id,
          taskTitle: task.title,
          resolutionType: mappedResolutionType,
          directiveNote: directiveNote || null,
          actorName: session.name || 'Ban Giám Hiệu',
          actorId: session.id,
          departmentId: result.updatedTask.departmentId || task.departmentId,
          newOwnerId: newOwnerId || null,
        });
      } catch (error) {
        console.error('[after() Executive Directive Push Error]', {
          taskId: task.id,
          resolutionId: result.resolution.id,
          durationMs: Date.now() - start,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    return NextResponse.json({
      success: true,
      resolution: result.resolution,
      data: result.resolution,
      task: result.updatedTask,
    });
  } catch (error: any) {
    console.error('Error creating executive resolution:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
