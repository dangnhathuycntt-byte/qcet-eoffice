import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { PATCH as patchTask } from '../src/app/api/tasks/[id]/route';
import { POST as postDeliverable, PATCH as patchDeliverable } from '../src/app/api/tasks/[id]/deliverables/route';
import { prisma } from '../src/lib/prisma';
import { signSessionToken, SESSION_COOKIE_NAME } from '../src/lib/jwt-session';
import { TaskStatus, TaskPriority, TaskScope, TaskActorRole, UserRole, UnitType, JobCatalogGroup } from '@prisma/client';
import { buildTaskContext, taskStateMachine } from '../src/domain/tasks/state-machine';

describe('Task FSM & Separation of Duties (SoD) Tests', () => {
  let staffUser: any;
  let leaderUser: any;
  let bghUser: any;
  let staffToken: string;
  let leaderToken: string;
  let bghToken: string;
  let testTaskId: string;
  let testDeliverableId: string;
  let leaderAssignmentId: string;
  const createdTaskIds: string[] = [];

  before(async () => {
    // Find or create test users
    const dept = await prisma.organizationalUnit.findFirst() || await prisma.organizationalUnit.create({
      data: { id: 'TEST_DEPT', code: 'TEST_DEPT', name: 'Phòng Thử Nghiệm', type: UnitType.DEPARTMENT, status: 'ACTIVE' }
    });

    staffUser = await prisma.user.upsert({
      where: { id: 'test-staff-sod' },
      update: { role: UserRole.CHUYEN_VIEN},
      create: {
        id: 'test-staff-sod',
        email: 'staff.sod@cdktcnqn.edu.vn',
        name: 'Giảng viên SoD',
        role: UserRole.CHUYEN_VIEN,

      }
    });

    leaderUser = await prisma.user.upsert({
      where: { id: 'test-leader-sod' },
      update: { role: UserRole.TRUONG_PHONG},
      create: {
        id: 'test-leader-sod',
        email: 'leader.sod@cdktcnqn.edu.vn',
        name: 'Trưởng phòng SoD',
        role: UserRole.TRUONG_PHONG,

      }
    });

    bghUser = await prisma.user.upsert({
      where: { id: 'test-bgh-sod' },
      update: { role: UserRole.BAN_GIAM_HIEU},
      create: {
        id: 'test-bgh-sod',
        email: 'bgh.sod@cdktcnqn.edu.vn',
        name: 'Hiệu trưởng SoD',
        role: UserRole.BAN_GIAM_HIEU,

      }
    });

    const leaderPosition = await prisma.positionDefinition.upsert({
      where: { code: 'TRUONG_PHONG' },
      update: {},
      create: {
        code: 'TRUONG_PHONG',
        title: 'Trưởng phòng',
        group: JobCatalogGroup.LDPU,
        isLeadership: true,
      },
    });
    const existingLeaderAssignment = await prisma.positionAssignment.findFirst({
      where: {
        userId: leaderUser.id,
        positionDefinitionId: leaderPosition.id,
        unitId: dept.id,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    if (!existingLeaderAssignment) {
      const leaderAssignment = await prisma.positionAssignment.create({
        data: {
          userId: leaderUser.id,
          positionDefinitionId: leaderPosition.id,
          unitId: dept.id,
          type: 'PRIMARY',
          status: 'ACTIVE',
        },
      });
      leaderAssignmentId = leaderAssignment.id;
    }

    staffToken = signSessionToken({
      id: staffUser.id,
      email: staffUser.email,
      name: staffUser.name,
      role: staffUser.role,

    });

    leaderToken = signSessionToken({
      id: leaderUser.id,
      email: leaderUser.email,
      name: leaderUser.name,
      role: leaderUser.role,

    });

    bghToken = signSessionToken({
      id: bghUser.id,
      email: bghUser.email,
      name: bghUser.name,
      role: bghUser.role,

    });

    // Create task assigned to staffUser
    const task = await prisma.task.create({
      data: {
        code: `TEST-SOD-${Date.now()}`,
        title: 'Nhiệm vụ kiểm thử FSM và SoD',
        description: 'Mô tả',
        scope: TaskScope.DEPARTMENT,
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.HIGH,
        progressPercent: 50,
        academicMonth: 9,
        academicYear: '2026-2027',
        dueDate: new Date('2026-10-30T17:00:00.000Z'),

        createdById: bghUser.id,
        leadUnitId: dept.id,
        actors: {
          create: {
            userId: staffUser.id,
            role: TaskActorRole.DRI, isPrimaryDRI: true, appointedAt: new Date(),
          }
        }
      },
    });
    testTaskId = task.id;
    createdTaskIds.push(testTaskId);
  });

  after(async () => {
    if (leaderAssignmentId) {
      await prisma.positionAssignment.delete({ where: { id: leaderAssignmentId } });
    }
    if (createdTaskIds.length > 0) {
      await prisma.taskDeliverable.deleteMany({ where: { taskId: { in: createdTaskIds } } });
      await prisma.taskActor.deleteMany({ where: { taskId: { in: createdTaskIds } } });
      await prisma.task.deleteMany({ where: { id: { in: createdTaskIds } } });
    }
  });

  test('buildTaskContext uses canonical TaskActor/leadUnitId and excludes reviewers from makers', () => {
    const reviewerId = 'reviewer-sod';
    const context = buildTaskContext({
      id: 'task-context-sod',
      createdById: 'creator-sod',
      leadUnitId: 'unit-sod',
      actors: [
        { userId: staffUser.id, role: 'DRI', isPrimaryDRI: true },
        { userId: reviewerId, role: 'REVIEWER', isPrimaryDRI: false },
      ],
    });

    assert.strictEqual(context.departmentId, 'unit-sod');
    assert.deepStrictEqual(context.assigneeIds, [staffUser.id]);
    assert.strictEqual(taskStateMachine.isMaker({ id: reviewerId, role: 'TRUONG_PHONG' }, context), false);
    assert.strictEqual(taskStateMachine.isMaker({ id: staffUser.id, role: 'CHUYEN_VIEN' }, context), true);
  });

  test('staff assignee cannot directly mark task as COMPLETED (400/403 blocked)', async () => {
    const req = new NextRequest(`http://localhost:3000/api/tasks/${testTaskId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${staffToken}`,
        origin: 'http://localhost:3000',
      },
      body: JSON.stringify({ status: 'COMPLETED' }),
    });

    const res = await patchTask(req, { params: Promise.resolve({ id: testTaskId }) });
    assert.ok(res.status === 400 || res.status === 403);
    const json = await res.json();
    assert.strictEqual(json.success, false);
  });

  test('submitting deliverable by staff transitions task to WAITING_APPROVAL', async () => {
    const req = new NextRequest(`http://localhost:3000/api/tasks/${testTaskId}/deliverables`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${staffToken}`,
        origin: 'http://localhost:3000',
      },
      body: JSON.stringify({
        title: 'Báo cáo nghiệm thu hoàn tất',
        fileUrl: 'https://qcet.edu.vn/files/bao-cao.pdf',
        fileType: 'PDF',
      }),
    });

    const res = await postDeliverable(req, { params: Promise.resolve({ id: testTaskId }) });
    assert.strictEqual(res.status, 201);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    testDeliverableId = json.deliverable.id;

    // Check task status in database
    const updatedTask = await prisma.task.findUnique({ where: { id: testTaskId } });
    assert.strictEqual(updatedTask?.status, TaskStatus.WAITING_APPROVAL);
  });

  test('submitter cannot approve their own deliverable (403 SoD violation)', async () => {
    const req = new NextRequest(`http://localhost:3000/api/tasks/${testTaskId}/deliverables`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${staffToken}`,
        origin: 'http://localhost:3000',
      },
      body: JSON.stringify({
        deliverableId: testDeliverableId,
        reviewStatus: 'APPROVED',
        reviewNote: 'Tự duyệt',
      }),
    });

    const res = await patchDeliverable(req, { params: Promise.resolve({ id: testTaskId }) });
    assert.strictEqual(res.status, 403);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.match(json.error, /không thể tự duyệt|quyền/i);
  });

  test('authorized leader approves deliverable and transitions task to COMPLETED', async () => {
    const req = new NextRequest(`http://localhost:3000/api/tasks/${testTaskId}/deliverables`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${leaderToken}`,
        origin: 'http://localhost:3000',
      },
      body: JSON.stringify({
        deliverableId: testDeliverableId,
        reviewStatus: 'APPROVED',
        reviewNote: 'Đạt yêu cầu nghiệm thu',
      }),
    });

    const res = await patchDeliverable(req, { params: Promise.resolve({ id: testTaskId }) });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.deliverable.reviewStatus, 'APPROVED');

    // Verify task status is now COMPLETED and 100% progress
    const updatedTask = await prisma.task.findUnique({ where: { id: testTaskId } });
    assert.strictEqual(updatedTask?.status, TaskStatus.COMPLETED);
    assert.strictEqual(updatedTask?.progressPercent, 100);
  });
});
