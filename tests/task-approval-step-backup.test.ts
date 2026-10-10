/**
 * T-05 (D12, spec task-document-gap-spec.md): người duyệt dự phòng theo từng bước của luồng duyệt nhiều bước.
 * Chạy trên qcet_test và chỉ xóa bản ghi do test tạo.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ApprovalStepStatus, TaskActorRole, UnitType, UserRole } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import {
  executeApprovalStep,
  initiateApprovalProcess,
  SegregationOfDutiesError,
  TaskActorAuthorizationError,
} from '../src/lib/services/task-actor-service';

const runId = `t05s_${Date.now()}`;
const u: Record<string, string> = {};
let unitId = '';
const tasks: string[] = [];
const HOUR = 3600_000;

async function makeTask(key: string) {
  const task = await prisma.task.create({
    data: { code: `${runId}_${key}`.slice(0, 50), title: `Nhiệm vụ ${key}`, createdById: u.creator, leadUnitId: unitId, academicMonth: 10, academicYear: '2026-2027', dueDate: new Date('2026-12-31') },
  });
  tasks.push(task.id);
  await prisma.taskActor.createMany({
    data: [
      { taskId: task.id, userId: u.creator, role: TaskActorRole.ASSIGNER, isPrimaryDRI: false },
      { taskId: task.id, userId: u.dri, role: TaskActorRole.DRI, isPrimaryDRI: true },
      { taskId: task.id, userId: u.collab, role: TaskActorRole.COLLABORATOR, isPrimaryDRI: false },
    ],
  });
  return task.id;
}

/** Lùi thời điểm lập luồng duyệt để giả lập bước đã chờ `hours` giờ. */
async function backdate(processId: string, hours: number) {
  await prisma.taskApprovalProcess.update({ where: { id: processId }, data: { createdAt: new Date(Date.now() - hours * HOUR) } });
}

describe('T-05 người duyệt dự phòng theo bước', () => {
  before(async () => {
    for (const [key, role] of [['creator', 'CHUYEN_VIEN'], ['dri', 'CHUYEN_VIEN'], ['collab', 'CHUYEN_VIEN'], ['head', 'TRUONG_PHONG'], ['backup', 'CHUYEN_VIEN'], ['backup2', 'CHUYEN_VIEN'], ['exec', 'BAN_GIAM_HIEU'], ['other', 'CHUYEN_VIEN']] as const) {
      u[key] = (await prisma.user.create({ data: { email: `${runId}_${key}@cdktcnqn.edu.vn`, name: `${runId} ${key}`, role: role as UserRole } })).id;
    }
    unitId = (await prisma.organizationalUnit.create({ data: { code: `${runId}_U`.slice(0, 50), name: 'Đơn vị T-05 bước', type: UnitType.DEPARTMENT } })).id;
  });

  after(async () => {
    await prisma.task.deleteMany({ where: { id: { in: tasks } } });
    await prisma.organizationalUnit.delete({ where: { id: unitId } });
    await prisma.user.deleteMany({ where: { id: { in: Object.values(u) } } });
  });

  test('lập luồng: người dự phòng vi phạm N4 bị từ chối (người tạo, chủ trì, phối hợp, người nộp, trùng người duyệt chính)', async () => {
    const taskId = await makeTask('n4');
    await prisma.taskResult.create({ data: { taskId, submittedByUserId: u.other, summary: 'Báo cáo' } });
    for (const candidate of ['creator', 'dri', 'collab', 'other', 'head']) {
      await assert.rejects(
        initiateApprovalProcess(taskId, [{ title: 'Bước 1', reviewerUserId: u.head, backupReviewerUserId: u[candidate] }]),
        SegregationOfDutiesError,
        candidate
      );
    }
    assert.equal(await prisma.taskApprovalProcess.count({ where: { taskId } }), 0, 'không tạo luồng khi người dự phòng không hợp lệ');
  });

  test('người dự phòng bị chặn trước 96 giờ, duyệt được khi bước chờ đủ 96 giờ', async () => {
    const taskId = await makeTask('due');
    const process = await initiateApprovalProcess(taskId, [{ title: 'Trưởng đơn vị duyệt', reviewerUserId: u.head, backupReviewerUserId: u.backup }]);
    const step = process.steps[0];
    assert.equal(step.backupReviewerUserId, u.backup);

    await backdate(process.id, 95);
    await assert.rejects(executeApprovalStep(step.id, u.backup, 'APPROVED'), TaskActorAuthorizationError);
    assert.equal((await prisma.taskApprovalStep.findUniqueOrThrow({ where: { id: step.id } })).status, ApprovalStepStatus.PENDING);

    // Người khác không phải dự phòng vẫn bị chặn như trước.
    await backdate(process.id, 97);
    await assert.rejects(executeApprovalStep(step.id, u.backup2, 'APPROVED'), TaskActorAuthorizationError);

    const done = await executeApprovalStep(step.id, u.backup, 'APPROVED', 'Duyệt thay');
    assert.equal(done.status, ApprovalStepStatus.APPROVED);
    assert.equal(done.reviewerUserId, u.backup, 'ghi lại người thực sự duyệt');
  });

  test('bước sau tính 96 giờ từ lúc bước trước được quyết, không từ lúc lập luồng', async () => {
    const taskId = await makeTask('multi');
    const process = await initiateApprovalProcess(taskId, [
      { title: 'Bước 1', reviewerUserId: u.head },
      { title: 'Bước 2', reviewerUserId: u.exec, backupReviewerUserId: u.backup2 },
    ]);
    await backdate(process.id, 200);
    await executeApprovalStep(process.steps[0].id, u.head, 'APPROVED');
    // Bước 1 vừa được quyết: bước 2 mới chờ vài giây.
    await assert.rejects(executeApprovalStep(process.steps[1].id, u.backup2, 'APPROVED'), TaskActorAuthorizationError);

    await prisma.taskApprovalStep.update({ where: { id: process.steps[0].id }, data: { decidedAt: new Date(Date.now() - 100 * HOUR) } });
    const done = await executeApprovalStep(process.steps[1].id, u.backup2, 'APPROVED');
    assert.equal(done.status, ApprovalStepStatus.APPROVED);
  });

  test('người dự phòng không vượt được bước trước còn chờ dù đã quá 96 giờ', async () => {
    const taskId = await makeTask('order');
    const process = await initiateApprovalProcess(taskId, [
      { title: 'Bước 1', reviewerUserId: u.head },
      { title: 'Bước 2', reviewerUserId: u.exec, backupReviewerUserId: u.backup },
    ]);
    await backdate(process.id, 200);
    await assert.rejects(executeApprovalStep(process.steps[1].id, u.backup, 'APPROVED'), /Step progression violation/);
  });

  test('N4 kiểm lại lúc duyệt: người dự phòng đã thành người nộp kết quả thì bị chặn', async () => {
    const taskId = await makeTask('late');
    const process = await initiateApprovalProcess(taskId, [{ title: 'Bước 1', reviewerUserId: u.head, backupReviewerUserId: u.backup }]);
    await backdate(process.id, 120);
    await prisma.taskResult.create({ data: { taskId, submittedByUserId: u.backup, summary: 'Nộp thay' } });
    await assert.rejects(executeApprovalStep(process.steps[0].id, u.backup, 'APPROVED'), SegregationOfDutiesError);
  });

  test('không có người dự phòng thì hành vi cũ giữ nguyên: người duyệt chỉ định và lãnh đạo vẫn duyệt được', async () => {
    const taskId = await makeTask('legacy');
    const process = await initiateApprovalProcess(taskId, [{ title: 'Bước 1', reviewerUserId: u.head }]);
    assert.equal(process.steps[0].backupReviewerUserId, null);
    await assert.rejects(executeApprovalStep(process.steps[0].id, u.other, 'APPROVED'), TaskActorAuthorizationError);
    const done = await executeApprovalStep(process.steps[0].id, u.exec, 'APPROVED');
    assert.equal(done.status, ApprovalStepStatus.APPROVED);
  });
});
