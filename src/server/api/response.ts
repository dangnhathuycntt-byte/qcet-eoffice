import { NextResponse } from 'next/server';
import { toApiErrorResponse, type ApiErrorResponse } from './errors';

export function apiError(
  error: unknown,
  requestId: string,
  headers?: HeadersInit
): NextResponse<ApiErrorResponse> {
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

export function apiSuccess<T>(
  data: T,
  init?: { status?: number; headers?: HeadersInit; requestId?: string }
): NextResponse<T> {
  const status = init?.status ?? 200;
  const responseHeaders = new Headers(init?.headers);
  if (init?.requestId && !responseHeaders.has('x-request-id')) {
    responseHeaders.set('x-request-id', init.requestId);
  }
  return NextResponse.json(data, {
    status,
    headers: responseHeaders,
  });
}

export { toApiErrorResponse };
export type { ApiErrorResponse };
