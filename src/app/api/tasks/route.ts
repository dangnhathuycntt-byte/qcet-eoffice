import { getApiContext, requireAuthenticated } from '@/server/api/request-context';
import { apiError, apiSuccess } from '@/server/api/response';
import { NextResponse } from 'next/server';
import {
  assertQueryStringLength,
  parseAndValidateJson,
  assertRequestBodySize,
  MAX_PAYLOAD_SIZE,
  assertJsonContentType,
} from '@/server/api/validation';
import { checkRateLimit, RATE_LIMIT_TIERS, logRateLimitExceeded, assertRateLimit } from '@/server/security/rate-limit';
import { assertCsrf } from '@/server/security/csrf';
import { ForbiddenError } from '@/server/api/errors';
import { TaskQuerySchema, CreateTaskSchema } from '@/contracts/tasks';
import { taskQueryService, taskCommandService } from '@/server/tasks';
import { loadAuthorizationContext } from '@/server/authorization/authorization-context-service';
import { authorize } from '@/server/authorization/authorization-engine';
import { buildTaskResource, computeAvailableActions } from '@/server/authorization/available-actions';
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

    // Sanitize and clamp pagination query parameters before schema validation
    if (rawParams.page !== undefined) {
      const parsed = Number(rawParams.page);
      if (!Number.isNaN(parsed)) {
        rawParams.page = String(Math.max(1, Math.floor(parsed)));
      }
    }
    if (rawParams.pageSize !== undefined) {
      const parsed = Number(rawParams.pageSize);
      if (!Number.isNaN(parsed)) {
        rawParams.pageSize = String(Math.min(Math.max(1, Math.floor(parsed)), 200));
      }
    }
    if (rawParams.limit !== undefined && rawParams.limit !== 'all') {
      const parsed = Number(rawParams.limit);
      if (!Number.isNaN(parsed)) {
        rawParams.limit = String(Math.min(Math.max(1, Math.floor(parsed)), 200));
      }
    }
    if (rawParams.take !== undefined && rawParams.take !== 'all') {
      const parsed = Number(rawParams.take);
      if (!Number.isNaN(parsed)) {
        rawParams.take = String(Math.min(Math.max(1, Math.floor(parsed)), 200));
      }
    }

    const validatedQuery = TaskQuerySchema.parse(rawParams);

    const searchQuery = validatedQuery.q || validatedQuery.search;
    if (searchQuery && searchQuery.trim().length > 0) {
      assertRateLimit(authUser.id, 'SEARCH');
    }

    // Default pagination limit is 50, bounded to [1, 200]
    let effectiveLimit = 50;
    if (typeof validatedQuery.limit === 'number') {
      effectiveLimit = Math.min(Math.max(1, validatedQuery.limit), 200);
    } else if (typeof validatedQuery.take === 'number') {
      effectiveLimit = Math.min(Math.max(1, validatedQuery.take), 200);
    } else if (rawParams.pageSize !== undefined && typeof validatedQuery.pageSize === 'number') {
      effectiveLimit = Math.min(Math.max(1, validatedQuery.pageSize), 200);
    }

    const isAll =
      validatedQuery.all === true ||
      rawParams.all === 'true' ||
      validatedQuery.limit === 'all' ||
      rawParams.limit === 'all';

    // Canonical view resolution with legacy scope fallback (Issue #26)
    let canonicalView = validatedQuery.view;
    if (!canonicalView && validatedQuery.scope) {
      const s = validatedQuery.scope.toLowerCase();
      if (s === 'my' || s === 'personal' || s === 'individual') {
        canonicalView = 'related';
      } else if (s === 'unit' || s === 'department') {
        canonicalView = 'unit';
      } else if (s === 'school' || s === 'all') {
        canonicalView = 'all';
      }
    }

    const authorizationContext = await loadAuthorizationContext(authUser.id, new Date(), { useCache: true, ttlMs: 10_000 });
    const result = await taskQueryService.queryTasks(authorizationContext, {
      all: isAll,
      page: validatedQuery.page,
      limit: isAll ? undefined : effectiveLimit,
      take: typeof validatedQuery.take === 'number' ? validatedQuery.take : undefined,
      cursor: validatedQuery.cursor,
      q: validatedQuery.q,
      search: validatedQuery.search,
      view: canonicalView,
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

    const taskList = toTaskListDTOArray(result.tasks || result.data).map((task) => ({
      ...task,
      availableActions: computeAvailableActions(
        authorizationContext,
        buildTaskResource(task)
      ),
    }));

    const pagination = {
      ...result.pagination,
      limit: !isAll && effectiveLimit !== undefined ? effectiveLimit : result.limit,
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
        limit: pagination.limit,
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

    // Fix #4: restore MUTATIONS_SENSITIVE (30/min) consistent with tasks/[id]/actions
    const rateResult = await checkRateLimit('MUTATIONS_SENSITIVE', authUser.id);
    if (!rateResult.success) {
      // Fix #5: capture retryAfter BEFORE any async call to avoid negative Retry-After
      const retryAfter = rateResult.retryAfter;
      logRateLimitExceeded('MUTATIONS_SENSITIVE', authUser.id, req.url, authUser.id).catch(() => undefined);
      return NextResponse.json(
        { error: 'Too Many Requests', code: 'RATE_LIMITED', retryAt: rateResult.resetAt.toISOString() },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.max(1, retryAfter)),
            'X-RateLimit-Limit': String(RATE_LIMIT_TIERS.MUTATIONS_SENSITIVE.limit),
            'X-RateLimit-Remaining': String(rateResult.remaining),
          },
        },
      );
    }

    const validatedBody = await parseAndValidateJson(req, CreateTaskSchema);

    // Canonical object authorization: Check whether user can create a task for the specified department
    const authContext = await loadAuthorizationContext(authUser.id);
    const authDecision = authorize(authContext, 'task.create', {
      type: 'task',
      departmentId: validatedBody.departmentId ?? undefined,
      leadUnitId: validatedBody.departmentId ?? undefined,
      scope: validatedBody.scope?.toLowerCase(),
    });
    if (!authDecision.allowed) {
      throw new ForbiddenError(authDecision.reason || 'Bạn không có quyền tạo nhiệm vụ cho đơn vị này');
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
        startDate: validatedBody.startDate,
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
