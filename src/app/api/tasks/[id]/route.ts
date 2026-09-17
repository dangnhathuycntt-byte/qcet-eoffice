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

    // Object authorization check (BOLA protection)
    if (!canReadTask(authUser, taskSubject)) {
      throw new ForbiddenError('Bạn không có quyền xem nhiệm vụ này');
    }

    const taskDetail = result.task;

    return apiSuccess(
      {
        success: true,
        task: taskDetail,
        data: taskDetail,
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

    // SPRINT 4 INVARIANT: Generic PATCH is strictly limited to safe metadata (title, description, priority, dueDate).
    // Workflow transitions (status, approved, resolution) are strictly prohibited via generic PATCH.
    try {
      const rawReq = req.clone();
      const rawBody = (await rawReq.json().catch(() => null)) as Record<string, unknown> | null;
      if (
        rawBody &&
        (rawBody.status !== undefined ||
          rawBody.approved !== undefined ||
          rawBody.resolution !== undefined)
      ) {
        throw new ValidationError(
          'Cấm cập nhật trực tiếp trạng thái (status), nghiệm thu hoàn thành (approved), hoặc kết quả (resolution) qua generic PATCH. Vui lòng sử dụng các endpoint canonical domain actions (/actions/*).',
          undefined,
          'CANONICAL_COMMAND_REQUIRED'
        );
      }
    } catch (e) {
      if (e instanceof ValidationError) throw e;
    }

    const validatedBody = await parseAndValidateJson(req, UpdateTaskSchema);

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
    if (
      validatedBody.status !== undefined ||
      (validatedBody as any).approved !== undefined ||
      validatedBody.resolution !== undefined
    ) {
      throw new ValidationError(
        'Cấm cập nhật trực tiếp trạng thái (status), nghiệm thu hoàn thành (approved), hoặc kết quả (resolution) qua generic PATCH. Vui lòng sử dụng các endpoint canonical domain actions (/actions/*).',
        undefined,
        'CANONICAL_COMMAND_REQUIRED'
      );
    }

    if (!canUpdateTask(authUser, existingTask)) {
      throw new ForbiddenError('Bạn không có quyền cập nhật nhiệm vụ này');
    }

    // Validate ngày trên dữ liệu sau khi ghép PATCH với bản ghi DB (phân biệt trường bị bỏ qua và null)
    let mergedStartDate: Date | null = existingTask.startDate ? new Date(existingTask.startDate) : null;
    if (validatedBody.startDate !== undefined) {
      mergedStartDate = validatedBody.startDate ? new Date(validatedBody.startDate) : null;
    }

    let mergedDueDate: Date | null = existingTask.dueDate ? new Date(existingTask.dueDate) : null;
    if (validatedBody.dueDate !== undefined) {
      mergedDueDate = validatedBody.dueDate ? new Date(validatedBody.dueDate) : null;
    }

    if (mergedStartDate && mergedDueDate) {
      if (mergedStartDate.getTime() > mergedDueDate.getTime()) {
        throw new ValidationError(
          'Ngày bắt đầu không được sau thời hạn hoàn thành (Start date cannot be after due date)'
        );
      }
    }

    // 3. Explicit command mapping (No Mass-Assignment) & Atomic update (Safe metadata only)
    const updated = await taskCommandService.updateTask(context, id, {
      title: validatedBody.title,
      description: validatedBody.description,
      departmentId: validatedBody.departmentId,
      startDate: validatedBody.startDate,
      dueDate: validatedBody.dueDate,
      priority: validatedBody.priority,
      assigneeId: validatedBody.assigneeId,
      collaboratorIds: validatedBody.collaboratorIds,
      academicMonth: validatedBody.academicMonth,
      academicYear: validatedBody.academicYear,
      parentTaskId: validatedBody.parentTaskId,
      comment: validatedBody.comment,
      note: validatedBody.note,
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

    const context = await getApiContext(req);
    requestId = context.requestId;

    const authUser = requireAuthenticated(context);

    assertRateLimit(authUser.id, 'MUTATIONS_SENSITIVE');

    const { id } = await Promise.resolve(routeContext.params);

    const taskResult = await taskQueryService.getTaskById(id);
    if (!taskResult) {
      throw new NotFoundError('Không tìm thấy nhiệm vụ');
    }
    const existingTask = taskResult.task;

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
