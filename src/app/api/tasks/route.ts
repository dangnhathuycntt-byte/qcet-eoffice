import { getApiContext, requireAuthenticated } from '@/server/api/request-context';
import { apiError, apiSuccess } from '@/server/api/response';
import {
  assertQueryStringLength,
  parseAndValidateJson,
  assertRequestBodySize,
  MAX_PAYLOAD_SIZE,
  assertJsonContentType,
} from '@/server/api/validation';
import { assertRateLimit } from '@/server/security/rate-limit';
import { assertCsrf } from '@/server/security/csrf';
import { ForbiddenError } from '@/server/api/errors';
import { TaskQuerySchema, CreateTaskSchema } from '@/contracts/tasks';
import { taskQueryService, taskCommandService } from '@/server/tasks';
import { canCreateTask } from '@/server/policies/task-policy';
import { toTaskListDTOArray, toTaskDetailDTO } from '@/server/dto/task-dto';
import { withIdempotency } from '@/lib/db/idempotency';

export async function GET(req: Request) {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(req);
    requestId = context.requestId;

    const authUser = requireAuthenticated(context);

    assertQueryStringLength(req);
    const url = new URL(req.url);
    const rawParams = Object.fromEntries(url.searchParams.entries());

    // Clamp pagination limit parameters to max 100 before schema validation
    if (rawParams.pageSize !== undefined) {
      const parsed = Number(rawParams.pageSize);
      if (!Number.isNaN(parsed)) {
        rawParams.pageSize = String(Math.min(Math.max(1, parsed), 100));
      }
    }
    if (rawParams.limit !== undefined && rawParams.limit !== 'all') {
      const parsed = Number(rawParams.limit);
      if (!Number.isNaN(parsed)) {
        rawParams.limit = String(Math.min(Math.max(1, parsed), 100));
      }
    }
    if (rawParams.take !== undefined && rawParams.take !== 'all') {
      const parsed = Number(rawParams.take);
      if (!Number.isNaN(parsed)) {
        rawParams.take = String(Math.min(Math.max(1, parsed), 100));
      }
    }

    const validatedQuery = TaskQuerySchema.parse(rawParams);

    const searchQuery = validatedQuery.q || validatedQuery.search;
    if (searchQuery && searchQuery.trim().length > 0) {
      assertRateLimit(authUser.id, 'SEARCH');
    }

    // Clamp pagination limit to max 100
    let effectiveLimit = 20;
    if (typeof validatedQuery.limit === 'number') {
      effectiveLimit = Math.min(Math.max(1, validatedQuery.limit), 100);
    } else if (typeof validatedQuery.take === 'number') {
      effectiveLimit = Math.min(Math.max(1, validatedQuery.take), 100);
    } else if (rawParams.pageSize !== undefined && typeof validatedQuery.pageSize === 'number') {
      effectiveLimit = Math.min(Math.max(1, validatedQuery.pageSize), 100);
    } else if (typeof validatedQuery.pageSize === 'number') {
      effectiveLimit = Math.min(Math.max(1, validatedQuery.pageSize), 100);
    }

    const isAll =
      validatedQuery.all === true ||
      rawParams.all === 'true' ||
      validatedQuery.limit === 'all' ||
      rawParams.limit === 'all';

    const result = await taskQueryService.queryTasks(context, {
      all: isAll,
      page: validatedQuery.page,
      limit: isAll ? undefined : effectiveLimit,
      take: typeof validatedQuery.take === 'number' ? validatedQuery.take : undefined,
      cursor: validatedQuery.cursor,
      q: validatedQuery.q,
      search: validatedQuery.search,
      scope: validatedQuery.scope,
      status: validatedQuery.status,
      dept: validatedQuery.dept || validatedQuery.departmentId,
      departmentId: validatedQuery.departmentId || validatedQuery.dept,
      month: validatedQuery.month || validatedQuery.academicMonth,
      academicMonth: validatedQuery.academicMonth || validatedQuery.month,
      year: validatedQuery.year || validatedQuery.academicYear,
      academicYear: validatedQuery.academicYear || validatedQuery.year,
      assignedTo: validatedQuery.assignedTo || validatedQuery.assigneeId,
      parentTaskId: validatedQuery.parentTaskId,
    });

    const taskList = toTaskListDTOArray(result.tasks || result.data);

    const pagination = {
      ...result.pagination,
      pageSize: result.limit,
    };

    return apiSuccess(
      {
        success: true,
        data: taskList,
        tasks: taskList,
        pagination,
        meta: result.meta,
        total: result.total,
        totalCount: result.totalCount,
        page: result.page,
        limit: result.limit,
        hasMore: result.hasMore,
        nextCursor: result.nextCursor,
      },
      {
        headers: { 'Cache-Control': 'private, no-store' },
        requestId: context.requestId,
      }
    );
  } catch (error) {
    return apiError(error, requestId, { 'Cache-Control': 'private, no-store' });
  }
}

export async function POST(req: Request) {
  let requestId = crypto.randomUUID();
  try {
    assertCsrf(req);
    assertJsonContentType(req);
    assertRequestBodySize(req, MAX_PAYLOAD_SIZE);

    const context = await getApiContext(req);
    requestId = context.requestId;

    const authUser = requireAuthenticated(context);

    assertRateLimit(authUser.id, 'MUTATIONS_SENSITIVE');

    const validatedBody = await parseAndValidateJson(req, CreateTaskSchema);

    // Object authorization: Check whether user can create a task for the specified department
    if (!canCreateTask(authUser, validatedBody.departmentId)) {
      throw new ForbiddenError('Bạn không có quyền tạo nhiệm vụ cho đơn vị này');
    }

    const rawIdempotencyKey =
      req.headers.get('idempotency-key') || req.headers.get('x-idempotency-key');
    const idempotencyKey = rawIdempotencyKey?.trim() ? rawIdempotencyKey.trim() : null;

    // Explicit command mapping (No Mass-Assignment)
    const executeCreateTask = async () => {
      const newTask = await taskCommandService.createTask(context, {
        title: validatedBody.title,
        description: validatedBody.description,
        departmentId: validatedBody.departmentId,
        dueDate: validatedBody.dueDate ?? new Date().toISOString(),
        priority: validatedBody.priority,
        scope: validatedBody.scope,
        academicMonth: validatedBody.academicMonth ?? validatedBody.month,
        academicYear: validatedBody.academicYear ?? validatedBody.year,
        creatorId: validatedBody.creatorId,
        assigneeId: validatedBody.assigneeId,
        collaboratorIds: validatedBody.collaboratorIds,
        parentTaskId: validatedBody.parentTaskId,
        code: validatedBody.code,
      });

      return toTaskDetailDTO(newTask);
    };

    const taskDetail = idempotencyKey
      ? await withIdempotency(
          {
            userId: authUser.id,
            operation: 'task.create',
            key: idempotencyKey,
            payload: validatedBody,
          },
          executeCreateTask
        )
      : await executeCreateTask();

    return apiSuccess(
      {
        success: true,
        task: taskDetail,
        data: taskDetail,
      },
      {
        status: 201,
        headers: { 'Cache-Control': 'private, no-store' },
        requestId: context.requestId,
      }
    );
  } catch (error) {
    return apiError(error, requestId, { 'Cache-Control': 'private, no-store' });
  }
}
