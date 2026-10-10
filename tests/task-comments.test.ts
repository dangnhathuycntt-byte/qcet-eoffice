/**
 * T-03 (spec task-document-gap-spec.md): bình luận nhiệm vụ.
 * Chạy trên qcet_test và chỉ xóa bản ghi do test tạo.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { TaskActorRole, TaskStatus } from '@prisma/client';
import { ZodError } from 'zod';
import { prisma } from '../src/lib/prisma';
import {
  createTaskComment,
  deleteTaskComment,
  listTaskComments,
  updateTaskComment,
} from '../src/server/tasks/task-comment-service';
import { runOutboxCycle } from '../src/server/outbox/outbox-worker';
import { ApiError, NotFoundError } from '../src/server/api/errors';

const runId = `t03_${Date.now()}`;
const u: Record<string, string> = {};
let taskId = '';

const session = (key: string) => ({ id: u[key], email: `${key}@x`, name: key, role: 'CHUYEN_VIEN' });
const forbidden = (err: unknown) => err instanceof ApiError && err.statusCode === 403;

describe('T-03 bình luận nhiệm vụ', () => {
  before(async () => {
    for (const key of ['creator', 'dri', 'collab', 'follower', 'reviewer', 'observer', 'stranger']) {
      const user = await prisma.user.create({
        data: { email: `${runId}_${key}@cdktcnqn.edu.vn`, name: `${runId} ${key}` },
      });
      u[key] = user.id;
    }
    const task = await prisma.task.create({
      data: {
        code: runId.slice(0, 50),
        title: 'Nhiệm vụ T-03',
        academicMonth: 10,
        academicYear: '2026-2027',
        dueDate: new Date('2026-10-30T00:00:00+07:00'),
        createdById: u.creator,
        status: TaskStatus.IN_PROGRESS,
        actors: {
          create: [
            { userId: u.dri, role: TaskActorRole.DRI, isPrimaryDRI: true },
            { userId: u.collab, role: TaskActorRole.COLLABORATOR },
            { userId: u.follower, role: TaskActorRole.FOLLOWER },
            { userId: u.reviewer, role: TaskActorRole.REVIEWER },
            { userId: u.observer, role: TaskActorRole.OBSERVER },
          ],
        },
      },
    });
    taskId = task.id;
  });

  after(async () => {
    const ids = Object.values(u);
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: taskId } });
    await prisma.auditEvent.deleteMany({ where: { entityId: taskId } });
    if (taskId) await prisma.task.delete({ where: { id: taskId } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  test('người giao, chủ trì, phối hợp, theo dõi, người duyệt đều bình luận được', async () => {
    for (const key of ['creator', 'dri', 'collab', 'follower', 'reviewer']) {
      const c = await createTaskComment(session(key), taskId, { body: `Ý kiến của ${key}` });
      assert.equal(c.author.id, u[key]);
      assert.equal(c.canEdit, true);
    }
  });

  test('người quan sát và người ngoài không bình luận được (AC-T03-1)', async () => {
    for (const key of ['observer', 'stranger']) {
      await assert.rejects(createTaskComment(session(key), taskId, { body: 'Xin chào' }), forbidden);
    }
  });

  test('người ngoài không đọc được danh sách; người quan sát đọc được', async () => {
    await assert.rejects(listTaskComments(session('stranger'), taskId), forbidden);
    const { comments: list, participants } = await listTaskComments(session('observer'), taskId);
    assert.ok(list.length >= 5);
    assert.ok(list.every((c) => c.canEdit === false));
    assert.ok(participants.some((p) => p.id === u.dri));
    assert.ok(!participants.some((p) => p.id === u.observer), 'không gồm chính người xem');
    assert.ok(!participants.some((p) => p.id === u.stranger));
  });

  test('thẻ HTML được lưu nguyên dạng văn bản thuần (AC-T03-2)', async () => {
    const body = '<script>alert(1)</script> <b>đậm</b>';
    const c = await createTaskComment(session('dri'), taskId, { body });
    assert.equal(c.body, body);
    const row = await prisma.taskComment.findUniqueOrThrow({ where: { id: c.id } });
    assert.equal(row.body, body);
  });

  test('từ chối nội dung rỗng, quá 2000 ký tự hoặc chứa ký tự NUL', async () => {
    await assert.rejects(createTaskComment(session('dri'), taskId, { body: '   ' }), ZodError);
    await assert.rejects(createTaskComment(session('dri'), taskId, { body: 'a'.repeat(2001) }), ZodError);
    await assert.rejects(createTaskComment(session('dri'), taskId, { body: 'a\u0000b' }), ZodError);
  });

  test('nhắc tên: chỉ người có vai trò trên nhiệm vụ, bỏ chính mình và người ngoài', async () => {
    const c = await createTaskComment(session('dri'), taskId, {
      body: 'Nhờ chị xem giúp',
      mentionUserIds: [u.collab, u.dri, u.stranger],
    });
    const ev = await prisma.outboxEvent.findFirstOrThrow({
      where: { aggregateId: taskId, eventType: 'TASK_COMMENT_MENTION_NOTIFICATION' },
      orderBy: { createdAt: 'desc' },
    });
    assert.deepEqual((ev.payload as { mentionedUserIds: string[] }).mentionedUserIds, [u.collab]);

    await runOutboxCycle(prisma, { ids: [ev.id] });
    const notices = await prisma.notification.findMany({ where: { userId: u.collab, type: 'mention' } });
    assert.equal(notices.length, 1);
    assert.match(notices[0].body, /nhắc bạn|Nhờ chị/);
    assert.equal((await prisma.notification.count({ where: { userId: u.stranger } })), 0);
    assert.equal(c.canEdit, true);
  });

  test('nhật ký không chứa nội dung bình luận', async () => {
    const c = await createTaskComment(session('creator'), taskId, { body: 'Nội dung bí mật 12345' });
    const audit = await prisma.auditEvent.findMany({ where: { entityId: taskId, action: 'COMMENT' } });
    assert.ok(audit.length > 0);
    assert.ok(!JSON.stringify(audit).includes('Nội dung bí mật 12345'));
    assert.ok(audit.some((a) => (a.afterData as { commentId?: string })?.commentId === c.id));
  });

  test('chỉ tác giả được sửa; sửa đặt editedAt', async () => {
    const c = await createTaskComment(session('collab'), taskId, { body: 'Bản đầu' });
    await assert.rejects(updateTaskComment(session('dri'), taskId, c.id, { body: 'Sửa hộ' }), forbidden);
    const edited = await updateTaskComment(session('collab'), taskId, c.id, { body: 'Bản sửa' });
    assert.equal(edited.body, 'Bản sửa');
    assert.ok(edited.editedAt);
  });

  test('xóa mềm: ẩn nội dung, giữ bản ghi và dòng Hoạt động (AC-T03-3)', async () => {
    const c = await createTaskComment(session('follower'), taskId, { body: 'Sẽ bị xóa' });
    const auditBefore = await prisma.auditEvent.count({ where: { entityId: taskId } });
    await assert.rejects(deleteTaskComment(session('dri'), taskId, c.id), forbidden);
    await deleteTaskComment(session('follower'), taskId, c.id);

    const row = await prisma.taskComment.findUniqueOrThrow({ where: { id: c.id } });
    assert.ok(row.deletedAt);
    const listed = (await listTaskComments(session('creator'), taskId)).comments.find((x) => x.id === c.id);
    assert.ok(listed);
    assert.equal(listed.deleted, true);
    assert.equal(listed.body, null);
    assert.ok((await prisma.auditEvent.count({ where: { entityId: taskId } })) > auditBefore);
    assert.ok(await prisma.auditEvent.findFirst({ where: { entityId: taskId, action: 'COMMENT' } }));

    await assert.rejects(updateTaskComment(session('follower'), taskId, c.id, { body: 'Hồi sinh' }), NotFoundError);
  });

  test('không bình luận trên nhiệm vụ đã lưu trữ', async () => {
    await prisma.task.update({ where: { id: taskId }, data: { archivedAt: new Date() } });
    try {
      await assert.rejects(createTaskComment(session('dri'), taskId, { body: 'Muộn rồi' }), ApiError);
    } finally {
      await prisma.task.update({ where: { id: taskId }, data: { archivedAt: null } });
    }
  });
});
