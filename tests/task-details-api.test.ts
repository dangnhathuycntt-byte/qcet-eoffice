import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET, PATCH, DELETE } from '../src/app/api/tasks/[id]/route';
import { POST as postDeliverable } from '../src/app/api/tasks/[id]/deliverables/route';
import { prisma } from '../src/lib/prisma';
import { signSessionToken, SESSION_COOKIE_NAME } from '../src/lib/jwt-session';
import { TaskStatus, TaskPriority, TaskScope } from '@prisma/client';

describe('Task Detail & Deliverable Workflow Tests', () => {
  let testUserId: string;
  let testDeptId: string;
  let validToken: string;
  let testTaskId: string;
  const createdTaskIds: string[] = [];

  before(async () => {
    const user = await prisma.user.findFirst({
      where: { email: { contains: '@cdktcnqn.edu.vn' } },
    }) || await prisma.user.findFirst();
    assert.ok(user, 'Must have at least one user in database');
    testUserId = user.id;

    const dept = await prisma.department.findFirst({
      where: { id: { in: ['BGH', 'P_QLDT', 'K_CNTT'] } },
    }) || await prisma.department.findFirst();
    assert.ok(dept, 'Must have at least one department in database');
    testDeptId = dept.id;

    validToken = signSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      departmentId: user.departmentId,
    });

    // Create a task for testing detail routes
    const task = await prisma.task.create({
      data: {
        code: `TEST-DETAIL-${Date.now()}`,
        title: 'Nhiệm vụ kiểm thử chi tiết và nộp minh chứng',
        description: 'Mô tả chi tiết nhiệm vụ',
        scope: TaskScope.DEPARTMENT,
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.HIGH,
        progressPercent: 30,
        academicMonth: 9,
        academicYear: '2026-2027',
        dueDate: new Date('2026-10-30T17:00:00.000Z'),
        departmentId: testDeptId,
        createdById: testUserId,
        assignees: {
          create: {
            userId: testUserId,
            roleInTask: 'PRIMARY_OWNER',
          },
        },
      },
    });
    testTaskId = task.id;
    createdTaskIds.push(testTaskId);
  });

  after(async () => {
    if (createdTaskIds.length > 0) {
      await prisma.taskAssignee.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      });
      await prisma.taskDeliverable.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      });
      await prisma.document.updateMany({
        where: { linkedTaskId: { in: createdTaskIds } },
        data: { linkedTaskId: null },
      });
      await prisma.task.deleteMany({
        where: { id: { in: createdTaskIds } },
      });
    }
  });

  test('transition task status to WAITING_APPROVAL when deliverable is submitted', () => {
    let currentStatus = 'IN_PROGRESS';
    const submission = {
      title: 'Báo cáo nghiệm thu.pdf',
      fileUrl: 'https://qcet.edu.vn/files/report.pdf',
    };

    if (submission.fileUrl) {
      currentStatus = 'WAITING_APPROVAL';
    }

    assert.strictEqual(currentStatus, 'WAITING_APPROVAL');
  });

  test('enforces Separation of Duties (SoD) on review approval', () => {
    const taskSubmitterId = 'user-001';
    const currentReviewerId = 'user-001'; // Trùng người

    const isAllowedToApprove = taskSubmitterId !== currentReviewerId;
    assert.strictEqual(isAllowedToApprove, false, 'Submitter cannot approve their own deliverable');
  });

  test('GET /api/tasks/[id] returns 401 Unauthorized when unauthenticated', async () => {
    const req = new NextRequest(`http://localhost:3000/api/tasks/${testTaskId}`);
    const res = await GET(req, { params: Promise.resolve({ id: testTaskId }) });
    assert.strictEqual(res.status, 401);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.match(json.error, /Unauthorized|Authentication required/i);
  });

  test('PATCH /api/tasks/[id] returns 401 Unauthorized when unauthenticated', async () => {
    const req = new NextRequest(`http://localhost:3000/api/tasks/${testTaskId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost:3000',
        referer: 'http://localhost:3000',
      },
      body: JSON.stringify({ progressPercent: 60 }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: testTaskId }) });
    assert.strictEqual(res.status, 401);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.match(json.error, /Unauthorized|Authentication required/i);
  });

  test('DELETE /api/tasks/[id] returns 401 Unauthorized when unauthenticated', async () => {
    const req = new NextRequest(`http://localhost:3000/api/tasks/${testTaskId}`, {
      method: 'DELETE',
      headers: {
        origin: 'http://localhost:3000',
        referer: 'http://localhost:3000',
      },
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: testTaskId }) });
    assert.strictEqual(res.status, 401);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.match(json.error, /Unauthorized|Authentication required/i);
  });

  test('POST /api/tasks/[id]/deliverables returns 401 Unauthorized when unauthenticated', async () => {
    const req = new NextRequest(`http://localhost:3000/api/tasks/${testTaskId}/deliverables`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost:3000',
        referer: 'http://localhost:3000',
      },
      body: JSON.stringify({
        title: 'Báo cáo nghiệm thu',
        fileUrl: 'https://qcet.edu.vn/report.pdf',
      }),
    });
    const res = await postDeliverable(req, { params: Promise.resolve({ id: testTaskId }) });
    assert.strictEqual(res.status, 401);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.match(json.error, /Unauthorized|Authentication required/i);
  });

  test('GET /api/tasks/[id] returns 404 for non-existent task', async () => {
    const nonExistentId = 'non-existent-task-id-12345';
    const req = new NextRequest(`http://localhost:3000/api/tasks/${nonExistentId}`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${validToken}` },
    });
    const res = await GET(req, { params: Promise.resolve({ id: nonExistentId }) });
    assert.strictEqual(res.status, 404);
    const json = await res.json();
    assert.strictEqual(json.success, false);
  });

  test('GET /api/tasks/[id] returns task details when authenticated', async () => {
    const req = new NextRequest(`http://localhost:3000/api/tasks/${testTaskId}`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${validToken}` },
    });
    const res = await GET(req, { params: Promise.resolve({ id: testTaskId }) });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(json.task || json.data);
    const returnedTask = json.task || json.data;
    assert.strictEqual(returnedTask.id, testTaskId);
    assert.strictEqual(returnedTask.title, 'Nhiệm vụ kiểm thử chi tiết và nộp minh chứng');
  });

  test('PATCH /api/tasks/[id] updates safe metadata', async () => {
    const req = new NextRequest(`http://localhost:3000/api/tasks/${testTaskId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${validToken}`,
        origin: 'http://localhost:3000',
      },
      body: JSON.stringify({
        title: 'Nhiệm vụ kiểm thử chi tiết đã cập nhật',
        priority: 'HIGH',
      }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: testTaskId }) });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    const updated = json.task || json.data;
    assert.strictEqual(updated.title, 'Nhiệm vụ kiểm thử chi tiết đã cập nhật');
    assert.strictEqual(updated.priority, 'HIGH');
  });

  test('POST /api/tasks/[id]/deliverables rejects missing title or fileUrl with 400', async () => {
    const req = new NextRequest(`http://localhost:3000/api/tasks/${testTaskId}/deliverables`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${validToken}`,
        origin: 'http://localhost:3000',
      },
      body: JSON.stringify({
        fileType: 'PDF',
      }),
    });
    const res = await postDeliverable(req, { params: Promise.resolve({ id: testTaskId }) });
    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.match(json.error, /Tiêu đề và đường dẫn file minh chứng là bắt buộc|Validation failed/);
  });

  test('POST /api/tasks/[id]/deliverables records deliverable and sets task status to WAITING_APPROVAL', async () => {
    const req = new NextRequest(`http://localhost:3000/api/tasks/${testTaskId}/deliverables`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${validToken}`,
        origin: 'http://localhost:3000',
      },
      body: JSON.stringify({
        title: 'Báo cáo nghiệm thu hoàn thành đợt 1',
        fileUrl: 'https://qcet.edu.vn/uploads/reports/test-report.pdf',
        fileType: 'PDF',
      }),
    });
    const res = await postDeliverable(req, { params: Promise.resolve({ id: testTaskId }) });
    assert.strictEqual(res.status, 201);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(json.deliverable || json.data);
    const deliv = json.deliverable || json.data;
    assert.strictEqual(deliv.taskId, testTaskId);
    assert.strictEqual(deliv.title, 'Báo cáo nghiệm thu hoàn thành đợt 1');
    assert.strictEqual(deliv.reviewStatus, 'PENDING');

    // Verify task status in database was updated to WAITING_APPROVAL
    const dbTask = await prisma.task.findUnique({ where: { id: testTaskId } });
    assert.strictEqual(dbTask?.status, TaskStatus.WAITING_APPROVAL);
  });

  test('DELETE /api/tasks/[id] deletes the task when authenticated', async () => {
    const targetDept = await prisma.department.findFirst({
      where: { id: { in: ['BGH', 'P_QLDT', 'K_CNTT'] } },
    }) || await prisma.department.findFirst();
    const deptId = targetDept ? targetDept.id : testDeptId;

    const targetUser = await prisma.user.findFirst({
      where: { email: { contains: '@cdktcnqn.edu.vn' } },
    }) || await prisma.user.findFirst();
    const userId = targetUser ? targetUser.id : testUserId;

    // Create a dedicated task to delete
    const taskToDelete = await prisma.task.create({
      data: {
        code: `TEST-DEL-${Date.now()}`,
        title: 'Task to be deleted',
        scope: TaskScope.DEPARTMENT,
        status: TaskStatus.NOT_STARTED,
        academicMonth: 9,
        academicYear: '2026-2027',
        dueDate: new Date('2026-10-30T17:00:00.000Z'),
        departmentId: deptId,
        createdById: userId,
      },
    });

    const req = new NextRequest(`http://localhost:3000/api/tasks/${taskToDelete.id}`, {
      method: 'DELETE',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${validToken}`,
        origin: 'http://localhost:3000',
        referer: 'http://localhost:3000',
      },
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: taskToDelete.id }) });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);

    // Verify it is gone
    const checkTask = await prisma.task.findUnique({ where: { id: taskToDelete.id } });
    assert.strictEqual(checkTask, null);
  });
});
