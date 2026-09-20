import { prisma } from '@/lib/prisma';
import { mapPrismaTaskToSchoolTask, type SchoolTask, formatLocalDate } from '@/lib/adapters/task-db-adapter';
import { TaskScope, TaskStatus, Prisma, AssignmentStatus } from '@prisma/client';
import type { ApiRequestContext, AuthenticatedUser } from '@/server/api/request-context';
import {
  type AuthorizationContext,
  type ActivePositionAssignment,
  SystemRole,
} from '@/server/authorization/authorization-context';
import {
  toTaskDomainModel,
  toTaskDTO,
  getSystemReferenceDate,
  getSystemReferenceDateStr,
  isTaskPastDue,
  getIctReferenceDateStart,
  type TaskView,
} from '@/domain/tasks';
import { calculateTaskMetrics } from '@/lib/task-metrics';
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

/** Lightweight projection for list views — includes summary subtasks for rollup and collaborators, omits deliverables, dacumTaskDef, description */
const TASK_LIST_INCLUDE: Prisma.TaskInclude = {
  department: { select: { id: true, name: true, shortName: true, color: true } },
  assignees: {
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
  },
  subTasks: {
    where: { archivedAt: null },
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      progressPercent: true,
      dueDate: true,
      actors: {
        where: { OR: [{ isPrimaryDRI: true }, { role: 'DRI' }] },
        select: {
          userId: true,
          role: true,
          isPrimaryDRI: true,
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
      assignees: {
        where: { roleInTask: 'PRIMARY_OWNER' },
        select: {
          userId: true,
          roleInTask: true,
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
    },
  },
};

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
      archivedAt: true,
      actors: {
        select: {
          userId: true,
          isPrimaryDRI: true,
          role: true,
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
      assignees: {
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
    },
  },
} as const;

export function isAuthorizationContext(target: unknown): target is AuthorizationContext {
  if (!target || typeof target !== 'object') return false;
  const candidate = target as Record<string, unknown>;
  return (
    typeof candidate.hasPosition === 'function' ||
    (Array.isArray(candidate.positions) && Array.isArray(candidate.systemRoles))
  );
}

function isPositionActive(pos: ActivePositionAssignment, now: Date = new Date()): boolean {
  if (pos.status && pos.status !== 'ACTIVE' && (pos.status as any) !== AssignmentStatus.ACTIVE) {
    return false;
  }
  if (pos.effectiveFrom && new Date(pos.effectiveFrom) > now) {
    return false;
  }
  if (pos.effectiveTo && new Date(pos.effectiveTo) < now) {
    return false;
  }
  return true;
}

function isInstitutionalLeadershipPosition(pos: ActivePositionAssignment, now: Date = new Date()): boolean {
  if (!isPositionActive(pos, now)) return false;
  const code = (pos.positionCode || '').toUpperCase();
  const title = (pos.positionTitle || '').toLowerCase();

  if (
    code === 'HIEU_TRUONG' ||
    code.startsWith('HIEU_TRUONG_') ||
    code === 'PHO_HIEU_TRUONG' ||
    code.startsWith('PHO_HIEU_TRUONG_') ||
    code === 'BAN_GIAM_HIEU' ||
    code === 'BGH' ||
    title.includes('hiệu trưởng')
  ) {
    return true;
  }

  // Active positions with school-wide oversight (BOARD or SCHOOL units)
  if (
    pos.isLeadership &&
    (
      (pos.unitType as string) === 'BOARD' ||
      (pos.unitType as string) === 'SCHOOL' ||
      pos.unitCode === 'BGH' ||
      pos.unitCode === 'BGH_UNIT' ||
      pos.unitCode === 'SCHOOL'
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Canonical task query view filter builder (Issue #26).
 * Constructs Prisma.TaskWhereInput enforcing canonical TaskView semantics:
 * - 'related': Direct actor on task, assigner, creator, current approval action,
 *              or active subtask DRI (without flattening subtasks to top-level rows)
 * - 'unit': Tasks matching user's active units (PositionAssignment / leadUnitId / unitId)
 * - 'all': Unconstrained view filter {} (scoped strictly by prior buildTaskReadWhere)
 * - 'approval': Tasks with a current approval step actively pending for the user / valid delegation
 */
export function buildTaskViewWhere(
  view: TaskView,
  context: AuthorizationContext | AuthenticatedUser | any
): Prisma.TaskWhereInput {
  throw new Error('Not implemented');
}

/**
 * Canonical task read authorization filter builder (Phase 2 Cutover / F02).
 * Constructs Prisma.TaskWhereInput enforcing server-side authorization:
 * - Institutional Leadership (HIEU_TRUONG, PHO_HIEU_TRUONG, BGH, school oversight): school-wide
 * - Technical SYSTEM_ADMIN: denied operational Task data by default
 * - Unit Manager / Head (TRUONG_PHONG, TRUONG_KHOA): sees tasks in assigned units + direct participant tasks
 * - Staff / Individual: sees tasks in own unit + direct participant tasks; never cross-department or unassigned school tasks
 * - Expired assignments drop back to active scopes
 */
export function buildTaskReadWhere(
  context: AuthorizationContext | AuthenticatedUser
): Prisma.TaskWhereInput {
  if (!context) {
    return { id: '__DENY_ANONYMOUS__' };
  }

  const now = new Date();

  // 1. System Admin Evaluation
  let isSystemAdmin = false;
  if (isAuthorizationContext(context)) {
    isSystemAdmin =
      context.isSystemAdmin?.() === true ||
      context.systemRoles?.includes(SystemRole.SYSTEM_ADMIN) ||
      (context.systemRoles as unknown[] as string[])?.includes('SYSTEM_ADMIN');
  } else {
    const roleUpper = (context.role || '').toUpperCase();
    const systemRoleUpper = ((context as any).systemRole || '').toUpperCase();
    isSystemAdmin =
      roleUpper === 'ADMIN' ||
      systemRoleUpper === 'SYSTEM_ADMIN' ||
      (Array.isArray((context as any).systemRoles) &&
        (context as any).systemRoles.includes('SYSTEM_ADMIN'));
  }

  if (isSystemAdmin) {
    return { id: '__DENY_SYSTEM_ADMIN_OPERATIONAL_TASKS__' };
  }

  // 2. Institutional Leadership Evaluation (School-wide oversight)
  let isLeadership = false;
  if (isAuthorizationContext(context)) {
    isLeadership =
      context.positions?.some((p) => isInstitutionalLeadershipPosition(p, now)) ??
      false;
  } else {
    const posCode = (context.positionCode || '').toUpperCase();
    const roleUpper = (context.role || '').toUpperCase();
    const titleLower = (context.title || '').toLowerCase();
    isLeadership =
      posCode === 'HIEU_TRUONG' ||
      posCode.startsWith('HIEU_TRUONG_') ||
      posCode === 'PHO_HIEU_TRUONG' ||
      posCode.startsWith('PHO_HIEU_TRUONG_') ||
      posCode === 'BAN_GIAM_HIEU' ||
      posCode === 'BGH' ||
      titleLower.includes('hiệu trưởng') ||
      roleUpper === 'BAN_GIAM_HIEU' ||
      roleUpper === 'BGH' ||
      roleUpper === 'HIEU_TRUONG' ||
      roleUpper === 'PHO_HIEU_TRUONG';
  }

  if (isLeadership) {
    return {};
  }

  // 3. Extract User Identity and Assigned Unit IDs
  const userId = isAuthorizationContext(context)
    ? context.userId || context.user?.id
    : context.id;

  if (!userId) {
    return { id: '__DENY_ANONYMOUS__' };
  }

  const unitIdSet = new Set<string>();
  if (isAuthorizationContext(context)) {
    if (Array.isArray(context.primaryUnitIds)) {
      for (const id of context.primaryUnitIds) {
        if (id) unitIdSet.add(id);
      }
    }
    if (Array.isArray(context.positions)) {
      for (const pos of context.positions) {
        if (isPositionActive(pos, now) && pos.unitId) {
          unitIdSet.add(pos.unitId);
        }
      }
    }
    if ((context as any).user?.departmentId) {
      unitIdSet.add((context as any).user.departmentId);
    }
  } else {
    if (context.departmentId) {
      unitIdSet.add(context.departmentId);
    }
    if (Array.isArray((context as any).primaryUnitIds)) {
      for (const id of (context as any).primaryUnitIds) {
        if (id) unitIdSet.add(id);
      }
    }
  }

  const unitIds = Array.from(unitIdSet);

  // 4. Build Filter Conditions for Manager / Staff
  const authConditions: Prisma.TaskWhereInput[] = [
    { assignees: { some: { userId } } },
    { actors: { some: { userId } } },
  ];

  if (unitIds.length === 1) {
    authConditions.push({ departmentId: unitIds[0] });
  } else if (unitIds.length > 1) {
    authConditions.push({ departmentId: { in: unitIds } });
  }

  return {
    OR: authConditions,
  };
}

export class TaskQueryService {
  /**
   * Truy vấn danh sách nhiệm vụ chuẩn hoá có phân trang, lọc scope, đơn vị, trạng thái, người thực hiện.
   */
  async queryTasks(
    ctx:
      | ApiRequestContext
      | { user?: AuthenticatedUser | null; authorizationContext?: AuthorizationContext }
      | AuthorizationContext,
    filters: TaskQueryFilters = {}
  ): Promise<TaskQueryResult> {
    const user = isAuthorizationContext(ctx) ? ctx.user : ctx.user || null;
    const userId = isAuthorizationContext(ctx) ? ctx.userId : ctx.user?.id;

    const month = filters.academicMonth ?? filters.month;
    const dept = filters.departmentId ?? filters.dept;
    const year = filters.academicYear ?? filters.year;
    const scope = filters.scope;
    const status = filters.status;
    const assignedTo = filters.assignedTo;
    const parentTaskId = filters.parentTaskId;

    const where: Prisma.TaskWhereInput = { archivedAt: null };

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
      else if (s === 'my' && (userId || user)) {
        assigneeConditions.push({ assignees: { some: { userId: userId || user!.id } } });
      }
    }
    if (assignedTo && assignedTo !== 'all') {
      const targetUserId = assignedTo === 'me' ? (userId || user?.id) : assignedTo;
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
        const refDateVal = filters.referenceDate ?? getSystemReferenceDateStr();
        const refDate = getIctReferenceDateStart(refDateVal);
        where.AND = [
          ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
          {
            status: {
              notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED],
            },
          },
          {
            OR: [
              { status: TaskStatus.OVERDUE },
              { dueDate: { lt: refDate } },
            ],
          },
        ];
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

    // Task list authorization at database level (F02 / Canonical Task Read)
    let authTarget: AuthorizationContext | AuthenticatedUser | null = null;
    if (isAuthorizationContext(ctx)) {
      authTarget = ctx;
    } else if ((ctx as any).authorizationContext) {
      authTarget = (ctx as any).authorizationContext;
    } else if (ctx.user) {
      authTarget = ctx.user;
    }

    if (authTarget) {
      const authWhere = buildTaskReadWhere(authTarget);
      if (authWhere && Object.keys(authWhere).length > 0) {
        where.AND = [
          ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
          authWhere,
        ];
      }
    }

    const isAll =
      filters.all === true ||
      filters.all === 'true' ||
      filters.limit === 'all';

    const hasCursor = Boolean(filters.cursor && String(filters.cursor).trim() !== '');
    const canonicalRefDateStr =
      typeof filters.referenceDate === 'string'
        ? filters.referenceDate
        : filters.referenceDate?.toISOString() ?? getSystemReferenceDateStr();

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
      formattedTasks = rawTasks.map((t) => mapPrismaTaskToSchoolTask(t, canonicalRefDateStr));
      totalPages = limit > 0 ? Math.ceil(total / limit) : 1;
    } else if (isAll) {
      const [totalCount, rawTasks] = await Promise.all([
        prisma.task.count({ where }),
        prisma.task.findMany({
          where,
          include: TASK_INCLUDE,
          orderBy: filters.orderBy || { dueDate: 'asc' },
        }),
      ]);
      total = totalCount;
      limit = Math.min(totalCount > 0 ? totalCount : 50, 100);
      page = 1;
      totalPages = 1;
      hasMore = false;
      nextCursor = null;
      formattedTasks = rawTasks.map((t) => mapPrismaTaskToSchoolTask(t, canonicalRefDateStr));
    } else {
      const pageRaw = filters.page ? parseInt(String(filters.page), 10) : 1;
      page = isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw;

      const limitRaw = filters.limit ?? filters.take ?? 50;
      const limitNum = parseInt(String(limitRaw), 10);
      limit = Math.min(Math.max(isNaN(limitNum) ? 50 : limitNum, 1), 100);
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
      formattedTasks = rawTasks.map((t) => mapPrismaTaskToSchoolTask(t, canonicalRefDateStr));
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
      referenceDate: canonicalRefDateStr,
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
   * Lightweight list query dùng TASK_LIST_INCLUDE (bỏ deliverables, dacumTaskDef, subTasks).
   * Dùng cho server-side initial load ở page.tsx để giảm tải DB.
   */
  async queryTasksForList(
    ctx:
      | ApiRequestContext
      | { user?: AuthenticatedUser | null; authorizationContext?: AuthorizationContext }
      | AuthorizationContext,
    filters: TaskQueryFilters = {}
  ): Promise<TaskQueryResult> {
    // Build where clause (reuse queryTasks logic inline for auth + filters)
    const user = isAuthorizationContext(ctx) ? ctx.user : ctx.user || null;
    const userId = isAuthorizationContext(ctx) ? ctx.userId : ctx.user?.id;

    const month = filters.academicMonth ?? filters.month;
    const dept = filters.departmentId ?? filters.dept;
    const year = filters.academicYear ?? filters.year;
    const scope = filters.scope;
    const status = filters.status;
    const assignedTo = filters.assignedTo;
    const parentTaskId = filters.parentTaskId;

    const where: Prisma.TaskWhereInput = { archivedAt: null };

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
      else if (s === 'my' && (userId || user)) {
        assigneeConditions.push({ assignees: { some: { userId: userId || user!.id } } });
      }
    }
    if (assignedTo && assignedTo !== 'all') {
      const targetUserId = assignedTo === 'me' ? (userId || user?.id) : assignedTo;
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
        const refDateVal = filters.referenceDate ?? getSystemReferenceDateStr();
        const refDate = getIctReferenceDateStart(refDateVal);
        where.AND = [
          ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
          { status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] } },
          { OR: [{ status: TaskStatus.OVERDUE }, { dueDate: { lt: refDate } }] },
        ];
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
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { title: { contains: searchTerm, mode: 'insensitive' } },
            { code: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
      ];
    }

    let authTarget: AuthorizationContext | AuthenticatedUser | null = null;
    if (isAuthorizationContext(ctx)) {
      authTarget = ctx;
    } else if ((ctx as any).authorizationContext) {
      authTarget = (ctx as any).authorizationContext;
    } else if (ctx.user) {
      authTarget = ctx.user;
    }

    if (authTarget) {
      const authWhere = buildTaskReadWhere(authTarget);
      if (authWhere && Object.keys(authWhere).length > 0) {
        where.AND = [
          ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
          authWhere,
        ];
      }
    }

    const canonicalRefDateStr =
      typeof filters.referenceDate === 'string'
        ? filters.referenceDate
        : filters.referenceDate?.toISOString() ?? getSystemReferenceDateStr();

    const isAll =
      filters.all === true ||
      filters.all === 'true' ||
      filters.limit === 'all' ||
      filters.take === 'all';

    let total = 0;
    let page = 1;
    let limit = 50;
    let totalPages = 1;
    let hasMore = false;
    let nextCursor: string | null = null;
    let formattedTasks: SchoolTask[] = [];

    if (isAll) {
      const rawTasks = await prisma.task.findMany({
        where,
        include: TASK_LIST_INCLUDE,
        orderBy: filters.orderBy || { dueDate: 'asc' },
      });
      const totalCount = rawTasks.length;
      total = totalCount;
      limit = Math.min(totalCount > 0 ? totalCount : 50, 100);
      page = 1;
      totalPages = 1;
      hasMore = false;
      nextCursor = null;
      formattedTasks = rawTasks.map((t) => mapPrismaTaskToSchoolTask(t as any, canonicalRefDateStr));
    } else {
      const pageRaw = filters.page ? parseInt(String(filters.page), 10) : 1;
      page = isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw;
      const limitRaw = filters.limit ?? filters.take ?? 50;
      const limitNum = parseInt(String(limitRaw), 10);
      limit = Math.min(Math.max(isNaN(limitNum) ? 50 : limitNum, 1), 100);
      const skip = (page - 1) * limit;

      const [totalCount, rawTasks] = await Promise.all([
        prisma.task.count({ where }),
        prisma.task.findMany({
          where,
          include: TASK_LIST_INCLUDE,
          orderBy: filters.orderBy || { dueDate: 'asc' },
          skip,
          take: limit,
        }),
      ]);

      total = totalCount;
      totalPages = limit > 0 ? Math.ceil(total / limit) : 1;
      hasMore = skip + rawTasks.length < total;
      nextCursor = hasMore && rawTasks.length > 0 ? rawTasks[rawTasks.length - 1].id : null;
      formattedTasks = rawTasks.map((t) => mapPrismaTaskToSchoolTask(t as any, canonicalRefDateStr));
    }

    const pagination: TaskPaginationMeta = { total, page, limit, totalPages, hasMore, nextCursor };
    const meta = { total, page, limit, totalPages, hasMore, nextCursor, referenceDate: canonicalRefDateStr };

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
      where: { id: taskId, archivedAt: null },
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
            actors: {
              include: {
                user: { select: { id: true, name: true, avatarUrl: true } },
              },
            },
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

    // Run both queries concurrently: findMany for active tasks + count for cancelled
    const [tasks, cancelledCount] = await Promise.all([
      prisma.task.findMany({
        where,
        select: {
          id: true,
          status: true,
          dueDate: true,
          parentTaskId: true,
        },
      }),
      prisma.task.count({
        where: {
          ...where,
          status: TaskStatus.CANCELLED,
        },
      }),
    ]);

    const metrics = calculateTaskMetrics(tasks, {
      referenceDate,
      onlyParentTasks: false,
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
