/**
 * Test Suite: API Standards Pagination & Headers (ADR-007 / WI-7.6)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  paginatedResponse,
  buildPaginationHeaders,
  type PaginatedEnvelope,
} from '@/server/api/response';

describe('WI-7.6: API Pagination Standards & Headers', () => {
  describe('1. buildPaginationHeaders', () => {
    it('sets standard pagination headers X-Page-Size, X-Has-More, X-Next-Cursor, X-Total-Count', () => {
      const headers = buildPaginationHeaders({
        pageSize: 20,
        hasMore: true,
        nextCursor: 'cursor_abc123',
        total: 145,
        requestId: 'req_page_001',
      });

      assert.strictEqual(headers.get('X-Page-Size'), '20');
      assert.strictEqual(headers.get('X-Has-More'), 'true');
      assert.strictEqual(headers.get('X-Next-Cursor'), 'cursor_abc123');
      assert.strictEqual(headers.get('X-Total-Count'), '145');
      assert.strictEqual(headers.get('x-request-id'), 'req_page_001');
    });

    it('generates RFC 8288 Link header when canonicalUrl is provided', () => {
      const headers = buildPaginationHeaders({
        pageSize: 10,
        hasMore: true,
        nextCursor: 'cursor_next',
        prevCursor: 'cursor_prev',
        canonicalUrl: 'https://eoffice.qcet.edu.vn/api/tasks',
      });

      const link = headers.get('Link');
      assert.ok(link);
      assert.ok(link.includes('<https://eoffice.qcet.edu.vn/api/tasks?cursor=cursor_next>; rel="next"'));
      assert.ok(link.includes('<https://eoffice.qcet.edu.vn/api/tasks?cursor=cursor_prev>; rel="prev"'));
    });

    it('handles relative canonicalUrl gracefully for Link header', () => {
      const headers = buildPaginationHeaders({
        pageSize: 15,
        hasMore: true,
        nextCursor: 'cursor_next',
        canonicalUrl: '/api/documents?status=DANG_XU_LY',
      });

      const link = headers.get('Link');
      assert.ok(link);
      assert.ok(link.includes('</api/documents?status=DANG_XU_LY&cursor=cursor_next>; rel="next"'));
    });
  });

  describe('2. paginatedResponse Envelope & Structure', () => {
    it('returns standardized JSON envelope with data array and pagination metadata', async () => {
      const sampleTasks = [
        { id: 'task-1', title: 'Nhiệm vụ 1' },
        { id: 'task-2', title: 'Nhiệm vụ 2' },
      ];

      const res = paginatedResponse(sampleTasks, {
        pageSize: 2,
        hasMore: true,
        nextCursor: 'cursor_task_3',
        total: 10,
        requestId: 'req_envelope_001',
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('X-Page-Size'), '2');
      assert.strictEqual(res.headers.get('X-Has-More'), 'true');
      assert.strictEqual(res.headers.get('X-Next-Cursor'), 'cursor_task_3');
      assert.strictEqual(res.headers.get('X-Total-Count'), '10');

      const body = (await res.json()) as PaginatedEnvelope<any>;
      assert.deepStrictEqual(body.data, sampleTasks);
      assert.strictEqual(body.pagination.pageSize, 2);
      assert.strictEqual(body.pagination.hasMore, true);
      assert.strictEqual(body.pagination.nextCursor, 'cursor_task_3');
      assert.strictEqual(body.pagination.total, 10);
    });

    it('sets nextCursor to null and hasMore to false for terminal page', async () => {
      const items = [{ id: 'doc-final', title: 'Văn bản cuối' }];

      const res = paginatedResponse(items, {
        pageSize: 1,
        hasMore: false,
        nextCursor: null,
        total: 1,
      });

      assert.strictEqual(res.headers.get('X-Has-More'), 'false');
      assert.strictEqual(res.headers.get('X-Next-Cursor'), null);

      const body = (await res.json()) as PaginatedEnvelope<any>;
      assert.strictEqual(body.pagination.hasMore, false);
      assert.strictEqual(body.pagination.nextCursor, null);
    });
  });
});
