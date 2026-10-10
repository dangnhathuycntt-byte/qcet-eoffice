/**
 * H-1 (spec task-document-gap-spec.md): outbox worker gửi thông báo nhiệm vụ.
 * Chạy trên qcet_test (scripts/run-tests.mjs chuyển DATABASE_URL). Chỉ xử lý sự
 * kiện do test tạo (lọc theo ids) và chỉ xóa bản ghi do test tạo.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { OutboxStatus, TaskActorRole } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { publishOutboxEvent, OutboxEventType, OutboxAggregateType } from '../src/lib/db/outbox';
import { runOutboxCycle } from '../src/server/outbox/outbox-worker';
import { STALE_EVENT_MAX_AGE_MS } from '../src/server/outbox/task-notification-handlers';

const runId = `h1_${Date.now()}`;
const ids = { creator: '', dri: '', collab: '', follower: '', reviewer: '', task: '' };

async function makeUser(key: string) {
  const user = await prisma.user.create({
    data: { email: `${runId}_${key}@cdktcnqn.edu.vn`, name: `${runId} ${key}` },
  });
  return user.id;
}

async function publish(eventType: string, payload: Record<string, unknown>, createdAt?: Date) {
  const ev = await publishOutboxEvent(prisma, {
    eventType,
    aggregateType: OutboxAggregateType.TASK,
    aggregateId: ids.task,
    payload: { taskId: ids.task, ...payload },
  });
  if (createdAt) {
    await prisma.outboxEvent.update({ where: { id: ev.id }, data: { createdAt } });
  }
  return ev.id;
}

async function noticesFor(userId: string) {
  return prisma.notification.findMany({ where: { userId, linkHref: { contains: ids.task } } });
}

describe('H-1 outbox worker: thông báo nhiệm vụ', () => {
  before(async () => {
    ids.creator = await makeUser('creator');
    ids.dri = await makeUser('dri');
    ids.collab = await makeUser('collab');
    ids.follower = await makeUser('follower');
    ids.reviewer = await makeUser('reviewer');
    const task = await prisma.task.create({
      data: {
        code: `${runId}`.slice(0, 50),
        title: 'Báo cáo tuyển sinh',
        academicMonth: 10,
        academicYear: '2026-2027',
        dueDate: new Date('2026-10-20T00:00:00+07:00'),
        createdById: ids.creator,
        actors: {
          create: [
            { userId: ids.dri, role: TaskActorRole.DRI, isPrimaryDRI: true },
            { userId: ids.collab, role: TaskActorRole.COLLABORATOR },
            { userId: ids.follower, role: TaskActorRole.FOLLOWER },
            { userId: ids.reviewer, role: TaskActorRole.REVIEWER },
          ],
        },
      },
    });
    ids.task = task.id;
  });

  after(async () => {
    const userIds = [ids.creator, ids.dri, ids.collab, ids.follower, ids.reviewer].filter(Boolean);
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: ids.task } });
    if (ids.task) await prisma.task.delete({ where: { id: ids.task } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  test('nhắc việc gửi đúng người nhận, bỏ người nhắc', async () => {
    const id = await publish(OutboxEventType.TASK_REMINDER_NOTIFICATION, {
      remindedById: ids.creator,
      recipientIds: [ids.dri, ids.creator],
      message: 'Nộp trước thứ Sáu',
    });
    const result = await runOutboxCycle(prisma, { ids: [id] });
    assert.equal(result.succeeded, 1);
    const toDri = await noticesFor(ids.dri);
    assert.equal(toDri.length, 1);
    assert.equal(toDri[0].type, 'reminder');
    assert.match(toDri[0].body, /Nộp trước thứ Sáu/);
    assert.equal((await noticesFor(ids.creator)).length, 0, 'người nhắc không tự nhận');
  });

  test('chạy lại không gửi trùng', async () => {
    const before = (await noticesFor(ids.dri)).length;
    const id = await publish(OutboxEventType.TASK_REMINDER_NOTIFICATION, {
      remindedById: ids.creator,
      recipientIds: [ids.dri],
    });
    await runOutboxCycle(prisma, { ids: [id] });
    await runOutboxCycle(prisma, { ids: [id] });
    assert.equal((await noticesFor(ids.dri)).length, before + 1);
  });

  test('nộp kết quả liên tiếp trong 5 phút chỉ báo người duyệt một lần (gộp thông báo)', async () => {
    const before = (await noticesFor(ids.reviewer)).filter((n) => n.type === 'deliverable_submitted').length;
    const first = await publish(OutboxEventType.DELIVERABLE_SUBMITTED_NOTIFICATION, { submittedById: ids.dri });
    await runOutboxCycle(prisma, { ids: [first] });
    const second = await publish(OutboxEventType.DELIVERABLE_SUBMITTED_NOTIFICATION, { submittedById: ids.dri });
    await runOutboxCycle(prisma, { ids: [second] });
    const after = (await noticesFor(ids.reviewer)).filter((n) => n.type === 'deliverable_submitted').length;
    assert.ok(after - before <= 1, 'lần gửi thứ hai trong cửa sổ 5 phút bị gộp');
  });

  test('nộp duyệt báo người duyệt được chỉ định, không báo người theo dõi', async () => {
    const id = await publish(OutboxEventType.DELIVERABLE_SUBMITTED_NOTIFICATION, { submittedById: ids.dri });
    await runOutboxCycle(prisma, { ids: [id] });
    const toReviewer = await noticesFor(ids.reviewer);
    assert.equal(toReviewer.filter((n) => n.type === 'deliverable_submitted').length, 1);
    assert.equal((await noticesFor(ids.follower)).length, 0);
  });

  test('yêu cầu chỉnh sửa báo người chủ trì và phối hợp, kèm lý do', async () => {
    const id = await publish(OutboxEventType.TASK_REJECTED_NOTIFICATION, {
      requestedById: ids.reviewer,
      reason: 'Bổ sung phụ lục 2',
    });
    await runOutboxCycle(prisma, { ids: [id] });
    for (const userId of [ids.dri, ids.collab]) {
      const n = (await noticesFor(userId)).filter((x) => x.type === 'deliverable_revision');
      assert.equal(n.length, 1);
      assert.match(n[0].body, /Bổ sung phụ lục 2/);
    }
    assert.equal((await noticesFor(ids.follower)).length, 0);
  });

  test('hủy nhiệm vụ báo người thực hiện; đổi trạng thái khác không báo', async () => {
    const start = await publish(OutboxEventType.TASK_STATUS_NOTIFICATION, { status: 'IN_PROGRESS', actorId: ids.dri });
    const cancel = await publish(OutboxEventType.TASK_STATUS_NOTIFICATION, {
      status: 'CANCELLED',
      actorId: ids.creator,
      reason: 'Không thuộc phạm vi',
    });
    const result = await runOutboxCycle(prisma, { ids: [start, cancel] });
    assert.equal(result.succeeded, 2);
    const cancelled = (await noticesFor(ids.collab)).filter((n) => n.type === 'cancelled');
    assert.equal(cancelled.length, 1);
  });

  test('sự kiện tồn đọng quá 24 giờ được đánh dấu xong mà không gửi', async () => {
    const old = new Date(Date.now() - STALE_EVENT_MAX_AGE_MS - 60_000);
    const before = (await noticesFor(ids.follower)).length;
    const id = await publish(
      OutboxEventType.TASK_REMINDER_NOTIFICATION,
      { remindedById: ids.creator, recipientIds: [ids.follower] },
      old
    );
    await runOutboxCycle(prisma, { ids: [id] });
    const ev = await prisma.outboxEvent.findUniqueOrThrow({ where: { id } });
    assert.equal(ev.status, OutboxStatus.COMPLETED);
    assert.equal((await noticesFor(ids.follower)).length, before);
  });

  test('sự kiện không có handler giữ nguyên PENDING', async () => {
    const id = await publish(OutboxEventType.DOCUMENT_PRESENTED_NOTIFICATION, {});
    await runOutboxCycle(prisma, { ids: [id] });
    const ev = await prisma.outboxEvent.findUniqueOrThrow({ where: { id } });
    assert.equal(ev.status, OutboxStatus.PENDING);
  });
});
