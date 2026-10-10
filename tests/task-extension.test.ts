/**
 * T-01 (spec task-document-gap-spec.md): xin gia hạn nhiệm vụ.
 * Chạy trên qcet_test và chỉ xóa bản ghi do test tạo.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { TaskActorRole, TaskStatus } from '@prisma/client';
import { ZodError } from 'zod';
import { prisma } from '../src/lib/prisma';
import { decideExtension, getTaskExtensions, requestExtension } from '../src/server/tasks/task-extension-service';
import { taskCommandService } from '../src/server/tasks/task-command-service';
import { runOutboxCycle } from '../src/server/outbox/outbox-worker';
import {
  ApiError,
  ConflictError,
  InvalidTransitionError,
  PreconditionFailedError,
  ValidationError,
} from '../src/server/api/errors';

const runId = `t01_${Date.now()}`;
const u: Record<string, string> = {};
let taskId = '';
let subTaskId = '';

const D = (iso: string) => new Date(`${iso}T00:00:00+07:00`);
const session = (key: string) => ({ id: u[key], email: `${key}@x`, name: key, role: 'CHUYEN_VIEN' });
const task = () => prisma.task.findUniqueOrThrow({ where: { id: taskId } });
const forbidden = (err: unknown) => err instanceof ApiError && err.statusCode === 403;
const setStatus = (status: TaskStatus) => prisma.task.update({ where: { id: taskId }, data: { status } });

async function request(day: string, reason = 'Cần thêm thời gian thu thập số liệu') {
  const t = await task();
  return requestExtension(session('dri'), taskId, { requestedDueDate: day, reason, expectedVersion: t.version });
}

async function decide(
  key: string,
  requestId: string,
  decision: 'APPROVE' | 'REJECT' | 'COUNTER' | 'ACCEPT' | 'DECLINE',
  extra: { newDueDate?: string; note?: string } = {}
) {
  const t = await task();
  return decideExtension(session(key), taskId, { requestId, decision, expectedVersion: t.version, ...extra });
}

describe('T-01 xin gia hạn nhiệm vụ', () => {
  before(async () => {
    for (const key of ['creator', 'dri', 'collab', 'stranger']) {
      const user = await prisma.user.create({
        data: { email: `${runId}_${key}@cdktcnqn.edu.vn`, name: `${runId} ${key}` },
      });
      u[key] = user.id;
    }
    const base = {
      academicMonth: 10,
      academicYear: '2026-2027',
      createdById: u.creator,
      status: TaskStatus.IN_PROGRESS,
    };
    const parent = await prisma.task.create({
      data: {
        ...base,
        code: runId.slice(0, 50),
        title: 'Nhiệm vụ T-01',
        dueDate: D('2026-10-20'),
        actors: {
          create: [
            { userId: u.dri, role: TaskActorRole.DRI, isPrimaryDRI: true },
            { userId: u.collab, role: TaskActorRole.COLLABORATOR },
          ],
        },
      },
    });
    taskId = parent.id;
    const sub = await prisma.task.create({
      data: {
        ...base,
        code: `${runId}_s`.slice(0, 50),
        title: 'Việc con T-01',
        dueDate: D('2026-10-18'),
        parentTaskId: taskId,
        actors: { create: [{ userId: u.dri, role: TaskActorRole.DRI, isPrimaryDRI: true }] },
      },
    });
    subTaskId = sub.id;
  });

  after(async () => {
    const ids = Object.values(u);
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: [taskId, subTaskId] } } });
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: [taskId, subTaskId] } } });
    if (subTaskId) await prisma.task.delete({ where: { id: subTaskId } });
    if (taskId) await prisma.task.delete({ where: { id: taskId } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  test('chủ trì xin gia hạn: tạo PENDING, giữ nguyên hạn, tăng version, ghi audit và outbox (AC-T01-1)', async () => {
    const before = await task();
    const res = await request('2026-10-27');
    assert.equal(res.status, 'PENDING');
    assert.equal(res.version, before.version + 1);
    const after = await task();
    assert.equal(after.dueDate.getTime(), before.dueDate.getTime(), 'hạn không đổi khi chưa được đồng ý');
    assert.ok(await prisma.auditEvent.findFirst({ where: { entityId: taskId, action: 'TASK_EXTENSION_REQUESTED' } }));
    const ev = await prisma.outboxEvent.findFirstOrThrow({
      where: { aggregateId: taskId, eventType: 'TASK_EXTENSION_REQUESTED_NOTIFICATION' },
    });
    await runOutboxCycle(prisma, { ids: [ev.id] });
    const notices = await prisma.notification.findMany({ where: { userId: u.creator, type: 'extension_requested' } });
    assert.equal(notices.length, 1, 'người giao được báo');
    assert.equal(await prisma.notification.count({ where: { userId: u.dri } }), 0, 'người xin không tự nhận');
  });

  test('xin lần hai khi đang có yêu cầu mở trả 409 (AC-T01-2)', async () => {
    await assert.rejects(
      request('2026-10-28'),
      (err: unknown) => err instanceof ConflictError && err.code === 'EXTENSION_ALREADY_OPEN' && err.statusCode === 409
    );
  });

  test('người phối hợp, người giao và người ngoài không xin gia hạn được', async () => {
    for (const key of ['collab', 'creator', 'stranger']) {
      await assert.rejects(
        requestExtension(session(key), taskId, {
          requestedDueDate: '2026-11-01',
          reason: 'Thử xin hộ',
          expectedVersion: (await task()).version,
        }),
        forbidden
      );
    }
  });

  test('người xin và người ngoài không quyết định được (SoD)', async () => {
    const open = await prisma.taskExtensionRequest.findFirstOrThrow({ where: { taskId, status: 'PENDING' } });
    for (const key of ['dri', 'collab', 'stranger']) {
      await assert.rejects(decide(key, open.id, 'APPROVE'), forbidden);
    }
    assert.equal((await task()).dueDate.getTime(), D('2026-10-20').getTime());
  });

  test('từ chối cần lý do và giữ nguyên hạn', async () => {
    const open = await prisma.taskExtensionRequest.findFirstOrThrow({ where: { taskId, status: 'PENDING' } });
    await assert.rejects(decide('creator', open.id, 'REJECT', { note: 'ừ' }), ValidationError);
    const res = await decide('creator', open.id, 'REJECT', { note: 'Không đủ lý do' });
    assert.equal(res.status, 'REJECTED');
    assert.equal((await task()).dueDate.getTime(), D('2026-10-20').getTime());

    await assert.rejects(decide('creator', open.id, 'APPROVE'), ConflictError, 'đã xử lý thì không quyết định lại');
    const ev = await prisma.outboxEvent.findFirstOrThrow({
      where: { aggregateId: taskId, eventType: 'TASK_EXTENSION_DECIDED_NOTIFICATION' },
      orderBy: { createdAt: 'desc' },
    });
    await runOutboxCycle(prisma, { ids: [ev.id] });
    const n = await prisma.notification.findMany({ where: { userId: u.dri, type: 'extension_decided' } });
    assert.equal(n.length, 1);
    assert.match(n[0].body, /Từ chối gia hạn: Không đủ lý do/);
  });

  test('kiểm tra hạn mới: phải sau hạn cũ, việc con không muộn hơn hạn cha, lý do tối thiểu', async () => {
    await assert.rejects(request('2026-10-20'), ValidationError);
    await assert.rejects(request('2026-10-10'), ValidationError);
    await assert.rejects(request('khong-phai-ngay'), ValidationError);
    await assert.rejects(request('2026-10-27', 'ừ'), ZodError);

    const sub = await prisma.task.findUniqueOrThrow({ where: { id: subTaskId } });
    await assert.rejects(
      requestExtension(session('dri'), subTaskId, {
        requestedDueDate: '2026-10-25', // muộn hơn hạn cha 20/10
        reason: 'Cần thêm thời gian',
        expectedVersion: sub.version,
      }),
      (err: unknown) => err instanceof ValidationError && /nhiệm vụ cha/.test(err.message)
    );
    const ok = await requestExtension(session('dri'), subTaskId, {
      requestedDueDate: '2026-10-19',
      reason: 'Cần thêm một ngày',
      expectedVersion: sub.version,
    });
    assert.equal(ok.status, 'PENDING');
  });

  test('lệch version trả 412', async () => {
    await assert.rejects(
      requestExtension(session('dri'), taskId, {
        requestedDueDate: '2026-10-27',
        reason: 'Cần thêm thời gian',
        expectedVersion: (await task()).version - 1,
      }),
      PreconditionFailedError
    );
  });

  test('không xin gia hạn khi đang chờ duyệt (Q2) hoặc đã hoàn thành (AC-T01-5)', async () => {
    for (const status of [TaskStatus.WAITING_APPROVAL, TaskStatus.CANCELLED]) {
      await setStatus(status);
      try {
        await assert.rejects(request('2026-10-27'), InvalidTransitionError);
      } finally {
        await setStatus(TaskStatus.IN_PROGRESS);
      }
    }
  });

  test('người giao đồng ý: đổi hạn, tăng version, ghi audit đổi hạn (AC-T01-3)', async () => {
    const created = await request('2026-10-27');
    const before = await task();
    const res = await decide('creator', created.id, 'APPROVE', { note: 'Đồng ý' });
    assert.equal(res.status, 'APPROVED');
    const after = await task();
    assert.equal(after.dueDate.getTime(), D('2026-10-27').getTime());
    assert.equal(after.version, before.version + 1);
    assert.ok(await prisma.auditEvent.findFirst({ where: { entityId: taskId, action: 'TASK_DEADLINE_CHANGED' } }));
  });

  test('đề xuất hạn khác: người xin nhận thì đổi hạn; người khác không trả lời được', async () => {
    const created = await request('2026-11-10');
    await assert.rejects(decide('creator', created.id, 'COUNTER', { newDueDate: '2026-11-10' }), ValidationError, 'trùng hạn đã xin');
    await assert.rejects(decide('creator', created.id, 'COUNTER', { newDueDate: '2026-10-01' }), ValidationError, 'không sau hạn hiện tại');
    const countered = await decide('creator', created.id, 'COUNTER', { newDueDate: '2026-11-03', note: 'Chỉ cho đến 3/11' });
    assert.equal(countered.status, 'COUNTERED');
    assert.equal((await task()).dueDate.getTime(), D('2026-10-27').getTime(), 'chưa đổi hạn khi chưa được nhận');

    await assert.rejects(decide('creator', created.id, 'ACCEPT'), forbidden);
    await assert.rejects(decide('collab', created.id, 'ACCEPT'), forbidden);
    const accepted = await decide('dri', created.id, 'ACCEPT');
    assert.equal(accepted.status, 'ACCEPTED');
    assert.equal((await task()).dueDate.getTime(), D('2026-11-03').getTime());
  });

  test('không nhận hạn đề xuất thì giữ hạn cũ', async () => {
    const created = await request('2026-11-20');
    await decide('creator', created.id, 'COUNTER', { newDueDate: '2026-11-05' });
    const res = await decide('dri', created.id, 'DECLINE');
    assert.equal(res.status, 'DECLINED');
    assert.equal((await task()).dueDate.getTime(), D('2026-11-03').getTime());
  });

  test('từ lần gia hạn thứ ba ghi nhãn gia hạn nhiều lần', async () => {
    assert.equal(await prisma.auditEvent.count({ where: { entityId: taskId, action: 'TASK_EXTENSION_REPEATED' } }), 0);
    const created = await request('2026-11-12');
    await decide('creator', created.id, 'APPROVE');
    const applied = await prisma.taskExtensionRequest.count({ where: { taskId, status: { in: ['APPROVED', 'ACCEPTED'] } } });
    assert.equal(applied, 3);
    assert.equal(await prisma.auditEvent.count({ where: { entityId: taskId, action: 'TASK_EXTENSION_REPEATED' } }), 1);
  });

  test('quyền của người xem trả về đúng cho từng vai trò', async () => {
    const created = await request('2026-11-25');
    const asDri = await getTaskExtensions(session('dri'), taskId);
    assert.equal(asDri.active?.id, created.id);
    assert.equal(asDri.canRequest, false, 'đang có yêu cầu mở');
    assert.equal(asDri.canDecide, false);
    assert.equal(asDri.canChangeDeadlineDirectly, false);
    assert.equal(asDri.appliedCount, 3);

    const asCreator = await getTaskExtensions(session('creator'), taskId);
    assert.equal(asCreator.canDecide, true);
    assert.equal(asCreator.canChangeDeadlineDirectly, true);

    const asCollab = await getTaskExtensions(session('collab'), taskId);
    assert.equal(asCollab.canDecide, false);
    assert.equal(asCollab.canRequest, false);
    await decide('creator', created.id, 'REJECT', { note: 'Dừng ở đây' });
    assert.equal((await getTaskExtensions(session('dri'), taskId)).canRequest, true);
  });

  test('đổi hạn trực tiếp qua cập nhật nhiệm vụ: người thực hiện bị chặn, người giao được', async () => {
    const t = await task();
    const user = (key: string) => ({ user: { id: u[key], email: `${key}@x`, name: key, role: 'CHUYEN_VIEN' } });
    await assert.rejects(
      taskCommandService.updateTask(user('dri') as never, taskId, { dueDate: '2027-01-01', expectedVersion: t.version } as never),
      (err: unknown) => err instanceof ApiError && err.code === 'DEADLINE_CHANGE_REQUIRES_ASSIGNER' && err.statusCode === 403
    );
    assert.equal((await task()).dueDate.getTime(), t.dueDate.getTime());

    await taskCommandService.updateTask(user('creator') as never, taskId, { dueDate: '2026-12-01', expectedVersion: t.version } as never);
    assert.equal((await task()).dueDate.getUTCFullYear(), 2026);
    assert.notEqual((await task()).dueDate.getTime(), t.dueDate.getTime());
  });

  test('người thực hiện vẫn sửa được thông tin khác khi không đổi hạn', async () => {
    const t = await task();
    const user = { user: { id: u.dri, email: 'dri@x', name: 'dri', role: 'CHUYEN_VIEN' } };
    await taskCommandService.updateTask(user as never, taskId, {
      title: 'Nhiệm vụ T-01 (đã sửa tiêu đề)',
      dueDate: t.dueDate.toISOString(),
      expectedVersion: t.version,
    } as never);
    assert.equal((await task()).title, 'Nhiệm vụ T-01 (đã sửa tiêu đề)');
  });
});
