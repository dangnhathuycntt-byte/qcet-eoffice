import { prisma } from '@/lib/prisma';
import { mapPrismaTaskToSchoolTask, type SchoolTask, formatLocalDate } from '@/lib/adapters/task-db-adapter';
import { TaskScope, TaskStatus, Prisma } from '@prisma/client';
import type { ApiRequestContext, AuthenticatedUser } from '@/server/api/request-context';
import { getSystemReferenceDate, isTaskPastDue } from '@/lib/academic-calendar';
import { calculateTaskMetrics } from '@/lib/task-metrics';
import { toTaskDomainModel, toTaskDTO } from '@/domain/tasks';
import { TaskQueryParamsSchema } from '@/contracts/tasks';
import { toTaskDetailDTO, type TaskDetailDTO } from '@/server/dto/task-dto';

export interface TaskQueryFilters {
  academicMonth?: number | string;
  month?: number | string;
  departmentId?: string;
  dept?: string;
  academicYear?: string;
  year?: string;
  scope?: string;
  assignedTo?: string;
  parentTaskId?: string | null;
  status?: string;
  search?: string;
  q?: string;
  page?: number | string;
  limit?: number | string;
  cursor?: string;
  take?: number | string;
  all?: boolean | string;
  orderBy?: Prisma.TaskOrderByWithRelationInput;
  referenceDate?: Date | string;
}

export interface TaskPaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
  nextCursor?: string | null;
}

export interface TaskQueryResult {
  tasks: SchoolTask[];
  data: SchoolTask[];
  total: number;
  totalCount: number;
  page: number;
  limit: number;
  hasMore: boolean;
  nextCursor?: string | null;
  pagination: TaskPaginationMeta;
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
    nextCursor?: string | null;
    referenceDate?: string;
  };
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

const TASK_INCLUDE = {
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
} as const;

export class TaskQueryService {
  /**
   * Truy vấn danh sách nhiệm vụ chuẩn hoá có phân trang, lọc scope, đơn vị, trạng thái, người thực hiện.
   */
  async queryTasks(
    ctx: ApiRequestContext | { user?: AuthenticatedUser | null },
    filters: TaskQueryFilters = {}
  ): Promise<TaskQueryResult> {
    const user = ctx.user || null;

    const month = filters.academicMonth ?? filters.month;
    const dept = filters.departmentId ?? filters.dept;
    const year = filters.academicYear ?? filters.year;
    const scope = filters.scope;
    const status = filters.status;
    const assignedTo = filters.assignedTo;
    const parentTaskId = filters.parentTaskId;

    const where: Prisma.TaskWhereInput = {};

    if (month !== undefined && String(month) !== 'all') {
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
      else if (s === 'department' || s === 'unit') where.scope = TaskScope.DEPARTMENT;
      else if (s === 'individual' || s === 'personal') where.scope = TaskScope.INDIVIDUAL;
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

    if (parentTaskId !== undefined && parentTaskId !== 'all') {
      if (parentTaskId === 'null' || parentTaskId === 'root' || parentTaskId === null) {
        where.parentTaskId = null;
      } else {
        where.parentTaskId = parentTaskId;
      }
    }

    if (status && status !== 'all') {
      const st = status.toLowerCase();
      if (st === 'overdue') {
        const refDateVal = filters.referenceDate ?? getSystemReferenceDate();
        const refDate = typeof refDateVal === 'string' ? new Date(refDateVal) : refDateVal;
        where.status = {
          notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED],
        };
        where.dueDate = {
          lt: refDate,
        };
      } else {
        const statusMap: Record<string, TaskStatus> = {
          not_started: TaskStatus.NOT_STARTED,
          in_progress: TaskStatus.IN_PROGRESS,
          waiting_approval: TaskStatus.WAITING_APPROVAL,
          completed: TaskStatus.COMPLETED,
          cancelled: TaskStatus.CANCELLED,
        };
        const mapped =
          statusMap[st] ??
          (Object.values(TaskStatus).includes(status.toUpperCase() as TaskStatus)
            ? (status.toUpperCase() as TaskStatus)
            : undefined);
        if (mapped) {
          where.status = mapped;
        }
      }
    }

    const rawSearch = filters.search ?? filters.q;
    const searchTerm = typeof rawSearch === 'string' ? rawSearch.trim() : rawSearch ? String(rawSearch).trim() : '';
    if (searchTerm) {
      const searchWhere: Prisma.TaskWhereInput = {
        OR: [
          { title: { contains: searchTerm, mode: 'insensitive' } },
          { code: { contains: searchTerm, mode: 'insensitive' } },
          { description: { contains: searchTerm, mode: 'insensitive' } },
        ],
      };
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        searchWhere,
      ];
    }

    // Task list authorization at database level (F02)
    const isSystemAdmin =
      (user as any)?.role === 'ADMIN' ||
      (user as any)?.systemRole === 'SYSTEM_ADMIN';
    const isLeadership =
      user?.positionCode === "HIEU_TRUONG" ||
      user?.positionCode === "PHO_HIEU_TRUONG" ||
      user?.title?.toLowerCase()?.includes("hiệu trưởng") ||
      user?.role === "BAN_GIAM_HIEU" ||
      (user as any)?.role === "BGH";

    if (!isSystemAdmin && !isLeadership && user) {
      const authConditions: Prisma.TaskWhereInput[] = [
        { assignees: { some: { userId: user.id } } },
        { actors: { some: { userId: user.id } } },
      ];
      if (user.departmentId) {
        authConditions.push({ departmentId: user.departmentId });
      }
      const authWhere: Prisma.TaskWhereInput = {
        OR: authConditions,
      };
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        authWhere,
      ];
    }

    const isAll =
      filters.all === true ||
      filters.all === 'true' ||
      filters.limit === 'all';

    const hasCursor = Boolean(filters.cursor && String(filters.cursor).trim() !== '');

    let formattedTasks: SchoolTask[] = [];
    let total = 0;
    let page = 1;
    let limit = 20;
    let totalPages = 1;
    let hasMore = false;
    let nextCursor: string | null = null;

    if (hasCursor) {
      const cursor = String(filters.cursor).trim();
      const takeRaw = filters.take ?? filters.limit ?? 20;
      const takeNum = parseInt(String(takeRaw), 10);
      limit = Math.min(Math.max(isNaN(takeNum) ? 20 : takeNum, 1), 100);
      const pageRaw = filters.page ? parseInt(String(filters.page), 10) : 1;
      page = isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw;

      const [totalCount, rawTasks] = await Promise.all([
        prisma.task.count({ where }),
        prisma.task.findMany({
          where,
          include: TASK_INCLUDE,
          orderBy: filters.orderBy || { dueDate: 'asc' },
          cursor: { id: cursor },
          skip: 1,
          take: limit + 1,
        }),
      ]);

      total = totalCount;
      if (rawTasks.length > limit) {
        hasMore = true;
        rawTasks.pop();
        nextCursor = rawTasks[rawTasks.length - 1]?.id ?? null;
      } else {
        hasMore = false;
        nextCursor = null;
      }
      formattedTasks = rawTasks.map(mapPrismaTaskToSchoolTask);
      totalPages = limit > 0 ? Math.ceil(total / limit) : 1;
    } else if (isAll) {
      const take = 100;
      limit = 100;
      const [totalCount, rawTasks] = await Promise.all([
        prisma.task.count({ where }),
        prisma.task.findMany({
          where,
          include: TASK_INCLUDE,
          orderBy: filters.orderBy || { dueDate: 'asc' },
          take,
        }),
      ]);
      total = totalCount;
      page = 1;
      totalPages = Math.ceil(total / limit) || 1;
      hasMore = rawTasks.length < total;
      nextCursor = hasMore && rawTasks.length > 0 ? rawTasks[rawTasks.length - 1].id : null;
      formattedTasks = rawTasks.map(mapPrismaTaskToSchoolTask);
    } else {
      const pageRaw = filters.page ? parseInt(String(filters.page), 10) : 1;
      page = isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw;

      const limitRaw = filters.limit ?? filters.take ?? 20;
      const limitNum = parseInt(String(limitRaw), 10);
      limit = Math.min(Math.max(isNaN(limitNum) ? 20 : limitNum, 1), 100);
      const skip = (page - 1) * limit;

      const [totalCount, rawTasks] = await Promise.all([
        prisma.task.count({ where }),
        prisma.task.findMany({
          where,
          include: TASK_INCLUDE,
          orderBy: filters.orderBy || { dueDate: 'asc' },
          skip,
          take: limit,
        }),
      ]);

      total = totalCount;
      totalPages = limit > 0 ? Math.ceil(total / limit) : 1;
      hasMore = skip + rawTasks.length < total;
      nextCursor = hasMore && rawTasks.length > 0 ? rawTasks[rawTasks.length - 1].id : null;
      formattedTasks = rawTasks.map(mapPrismaTaskToSchoolTask);
    }

    const pagination: TaskPaginationMeta = {
      total,
      page,
      limit,
      totalPages,
      hasMore,
      nextCursor,
    };

    const meta = {
      total,
      page,
      limit,
      totalPages,
      hasMore,
      nextCursor,
      referenceDate:
        typeof filters.referenceDate === 'string'
          ? filters.referenceDate
          : filters.referenceDate?.toISOString() ?? getSystemReferenceDate(),
    };

    return {
      tasks: formattedTasks,
      data: formattedTasks,
      total,
      totalCount: total,
      page,
      limit,
      hasMore,
      nextCursor,
      pagination,
      meta,
    };
  }

  /**
   * Lấy chi tiết một nhiệm vụ theo ID (DTO hợp nhất, sanitized network contract).
   * Hoàn toàn loại bỏ raw entity và passwordHash.
   */
  async getTaskById(
    taskId: string
  ): Promise<{
    success: true;
    task: TaskDetailDTO;
    data: TaskDetailDTO;
  } | null> {
    const rawTask = await this.getTaskEntityForInternalUse(taskId);
    if (!rawTask) return null;

    const dto = toTaskDetailDTO(rawTask);
    if (!dto) return null;

    return {
      success: true,
      task: dto,
      data: dto,
    };
  }

  /**
   * Internal method for background services requiring full Prisma entity with relations.
   * NOT for client exposure.
   */
  async getTaskEntityForInternalUse(taskId: string) {
    return prisma.task.findUnique({
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
              include: {
                user: { select: { id: true, name: true, avatarUrl: true } },
              },
            },
            deliverables: true,
          },
        },
      },
    });
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
