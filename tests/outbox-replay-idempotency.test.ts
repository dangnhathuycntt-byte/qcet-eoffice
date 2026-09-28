/**
 * Item 175 — Outbox Replay Idempotency & processed_at Lifecycle
 *
 * Gap addressed: existing 21/21 outbox-pattern tests prove publish/process/retry/DLQ
 * mechanics but none assert that a COMPLETED event is NOT replayed when processOutboxEvent
 * is called a second time.  This file adds a focused, DB-backed test suite against
 * qcet_test that exercises:
 *
 *  A. Replay guard  — second call on COMPLETED event: handler MUST NOT execute again
 *  B. Fetch filter  — fetchAvailableOutboxEvents MUST NOT surface COMPLETED events
 *  C. Retry backoff — after transient failure, availableAt MUST be in the future and
 *                     fetchAvailableOutboxEvents MUST NOT surface the event yet
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { OutboxStatus } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import {
  publishOutboxEvent,
  fetchAvailableOutboxEvents,
  processOutboxEvent,
  OutboxEventType,
  OutboxAggregateType,
} from '../src/lib/db/outbox';

describe('Item 175: Outbox Replay Idempotency & processed_at Lifecycle', () => {
  const runId = `replay_idem_${Date.now()}`;

  after(async () => {
    await prisma.outboxEvent.deleteMany({
      where: { aggregateId: { contains: runId } },
    });
  });

  // --------------------------------------------------------------------------
  // A. Replay guard
  // --------------------------------------------------------------------------
  describe('A. Replay guard: COMPLETED event must not be processed twice', () => {
    test('second processOutboxEvent call returns early without invoking handler', async () => {
      const aggregateId = `${runId}_replay`;
      const ev = await publishOutboxEvent(prisma, {
        eventType: OutboxEventType.PUSH_NOTIFICATION_DISPATCH,
        aggregateType: OutboxAggregateType.TASK,
        aggregateId,
        payload: { test: 'replay-guard' },
      });

      assert.strictEqual(ev.status, OutboxStatus.PENDING);

      let handlerCallCount = 0;
      const handlers = {
        [OutboxEventType.PUSH_NOTIFICATION_DISPATCH]: async () => {
          handlerCallCount++;
        },
      };

      // First processing — should succeed and mark COMPLETED
      const first = await processOutboxEvent(prisma, ev, handlers);
      assert.strictEqual(first.status, OutboxStatus.COMPLETED);
      assert.strictEqual(handlerCallCount, 1, 'Handler must run exactly once on first call');

      // Verify DB state after first processing
      const afterFirst = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: ev.id } });
      assert.strictEqual(afterFirst.status, OutboxStatus.COMPLETED);
      assert.ok(afterFirst.processedAt instanceof Date, 'processedAt must be set after first processing');

      // Second processing — event is no longer PENDING; atomic claim must fail
      const second = await processOutboxEvent(prisma, ev, handlers);
      // The implementation returns { status: PROCESSING, attempts: ev.attempts } when
      // updateMany matches 0 rows (event already claimed or completed).
      assert.notStrictEqual(second.status, OutboxStatus.COMPLETED, 'Second call must not re-complete the event');
      assert.strictEqual(
        handlerCallCount,
        1,
        'Handler must NOT be invoked on the second call — replay guard must fire'
      );

      // DB state must remain COMPLETED with same processedAt
      const afterSecond = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: ev.id } });
      assert.strictEqual(afterSecond.status, OutboxStatus.COMPLETED, 'DB status must stay COMPLETED');
      assert.deepStrictEqual(
        afterSecond.processedAt?.toISOString(),
        afterFirst.processedAt?.toISOString(),
        'processedAt must not change on replay attempt'
      );
    });
  });

  // --------------------------------------------------------------------------
  // B. Fetch filter — COMPLETED events must not appear in available event list
  // --------------------------------------------------------------------------
  describe('B. fetchAvailableOutboxEvents excludes COMPLETED events', () => {
    test('completed event does not appear in available fetch results', async () => {
      const aggregateId = `${runId}_fetch_filter`;
      const ev = await publishOutboxEvent(prisma, {
        eventType: OutboxEventType.PUSH_NOTIFICATION_DISPATCH,
        aggregateType: OutboxAggregateType.TASK,
        aggregateId,
        payload: { test: 'fetch-filter' },
      });

      // Confirm event is fetchable while PENDING
      const beforeProcess = await fetchAvailableOutboxEvents(prisma, {
        aggregateType: OutboxAggregateType.TASK,
        eventType: OutboxEventType.PUSH_NOTIFICATION_DISPATCH,
      });
      const found = beforeProcess.find((e) => e.id === ev.id);
      assert.ok(found, 'PENDING event must be returned by fetchAvailableOutboxEvents');

      // Process to COMPLETED
      await processOutboxEvent(prisma, ev, {
        [OutboxEventType.PUSH_NOTIFICATION_DISPATCH]: async () => {},
      });

      // Confirm COMPLETED event is NOT fetchable
      const afterProcess = await fetchAvailableOutboxEvents(prisma, {
        aggregateType: OutboxAggregateType.TASK,
        eventType: OutboxEventType.PUSH_NOTIFICATION_DISPATCH,
      });
      const reappears = afterProcess.find((e) => e.id === ev.id);
      assert.strictEqual(reappears, undefined, 'COMPLETED event must NOT be returned by fetchAvailableOutboxEvents');
    });
  });

  // --------------------------------------------------------------------------
  // C. Retry backoff — failed event's availableAt must be in the future
  // --------------------------------------------------------------------------
  describe('C. Retry backoff: transient failure defers availableAt', () => {
    test('after transient failure availableAt is in the future and event not fetchable yet', async () => {
      const aggregateId = `${runId}_retry_backoff`;
      const ev = await publishOutboxEvent(prisma, {
        eventType: OutboxEventType.TASK_STATUS_NOTIFICATION,
        aggregateType: OutboxAggregateType.TASK,
        aggregateId,
        payload: { test: 'retry-backoff' },
      });

      const beforeNow = new Date();

      // First call fails transiently (maxRetries=3, so attempts=1 keeps it PENDING)
      const res = await processOutboxEvent(
        prisma,
        ev,
        {
          [OutboxEventType.TASK_STATUS_NOTIFICATION]: async () => {
            throw new Error('Transient failure for backoff test');
          },
        },
        { maxRetries: 3, baseBackoffSeconds: 30 }
      );

      assert.strictEqual(res.status, OutboxStatus.PENDING, 'Status must remain PENDING after first transient failure');
      assert.strictEqual(res.attempts, 1);
      assert.ok(res.error?.includes('Transient failure for backoff test'));

      // DB must reflect deferred availableAt in the future
      const deferred = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: ev.id } });
      assert.strictEqual(deferred.status, OutboxStatus.PENDING);
      assert.strictEqual(deferred.attempts, 1);
      assert.ok(
        deferred.availableAt > beforeNow,
        `availableAt (${deferred.availableAt.toISOString()}) must be AFTER the time of failure (${beforeNow.toISOString()})`
      );

      // fetchAvailableOutboxEvents must NOT return the deferred event (availableAt is in the future)
      const available = await fetchAvailableOutboxEvents(prisma, {
        aggregateType: OutboxAggregateType.TASK,
        eventType: OutboxEventType.TASK_STATUS_NOTIFICATION,
      });
      const appearsNow = available.find((e) => e.id === ev.id);
      assert.strictEqual(
        appearsNow,
        undefined,
        'Deferred event with future availableAt must NOT be returned by fetchAvailableOutboxEvents'
      );
    });
  });
});
