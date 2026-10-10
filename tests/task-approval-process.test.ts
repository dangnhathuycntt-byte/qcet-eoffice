/**
 * T-05 (spec task-document-gap-spec.md): lập và chạy luồng duyệt nhiều bước.
 * Chạy trên qcet_test; chỉ quét các nhiệm vụ do test tạo và chỉ xóa bản ghi của test.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ApprovalProcessStatus, ApprovalStepStatus, TaskActorRole, TaskStatus } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { taskDomainActionService } from '../src/lib/services/task-domain-actions';
import { scanTaskReminders } from '../src/server/tasks/task-reminder-scanner';
import { authorizeOnTask } from '../src/server/tasks/authorize-on-task';
import { defineApprovalProcess, getApprovalProcess } from '../src/server/tasks/task-approval-process-service';
import { NextRequest } from 'next/server';
import { taskQueryService } from '../src/server/tasks';
import { signSessionToken, SESSION_COOKIE_NAME } from '../src/lib/jwt-session';
import { POST as approveRoute } from '../src/app/api/tasks/[id]/actions/approve/route';
import { runOutboxCycle } from '../src/server/outbox/outbox-worker';
import { ApiError } from '../src/server/api/errors';

const runId = `t05p_${Date.now()}`;
const u: Record<string, string> = {};
const tasks: string[] = [];
const HOUR = 3_600_000;

const session = (key: string) => ({ id: u[key], email: `${key}@x`, name: key, role: 'CHUYEN_VIEN' });
const forbidden = (err: unknown) => err instanceof ApiError && err.statusCode === 403;
const code = (c: string) => (err: unknown) => err instanceof ApiError && err.code === c;
const stepOf = async (taskId: string) => (await getApprovalProcess(session('creator'), taskId)).process?.steps.find((s) => s.current)?.id;
const canReview = (key: string, taskId: string) => authorizeOnTask(session(key), taskId, 'task.review').then(() => true, () => false);
const markedActors = (taskId: string) => prisma.taskActor.findMany({ where: { taskId, notes: { startsWith: 'Bước duyệt:' } } });

async function makeWaitingTask(key: string, status: TaskStatus = TaskStatus.WAITING_APPROVAL) {
  const task = await prisma.task.create({
    data: {
      code: `${runId}_${key}`.slice(0, 50),
      title: `Nhiệm vụ ${key}`,
      academicMonth: 10,
      academicYear: '2026-2027',
      dueDate: new Date('2026-12-30T00:00:00+07:00'),
      createdById: u.creator,
      status,
      actors: {
        create: [
          { userId: u.dri, role: TaskActorRole.DRI, isPrimaryDRI: true },
          { userId: u.collab, role: TaskActorRole.COLLABORATOR },
        ],
      },
    },
  });
  await prisma.taskResult.create({ data: { taskId: task.id, submittedByUserId: u.dri, summary: 'Xong' } });
  tasks.push(task.id);
  return task.id;
}

const twoSteps = () => [
  { title: 'Trưởng đơn vị duyệt', reviewerUserId: u.head },
  { title: 'Lãnh đạo duyệt', reviewerUserId: u.exec, backupReviewerUserId: u.backup },
];

describe('T-05 luồng duyệt nhiều bước', () => {
  before(async () => {
    for (const key of ['creator', 'dri', 'collab', 'head', 'exec', 'backup', 'stranger']) {
      u[key] = (await prisma.user.create({ data: { email: `${runId}_${key}@cdktcnqn.edu.vn`, name: `${runId} ${key}` } })).id;
    }
  });

  after(async () => {
    const ids = Object.values(u);
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: tasks } } });
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: tasks } } });
    await prisma.taskReminderLog.deleteMany({ where: { taskId: { in: tasks } } });
    await prisma.task.deleteMany({ where: { id: { in: tasks } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  test('chỉ người giao lập luồng, nhiệm vụ phải đang chờ duyệt, người duyệt chịu N4', async () => {
    const id = await makeWaitingTask('define');
    for (const key of ['dri', 'collab', 'stranger']) {
      await assert.rejects(defineApprovalProcess(session(key), id, { steps: twoSteps() }), forbidden, key);
    }
    for (const [candidate, expected] of [['creator', 'APPROVAL_SAME_AS_CREATOR'], ['dri', 'APPROVAL_IS_EXECUTOR'], ['collab', 'APPROVAL_IS_EXECUTOR']] as const) {
      await assert.rejects(
        defineApprovalProcess(session('creator'), id, { steps: [{ title: 'B1', reviewerUserId: u[candidate] }] }),
        code(expected),
        candidate
      );
    }
    await assert.rejects(
      defineApprovalProcess(session('creator'), id, { steps: [{ title: 'B1', reviewerUserId: u.head, backupReviewerUserId: u.head }] }),
      code('APPROVAL_BACKUP_SAME')
    );
    await assert.rejects(defineApprovalProcess(session('creator'), id, { steps: [] }));
    await assert.rejects(defineApprovalProcess(session('creator'), id, { steps: Array.from({ length: 6 }, (_, i) => ({ title: `B${i}`, reviewerUserId: u.head })) }));
    assert.equal(await prisma.taskApprovalProcess.count({ where: { taskId: id } }), 0, 'lỗi thì không tạo luồng');

    const notWaiting = await makeWaitingTask('notwaiting', TaskStatus.IN_PROGRESS);
    await assert.rejects(defineApprovalProcess(session('creator'), notWaiting, { steps: twoSteps() }), code('APPROVAL_PROCESS_NOT_WAITING'));
  });

  test('lập luồng: người của bước 1 có quyền duyệt, bước 2 chưa; không lập hai luồng cùng lúc', async () => {
    const id = await makeWaitingTask('run');
    assert.equal((await getApprovalProcess(session('creator'), id)).canDefine, true);
    const view = await defineApprovalProcess(session('creator'), id, { steps: twoSteps() });
    assert.equal(view.process?.status, ApprovalProcessStatus.IN_REVIEW);
    assert.deepEqual(view.process?.steps.map((s) => [s.order, s.current]), [[1, true], [2, false]]);
    assert.equal(view.canDefine, false);
    assert.equal(await canReview('head', id), true);
    assert.equal(await canReview('exec', id), false, 'chưa tới bước 2');
    assert.equal(await canReview('backup', id), false);
    await assert.rejects(defineApprovalProcess(session('creator'), id, { steps: twoSteps() }), code('APPROVAL_PROCESS_RUNNING'));
    assert.ok(await prisma.auditEvent.findFirst({ where: { entityId: id, action: 'TASK_APPROVAL_PROCESS_DEFINED' } }));

    const event = await prisma.outboxEvent.findFirstOrThrow({ where: { aggregateId: id, eventType: 'TASK_REMINDER_NOTIFICATION' } });
    await runOutboxCycle(prisma, { ids: [event.id] });
    const notice = await prisma.notification.findFirstOrThrow({ where: { userId: u.head, type: 'reminder' } });
    assert.match(notice.body, /Đến lượt bạn duyệt/);
  });

  test('duyệt lần lượt không cần gửi stepId; xong bước cuối thì nhiệm vụ hoàn thành và quyền được gỡ', async () => {
    const id = await makeWaitingTask('flow');
    await defineApprovalProcess(session('creator'), id, { steps: twoSteps() });

    await assert.rejects(taskDomainActionService.review(session('exec'), id, { stepId: await stepOf(id), decision: 'APPROVED' }), forbidden, 'bước 2 chưa tới lượt');

    await taskDomainActionService.review(session('head'), id, { stepId: await stepOf(id), decision: 'APPROVED', note: 'Đồng ý' });
    assert.equal((await prisma.task.findUniqueOrThrow({ where: { id } })).status, TaskStatus.WAITING_APPROVAL, 'còn bước 2');
    assert.equal(await canReview('head', id), false, 'bước 1 qua thì gỡ quyền');
    assert.equal(await canReview('exec', id), true, 'đến lượt bước 2');
    assert.deepEqual((await markedActors(id)).map((a) => a.userId), [u.exec]);

    await taskDomainActionService.review(session('exec'), id, { stepId: await stepOf(id), decision: 'APPROVED' });
    const task = await prisma.task.findUniqueOrThrow({ where: { id } });
    assert.equal(task.status, TaskStatus.COMPLETED);
    const process = await prisma.taskApprovalProcess.findFirstOrThrow({ where: { taskId: id }, include: { steps: true } });
    assert.equal(process.status, ApprovalProcessStatus.APPROVED);
    assert.ok(process.steps.every((s) => s.status === ApprovalStepStatus.APPROVED));
    assert.equal((await markedActors(id)).length, 0, 'hết luồng thì không còn dấu quyền');
  });

  test('người duyệt của bước duyệt được qua route approve: cổng route nhận ra vai trò REVIEWER và SoD không coi họ là người thực hiện', async () => {
    const id = await makeWaitingTask('sod');
    await defineApprovalProcess(session('creator'), id, { steps: twoSteps() });
    await taskDomainActionService.review(session('head'), id, { stepId: await stepOf(id), decision: 'APPROVED' });

    const dto = await taskQueryService.getTaskById(id);
    assert.equal((dto?.task as { assignees?: Array<{ id: string }> }).assignees?.some((a) => a.id === u.exec), false, 'DTO không liệt kê người duyệt là người thực hiện');

    const version = (await prisma.task.findUniqueOrThrow({ where: { id } })).version;
    const call = (key: string, stepId?: string) =>
      approveRoute(
        new NextRequest(`http://localhost:3000/api/tasks/${id}/actions/approve`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: 'http://localhost:3000',
            cookie: `${SESSION_COOKIE_NAME}=${signSessionToken({ id: u[key], email: `${key}@x`, name: key, role: 'CHUYEN_VIEN' })}`,
          },
          body: JSON.stringify({ expectedVersion: version, ...(stepId ? { stepId } : {}) }),
        }),
        { params: Promise.resolve({ id }) }
      );
    assert.equal((await call('stranger', await stepOf(id))).status, 403, 'người ngoài luồng bị chặn ở cổng route');
    const res = await call('exec', await stepOf(id));
    assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
    assert.equal((await prisma.task.findUniqueOrThrow({ where: { id } })).status, TaskStatus.COMPLETED);
  });

  test('từ chối hoặc yêu cầu làm lại ở một bước đóng luồng và trả nhiệm vụ về đang thực hiện', async () => {
    const rejected = await makeWaitingTask('reject');
    await defineApprovalProcess(session('creator'), rejected, { steps: twoSteps() });
    await taskDomainActionService.review(session('head'), rejected, { stepId: await stepOf(rejected), decision: 'REJECTED', note: 'Chưa đạt' });
    assert.equal((await prisma.task.findUniqueOrThrow({ where: { id: rejected } })).status, TaskStatus.IN_PROGRESS);
    assert.equal((await prisma.taskApprovalProcess.findFirstOrThrow({ where: { taskId: rejected } })).status, ApprovalProcessStatus.REJECTED);
    assert.equal((await markedActors(rejected)).length, 0);

    const revised = await makeWaitingTask('revise');
    await defineApprovalProcess(session('creator'), revised, { steps: twoSteps() });
    const version = (await prisma.task.findUniqueOrThrow({ where: { id: revised } })).version;
    await taskDomainActionService.requestRevision(session('head'), revised, { reason: 'Bổ sung số liệu', expectedVersion: version });
    assert.equal((await prisma.task.findUniqueOrThrow({ where: { id: revised } })).status, TaskStatus.IN_PROGRESS);
    const process = await prisma.taskApprovalProcess.findFirstOrThrow({ where: { taskId: revised }, include: { steps: { orderBy: { stepOrder: 'asc' } } } });
    assert.equal(process.status, ApprovalProcessStatus.REJECTED);
    assert.equal(process.steps[0].status, ApprovalStepStatus.REJECTED);
    assert.equal(process.steps[0].decisionNote, 'Bổ sung số liệu');
    assert.equal((await markedActors(revised)).length, 0);
  });

  test('người dự phòng của bước nhận quyền và được báo đúng một lần khi bước chờ đủ 96 giờ', async () => {
    const id = await makeWaitingTask('backup');
    // Bước 1 duyệt xong thì bước 2 (có người dự phòng) bắt đầu chờ.
    await defineApprovalProcess(session('creator'), id, { steps: twoSteps() });
    await taskDomainActionService.review(session('head'), id, { stepId: await stepOf(id), decision: 'APPROVED' });
    const decidedAt = new Date(Date.now() - 100 * HOUR);
    await prisma.taskApprovalStep.updateMany({ where: { process: { taskId: id }, stepOrder: 1 }, data: { decidedAt } });

    assert.equal(await canReview('backup', id), false, 'chưa quét thì chưa có quyền');
    const early = await scanTaskReminders({ now: new Date(decidedAt.getTime() + 95 * HOUR), taskIds: [id] });
    assert.equal(early.sent.BACKUP_REVIEWER_ACTIVATED ?? 0, 0);
    assert.equal(await canReview('backup', id), false);

    const due = await scanTaskReminders({ now: new Date(decidedAt.getTime() + 96 * HOUR), taskIds: [id] });
    assert.equal(due.sent.BACKUP_REVIEWER_ACTIVATED, 1);
    assert.equal(await canReview('backup', id), true);
    assert.equal((await getApprovalProcess(session('creator'), id, new Date(decidedAt.getTime() + 96 * HOUR))).process?.steps[1].backupDue, true);
    const again = await scanTaskReminders({ now: new Date(decidedAt.getTime() + 97 * HOUR), taskIds: [id] });
    assert.equal(again.sent.BACKUP_REVIEWER_ACTIVATED ?? 0, 0);
    assert.equal((await markedActors(id)).filter((a) => a.userId === u.backup).length, 1);

    await taskDomainActionService.review(session('backup'), id, { stepId: await stepOf(id), decision: 'APPROVED', note: 'Duyệt thay' });
    const step2 = await prisma.taskApprovalStep.findFirstOrThrow({ where: { process: { taskId: id }, stepOrder: 2 } });
    assert.equal(step2.status, ApprovalStepStatus.APPROVED);
    assert.equal(step2.reviewerUserId, u.backup, 'ghi người thực sự duyệt');
    assert.equal((await prisma.task.findUniqueOrThrow({ where: { id } })).status, TaskStatus.COMPLETED);
    assert.equal(await canReview('backup', id), false, 'xong thì gỡ quyền');
  });
});
