import { ZodError } from 'zod';

export interface ApiErrorResponse {
  success: false;
  error: string; // for backward compatibility with .claude/rules/backend-security.md
  code: string; // AUTH_REQUIRED | FORBIDDEN | VALIDATION_ERROR | NOT_FOUND | CONFLICT | PRECONDITION_FAILED | INVALID_TRANSITION | RATE_LIMITED | INTERNAL_ERROR
  message: string;
  fieldErrors?: Record<string, string[]>;
  requestId: string;
}

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly fieldErrors?: Record<string, string[]>;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    fieldErrors?: Record<string, string[]>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.fieldErrors = fieldErrors;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AuthenticationError extends ApiError {
  constructor(message = 'Authentication required', code = 'AUTH_REQUIRED') {
    super(401, code, message);
  }
}

export class AuthorizationError extends ApiError {
  constructor(message = 'Access forbidden', code = 'FORBIDDEN') {
    super(403, code, message);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Access forbidden', code = 'FORBIDDEN') {
    super(403, code, message);
  }
}

export class ValidationError extends ApiError {
  constructor(
    message = 'Validation failed',
    fieldErrors?: Record<string, string[]>,
    code = 'VALIDATION_ERROR'
  ) {
    super(400, code, message, fieldErrors);
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND') {
    super(404, code, message);
  }
}

export class ConflictError extends ApiError {
  constructor(message = 'Resource conflict', code = 'CONFLICT') {
    super(409, code, message);
  }
}

export class PreconditionFailedError extends ApiError {
  constructor(message = 'Precondition failed', code = 'PRECONDITION_FAILED') {
    super(412, code, message);
  }
}

export class InvalidTransitionError extends ApiError {
  public fromStatus?: string;
  public toStatus?: string;
  public reason?: string;

  constructor(
    message = 'Invalid state transition',
    code = 'INVALID_TRANSITION',
    details?: { fromStatus?: string; toStatus?: string; reason?: string }
  ) {
    super(409, code, message);
    if (details) {
      this.fromStatus = details.fromStatus;
      this.toStatus = details.toStatus;
      this.reason = details.reason;
      (this as any).details = details;
    }
  }
}

export class RateLimitError extends ApiError {
  public retryAfter?: number;

  constructor(
    message = 'Too many requests',
    codeOrRetryAfter: string | number = 'RATE_LIMITED',
    retryAfter?: number
  ) {
    let code = 'RATE_LIMITED';
    let retry = retryAfter;
    if (typeof codeOrRetryAfter === 'number') {
      retry = codeOrRetryAfter;
    } else if (typeof codeOrRetryAfter === 'string') {
      code = codeOrRetryAfter;
    }
    super(429, code, message);
    this.retryAfter = retry;
  }
}

export class PayloadTooLargeError extends ApiError {
  constructor(message = 'Payload too large', code = 'PAYLOAD_TOO_LARGE') {
    super(413, code, message);
  }
}

export class UnsupportedMediaTypeError extends ApiError {
  constructor(message = 'Unsupported media type', code = 'UNSUPPORTED_MEDIA_TYPE') {
    super(415, code, message);
  }
}

export function toApiErrorResponse(
  error: unknown,
  requestId: string
): { status: number; body: ApiErrorResponse } {
  if (error instanceof ApiError) {
    return {
      status: error.statusCode,
      body: {
        success: false,
        error: error.message,
        code: error.code,
        message: error.message,
        ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
        requestId,
      },
    };
  }

  const isZodError =
    error instanceof ZodError ||
    (typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      (error as { name?: unknown }).name === 'ZodError' &&
      'issues' in error &&
      Array.isArray((error as { issues?: unknown }).issues));

  if (isZodError) {
    const zodError = error as ZodError;
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of zodError.issues) {
      const pathKey = issue.path.length > 0 ? issue.path.join('.') : '_root';
      if (!fieldErrors[pathKey]) {
        fieldErrors[pathKey] = [];
      }
      fieldErrors[pathKey].push(issue.message);
    }
    return {
      status: 400,
      body: {
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        fieldErrors,
        requestId,
      },
    };
  }

  if (error && typeof error === 'object' && 'rejectionCode' in error) {
    const authError = error as { message?: string; rejectionCode?: string; statusCode?: number };
    const status = authError.statusCode || 403;
    const message = authError.message || 'Access forbidden';
    return {
      status,
      body: {
        success: false,
        error: message,
        code: authError.rejectionCode || 'FORBIDDEN',
        message,
        requestId,
      },
    };
  }

  if (
    error &&
    typeof error === 'object' &&
    ('statusCode' in error || 'status' in error) &&
    'code' in error
  ) {
    const customErr = error as {
      statusCode?: number;
      status?: number;
      code: string;
      message?: string;
    };
    const status = customErr.statusCode || customErr.status || 409;
    const message = customErr.message || 'Conflict';
    return {
      status,
      body: {
        success: false,
        error: message,
        code: customErr.code,
        message,
        requestId,
      },
    };
  }

  return {
    status: 500,
    body: {
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      requestId,
    },
  };
}

export interface ParsedApiError {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
  requestId?: string;
}

/**
 * Client-side parsing helper that safely parses API error payloads
 * so UI components never need to parse raw Vietnamese error strings.
 * Supports canonical flat error shapes, legacy `{ error: string }`,
 * and nested error responses.
 */
export function parseApiError(data: unknown): ParsedApiError {
  if (!data) {
    return {
      code: 'INTERNAL_ERROR',
      message: 'Đã xảy ra lỗi không xác định. Vui lòng thử lại.',
    };
  }

  if (typeof data === 'string') {
    return {
      code: 'UNKNOWN_ERROR',
      message: data,
    };
  }

  if (data instanceof Error) {
    return {
      code: 'INTERNAL_ERROR',
      message: data.message || 'Đã xảy ra lỗi hệ thống.',
    };
  }

  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;

    // Case 1: Nested error object { error: { code, message, fieldErrors, requestId } }
    if (obj.error && typeof obj.error === 'object') {
      const nested = obj.error as Record<string, unknown>;
      const code = typeof nested.code === 'string' ? nested.code : 'UNKNOWN_ERROR';
      const message =
        typeof nested.message === 'string'
          ? nested.message
          : typeof nested.error === 'string'
            ? nested.error
            : 'Đã xảy ra lỗi.';
      const requestId = typeof nested.requestId === 'string' ? nested.requestId : undefined;
      const fieldErrors =
        nested.fieldErrors && typeof nested.fieldErrors === 'object'
          ? (nested.fieldErrors as Record<string, string[]>)
          : undefined;

      return {
        code,
        message,
        ...(fieldErrors ? { fieldErrors } : {}),
        ...(requestId ? { requestId } : {}),
      };
    }

    // Case 2: Canonical flat contract { error: string, code: string, message: string, fieldErrors?, requestId }
    const code = typeof obj.code === 'string' ? obj.code : 'UNKNOWN_ERROR';
    const message =
      typeof obj.message === 'string'
        ? obj.message
        : typeof obj.error === 'string'
          ? obj.error
          : 'Đã xảy ra lỗi.';
    const requestId = typeof obj.requestId === 'string' ? obj.requestId : undefined;
    const fieldErrors =
      obj.fieldErrors && typeof obj.fieldErrors === 'object'
        ? (obj.fieldErrors as Record<string, string[]>)
        : undefined;

    return {
      code,
      message,
      ...(fieldErrors ? { fieldErrors } : {}),
      ...(requestId ? { requestId } : {}),
    };
  }

  return {
    code: 'INTERNAL_ERROR',
    message: 'Đã xảy ra lỗi không xác định.',
  };
}
