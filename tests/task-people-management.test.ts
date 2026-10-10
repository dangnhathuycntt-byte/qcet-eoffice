/**
 * T-07 (spec task-document-gap-spec.md): thêm, bớt người phối hợp và người theo dõi.
 * Chạy trên qcet_test và chỉ xóa bản ghi do test tạo.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { TaskActorRole, TaskStatus } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { taskDomainActionService } from '../src/lib/services/task-domain-actions';
import { ApiError, NotFoundError, PreconditionFailedError, ValidationError, InvalidTransitionError } from '../src/server/api/errors';

const runId = `t07_${Date.now()}`;
const u: Record<string, string> = {};
let taskId = '';

const session = (key: string) => ({ id: u[key], email: `${key}@x`, name: key, role: 'CHUYEN_VIEN' });
const version = async () => (await prisma.task.findUniqueOrThrow({ where: { id: taskId } })).version;
const rolesOf = async (key: string) =>
  (await prisma.taskActor.findMany({ where: { taskId, userId: u[key] } })).map((a) => a.role);

describe('T-07 người phối hợp và người theo dõi qua API', () => {
  before(async () => {
    for (const key of ['creator', 'dri', 'collab', 'reviewer', 'stranger', 'newbie', 'inactive']) {
      const user = await prisma.user.create({
        data: { email: `${runId}_${key}@cdktcnqn.edu.vn`, name: `${runId} ${key}`, isActive: key !== 'inactive' },
      });
      u[key] = user.id;
    }
    const task = await prisma.task.create({
      data: {
        code: runId.slice(0, 50),
        title: 'Nhiệm vụ T-07',
        academicMonth: 10,
        academicYear: '2026-2027',
        dueDate: new Date('2026-10-30T00:00:00+07:00'),
        createdById: u.creator,
        status: TaskStatus.IN_PROGRESS,
        actors: {
          create: [
            { userId: u.dri, role: TaskActorRole.DRI, isPrimaryDRI: true },
            { userId: u.collab, role: TaskActorRole.COLLABORATOR },
            { userId: u.reviewer, role: TaskActorRole.REVIEWER },
          ],
        },
      },
    });
    taskId = task.id;
  });

  after(async () => {
    const ids = Object.values(u);
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: taskId } });
    await prisma.auditEvent.deleteMany({ where: { entityId: taskId } });
    if (taskId) await prisma.task.delete({ where: { id: taskId } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  test('người giao thêm người phối hợp: tạo actor, tăng version, ghi audit và outbox', async () => {
    const v = await version();
    const res = await taskDomainActionService.addPerson(session('creator'), taskId, {
      userId: u.newbie,
      role: 'COLLABORATOR',
      expectedVersion: v,
    });
    assert.equal(res.changed, true);
    assert.equal(res.version, v + 1);
    assert.deepEqual(await rolesOf('newbie'), [TaskActorRole.COLLABORATOR]);
    assert.equal(await version(), v + 1);

    const audit = await prisma.auditEvent.findFirst({ where: { entityId: taskId, action: 'TASK_PERSON_ADDED' } });
    assert.ok(audit);
    const outbox = await prisma.outboxEvent.findFirst({
      where: { aggregateId: taskId, eventType: 'TASK_ASSIGNED_NOTIFICATION' },
    });
    assert.ok(outbox);
    assert.equal((outbox.payload as Record<string, unknown>).newAssigneeId, u.newbie);
  });

  test('thêm lại cùng vai trò không đổi gì và không tăng version', async () => {
    const v = await version();
    const res = await taskDomainActionService.addPerson(session('creator'), taskId, {
      userId: u.newbie,
      role: 'COLLABORATOR',
      expectedVersion: v,
    });
    assert.equal(res.changed, false);
    assert.equal(await version(), v);
  });

  test('đổi người phối hợp thành người theo dõi: giữ một actor, không thông báo', async () => {
    const before = await prisma.outboxEvent.count({ where: { aggregateId: taskId } });
    await taskDomainActionService.addPerson(session('creator'), taskId, {
      userId: u.newbie,
      role: 'FOLLOWER',
      expectedVersion: await version(),
    });
    assert.deepEqual(await rolesOf('newbie'), [TaskActorRole.FOLLOWER]);
    assert.equal(await prisma.outboxEvent.count({ where: { aggregateId: taskId } }), before);
  });

  test('không thêm người đang là chủ trì hoặc người thẩm tra (AC-T07-1)', async () => {
    for (const key of ['dri', 'reviewer']) {
      await assert.rejects(
        taskDomainActionService.addPerson(session('creator'), taskId, {
          userId: u[key],
          role: 'COLLABORATOR',
          expectedVersion: await version(),
        }),
        ValidationError
      );
    }
    assert.deepEqual(await rolesOf('dri'), [TaskActorRole.DRI]);
    assert.deepEqual(await rolesOf('reviewer'), [TaskActorRole.REVIEWER]);
  });

  test('không thêm tài khoản ngừng hoạt động hoặc không tồn tại', async () => {
    await assert.rejects(
      taskDomainActionService.addPerson(session('creator'), taskId, {
        userId: u.inactive,
        role: 'FOLLOWER',
        expectedVersion: await version(),
      }),
      ValidationError
    );
    await assert.rejects(
      taskDomainActionService.addPerson(session('creator'), taskId, {
        userId: 'khong-ton-tai',
        role: 'FOLLOWER',
        expectedVersion: await version(),
      }),
      NotFoundError
    );
  });

  test('người phối hợp và người ngoài không quản lý được người tham gia', async () => {
    for (const key of ['collab', 'stranger']) {
      await assert.rejects(
        taskDomainActionService.addPerson(session(key), taskId, {
          userId: u.stranger,
          role: 'FOLLOWER',
          expectedVersion: await version(),
        }),
        (err: unknown) => err instanceof ApiError && err.statusCode === 403
      );
    }
  });

  test('lệch version trả 412', async () => {
    await assert.rejects(
      taskDomainActionService.addPerson(session('creator'), taskId, {
        userId: u.stranger,
        role: 'FOLLOWER',
        expectedVersion: (await version()) - 1,
      }),
      PreconditionFailedError
    );
  });

  test('bớt người theo dõi; không bớt chủ trì; bớt người không tham gia báo 404', async () => {
    const v = await version();
    const res = await taskDomainActionService.removePerson(session('creator'), taskId, {
      userId: u.newbie,
      expectedVersion: v,
    });
    assert.equal(res.removed, true);
    assert.deepEqual(await rolesOf('newbie'), []);
    assert.ok(await prisma.auditEvent.findFirst({ where: { entityId: taskId, action: 'TASK_PERSON_REMOVED' } }));

    await assert.rejects(
      taskDomainActionService.removePerson(session('creator'), taskId, { userId: u.dri, expectedVersion: await version() }),
      ValidationError
    );
    await assert.rejects(
      taskDomainActionService.removePerson(session('creator'), taskId, { userId: u.stranger, expectedVersion: await version() }),
      NotFoundError
    );
  });

  test('nhiệm vụ đã hoàn thành không đổi người tham gia', async () => {
    await prisma.task.update({
      where: { id: taskId },
      data: { status: TaskStatus.COMPLETED, progressPercent: 100, completedAt: new Date() },
    });
    await assert.rejects(
      taskDomainActionService.addPerson(session('creator'), taskId, {
        userId: u.stranger,
        role: 'FOLLOWER',
        expectedVersion: await version(),
      }),
      InvalidTransitionError
    );
    await prisma.task.update({
      where: { id: taskId },
      data: { status: TaskStatus.IN_PROGRESS, progressPercent: 0, completedAt: null },
    });
  });
});
