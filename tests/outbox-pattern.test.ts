import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma, OutboxStatus } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import {
  publishOutboxEvent,
  publishOutboxEvents,
  fetchAvailableOutboxEvents,
  processOutboxEvent,
  processOutboxBatch,
  calculateExponentialBackoff,
  getOutboxMetrics,
  retryFailedOutboxEvents,
  cleanupCompletedOutboxEvents,
  OutboxEventType,
  OutboxAggregateType,
  type OutboxEventHandler,
} from '../src/lib/db/outbox';

describe('Task 10: Transactional Outbox Pattern & Model', () => {
  const testRunId = `outbox_test_${Date.now()}`;
  let testDepartmentId: string;
  let testUserId: string;

  before(async () => {
    // 1. Ensure test department exists
    let dept = await prisma.organizationalUnit.findFirst();
    if (!dept) {
      dept = await prisma.organizationalUnit.create({
        data: {
          id: `dept-outbox-${Date.now()}`,
          code: `dept-outbox-${Date.now()}`,
          name: 'Phòng Kiểm Thử Outbox',
          type: "DEPARTMENT" as any,
          status: 'ACTIVE' as any,
        },
      });
    }
    testDepartmentId = dept.id;

    // 2. Ensure test user exists
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: `outbox_user_${testRunId}@qncet.edu.vn`,
          name: 'Outbox Test User',
          role: 'CHUYEN_VIEN',

        },
      });
    }
    testUserId = user.id;
  });

  after(async () => {
    // Clean up all outbox events created during this test run
    await prisma.outboxEvent.deleteMany({
      where: {
        OR: [
          { aggregateId: { contains: testRunId } },
          { eventType: { contains: testRunId } },
        ],
      },
    });

    // Clean up test tasks created during test run
    await prisma.task.deleteMany({
      where: { title: { contains: testRunId } },
    });
  });

  // ==========================================================================
  // SUITE 1: Prisma Schema, DMMF & Database Structure Verification
  // ==========================================================================
  describe('1. Schema & DMMF Verification', () => {
    test('OutboxStatus enum is properly registered in Prisma DMMF', () => {
      const enumDef = Prisma.dmmf.datamodel.enums.find(
        (e) => e.name === 'OutboxStatus'
      );
      assert.ok(enumDef, 'OutboxStatus enum must exist in Prisma DMMF');

      const expectedValues = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'];
      const actualValues = enumDef.values.map((v) => v.name);
      assert.deepStrictEqual(
        actualValues.sort(),
        expectedValues.sort(),
        'OutboxStatus enum values must match specification'
      );
    });

    test('OutboxEvent model is registered in Prisma DMMF with exact fields', () => {
      const model = Prisma.dmmf.datamodel.models.find(
        (m) => m.name === 'OutboxEvent'
      );
      assert.ok(model, 'OutboxEvent model must exist in Prisma DMMF');
      assert.strictEqual(
        model.dbName,
        'outbox_events',
        'Model must map to table outbox_events'
      );

      const expectedFields: Record<
        string,
        { type: string; isRequired: boolean; dbName?: string }
      > = {
        id: { type: 'String', isRequired: true },
        eventType: { type: 'String', isRequired: true, dbName: 'event_type' },
        aggregateType: {
          type: 'String',
          isRequired: true,
          dbName: 'aggregate_type',
        },
        aggregateId: {
          type: 'String',
          isRequired: true,
          dbName: 'aggregate_id',
        },
        payload: { type: 'Json', isRequired: true, dbName: 'payload' },
        status: { type: 'OutboxStatus', isRequired: true, dbName: 'status' },
        attempts: { type: 'Int', isRequired: true, dbName: 'attempts' },
        lastError: { type: 'String', isRequired: false, dbName: 'last_error' },
        availableAt: {
          type: 'DateTime',
          isRequired: true,
          dbName: 'available_at',
        },
        processedAt: {
          type: 'DateTime',
          isRequired: false,
          dbName: 'processed_at',
        },
        createdAt: {
          type: 'DateTime',
          isRequired: true,
          dbName: 'created_at',
        },
      };

      for (const [fieldName, expectations] of Object.entries(expectedFields)) {
        const foundField: any = model.fields.find((f: any) => f.name === fieldName);
        assert.ok(
          foundField,
          `Field ${fieldName} must exist on OutboxEvent model`
        );
        assert.strictEqual(
          foundField.type,
          expectations.type,
          `Field ${fieldName} type mismatch`
        );
        assert.strictEqual(
          foundField.isRequired,
          expectations.isRequired,
          `Field ${fieldName} isRequired mismatch`
        );
        if (expectations.dbName) {
          assert.strictEqual(
            foundField.dbName,
            expectations.dbName,
            `Field ${fieldName} dbName mapping mismatch`
          );
        }
      }
    });

    test('OutboxEvent table and indexes exist in PostgreSQL', async () => {
      const indexes = await prisma.$queryRaw<
        Array<{ indexname: string; indexdef: string }>
      >`
        SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'outbox_events';
      `;

      assert.ok(
        indexes.length >= 2,
        'outbox_events must have configured indexes in PostgreSQL'
      );

      const statusIndex = indexes.find(
        (i) =>
          i.indexdef.includes('status') && i.indexdef.includes('available_at')
      );
      assert.ok(
        statusIndex,
        'Compound index [status, available_at] must exist on outbox_events'
      );

      const aggregateIndex = indexes.find(
        (i) =>
          i.indexdef.includes('aggregate_type') &&
          i.indexdef.includes('aggregate_id')
      );
      assert.ok(
        aggregateIndex,
        'Compound index [aggregate_type, aggregate_id] must exist on outbox_events'
      );
    });
  });

  // ==========================================================================
  // SUITE 2: Transactional Atomicity & Clean Rollback Invariants
  // ==========================================================================
  describe('2. Transactional Atomicity & Clean Rollback', () => {
    test('publishOutboxEvent atomically commits with business entity in transaction', async () => {
      const taskId = `task_tx_commit_${testRunId}`;
      const outboxId = `outbox_tx_commit_${testRunId}`;

      await prisma.$transaction(async (tx) => {
        // 1. Primary business state write
        await tx.task.create({
          data: {
            id: taskId,
            code: `OUTBOX-${Date.now()}`,
            title: `Task Commit ${testRunId}`,
            createdById: testUserId,

            academicMonth: 9,
            academicYear: '2026-2027',
            dueDate: new Date('2026-09-30T17:00:00Z'),
          },
        });

        // 2. Outbox event enqueue inside same interactive transaction
        await publishOutboxEvent(tx, {
          id: outboxId,
          eventType: OutboxEventType.TASK_CREATED_NOTIFICATION,
          aggregateType: OutboxAggregateType.TASK,
          aggregateId: taskId,
          payload: {
            taskId,
            creatorId: testUserId,
            title: `Task Commit ${testRunId}`,
          },
        });
      });

      // Assert both records committed atomically to PostgreSQL
      const persistedTask = await prisma.task.findUnique({
        where: { id: taskId },
      });
      assert.ok(persistedTask, 'Task must be committed');

      const persistedEvent = await prisma.outboxEvent.findUnique({
        where: { id: outboxId },
      });
      assert.ok(persistedEvent, 'OutboxEvent must be committed atomically');
      assert.strictEqual(persistedEvent.status, OutboxStatus.PENDING);
      assert.strictEqual(persistedEvent.attempts, 0);
      assert.strictEqual(persistedEvent.aggregateId, taskId);
      assert.strictEqual(persistedEvent.aggregateType, 'Task');
    });

    test('transaction rollback cleans up unpublished outbox events with zero orphan records', async () => {
      const taskId = `task_tx_abort_${testRunId}`;
      const outboxId = `outbox_tx_abort_${testRunId}`;

      let transactionError: Error | null = null;

      try {
        await prisma.$transaction(async (tx) => {
          // 1. Create task
          await tx.task.create({
            data: {
              id: taskId,
              code: `OUTBOX-ABORT-${Date.now()}`,
              title: `Task Abort ${testRunId}`,
              createdById: testUserId,

              academicMonth: 9,
              academicYear: '2026-2027',
              dueDate: new Date('2026-09-30T17:00:00Z'),
            },
          });

          // 2. Enqueue outbox event
          await publishOutboxEvent(tx, {
            id: outboxId,
            eventType: OutboxEventType.TASK_CREATED_NOTIFICATION,
            aggregateType: OutboxAggregateType.TASK,
            aggregateId: taskId,
            payload: { taskId },
          });

          // 3. Force artificial failure to trigger transaction rollback
          throw new Error('SIMULATED_BUSINESS_RULE_VIOLATION');
        });
      } catch (err: any) {
        transactionError = err;
      }

      assert.ok(transactionError, 'Transaction must throw');
      assert.strictEqual(
        transactionError?.message,
        'SIMULATED_BUSINESS_RULE_VIOLATION'
      );

      // Verify that neither the task nor the outbox event exist in PostgreSQL
      const task = await prisma.task.findUnique({ where: { id: taskId } });
      assert.strictEqual(
        task,
        null,
        'Task must be rolled back on transaction error'
      );

      const event = await prisma.outboxEvent.findUnique({
        where: { id: outboxId },
      });
      assert.strictEqual(
        event,
        null,
        'OutboxEvent must be rolled back on transaction error (zero orphan events)'
      );
    });

    test('publishOutboxEvents supports multi-event batch publishing', async () => {
      const aggregateId = `batch_${testRunId}`;
      const events = await publishOutboxEvents(prisma, [
        {
          eventType: OutboxEventType.TASK_ASSIGNED_NOTIFICATION,
          aggregateType: OutboxAggregateType.TASK,
          aggregateId,
          payload: { recipientId: testUserId, role: 'PRIMARY_OWNER' },
        },
        {
          eventType: OutboxEventType.PUSH_NOTIFICATION_DISPATCH,
          aggregateType: OutboxAggregateType.PUSH_SUBSCRIPTION,
          aggregateId,
          payload: { title: 'New Task Assignment' },
        },
      ]);

      assert.strictEqual(events.length, 2);
      assert.strictEqual(events[0].status, OutboxStatus.PENDING);
      assert.strictEqual(events[1].status, OutboxStatus.PENDING);
    });
  });

  // ==========================================================================
  // SUITE 3: Query & Fetching Invariants (FIFO & Availability Filtering)
  // ==========================================================================
  describe('3. Fetch Available Outbox Events', () => {
    test('fetches only PENDING events with availableAt <= now, sorted FIFO', async () => {
      const now = new Date();
      const pastTime = new Date(now.getTime() - 10000);
      const futureTime = new Date(now.getTime() + 60000);

      // Event 1: Available (past)
      const ev1 = await publishOutboxEvent(prisma, {
        eventType: `TEST_FIFO_1_${testRunId}`,
        aggregateType: 'Test',
        aggregateId: `fifo_1_${testRunId}`,
        payload: { sequence: 1 },
        availableAt: pastTime,
      });

      // Event 2: Available (now)
      const ev2 = await publishOutboxEvent(prisma, {
        eventType: `TEST_FIFO_2_${testRunId}`,
        aggregateType: 'Test',
        aggregateId: `fifo_2_${testRunId}`,
        payload: { sequence: 2 },
        availableAt: now,
      });

      // Event 3: Future (not yet available)
      const ev3 = await publishOutboxEvent(prisma, {
        eventType: `TEST_FIFO_FUTURE_${testRunId}`,
        aggregateType: 'Test',
        aggregateId: `fifo_future_${testRunId}`,
        payload: { sequence: 3 },
        availableAt: futureTime,
      });

      // Fetch with current time
      const availableEvents = await fetchAvailableOutboxEvents(prisma, {
        now,
        aggregateType: 'Test',
      });

      const fetchedIds = availableEvents.map((e) => e.id);
      assert.ok(
        fetchedIds.includes(ev1.id),
        'Past event must be fetched as available'
      );
      assert.ok(
        fetchedIds.includes(ev2.id),
        'Current event must be fetched as available'
      );
      assert.ok(
        !fetchedIds.includes(ev3.id),
        'Future event must NOT be fetched before availableAt'
      );

      // Check ordering between ev1 and ev2
      const idx1 = fetchedIds.indexOf(ev1.id);
      const idx2 = fetchedIds.indexOf(ev2.id);
      assert.ok(idx1 < idx2, 'Older availableAt must come before newer (FIFO)');
    });

    test('ignores COMPLETED and FAILED events during fetch', async () => {
      const ev = await publishOutboxEvent(prisma, {
        eventType: `TEST_STATUS_FILTER_${testRunId}`,
        aggregateType: 'TestStatus',
        aggregateId: `status_${testRunId}`,
        payload: {},
      });

      // Mark COMPLETED
      await prisma.outboxEvent.update({
        where: { id: ev.id },
        data: { status: OutboxStatus.COMPLETED },
      });

      const list = await fetchAvailableOutboxEvents(prisma, {
        aggregateType: 'TestStatus',
      });
      assert.strictEqual(
        list.some((e) => e.id === ev.id),
        false,
        'COMPLETED events must not be fetched'
      );

      // Mark FAILED
      await prisma.outboxEvent.update({
        where: { id: ev.id },
        data: { status: OutboxStatus.FAILED },
      });

      const list2 = await fetchAvailableOutboxEvents(prisma, {
        aggregateType: 'TestStatus',
      });
      assert.strictEqual(
        list2.some((e) => e.id === ev.id),
        false,
        'FAILED events must not be fetched'
      );
    });
  });

  // ==========================================================================
  // SUITE 4: Dispatcher Routing & Successful Execution
  // ==========================================================================
  describe('4. Dispatcher Routing & Success Lifecycle', () => {
    test('routes event to handler by eventType and marks COMPLETED with processedAt', async () => {
      let handlerCalled = false;
      let handledEventPayload: any = null;

      const ev = await publishOutboxEvent(prisma, {
        eventType: `NOTIF_EVENT_TYPE_${testRunId}`,
        aggregateType: 'Task',
        aggregateId: `task_notif_${testRunId}`,
        payload: { greeting: 'Hello QCET' },
      });

      const handlers = {
        [`NOTIF_EVENT_TYPE_${testRunId}`]: async (event: any) => {
          handlerCalled = true;
          handledEventPayload = event.payload;
        },
      };

      const result = await processOutboxEvent(prisma, ev, handlers);

      assert.strictEqual(handlerCalled, true, 'Handler must have executed');
      assert.deepStrictEqual(handledEventPayload, { greeting: 'Hello QCET' });
      assert.strictEqual(result.status, OutboxStatus.COMPLETED);
      assert.strictEqual(result.attempts, 1);

      // Inspect DB
      const updated = await prisma.outboxEvent.findUniqueOrThrow({
        where: { id: ev.id },
      });
      assert.strictEqual(updated.status, OutboxStatus.COMPLETED);
      assert.strictEqual(updated.attempts, 1);
      assert.ok(
        updated.processedAt instanceof Date,
        'processedAt must be set'
      );
      assert.strictEqual(updated.lastError, null);
    });

    test('routes event by aggregateType fallback when eventType has no exact match', async () => {
      let aggregateHandlerCalled = false;

      const ev = await publishOutboxEvent(prisma, {
        eventType: `UNKNOWN_EVENT_${testRunId}`,
        aggregateType: `CustomAggregate_${testRunId}`,
        aggregateId: `agg_${testRunId}`,
        payload: { test: true },
      });

      const handlers = {
        [`CustomAggregate_${testRunId}`]: async () => {
          aggregateHandlerCalled = true;
        },
      };

      const result = await processOutboxEvent(prisma, ev, handlers);

      assert.strictEqual(aggregateHandlerCalled, true);
      assert.strictEqual(result.status, OutboxStatus.COMPLETED);
    });

    test('routes to wildcard handler when neither eventType nor aggregateType matches', async () => {
      let wildcardCalled = false;

      const ev = await publishOutboxEvent(prisma, {
        eventType: `WILD_EVENT_${testRunId}`,
        aggregateType: 'WildAggregate',
        aggregateId: `wild_${testRunId}`,
        payload: {},
      });

      const handlers = {
        '*': async () => {
          wildcardCalled = true;
        },
      };

      const result = await processOutboxEvent(prisma, ev, handlers);
      assert.strictEqual(wildcardCalled, true);
      assert.strictEqual(result.status, OutboxStatus.COMPLETED);
    });

    test('transitions to PROCESSING during handler execution', async () => {
      let statusDuringExecution: OutboxStatus | null = null;

      const ev = await publishOutboxEvent(prisma, {
        eventType: `CHECK_PROCESSING_${testRunId}`,
        aggregateType: 'StatusCheck',
        aggregateId: `proc_${testRunId}`,
        payload: {},
      });

      const handlers = {
        [`CHECK_PROCESSING_${testRunId}`]: async (event: any) => {
          // Read from DB during handler execution
          const record = await prisma.outboxEvent.findUnique({
            where: { id: event.id },
          });
          statusDuringExecution = record?.status ?? null;
        },
      };

      await processOutboxEvent(prisma, ev, handlers, {
        markProcessing: true,
      });

      assert.strictEqual(
        statusDuringExecution,
        OutboxStatus.PROCESSING,
        'Event must be in PROCESSING status while handler is active'
      );
    });
  });

  // ==========================================================================
  // SUITE 5: Error Handling & Exponential Retry Backoff
  // ==========================================================================
  describe('5. Error Handling & Exponential Retry Backoff', () => {
    test('calculateExponentialBackoff computes delay correctly', () => {
      // 5s base, 2x exponential base:
      // Attempt 1 -> 5s (5 * 2^0)
      // Attempt 2 -> 10s (5 * 2^1)
      // Attempt 3 -> 20s (5 * 2^2)
      // Attempt 4 -> 40s (5 * 2^3)
      assert.strictEqual(calculateExponentialBackoff(1, 5, 2), 5);
      assert.strictEqual(calculateExponentialBackoff(2, 5, 2), 10);
      assert.strictEqual(calculateExponentialBackoff(3, 5, 2), 20);
      assert.strictEqual(calculateExponentialBackoff(4, 5, 2), 40);

      // Capped at maxBackoffSeconds
      assert.strictEqual(calculateExponentialBackoff(10, 5, 2, 60), 60);
    });

    test('retains PENDING status, increments attempts, logs lastError, and sets future availableAt on transient failure', async () => {
      const fixedNow = new Date('2026-09-09T10:00:00Z');

      const ev = await publishOutboxEvent(prisma, {
        eventType: `FAIL_RETRY_${testRunId}`,
        aggregateType: 'NetworkService',
        aggregateId: `fail_${testRunId}`,
        payload: {},
      });

      const handlers = {
        [`FAIL_RETRY_${testRunId}`]: async () => {
          throw new Error('VAPID_ENDPOINT_503_TEMPORARILY_UNAVAILABLE');
        },
      };

      const result = await processOutboxEvent(prisma, ev, handlers, {
        now: fixedNow,
        baseBackoffSeconds: 5,
        maxRetries: 3,
      });

      // Returns to PENDING for retry
      assert.strictEqual(result.status, OutboxStatus.PENDING);
      assert.strictEqual(result.attempts, 1);
      assert.strictEqual(
        result.error,
        'VAPID_ENDPOINT_503_TEMPORARILY_UNAVAILABLE'
      );

      // Verify in DB
      const updated = await prisma.outboxEvent.findUniqueOrThrow({
        where: { id: ev.id },
      });
      assert.strictEqual(updated.status, OutboxStatus.PENDING);
      assert.strictEqual(updated.attempts, 1);
      assert.strictEqual(
        updated.lastError,
        'VAPID_ENDPOINT_503_TEMPORARILY_UNAVAILABLE'
      );

      // Expected availableAt: 10:00:00Z + 5s = 10:00:05Z
      const expectedAvailableAt = new Date(
        fixedNow.getTime() + 5 * 1000
      ).toISOString();
      assert.strictEqual(
        updated.availableAt.toISOString(),
        expectedAvailableAt,
        'availableAt must be backed off exponentially by 5s on 1st failure'
      );
    });

    test('subsequent failure exponentially doubles backoff delay', async () => {
      const fixedNow = new Date('2026-09-09T10:00:00Z');

      // Create event with 1 prior attempt
      const ev = await prisma.outboxEvent.create({
        data: {
          eventType: `FAIL_RETRY_2_${testRunId}`,
          aggregateType: 'NetworkService',
          aggregateId: `fail_2_${testRunId}`,
          payload: {},
          status: OutboxStatus.PENDING,
          attempts: 1,
        },
      });

      const handlers = {
        [`FAIL_RETRY_2_${testRunId}`]: async () => {
          throw new Error('SMTP_GATEWAY_TIMEOUT');
        },
      };

      const result = await processOutboxEvent(prisma, ev, handlers, {
        now: fixedNow,
        baseBackoffSeconds: 5,
        maxRetries: 3,
      });

      assert.strictEqual(result.status, OutboxStatus.PENDING);
      assert.strictEqual(result.attempts, 2);

      const updated = await prisma.outboxEvent.findUniqueOrThrow({
        where: { id: ev.id },
      });
      assert.strictEqual(updated.attempts, 2);
      // Attempt 2 backoff: 5s * 2^1 = 10s -> 10:00:10Z
      const expectedAvailableAt = new Date(
        fixedNow.getTime() + 10 * 1000
      ).toISOString();
      assert.strictEqual(
        updated.availableAt.toISOString(),
        expectedAvailableAt,
        'availableAt must be backed off by 10s on 2nd failure'
      );
    });
  });

  // ==========================================================================
  // SUITE 6: Dead Letter Queue (maxRetries Exceeded)
  // ==========================================================================
  describe('6. Dead-Letter Queue & Terminal Failure', () => {
    test('transitions to FAILED when attempts reach maxRetries', async () => {
      const fixedNow = new Date('2026-09-09T12:00:00Z');

      // Event already failed twice (attempts: 2), with maxRetries: 3
      const ev = await prisma.outboxEvent.create({
        data: {
          eventType: `DEAD_LETTER_${testRunId}`,
          aggregateType: 'ExternalAPI',
          aggregateId: `dead_${testRunId}`,
          payload: {},
          status: OutboxStatus.PENDING,
          attempts: 2,
        },
      });

      let deadLetterCallbackFired = false;

      const handlers = {
        [`DEAD_LETTER_${testRunId}`]: async () => {
          throw new Error('AUTHENTICATION_CREDENTIAL_REVOKED_PERMANENTLY');
        },
      };

      const result = await processOutboxEvent(prisma, ev, handlers, {
        now: fixedNow,
        maxRetries: 3,
        onError: (_event, _err, isDeadLetter) => {
          if (isDeadLetter) deadLetterCallbackFired = true;
        },
      });

      assert.strictEqual(result.status, OutboxStatus.FAILED);
      assert.strictEqual(result.attempts, 3);
      assert.strictEqual(deadLetterCallbackFired, true);

      const updated = await prisma.outboxEvent.findUniqueOrThrow({
        where: { id: ev.id },
      });
      assert.strictEqual(
        updated.status,
        OutboxStatus.FAILED,
        'Event must be transitioned to FAILED status'
      );
      assert.strictEqual(updated.attempts, 3);
      assert.strictEqual(
        updated.lastError,
        'AUTHENTICATION_CREDENTIAL_REVOKED_PERMANENTLY'
      );
      assert.ok(
        updated.processedAt instanceof Date,
        'Terminal failure must record processedAt'
      );
    });

    test('fails immediately with descriptive error when no handler is registered', async () => {
      const ev = await publishOutboxEvent(prisma, {
        eventType: `UNREGISTERED_EVENT_${testRunId}`,
        aggregateType: `UnregisteredAggregate_${testRunId}`,
        aggregateId: `unreg_${testRunId}`,
        payload: {},
      });

      // Pass empty handlers object
      const result = await processOutboxEvent(prisma, ev, {}, { maxRetries: 1 });

      assert.strictEqual(result.status, OutboxStatus.FAILED);
      assert.ok(
        result.error?.includes('No outbox handler registered'),
        'Error must indicate missing handler registration'
      );
    });
  });

  // ==========================================================================
  // SUITE 7: Batch Processing & Operational Management
  // ==========================================================================
  describe('7. Batch Processing & Operational Utilities', () => {
    test('processOutboxBatch processes multiple events and returns structured summary', async () => {
      const tag = `batch_suite_${testRunId}`;

      // Create 3 events:
      // 1. Success event
      await publishOutboxEvent(prisma, {
        eventType: `BATCH_SUCCESS_${tag}`,
        aggregateType: tag,
        aggregateId: `item_1_${tag}`,
        payload: {},
      });

      // 2. Retryable failure event
      await publishOutboxEvent(prisma, {
        eventType: `BATCH_FAIL_RETRY_${tag}`,
        aggregateType: tag,
        aggregateId: `item_2_${tag}`,
        payload: {},
      });

      // 3. Dead letter failure event (already at 2 attempts, maxRetries: 3)
      await prisma.outboxEvent.create({
        data: {
          eventType: `BATCH_FAIL_DEAD_${tag}`,
          aggregateType: tag,
          aggregateId: `item_3_${tag}`,
          payload: {},
          status: OutboxStatus.PENDING,
          attempts: 2,
        },
      });

      const handlers = {
        [`BATCH_SUCCESS_${tag}`]: async () => {
          // Success
        },
        [`BATCH_FAIL_RETRY_${tag}`]: async () => {
          throw new Error('Temporary glitch');
        },
        [`BATCH_FAIL_DEAD_${tag}`]: async () => {
          throw new Error('Fatal error');
        },
      };

      const batchResult = await processOutboxBatch(prisma, handlers, {
        maxRetries: 3,
      });

      assert.ok(batchResult.totalProcessed >= 3);
      assert.ok(batchResult.succeeded >= 1);
      assert.ok(batchResult.retried >= 1);
      assert.ok(batchResult.deadLettered >= 1);
    });

    test('retryFailedOutboxEvents resets dead-lettered events to PENDING', async () => {
      const ev = await prisma.outboxEvent.create({
        data: {
          eventType: `RETRY_ADMIN_${testRunId}`,
          aggregateType: 'ManualRecovery',
          aggregateId: `recovery_${testRunId}`,
          payload: {},
          status: OutboxStatus.FAILED,
          attempts: 5,
          lastError: 'Fatal connection error',
        },
      });

      const res = await retryFailedOutboxEvents(prisma, {
        ids: [ev.id],
        resetAttempts: true,
      });

      assert.strictEqual(res.updatedCount, 1);

      const recovered = await prisma.outboxEvent.findUniqueOrThrow({
        where: { id: ev.id },
      });
      assert.strictEqual(recovered.status, OutboxStatus.PENDING);
      assert.strictEqual(recovered.attempts, 0);
      assert.strictEqual(recovered.lastError, null);
    });

    test('getOutboxMetrics reports counts accurately', async () => {
      const metrics = await getOutboxMetrics(prisma);

      assert.ok(typeof metrics.PENDING === 'number');
      assert.ok(typeof metrics.PROCESSING === 'number');
      assert.ok(typeof metrics.COMPLETED === 'number');
      assert.ok(typeof metrics.FAILED === 'number');
    });

    test('cleanupCompletedOutboxEvents deletes expired COMPLETED records', async () => {
      const oldProcessedAt = new Date();
      oldProcessedAt.setDate(oldProcessedAt.getDate() - 40);

      const ev = await prisma.outboxEvent.create({
        data: {
          eventType: `OLD_PURGE_${testRunId}`,
          aggregateType: 'Retention',
          aggregateId: `old_${testRunId}`,
          payload: {},
          status: OutboxStatus.COMPLETED,
          processedAt: oldProcessedAt,
        },
      });

      const res = await cleanupCompletedOutboxEvents(prisma, 30);
      assert.ok(res.deletedCount >= 1);

      const check = await prisma.outboxEvent.findUnique({
        where: { id: ev.id },
      });
      assert.strictEqual(check, null, 'Old completed event must be purged');
    });
  });
});
