import { NextRequest } from "next/server";
import { type ZodType } from "zod";
import type { SessionPayload } from "@/lib/jwt-session";
import { ForbiddenError, NotFoundError } from "@/server/api/errors";
import { apiError, apiSuccess } from "@/server/api/response";
import { resolveTaskSubresourceRequest } from "@/server/api/task-subresource-request";
import { loadCachedAuthorizationContext } from "@/server/authorization/authorization-context-service";
import { prisma } from "@/lib/prisma";
import { authorize } from "@/server/authorization/authorization-engine";
import { buildTaskResource } from "@/server/authorization/available-actions";
import type { CapabilityAction } from "@/server/authorization/capability";
import { taskQueryService } from "@/server/tasks";

export interface ActionRouteContext {
  params: Promise<{ id: string }>;
}

export async function resolveActionContext<T>(
  request: NextRequest,
  context: ActionRouteContext,
  schema: ZodType<T>,
  action: CapabilityAction
): Promise<{ session: SessionPayload; taskId: string; body: T; requestId: string }> {
  const { session, taskId, body, requestId } = await resolveTaskSubresourceRequest(request, context, {
    mutate: true,
    schema,
  });

  const taskResult = await taskQueryService.getTaskById(taskId);
  if (!taskResult) {
    throw new NotFoundError("Không tìm thấy nhiệm vụ");
  }

  const authorizationContext = await loadCachedAuthorizationContext(session.id);
  // DTO không mang TaskActor nên người duyệt được chỉ định (REVIEWER/APPROVER) chưa nhận ra ở cổng route dù dịch vụ
  // bên dưới cho phép; bổ sung các vai trò từ nguồn thật để hai chỗ kiểm quyền cùng một kết luận.
  const actors = await prisma.taskActor.findMany({
    where: { taskId, userId: { not: null } },
    select: { userId: true, role: true, isPrimaryDRI: true },
  });
  const decision = authorize(authorizationContext, action, buildTaskResource({ ...taskResult.task, actors }));
  if (!decision.allowed) {
    throw new ForbiddenError(decision.reason || "Bạn không có quyền thực hiện thao tác này");
  }

  return { session, taskId, body, requestId };
}

/**
 * Route hành động trên nhiệm vụ: kiểm quyền `action` ở cổng route, chạy `run`, trả `{ success, data }`.
 * `rfc9457` bật định dạng lỗi Problem Details như route đó vẫn trả; `status` đổi mã thành công theo kết quả.
 */
export function taskActionRoute<T, R>(
  schema: ZodType<T>,
  action: CapabilityAction,
  run: (session: SessionPayload, taskId: string, body: T) => Promise<R>,
  options: { rfc9457?: boolean; status?: (result: R) => number } = {}
) {
  return async function handler(request: NextRequest, context: ActionRouteContext) {
    let requestId = crypto.randomUUID();
    try {
      const resolved = await resolveActionContext(request, context, schema, action);
      requestId = resolved.requestId;
      const result = await run(resolved.session, resolved.taskId, resolved.body);
      return apiSuccess({ success: true, data: result }, { requestId, status: options.status?.(result) ?? 200 });
    } catch (error) {
      return apiError(
        error,
        requestId,
        options.rfc9457 ? { rfc9457: true, instance: request.nextUrl.pathname } : undefined
      );
    }
  };
}
