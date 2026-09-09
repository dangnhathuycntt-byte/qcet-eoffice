import { prisma } from '@/lib/prisma';
import { mapPrismaTaskToSchoolTask, type SchoolTask, formatLocalDate } from '@/lib/adapters/task-db-adapter';
import { TaskScope, TaskStatus, Prisma } from '@prisma/client';
import type { ApiRequestContext, AuthenticatedUser } from '@/server/api/request-context';
import { getSystemReferenceDate, isTaskPastDue } from '@/lib/academic-calendar';
import { calculateTaskMetrics } from '@/lib/task-metrics';
import { toTaskDomainModel, toTaskDTO } from '@/domain/tasks';
import { TaskQueryParamsSchema } from '@/contracts/tasks';

export interface TaskQueryFilters {
  academicMonth?: number | string;
  month?: number | string;
  departmentId?: string;
  dept?: string;
  academicYear?: string;
  year?: string;
  scope?: string;
  assignedTo?: string;
  parentTaskId?: string;
  status?: string;
  search?: string;
  page?: number | string;
  limit?: number | string;
  all?: boolean | string;
  orderBy?: Prisma.TaskOrderByWithRelationInput;
}

export interface TaskPaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TaskQueryResult {
  tasks: SchoolTask[];
  data: SchoolTask[];
  total: number;
  totalCount: number;
  page: number;
  limit: number;
  hasMore: boolean;
  pagination: TaskPaginationMeta;
}

export interface TaskMetricsFilter {
  academicMonth?: number;
  academicYear?: string;
  departmentId?: string;
  scope?: string;
  userId?: string;
  onlyParentTasks?: boolean;
}

export interface TaskMetricsResult {
  total: number;
  completed: number;
  inProgress: number;
  waitingApproval: number;
  overdue: number;
  cancelled: number;
  completionRate: number;
  referenceDate: string;
}

export class TaskQueryService {
  /**
   * Truy vấn danh sách nhiệm vụ chuẩn hoá có phân trang, lọc scope, đơn vị, trạng thái, người thực hiện.
   */
  async queryTasks(
    ctx: ApiRequestContext | { user?: AuthenticatedUser | null },
    filters: TaskQueryFilters = {}
  ): Promise<TaskQueryResult> {
    const user = ctx.user || null;

    const isAll =
      filters.all === true ||
      filters.all === 'true' ||
      filters.limit === 'all';

    const pageRaw = filters.page ? parseInt(String(filters.page), 10) : 1;
    const page = isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw;

    let limit = 50;
    if (!isAll) {
      const limitRaw = filters.limit ? parseInt(String(filters.limit), 10) : 50;
      limit = isNaN(limitRaw) ? 50 : Math.min(200, Math.max(1, limitRaw));
    }
    const skip = isAll ? 0 : (page - 1) * limit;

    const month = filters.academicMonth ?? filters.month;
    const dept = filters.departmentId ?? filters.dept;
    const year = filters.academicYear ?? filters.year;
    const scope = filters.scope;
    const status = filters.status;
    const assignedTo = filters.assignedTo;
    const parentTaskId = filters.parentTaskId;
    const search = filters.search?.trim();

    const where: Prisma.TaskWhereInput = {};

    if (month && String(month) !== 'all') {
      where.academicMonth = parseInt(String(month), 10);
    }
    if (dept && dept !== 'all') {
      where.departmentId = dept;
    }
    if (year && year !== 'all') {
      where.academicYear = String(year);
    }
    const assigneeConditions: Prisma.TaskWhereInput[] = [];
    if (scope && scope !== 'all') {
      const s = scope.toLowerCase();
      if (s === 'school') where.scope = TaskScope.SCHOOL;
      else if (s === 'department') where.scope = TaskScope.DEPARTMENT;
      else if (s === 'individual') where.scope = TaskScope.INDIVIDUAL;
      else if (s === 'my' && user) {
        assigneeConditions.push({ assignees: { some: { userId: user.id } } });
      }
    }
    if (assignedTo && assignedTo !== 'all') {
      const targetUserId = assignedTo === 'me' ? user?.id : assignedTo;
      if (targetUserId) {
        assigneeConditions.push({ assignees: { some: { userId: targetUserId } } });
      }
    }
    if (assigneeConditions.length === 1) {
      where.assignees = assigneeConditions[0].assignees;
    } else if (assigneeConditions.length > 1) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        ...assigneeConditions,
      ];
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
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { code: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [total, tasks] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.findMany({
        where,
        include: {
          department: true,
          assignees: {
            include: {
              user: { select: { id: true, name: true, avatarUrl: true } },
            },
          },
          deliverables: true,
          dacumTaskDef: {
            include: {
              duty: true,
            },
          },
          parentTask: {
            select: { id: true, code: true, title: true, scope: true },
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
                  user: { select: { id: true, name: true, avatarUrl: true } },
                },
              },
            },
          },
        },
        orderBy: filters.orderBy || { dueDate: 'asc' },
        ...(isAll ? {} : { skip, take: limit }),
      }),
    ]);

    const formattedTasks = tasks.map(mapPrismaTaskToSchoolTask);
    const effectiveLimit = isAll ? (total > 0 ? total : 50) : limit;
    const totalPages = Math.ceil(total / effectiveLimit);

    const pagination: TaskPaginationMeta = {
      total,
      page: isAll ? 1 : page,
      limit: isAll ? total : limit,
      totalPages,
    };

    return {
      tasks: formattedTasks,
      data: formattedTasks,
      total,
      totalCount: total,
      page: pagination.page,
      limit: pagination.limit,
      hasMore: isAll ? false : skip + formattedTasks.length < total,
      pagination,
    };
  }

  /**
   * Lấy chi tiết một nhiệm vụ theo ID, kèm đầy đủ quan hệ cấp bậc và minh chứng.
   */
  async getTaskById(
    taskId: string
  ): Promise<{
    task: SchoolTask;
    data: SchoolTask;
    raw: any;
    domain?: any;
    dto?: any;
  } | null> {
    const rawTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        department: true,
        assignees: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
        deliverables: {
          include: {
            uploadedBy: { select: { id: true, name: true, avatarUrl: true } },
            reviewer: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
        resolutions: {
          include: {
            actor: { select: { id: true, name: true } },
          },
        },
        dacumTaskDef: {
          include: {
            duty: true,
          },
        },
        parentTask: {
          select: { id: true, code: true, title: true, scope: true },
        },
        subTasks: {
          include: {
            assignees: {
              include: { user: true },
            },
            deliverables: true,
          },
        },
      },
    });

    if (!rawTask) return null;

    const mapped = mapPrismaTaskToSchoolTask(rawTask);
    const domain = toTaskDomainModel(rawTask);
    const dto = toTaskDTO(domain);
    return {
      task: mapped,
      data: mapped,
      raw: rawTask,
      domain,
      dto,
    };
  }

  /**
   * Tổng hợp chỉ số đo lường công việc theo quy chuẩn One Metric, One Definition.
   */
  async getTaskMetrics(
    ctx: ApiRequestContext | { user?: AuthenticatedUser | null },
    filters: TaskMetricsFilter = {}
  ): Promise<TaskMetricsResult> {
    const user = ctx.user || null;
    const referenceDate = getSystemReferenceDate();

    const where: Prisma.TaskWhereInput = {
      status: { not: TaskStatus.CANCELLED },
    };

    if (filters.onlyParentTasks !== false) {
      where.parentTaskId = null;
    }
    if (filters.academicMonth) {
      where.academicMonth = filters.academicMonth;
    }
    if (filters.academicYear) {
      where.academicYear = filters.academicYear;
    }
    if (filters.departmentId && filters.departmentId !== 'all') {
      where.departmentId = filters.departmentId;
    }
    const metricAssigneeConditions: Prisma.TaskWhereInput[] = [];
    if (filters.scope && filters.scope !== 'all') {
      const s = filters.scope.toLowerCase();
      if (s === 'school') where.scope = TaskScope.SCHOOL;
      else if (s === 'department') where.scope = TaskScope.DEPARTMENT;
      else if (s === 'individual') where.scope = TaskScope.INDIVIDUAL;
      else if (s === 'my' && user) {
        metricAssigneeConditions.push({ assignees: { some: { userId: user.id } } });
      }
    }
    if (filters.userId) {
      const targetUserId = filters.userId === 'me' ? user?.id : filters.userId;
      if (targetUserId) {
        metricAssigneeConditions.push({ assignees: { some: { userId: targetUserId } } });
      }
    }
    if (metricAssigneeConditions.length === 1) {
      where.assignees = metricAssigneeConditions[0].assignees;
    } else if (metricAssigneeConditions.length > 1) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        ...metricAssigneeConditions,
      ];
    }

    const tasks = await prisma.task.findMany({
      where,
      select: {
        id: true,
        status: true,
        dueDate: true,
        parentTaskId: true,
      },
    });

    const metrics = calculateTaskMetrics(tasks, {
      referenceDate,
      onlyParentTasks: false,
    });

    const cancelledCount = await prisma.task.count({
      where: {
        ...where,
        status: TaskStatus.CANCELLED,
      },
    });

    return {
      total: metrics.total,
      completed: metrics.completed,
      inProgress: metrics.inProgress,
      waitingApproval: metrics.waitingApproval,
      overdue: metrics.overdue,
      cancelled: cancelledCount,
      completionRate: metrics.completionRate,
      referenceDate,
    };
  }
}

export const taskQueryService = new TaskQueryService();
