import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { OutboxStatus } from '@prisma/client';
import {
  publishOutboxEvent,
  processOutboxEvent,
  processOutboxBatch,
  retryFailedOutboxEvents,
  calculateExponentialBackoff,
} from '../src/lib/db/outbox';

describe('Tasks 3.15-3.16: Outbox Worker & Transactional Reliability', () => {
  const testRunId = `worker_test_${Date.now()}`;
  let testDepartmentId: string;
  let testUserId: string;

  before(async () => {
    let dept = await prisma.organizationalUnit.findFirst();
    if (!dept) {
      dept = await prisma.organizationalUnit.create({
        data: {
          id: `dept-worker-${Date.now()}`,
          code: `dept-worker-${Date.now()}`,
          name: 'Phòng Outbox Worker Test',
          type: 'PHONG_BAN' as any,
          status: 'ACTIVE' as any,
        },
      });
    }
    testDepartmentId = dept.id;

    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: `worker_${testRunId}@qncet.edu.vn`,
          name: 'Outbox Worker User',
          role: 'CHUYEN_VIEN',

        },
      });
    }
    testUserId = user.id;
  });

  after(async () => {
    await prisma.outboxEvent.deleteMany({
      where: {
        OR: [
          { aggregateId: { contains: testRunId } },
          { aggregateType: { contains: testRunId } },
        ],
      },
    });
  });

  describe('1. Transactional Atomicity with Business Entity', () => {
    test('commits outbox event atomically with business entity inside Prisma transaction', async () => {
      const taskId = `task_atom_${Date.now()}`;
      const eventType = `TASK_CREATED_${testRunId}`;

      await prisma.$transaction(async (tx) => {
        // Business mutation
        await tx.task.create({
          data: {
            id: taskId,
            code: `NV-ATOM-${Date.now()}`,
            title: 'Nhiệm vụ kiểm thử outbox atomicity',
            priority: 'NORMAL',
            scope: 'DEPARTMENT',

            createdById: testUserId,
            academicMonth: 9,
            academicYear: '2025-2026',
            dueDate: new Date(Date.now() + 86400000),
          },
        });

        // Outbox event creation within same transaction
        await publishOutboxEvent(tx, {
          eventType,
          aggregateType: 'Task',
          aggregateId: taskId,
          payload: { taskId, title: 'Nhiệm vụ kiểm thử outbox atomicity' },
        });
      });

      // Verify both business entity and outbox event were committed
      const createdTask = await prisma.task.findUnique({ where: { id: taskId } });
      assert.ok(createdTask, 'Task must be committed');

      const outboxRecord = await prisma.outboxEvent.findFirst({
        where: { aggregateId: taskId, eventType },
      });
      assert.ok(outboxRecord, 'Outbox event must be committed within same transaction');
      assert.strictEqual(outboxRecord.status, OutboxStatus.PENDING);
      assert.strictEqual(outboxRecord.attempts, 0);

      // Clean up task
      await prisma.task.delete({ where: { id: taskId } });
    });

    test('rolls back outbox event when transaction aborts, leaving no orphan event', async () => {
      const abortTaskId = `task_abort_${Date.now()}`;
      const eventType = `TASK_ABORT_${testRunId}`;

      await assert.rejects(async () => {
        await prisma.$transaction(async (tx) => {
          await publishOutboxEvent(tx, {
            eventType,
            aggregateType: 'Task',
            aggregateId: abortTaskId,
            payload: { aborted: true },
          });

          throw new Error('Forced rollback to verify zero orphan outbox events');
        });
      });

      const orphan = await prisma.outboxEvent.findFirst({
        where: { aggregateId: abortTaskId },
      });
      assert.strictEqual(orphan, null, 'No orphan outbox event should exist after rollback');
    });
  });

  describe('2. Batch Processing Success Transition (PENDING -> COMPLETED)', () => {
    test('transitions PENDING event to COMPLETED and sets processedAt timestamp', async () => {
      const aggId = `success_item_${testRunId}`;
      const eventType = `EVENT_SUCCESS_${testRunId}`;
      const aggType = `AGG_${testRunId}`;

      const created = await publishOutboxEvent(prisma, {
        eventType,
        aggregateType: aggType,
        aggregateId: aggId,
        payload: { message: 'Gửi thông báo thành công' },
      });

      assert.strictEqual(created.status, OutboxStatus.PENDING);

      let handlerCalled = false;
      let receivedEventPayload: any = null;

      const batchResult = await processOutboxBatch(
        prisma,
        {
          [eventType]: async (event) => {
            handlerCalled = true;
            receivedEventPayload = event.payload;
          },
        },
        {
          eventType,
        }
      );

      assert.strictEqual(handlerCalled, true, 'Handler must be invoked');
      assert.deepStrictEqual(receivedEventPayload, { message: 'Gửi thông báo thành công' });
      assert.strictEqual(batchResult.succeeded, 1);
      assert.strictEqual(batchResult.failed, 0);

      // Verify DB record status
      const updated = await prisma.outboxEvent.findUnique({ where: { id: created.id } });
      assert.ok(updated);
      assert.strictEqual(updated.status, OutboxStatus.COMPLETED);
      assert.strictEqual(updated.attempts, 1);
      assert.ok(updated.processedAt instanceof Date, 'processedAt must be recorded');
      assert.strictEqual(updated.lastError, null);
    });
  });

  describe('3. Transient Failure & Exponential Retry Backoff', () => {
    test('retries failed handler, increments attempts, and schedules next retry with exponential backoff', async () => {
      const aggId = `retry_item_${testRunId}`;
      const eventType = `EVENT_RETRY_${testRunId}`;
      const aggType = `AGG_${testRunId}`;

      const event = await publishOutboxEvent(prisma, {
        eventType,
        aggregateType: aggType,
        aggregateId: aggId,
        payload: { tryNumber: 1 },
      });

      const now = new Date();
      const baseBackoffSeconds = 5;
      const exponentialBase = 2;

      const result = await processOutboxEvent(
        prisma,
        event,
        async () => {
          throw new Error('Connection timeout to upstream mail server');
        },
        {
          now,
          maxRetries: 3,
          baseBackoffSeconds,
          exponentialBase,
        }
      );

      // Returns PENDING status with incremented attempt
      assert.strictEqual(result.status, OutboxStatus.PENDING);
      assert.strictEqual(result.attempts, 1);

      // Verify in database
      const dbEvent = await prisma.outboxEvent.findUnique({ where: { id: event.id } });
      assert.ok(dbEvent);
      assert.strictEqual(dbEvent.status, OutboxStatus.PENDING);
      assert.strictEqual(dbEvent.attempts, 1);
      assert.strictEqual(dbEvent.lastError, 'Connection timeout to upstream mail server');

      // Expected backoff for attempt 1: baseBackoffSeconds * (exponentialBase ^ (1 - 1)) = 5 * 1 = 5s
      const expectedDelay = calculateExponentialBackoff(1, baseBackoffSeconds, exponentialBase);
      assert.strictEqual(expectedDelay, 5);

      const expectedAvailableAt = new Date(now.getTime() + expectedDelay * 1000);
      assert.strictEqual(
        dbEvent.availableAt.toISOString(),
        expectedAvailableAt.toISOString(),
        'availableAt must match exponential backoff timestamp'
      );
    });
  });

  describe('4. Dead-Letter Queue Terminal Failure (PENDING -> FAILED)', () => {
    test('transitions to FAILED when attempts reach maxRetries and records fatal error', async () => {
      const aggId = `dead_item_${testRunId}`;
      const eventType = `EVENT_DEAD_${testRunId}`;
      const aggType = `AGG_${testRunId}`;

      // Create an event that already failed 2 times
      const event = await prisma.outboxEvent.create({
        data: {
          eventType,
          aggregateType: aggType,
          aggregateId: aggId,
          payload: { critical: true },
          status: OutboxStatus.PENDING,
          attempts: 2,
        },
      });

      const now = new Date();
      const result = await processOutboxEvent(
        prisma,
        event,
        async () => {
          throw new Error('Permanent authentication failure at external service');
        },
        {
          now,
          maxRetries: 3,
        }
      );

      assert.strictEqual(result.status, OutboxStatus.FAILED);
      assert.strictEqual(result.attempts, 3);
      assert.strictEqual(result.error, 'Permanent authentication failure at external service');

      // Verify DB record is marked FAILED
      const dbEvent = await prisma.outboxEvent.findUnique({ where: { id: event.id } });
      assert.ok(dbEvent);
      assert.strictEqual(dbEvent.status, OutboxStatus.FAILED);
      assert.strictEqual(dbEvent.attempts, 3);
      assert.strictEqual(dbEvent.lastError, 'Permanent authentication failure at external service');
      assert.ok(dbEvent.processedAt instanceof Date);

      // Verify retryFailedOutboxEvents can recover it back to PENDING for manual replay
      const retryResult = await retryFailedOutboxEvents(prisma, {
        ids: [event.id],
        resetAttempts: true,
      });
      assert.strictEqual(retryResult.updatedCount, 1);

      const recoveredEvent = await prisma.outboxEvent.findUnique({ where: { id: event.id } });
      assert.ok(recoveredEvent);
      assert.strictEqual(recoveredEvent.status, OutboxStatus.PENDING);
      assert.strictEqual(recoveredEvent.attempts, 0);
      assert.strictEqual(recoveredEvent.lastError, null);
    });
  });
});
