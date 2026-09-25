import { NextRequest } from "next/server";
import { type ZodType } from "zod";
import type { SessionPayload } from "@/lib/jwt-session";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/server/api/errors";
import { apiError } from "@/server/api/response";
import { assertCsrf } from "@/server/security/csrf";
import { assertRateLimit } from "@/server/security/rate-limit";
import {
  assertJsonContentType,
  assertRequestBodySize,
  MAX_PAYLOAD_SIZE,
  parseAndValidateJson,
} from "@/server/api/validation";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { loadAuthorizationContext } from "@/server/authorization/authorization-context-service";
import { authorize } from "@/server/authorization/authorization-engine";
import { buildTaskResource } from "@/server/authorization/available-actions";
import type { CapabilityAction } from "@/server/authorization/capability";
import { taskQueryService } from "@/server/tasks";

export interface ActionRouteContext {
  params: Promise<{ id: string }>;
}

export function handleActionError(error: any, requestId?: string) {
  return apiError(error, requestId || crypto.randomUUID());
}

export async function resolveActionContext(
  request: NextRequest,
  context: ActionRouteContext,
  schema: ZodType,
  action: CapabilityAction
): Promise<{ session: SessionPayload; taskId: string; body: any; requestId: string }> {
  assertCsrf(request);
  assertJsonContentType(request);
  assertRequestBodySize(request, MAX_PAYLOAD_SIZE);

  const apiContext = await getApiContext(request);
  const user = requireAuthenticated(apiContext);
  await assertRateLimit(user.id, "MUTATIONS_SENSITIVE");

  const { id: taskId } = await Promise.resolve(context.params);
  if (!taskId || !taskId.trim()) {
    throw new ValidationError("Mã nhiệm vụ (id) không hợp lệ");
  }

  const body = await parseAndValidateJson(request, schema);
  const taskResult = await taskQueryService.getTaskById(taskId);
  if (!taskResult) {
    throw new NotFoundError("Không tìm thấy nhiệm vụ");
  }

  const authorizationContext = await loadAuthorizationContext(user.id, new Date(), { useCache: true, ttlMs: 10_000 });
  const decision = authorize(authorizationContext, action, buildTaskResource(taskResult.task));
  if (!decision.allowed) {
    throw new ForbiddenError(decision.reason || "Bạn không có quyền thực hiện thao tác này");
  }

  const session = user as unknown as SessionPayload;

  return { session, taskId, body, requestId: apiContext.requestId };
}
