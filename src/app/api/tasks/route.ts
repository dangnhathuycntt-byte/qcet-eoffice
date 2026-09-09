import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mapPrismaTaskToSchoolTask } from '@/lib/adapters/task-db-adapter';
import { TaskScope, TaskStatus, TaskPriority, AssigneeRole } from '@prisma/client';
import { verifySessionToken, SESSION_COOKIE_NAME, SessionPayload } from '@/lib/jwt-session';
import { safeAfter, dispatchTaskAssignedPush } from '@/lib/push-dispatch';
import { generateTaskCodeAtomic } from '@/lib/task-code-generator';

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
    const isAll = searchParams.get('all') === 'true' || searchParams.get('limit') === 'all';
    const pageParam = parseInt(searchParams.get('page') || '1', 10);
    const page = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

    let limit = 50;
    if (!isAll) {
      const limitParam = parseInt(searchParams.get('limit') || '50', 10);
      limit = isNaN(limitParam) ? 50 : Math.min(200, Math.max(1, limitParam));
    }
    const skip = isAll ? 0 : (page - 1) * limit;

    const month = searchParams.get('academicMonth') || searchParams.get('month');
    const dept = searchParams.get('departmentId') || searchParams.get('dept');
    const scope = searchParams.get('scope');
    const year = searchParams.get('academicYear') || searchParams.get('year');
    const status = searchParams.get('status');
    const assignedTo = searchParams.get('assignedTo');
    const parentTaskId = searchParams.get('parentTaskId');

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
      else if (s === 'my') {
        where.assignees = { some: { userId: session.id } };
      }
    }
    if (assignedTo && assignedTo !== 'all') {
      const targetUserId = assignedTo === 'me' ? session.id : assignedTo;
      where.assignees = { some: { userId: targetUserId } };
    }
    if (parentTaskId) {
      if (parentTaskId === 'null' || parentTaskId === 'root') {
        where.parentTaskId = null;
      } else if (parentTaskId !== 'all') {
        where.parentTaskId = parentTaskId;
      }
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

    const [total, tasks] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.findMany({
        where,
        include: {
          department: true,
          assignees: {
            include: {
              user: { select: { id: true, name: true, avatarUrl: true } }
            }
          },
          deliverables: true,
          dacumTaskDef: {
            include: {
              duty: true
            }
          },
          parentTask: {
            select: { id: true, code: true, title: true, scope: true }
          },
          subTasks: {
            select: {
              id: true,
              code: true,
              title: true,
              status: true,
              progressPercent: true,
              assignees: {
                include: {
                  user: { select: { id: true, name: true, avatarUrl: true } }
                }
              }
            }
          }
        },
        orderBy: { dueDate: 'asc' },
        ...(isAll ? {} : { skip, take: limit })
      }),
    ]);

    const formattedTasks = tasks.map(mapPrismaTaskToSchoolTask);
    const effectiveLimit = isAll ? (total > 0 ? total : 50) : limit;
    const totalPages = Math.ceil(total / effectiveLimit);

    const pagination = {
      total,
      page: isAll ? 1 : page,
      limit: isAll ? total : limit,
      totalPages,
    };

    return NextResponse.json({
      success: true,
      data: formattedTasks,
      pagination,
      tasks: formattedTasks, // backward compatibility
      total,                // backward compatibility
      totalCount: total,    // backward compatibility
      page: pagination.page,
      limit: pagination.limit,
      hasMore: isAll ? false : skip + formattedTasks.length < total,
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
      assigneeId,
      parentTaskId,
      collaboratorIds,
    } = body;

    let parentTask: {
      id: string;
      departmentId: string | null;
      academicMonth: number;
      academicYear: string;
    } | null = null;

    if (parentTaskId) {
      parentTask = await prisma.task.findUnique({
        where: { id: parentTaskId },
        select: { id: true, departmentId: true, academicMonth: true, academicYear: true }
      });
      if (!parentTask) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy nhiệm vụ cha' },
          { status: 404 }
        );
      }
    }

    const effectiveDepartmentId = departmentId || parentTask?.departmentId || null;
    const monthNum = academicMonth
      ? Number(academicMonth)
      : (parentTask?.academicMonth ?? ((new Date(dueDate).getMonth() + 1) || 9));
    const yearStr = academicYear || parentTask?.academicYear || '2026-2027';

    if (!title || !dueDate || !effectiveDepartmentId) {
      return NextResponse.json(
        { success: false, error: 'Thiếu thông tin bắt buộc (Tiêu đề, Hạn chót, Đơn vị)' },
        { status: 400 }
      );
    }

    const curYear = new Date().getFullYear();

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

    const validAssigneeId = typeof assigneeId === 'string' && assigneeId.trim() ? assigneeId.trim() : null;
    const validCollaboratorIds = Array.isArray(collaboratorIds)
      ? Array.from(new Set(collaboratorIds)).filter(
          (id): id is string => typeof id === 'string' && Boolean(id.trim()) && id.trim() !== validAssigneeId
        )
      : [];

    const assigneesToCreate: { userId: string; roleInTask: AssigneeRole }[] = [];
    if (validAssigneeId) {
      assigneesToCreate.push({
        userId: validAssigneeId,
        roleInTask: AssigneeRole.PRIMARY_OWNER,
      });
    }
    for (const cId of validCollaboratorIds) {
      assigneesToCreate.push({
        userId: cId,
        roleInTask: AssigneeRole.COLLABORATOR,
      });
    }

    // Tạo Task trong transaction với sinh mã atomic O(1) an toàn tuyệt đối
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

      // Sinh mã tự động atomic O(1) không trùng lặp (QCET-PERF-2025-01)
      const code = body.code || await generateTaskCodeAtomic(tx, {
        year: curYear,
        month: monthNum,
        scope: taskScope,
        departmentCode: effectiveDepartmentId,
      });

      const task = await tx.task.create({
        data: {
          code,
          title,
          description: description || null,
          departmentId: effectiveDepartmentId,
          dueDate: new Date(dueDate),
          academicMonth: monthNum,
          academicYear: yearStr,
          scope: taskScope,
          priority: taskPriority,
          createdById: effectiveCreatorId,
          parentTaskId: parentTaskId || null,
          ...(assigneesToCreate.length > 0
            ? {
                assignees: {
                  create: assigneesToCreate,
                },
              }
            : {}),
        },
        include: {
          department: true,
          assignees: {
            include: {
              user: { select: { id: true, name: true, avatarUrl: true } }
            }
          },
          deliverables: true,
          parentTask: {
            select: { id: true, code: true, title: true, scope: true }
          },
          subTasks: {
            select: {
              id: true,
              code: true,
              title: true,
              status: true,
              progressPercent: true,
              assignees: {
                include: {
                  user: { select: { id: true, name: true, avatarUrl: true } }
                }
              }
            }
          }
        }
      });

      return task;
    });

    // Background push notification dispatch via Next.js 15 after()
    safeAfter(async () => {
      const start = Date.now();
      try {
        await dispatchTaskAssignedPush({
          task: newTask,
          assigneeId: validAssigneeId || undefined,
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
