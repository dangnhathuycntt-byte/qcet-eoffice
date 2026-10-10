/**
 * T-12 (spec task-document-gap-spec.md): giao việc sang đơn vị khác qua trưởng đơn vị.
 * Chạy trên qcet_test và chỉ xóa bản ghi do test tạo.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { AssignmentStatus, JobCatalogGroup, TaskActorRole, TaskScope, TaskStatus, UnitType } from '@prisma/client';
import { ZodError } from 'zod';
import { prisma } from '../src/lib/prisma';
import { taskDomainActionService } from '../src/lib/services/task-domain-actions';
import {
  createTaskUnitRequest,
  decideTaskUnitRequest,
  listTaskUnitRequests,
  listUnitRequestInbox,
} from '../src/server/tasks/task-unit-request-service';
import { runOutboxCycle } from '../src/server/outbox/outbox-worker';
import { scanTaskReminders } from '../src/server/tasks/task-reminder-scanner';
import { ApiError, ConflictError } from '../src/server/api/errors';

const runId = `t12_${Date.now()}`;
const u: Record<string, string> = {};
const unit: Record<string, string> = {};
const tasks: string[] = [];
const createdPositions: string[] = [];

const session = (key: string) => ({ id: u[key], email: `${key}@x`, name: key, role: 'CHUYEN_VIEN' });
const forbidden = (err: unknown) => err instanceof ApiError && err.statusCode === 403;
const code = (c: string) => (err: unknown) => err instanceof ApiError && err.code === c;

async function ensurePosition(positionCode: string, group: JobCatalogGroup) {
  const existing = await prisma.positionDefinition.findUnique({ where: { code: positionCode } });
  if (existing) return existing.id;
  const created = await prisma.positionDefinition.create({ data: { code: positionCode, title: positionCode, group, isLeadership: group === JobCatalogGroup.LDPU } });
  createdPositions.push(created.id);
  return created.id;
}

async function makeTask(key: string) {
  const task = await prisma.task.create({
    data: {
      code: `${runId}_${key}`.slice(0, 50),
      title: `Nhiệm vụ ${key}`,
      academicMonth: 10,
      academicYear: '2026-2027',
      dueDate: new Date('2026-12-30T00:00:00+07:00'),
      createdById: u.assigner,
      leadUnitId: unit.A,
      scope: TaskScope.DEPARTMENT,
      status: TaskStatus.IN_PROGRESS,
      actors: {
        create: [
          { userId: u.assigner, role: TaskActorRole.ASSIGNER },
          { userId: u.dri, unitId: unit.A, role: TaskActorRole.DRI, isPrimaryDRI: true },
        ],
      },
    },
  });
  tasks.push(task.id);
  return task.id;
}

describe('T-12 giao việc liên đơn vị qua trưởng đơn vị', () => {
  before(async () => {
    for (const key of ['assigner', 'dri', 'staffA', 'headB', 'staffB', 'headC', 'outsiderC']) {
      const user = await prisma.user.create({ data: { email: `${runId}_${key}@cdktcnqn.edu.vn`, name: `${runId} ${key}` } });
      u[key] = user.id;
    }
    for (const key of ['A', 'B', 'C']) {
      unit[key] = (await prisma.organizationalUnit.create({ data: { code: `${runId}_${key}`.slice(0, 50), name: `Đơn vị ${key} ${runId}`, type: UnitType.DEPARTMENT } })).id;
    }
    const head = await ensurePosition('TRUONG_DON_VI', JobCatalogGroup.LDPU);
    const staff = await ensurePosition('CHUYEN_VIEN', JobCatalogGroup.HTPV);
    const from = new Date('2020-01-01T00:00:00Z');
    const assign = (userId: string, unitKey: string, positionId: string) =>
      prisma.positionAssignment.create({ data: { userId, positionDefinitionId: positionId, unitId: unit[unitKey], status: AssignmentStatus.ACTIVE, effectiveFrom: from } });
    await assign(u.assigner, 'A', head);
    await assign(u.dri, 'A', staff);
    await assign(u.staffA, 'A', staff);
    await assign(u.headB, 'B', head);
    await assign(u.staffB, 'B', staff);
    await assign(u.headC, 'C', head);
    await assign(u.outsiderC, 'C', staff);
  });

  after(async () => {
    const ids = Object.values(u);
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: tasks } } });
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: tasks } } });
    await prisma.task.deleteMany({ where: { id: { in: tasks } } });
    await prisma.positionAssignment.deleteMany({ where: { userId: { in: ids } } });
    if (createdPositions.length) await prisma.positionDefinition.deleteMany({ where: { id: { in: createdPositions } } });
    await prisma.organizationalUnit.deleteMany({ where: { id: { in: Object.values(unit) } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  test('thêm người phối hợp trực tiếp chỉ trong đơn vị chủ trì; theo dõi thì không giới hạn (AC-T12-1)', async () => {
    const id = await makeTask('direct');
    let version = (await prisma.task.findUniqueOrThrow({ where: { id } })).version;
    await assert.rejects(
      taskDomainActionService.addPerson(session('assigner'), id, { userId: u.staffB, role: 'COLLABORATOR', expectedVersion: version }),
      code('CROSS_UNIT_REQUIRES_UNIT_HEAD')
    );
    const same = await taskDomainActionService.addPerson(session('assigner'), id, { userId: u.staffA, role: 'COLLABORATOR', expectedVersion: version });
    assert.equal(same.changed, true);
    version = same.version;
    const follower = await taskDomainActionService.addPerson(session('assigner'), id, { userId: u.staffB, role: 'FOLLOWER', expectedVersion: version });
    assert.equal(follower.changed, true, 'người theo dõi ở đơn vị khác vẫn thêm được');
  });

  test('chỉ người giao gửi yêu cầu; không gửi cho đơn vị chủ trì; một yêu cầu chờ mỗi đơn vị', async () => {
    const id = await makeTask('create');
    for (const key of ['dri', 'outsiderC', 'headB']) {
      await assert.rejects(createTaskUnitRequest(session(key), id, { targetUnitId: unit.B }), (e: unknown) => e instanceof ApiError && [403, 404].includes(e.statusCode), key);
    }
    await assert.rejects(createTaskUnitRequest(session('assigner'), id, { targetUnitId: unit.A }), code('UNIT_REQUEST_LEAD_UNIT'));
    await assert.rejects(createTaskUnitRequest(session('assigner'), id, { targetUnitId: 'khong-ton-tai' }), ApiError);
    await assert.rejects(createTaskUnitRequest(session('assigner'), id, {} as never), ZodError);

    const first = await createTaskUnitRequest(session('assigner'), id, { targetUnitId: unit.B, note: 'Cần người hỗ trợ số liệu' });
    assert.equal(first.status, 'PENDING');
    assert.equal(first.canCancel, true);
    await assert.rejects(createTaskUnitRequest(session('assigner'), id, { targetUnitId: unit.B }), code('UNIT_REQUEST_PENDING'));

    const id2 = await makeTask('race');
    const results = await Promise.allSettled([
      createTaskUnitRequest(session('assigner'), id2, { targetUnitId: unit.B }),
      createTaskUnitRequest(session('assigner'), id2, { targetUnitId: unit.B }),
    ]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1, 'yêu cầu đồng thời chỉ một bên được tạo');
    assert.equal(await prisma.taskUnitRequest.count({ where: { taskId: id2, status: 'PENDING' } }), 1);
  });

  test('trưởng đơn vị được yêu cầu cử người của đơn vị mình làm người phối hợp (AC-T12-2)', async () => {
    const id = await makeTask('assign');
    const req = await createTaskUnitRequest(session('assigner'), id, { targetUnitId: unit.B, note: 'Hỗ trợ' });
    const version = (await prisma.task.findUniqueOrThrow({ where: { id } })).version;

    // Không phải trưởng đơn vị được yêu cầu.
    for (const key of ['staffB', 'headC', 'outsiderC', 'dri']) {
      await assert.rejects(decideTaskUnitRequest(session(key), id, { requestId: req.id, decision: 'ASSIGN', assigneeUserId: u.staffB }), forbidden, key);
    }
    // Người được cử phải thuộc đơn vị B.
    await assert.rejects(decideTaskUnitRequest(session('headB'), id, { requestId: req.id, decision: 'ASSIGN', assigneeUserId: u.staffA }), code('UNIT_REQUEST_ASSIGNEE_NOT_IN_UNIT'));
    await assert.rejects(decideTaskUnitRequest(session('headB'), id, { requestId: req.id, decision: 'ASSIGN' } as never), ZodError);
    assert.equal((await prisma.taskUnitRequest.findUniqueOrThrow({ where: { id: req.id } })).status, 'PENDING', 'lỗi không làm đổi trạng thái');

    const done = await decideTaskUnitRequest(session('headB'), id, { requestId: req.id, decision: 'ASSIGN', assigneeUserId: u.staffB });
    assert.equal(done.status, 'ASSIGNED');
    assert.equal(done.assignee?.id, u.staffB);
    const actor = await prisma.taskActor.findFirstOrThrow({ where: { taskId: id, userId: u.staffB } });
    assert.equal(actor.role, TaskActorRole.COLLABORATOR);
    assert.equal(actor.unitId, unit.B);
    assert.equal((await prisma.task.findUniqueOrThrow({ where: { id } })).version, version + 1);
    assert.ok(await prisma.auditEvent.findFirst({ where: { entityId: id, action: 'TASK_UNIT_REQUEST_DECIDED' } }));
    await assert.rejects(decideTaskUnitRequest(session('headB'), id, { requestId: req.id, decision: 'DECLINE', note: 'Đổi ý' }), (e: unknown) => e instanceof ConflictError && e.code === 'UNIT_REQUEST_CLOSED');
  });

  test('từ chối phải có lý do; người gửi rút lại được, người khác thì không', async () => {
    const id = await makeTask('decline');
    const req = await createTaskUnitRequest(session('assigner'), id, { targetUnitId: unit.B });
    await assert.rejects(decideTaskUnitRequest(session('headB'), id, { requestId: req.id, decision: 'DECLINE' }), ZodError);
    const declined = await decideTaskUnitRequest(session('headB'), id, { requestId: req.id, decision: 'DECLINE', note: 'Đơn vị đang kín lịch' });
    assert.equal(declined.status, 'DECLINED');
    assert.equal(declined.decisionNote, 'Đơn vị đang kín lịch');
    assert.equal(await prisma.taskActor.count({ where: { taskId: id, userId: u.staffB } }), 0, 'từ chối không thêm ai');

    const again = await createTaskUnitRequest(session('assigner'), id, { targetUnitId: unit.B });
    await assert.rejects(decideTaskUnitRequest(session('headB'), id, { requestId: again.id, decision: 'CANCEL' }), forbidden);
    const cancelled = await decideTaskUnitRequest(session('assigner'), id, { requestId: again.id, decision: 'CANCEL' });
    assert.equal(cancelled.status, 'CANCELLED');
    await createTaskUnitRequest(session('assigner'), id, { targetUnitId: unit.B }); // gửi lại được sau khi rút
  });

  test('hộp thư của trưởng đơn vị chỉ có yêu cầu gửi cho đơn vị mình; danh sách báo quyền từng người', async () => {
    const id = await makeTask('inbox');
    const req = await createTaskUnitRequest(session('assigner'), id, { targetUnitId: unit.B, note: 'Cần người' });

    const inboxB = await listUnitRequestInbox(session('headB'));
    const mine = inboxB.find((r) => r.id === req.id);
    assert.ok(mine, 'trưởng đơn vị B thấy');
    assert.equal(mine?.task.title, 'Nhiệm vụ inbox', 'thấy đủ thông tin để quyết định dù chưa đọc được nhiệm vụ');
    assert.equal((await listUnitRequestInbox(session('headC'))).some((r) => r.id === req.id), false);
    assert.equal((await listUnitRequestInbox(session('staffB'))).length, 0, 'nhân viên thường không có hộp thư');

    const asAssigner = await listTaskUnitRequests(session('assigner'), id);
    assert.equal(asAssigner.canRequest, true);
    assert.equal(asAssigner.requests[0].canCancel, true);
    assert.equal(asAssigner.requests[0].canFulfill, false);
    const asDri = await listTaskUnitRequests(session('dri'), id);
    assert.equal(asDri.canRequest, false);
  });

  test('hạn trả lời: mặc định 3 ngày; quá hạn thì nhắc trưởng đơn vị và báo người giao, đúng một lần (T-12)', async () => {
    const id = await makeTask('respond');
    const req = await createTaskUnitRequest(session('assigner'), id, { targetUnitId: unit.B });
    const days = (new Date(req.respondBy as string).getTime() - Date.now()) / 86_400_000;
    assert.ok(days > 2.99 && days <= 3, `hạn mặc định 3 ngày, got ${days}`);
    assert.equal(req.overdue, false);
    const custom = await createTaskUnitRequest(session('assigner'), await makeTask('respond2'), { targetUnitId: unit.B, respondInDays: 7 });
    assert.ok((new Date(custom.respondBy as string).getTime() - Date.now()) / 86_400_000 > 6.99);

    const early = await scanTaskReminders({ now: new Date(Date.now() + 2 * 86_400_000), taskIds: [id] });
    assert.equal(early.sent.UNIT_REQUEST_OVERDUE ?? 0, 0, 'chưa tới hạn thì chưa nhắc');

    const late = new Date(Date.now() + 4 * 86_400_000);
    const first = await scanTaskReminders({ now: late, taskIds: [id] });
    assert.equal(first.sent.UNIT_REQUEST_OVERDUE, 1);
    assert.equal(first.sent.UNIT_REQUEST_OVERDUE_ASSIGNER, 1);
    assert.equal(await prisma.notification.count({ where: { userId: u.headB, type: 'unit_request', linkHref: '/tasks/unit-requests' } }) >= 1, true);
    assert.equal(await prisma.notification.count({ where: { userId: u.assigner, type: 'escalation' } }) >= 1, true);

    const again = await scanTaskReminders({ now: late, taskIds: [id] });
    assert.equal(again.sent.UNIT_REQUEST_OVERDUE ?? 0, 0, 'không nhắc lặp');

    await decideTaskUnitRequest(session('headB'), id, { requestId: req.id, decision: 'ASSIGN', assigneeUserId: u.staffB });
    const afterAnswer = await scanTaskReminders({ now: new Date(late.getTime() + 86_400_000), taskIds: [id] });
    assert.equal(afterAnswer.sent.UNIT_REQUEST_OVERDUE ?? 0, 0, 'đã trả lời thì không nhắc');
  });

  test('thông báo qua outbox: trưởng đơn vị nhận yêu cầu, người gửi nhận phản hồi', async () => {
    const id = await makeTask('notify');
    const headBBefore = await prisma.notification.count({ where: { userId: u.headB, type: 'unit_request' } });
    const req = await createTaskUnitRequest(session('assigner'), id, { targetUnitId: unit.B, note: 'Hỗ trợ số liệu' });
    const requested = await prisma.outboxEvent.findFirstOrThrow({ where: { aggregateId: id, eventType: 'TASK_UNIT_REQUESTED_NOTIFICATION' } });
    await runOutboxCycle(prisma, { ids: [requested.id] });
    assert.equal(await prisma.notification.count({ where: { userId: u.headB, type: 'unit_request' } }), headBBefore + 1);
    assert.equal(await prisma.notification.count({ where: { userId: u.headC, type: 'unit_request' } }), 0);

    await decideTaskUnitRequest(session('headB'), id, { requestId: req.id, decision: 'ASSIGN', assigneeUserId: u.staffB });
    const decided = await prisma.outboxEvent.findFirstOrThrow({ where: { aggregateId: id, eventType: 'TASK_UNIT_REQUEST_DECIDED_NOTIFICATION' } });
    await runOutboxCycle(prisma, { ids: [decided.id] });
    const notice = await prisma.notification.findFirstOrThrow({ where: { userId: u.assigner, type: 'unit_request_decided' } });
    assert.match(notice.body, /cử/);
  });
});
