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
import { NotFoundError, ForbiddenError, ConflictError } from '@/server/api/errors';
import { UpdateTaskSchema } from '@/contracts/tasks';
import { taskQueryService, taskCommandService } from '@/server/tasks';
import {
  canReadTask,
  canUpdateTask,
  canApproveTask,
  canChangeTaskStatus,
  canDeleteTask,
} from '@/server/policies/task-policy';
import { toTaskDetailDTO } from '@/server/dto/task-dto';

interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
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

    const taskSubject = result.raw || result.task;

    // Object authorization check (BOLA protection)
    if (!canReadTask(authUser, taskSubject)) {
      throw new ForbiddenError('Bạn không có quyền xem nhiệm vụ này');
    }

    const taskDetail = toTaskDetailDTO(taskSubject);

    return apiSuccess(
      {
        success: true,
        task: taskDetail,
        data: taskDetail,
        raw: result.raw,
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
    const validatedBody = await parseAndValidateJson(req, UpdateTaskSchema);

    // Fetch existing task to check existence, OCC, and authorization
    const taskResult = await taskQueryService.getTaskById(id);
    if (!taskResult) {
      throw new NotFoundError('Không tìm thấy nhiệm vụ');
    }
    const existingTask = taskResult.raw || taskResult.task;

    // 1. Optimistic Concurrency Control (OCC)
    const expectedVersion = validatedBody.expectedVersion;
    const ifMatch = req.headers.get('if-match') || validatedBody.ifMatch;
    const expectedUpdatedAt = validatedBody.expectedUpdatedAt;

    const currentVersion = Number((existingTask as any).version ?? 1);
    const currentUpdatedAt =
      existingTask.updatedAt instanceof Date
        ? existingTask.updatedAt.toISOString()
        : String(existingTask.updatedAt);

    if (expectedVersion !== undefined && expectedVersion !== null) {
      if (Number(expectedVersion) !== currentVersion) {
        throw new ConflictError(
          `Optimistic concurrency conflict: task has been modified (expected version ${expectedVersion}, current version ${currentVersion})`,
          'CONFLICT'
        );
      }
    }

    if (ifMatch) {
      const cleanIfMatch = ifMatch.replace(/^"|"$/g, '').trim();
      if (cleanIfMatch !== String(currentVersion) && cleanIfMatch !== currentUpdatedAt) {
        throw new ConflictError(
          'Optimistic concurrency conflict: If-Match header does not match current state',
          'CONFLICT'
        );
      }
    }

    if (expectedUpdatedAt) {
      if (new Date(expectedUpdatedAt).getTime() !== new Date(currentUpdatedAt).getTime()) {
        throw new ConflictError(
          `Optimistic concurrency conflict: task has been modified (expected updatedAt ${expectedUpdatedAt}, current updatedAt ${currentUpdatedAt})`,
          'CONFLICT'
        );
      }
    }

    // 2. Object-level & Property-level authorization
    const isApprovalAction =
      validatedBody.status?.toUpperCase() === 'COMPLETED' ||
      validatedBody.resolution?.toUpperCase() === 'APPROVED' ||
      validatedBody.approved === true;

    if (isApprovalAction) {
      if (!canApproveTask(authUser, existingTask)) {
        throw new ForbiddenError(
          'Bạn không có quyền nghiệm thu hoàn thành nhiệm vụ này hoặc không được tự nghiệm thu nhiệm vụ của mình'
        );
      }
    } else if (validatedBody.status) {
      if (!canChangeTaskStatus(authUser, existingTask, validatedBody.status)) {
        throw new ForbiddenError('Bạn không có quyền chuyển đổi trạng thái nhiệm vụ này');
      }
    } else {
      if (!canUpdateTask(authUser, existingTask)) {
        throw new ForbiddenError('Bạn không có quyền cập nhật nhiệm vụ này');
      }
    }

    // 3. Explicit command mapping (No Mass-Assignment) & Atomic update
    const updated = await taskCommandService.updateTask(context, id, {
      title: validatedBody.title,
      description: validatedBody.description,
      departmentId: validatedBody.departmentId,
      dueDate: validatedBody.dueDate ?? undefined,
      priority: validatedBody.priority,
      status: validatedBody.status,
      progress: validatedBody.progress ?? validatedBody.progressPercent,
      progressPercent: validatedBody.progressPercent ?? validatedBody.progress,
      academicMonth: validatedBody.academicMonth,
      academicYear: validatedBody.academicYear,
      assigneeId: validatedBody.assigneeId,
      collaboratorIds: validatedBody.collaboratorIds,
      parentTaskId: validatedBody.parentTaskId,
      resolution: validatedBody.resolution,
      comment: validatedBody.comment,
      note: validatedBody.note,
    });

    const taskDetail = toTaskDetailDTO(updated);

    return apiSuccess(
      {
        success: true,
        task: taskDetail,
        data: taskDetail,
        raw: updated,
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

export async function DELETE(req: Request, routeContext: RouteContext) {
  let requestId = crypto.randomUUID();
  try {
    assertCsrf(req);

    const context = await getApiContext(req);
    requestId = context.requestId;

    const authUser = requireAuthenticated(context);

    assertRateLimit(authUser.id, 'MUTATIONS_SENSITIVE');

    const { id } = await Promise.resolve(routeContext.params);

    const taskResult = await taskQueryService.getTaskById(id);
    if (!taskResult) {
      throw new NotFoundError('Không tìm thấy nhiệm vụ');
    }
    const existingTask = taskResult.raw || taskResult.task;

    if (!canDeleteTask(authUser, existingTask)) {
      throw new ForbiddenError('Bạn không có quyền xóa nhiệm vụ này');
    }

    const result = await taskCommandService.deleteTask(context, id);

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
