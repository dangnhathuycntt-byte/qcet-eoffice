import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSessionFromRequest, SessionPayload } from "@/lib/jwt-session";
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
  HybridAuthorizationError,
} from "@/lib/auth/hybrid-authorization";
import {
  SegregationOfDutiesError,
  MakerCheckerError,
  TaskActorAuthorizationError,
  StepProgressionError,
} from "@/lib/services/task-actor-service";

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

  if (error instanceof HybridAuthorizationError) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        code: error.rejectionCode || "FORBIDDEN",
      },
      { status: error.statusCode || 403 }
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
  context: ActionRouteContext
): Promise<{ session: SessionPayload; taskId: string; body: any }> {
  const session = await getSessionFromRequest(request);
  if (!session) {
    throw new AuthenticationError("Yêu cầu xác thực tài khoản", "AUTH_REQUIRED");
  }

  const { id: taskId } = await Promise.resolve(context.params);
  if (!taskId || !taskId.trim()) {
    throw new ValidationError("Mã nhiệm vụ (id) không hợp lệ");
  }

  let body: any = {};
  try {
    const text = await request.text();
    if (text && text.trim()) {
      body = JSON.parse(text);
    }
  } catch (err) {
    throw new ValidationError("Dữ liệu JSON không đúng định dạng");
  }

  return { session, taskId, body };
}
