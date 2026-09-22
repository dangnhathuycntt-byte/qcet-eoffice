/**
 * Test Suite: RFC 9457 Problem Details for HTTP APIs (ADR-007 / WI-7.6)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import {
  ValidationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  InvalidTransitionError,
  RateLimitError,
} from '@/server/api/errors';
import {
  toProblemDetails,
  problemResponse,
  PROBLEM_DETAILS_CONTENT_TYPE,
  DEFAULT_ERROR_URI_BASE,
  apiError,
} from '@/server/api/response';

describe('WI-7.6: RFC 9457 Problem Details Implementation', () => {
  describe('1. toProblemDetails Transformation', () => {
    it('transforms ValidationError into RFC 9457 Problem Details', () => {
      const fieldErrors = {
        title: ['Tiêu đề không được để trống'],
        priority: ['Mức độ ưu tiên không hợp lệ'],
      };
      const err = new ValidationError('Dữ liệu không hợp lệ', fieldErrors, 'TASK_VALIDATION_ERROR');
      const { status, problem } = toProblemDetails(err, {
        requestId: 'req_test_123',
        instance: '/api/tasks/actions/create',
      });

      assert.strictEqual(status, 400);
      assert.strictEqual(problem.status, 400);
      assert.strictEqual(problem.title, 'Bad Request');
      assert.strictEqual(problem.detail, 'Dữ liệu không hợp lệ');
      assert.strictEqual(problem.code, 'TASK_VALIDATION_ERROR');
      assert.strictEqual(problem.type, `${DEFAULT_ERROR_URI_BASE}/task-validation-error`);
      assert.strictEqual(problem.instance, '/api/tasks/actions/create');
      assert.strictEqual(problem.requestId, 'req_test_123');

      assert.ok(Array.isArray(problem.invalidParams));
      assert.strictEqual(problem.invalidParams.length, 2);
      assert.deepStrictEqual(problem.invalidParams[0], {
        name: 'title',
        reason: 'Tiêu đề không được để trống',
      });
      assert.deepStrictEqual(problem.invalidParams[1], {
        name: 'priority',
        reason: 'Mức độ ưu tiên không hợp lệ',
      });
    });

    it('transforms ZodError into RFC 9457 Problem Details with invalidParams', () => {
      const schema = z.object({
        code: z.string().min(1, 'Mã không được để trống'),
        amount: z.number().positive('Số tiền phải lớn hơn 0'),
      });

      const parseResult = schema.safeParse({ code: '', amount: -5 });
      assert.ok(!parseResult.success);

      const { status, problem } = toProblemDetails(parseResult.error, {
        requestId: 'req_zod_456',
        instance: '/api/documents/register',
      });

      assert.strictEqual(status, 400);
      assert.strictEqual(problem.code, 'VALIDATION_ERROR');
      assert.ok(Array.isArray(problem.invalidParams));
      assert.strictEqual(problem.invalidParams.length, 2);
      assert.deepStrictEqual(problem.invalidParams[0], {
        name: 'code',
        reason: 'Mã không được để trống',
      });
      assert.deepStrictEqual(problem.invalidParams[1], {
        name: 'amount',
        reason: 'Số tiền phải lớn hơn 0',
      });
    });

    it('transforms AuthorizationError (SoD violation) into RFC 9457', () => {
      const err = new AuthorizationError(
        'Người tạo nhiệm vụ không được tự phê duyệt kết quả hoàn thành',
        'SOD_CREATOR_CANNOT_APPROVE'
      );
      const { status, problem } = toProblemDetails(err, {
        requestId: 'req_sod_789',
        instance: '/api/tasks/task-1/actions/approve',
      });

      assert.strictEqual(status, 403);
      assert.strictEqual(problem.status, 403);
      assert.strictEqual(problem.title, 'Forbidden');
      assert.strictEqual(problem.code, 'SOD_CREATOR_CANNOT_APPROVE');
      assert.strictEqual(
        problem.type,
        `${DEFAULT_ERROR_URI_BASE}/sod-creator-cannot-approve`
      );
      assert.strictEqual(problem.instance, '/api/tasks/task-1/actions/approve');
    });

    it('transforms InvalidTransitionError into RFC 9457 Conflict', () => {
      const err = new InvalidTransitionError(
        'Không thể chuyển từ DA_HOAN_THANH sang DANG_XU_LY',
        'INVALID_DOCUMENT_TRANSITION',
        { fromStatus: 'DA_HOAN_THANH', toStatus: 'DANG_XU_LY' }
      );
      const { status, problem } = toProblemDetails(err, {
        requestId: 'req_fsm_001',
      });

      assert.strictEqual(status, 409);
      assert.strictEqual(problem.status, 409);
      assert.strictEqual(problem.title, 'Conflict');
      assert.strictEqual(problem.code, 'INVALID_DOCUMENT_TRANSITION');
    });

    it('transforms RateLimitError into RFC 9457 Too Many Requests', () => {
      const err = new RateLimitError('Vượt quá hạn ngạch 60 req/min', 'RATE_LIMITED', 45);
      const { status, problem } = toProblemDetails(err);

      assert.strictEqual(status, 429);
      assert.strictEqual(problem.title, 'Too Many Requests');
      assert.strictEqual(problem.code, 'RATE_LIMITED');
    });

    it('maps unknown internal errors to about:blank type URI', () => {
      const err = new Error('Database connection dropped');
      const { status, problem } = toProblemDetails(err, { requestId: 'req_internal' });

      assert.strictEqual(status, 500);
      assert.strictEqual(problem.type, 'about:blank');
      assert.strictEqual(problem.title, 'Internal Server Error');
      assert.strictEqual(problem.detail, 'Internal server error');
    });
  });

  describe('2. problemResponse & Content-Type Headers', () => {
    it('sets Content-Type to application/problem+json and attaches x-request-id', async () => {
      const err = new NotFoundError('Không tìm thấy văn bản yêu cầu', 'DOCUMENT_NOT_FOUND');
      const res = problemResponse(err, {
        requestId: 'req_resp_111',
        instance: '/api/documents/doc-999',
      });

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.headers.get('Content-Type'), PROBLEM_DETAILS_CONTENT_TYPE);
      assert.strictEqual(res.headers.get('x-request-id'), 'req_resp_111');

      const json = await res.json();
      assert.strictEqual(json.status, 404);
      assert.strictEqual(json.code, 'DOCUMENT_NOT_FOUND');
      assert.strictEqual(json.instance, '/api/documents/doc-999');
      assert.strictEqual(json.type, `${DEFAULT_ERROR_URI_BASE}/document-not-found`);
    });

    it('apiError supports rfc9457 option producing Problem Details response', async () => {
      const err = new AuthorizationError('Truy cập bị từ chối', 'INSUFFICIENT_CAPABILITY');
      const res = apiError(err, 'req_api_error_opts', {
        rfc9457: true,
        instance: '/api/dossiers/archive',
      });

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.headers.get('Content-Type'), PROBLEM_DETAILS_CONTENT_TYPE);
      assert.strictEqual(res.headers.get('x-request-id'), 'req_api_error_opts');

      const body = await res.json();
      assert.strictEqual(body.status, 403);
      assert.strictEqual(body.code, 'INSUFFICIENT_CAPABILITY');
      assert.strictEqual(body.instance, '/api/dossiers/archive');
      assert.strictEqual(body.type, `${DEFAULT_ERROR_URI_BASE}/insufficient-capability`);
    });
  });
});
