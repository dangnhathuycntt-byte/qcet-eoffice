/**
 * T-06 (spec task-document-gap-spec.md): bộ quét nhắc hạn nhiệm vụ.
 * Chạy trên qcet_test; chỉ quét các nhiệm vụ do test tạo (tham số taskIds) và chỉ xóa bản ghi của test.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { AssignmentStatus, JobCatalogGroup, TaskActorRole, TaskStatus, UnitType } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { scanTaskReminders } from '../src/server/tasks/task-reminder-scanner';

const runId = `t06_${Date.now()}`;
const u: Record<string, string> = {};
const tasks: Record<string, string> = {};
let unitId = '';
let positionId = '';
let createdPosition = false;

const at = (iso: string) => new Date(iso);
const day = (iso: string) => new Date(`${iso}T00:00:00+07:00`);
const ids = () => Object.values(tasks);
const scan = (now: string) => scanTaskReminders({ now: at(now), taskIds: ids() });
const noticesFor = (key: string, type?: string) =>
  prisma.notification.findMany({ where: { userId: u[key], ...(type ? { type } : {}) } });

async function makeTask(key: string, data: { dueDate: Date; status?: TaskStatus; actors?: Array<{ user: string; role: TaskActorRole; primary?: boolean }> }) {
  const task = await prisma.task.create({
    data: {
      code: `${runId}_${key}`.slice(0, 50),
      title: `Nhiệm vụ ${key}`,
      academicMonth: 10,
      academicYear: '2026-2027',
      dueDate: data.dueDate,
      startDate: day('2026-01-01'),
      createdById: u.creator,
      leadUnitId: unitId,
      status: data.status ?? TaskStatus.IN_PROGRESS,
      actors: {
        create: (data.actors ?? [
          { user: 'dri', role: TaskActorRole.DRI, primary: true },
          { user: 'collab', role: TaskActorRole.COLLABORATOR },
        ]).map((a) => ({ userId: u[a.user], role: a.role, isPrimaryDRI: a.primary ?? false, appointedAt: at('2026-09-01T00:00:00Z') })),
      },
    },
  });
  tasks[key] = task.id;
  return task;
}

describe('T-06 bộ quét nhắc hạn nhiệm vụ', () => {
  before(async () => {
    for (const key of ['creator', 'dri', 'collab', 'reviewer', 'head']) {
      const user = await prisma.user.create({
        data: { email: `${runId}_${key}@cdktcnqn.edu.vn`, name: `${runId} ${key}` },
      });
      u[key] = user.id;
    }
    unitId = (await prisma.organizationalUnit.create({ data: { code: `${runId}_U`.slice(0, 50), name: 'Đơn vị T-06', type: UnitType.DEPARTMENT } })).id;
    let position = await prisma.positionDefinition.findUnique({ where: { code: 'TRUONG_DON_VI' } });
    if (!position) {
      position = await prisma.positionDefinition.create({ data: { code: 'TRUONG_DON_VI', title: 'Trưởng đơn vị', group: JobCatalogGroup.LDPU, isLeadership: true } });
      createdPosition = true;
    }
    positionId = position.id;
    await prisma.positionAssignment.create({ data: { userId: u.head, positionDefinitionId: position.id, unitId, status: AssignmentStatus.ACTIVE } });
  });

  after(async () => {
    const userIds = Object.values(u);
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.taskReminderLog.deleteMany({ where: { taskId: { in: ids() } } });
    await prisma.task.deleteMany({ where: { id: { in: ids() } } });
    await prisma.positionAssignment.deleteMany({ where: { userId: u.head } });
    if (positionId && createdPosition) await prisma.positionDefinition.delete({ where: { id: positionId } });
    await prisma.organizationalUnit.delete({ where: { id: unitId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  test('nhắc trước hạn đúng một lần, cho người chủ trì và phối hợp, không cho người giao (AC-T06-1)', async () => {
    await makeTask('due', { dueDate: day('2026-10-20') });
    const first = await scan('2026-10-19T08:00:00+07:00');
    assert.equal(first.sent.DUE_SOON, 1);
    assert.equal((await noticesFor('dri', 'deadline')).length, 1);
    assert.equal((await noticesFor('collab', 'deadline')).length, 1);
    assert.equal((await noticesFor('creator', 'deadline')).length, 0);

    // Quét lại hai lần (kể cả lúc khác trong ngày) không gửi thêm (AC-T06-3).
    const again = await scan('2026-10-19T08:10:00+07:00');
    await scan('2026-10-19T15:00:00+07:00');
    assert.equal(again.sent.DUE_SOON ?? 0, 0);
    assert.equal(again.skippedDuplicate >= 1, true);
    assert.equal((await noticesFor('dri', 'deadline')).length, 1);
  });

  test('chưa đến giờ gửi hoặc chưa đúng ngày thì không nhắc', async () => {
    await makeTask('early', { dueDate: day('2026-10-22') });
    assert.equal((await scan('2026-10-21T06:00:00+07:00')).sent.DUE_SOON ?? 0, 0, 'trước 07:00');
    assert.equal((await scan('2026-10-20T09:00:00+07:00')).sent.DUE_SOON ?? 0, 0, 'còn 2 ngày');
    assert.equal((await noticesFor('dri')).filter((n) => n.title.includes('early')).length, 0);
  });

  test('người đã tắt nhắc hạn không nhận nhưng người khác vẫn nhận (AC-T06-2)', async () => {
    await prisma.user.update({ where: { id: u.collab }, data: { onboardingData: { pushPreferences: { deadlineReminder: false } } } });
    await makeTask('optout', { dueDate: day('2026-10-25') });
    const res = await scan('2026-10-24T09:00:00+07:00');
    assert.equal(res.sent.DUE_SOON, 1);
    assert.equal(res.skippedOptOut, 1);
    const collabNotices = (await noticesFor('collab', 'deadline')).filter((n) => n.title.includes('optout'));
    assert.equal(collabNotices.length, 0);
    assert.equal((await noticesFor('dri', 'deadline')).filter((n) => n.title.includes('optout')).length, 1);
    await prisma.user.update({ where: { id: u.collab }, data: { onboardingData: undefined } });
  });

  test('báo trễ hạn một lần cho chủ trì, phối hợp và người giao; không tắt được', async () => {
    await prisma.user.update({ where: { id: u.dri }, data: { onboardingData: { pushPreferences: { deadlineReminder: false } } } });
    await makeTask('late', { dueDate: day('2026-10-05') });
    const res = await scan('2026-10-07T08:00:00+07:00');
    assert.equal(res.sent.OVERDUE, 1);
    for (const key of ['dri', 'collab', 'creator']) {
      assert.equal((await noticesFor(key, 'overdue')).filter((n) => n.title.includes('late')).length, 1, key);
    }
    assert.equal((await scan('2026-10-08T08:00:00+07:00')).sent.OVERDUE ?? 0, 0, 'ngày sau không báo lại');
    await prisma.user.update({ where: { id: u.dri }, data: { onboardingData: undefined } });
  });

  test('nhiệm vụ đã nộp duyệt không còn tính trễ cho người thực hiện (AC-T06-4)', async () => {
    await makeTask('submitted', { dueDate: day('2026-10-02'), status: TaskStatus.WAITING_APPROVAL });
    await scan('2026-10-07T08:00:00+07:00');
    assert.equal((await noticesFor('dri')).filter((n) => n.title.includes('submitted')).length, 0);
  });

  test('chờ duyệt: 48 giờ nhắc người duyệt, 96 giờ báo người giao', async () => {
    const t = await makeTask('review', {
      dueDate: day('2026-12-01'),
      status: TaskStatus.WAITING_APPROVAL,
      actors: [
        { user: 'dri', role: TaskActorRole.DRI, primary: true },
        { user: 'reviewer', role: TaskActorRole.REVIEWER },
      ],
    });
    await prisma.taskResult.create({ data: { taskId: t.id, submittedByUserId: u.dri, summary: 'Xong', submittedAt: at('2026-10-10T08:00:00+07:00') } });

    assert.equal((await scan('2026-10-12T07:00:00+07:00')).sent.REVIEW_PENDING_2D ?? 0, 0, 'chưa đủ 48 giờ');
    const first = await scan('2026-10-12T08:30:00+07:00');
    assert.equal(first.sent.REVIEW_PENDING_2D, 1);
    assert.equal((await noticesFor('reviewer', 'review_pending')).length, 1);
    assert.equal((await noticesFor('creator', 'escalation')).filter((n) => n.title.includes('review')).length, 0);

    const second = await scan('2026-10-14T08:30:00+07:00');
    assert.equal(second.sent.REVIEW_PENDING_4D, 1);
    const kinds = (await prisma.taskReminderLog.findMany({ where: { taskId: t.id } })).map((l) => l.kind).sort();
    assert.deepEqual(kinds, ['REVIEW_PENDING_2D', 'REVIEW_PENDING_4D'], 'mốc 48 giờ không bị nhắc lại');
    assert.equal((await noticesFor('creator', 'escalation')).filter((n) => n.title.includes('review')).length, 1);
    assert.equal((await noticesFor('reviewer', 'review_pending')).length, 1);
  });

  test('yêu cầu gia hạn chưa trả lời: 48 giờ nhắc người giao, 96 giờ báo trưởng đơn vị', async () => {
    const t = await makeTask('ext', { dueDate: day('2026-12-05') });
    await prisma.taskExtensionRequest.create({
      data: {
        taskId: t.id, requestedById: u.dri, previousDueDate: day('2026-12-05'), requestedDueDate: day('2026-12-12'),
        reason: 'Cần thêm thời gian', createdAt: at('2026-10-10T08:00:00+07:00'),
      },
    });
    const first = await scan('2026-10-12T09:00:00+07:00');
    assert.equal(first.sent.EXTENSION_PENDING_2D, 1);
    assert.equal((await noticesFor('creator', 'extension_requested')).filter((n) => n.body.includes('gia hạn')).length >= 1, true);

    const second = await scan('2026-10-14T09:00:00+07:00');
    assert.equal(second.sent.EXTENSION_PENDING_4D, 1);
    assert.equal((await noticesFor('head', 'escalation')).length >= 1, true, 'trưởng đơn vị được báo');
  });

  test('từ chối nhận việc chưa giao lại: nhắc người giao; giao lại rồi thì thôi', async () => {
    const t = await makeTask('decl', { dueDate: day('2026-12-08'), status: TaskStatus.NOT_STARTED });
    await prisma.taskDeclineNotice.create({ data: { taskId: t.id, userId: u.dri, reason: 'Quá tải', createdAt: at('2026-10-10T08:00:00+07:00') } });
    const first = await scan('2026-10-12T09:00:00+07:00');
    assert.equal(first.sent.DECLINE_PENDING_2D, 1);
    assert.equal((await noticesFor('creator', 'declined')).filter((n) => n.title.includes('decl')).length, 1);

    // Giao lại: người chủ trì mới được bổ nhiệm sau thông báo từ chối.
    await prisma.taskActor.updateMany({ where: { taskId: t.id, userId: u.dri }, data: { role: TaskActorRole.COLLABORATOR, isPrimaryDRI: false } });
    await prisma.taskActor.create({ data: { taskId: t.id, userId: u.reviewer, role: TaskActorRole.DRI, isPrimaryDRI: true, appointedAt: at('2026-10-13T08:00:00+07:00') } });
    const after = await scan('2026-10-15T09:00:00+07:00');
    assert.equal(after.sent.DECLINE_PENDING_4D ?? 0, 0);
  });

  test('nhiệm vụ đã hoàn thành, đã hủy hoặc đã lưu trữ không được nhắc', async () => {
    for (const [key, data] of [
      ['done', { status: TaskStatus.COMPLETED }],
      ['cancel', { status: TaskStatus.CANCELLED }],
    ] as const) {
      const t = await makeTask(key, { dueDate: day('2026-11-20') });
      await prisma.task.update({
        where: { id: t.id },
        data: data.status === TaskStatus.COMPLETED
          ? { status: TaskStatus.COMPLETED, progressPercent: 100, completedAt: new Date() }
          : { status: TaskStatus.CANCELLED },
      });
    }
    const t = await makeTask('arch', { dueDate: day('2026-11-20') });
    await prisma.task.update({ where: { id: t.id }, data: { archivedAt: new Date() } });
    const res = await scan('2026-11-19T09:00:00+07:00');
    assert.equal(res.sent.DUE_SOON ?? 0, 0);
  });
});
