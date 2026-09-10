import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import {
  withIdempotency,
  IdempotencyConflictError,
  stableStringify,
  computePayloadHash,
  getIdempotencyRecord,
} from '../src/lib/db/idempotency';

describe('Tasks 3.12-3.14: Idempotency Payload Verification & Command Flow', () => {
  const testRunId = `cmd_test_${Date.now()}`;
  const testUserId = `user_${testRunId}`;
  const op = 'task.create';

  after(async () => {
    // Cleanup records created by this test suite
    await prisma.idempotencyRecord.deleteMany({
      where: {
        userId: testUserId,
      },
    });
  });

  describe('1. Deterministic Payload Hashing & Stable Stringification', () => {
    test('produces identical SHA-256 hash regardless of object key order', () => {
      const payload1 = { title: 'Nhiệm vụ kiểm định', priority: 'HIGH', scope: 'SCHOOL', count: 5 };
      const payload2 = { count: 5, scope: 'SCHOOL', priority: 'HIGH', title: 'Nhiệm vụ kiểm định' };

      const str1 = stableStringify(payload1);
      const str2 = stableStringify(payload2);
      assert.strictEqual(str1, str2, 'Stable stringify must match regardless of property insertion order');

      const hash1 = computePayloadHash(payload1);
      const hash2 = computePayloadHash(payload2);
      assert.strictEqual(hash1, hash2, 'SHA-256 hashes must be strictly identical');
      assert.strictEqual(hash1.length, 64, 'SHA-256 hex string should be 64 characters');
    });

    test('produces different hashes when payload values differ', () => {
      const payloadA = { title: 'Nhiệm vụ A', departmentId: 'dept-1' };
      const payloadB = { title: 'Nhiệm vụ B', departmentId: 'dept-1' };

      const hashA = computePayloadHash(payloadA);
      const hashB = computePayloadHash(payloadB);
      assert.notStrictEqual(hashA, hashB, 'Different payloads must yield different hashes');
    });

    test('handles nested objects, arrays, dates, and primitives deterministically', () => {
      const date = new Date('2026-09-10T08:00:00.000Z');
      const complex1 = {
        meta: { tags: ['urgent', 'bgh'], year: 2026 },
        due: date,
        active: true,
      };
      const complex2 = {
        active: true,
        due: date,
        meta: { year: 2026, tags: ['urgent', 'bgh'] },
      };

      assert.strictEqual(computePayloadHash(complex1), computePayloadHash(complex2));
    });
  });

  describe('2. Idempotency Key with Same Payload Caching', () => {
    test('same key and same payload returns cached result and executes business logic only once', async () => {
      const key = `key_same_${Date.now()}`;
      const payload = {
        title: 'Nhiệm vụ định kỳ quý 3',
        departmentId: 'dept-cntt',
        priority: 'NORMAL',
        dueDate: '2026-09-30T17:00:00Z',
      };

      let executionCount = 0;
      const worker = async () => {
        executionCount++;
        return {
          id: `task_${Date.now()}`,
          code: 'NV-2026-001',
          title: payload.title,
          status: 'PENDING',
        };
      };

      // Call 1: First invocation
      const result1 = await withIdempotency(
        prisma,
        {
          userId: testUserId,
          operation: op,
          key,
          payload,
          ttlMinutes: 30,
        },
        worker
      );

      assert.strictEqual(executionCount, 1, 'Worker must execute on first invocation');
      assert.strictEqual(result1.title, payload.title);

      // Verify DB stored the envelope { payloadHash, data }
      const record = await getIdempotencyRecord(prisma, {
        userId: testUserId,
        operation: op,
        key,
      });
      assert.ok(record, 'Record must exist in DB');
      assert.strictEqual(record.status, 'COMPLETED');
      const storedResponse = record.response as any;
      assert.strictEqual(storedResponse.payloadHash, computePayloadHash(payload));
      assert.deepStrictEqual(storedResponse.data, result1);

      // Call 2: Duplicate invocation with identical payload (even with keys permuted)
      const permutedPayload = {
        dueDate: '2026-09-30T17:00:00Z',
        priority: 'NORMAL',
        departmentId: 'dept-cntt',
        title: 'Nhiệm vụ định kỳ quý 3',
      };

      const result2 = await withIdempotency(
        prisma,
        {
          userId: testUserId,
          operation: op,
          key,
          payload: permutedPayload,
          ttlMinutes: 30,
        },
        worker
      );

      assert.strictEqual(executionCount, 1, 'Worker must NOT execute on duplicate invocation');
      assert.deepStrictEqual(result2, result1, 'Must return cached result');
    });
  });

  describe('3. Idempotency Key with Different Payload Conflict', () => {
    test('same key with different payload throws HTTP 409 IdempotencyConflictError', async () => {
      const key = `key_diff_${Date.now()}`;
      const originalPayload = {
        title: 'Tạo tài liệu hướng dẫn',
        scope: 'DEPARTMENT',
      };
      const alteredPayload = {
        title: 'Tạo tài liệu đào tạo (khác)',
        scope: 'SCHOOL',
      };

      let executionCount = 0;

      // 1. Initial call with original payload
      const firstResult = await withIdempotency(
        prisma,
        {
          userId: testUserId,
          operation: op,
          key,
          payload: originalPayload,
        },
        async () => {
          executionCount++;
          return { id: 'orig-1', success: true };
        }
      );

      assert.strictEqual(executionCount, 1);
      assert.deepStrictEqual(firstResult, { id: 'orig-1', success: true });

      // 2. Second call with SAME key but DIFFERENT payload must throw 409 conflict
      await assert.rejects(
        async () => {
          await withIdempotency(
            prisma,
            {
              userId: testUserId,
              operation: op,
              key,
              payload: alteredPayload,
            },
            async () => {
              executionCount++;
              return { id: 'altered-2', success: true };
            }
          );
        },
        (err: any) => {
          assert.ok(err instanceof IdempotencyConflictError, 'Should throw IdempotencyConflictError');
          assert.strictEqual(err.statusCode, 409);
          assert.strictEqual(err.status, 409);
          assert.strictEqual(err.code, 'IDEMPOTENCY_CONFLICT');
          assert.match(
            err.message,
            /Idempotency key was previously used with a different request payload/,
            'Error message must indicate payload mismatch conflict'
          );
          return true;
        }
      );

      assert.strictEqual(executionCount, 1, 'Business logic must NOT run when payload conflicts');
    });
  });

  describe('4. Expired Key Allows Re-execution', () => {
    test('expired key allows new execution and updates record', async () => {
      const key = `key_expire_${Date.now()}`;
      const payload1 = { step: 1 };
      const payload2 = { step: 2 };

      // 1. Insert an expired record directly into DB
      await prisma.idempotencyRecord.create({
        data: {
          userId: testUserId,
          operation: op,
          key,
          status: 'COMPLETED',
          response: {
            payloadHash: computePayloadHash(payload1),
            data: { step: 1, done: true },
          },
          expiresAt: new Date(Date.now() - 5000), // Expired 5 seconds ago
        },
      });

      // 2. Invoke withIdempotency using the same key - since it is expired, it should re-execute
      let executed = false;
      const result = await withIdempotency(
        prisma,
        {
          userId: testUserId,
          operation: op,
          key,
          payload: payload2,
          ttlMinutes: 10,
        },
        async () => {
          executed = true;
          return { step: 2, freshResult: true };
        }
      );

      assert.strictEqual(executed, true, 'Execution must run when existing record is expired');
      assert.deepStrictEqual(result, { step: 2, freshResult: true });

      // 3. Verify DB record now has status COMPLETED and updated payloadHash
      const updatedRecord = await getIdempotencyRecord(prisma, {
        userId: testUserId,
        operation: op,
        key,
      });
      assert.ok(updatedRecord);
      assert.strictEqual(updatedRecord.status, 'COMPLETED');
      const updatedResp = updatedRecord.response as any;
      assert.strictEqual(updatedResp.payloadHash, computePayloadHash(payload2));
      assert.deepStrictEqual(updatedResp.data, { step: 2, freshResult: true });
    });
  });
});
