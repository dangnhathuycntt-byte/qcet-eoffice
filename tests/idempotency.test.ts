import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import {
  withIdempotency,
  IdempotencyConflictError,
  getIdempotencyRecord,
  clearIdempotencyRecord,
  cleanupExpiredIdempotencyRecords,
} from '../src/lib/db/idempotency';

describe('Task 8: Idempotency Record Table & Helper', () => {
  const testRunId = `test_idem_${Date.now()}`;
  const testUserId1 = `user_1_${testRunId}`;
  const testUserId2 = `user_2_${testRunId}`;

  after(async () => {
    // Cleanup all idempotency records created during this test suite
    await prisma.idempotencyRecord.deleteMany({
      where: {
        userId: {
          in: [testUserId1, testUserId2],
        },
      },
    });
  });

  // ==========================================================================
  // SUITE 1: Prisma Schema & Model DMMF Integration
  // ==========================================================================
  describe('1. Prisma Schema & DMMF Verification', () => {
    test('IdempotencyRecord model is registered in Prisma DMMF', () => {
      const model = Prisma.dmmf.datamodel.models.find((m) => m.name === 'IdempotencyRecord');
      assert.ok(model, 'IdempotencyRecord model must exist in Prisma DMMF');
      assert.strictEqual(model.dbName, 'idempotency_records', 'Model must map to idempotency_records');

      const expectedFields: Record<string, { type: string; isRequired: boolean; dbName?: string }> = {
        id: { type: 'String', isRequired: true },
        userId: { type: 'String', isRequired: true, dbName: 'user_id' },
        operation: { type: 'String', isRequired: true, dbName: 'operation' },
        key: { type: 'String', isRequired: true, dbName: 'key' },
        status: { type: 'String', isRequired: true, dbName: 'status' },
        response: { type: 'Json', isRequired: false, dbName: 'response' },
        expiresAt: { type: 'DateTime', isRequired: true, dbName: 'expires_at' },
        createdAt: { type: 'DateTime', isRequired: true, dbName: 'created_at' },
      };

      interface DmmfField {
        name: string;
        type: string;
        isRequired: boolean;
        dbName?: string | null;
      }
      const fields = model.fields as unknown as DmmfField[];
      for (const [fieldName, meta] of Object.entries(expectedFields)) {
        const field = fields.find((f: DmmfField) => f.name === fieldName);
        assert.ok(field, `Field ${fieldName} must exist on IdempotencyRecord`);
        assert.strictEqual(field.type, meta.type, `Field ${fieldName} type must be ${meta.type}`);
        assert.strictEqual(field.isRequired, meta.isRequired, `Field ${fieldName} required status`);
        if (meta.dbName) {
          assert.strictEqual(field.dbName, meta.dbName, `Field ${fieldName} dbName must be ${meta.dbName}`);
        }
      }

      // Check unique compound constraint [userId, operation, key]
      const uniqueIndex = model.uniqueFields.find(
        (fields) => fields.includes('userId') && fields.includes('operation') && fields.includes('key')
      ) || model.primaryKey;
      assert.ok(
        uniqueIndex || model.uniqueIndexes.some((idx) =>
          idx.fields.includes('userId') && idx.fields.includes('operation') && idx.fields.includes('key')
        ),
        'Compound unique constraint on [userId, operation, key] must exist'
      );
    });
  });

  // ==========================================================================
  // SUITE 2: IdempotencyConflictError
  // ==========================================================================
  describe('2. IdempotencyConflictError Specification', () => {
    test('instantiates with 409 status, code IDEMPOTENCY_CONFLICT and positional arguments', () => {
      const err = new IdempotencyConflictError('u-1', 'CREATE_TASK', 'key-123');
      assert.ok(err instanceof Error);
      assert.ok(err instanceof IdempotencyConflictError);
      assert.strictEqual(err.name, 'IdempotencyConflictError');
      assert.strictEqual(err.status, 409);
      assert.strictEqual(err.statusCode, 409);
      assert.strictEqual(err.code, 'IDEMPOTENCY_CONFLICT');
      assert.strictEqual(err.userId, 'u-1');
      assert.strictEqual(err.operation, 'CREATE_TASK');
      assert.strictEqual(err.key, 'key-123');
      assert.match(err.message, /is currently pending execution/);
    });

    test('instantiates with object params and custom message', () => {
      const err = new IdempotencyConflictError({
        userId: 'u-2',
        operation: 'SUBMIT_DELIVERABLE',
        key: 'key-999',
        message: 'Custom conflict error message',
      });
      assert.strictEqual(err.userId, 'u-2');
      assert.strictEqual(err.operation, 'SUBMIT_DELIVERABLE');
      assert.strictEqual(err.key, 'key-999');
      assert.strictEqual(err.message, 'Custom conflict error message');
    });
  });

  // ==========================================================================
  // SUITE 3: Core Idempotency Execution Flow
  // ==========================================================================
  describe('3. Core Idempotency Execution & Caching', () => {
    test('executes fn on first invocation and stores response', async () => {
      let executionCount = 0;
      const key = `key_first_${Date.now()}`;
      const op = 'TASK_CREATE';

      const result = await withIdempotency(
        prisma,
        { userId: testUserId1, operation: op, key, ttlMinutes: 10 },
        async () => {
          executionCount++;
          return { taskId: 'task-abc-1', success: true, count: 42 };
        }
      );

      assert.strictEqual(executionCount, 1, 'fn should have executed once');
      assert.deepStrictEqual(result, { taskId: 'task-abc-1', success: true, count: 42 });

      // Verify DB record
      const record = await getIdempotencyRecord(prisma, {
        userId: testUserId1,
        operation: op,
        key,
      });
      assert.ok(record, 'Idempotency record should exist in database');
      assert.strictEqual(record.status, 'COMPLETED');
      assert.deepStrictEqual(record.response, { taskId: 'task-abc-1', success: true, count: 42 });
    });

    test('duplicate call with same userId, operation, key returns cached response without re-executing fn', async () => {
      let executionCount = 0;
      const key = `key_dup_${Date.now()}`;
      const op = 'DELIVERABLE_SUBMIT';

      const workerFn = async () => {
        executionCount++;
        return { deliverableId: 'deliv-xyz-9', submittedAt: '2026-09-09T10:00:00Z' };
      };

      // Call 1: First invocation
      const result1 = await withIdempotency(
        prisma,
        { userId: testUserId1, operation: op, key, ttlMinutes: 30 },
        workerFn
      );
      assert.strictEqual(executionCount, 1, 'First call must execute fn');

      // Call 2: Duplicate invocation with identical key
      const result2 = await withIdempotency(
        prisma,
        { userId: testUserId1, operation: op, key, ttlMinutes: 30 },
        workerFn
      );
      assert.strictEqual(executionCount, 1, 'Second duplicate call must NOT re-execute fn');
      assert.deepStrictEqual(result2, result1, 'Duplicate call must return exact cached response');

      // Call 3: Another duplicate invocation
      const result3 = await withIdempotency(
        prisma,
        { userId: testUserId1, operation: op, key },
        workerFn
      );
      assert.strictEqual(executionCount, 1, 'Third duplicate call must NOT re-execute fn');
      assert.deepStrictEqual(result3, result1, 'Third duplicate call must return cached response');
    });

    test('supports default prisma client when client parameter is omitted', async () => {
      let count = 0;
      const key = `key_default_client_${Date.now()}`;

      const res1 = await withIdempotency(
        { userId: testUserId1, operation: 'OP_DEFAULT', key },
        async () => {
          count++;
          return { value: 'from_default_client' };
        }
      );

      const res2 = await withIdempotency(
        { userId: testUserId1, operation: 'OP_DEFAULT', key },
        async () => {
          count++;
          return { value: 'from_default_client' };
        }
      );

      assert.strictEqual(count, 1);
      assert.deepStrictEqual(res1, { value: 'from_default_client' });
      assert.deepStrictEqual(res2, { value: 'from_default_client' });
    });
  });

  // ==========================================================================
  // SUITE 4: Scope Isolation: Keys, Users, and Operations
  // ==========================================================================
  describe('4. Scope Isolation', () => {
    test('different keys for the same user and operation execute independently', async () => {
      let counterA = 0;
      let counterB = 0;
      const op = 'TASK_APPROVAL';
      const keyA = `key_diffA_${Date.now()}`;
      const keyB = `key_diffB_${Date.now()}`;

      const resA = await withIdempotency(prisma, { userId: testUserId1, operation: op, key: keyA }, async () => {
        counterA++;
        return { item: 'A' };
      });

      const resB = await withIdempotency(prisma, { userId: testUserId1, operation: op, key: keyB }, async () => {
        counterB++;
        return { item: 'B' };
      });

      assert.strictEqual(counterA, 1);
      assert.strictEqual(counterB, 1);
      assert.deepStrictEqual(resA, { item: 'A' });
      assert.deepStrictEqual(resB, { item: 'B' });
    });

    test('different users for the same operation and key execute independently', async () => {
      let user1Count = 0;
      let user2Count = 0;
      const op = 'SHARED_KEY_OP';
      const sharedKey = `shared_key_${Date.now()}`;

      const resUser1 = await withIdempotency(
        prisma,
        { userId: testUserId1, operation: op, key: sharedKey },
        async () => {
          user1Count++;
          return { user: 'user1' };
        }
      );

      const resUser2 = await withIdempotency(
        prisma,
        { userId: testUserId2, operation: op, key: sharedKey },
        async () => {
          user2Count++;
          return { user: 'user2' };
        }
      );

      assert.strictEqual(user1Count, 1);
      assert.strictEqual(user2Count, 1);
      assert.deepStrictEqual(resUser1, { user: 'user1' });
      assert.deepStrictEqual(resUser2, { user: 'user2' });
    });

    test('different operations for the same user and key execute independently', async () => {
      let op1Count = 0;
      let op2Count = 0;
      const commonKey = `common_key_${Date.now()}`;

      const resOp1 = await withIdempotency(
        prisma,
        { userId: testUserId1, operation: 'OP_ONE', key: commonKey },
        async () => {
          op1Count++;
          return { op: 1 };
        }
      );

      const resOp2 = await withIdempotency(
        prisma,
        { userId: testUserId1, operation: 'OP_TWO', key: commonKey },
        async () => {
          op2Count++;
          return { op: 2 };
        }
      );

      assert.strictEqual(op1Count, 1);
      assert.strictEqual(op2Count, 1);
      assert.deepStrictEqual(resOp1, { op: 1 });
      assert.deepStrictEqual(resOp2, { op: 2 });
    });
  });

  // ==========================================================================
  // SUITE 5: Expiration Handling
  // ==========================================================================
  describe('5. Expired Records Allow Re-execution', () => {
    test('allows re-execution when existing record has expired', async () => {
      let executionCount = 0;
      const key = `key_expire_${Date.now()}`;
      const op = 'RETRYABLE_OP';

      // Pre-create an expired record in the past
      await prisma.idempotencyRecord.create({
        data: {
          userId: testUserId1,
          operation: op,
          key,
          status: 'COMPLETED',
          response: { old: true },
          expiresAt: new Date(Date.now() - 60 * 1000), // expired 1 minute ago
        },
      });

      // Calling withIdempotency should detect expiration and re-execute fn
      const result = await withIdempotency(
        prisma,
        { userId: testUserId1, operation: op, key, ttlMinutes: 10 },
        async () => {
          executionCount++;
          return { fresh: true, count: 100 };
        }
      );

      assert.strictEqual(executionCount, 1, 'Should execute fn because prior record was expired');
      assert.deepStrictEqual(result, { fresh: true, count: 100 });

      // Verify record is updated to new expiration and new response
      const updated = await getIdempotencyRecord(prisma, {
        userId: testUserId1,
        operation: op,
        key,
      });
      assert.ok(updated);
      assert.strictEqual(updated.status, 'COMPLETED');
      assert.deepStrictEqual(updated.response, { fresh: true, count: 100 });
      assert.ok(updated.expiresAt.getTime() > Date.now(), 'New record should have future expiresAt');
    });
  });

  // ==========================================================================
  // SUITE 6: Failure & Retry Handling
  // ==========================================================================
  describe('6. Failed Executions Permit Retries', () => {
    test('updates status to FAILED and rethrows error on failure', async () => {
      const key = `key_fail_${Date.now()}`;
      const op = 'FAILING_OP';

      await assert.rejects(
        async () => {
          await withIdempotency(
            prisma,
            { userId: testUserId1, operation: op, key },
            async () => {
              throw new Error('Database transaction failed intentionally');
            }
          );
        },
        /Database transaction failed intentionally/
      );

      // Verify record is marked as FAILED
      const record = await getIdempotencyRecord(prisma, {
        userId: testUserId1,
        operation: op,
        key,
      });
      assert.ok(record, 'Record should exist after failure');
      assert.strictEqual(record.status, 'FAILED');
    });

    test('permits retry and succeeds after previous FAILED execution', async () => {
      let executionCount = 0;
      const key = `key_retry_success_${Date.now()}`;
      const op = 'RETRY_OP';

      // 1. First execution fails
      await assert.rejects(
        async () => {
          await withIdempotency(prisma, { userId: testUserId1, operation: op, key }, async () => {
            executionCount++;
            throw new Error('Transient network glitch');
          });
        },
        /Transient network glitch/
      );
      assert.strictEqual(executionCount, 1);

      // Verify status is FAILED
      let record = await getIdempotencyRecord(prisma, {
        userId: testUserId1,
        operation: op,
        key,
      });
      assert.strictEqual(record?.status, 'FAILED');

      // 2. Retry execution succeeds
      const result = await withIdempotency(prisma, { userId: testUserId1, operation: op, key }, async () => {
        executionCount++;
        return { recovered: true, attempt: 2 };
      });

      assert.strictEqual(executionCount, 2, 'Retry must execute fn');
      assert.deepStrictEqual(result, { recovered: true, attempt: 2 });

      // Verify status is now COMPLETED
      record = await getIdempotencyRecord(prisma, {
        userId: testUserId1,
        operation: op,
        key,
      });
      assert.strictEqual(record?.status, 'COMPLETED');
      assert.deepStrictEqual(record?.response, { recovered: true, attempt: 2 });

      // 3. Third call is cached
      const cached = await withIdempotency(prisma, { userId: testUserId1, operation: op, key }, async () => {
        executionCount++;
        return { recovered: true, attempt: 3 };
      });
      assert.strictEqual(executionCount, 2, 'Third call must use cached response');
      assert.deepStrictEqual(cached, { recovered: true, attempt: 2 });
    });
  });

  // ==========================================================================
  // SUITE 7: Concurrent PENDING Conflict & Polling
  // ==========================================================================
  describe('7. Concurrent PENDING In-Flight Conflict & Polling', () => {
    test('throws IdempotencyConflictError when record is currently PENDING (fail-fast)', async () => {
      const key = `key_pending_${Date.now()}`;
      const op = 'CONCURRENT_OP';

      // Manually create a PENDING record in progress
      await prisma.idempotencyRecord.create({
        data: {
          userId: testUserId1,
          operation: op,
          key,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });

      // Calling with lockTimeoutMs: 0 (or default) should throw IdempotencyConflictError
      await assert.rejects(
        async () => {
          await withIdempotency(
            prisma,
            { userId: testUserId1, operation: op, key, lockTimeoutMs: 0 },
            async () => {
              return { shouldNotRun: true };
            }
          );
        },
        (err: any) => {
          assert.ok(err instanceof IdempotencyConflictError);
          assert.strictEqual(err.status, 409);
          assert.strictEqual(err.code, 'IDEMPOTENCY_CONFLICT');
          assert.strictEqual(err.userId, testUserId1);
          assert.strictEqual(err.operation, op);
          assert.strictEqual(err.key, key);
          return true;
        }
      );
    });

    test('waits and resolves cached result when PENDING record transitions to COMPLETED', async () => {
      const key = `key_poll_${Date.now()}`;
      const op = 'POLLING_OP';

      // 1. Create a PENDING record
      const record = await prisma.idempotencyRecord.create({
        data: {
          userId: testUserId1,
          operation: op,
          key,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });

      // 2. Simulate concurrent background worker completing the task in 100ms
      setTimeout(async () => {
        await prisma.idempotencyRecord.update({
          where: { id: record.id },
          data: {
            status: 'COMPLETED',
            response: { simulatedAsyncResult: true },
          },
        });
      }, 100);

      // 3. Request with lockTimeoutMs = 1000 should poll and resolve successfully
      let fnRan = false;
      const result = await withIdempotency(
        prisma,
        {
          userId: testUserId1,
          operation: op,
          key,
          lockTimeoutMs: 1500,
          pollIntervalMs: 25,
        },
        async () => {
          fnRan = true;
          return { error: 'Should not run' };
        }
      );

      assert.strictEqual(fnRan, false, 'fn must not run because concurrent task completed');
      assert.deepStrictEqual(result, { simulatedAsyncResult: true });
    });
  });

  // ==========================================================================
  // SUITE 8: Cleanup and Manual Management Helpers
  // ==========================================================================
  describe('8. Management & Cleanup Helpers', () => {
    test('clearIdempotencyRecord evicts existing record', async () => {
      const key = `key_clear_${Date.now()}`;
      const op = 'CLEAR_OP';

      await withIdempotency(prisma, { userId: testUserId1, operation: op, key }, async () => ({ cleared: false }));

      const existsBefore = await getIdempotencyRecord(prisma, { userId: testUserId1, operation: op, key });
      assert.ok(existsBefore);

      const evicted = await clearIdempotencyRecord(prisma, { userId: testUserId1, operation: op, key });
      assert.strictEqual(evicted, true);

      const existsAfter = await getIdempotencyRecord(prisma, { userId: testUserId1, operation: op, key });
      assert.strictEqual(existsAfter, null);
    });

    test('cleanupExpiredIdempotencyRecords deletes expired records while preserving active', async () => {
      const expiredKey = `key_expired_clean_${Date.now()}`;
      const activeKey = `key_active_clean_${Date.now()}`;

      // Insert one expired and one active record
      await prisma.idempotencyRecord.create({
        data: {
          userId: testUserId1,
          operation: 'CLEANUP_TEST',
          key: expiredKey,
          status: 'COMPLETED',
          response: { exp: true },
          expiresAt: new Date(Date.now() - 10000), // 10s ago
        },
      });

      await prisma.idempotencyRecord.create({
        data: {
          userId: testUserId1,
          operation: 'CLEANUP_TEST',
          key: activeKey,
          status: 'COMPLETED',
          response: { active: true },
          expiresAt: new Date(Date.now() + 60000), // 60s in future
        },
      });

      const deletedCount = await cleanupExpiredIdempotencyRecords(prisma, new Date());
      assert.ok(deletedCount >= 1, 'Should delete at least 1 expired record');

      const expiredRecord = await getIdempotencyRecord(prisma, {
        userId: testUserId1,
        operation: 'CLEANUP_TEST',
        key: expiredKey,
      });
      assert.strictEqual(expiredRecord, null, 'Expired record should have been cleaned up');

      const activeRecord = await getIdempotencyRecord(prisma, {
        userId: testUserId1,
        operation: 'CLEANUP_TEST',
        key: activeKey,
      });
      assert.ok(activeRecord, 'Active record must remain intact');
    });
  });

  // ==========================================================================
  // SUITE 9: Interactive Transaction Client Integration
  // ==========================================================================
  describe('9. Interactive Transaction Integration', () => {
    test('executes seamlessly with interactive transaction client (tx)', async () => {
      const key = `key_tx_${Date.now()}`;
      const op = 'TX_OP';

      const result = await prisma.$transaction(async (tx) => {
        return withIdempotency(tx, { userId: testUserId1, operation: op, key }, async () => {
          return { insideTx: true, txSuccess: true };
        });
      });

      assert.deepStrictEqual(result, { insideTx: true, txSuccess: true });

      const record = await getIdempotencyRecord(prisma, { userId: testUserId1, operation: op, key });
      assert.ok(record);
      assert.strictEqual(record.status, 'COMPLETED');
      assert.deepStrictEqual(record.response, { insideTx: true, txSuccess: true });
    });
  });
});
