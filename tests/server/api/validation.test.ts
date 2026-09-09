import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import {
  assertJsonContentType,
  assertPayloadSize,
  assertQueryStringLength,
  parseAndValidateJson,
  MAX_JSON_BODY_SIZE,
  MAX_AUTH_BODY_SIZE,
  MAX_QUERY_STRING_LENGTH,
} from '@/server/api/validation';
import {
  UnsupportedMediaTypeError,
  PayloadTooLargeError,
  ValidationError,
  ApiError,
} from '@/server/api/errors';

describe('Payload Guards & Content-Type Validation Engine', () => {
  describe('assertJsonContentType', () => {
    it('allows valid application/json content types on POST/PUT/PATCH', () => {
      const validTypes = [
        'application/json',
        'application/json; charset=utf-8',
        'APPLICATION/JSON',
        'application/json;charset=UTF-8',
      ];

      for (const method of ['POST', 'PUT', 'PATCH']) {
        for (const ct of validTypes) {
          const req = new Request('http://localhost:3000/api/tasks', {
            method,
            headers: { 'content-type': ct },
            body: JSON.stringify({ name: 'Task' }),
          });
          assert.doesNotThrow(() => assertJsonContentType(req));
        }
      }
    });

    it('rejects non-json content types on state-changing methods with 415 UnsupportedMediaTypeError', () => {
      const invalidTypes = [
        'text/plain',
        'text/html',
        'application/xml',
        'application/x-www-form-urlencoded',
        'multipart/form-data; boundary=something',
      ];

      for (const ct of invalidTypes) {
        const req = new Request('http://localhost:3000/api/tasks', {
          method: 'POST',
          headers: { 'content-type': ct },
          body: 'raw text content',
        });

        assert.throws(
          () => assertJsonContentType(req),
          (err: unknown) => {
            assert.ok(err instanceof UnsupportedMediaTypeError);
            assert.ok(err instanceof ApiError);
            assert.strictEqual(err.statusCode, 415);
            assert.strictEqual(err.code, 'UNSUPPORTED_MEDIA_TYPE');
            return true;
          }
        );
      }
    });

    it('rejects POST/PUT/PATCH requests with missing Content-Type header', () => {
      for (const method of ['POST', 'PUT', 'PATCH']) {
        const req = new Request('http://localhost:3000/api/tasks', {
          method,
          body: JSON.stringify({ hello: 'world' }),
        });

        assert.throws(
          () => assertJsonContentType(req),
          (err: unknown) => {
            assert.ok(err instanceof UnsupportedMediaTypeError);
            assert.strictEqual(err.statusCode, 415);
            return true;
          }
        );
      }
    });

    it('bypasses content-type enforcement for read-only / safe HTTP methods without bodies', () => {
      for (const method of ['GET', 'HEAD', 'OPTIONS', 'DELETE']) {
        const req = new Request('http://localhost:3000/api/tasks', {
          method,
          headers: { 'content-type': 'text/plain' },
        });
        assert.doesNotThrow(() => assertJsonContentType(req));
      }
    });
  });

  describe('assertPayloadSize', () => {
    it('allows requests within default MAX_JSON_BODY_SIZE (1MB)', () => {
      const req = new Request('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': '1024',
        },
      });

      assert.doesNotThrow(() => assertPayloadSize(req));
    });

    it('throws 413 PayloadTooLargeError when Content-Length exceeds maxBytes', () => {
      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': String(MAX_AUTH_BODY_SIZE + 1),
        },
      });

      assert.throws(
        () => assertPayloadSize(req, MAX_AUTH_BODY_SIZE),
        (err: unknown) => {
          assert.ok(err instanceof PayloadTooLargeError);
          assert.ok(err instanceof ApiError);
          assert.strictEqual(err.statusCode, 413);
          assert.strictEqual(err.code, 'PAYLOAD_TOO_LARGE');
          return true;
        }
      );
    });

    it('passes when Content-Length is absent', () => {
      const req = new Request('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });

      assert.doesNotThrow(() => assertPayloadSize(req));
    });
  });

  describe('assertQueryStringLength', () => {
    it('passes when query string is within MAX_QUERY_STRING_LENGTH (2048 chars)', () => {
      const url = 'http://localhost:3000/api/search?q=test&limit=10';
      assert.doesNotThrow(() => assertQueryStringLength(url));
    });

    it('throws ValidationError with QUERY_TOO_LONG when query string exceeds limit', () => {
      const longQuery = 'q=' + 'a'.repeat(2100);
      const url = `http://localhost:3000/api/search?${longQuery}`;

      assert.throws(
        () => assertQueryStringLength(url),
        (err: unknown) => {
          assert.ok(err instanceof ValidationError);
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'QUERY_TOO_LONG');
          return true;
        }
      );
    });
  });

  describe('parseAndValidateJson', () => {
    const TaskSchema = z.object({
      title: z.string().min(1, 'Title is required'),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
      tags: z.array(z.string()).optional(),
    });

    it('successfully parses valid JSON matching schema', async () => {
      const payload = {
        title: 'Complete audit review',
        priority: 'HIGH',
        tags: ['security', 'hardening'],
      };

      const req = new Request('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const validated = await parseAndValidateJson(req, TaskSchema);
      assert.deepStrictEqual(validated, payload);
    });

    it('throws 415 UnsupportedMediaTypeError when Content-Type is invalid', async () => {
      const req = new Request('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: JSON.stringify({ title: 'Task', priority: 'LOW' }),
      });

      await assert.rejects(
        () => parseAndValidateJson(req, TaskSchema),
        (err: unknown) => {
          assert.ok(err instanceof UnsupportedMediaTypeError);
          assert.strictEqual(err.statusCode, 415);
          return true;
        }
      );
    });

    it('throws 413 PayloadTooLargeError when body text exceeds maxBytes', async () => {
      const largePayload = {
        title: 'Large Payload',
        priority: 'LOW',
        tags: ['a'.repeat(5000)],
      };

      const req = new Request('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(largePayload),
      });

      await assert.rejects(
        () => parseAndValidateJson(req, TaskSchema, { maxBytes: 1024 }),
        (err: unknown) => {
          assert.ok(err instanceof PayloadTooLargeError);
          assert.strictEqual(err.statusCode, 413);
          return true;
        }
      );
    });

    it('throws 400 ValidationError with Invalid JSON body on syntax error', async () => {
      const req = new Request('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{ "title": "Missing closing brace", "priority": "HIGH"',
      });

      await assert.rejects(
        () => parseAndValidateJson(req, TaskSchema),
        (err: unknown) => {
          assert.ok(err instanceof ValidationError);
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.message, 'Invalid JSON body');
          return true;
        }
      );
    });

    it('throws 400 ValidationError with Invalid JSON body on empty body by default', async () => {
      const req = new Request('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '',
      });

      await assert.rejects(
        () => parseAndValidateJson(req, TaskSchema),
        (err: unknown) => {
          assert.ok(err instanceof ValidationError);
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.message, 'Invalid JSON body');
          return true;
        }
      );
    });

    it('allows empty body when allowEmpty is true and schema accepts empty object', async () => {
      const EmptySchema = z.object({
        filter: z.string().optional(),
      });

      const req = new Request('http://localhost:3000/api/tasks/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '',
      });

      const result = await parseAndValidateJson(req, EmptySchema, { allowEmpty: true });
      assert.deepStrictEqual(result, {});
    });

    it('throws 400 ValidationError with structured fieldErrors when schema validation fails', async () => {
      const req = new Request('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: '', // fails min(1)
          priority: 'INVALID_PRIORITY', // fails enum
        }),
      });

      await assert.rejects(
        () => parseAndValidateJson(req, TaskSchema),
        (err: unknown) => {
          assert.ok(err instanceof ValidationError);
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.message, 'Validation failed');
          assert.ok(err.fieldErrors);
          assert.ok(Array.isArray(err.fieldErrors['title']));
          assert.strictEqual(err.fieldErrors['title'][0], 'Title is required');
          assert.ok(Array.isArray(err.fieldErrors['priority']));
          return true;
        }
      );
    });

    it('formats nested object fieldErrors correctly with dot notation', async () => {
      const NestedSchema = z.object({
        user: z.object({
          email: z.string().email('Invalid email address'),
        }),
      });

      const req = new Request('http://localhost:3000/api/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          user: {
            email: 'not-an-email',
          },
        }),
      });

      await assert.rejects(
        () => parseAndValidateJson(req, NestedSchema),
        (err: unknown) => {
          assert.ok(err instanceof ValidationError);
          assert.ok(err.fieldErrors);
          assert.ok(Array.isArray(err.fieldErrors['user.email']));
          assert.strictEqual(err.fieldErrors['user.email'][0], 'Invalid email address');
          return true;
        }
      );
    });
  });
});
