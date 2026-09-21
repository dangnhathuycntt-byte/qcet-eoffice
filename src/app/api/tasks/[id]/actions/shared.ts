import { NextRequest, NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import type { SessionPayload } from "@/lib/jwt-session";
import {
  ApiError,
  AuthenticationError,
  AuthorizationError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConflictError,
  InvalidTransitionError,
} from "@/server/api/errors";
import {
  SeparationOfDutiesError,
  SingleDRIError,
  SeparationOfPowersError,
  UnitScopeDeniedError,
  PortfolioMismatchError,
  DelegationExpiredError,
  DelegationRevokedError,
  NonDelegablePowerError,
  InvalidWorkflowStateError,
} from "@/server/authorization/errors";
import {
  SegregationOfDutiesError,
  MakerCheckerError,
  TaskActorAuthorizationError,
  StepProgressionError,
} from "@/lib/services/task-actor-service";
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

export function handleActionError(error: any) {
  console.error("[TaskActionError]", error);

  // SoD / Maker-Checker errors -> 403 Forbidden
  if (
    error instanceof SeparationOfDutiesError ||
    error instanceof SegregationOfDutiesError ||
    error instanceof MakerCheckerError
  ) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        code: "SOD_VIOLATION",
      },
      { status: 403 }
    );
  }

  // Single DRI violations -> 403 Forbidden
  if (error instanceof SingleDRIError) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        code: "COLLABORATOR_CANNOT_REASSIGN_DRI",
      },
      { status: 403 }
    );
  }

  // Task actor authorization or hybrid authorization errors
  if (error instanceof TaskActorAuthorizationError) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        code: "FORBIDDEN",
      },
      { status: 403 }
    );
  }

  if (error instanceof StepProgressionError) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        code: "STEP_PROGRESSION_ERROR",
      },
      { status: 400 }
    );
  }

  // State Transition Error -> 409 Conflict with domain details
  if (error instanceof InvalidTransitionError) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        code: error.code || "INVALID_STATUS_TRANSITION",
        fromStatus: error.fromStatus,
        toStatus: error.toStatus,
        reason: error.reason || error.message,
      },
      { status: error.statusCode || 409 }
    );
  }

  // Standard ApiError subclasses
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        code: error.code,
      },
      { status: error.statusCode }
    );
  }

  // Zod validation errors -> 400
  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    const message = firstIssue ? firstIssue.message : "Dữ liệu yêu cầu không hợp lệ";
    return NextResponse.json(
      {
        success: false,
        error: message,
        code: "VALIDATION_ERROR",
      },
      { status: 400 }
    );
  }

  // Generic unhandled error -> 500
  return NextResponse.json(
    {
      success: false,
      error: error?.message || "Lỗi xử lý hệ thống",
      code: "INTERNAL_ERROR",
    },
    { status: 500 }
  );
}

export async function resolveActionContext(
  request: NextRequest,
  context: ActionRouteContext,
  schema: ZodType,
  action: CapabilityAction
): Promise<{ session: SessionPayload; taskId: string; body: any }> {
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

  return { session, taskId, body };
}
