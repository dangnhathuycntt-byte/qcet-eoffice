/**
 * QCET E-Office: Enterprise API Pagination Standards (ADR-007 / WI-7.6)
 *
 * Implements cursor-based and offset-based pagination standards with
 * unified response envelope and standard HTTP pagination headers.
 */

import { NextResponse } from 'next/server';

export interface PaginationMetadata {
  /**
   * Next cursor value for fetching the subsequent page (null if no more pages)
   */
  nextCursor: string | null;
  /**
   * Previous cursor if bidirectional pagination is supported
   */
  prevCursor?: string | null;
  /**
   * Whether more items are available
   */
  hasMore: boolean;
  /**
   * Number of items in the current page
   */
  pageSize: number;
  /**
   * Total count of items matching the filter (if requested and calculated)
   */
  total?: number;
  /**
   * Current 1-based page number for offset-based pagination
   */
  page?: number;
  /**
   * Total number of pages for offset-based pagination
   */
  totalPages?: number;
}

export interface PaginatedEnvelope<T> {
  data: T[];
  pagination: PaginationMetadata;
}

export interface CreatePaginatedResponseOptions {
  status?: number;
  headers?: HeadersInit;
  requestId?: string;
  nextCursor?: string | null;
  prevCursor?: string | null;
  hasMore: boolean;
  pageSize: number;
  total?: number;
  page?: number;
  totalPages?: number;
  /**
   * Canonical URL or base path to generate RFC 8288 Link headers
   */
  canonicalUrl?: string;
  /**
   * Cursor query parameter name (defaults to 'cursor')
   */
  cursorParamName?: string;
}

/**
 * Creates standard pagination HTTP headers adhering to ADR-007
 */
export function buildPaginationHeaders(
  options: CreatePaginatedResponseOptions
): Headers {
  const headers = new Headers(options.headers);

  // X-Page-Size
  headers.set('X-Page-Size', String(options.pageSize));

  // X-Has-More
  headers.set('X-Has-More', options.hasMore ? 'true' : 'false');

  // X-Next-Cursor
  if (options.nextCursor) {
    headers.set('X-Next-Cursor', options.nextCursor);
  }

  // X-Total-Count
  if (typeof options.total === 'number') {
    headers.set('X-Total-Count', String(options.total));
  }

  // Request ID
  if (options.requestId && !headers.has('x-request-id')) {
    headers.set('x-request-id', options.requestId);
  }

  // RFC 8288 Web Linking Header
  if (options.canonicalUrl && (options.nextCursor || options.prevCursor)) {
    const links: string[] = [];
    const param = options.cursorParamName || 'cursor';

    if (options.nextCursor) {
      try {
        const nextUrl = new URL(options.canonicalUrl);
        nextUrl.searchParams.set(param, options.nextCursor);
        links.push(`<${nextUrl.toString()}>; rel="next"`);
      } catch {
        // Relative URL fallback
        const separator = options.canonicalUrl.includes('?') ? '&' : '?';
        links.push(`<${options.canonicalUrl}${separator}${param}=${encodeURIComponent(options.nextCursor)}>; rel="next"`);
      }
    }

    if (options.prevCursor) {
      try {
        const prevUrl = new URL(options.canonicalUrl);
        prevUrl.searchParams.set(param, options.prevCursor);
        links.push(`<${prevUrl.toString()}>; rel="prev"`);
      } catch {
        const separator = options.canonicalUrl.includes('?') ? '&' : '?';
        links.push(`<${options.canonicalUrl}${separator}${param}=${encodeURIComponent(options.prevCursor)}>; rel="prev"`);
      }
    }

    if (links.length > 0) {
      headers.set('Link', links.join(', '));
    }
  }

  return headers;
}

/**
 * Creates a standardized Paginated NextResponse with metadata and headers
 */
export function paginatedResponse<T>(
  data: T[],
  options: CreatePaginatedResponseOptions
): NextResponse<PaginatedEnvelope<T>> {
  const headers = buildPaginationHeaders(options);

  const pagination: PaginationMetadata = {
    nextCursor: options.nextCursor ?? null,
    hasMore: options.hasMore,
    pageSize: options.pageSize,
    ...(options.prevCursor !== undefined ? { prevCursor: options.prevCursor } : {}),
    ...(options.total !== undefined ? { total: options.total } : {}),
    ...(options.page !== undefined ? { page: options.page } : {}),
    ...(options.totalPages !== undefined ? { totalPages: options.totalPages } : {}),
  };

  const body: PaginatedEnvelope<T> = {
    data,
    pagination,
  };

  return NextResponse.json(body, {
    status: options.status ?? 200,
    headers,
  });
}
