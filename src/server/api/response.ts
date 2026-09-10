import { NextResponse } from 'next/server';
import { toApiErrorResponse, type ApiErrorResponse } from './errors';
import { logger } from '@/server/observability/logger';

export interface ApiErrorOptions {
  headers?: HeadersInit;
  legacyCompat?: boolean;
}

export function apiError(
  error: unknown,
  requestId: string,
  headersOrOptions?: HeadersInit | ApiErrorOptions,
  options?: ApiErrorOptions
): NextResponse<any> {
  let headers: HeadersInit | undefined;
  let legacyCompat = false;

  if (
    headersOrOptions &&
    typeof headersOrOptions === 'object' &&
    !('append' in headersOrOptions) &&
    !Array.isArray(headersOrOptions) &&
    ('headers' in headersOrOptions || 'legacyCompat' in headersOrOptions)
  ) {
    headers = (headersOrOptions as ApiErrorOptions).headers;
    legacyCompat = Boolean((headersOrOptions as ApiErrorOptions).legacyCompat);
  } else {
    headers = headersOrOptions as HeadersInit | undefined;
    legacyCompat = Boolean(options?.legacyCompat);
  }

  const { status, body } = toApiErrorResponse(error, requestId);

  // Structured logging for security-critical events (denied authorization, invalid transitions, concurrency conflicts)
  const errObj = (error && typeof error === 'object' ? error : {}) as Record<string, any>;
  const errorDetails = body.error || errObj.message;

  if (
    body.code === 'INVALID_TRANSITION' ||
    body.code === 'INVALID_WORKFLOW_STATE' ||
    body.code === 'INVALID_STATE' ||
    errObj.code === 'INVALID_TRANSITION' ||
    errObj.code === 'INVALID_WORKFLOW_STATE' ||
    errObj.name === 'InvalidTransitionError' ||
    errObj.name === 'InvalidWorkflowStateError'
  ) {
    logger.invalidTransition({
      requestId,
      userId: errObj.userId || null,
      entity: errObj.entity || undefined,
      entityId: errObj.entityId || errObj.id || undefined,
      fromState: errObj.fromState || undefined,
      toState: errObj.toState || undefined,
      reason: body.message,
      metadata: { errorDetails, code: body.code },
    });
  } else if (
    body.code === 'CONCURRENCY_CONFLICT' ||
    body.code === 'IDEMPOTENCY_CONFLICT' ||
    errObj.code === 'CONCURRENCY_CONFLICT' ||
    errObj.code === 'IDEMPOTENCY_CONFLICT' ||
    errObj.name === 'ConcurrencyConflictError' ||
    errObj.name === 'IdempotencyConflictError' ||
    status === 409
  ) {
    logger.concurrencyConflict({
      requestId,
      userId: errObj.userId || null,
      entity: errObj.entity || undefined,
      entityId: errObj.entityId || errObj.id || undefined,
      expectedVersion: errObj.expectedVersion,
      actualVersion: errObj.actualVersion,
      metadata: { message: body.message, errorDetails },
    });
  } else if (
    status === 403 ||
    body.code === 'FORBIDDEN' ||
    Boolean(errObj.rejectionCode) ||
    errObj.name === 'HybridAuthorizationError' ||
    errObj.name === 'AuthorizationError'
  ) {
    logger.authorizationDenied({
      requestId,
      userId: errObj.userId || null,
      action: errObj.action || undefined,
      resourceId: errObj.resourceId || errObj.id || undefined,
      reason: body.message,
      metadata: { errorDetails, rejectionCode: errObj.rejectionCode || body.code },
    });
  }

  const responseHeaders = new Headers(headers);
  if (!responseHeaders.has('x-request-id')) {
    responseHeaders.set('x-request-id', requestId);
  }

  if (legacyCompat) {
    const rawBody = body as Record<string, any>;
    const code =
      rawBody.code ||
      (typeof rawBody.error === 'object' && rawBody.error?.code) ||
      'INTERNAL_ERROR';
    const message =
      rawBody.message ||
      (typeof rawBody.error === 'object' && rawBody.error?.message) ||
      (typeof rawBody.error === 'string' ? rawBody.error : 'Internal server error');
    const fieldErrors =
      rawBody.fieldErrors ||
      (typeof rawBody.error === 'object' && rawBody.error?.fieldErrors);

    const legacyErrorMessage =
      status === 401 && (code === 'AUTH_REQUIRED' || code === 'UNAUTHORIZED')
        ? 'Unauthorized: Authentication required'
        : message;

    const legacyBody = {
      success: false,
      error: legacyErrorMessage,
      errors: fieldErrors
        ? Object.values(fieldErrors).flat()
        : [legacyErrorMessage],
      code,
      message: legacyErrorMessage,
      ...(fieldErrors ? { fieldErrors } : {}),
      errorDetails: typeof rawBody.error === 'object' ? rawBody.error : message,
      requestId,
    };
    return NextResponse.json(legacyBody, {
      status,
      headers: responseHeaders,
    });
  }

  return NextResponse.json(body, {
    status,
    headers: responseHeaders,
  });
}

export interface ApiSuccessOptions {
  status?: number;
  headers?: HeadersInit;
  requestId?: string;
  legacyCompat?: boolean;
}

export function apiSuccess<T>(
  data: T,
  init?: ApiSuccessOptions
): NextResponse<T> {
  const status = init?.status ?? 200;
  const responseHeaders = new Headers(init?.headers);
  if (init?.requestId && !responseHeaders.has('x-request-id')) {
    responseHeaders.set('x-request-id', init.requestId);
  }

  let responseBody: any = data;
  if (init?.legacyCompat && typeof data === 'object' && data !== null && !Array.isArray(data)) {
    responseBody = {
      success: true,
      ...data,
    };
  }

  return NextResponse.json(responseBody, {
    status,
    headers: responseHeaders,
  });
}

export { toApiErrorResponse };
export type { ApiErrorResponse };
