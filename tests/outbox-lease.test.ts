import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { OutboxStatus } from '@prisma/client';
import { prisma } from '@qcet/db/prisma';
import { processOutboxEvent, publishOutboxEvent, recoverExpiredOutboxLeases } from '@qcet/db/outbox';

// Lease của outbox (locked_at): nhận sự kiện ghi lockedAt, kết thúc xóa; sự kiện kẹt quá hạn được trả về PENDING.
describe('outbox lease (locked_at)', () => {
  const runId = `lease_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const NOW = new Date('2026-10-19T03:00:00.000Z');
  const LEASE_MS = 10 * 60_000;
  const minutesBefore = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

  after(async () => {
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { startsWith: runId } } });
  });

  async function processingEvent(name: string, data: { lockedAt: Date | null; availableAt: Date; attempts?: number }) {
    const event = await publishOutboxEvent(prisma, {
      eventType: `LEASE_TEST_${runId}`,
      aggregateType: 'LeaseTest',
      aggregateId: `${runId}_${name}`,
      payload: { name },
      availableAt: data.availableAt,
    });
    return prisma.outboxEvent.update({
      where: { id: event.id },
      data: { status: OutboxStatus.PROCESSING, lockedAt: data.lockedAt, attempts: data.attempts ?? 0 },
    });
  }

  test('nhận sự kiện ghi lockedAt; hoàn tất xóa lockedAt', async () => {
    const event = await publishOutboxEvent(prisma, {
      eventType: `LEASE_TEST_${runId}`,
      aggregateType: 'LeaseTest',
      aggregateId: `${runId}_ok`,
      payload: {},
      availableAt: minutesBefore(1),
    });
    let duringHandler: { status: OutboxStatus; lockedAt: Date | null } | null = null;
    const result = await processOutboxEvent(prisma, event, async () => {
      duringHandler = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: event.id }, select: { status: true, lockedAt: true } });
    }, { now: NOW });

    assert.equal(result.status, OutboxStatus.COMPLETED);
    assert.deepEqual(duringHandler, { status: OutboxStatus.PROCESSING, lockedAt: NOW });
    const stored = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    assert.equal(stored.lockedAt, null);
  });

  test('lỗi còn lượt thử (lùi lịch) và dead letter đều xóa lockedAt', async () => {
    const retry = await publishOutboxEvent(prisma, { eventType: `LEASE_TEST_${runId}`, aggregateType: 'LeaseTest', aggregateId: `${runId}_retry`, payload: {}, availableAt: minutesBefore(1) });
    await processOutboxEvent(prisma, retry, () => { throw new Error('tạm thời'); }, { now: NOW, maxRetries: 3 });
    const retried = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: retry.id } });
    assert.equal(retried.status, OutboxStatus.PENDING);
    assert.equal(retried.lockedAt, null);

    const dead = await publishOutboxEvent(prisma, { eventType: `LEASE_TEST_${runId}`, aggregateType: 'LeaseTest', aggregateId: `${runId}_dead`, payload: {}, availableAt: minutesBefore(1) });
    await processOutboxEvent(prisma, dead, () => { throw new Error('hỏng'); }, { now: NOW, maxRetries: 1 });
    const failed = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: dead.id } });
    assert.equal(failed.status, OutboxStatus.FAILED);
    assert.equal(failed.lockedAt, null);
  });

  test('PROCESSING quá hạn lease trở lại PENDING, tính một lần thử; lease còn hạn giữ nguyên', async () => {
    const expired = await processingEvent('expired', { lockedAt: minutesBefore(11), availableAt: minutesBefore(12), attempts: 1 });
    const fresh = await processingEvent('fresh', { lockedAt: minutesBefore(2), availableAt: minutesBefore(30) });

    const result = await recoverExpiredOutboxLeases(prisma, { leaseMs: LEASE_MS, maxRetries: 5, now: NOW, ids: [expired.id, fresh.id] });

    assert.deepEqual(result, { requeued: 1, deadLettered: 0 });
    const requeued = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: expired.id } });
    assert.equal(requeued.status, OutboxStatus.PENDING);
    assert.equal(requeued.attempts, 2);
    assert.equal(requeued.lockedAt, null);
    assert.equal(requeued.availableAt.getTime(), NOW.getTime());
    assert.match(requeued.lastError ?? '', /Lease hết hạn/);
    const untouched = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: fresh.id } });
    assert.equal(untouched.status, OutboxStatus.PROCESSING);
    assert.equal(untouched.lockedAt?.getTime(), minutesBefore(2).getTime());
  });

  test('PROCESSING không có lockedAt (bản trước khi có lease) chỉ thu hồi khi availableAt đã cũ hơn hạn lease', async () => {
    const legacyOld = await processingEvent('legacy_old', { lockedAt: null, availableAt: minutesBefore(60) });
    const legacyNew = await processingEvent('legacy_new', { lockedAt: null, availableAt: minutesBefore(1) });

    const result = await recoverExpiredOutboxLeases(prisma, { leaseMs: LEASE_MS, maxRetries: 5, now: NOW, ids: [legacyOld.id, legacyNew.id] });

    assert.deepEqual(result, { requeued: 1, deadLettered: 0 });
    assert.equal((await prisma.outboxEvent.findUniqueOrThrow({ where: { id: legacyOld.id } })).status, OutboxStatus.PENDING);
    assert.equal((await prisma.outboxEvent.findUniqueOrThrow({ where: { id: legacyNew.id } })).status, OutboxStatus.PROCESSING);
  });

  test('lần thu hồi chạm giới hạn thử thì FAILED (không lặp mãi khi handler làm sập tiến trình)', async () => {
    const poison = await processingEvent('poison', { lockedAt: minutesBefore(20), availableAt: minutesBefore(25), attempts: 4 });

    const result = await recoverExpiredOutboxLeases(prisma, { leaseMs: LEASE_MS, maxRetries: 5, now: NOW, ids: [poison.id] });

    assert.deepEqual(result, { requeued: 0, deadLettered: 1 });
    const failed = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: poison.id } });
    assert.equal(failed.status, OutboxStatus.FAILED);
    assert.equal(failed.attempts, 5);
    assert.equal(failed.processedAt?.getTime(), NOW.getTime());
    assert.equal(failed.lockedAt, null);
  });

  test('chỉ xét các id được truyền', async () => {
    const listed = await processingEvent('listed', { lockedAt: minutesBefore(30), availableAt: minutesBefore(31) });
    const other = await processingEvent('other', { lockedAt: minutesBefore(30), availableAt: minutesBefore(31) });

    await recoverExpiredOutboxLeases(prisma, { leaseMs: LEASE_MS, maxRetries: 5, now: NOW, ids: [listed.id] });

    assert.equal((await prisma.outboxEvent.findUniqueOrThrow({ where: { id: listed.id } })).status, OutboxStatus.PENDING);
    assert.equal((await prisma.outboxEvent.findUniqueOrThrow({ where: { id: other.id } })).status, OutboxStatus.PROCESSING);
  });

  test('danh sách id rỗng không thu hồi gì (không hiểu thành mọi sự kiện)', async () => {
    const stuck = await processingEvent('empty_ids', { lockedAt: minutesBefore(30), availableAt: minutesBefore(31) });

    const result = await recoverExpiredOutboxLeases(prisma, { leaseMs: LEASE_MS, maxRetries: 5, now: NOW, ids: [] });

    assert.deepEqual(result, { requeued: 0, deadLettered: 0 });
    assert.equal((await prisma.outboxEvent.findUniqueOrThrow({ where: { id: stuck.id } })).status, OutboxStatus.PROCESSING);
  });
});
