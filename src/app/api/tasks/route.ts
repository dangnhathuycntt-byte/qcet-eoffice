import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mapPrismaTaskToSchoolTask } from '@/lib/adapters/task-db-adapter';
import { TaskScope, TaskStatus, TaskPriority, AssigneeRole } from '@prisma/client';
import { verifySessionToken, SESSION_COOKIE_NAME, SessionPayload } from '@/lib/jwt-session';
import { safeAfter, dispatchTaskAssignedPush } from '@/lib/push-dispatch';

function getSessionPayload(request: NextRequest): SessionPayload | null {
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value || bearerToken;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function GET(request: NextRequest) {
  try {
    const session = getSessionPayload(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const month = searchParams.get('academicMonth') || searchParams.get('month');
    const dept = searchParams.get('departmentId') || searchParams.get('dept');
    const scope = searchParams.get('scope');
    const year = searchParams.get('academicYear') || searchParams.get('year');
    const status = searchParams.get('status');

    const where: any = {};
    if (month && month !== 'all') {
      where.academicMonth = parseInt(month, 10);
    }
    if (dept && dept !== 'all') {
      where.departmentId = dept;
    }
    if (year && year !== 'all') {
      where.academicYear = year;
    }
    if (scope && scope !== 'all') {
      const s = scope.toLowerCase();
      if (s === 'school') where.scope = TaskScope.SCHOOL;
      else if (s === 'department') where.scope = TaskScope.DEPARTMENT;
      else if (s === 'individual') where.scope = TaskScope.INDIVIDUAL;
    }
    if (status && status !== 'all') {
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
      if (status in statusMap) {
        where.status = statusMap[status];
      }
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        department: true,
        assignees: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } }
          }
        },
        deliverables: true
      },
      orderBy: { dueDate: 'asc' }
    });

    const formattedTasks = tasks.map(mapPrismaTaskToSchoolTask);
    return NextResponse.json({
      success: true,
      data: formattedTasks,
      tasks: formattedTasks,
      total: formattedTasks.length
    });
  } catch (error: any) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getSessionPayload(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      description,
      departmentId,
      dueDate,
      priority,
      scope,
      academicMonth,
      academicYear,
      creatorId,
      assigneeId
    } = body;

    if (!title || !dueDate || !departmentId) {
      return NextResponse.json(
        { success: false, error: 'Thiếu thông tin bắt buộc (Tiêu đề, Hạn chót, Đơn vị)' },
        { status: 400 }
      );
    }

    // Đếm số lượng task trong tháng để sinh mã tự động không trùng lặp
    const monthNum = academicMonth ? Number(academicMonth) : (new Date(dueDate).getMonth() + 1) || 9;
    const yearStr = academicYear || '2026-2027';
    const count = await prisma.task.count({
      where: { academicMonth: monthNum, academicYear: yearStr }
    });
    let seq = count + 1;
    let code = `NV-${new Date().getFullYear()}-${String(monthNum).padStart(2, '0')}-${String(seq).padStart(3, '0')}`;

    while (await prisma.task.findUnique({ where: { code }, select: { id: true } })) {
      seq++;
      code = `NV-${new Date().getFullYear()}-${String(monthNum).padStart(2, '0')}-${String(seq).padStart(3, '0')}`;
    }

    let taskScope: TaskScope = TaskScope.SCHOOL;
    if (scope) {
      const s = scope.toLowerCase();
      if (s === 'department') taskScope = TaskScope.DEPARTMENT;
      else if (s === 'individual') taskScope = TaskScope.INDIVIDUAL;
    }

    let taskPriority: TaskPriority = TaskPriority.NORMAL;
    if (priority) {
      const p = priority.toLowerCase();
      if (p === 'urgent') taskPriority = TaskPriority.URGENT;
      else if (p === 'high') taskPriority = TaskPriority.HIGH;
      else if (p === 'low') taskPriority = TaskPriority.LOW;
    }

    // Tạo Task trong transaction
    const newTask = await prisma.$transaction(async (tx) => {
      let effectiveCreatorId = creatorId || session.id;
      const userExists = await tx.user.findUnique({
        where: { id: effectiveCreatorId },
        select: { id: true }
      });
      if (!userExists) {
        const fallbackUser = await tx.user.findFirst({ select: { id: true } });
        if (fallbackUser) effectiveCreatorId = fallbackUser.id;
      }

      const task = await tx.task.create({
        data: {
          code,
          title,
          description: description || null,
          departmentId,
          dueDate: new Date(dueDate),
          academicMonth: monthNum,
          academicYear: yearStr,
          scope: taskScope,
          priority: taskPriority,
          createdById: effectiveCreatorId,
        },
        include: {
          department: true,
          assignees: {
            include: {
              user: { select: { id: true, name: true, avatarUrl: true } }
            }
          },
          deliverables: true
        }
      });

      if (assigneeId) {
        await tx.taskAssignee.create({
          data: {
            taskId: task.id,
            userId: assigneeId,
            roleInTask: AssigneeRole.PRIMARY_OWNER
          }
        });
      }

      return task;
    });

    // Background push notification dispatch via Next.js 15 after()
    safeAfter(async () => {
      const start = Date.now();
      try {
        await dispatchTaskAssignedPush({
          task: newTask,
          assigneeId,
          actorName: session.name,
          actorId: session.id,
        });
      } catch (error) {
        console.error('[after() Task Push Error]', {
          taskId: newTask.id,
          durationMs: Date.now() - start,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    return NextResponse.json({ success: true, task: newTask, data: newTask }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating task:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
