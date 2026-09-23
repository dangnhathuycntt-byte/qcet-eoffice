import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signSessionToken, SESSION_COOKIE_NAME } from '@/lib/jwt-session';
import { resetRateLimits } from '@/server/security/rate-limit';
import { UserRole, TaskStatus, TaskPriority, TaskScope } from '@prisma/client';
import { GET as getTasks, POST as postTask } from '@/app/api/tasks/route';
import { GET as getTaskById, PATCH as patchTask } from '@/app/api/tasks/[id]/route';
import { POST as postDeliverable } from '@/app/api/tasks/[id]/deliverables/route';

describe('Task API Routes Hardening (Phases 2, 3, 11, 13)', () => {
  const testRunId = Date.now();
  const deptAId = `DEPT-A-${testRunId}`;
  const deptBId = `DEPT-B-${testRunId}`;

  let staffAUser: any;
  let leaderAUser: any;
  let staffBUser: any;
  let bghUser: any;

  let staffAToken: string;
  let leaderAToken: string;
  let staffBToken: string;
  let bghToken: string;

  let taskAId: string;
  let personalTaskBId: string;

  before(async () => {
    // 1. Setup departments
    await prisma.organizationalUnit.createMany({
      data: [
        { id: deptAId, name: `Phòng A ${testRunId}`, shortName: `PA-${testRunId}` },
        { id: deptBId, name: `Phòng B ${testRunId}`, shortName: `PB-${testRunId}` },
      ],
    });

    // 2. Setup users
    staffAUser = await prisma.user.create({
      data: {
        id: `staff-a-${testRunId}`,
        email: `staff.a.${testRunId}@qcet.edu.vn`,
        name: 'Nhân viên Phòng A',
        role: UserRole.CHUYEN_VIEN,
        departmentId: deptAId,
        isActive: true,
      },
    });

    leaderAUser = await prisma.user.create({
      data: {
        id: `leader-a-${testRunId}`,
        email: `leader.a.${testRunId}@qcet.edu.vn`,
        name: 'Trưởng phòng A',
        role: UserRole.TRUONG_PHONG,
        departmentId: deptAId,
        isActive: true,
      },
    });

    staffBUser = await prisma.user.create({
      data: {
        id: `staff-b-${testRunId}`,
        email: `staff.b.${testRunId}@qcet.edu.vn`,
        name: 'Nhân viên Phòng B',
        role: UserRole.CHUYEN_VIEN,
        departmentId: deptBId,
        isActive: true,
      },
    });

    bghUser = await prisma.user.create({
      data: {
        id: `bgh-${testRunId}`,
        email: `bgh.${testRunId}@qcet.edu.vn`,
        name: 'Hiệu trưởng',
        role: UserRole.BAN_GIAM_HIEU,
        departmentId: deptAId,
        isActive: true,
      },
    });

    // 3. Tokens
    staffAToken = signSessionToken({
      id: staffAUser.id,
      email: staffAUser.email,
      name: staffAUser.name,
      role: staffAUser.role,
      departmentId: staffAUser.departmentId,
    });

    leaderAToken = signSessionToken({
      id: leaderAUser.id,
      email: leaderAUser.email,
      name: leaderAUser.name,
      role: leaderAUser.role,
      departmentId: leaderAUser.departmentId,
    });

    staffBToken = signSessionToken({
      id: staffBUser.id,
      email: staffBUser.email,
      name: staffBUser.name,
      role: staffBUser.role,
      departmentId: staffBUser.departmentId,
    });

    bghToken = signSessionToken({
      id: bghUser.id,
      email: bghUser.email,
      name: bghUser.name,
      role: bghUser.role,
      departmentId: bghUser.departmentId,
    });

    // 4. Create sample tasks
    const taskA = await prisma.task.create({
      data: {
        code: `TASK-A-${testRunId}`,
        title: 'Nhiệm vụ phòng A',
        description: 'Mô tả nhiệm vụ A',
        scope: TaskScope.DEPARTMENT,
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.NORMAL,
        progressPercent: 30,
        departmentId: deptAId,
        createdById: leaderAUser.id,
        academicMonth: 9,
        academicYear: '2026-2027',
        dueDate: new Date('2026-10-15T17:00:00.000Z'),
        assignees: {
          create: {
            userId: staffAUser.id,
            roleInTask: 'PRIMARY_OWNER',
          },
        },
      },
    });
    taskAId = taskA.id;

    const personalTaskB = await prisma.task.create({
      data: {
        code: `TASK-B-PERS-${testRunId}`,
        title: 'Nhiệm vụ cá nhân phòng B',
        description: 'Chỉ staff B được xem',
        scope: TaskScope.INDIVIDUAL,
        status: TaskStatus.NOT_STARTED,
        priority: TaskPriority.LOW,
        progressPercent: 0,
        departmentId: deptBId,
        createdById: staffBUser.id,
        academicMonth: 9,
        academicYear: '2026-2027',
        dueDate: new Date('2026-10-20T17:00:00.000Z'),
        assignees: {
          create: {
            userId: staffBUser.id,
            roleInTask: 'PRIMARY_OWNER',
          },
        },
      },
    });
    personalTaskBId = personalTaskB.id;
  });

  after(async () => {
    // Cleanup
    await prisma.taskDeliverable.deleteMany({
      where: { task: { departmentId: { in: [deptAId, deptBId] } } },
    });
    await prisma.taskActor.deleteMany({
      where: { task: { departmentId: { in: [deptAId, deptBId] } } },
    });
    await prisma.task.deleteMany({
      where: { departmentId: { in: [deptAId, deptBId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [staffAUser.id, leaderAUser.id, staffBUser.id, bghUser.id] } },
    });
    await prisma.organizationalUnit.deleteMany({
      where: { id: { in: [deptAId, deptBId] } },
    });
  });

  beforeEach(() => {
    resetRateLimits();
  });

  describe('1. GET /api/tasks', () => {
    test('requires authentication (401 AUTH_REQUIRED)', async () => {
      const req = new NextRequest('http://localhost:3000/api/tasks');
      const res = await getTasks(req);
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.strictEqual(json.code, 'AUTH_REQUIRED');
      assert.strictEqual(res.headers.get('cache-control'), 'private, no-store');
      assert.ok(res.headers.get('x-request-id'));
    });

    test('clamps pageSize to max 100 and returns DTO list', async () => {
      const req = new NextRequest('http://localhost:3000/api/tasks?pageSize=500&page=1', {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${staffAToken}`,
        },
      });
      const res = await getTasks(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(Array.isArray(json.tasks));
      assert.strictEqual(json.pagination.pageSize, 100);
      assert.strictEqual(res.headers.get('cache-control'), 'private, no-store');
    });

    test('applies rate limiting on search queries', async () => {
      // Perform repeated searches until rate limited
      let hitRateLimit = false;
      for (let i = 0; i < 45; i++) {
        const req = new NextRequest(`http://localhost:3000/api/tasks?search=query${i}`, {
          headers: {
            cookie: `${SESSION_COOKIE_NAME}=${staffAToken}`,
          },
        });
        const res = await getTasks(req);
        if (res.status === 429) {
          hitRateLimit = true;
          const json = await res.json();
          assert.strictEqual(json.code, 'RATE_LIMITED');
          break;
        }
      }
      assert.ok(hitRateLimit, 'Should trigger rate limit on excessive search requests');
    });
  });

  describe('2. POST /api/tasks', () => {
    test('requires authentication (401 AUTH_REQUIRED)', async () => {
      const req = new NextRequest('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          origin: 'http://localhost:3000',
        },
        body: JSON.stringify({ title: 'Task' }),
      });
      const res = await postTask(req);
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.strictEqual(json.code, 'AUTH_REQUIRED');
    });

    test('enforces CSRF protection (403 FORBIDDEN when missing Origin/Referer with cookie)', async () => {
      const req = new NextRequest('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=${leaderAToken}`,
          // No origin or referer
        },
        body: JSON.stringify({
          title: 'Nhiệm vụ mới',
        }),
      });
      const res = await postTask(req);
      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.strictEqual(json.code, 'CSRF_VALIDATION_FAILED');
    });

    test('rejects invalid payload with 400 VALIDATION_ERROR', async () => {
      const req = new NextRequest('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=${leaderAToken}`,
          origin: 'http://localhost:3000',
        },
        body: JSON.stringify({
          title: '', // Empty title
        }),
      });
      const res = await postTask(req);
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.code, 'VALIDATION_ERROR');
    });

    test('creates task atomically inside transaction and returns 201 with TaskDetailDTO', async () => {
      const req = new NextRequest('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=${leaderAToken}`,
          origin: 'http://localhost:3000',
        },
        body: JSON.stringify({
          title: `Nhiệm vụ tạo tự động ${testRunId}`,
          description: 'Mô tả chi tiết',
          scope: 'department',
          departmentId: deptAId,
          assigneeId: staffAUser.id,
          priority: 'high',
          dueDate: '2026-11-01T17:00:00.000Z',
          academicMonth: 10,
          academicYear: '2026-2027',
        }),
      });
      const res = await postTask(req);
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.headers.get('cache-control'), 'private, no-store');
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(json.task.id);
      assert.strictEqual(json.task.title, `Nhiệm vụ tạo tự động ${testRunId}`);
      assert.strictEqual(json.task.leadAssignee?.id, staffAUser.id);
    });
  });

  describe('3. GET /api/tasks/[id]', () => {
    test('requires authentication (401 AUTH_REQUIRED)', async () => {
      const req = new NextRequest(`http://localhost:3000/api/tasks/${taskAId}`);
      const res = await getTaskById(req, { params: Promise.resolve({ id: taskAId }) });
      assert.strictEqual(res.status, 401);
    });

    test('returns 404 NOT_FOUND for non-existent task', async () => {
      const nonExistentId = 'non-existent-task-id-12345';
      const req = new NextRequest(`http://localhost:3000/api/tasks/${nonExistentId}`, {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${staffAToken}`,
        },
      });
      const res = await getTaskById(req, { params: Promise.resolve({ id: nonExistentId }) });
      assert.strictEqual(res.status, 404);
      const json = await res.json();
      assert.strictEqual(json.code, 'NOT_FOUND');
    });

    test('enforces BOLA check (403 FORBIDDEN if user has no permission to view task)', async () => {
      // staffA tries to access personal task of staffB
      const req = new NextRequest(`http://localhost:3000/api/tasks/${personalTaskBId}`, {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${staffAToken}`,
        },
      });
      const res = await getTaskById(req, { params: Promise.resolve({ id: personalTaskBId }) });
      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.strictEqual(json.code, 'FORBIDDEN');
    });

    test('returns 200 with sanitized TaskDetailDTO for authorized user', async () => {
      const req = new NextRequest(`http://localhost:3000/api/tasks/${taskAId}`, {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${staffAToken}`,
        },
      });
      const res = await getTaskById(req, { params: Promise.resolve({ id: taskAId }) });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('cache-control'), 'private, no-store');
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.task.id, taskAId);
      assert.strictEqual(json.task.title, 'Nhiệm vụ phòng A');
      assert.ok(json.task.leadAssignee);
    });
  });

  describe('4. PATCH /api/tasks/[id]', () => {
    test('enforces CSRF protection (403 FORBIDDEN)', async () => {
      const req = new NextRequest(`http://localhost:3000/api/tasks/${taskAId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=${leaderAToken}`,
          // missing origin/referer
        },
        body: JSON.stringify({ title: 'New Title' }),
      });
      const res = await patchTask(req, { params: Promise.resolve({ id: taskAId }) });
      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.strictEqual(json.code, 'CSRF_VALIDATION_FAILED');
    });

    test('enforces Object-Level Authorization (403 for unauthorized editor)', async () => {
      // staffB has no rights to edit task of Dept A
      const req = new NextRequest(`http://localhost:3000/api/tasks/${taskAId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=${staffBToken}`,
          origin: 'http://localhost:3000',
        },
        body: JSON.stringify({
          title: 'Hacked Title by Staff B',
        }),
      });
      const res = await patchTask(req, { params: Promise.resolve({ id: taskAId }) });
      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.strictEqual(json.code, 'FORBIDDEN');
    });

    test('enforces Optimistic Concurrency Control (OCC) - 409 CONFLICT on version mismatch', async () => {
      const task = await prisma.task.findUnique({ where: { id: taskAId }, select: { version: true } });
      const currentVersion = task?.version ?? 1;

      const req = new NextRequest(`http://localhost:3000/api/tasks/${taskAId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=${leaderAToken}`,
          origin: 'http://localhost:3000',
        },
        body: JSON.stringify({
          title: 'Stale update attempt',
          expectedVersion: currentVersion + 999, // Stale version
        }),
      });
      const res = await patchTask(req, { params: Promise.resolve({ id: taskAId }) });
      assert.strictEqual(res.status, 409);
      const json = await res.json();
      assert.strictEqual(json.code, 'CONFLICT');
    });

    test('updates task atomically with valid command input and correct version', async () => {
      const task = await prisma.task.findUnique({ where: { id: taskAId }, select: { version: true } });
      const currentVersion = task?.version ?? 1;

      const req = new NextRequest(`http://localhost:3000/api/tasks/${taskAId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=${leaderAToken}`,
          origin: 'http://localhost:3000',
        },
        body: JSON.stringify({
          title: 'Nhiệm vụ phòng A (Đã cập nhật)',
          progress: 60,
          expectedVersion: currentVersion,
        }),
      });
      const res = await patchTask(req, { params: Promise.resolve({ id: taskAId }) });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.task.title, 'Nhiệm vụ phòng A (Đã cập nhật)');
      assert.strictEqual(json.task.progress, 60);
    });
  });

  describe('5. POST /api/tasks/[id]/deliverables', () => {
    test('enforces CSRF and authentication', async () => {
      const req = new NextRequest(`http://localhost:3000/api/tasks/${taskAId}/deliverables`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=${staffAToken}`,
          // No origin
        },
        body: JSON.stringify({
          title: 'Minh chứng',
          fileUrl: 'https://example.com/file.pdf',
        }),
      });
      const res = await postDeliverable(req, { params: Promise.resolve({ id: taskAId }) });
      assert.strictEqual(res.status, 403);
    });

    test('enforces Object-Level Authorization (403 for unassigned user)', async () => {
      // staffB is not assigned to taskA
      const req = new NextRequest(`http://localhost:3000/api/tasks/${taskAId}/deliverables`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=${staffBToken}`,
          origin: 'http://localhost:3000',
        },
        body: JSON.stringify({
          title: 'Minh chứng giả mạo',
          fileUrl: 'https://example.com/fake.pdf',
        }),
      });
      const res = await postDeliverable(req, { params: Promise.resolve({ id: taskAId }) });
      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.strictEqual(json.code, 'FORBIDDEN');
    });

    test('rejects invalid payload with 400 VALIDATION_ERROR', async () => {
      const req = new NextRequest(`http://localhost:3000/api/tasks/${taskAId}/deliverables`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=${staffAToken}`,
          origin: 'http://localhost:3000',
        },
        body: JSON.stringify({
          title: '', // empty title
          fileUrl: 'not-a-valid-url', // invalid url format
        }),
      });
      const res = await postDeliverable(req, { params: Promise.resolve({ id: taskAId }) });
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.code, 'VALIDATION_ERROR');
    });

    test('persists deliverable atomically inside transaction and transitions task state', async () => {
      const req = new NextRequest(`http://localhost:3000/api/tasks/${taskAId}/deliverables`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=${staffAToken}`,
          origin: 'http://localhost:3000',
        },
        body: JSON.stringify({
          title: 'Báo cáo hoàn thành công việc phòng A',
          fileUrl: 'https://qcet.edu.vn/files/report-a.pdf',
          fileType: 'PDF',
          fileSize: 1024000,
        }),
      });
      const res = await postDeliverable(req, { params: Promise.resolve({ id: taskAId }) });
      assert.strictEqual(res.status, 201);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(json.deliverable.id);
      assert.strictEqual(json.deliverable.title, 'Báo cáo hoàn thành công việc phòng A');

      // Check task status in database was transitioned to WAITING_APPROVAL
      const task = await prisma.task.findUnique({ where: { id: taskAId } });
      assert.strictEqual(task?.status, TaskStatus.WAITING_APPROVAL);
    });
  });
});
