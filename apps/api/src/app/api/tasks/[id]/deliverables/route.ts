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
import { SubmitDeliverableInputSchema, ReviewDeliverableInputSchema } from '@qcet/contracts/tasks';
import { taskQueryService, taskCommandService } from '@/server/tasks';
import { loadAuthorizationContext } from '@/server/authorization/authorization-context-service';
import { authorize } from '@/server/authorization/authorization-engine';
import { buildTaskResource } from '@/server/authorization/available-actions';
import { toTaskDeliverableDTO } from '@/server/dto/task-dto';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/** Nạp nhiệm vụ và kiểm quyền `action` trên nó; ném 404/403 nếu không đủ điều kiện. */
async function assertTaskAction(
  userId: string,
  taskId: string,
  action: 'task.submit_result' | 'task.review' | 'task.update_execution',
  deniedMessage: string
) {
  const taskResult = await taskQueryService.getTaskById(taskId);
  if (!taskResult) {
    throw new NotFoundError('Không tìm thấy nhiệm vụ');
  }
  const authContext = await loadAuthorizationContext(userId);
  const decision = authorize(authContext, action, buildTaskResource(taskResult.task));
  if (!decision.allowed) {
    throw new ForbiddenError(decision.reason || deniedMessage);
  }
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

    await assertRateLimit(authUser.id, 'MUTATIONS_SENSITIVE');

    const { id: taskId } = await Promise.resolve(routeContext.params);

    await assertTaskAction(
      authUser.id,
      taskId,
      'task.submit_result',
      'Bạn không có quyền nộp minh chứng cho nhiệm vụ này hoặc nhiệm vụ đã bị hủy'
    );

    const validatedInput = await parseAndValidateJson(req, SubmitDeliverableInputSchema);

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
        headers: NO_STORE,
        requestId: context.requestId,
      }
    );
  } catch (error) {
    return apiError(error, requestId, { headers: NO_STORE });
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

    await assertRateLimit(authUser.id, 'MUTATIONS_SENSITIVE');

    const { id: taskId } = await Promise.resolve(routeContext.params);

    await assertTaskAction(authUser.id, taskId, 'task.review', 'Bạn không có quyền đánh giá minh chứng cho nhiệm vụ này');

    const validatedInput = await parseAndValidateJson(req, ReviewDeliverableInputSchema);

    // Atomic review transaction: checks SoD, updates deliverable & task status, logs audit
    const deliverable = await taskCommandService.reviewDeliverable(context, taskId, {
      deliverableId: validatedInput.deliverableId || '',
      reviewStatus: validatedInput.reviewStatus,
      reviewNote: validatedInput.reviewNote,
      expectedVersion: validatedInput.expectedVersion,
    });

    const deliverableDto = toTaskDeliverableDTO(deliverable);

    return apiSuccess(
      {
        success: true,
        deliverable: deliverableDto,
        data: deliverableDto,
      },
      {
        headers: NO_STORE,
        requestId: context.requestId,
      }
    );
  } catch (error) {
    return apiError(error, requestId, { headers: NO_STORE });
  }
}

export async function DELETE(req: Request, routeContext: RouteContext) {
  let requestId = crypto.randomUUID();
  try {
    assertCsrf(req);
    const context = await getApiContext(req);
    requestId = context.requestId;

    const authUser = requireAuthenticated(context);
    await assertRateLimit(authUser.id, 'MUTATIONS_SENSITIVE');

    const { id: taskId } = await Promise.resolve(routeContext.params);

    await assertTaskAction(authUser.id, taskId, 'task.update_execution', 'Bạn không có quyền xóa minh chứng của nhiệm vụ này');

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
        headers: NO_STORE,
        requestId: context.requestId,
      }
    );
  } catch (error) {
    return apiError(error, requestId, { headers: NO_STORE });
  }
}
