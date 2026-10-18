/**
 * Nhắc tên người cùng đơn vị trong bình luận nhiệm vụ (người dùng chốt 13/10/2026):
 * gợi ý cả người cùng đơn vị với người viết; nhắc người chưa có vai trò thì thêm làm người theo dõi.
 * Chạy trên qcet_test và chỉ xóa bản ghi do test tạo.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { AssignmentStatus, JobCatalogGroup, TaskActorRole, TaskStatus, UnitType } from '@prisma/client';
import { prisma } from '@qcet/db/prisma';
import { createTaskComment, listTaskComments } from '../src/server/tasks/task-comment-service';
import { ApiError } from '../src/server/api/errors';

const runId = `t03m_${Date.now()}`;
const u: Record<string, string> = {};
const unit: Record<string, string> = {};
let taskId = '';
let positionId = '';
let createdPosition = false;

const session = (key: string) => ({ id: u[key], email: `${key}@x`, name: key, role: 'CHUYEN_VIEN' });
const forbidden = (err: unknown) => err instanceof ApiError && err.statusCode === 403;

describe('Nhắc tên người cùng đơn vị', () => {
  before(async () => {
    for (const key of ['dri', 'mate', 'formerMate', 'outsider']) {
      u[key] = (await prisma.user.create({ data: { email: `${runId}_${key}@cdktcnqn.edu.vn`, name: `${runId} ${key}` } })).id;
    }
    for (const key of ['A', 'B']) {
      unit[key] = (await prisma.organizationalUnit.create({ data: { code: `${runId}_${key}`.slice(0, 50), name: `Đơn vị ${key} ${runId}`, type: UnitType.DEPARTMENT } })).id;
    }
    const existing = await prisma.positionDefinition.findUnique({ where: { code: 'CHUYEN_VIEN' } });
    positionId = existing?.id ?? (await prisma.positionDefinition.create({ data: { code: 'CHUYEN_VIEN', title: 'CHUYEN_VIEN', group: JobCatalogGroup.HTPV } })).id;
    createdPosition = !existing;
    const from = new Date('2020-01-01T00:00:00Z');
    const assign = (userId: string, unitId: string, effectiveTo?: Date) =>
      prisma.positionAssignment.create({ data: { userId, positionDefinitionId: positionId, unitId, status: AssignmentStatus.ACTIVE, effectiveFrom: from, effectiveTo } });
    await assign(u.dri, unit.A);
    await assign(u.mate, unit.A);
    await assign(u.formerMate, unit.A, new Date('2021-01-01T00:00:00Z')); // đã chuyển đi
    await assign(u.outsider, unit.B);

    taskId = (
      await prisma.task.create({
        data: {
          code: runId.slice(0, 50),
          title: 'Nhắc tên cùng đơn vị',
          academicMonth: 10,
          academicYear: '2026-2027',
          dueDate: new Date('2026-10-30T00:00:00+07:00'),
          createdById: u.dri,
          status: TaskStatus.IN_PROGRESS,
          actors: { create: [{ userId: u.dri, role: TaskActorRole.DRI, isPrimaryDRI: true }] },
        },
      })
    ).id;
  });

  after(async () => {
    const ids = Object.values(u);
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: taskId } });
    await prisma.auditEvent.deleteMany({ where: { entityId: taskId } });
    if (taskId) await prisma.task.delete({ where: { id: taskId } });
    await prisma.positionAssignment.deleteMany({ where: { userId: { in: ids } } });
    if (createdPosition) await prisma.positionDefinition.delete({ where: { id: positionId } });
    await prisma.organizationalUnit.deleteMany({ where: { id: { in: Object.values(unit) } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  test('gợi ý người cùng đơn vị đang công tác (đánh dấu chưa có vai trò); không gợi ý người đơn vị khác hoặc đã chuyển đi', async () => {
    const { participants } = await listTaskComments(session('dri'), taskId);
    const mate = participants.find((p) => p.id === u.mate);
    assert.equal(mate?.inTask, false);
    assert.ok(!participants.some((p) => p.id === u.outsider));
    assert.ok(!participants.some((p) => p.id === u.formerMate));
    assert.ok(!participants.some((p) => p.id === u.dri), 'không gợi ý chính mình');
  });

  test('nhắc người cùng đơn vị: thêm làm người theo dõi, ghi nhật ký, gửi thông báo; người ngoài đơn vị bị bỏ qua', async () => {
    await assert.rejects(listTaskComments(session('mate'), taskId), forbidden, 'trước khi được nhắc chưa xem được');
    const versionBefore = (await prisma.task.findUniqueOrThrow({ where: { id: taskId } })).version;

    await createTaskComment(session('dri'), taskId, {
      body: `@${runId} mate và @${runId} outsider xem giúp`,
      mentionUserIds: [u.mate, u.outsider],
    });

    const actors = await prisma.taskActor.findMany({ where: { taskId, userId: { in: [u.mate, u.outsider] } } });
    assert.deepEqual(actors.map((a) => [a.userId, a.role]), [[u.mate, TaskActorRole.FOLLOWER]]);
    assert.ok(await prisma.auditEvent.findFirst({ where: { entityId: taskId, action: 'TASK_PERSON_ADDED' } }));
    const event = await prisma.outboxEvent.findFirst({ where: { aggregateId: taskId, eventType: 'TASK_COMMENT_MENTION_NOTIFICATION' } });
    assert.deepEqual((event?.payload as { mentionedUserIds: string[] }).mentionedUserIds, [u.mate]);
    assert.equal((await prisma.task.findUniqueOrThrow({ where: { id: taskId } })).version, versionBefore, 'không làm form khác báo xung đột');

    const { participants } = await listTaskComments(session('mate'), taskId);
    assert.ok(participants.some((p) => p.id === u.dri && p.inTask));

    // Nhắc lại không thêm trùng
    await createTaskComment(session('dri'), taskId, { body: `@${runId} mate lần nữa`, mentionUserIds: [u.mate] });
    assert.equal(await prisma.taskActor.count({ where: { taskId, userId: u.mate } }), 1);
  });
});
