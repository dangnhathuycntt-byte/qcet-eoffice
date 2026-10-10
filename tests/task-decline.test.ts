/**
 * T-02 (spec task-document-gap-spec.md): từ chối nhận việc.
 * Chạy trên qcet_test và chỉ xóa bản ghi do test tạo.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { TaskActorRole, TaskStatus } from '@prisma/client';
import { ZodError } from 'zod';
import { prisma } from '../src/lib/prisma';
import { declineTask, getDeclineState } from '../src/server/tasks/task-decline-service';
import { setTaskDRI } from '../src/lib/services/task-actor-service';
import { runOutboxCycle } from '../src/server/outbox/outbox-worker';
import { ApiError, ConflictError, InvalidTransitionError, PreconditionFailedError } from '../src/server/api/errors';

const runId = `t02_${Date.now()}`;
const u: Record<string, string> = {};
let taskId = '';

const session = (key: string) => ({ id: u[key], email: `${key}@x`, name: key, role: 'CHUYEN_VIEN' });
const task = () => prisma.task.findUniqueOrThrow({ where: { id: taskId } });
const forbidden = (err: unknown) => err instanceof ApiError && err.statusCode === 403;

describe('T-02 từ chối nhận việc', () => {
  before(async () => {
    for (const key of ['creator', 'dri', 'newdri', 'collab', 'stranger']) {
      const user = await prisma.user.create({
        data: { email: `${runId}_${key}@cdktcnqn.edu.vn`, name: `${runId} ${key}` },
      });
      u[key] = user.id;
    }
    const t = await prisma.task.create({
      data: {
        code: runId.slice(0, 50),
        title: 'Nhiệm vụ T-02',
        academicMonth: 10,
        academicYear: '2026-2027',
        dueDate: new Date('2026-10-30T00:00:00+07:00'),
        createdById: u.creator,
        status: TaskStatus.NOT_STARTED,
        actors: {
          create: [
            { userId: u.dri, role: TaskActorRole.DRI, isPrimaryDRI: true, appointedAt: new Date(Date.now() - 60_000) },
            { userId: u.collab, role: TaskActorRole.COLLABORATOR },
          ],
        },
      },
    });
    taskId = t.id;
  });

  after(async () => {
    const ids = Object.values(u);
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: taskId } });
    await prisma.auditEvent.deleteMany({ where: { entityId: taskId } });
    if (taskId) await prisma.task.delete({ where: { id: taskId } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  test('người phối hợp, người giao và người ngoài không từ chối được', async () => {
    for (const key of ['collab', 'creator', 'stranger']) {
      await assert.rejects(
        declineTask(session(key), taskId, { reason: 'Không muốn nhận', expectedVersion: (await task()).version }),
        forbidden
      );
    }
    const state = await getDeclineState(session('dri'), taskId);
    assert.equal(state.canDecline, true);
    assert.equal(state.declined, null);
  });

  test('lý do tối thiểu 3 ký tự; lệch version trả 412', async () => {
    await assert.rejects(declineTask(session('dri'), taskId, { reason: 'ừ', expectedVersion: (await task()).version }), ZodError);
    await assert.rejects(
      declineTask(session('dri'), taskId, { reason: 'Đang quá tải', expectedVersion: (await task()).version - 1 }),
      PreconditionFailedError
    );
  });

  test('chủ trì từ chối: giữ người chủ trì và trạng thái, ghi audit, báo người giao (AC-T02-2)', async () => {
    const before = await task();
    const res = await declineTask(session('dri'), taskId, { reason: 'Đang quá tải', expectedVersion: before.version });
    assert.equal(res.version, before.version + 1);

    const after = await task();
    assert.equal(after.status, TaskStatus.NOT_STARTED);
    const dri = await prisma.taskActor.findFirstOrThrow({ where: { taskId, isPrimaryDRI: true } });
    assert.equal(dri.userId, u.dri, 'người chủ trì không đổi');
    assert.ok(await prisma.auditEvent.findFirst({ where: { entityId: taskId, action: 'TASK_DECLINED' } }));

    const ev = await prisma.outboxEvent.findFirstOrThrow({ where: { aggregateId: taskId, eventType: 'TASK_DECLINED_NOTIFICATION' } });
    await runOutboxCycle(prisma, { ids: [ev.id] });
    const notices = await prisma.notification.findMany({ where: { userId: u.creator, type: 'declined' } });
    assert.equal(notices.length, 1);
    assert.match(notices[0].body, /Đang quá tải/);
    assert.equal(await prisma.notification.count({ where: { userId: u.dri } }), 0);
  });

  test('mọi người thấy thông báo từ chối còn hiệu lực; không từ chối lần hai', async () => {
    const state = await getDeclineState(session('collab'), taskId);
    assert.equal(state.declined?.by.id, u.dri);
    assert.equal(state.declined?.reason, 'Đang quá tải');
    assert.equal((await getDeclineState(session('dri'), taskId)).canDecline, false);
    await assert.rejects(
      declineTask(session('dri'), taskId, { reason: 'Từ chối lần nữa', expectedVersion: (await task()).version }),
      (err: unknown) => err instanceof ConflictError && err.code === 'TASK_ALREADY_DECLINED'
    );
  });

  test('người giao giao lại thì thông báo từ chối hết hiệu lực', async () => {
    // Người giao (người tạo) giao lại cho người khác qua dịch vụ đổi người chủ trì.
    await setTaskDRI(taskId, u.newdri, { requestedById: u.creator });
    const state = await getDeclineState(session('creator'), taskId);
    assert.equal(state.declined, null);
    // Người chủ trì mới từ chối được; người cũ (nay là phối hợp) thì không.
    assert.equal((await getDeclineState(session('newdri'), taskId)).canDecline, true);
    await assert.rejects(
      declineTask(session('dri'), taskId, { reason: 'Không còn là chủ trì', expectedVersion: (await task()).version }),
      forbidden
    );
  });

  test('chỉ từ chối được khi chưa bắt đầu (AC-T02-1)', async () => {
    await prisma.task.update({ where: { id: taskId }, data: { status: TaskStatus.IN_PROGRESS } });
    try {
      await assert.rejects(
        declineTask(session('newdri'), taskId, { reason: 'Đã bắt đầu rồi', expectedVersion: (await task()).version }),
        InvalidTransitionError
      );
      assert.equal((await getDeclineState(session('newdri'), taskId)).canDecline, false);
    } finally {
      await prisma.task.update({ where: { id: taskId }, data: { status: TaskStatus.NOT_STARTED } });
    }
  });
});
