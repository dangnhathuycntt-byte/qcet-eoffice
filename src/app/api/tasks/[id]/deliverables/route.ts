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
import { NotFoundError, ForbiddenError } from '@/server/api/errors';
import { SubmitDeliverableSchema, ReviewDeliverableInputSchema } from '@/contracts/tasks';
import { taskQueryService, taskCommandService } from '@/server/tasks';
import { loadAuthorizationContext } from '@/server/authorization/authorization-context-service';
import { authorize } from '@/server/authorization/authorization-engine';
import { buildTaskResource } from '@/server/authorization/available-actions';
import { toTaskDeliverableDTO } from '@/server/dto/task-dto';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, routeContext: RouteContext) {
  let requestId = crypto.randomUUID();
  try {
    assertCsrf(req);
    assertJsonContentType(req);
    assertRequestBodySize(req, MAX_PAYLOAD_SIZE);

    const context = await getApiContext(req);
    requestId = context.requestId;

    const authUser = requireAuthenticated(context);

    assertRateLimit(authUser.id, 'MUTATIONS_SENSITIVE');

    const { id: taskId } = await Promise.resolve(routeContext.params);

    const taskResult = await taskQueryService.getTaskById(taskId);
    if (!taskResult) {
      throw new NotFoundError('Không tìm thấy nhiệm vụ');
    }

    const existingTask = taskResult.task;

    // Canonical object authorization check
    const taskResource = buildTaskResource(existingTask);
    const authContext = await loadAuthorizationContext(authUser.id);
    const submitDecision = authorize(authContext, 'task.submit_result', taskResource);
    if (!submitDecision.allowed) {
      throw new ForbiddenError(
        submitDecision.reason ||
          'Bạn không có quyền nộp minh chứng cho nhiệm vụ này hoặc nhiệm vụ đã bị hủy'
      );
    }

    const validatedInput = await parseAndValidateJson(req, SubmitDeliverableSchema);

    // Atomic transaction: creates deliverable + updates task state + audit log
    const deliverable = await taskCommandService.submitDeliverable(context, taskId, {
      title: validatedInput.title,
      fileUrl: validatedInput.fileUrl,
      fileName: validatedInput.fileName,
      fileType: validatedInput.fileType,
      fileSize: validatedInput.fileSize,
      notes: validatedInput.notes ?? validatedInput.note,
    });

    const deliverableDto = toTaskDeliverableDTO(deliverable);

    return apiSuccess(
      {
        success: true,
        deliverable: deliverableDto,
        data: deliverableDto,
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

    const { id: taskId } = await Promise.resolve(routeContext.params);

    const validatedInput = await parseAndValidateJson(req, ReviewDeliverableInputSchema);

    // Atomic review transaction: checks SoD, updates deliverable & task status, logs audit
    const deliverable = await taskCommandService.reviewDeliverable(context, taskId, {
      deliverableId: validatedInput.deliverableId || '',
      reviewStatus: validatedInput.reviewStatus,
      reviewNote: validatedInput.reviewNote,
    });

    const deliverableDto = toTaskDeliverableDTO(deliverable);

    return apiSuccess(
      {
        success: true,
        deliverable: deliverableDto,
        data: deliverableDto,
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

    const { id: taskId } = await Promise.resolve(routeContext.params);
    const url = new URL(req.url);
    const deliverableId =
      url.searchParams.get('deliverableId') || url.searchParams.get('id');

    if (!deliverableId) {
      throw new NotFoundError('Mã tài liệu minh chứng (deliverableId) là bắt buộc');
    }

    const result = await taskCommandService.deleteDeliverable(
      context,
      taskId,
      deliverableId
    );

    return apiSuccess(
      {
        success: true,
        deliverableId,
        deletedId: deliverableId,
        data: result,
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
