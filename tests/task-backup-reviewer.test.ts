/**
 * T-05 (spec task-document-gap-spec.md): người duyệt dự phòng.
 * Chạy trên qcet_test; chỉ quét các nhiệm vụ do test tạo và chỉ xóa bản ghi của test.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { TaskActorRole, TaskStatus } from '@prisma/client';
import { ZodError } from 'zod';
import { prisma } from '../src/lib/prisma';
import { scanTaskReminders } from '../src/server/tasks/task-reminder-scanner';
import { getBackupReviewer, setBackupReviewer } from '../src/server/tasks/task-backup-reviewer-service';
import { authorizeOnTask } from '../src/server/tasks/authorize-on-task';
import { ApiError } from '../src/server/api/errors';
import { checkBackupCandidate, isBackupDue } from '../src/domain/tasks/backup-reviewer-rules';

const runId = `t05_${Date.now()}`;
const u: Record<string, string> = {};
const tasks: string[] = [];

const at = (iso: string) => new Date(iso);
const session = (key: string) => ({ id: u[key], email: `${key}@x`, name: key, role: 'CHUYEN_VIEN' });
const forbidden = (err: unknown) => err instanceof ApiError && err.statusCode === 403;
const validation = (code: string) => (err: unknown) => err instanceof ApiError && err.code === code;
const SUBMITTED = '2026-10-10T08:00:00+07:00';

async function makeWaitingTask(key: string, submittedAt = SUBMITTED) {
  const task = await prisma.task.create({
    data: {
      code: `${runId}_${key}`.slice(0, 50),
      title: `Nhiệm vụ ${key}`,
      academicMonth: 10,
      academicYear: '2026-2027',
      dueDate: new Date('2026-12-30T00:00:00+07:00'),
      createdById: u.creator,
      status: TaskStatus.WAITING_APPROVAL,
      actors: {
        create: [
          { userId: u.dri, role: TaskActorRole.DRI, isPrimaryDRI: true },
          { userId: u.collab, role: TaskActorRole.COLLABORATOR },
          { userId: u.reviewer, role: TaskActorRole.REVIEWER },
        ],
      },
    },
  });
  await prisma.taskResult.create({ data: { taskId: task.id, submittedByUserId: u.dri, summary: 'Xong', submittedAt: at(submittedAt) } });
  tasks.push(task.id);
  return task.id;
}

const scan = (taskId: string, now: string) => scanTaskReminders({ now: at(now), taskIds: [taskId] });
const canReview = async (key: string, taskId: string) => authorizeOnTask(session(key), taskId, 'task.review').then(() => true, () => false);
const actorsOf = (taskId: string) => prisma.taskActor.findMany({ where: { taskId, userId: u.backup } });

describe('T-05 người duyệt dự phòng', () => {
  before(async () => {
    for (const key of ['creator', 'dri', 'collab', 'reviewer', 'backup', 'other', 'stranger']) {
      const user = await prisma.user.create({ data: { email: `${runId}_${key}@cdktcnqn.edu.vn`, name: `${runId} ${key}` } });
      u[key] = user.id;
    }
  });

  after(async () => {
    const ids = Object.values(u);
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: tasks } } });
    await prisma.taskReminderLog.deleteMany({ where: { taskId: { in: tasks } } });
    await prisma.task.deleteMany({ where: { id: { in: tasks } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  test('quy tắc thuần túy: N4 và mốc 96 giờ', () => {
    const base = { creatorId: 'c', executorIds: ['d'], submitterIds: ['s'], reviewerIds: ['r'] };
    assert.equal(checkBackupCandidate({ ...base, candidateId: 'c' }), 'SAME_AS_CREATOR');
    assert.equal(checkBackupCandidate({ ...base, candidateId: 'd' }), 'IS_EXECUTOR');
    assert.equal(checkBackupCandidate({ ...base, candidateId: 's' }), 'IS_SUBMITTER');
    assert.equal(checkBackupCandidate({ ...base, candidateId: 'r' }), 'IS_PRIMARY_REVIEWER');
    assert.equal(checkBackupCandidate({ ...base, candidateId: 'x' }), null);
    assert.equal(isBackupDue(at('2026-10-10T00:00:00Z'), at('2026-10-13T23:59:00Z')), false);
    assert.equal(isBackupDue(at('2026-10-10T00:00:00Z'), at('2026-10-14T00:00:00Z')), true);
  });

  test('chỉ người giao chỉ định; người dự phòng chịu N4', async () => {
    const id = await makeWaitingTask('set');
    for (const key of ['dri', 'collab', 'stranger', 'reviewer']) {
      await assert.rejects(setBackupReviewer(session(key), id, { userId: u.backup }), forbidden, key);
    }
    await assert.rejects(setBackupReviewer(session('creator'), id, { userId: u.creator }), validation('BACKUP_SAME_AS_CREATOR'));
    await assert.rejects(setBackupReviewer(session('creator'), id, { userId: u.dri }), validation('BACKUP_IS_EXECUTOR'));
    await assert.rejects(setBackupReviewer(session('creator'), id, { userId: u.collab }), validation('BACKUP_IS_EXECUTOR'));
    await assert.rejects(setBackupReviewer(session('creator'), id, { userId: u.reviewer }), validation('BACKUP_IS_PRIMARY_REVIEWER'));
    await assert.rejects(setBackupReviewer(session('creator'), id, { userId: 'khong-ton-tai' }), validation('BACKUP_USER_NOT_FOUND'));
    await assert.rejects(setBackupReviewer(session('creator'), id, {} as never), ZodError);

    const view = await setBackupReviewer(session('creator'), id, { userId: u.backup });
    assert.equal(view.backup?.userId, u.backup);
    assert.equal(view.backup?.active, false);
    assert.ok(await prisma.auditEvent.findFirst({ where: { entityId: id, action: 'TASK_BACKUP_REVIEWER_SET' } }));
    assert.equal((await getBackupReviewer(session('dri'), id)).canEdit, false);
  });

  test('chỉ nhận quyền duyệt đúng mốc 96 giờ, và được báo một lần (AC-T05-1)', async () => {
    const id = await makeWaitingTask('timing');
    await setBackupReviewer(session('creator'), id, { userId: u.backup });

    assert.equal(await canReview('backup', id), false, 'vừa chỉ định chưa có quyền');
    await scan(id, '2026-10-13T07:59:00+07:00'); // 95 giờ 59 phút
    assert.equal(await canReview('backup', id), false, 'chưa đủ 96 giờ');
    assert.equal((await actorsOf(id)).length, 0);

    const first = await scan(id, '2026-10-14T08:00:00+07:00'); // đúng 96 giờ
    assert.equal(first.sent.BACKUP_REVIEWER_ACTIVATED, 1);
    assert.equal(await canReview('backup', id), true, 'đủ 96 giờ thì duyệt được');
    assert.equal((await actorsOf(id)).length, 1);
    assert.equal((await getBackupReviewer(session('creator'), id)).backup?.active, true);
    assert.ok(await prisma.auditEvent.findFirst({ where: { entityId: id, action: 'TASK_BACKUP_REVIEWER_ACTIVATED' } }));

    const again = await scan(id, '2026-10-14T09:00:00+07:00');
    assert.equal(again.sent.BACKUP_REVIEWER_ACTIVATED ?? 0, 0);
    assert.equal((await actorsOf(id)).length, 1, 'không thêm dòng thứ hai');
    const notices = await prisma.notification.findMany({ where: { userId: u.backup, type: 'review_pending' } });
    assert.equal(notices.length, 1);
  });

  test('người dự phòng vẫn chịu N4 khi duyệt: người nộp kết quả không tự duyệt (AC-T05-2)', async () => {
    const id = await makeWaitingTask('n4');
    await setBackupReviewer(session('creator'), id, { userId: u.backup });
    // Sau khi được chỉ định, người dự phòng nộp kết quả (đã là người nộp).
    await prisma.taskResult.create({ data: { taskId: id, submittedByUserId: u.backup, summary: 'Nộp hộ', submittedAt: at(SUBMITTED) } });

    const res = await scan(id, '2026-10-14T08:00:00+07:00');
    assert.equal(res.sent.BACKUP_REVIEWER_ACTIVATED ?? 0, 0, 'không kích hoạt người đã là người nộp');
    assert.equal(await canReview('backup', id), false);
    assert.equal((await actorsOf(id)).length, 0);
  });

  test('nộp lại hoặc rời trạng thái chờ duyệt thì gỡ quyền người dự phòng', async () => {
    const id = await makeWaitingTask('revoke');
    await setBackupReviewer(session('creator'), id, { userId: u.backup });
    await scan(id, '2026-10-14T08:00:00+07:00');
    assert.equal(await canReview('backup', id), true);

    // Nộp lại: đợt chờ duyệt mới bắt đầu, người dự phòng mất quyền cho tới khi đủ 96 giờ.
    await prisma.taskResult.create({ data: { taskId: id, submittedByUserId: u.dri, summary: 'Nộp lại', submittedAt: at('2026-10-14T08:30:00+07:00') } });
    await scan(id, '2026-10-14T09:00:00+07:00');
    assert.equal(await canReview('backup', id), false, 'đợt chờ duyệt mới chưa đủ 96 giờ');
    assert.equal((await getBackupReviewer(session('creator'), id)).backup?.active, false);

    await scan(id, '2026-10-18T09:00:00+07:00');
    assert.equal(await canReview('backup', id), true, 'đủ 96 giờ của đợt mới');

    // Đã duyệt xong (rời WAITING_APPROVAL): gỡ.
    await prisma.task.update({ where: { id }, data: { status: TaskStatus.IN_PROGRESS } });
    await scan(id, '2026-10-18T10:00:00+07:00');
    assert.equal((await actorsOf(id)).length, 0);
    assert.equal((await getBackupReviewer(session('creator'), id)).backup?.active, false);
  });

  test('đổi hoặc gỡ người dự phòng cũng gỡ quyền đã kích hoạt', async () => {
    const id = await makeWaitingTask('change');
    await setBackupReviewer(session('creator'), id, { userId: u.backup });
    await scan(id, '2026-10-14T08:00:00+07:00');
    assert.equal((await actorsOf(id)).length, 1);

    await setBackupReviewer(session('creator'), id, { userId: u.other });
    assert.equal((await actorsOf(id)).length, 0, 'người cũ mất quyền');
    assert.equal(await canReview('backup', id), false);
    assert.equal(await canReview('other', id), false, 'người mới chưa được kích hoạt');

    const cleared = await setBackupReviewer(session('creator'), id, { userId: null });
    assert.equal(cleared.backup, null);
    assert.equal(await prisma.taskBackupReviewer.count({ where: { taskId: id } }), 0);
  });
});
