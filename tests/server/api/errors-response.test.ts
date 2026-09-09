import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { z, ZodError } from 'zod';
import {
  ApiError,
  AuthenticationError,
  AuthorizationError,
  ForbiddenError,
  ValidationError,
  NotFoundError,
  ConflictError,
  InvalidTransitionError,
  RateLimitError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
  toApiErrorResponse,
  type ApiErrorResponse,
} from '@/server/api/errors';
import { apiError, apiSuccess } from '@/server/api/response';

describe('Standard Error Contract & Error Abstraction', () => {
  describe('Typed Error Classes', () => {
    it('ApiError base class retains status, code, message, and fieldErrors', () => {
      const fieldErrors = { username: ['Username is already taken'] };
      const err = new ApiError(418, 'TEAPOT', 'I am a teapot', fieldErrors);

      assert.ok(err instanceof Error);
      assert.ok(err instanceof ApiError);
      assert.strictEqual(err.statusCode, 418);
      assert.strictEqual(err.code, 'TEAPOT');
      assert.strictEqual(err.message, 'I am a teapot');
      assert.deepStrictEqual(err.fieldErrors, fieldErrors);
      assert.strictEqual(err.name, 'ApiError');
    });

    it('AuthenticationError has 401 status and default AUTH_REQUIRED code', () => {
      const defaultErr = new AuthenticationError();
      assert.ok(defaultErr instanceof ApiError);
      assert.strictEqual(defaultErr.statusCode, 401);
      assert.strictEqual(defaultErr.code, 'AUTH_REQUIRED');
      assert.strictEqual(defaultErr.message, 'Authentication required');

      const customErr = new AuthenticationError('Token expired', 'TOKEN_EXPIRED');
      assert.strictEqual(customErr.statusCode, 401);
      assert.strictEqual(customErr.code, 'TOKEN_EXPIRED');
      assert.strictEqual(customErr.message, 'Token expired');
    });

    it('AuthorizationError has 403 status and default FORBIDDEN code', () => {
      const defaultErr = new AuthorizationError();
      assert.ok(defaultErr instanceof ApiError);
      assert.strictEqual(defaultErr.statusCode, 403);
      assert.strictEqual(defaultErr.code, 'FORBIDDEN');
      assert.strictEqual(defaultErr.message, 'Access forbidden');

      const customErr = new AuthorizationError('Department mismatch', 'CROSS_DEPT_FORBIDDEN');
      assert.strictEqual(customErr.statusCode, 403);
      assert.strictEqual(customErr.code, 'CROSS_DEPT_FORBIDDEN');
      assert.strictEqual(customErr.message, 'Department mismatch');
    });

    it('ForbiddenError has 403 status and default FORBIDDEN code', () => {
      const defaultErr = new ForbiddenError();
      assert.ok(defaultErr instanceof ApiError);
      assert.strictEqual(defaultErr.statusCode, 403);
      assert.strictEqual(defaultErr.code, 'FORBIDDEN');
      assert.strictEqual(defaultErr.message, 'Access forbidden');

      const customErr = new ForbiddenError('CSRF token mismatch', 'CSRF_VALIDATION_FAILED');
      assert.strictEqual(customErr.statusCode, 403);
      assert.strictEqual(customErr.code, 'CSRF_VALIDATION_FAILED');
      assert.strictEqual(customErr.message, 'CSRF token mismatch');
    });

    it('ValidationError has 400 status and supports fieldErrors', () => {
      const fieldErrors = { title: ['Title is required'], priority: ['Invalid priority'] };
      const defaultErr = new ValidationError();
      assert.ok(defaultErr instanceof ApiError);
      assert.strictEqual(defaultErr.statusCode, 400);
      assert.strictEqual(defaultErr.code, 'VALIDATION_ERROR');
      assert.strictEqual(defaultErr.message, 'Validation failed');
      assert.strictEqual(defaultErr.fieldErrors, undefined);

      const customErr = new ValidationError('Invalid task submission', fieldErrors, 'TASK_VALIDATION_FAILED');
      assert.strictEqual(customErr.statusCode, 400);
      assert.strictEqual(customErr.code, 'TASK_VALIDATION_FAILED');
      assert.strictEqual(customErr.message, 'Invalid task submission');
      assert.deepStrictEqual(customErr.fieldErrors, fieldErrors);
    });

    it('NotFoundError has 404 status and default NOT_FOUND code', () => {
      const defaultErr = new NotFoundError();
      assert.ok(defaultErr instanceof ApiError);
      assert.strictEqual(defaultErr.statusCode, 404);
      assert.strictEqual(defaultErr.code, 'NOT_FOUND');
      assert.strictEqual(defaultErr.message, 'Resource not found');

      const customErr = new NotFoundError('Task not found', 'TASK_NOT_FOUND');
      assert.strictEqual(customErr.statusCode, 404);
      assert.strictEqual(customErr.code, 'TASK_NOT_FOUND');
      assert.strictEqual(customErr.message, 'Task not found');
    });

    it('ConflictError has 409 status and default CONFLICT code', () => {
      const defaultErr = new ConflictError();
      assert.ok(defaultErr instanceof ApiError);
      assert.strictEqual(defaultErr.statusCode, 409);
      assert.strictEqual(defaultErr.code, 'CONFLICT');
      assert.strictEqual(defaultErr.message, 'Resource conflict');

      const customErr = new ConflictError('Concurrent modification detected', 'OCC_VERSION_MISMATCH');
      assert.strictEqual(customErr.statusCode, 409);
      assert.strictEqual(customErr.code, 'OCC_VERSION_MISMATCH');
      assert.strictEqual(customErr.message, 'Concurrent modification detected');
    });

    it('InvalidTransitionError has 409 status and default INVALID_TRANSITION code', () => {
      const defaultErr = new InvalidTransitionError();
      assert.ok(defaultErr instanceof ApiError);
      assert.strictEqual(defaultErr.statusCode, 409);
      assert.strictEqual(defaultErr.code, 'INVALID_TRANSITION');
      assert.strictEqual(defaultErr.message, 'Invalid state transition');

      const customErr = new InvalidTransitionError('Cannot transition from COMPLETED to IN_PROGRESS', 'STATE_FROZEN');
      assert.strictEqual(customErr.statusCode, 409);
      assert.strictEqual(customErr.code, 'STATE_FROZEN');
      assert.strictEqual(customErr.message, 'Cannot transition from COMPLETED to IN_PROGRESS');
    });

    it('RateLimitError has 429 status and default RATE_LIMITED code', () => {
      const defaultErr = new RateLimitError();
      assert.ok(defaultErr instanceof ApiError);
      assert.strictEqual(defaultErr.statusCode, 429);
      assert.strictEqual(defaultErr.code, 'RATE_LIMITED');
      assert.strictEqual(defaultErr.message, 'Too many requests');

      const customErr = new RateLimitError('Too many login attempts, please wait', 'AUTH_RATE_LIMITED');
      assert.strictEqual(customErr.statusCode, 429);
      assert.strictEqual(customErr.code, 'AUTH_RATE_LIMITED');
      assert.strictEqual(customErr.message, 'Too many login attempts, please wait');
    });

    it('PayloadTooLargeError has 413 status and default PAYLOAD_TOO_LARGE code', () => {
      const defaultErr = new PayloadTooLargeError();
      assert.ok(defaultErr instanceof ApiError);
      assert.strictEqual(defaultErr.statusCode, 413);
      assert.strictEqual(defaultErr.code, 'PAYLOAD_TOO_LARGE');
      assert.strictEqual(defaultErr.message, 'Payload too large');

      const customErr = new PayloadTooLargeError('Attachment exceeds 10MB limit', 'ATTACHMENT_TOO_LARGE');
      assert.strictEqual(customErr.statusCode, 413);
      assert.strictEqual(customErr.code, 'ATTACHMENT_TOO_LARGE');
      assert.strictEqual(customErr.message, 'Attachment exceeds 10MB limit');
    });

    it('UnsupportedMediaTypeError has 415 status and default UNSUPPORTED_MEDIA_TYPE code', () => {
      const defaultErr = new UnsupportedMediaTypeError();
      assert.ok(defaultErr instanceof ApiError);
      assert.strictEqual(defaultErr.statusCode, 415);
      assert.strictEqual(defaultErr.code, 'UNSUPPORTED_MEDIA_TYPE');
      assert.strictEqual(defaultErr.message, 'Unsupported media type');

      const customErr = new UnsupportedMediaTypeError('Only application/json is supported', 'JSON_REQUIRED');
      assert.strictEqual(customErr.statusCode, 415);
      assert.strictEqual(customErr.code, 'JSON_REQUIRED');
      assert.strictEqual(customErr.message, 'Only application/json is supported');
    });
  });

  describe('toApiErrorResponse serialization', () => {
    const testRequestId = 'req-test-uuid-1234';

    it('serializes ApiError into ApiErrorResponse with correct status and requestId', () => {
      const err = new NotFoundError('Task 999 not found', 'TASK_NOT_FOUND');
      const res = toApiErrorResponse(err, testRequestId);

      assert.strictEqual(res.status, 404);
      assert.deepStrictEqual(res.body, {
        error: {
          code: 'TASK_NOT_FOUND',
          message: 'Task 999 not found',
          requestId: testRequestId,
        },
      });
    });

    it('serializes ValidationError including fieldErrors', () => {
      const fieldErrors = { 'assignee.id': ['Required'], priority: ['Must be HIGH or URGENT'] };
      const err = new ValidationError('Invalid payload', fieldErrors);
      const res = toApiErrorResponse(err, testRequestId);

      assert.strictEqual(res.status, 400);
      assert.deepStrictEqual(res.body, {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid payload',
          fieldErrors,
          requestId: testRequestId,
        },
      });
    });

    it('serializes ZodError directly to 400 VALIDATION_ERROR with structured fieldErrors', () => {
      const schema = z.object({
        email: z.string().email('Invalid email address'),
        details: z.object({
          age: z.number().min(18, 'Must be at least 18'),
        }),
      });

      const parseResult = schema.safeParse({
        email: 'not-an-email',
        details: { age: 16 },
      });

      assert.strictEqual(parseResult.success, false);
      if (!parseResult.success) {
        const res = toApiErrorResponse(parseResult.error, testRequestId);

        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
        assert.strictEqual(res.body.error.message, 'Validation failed');
        assert.strictEqual(res.body.error.requestId, testRequestId);
        assert.ok(res.body.error.fieldErrors);
        assert.deepStrictEqual(res.body.error.fieldErrors['email'], ['Invalid email address']);
        assert.deepStrictEqual(res.body.error.fieldErrors['details.age'], ['Must be at least 18']);
      }
    });

    it('maps unknown errors to 500 INTERNAL_ERROR and redacts internal details', () => {
      const sensitiveError = new Error('FATAL: password authentication failed for user "postgres"');
      const res = toApiErrorResponse(sensitiveError, testRequestId);

      assert.strictEqual(res.status, 500);
      assert.strictEqual(res.body.error.code, 'INTERNAL_ERROR');
      assert.strictEqual(res.body.error.message, 'Internal server error');
      assert.strictEqual(res.body.error.requestId, testRequestId);
      assert.strictEqual(res.body.error.fieldErrors, undefined);

      // Verify no sensitive leak
      const stringified = JSON.stringify(res.body);
      assert.ok(!stringified.includes('postgres'));
      assert.ok(!stringified.includes('authentication failed'));
    });

    it('maps non-Error thrown objects/primitives to 500 INTERNAL_ERROR', () => {
      const primitiveRes = toApiErrorResponse('unexpected string thrown', testRequestId);
      assert.strictEqual(primitiveRes.status, 500);
      assert.strictEqual(primitiveRes.body.error.code, 'INTERNAL_ERROR');
      assert.strictEqual(primitiveRes.body.error.message, 'Internal server error');
      assert.strictEqual(primitiveRes.body.error.requestId, testRequestId);

      const nullRes = toApiErrorResponse(null, testRequestId);
      assert.strictEqual(nullRes.status, 500);
      assert.strictEqual(nullRes.body.error.code, 'INTERNAL_ERROR');
    });
  });

  describe('Response Helpers (apiError and apiSuccess)', () => {
    const testRequestId = 'req-response-5678';

    it('apiError produces NextResponse with proper status, body, and X-Request-ID header', async () => {
      const err = new AuthorizationError('Insufficient permissions');
      const response = apiError(err, testRequestId, { 'Cache-Control': 'no-store' });

      assert.strictEqual(response.status, 403);
      assert.strictEqual(response.headers.get('x-request-id'), testRequestId);
      assert.strictEqual(response.headers.get('cache-control'), 'no-store');

      const body = (await response.json()) as ApiErrorResponse;
      assert.deepStrictEqual(body, {
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
          requestId: testRequestId,
        },
      });
    });

    it('apiSuccess produces NextResponse with 200 default status and X-Request-ID header', async () => {
      const payload = { success: true, count: 42 };
      const response = apiSuccess(payload, { requestId: testRequestId });

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.headers.get('x-request-id'), testRequestId);

      const body = await response.json();
      assert.deepStrictEqual(body, payload);
    });

    it('apiSuccess respects custom status and additional headers', async () => {
      const payload = { id: 'task-100', title: 'New Task' };
      const response = apiSuccess(payload, {
        status: 201,
        headers: { Location: '/api/tasks/task-100' },
        requestId: testRequestId,
      });

      assert.strictEqual(response.status, 201);
      assert.strictEqual(response.headers.get('location'), '/api/tasks/task-100');
      assert.strictEqual(response.headers.get('x-request-id'), testRequestId);

      const body = await response.json();
      assert.deepStrictEqual(body, payload);
    });
  });
});
