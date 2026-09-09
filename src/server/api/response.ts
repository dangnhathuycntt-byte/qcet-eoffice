import { NextResponse } from 'next/server';
import { toApiErrorResponse, type ApiErrorResponse } from './errors';

export interface ApiErrorOptions {
  headers?: HeadersInit;
  legacyCompat?: boolean;
}

export function apiError(
  error: unknown,
  requestId: string,
  optionsOrHeaders?: HeadersInit | ApiErrorOptions
): NextResponse<ApiErrorResponse> {
  const isOptions =
    optionsOrHeaders &&
    typeof optionsOrHeaders === 'object' &&
    !('append' in optionsOrHeaders) &&
    !Array.isArray(optionsOrHeaders) &&
    ('headers' in optionsOrHeaders || 'legacyCompat' in optionsOrHeaders);

  const headers = isOptions
    ? (optionsOrHeaders as ApiErrorOptions).headers
    : (optionsOrHeaders as HeadersInit);

  const { status, body } = toApiErrorResponse(error, requestId);
  const responseHeaders = new Headers(headers);
  if (!responseHeaders.has('x-request-id')) {
    responseHeaders.set('x-request-id', requestId);
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
