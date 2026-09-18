import { getApiContext, requireAuthenticated } from '@/server/api/request-context';
import { apiError, apiSuccess } from '@/server/api/response';
import {
  parseAndValidateJson,
  assertRequestBodySize,
  MAX_PAYLOAD_SIZE,
  assertJsonContentType,
} from '@/server/api/validation';
import { assertRateLimit } from '@/server/security/rate-limit';
import { assertCsrf } from '@/server/security/csrf';
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  PreconditionFailedError,
  ValidationError,
} from '@/server/api/errors';
import { ArchiveTaskSchema, UpdateTaskMetadataSchema } from '@/contracts/tasks';
import { taskQueryService, taskCommandService } from '@/server/tasks';
import { loadAuthorizationContext } from '@/server/authorization/authorization-context-service';
import { authorize } from '@/server/authorization/authorization-engine';
import {
  computeAvailableActions,
  buildTaskResource,
} from '@/server/authorization/available-actions';
import { toTaskDetailDTO } from '@/server/dto/task-dto';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, routeContext: RouteContext) {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(req);
    requestId = context.requestId;

    const authUser = requireAuthenticated(context);

    const { id } = await Promise.resolve(routeContext.params);
    const result = await taskQueryService.getTaskById(id);

    if (!result) {
      throw new NotFoundError('Không tìm thấy nhiệm vụ');
    }

    const taskSubject = result.task;
    const taskResource = buildTaskResource(taskSubject);

    // Canonical object authorization check (BOLA protection)
    const authContext = await loadAuthorizationContext(authUser.id);
    const readDecision = authorize(authContext, 'task.read', taskResource);
    if (!readDecision.allowed) {
      throw new ForbiddenError(readDecision.reason || 'Bạn không có quyền xem nhiệm vụ này');
    }

    const availableActions = computeAvailableActions(authContext, taskResource);
    const taskDetail = {
      ...result.task,
      availableActions,
    };

    return apiSuccess(
      {
        success: true,
        task: taskDetail,
        data: taskDetail,
        availableActions,
      },
      {
        headers: {
          'Cache-Control': 'private, no-store',
          ETag: `"${(taskDetail as any).version ?? 1}"`,
        },
        requestId: context.requestId,
      }
    );
  } catch (error) {
    return apiError(error, requestId, { 'Cache-Control': 'private, no-store' });
  }
}

export async function PATCH(req: Request, routeContext: RouteContext) {
  let requestId = crypto.randomUUID();
  try {
    assertCsrf(req);
    assertJsonContentType(req);
    assertRequestBodySize(req, MAX_PAYLOAD_SIZE);

    const context = await getApiContext(req);
    requestId = context.requestId;

    const authUser = requireAuthenticated(context);

    assertRateLimit(authUser.id, 'MUTATIONS_SENSITIVE');

    const { id } = await Promise.resolve(routeContext.params);

    const validatedBody = await parseAndValidateJson(req, UpdateTaskMetadataSchema);

    // Fetch existing task to check existence, OCC, and authorization
    const taskResult = await taskQueryService.getTaskById(id);
    if (!taskResult) {
      throw new NotFoundError('Không tìm thấy nhiệm vụ');
    }
    const existingTask = taskResult.task;

    // 1. Optimistic Concurrency Control (OCC)
    let expectedVersion: number | undefined = undefined;
    const ifMatch = req.headers.get('if-match') || validatedBody.ifMatch;
    if (ifMatch) {
      const cleanIfMatch = ifMatch.replace(/^"|"$/g, '').trim();
      const parsed = parseInt(cleanIfMatch, 10);
      if (Number.isNaN(parsed) || parsed < 1) {
        throw new PreconditionFailedError('Invalid If-Match ETag format');
      }
      expectedVersion = parsed;
    } else if (validatedBody.expectedVersion !== undefined && validatedBody.expectedVersion !== null) {
      expectedVersion = Number(validatedBody.expectedVersion);
    }

    const expectedUpdatedAt = validatedBody.expectedUpdatedAt;
    const currentVersion = Number((existingTask as any).version ?? 1);
    const currentUpdatedAt =
      typeof existingTask.updatedAt === 'string'
        ? existingTask.updatedAt
        : (existingTask.updatedAt as unknown) instanceof Date
        ? ((existingTask.updatedAt as unknown) as Date).toISOString()
        : String(existingTask.updatedAt);

    if (expectedVersion !== undefined) {
      if (Number(expectedVersion) !== currentVersion) {
        if (ifMatch) {
          throw new PreconditionFailedError(
            `Task aggregate version conflict: expected version ${expectedVersion}, current version ${currentVersion}`
          );
        } else {
          throw new ConflictError(
            `xung đột phiên bản (conflict): Dữ liệu nhiệm vụ đã được thay đổi bởi người dùng khác (phiên bản hiệệện tại: ${currentVersion}, phiên bản gửi lên: ${expectedVersion}). Vui lòng tải lại trang.`
          );
        }
      }
    }

    if (ifMatch && expectedVersion === undefined) {
      const cleanIfMatch = ifMatch.replace(/^"|"$/g, '').trim();
      if (cleanIfMatch !== String(currentVersion) && cleanIfMatch !== currentUpdatedAt) {
        throw new PreconditionFailedError(
          'Optimistic concurrency conflict: If-Match header does not match current state'
        );
      }
    }

    if (expectedUpdatedAt) {
      if (new Date(expectedUpdatedAt).getTime() !== new Date(currentUpdatedAt).getTime()) {
        throw new PreconditionFailedError(
          `Task aggregate version conflict: expected updatedAt ${expectedUpdatedAt}, current updatedAt ${currentUpdatedAt}`
        );
      }
    }

    // 2. Object-level & Property-level authorization
    // SPRINT 4 INVARIANT: Generic PATCH is strictly limited to safe metadata (title, description, priority, dueDate).
    // Workflow transitions (status, approved, resolution) are strictly prohibited via PATCH.
    const taskResource = buildTaskResource(existingTask);
    const authContext = await loadAuthorizationContext(authUser.id);
    const updateDecision = authorize(authContext, 'task.update_metadata', taskResource);
    if (!updateDecision.allowed) {
      throw new ForbiddenError(updateDecision.reason || 'Bạn không có quyền cập nhật nhiệm vụ này');
    }

    // Validate ngày trên dữ liệu sau khi ghép PATCH với bản ghi DB (phân biệt trường bị bỏ qua và null)
    let mergedDueDate: Date | null = existingTask.dueDate ? new Date(existingTask.dueDate) : null;
    if (validatedBody.dueDate !== undefined) {
      mergedDueDate = validatedBody.dueDate ? new Date(validatedBody.dueDate) : null;
    }

    if (existingTask.startDate && mergedDueDate) {
      if (new Date(existingTask.startDate).getTime() > mergedDueDate.getTime()) {
        throw new ValidationError(
          'Ngày bắt đầu không được sau thời hạn hoàn thành (Start date cannot be after due date)'
        );
      }
    }

    // 3. Explicit command mapping (No Mass-Assignment) & Atomic update (Safe metadata only)
    const updated = await taskCommandService.updateTask(context, id, {
      title: validatedBody.title,
      description: validatedBody.description,
      dueDate: validatedBody.dueDate,
      priority: validatedBody.priority,
      expectedVersion,
    });

    const taskDetail = toTaskDetailDTO(updated);

    return apiSuccess(
      {
        success: true,
        task: taskDetail,
        data: taskDetail,
      },
      {
        headers: {
          'Cache-Control': 'private, no-store',
          ETag: `"${taskDetail?.version ?? 1}"`,
        },
        requestId: context.requestId,
      }
    );
  } catch (error) {
    return apiError(error, requestId, { 'Cache-Control': 'private, no-store' });
  }
}

export async function DELETE(req: Request, routeContext: RouteContext) {
  let requestId = crypto.randomUUID();
  try {
    assertCsrf(req);
    assertJsonContentType(req);
    assertRequestBodySize(req, MAX_PAYLOAD_SIZE);

    const context = await getApiContext(req);
    requestId = context.requestId;

    const authUser = requireAuthenticated(context);

    assertRateLimit(authUser.id, 'MUTATIONS_SENSITIVE');

    const { id } = await Promise.resolve(routeContext.params);
    const input = await parseAndValidateJson(req, ArchiveTaskSchema);

    const taskResult = await taskQueryService.getTaskById(id);
    if (!taskResult) {
      throw new NotFoundError('Không tìm thấy nhiệm vụ');
    }
    const existingTask = taskResult.task;

    const taskResource = buildTaskResource(existingTask);
    const authContext = await loadAuthorizationContext(authUser.id);
    const archiveDecision = authorize(authContext, 'task.archive', taskResource);
    if (!archiveDecision.allowed) {
      throw new ForbiddenError(archiveDecision.reason || 'Bạn không có quyền lưu trữ nhiệm vụ này');
    }

    const result = await taskCommandService.archiveTask(context, id, input);

    return apiSuccess(
      {
        success: true,
        message: result.message,
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
