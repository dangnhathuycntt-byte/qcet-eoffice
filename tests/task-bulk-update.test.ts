/**
 * T-08 (spec task-document-gap-spec.md): đổi ưu tiên hàng loạt.
 * Chạy trên qcet_test và chỉ xóa bản ghi do test tạo.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { TaskActorRole, TaskPriority, TaskStatus } from '@prisma/client';
import { ZodError } from 'zod';
import { prisma } from '../src/lib/prisma';
import { MAX_BULK_ITEMS, bulkUpdateTaskPriority } from '../src/server/tasks/task-bulk-service';
import { withIdempotency } from '../src/lib/db/idempotency';

const runId = `t08_${Date.now()}`;
const u: Record<string, string> = {};
const t: Record<string, string> = {};

const session = (key: string) => ({ id: u[key], email: `${key}@x`, name: key, role: 'CHUYEN_VIEN' });
const version = async (key: string) => (await prisma.task.findUniqueOrThrow({ where: { id: t[key] } })).version;
const item = async (key: string) => ({ id: t[key], expectedVersion: await version(key) });
const row = (res: { results: Array<{ id: string }> }, key: string) => res.results.find((r) => r.id === t[key]) as Record<string, unknown>;

async function makeTask(key: string, opts: { createdBy?: string; status?: TaskStatus } = {}) {
  const task = await prisma.task.create({
    data: {
      code: `${runId}_${key}`.slice(0, 50),
      title: `Nhiệm vụ ${key}`,
      academicMonth: 10,
      academicYear: '2026-2027',
      dueDate: new Date('2026-12-30T00:00:00+07:00'),
      createdById: u[opts.createdBy ?? 'creator'],
      priority: TaskPriority.NORMAL,
      status: opts.status ?? TaskStatus.IN_PROGRESS,
      actors: { create: [{ userId: u.dri, role: TaskActorRole.DRI, isPrimaryDRI: true }] },
    },
  });
  t[key] = task.id;
}

describe('T-08 đổi ưu tiên hàng loạt', () => {
  before(async () => {
    for (const key of ['creator', 'other', 'dri', 'stranger']) {
      const user = await prisma.user.create({ data: { email: `${runId}_${key}@cdktcnqn.edu.vn`, name: `${runId} ${key}` } });
      u[key] = user.id;
    }
    await makeTask('a');
    await makeTask('b');
    await makeTask('c', { createdBy: 'other' });
    await makeTask('done');
    await prisma.task.update({ where: { id: t.done }, data: { status: TaskStatus.COMPLETED, progressPercent: 100, completedAt: new Date() } });
  });

  after(async () => {
    const ids = Object.values(u);
    await prisma.idempotencyRecord.deleteMany({ where: { userId: { in: ids } } });
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: Object.values(t) } } });
    await prisma.task.deleteMany({ where: { id: { in: Object.values(t) } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  test('đổi ưu tiên nhiều nhiệm vụ: tăng version và ghi audit từng nhiệm vụ', async () => {
    const before = await version('a');
    const res = await bulkUpdateTaskPriority(session('creator'), {
      items: [await item('a'), await item('b')],
      priority: TaskPriority.URGENT,
    });
    assert.equal(res.total, 2);
    assert.equal(res.succeeded, 2);
    assert.equal(row(res, 'a').changed, true);
    for (const key of ['a', 'b']) {
      const task = await prisma.task.findUniqueOrThrow({ where: { id: t[key] } });
      assert.equal(task.priority, TaskPriority.URGENT);
    }
    assert.equal(await version('a'), before + 1);
    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { entityId: t.a, action: 'TASK_UPDATED' } });
    assert.deepEqual((audit.afterData as { priority: string }).priority, 'URGENT');
  });

  test('dòng không có quyền, đã kết thúc, lệch version hoặc không tồn tại báo lỗi riêng, các dòng còn lại vẫn áp dụng (AC-T08-3)', async () => {
    const res = await bulkUpdateTaskPriority(session('creator'), {
      items: [
        await item('a'), // hợp lệ → đổi sang LOW
        await item('c'), // do người khác tạo, người gọi không liên quan → bị từ chối
        await item('done'), // đã hoàn thành
        { id: t.b, expectedVersion: (await version('b')) - 1 }, // lệch version
        { id: 'khong-ton-tai', expectedVersion: 1 },
      ],
      priority: TaskPriority.LOW,
    });
    assert.equal(res.succeeded, 1, 'chỉ dòng hợp lệ được áp dụng');
    assert.equal(row(res, 'a').ok, true);
    assert.equal((await prisma.task.findUniqueOrThrow({ where: { id: t.a } })).priority, TaskPriority.LOW);
    assert.equal(row(res, 'c').code, 'FORBIDDEN');
    assert.equal(row(res, 'done').code, 'TASK_CLOSED');
    assert.equal(row(res, 'b').code, 'VERSION_CONFLICT');
    assert.equal((res.results.find((r) => r.id === 'khong-ton-tai') as { code: string }).code, 'NOT_FOUND');
    // Nhiệm vụ lỗi không bị đổi.
    assert.equal((await prisma.task.findUniqueOrThrow({ where: { id: t.c } })).priority, TaskPriority.NORMAL);
    assert.equal((await prisma.task.findUniqueOrThrow({ where: { id: t.done } })).priority, TaskPriority.NORMAL);
  });

  test('đặt cùng giá trị thì không đổi và không tăng version', async () => {
    const before = await version('a');
    // Sau ca trước, nhiệm vụ a đã là LOW.
    const res = await bulkUpdateTaskPriority(session('creator'), { items: [await item('a')], priority: TaskPriority.LOW });
    assert.equal(row(res, 'a').ok, true);
    assert.equal(row(res, 'a').changed, false);
    assert.equal(await version('a'), before);
  });

  test('người ngoài không đổi được nhiệm vụ nào', async () => {
    const res = await bulkUpdateTaskPriority(session('stranger'), {
      items: [await item('a'), await item('b')],
      priority: TaskPriority.HIGH,
    });
    assert.equal(res.succeeded, 0);
    assert.ok(res.results.every((r) => r.code === 'FORBIDDEN'));
  });

  test('giới hạn 200 nhiệm vụ, không rỗng, không trùng mã; ưu tiên phải hợp lệ (AC-T08-1)', async () => {
    const many = Array.from({ length: MAX_BULK_ITEMS + 1 }, (_, i) => ({ id: `x${i}`, expectedVersion: 1 }));
    await assert.rejects(bulkUpdateTaskPriority(session('creator'), { items: many, priority: TaskPriority.LOW }), ZodError);
    await assert.rejects(bulkUpdateTaskPriority(session('creator'), { items: [], priority: TaskPriority.LOW }), ZodError);
    await assert.rejects(
      bulkUpdateTaskPriority(session('creator'), {
        items: [{ id: t.a, expectedVersion: 1 }, { id: t.a, expectedVersion: 1 }],
        priority: TaskPriority.LOW,
      }),
      ZodError
    );
    await assert.rejects(
      bulkUpdateTaskPriority(session('creator'), { items: [{ id: t.a, expectedVersion: 1 }], priority: 'KHONG_HOP_LE' as never }),
      ZodError
    );
  });

  test('gửi lại cùng Idempotency-Key không tạo thay đổi thứ hai (AC-T08-2)', async () => {
    const body = { items: [await item('b')], priority: TaskPriority.HIGH };
    const options = { userId: u.creator, operation: 'task.bulk-update-priority', key: `${runId}-key`, payload: body };
    const first = await withIdempotency(options, () => bulkUpdateTaskPriority(session('creator'), body));
    const versionAfterFirst = await version('b');
    const second = await withIdempotency(options, () => bulkUpdateTaskPriority(session('creator'), body));

    assert.deepEqual(second, first, 'trả đúng kết quả đã lưu');
    assert.equal(await version('b'), versionAfterFirst, 'không đổi lần hai');
    assert.equal(first.succeeded, 1);
  });
});
