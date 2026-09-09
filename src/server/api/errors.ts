import { ZodError } from 'zod';

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
    requestId: string;
  };
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

export class InvalidTransitionError extends ApiError {
  constructor(message = 'Invalid state transition', code = 'INVALID_TRANSITION') {
    super(409, code, message);
  }
}

export class RateLimitError extends ApiError {
  constructor(message = 'Too many requests', code = 'RATE_LIMITED') {
    super(429, code, message);
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
        error: {
          code: error.code,
          message: error.message,
          ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
          requestId,
        },
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
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          fieldErrors,
          requestId,
        },
      },
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        requestId,
      },
    },
  };
}
