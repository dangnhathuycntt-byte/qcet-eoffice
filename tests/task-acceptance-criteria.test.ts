/**
 * T-04 (spec task-document-gap-spec.md): tiêu chí hoàn thành của nhiệm vụ.
 * Chạy trên qcet_test và chỉ xóa bản ghi do test tạo.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { TaskActorRole, TaskStatus } from '@prisma/client';
import { ZodError } from 'zod';
import { prisma } from '../src/lib/prisma';
import {
  getTaskCriteria,
  replaceTaskCriteria,
  setTaskCriterionChecked,
} from '../src/server/tasks/task-criteria-service';
import { taskDomainActionService } from '../src/lib/services/task-domain-actions';
import { ApiError, InvalidTransitionError, PreconditionFailedError } from '../src/server/api/errors';

const runId = `t04_${Date.now()}`;
const u: Record<string, string> = {};
let taskId = '';

const session = (key: string) => ({ id: u[key], email: `${key}@x`, name: key, role: 'CHUYEN_VIEN' });
const version = async () => (await prisma.task.findUniqueOrThrow({ where: { id: taskId } })).version;
const setStatus = (status: TaskStatus) => prisma.task.update({ where: { id: taskId }, data: { status } });
const forbidden = (err: unknown) => err instanceof ApiError && err.statusCode === 403;

describe('T-04 tiêu chí hoàn thành', () => {
  before(async () => {
    for (const key of ['creator', 'dri', 'reviewer', 'stranger']) {
      const user = await prisma.user.create({
        data: { email: `${runId}_${key}@cdktcnqn.edu.vn`, name: `${runId} ${key}` },
      });
      u[key] = user.id;
    }
    const task = await prisma.task.create({
      data: {
        code: runId.slice(0, 50),
        title: 'Nhiệm vụ T-04',
        academicMonth: 10,
        academicYear: '2026-2027',
        dueDate: new Date('2026-10-30T00:00:00+07:00'),
        createdById: u.creator,
        status: TaskStatus.IN_PROGRESS,
        actors: {
          create: [
            { userId: u.dri, role: TaskActorRole.DRI, isPrimaryDRI: true },
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

  test('người giao ghi tiêu chí: lưu theo thứ tự, tăng version, ghi audit', async () => {
    const v = await version();
    const view = await replaceTaskCriteria(session('creator'), taskId, {
      criteria: [{ text: 'Có phụ lục 1' }, { text: 'Có chữ ký lãnh đạo' }, { text: 'Nộp đúng hạn' }],
      expectedVersion: v,
    });
    assert.deepEqual(view.criteria.map((c) => c.text), ['Có phụ lục 1', 'Có chữ ký lãnh đạo', 'Nộp đúng hạn']);
    assert.deepEqual(view.criteria.map((c) => c.position), [0, 1, 2]);
    assert.equal(view.canEdit, true);
    assert.equal(view.unmet, 3);
    assert.equal(await version(), v + 1);
    assert.ok(await prisma.auditEvent.findFirst({ where: { entityId: taskId, action: 'TASK_CRITERIA_UPDATED' } }));
  });

  test('người thực hiện và người ngoài không sửa được tiêu chí', async () => {
    for (const key of ['dri', 'stranger']) {
      await assert.rejects(
        replaceTaskCriteria(session(key), taskId, { criteria: [{ text: 'Tự thêm' }], expectedVersion: await version() }),
        forbidden
      );
    }
  });

  test('giới hạn 20 tiêu chí, 300 ký tự và không rỗng', async () => {
    const v = await version();
    await assert.rejects(
      replaceTaskCriteria(session('creator'), taskId, {
        criteria: Array.from({ length: 21 }, (_, i) => ({ text: `Tiêu chí ${i}` })),
        expectedVersion: v,
      }),
      ZodError
    );
    await assert.rejects(replaceTaskCriteria(session('creator'), taskId, { criteria: [{ text: 'a'.repeat(301) }], expectedVersion: v }), ZodError);
    await assert.rejects(replaceTaskCriteria(session('creator'), taskId, { criteria: [{ text: '  ' }], expectedVersion: v }), ZodError);
  });

  test('lệch version trả 412', async () => {
    await assert.rejects(
      replaceTaskCriteria(session('creator'), taskId, { criteria: [{ text: 'x' }], expectedVersion: (await version()) - 1 }),
      PreconditionFailedError
    );
  });

  test('giữ id thì giữ đánh dấu; đổi nội dung thì bỏ đánh dấu cũ; bớt thì xóa', async () => {
    const before = (await getTaskCriteria(session('creator'), taskId)).criteria;
    await setStatus(TaskStatus.WAITING_APPROVAL);
    await setTaskCriterionChecked(session('reviewer'), taskId, before[0].id, { checked: true });
    await setTaskCriterionChecked(session('reviewer'), taskId, before[1].id, { checked: true });
    await setStatus(TaskStatus.IN_PROGRESS);

    const view = await replaceTaskCriteria(session('creator'), taskId, {
      criteria: [
        { id: before[0].id, text: before[0].text }, // giữ nguyên
        { id: before[1].id, text: 'Có chữ ký của Hiệu trưởng' }, // đổi nội dung
        { text: 'Có biên bản họp' }, // thêm mới
      ],
      expectedVersion: await version(),
    });
    assert.equal(view.criteria.length, 3);
    assert.equal(view.criteria[0].checked, true, 'giữ nguyên thì giữ đánh dấu');
    assert.equal(view.criteria[1].checked, false, 'đổi nội dung thì bỏ đánh dấu');
    assert.equal(view.criteria[2].checked, false);
    assert.equal(await prisma.taskAcceptanceCriterion.count({ where: { taskId } }), 3);
  });

  test('không sửa tiêu chí khi đang chờ duyệt (AC-T04-1)', async () => {
    await setStatus(TaskStatus.WAITING_APPROVAL);
    try {
      await assert.rejects(
        replaceTaskCriteria(session('creator'), taskId, { criteria: [{ text: 'Muộn' }], expectedVersion: await version() }),
        InvalidTransitionError
      );
    } finally {
      await setStatus(TaskStatus.IN_PROGRESS);
    }
  });

  test('người duyệt đánh dấu khi chờ duyệt; người thực hiện và người ngoài không được', async () => {
    const [first] = (await getTaskCriteria(session('reviewer'), taskId)).criteria;
    await setStatus(TaskStatus.WAITING_APPROVAL);
    try {
      const view = await setTaskCriterionChecked(session('reviewer'), taskId, first.id, { checked: true });
      assert.equal(view.criteria[0].checked, true);
      assert.equal(view.canCheck, true);
      assert.ok(await prisma.auditEvent.findFirst({ where: { entityId: taskId, action: 'TASK_CRITERION_CHECKED' } }));

      for (const key of ['dri', 'stranger']) {
        await assert.rejects(setTaskCriterionChecked(session(key), taskId, first.id, { checked: false }), forbidden);
      }
    } finally {
      await setStatus(TaskStatus.IN_PROGRESS);
    }
  });

  test('không đánh dấu khi nhiệm vụ chưa nộp duyệt', async () => {
    const [first] = (await getTaskCriteria(session('reviewer'), taskId)).criteria;
    await assert.rejects(setTaskCriterionChecked(session('reviewer'), taskId, first.id, { checked: true }), InvalidTransitionError);
  });

  test('duyệt không bị chặn khi còn tiêu chí chưa đạt, nhật ký ghi số tiêu chí chưa đạt (AC-T04-3)', async () => {
    await setStatus(TaskStatus.WAITING_APPROVAL);
    await prisma.taskResult.create({ data: { taskId, submittedByUserId: u.dri, summary: 'Đã xong' } });
    const view = await getTaskCriteria(session('reviewer'), taskId);
    const unmet = view.unmet;
    assert.ok(unmet > 0, 'phải còn tiêu chí chưa đạt để kiểm thử');

    const result = await taskDomainActionService.approve(session('reviewer'), taskId, { expectedVersion: await version() });
    assert.equal(result.completed, true);
    assert.equal(result.unmetCriteria, unmet);

    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { entityId: taskId, action: 'TASK_APPROVED' } });
    assert.equal((audit.afterData as { unmetCriteria: number }).unmetCriteria, unmet);
    await prisma.taskResult.deleteMany({ where: { taskId } });
  });
});
