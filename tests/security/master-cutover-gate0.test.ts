import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { UserRole, TaskStatus, TaskPriority, TaskScope, DeliverableReviewStatus, TaskActorRole } from '@prisma/client';
import { signSessionToken, SESSION_COOKIE_NAME } from '@/lib/jwt-session';
import { taskQueryService } from '@/server/tasks/task-query-service';
import { GET as getTaskById, PATCH as patchTaskById } from '@/app/api/tasks/[id]/route';
import { GET as getFileRoute } from '@/app/api/files/[...path]/route';
import { POST as logoutRoute } from '@/app/api/auth/logout/route';
import { loadTaskAndBuildResource, taskDomainActionService } from '@/lib/services/task-domain-actions';
import { NotFoundError } from '@/server/api/errors';


describe('Sprint 1: Master Cutover Gate 0 - Security & Correctness Hardening', () => {
  const testRunId = String(Date.now());
  const deptAId = `DEPT-GATE0-A-${testRunId}`;
  const deptBId = `DEPT-GATE0-B-${testRunId}`;

  let adminUser: any;
  let staffA: any;
  let staffB: any;

  let adminToken: string;
  let staffAToken: string;
  let staffBToken: string;

  let taskA: any;
  let taskB: any;
  let schoolTask: any;
  let deliverableB: any;
  let resultB: any;
  let leadershipUser: any;
  let leadershipToken: string;

  const uploadsDir = path.resolve(process.env.UPLOADS_DIR || './uploads');
  const orphanFileName = `orphan_test_${testRunId}.pdf`;
  const orphanFilePath = path.join(uploadsDir, orphanFileName);

  function createRequest(
    url: string,
    options: {
      method?: string;
      token?: string;
      body?: any;
      headers?: Record<string, string>;
    } = {}
  ) {
    const headers = new Headers(options.headers);
    headers.set('Origin', 'http://localhost:3000');
    headers.set('Referer', 'http://localhost:3000');
    if (options.token) {
      headers.set('Cookie', `${SESSION_COOKIE_NAME}=${options.token}`);
    }
    if (options.body) {
      headers.set('Content-Type', 'application/json');
    }
    return new NextRequest(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  }

  before(async () => {
    // 0. Strict Isolated Test DB Invariant
    const dbUrl = process.env.DATABASE_URL || '';
    const isLocalHost = !dbUrl || dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') || dbUrl.includes('file:');
    const isKnownProductionOrCloud =
      dbUrl.includes('production') ||
      dbUrl.includes('prod.') ||
      dbUrl.includes('supabase') ||
      dbUrl.includes('neon.tech');

    if (isKnownProductionOrCloud || !isLocalHost) {
      throw new Error(
        `SECURITY INVARIANT VIOLATION: Cannot execute destructive DB tests against production/cloud database. Execution aborted.`
      );
    }

    // 1. Setup departments
    await prisma.organizationalUnit.createMany({
      data: [
        { id: deptAId, name: `Phòng Gate0 A ${testRunId}` },
        { id: deptBId, name: `Phòng Gate0 B ${testRunId}` },
      ],
    });

    // 2. Setup users
    adminUser = await prisma.user.create({
      data: {
        id: `admin-gate0-${testRunId}`,
        email: `admin.gate0.${testRunId}@qcet.edu.vn`,
        name: 'Admin Gate0',
        role: UserRole.ADMIN,

        passwordHash: '$2a$10$FakePasswordHashForSecurityVerification1234567890',
        isActive: true,
      },
    });

    staffA = await prisma.user.create({
      data: {
        id: `staff-gate0-a-${testRunId}`,
        email: `staff.gate0.a.${testRunId}@qcet.edu.vn`,
        name: 'Staff Gate0 A',
        role: UserRole.CHUYEN_VIEN,

        passwordHash: '$2a$10$FakePasswordHashForStaffA1234567890abcdef',
        isActive: true,
      },
    });

    staffB = await prisma.user.create({
      data: {
        id: `staff-gate0-b-${testRunId}`,
        email: `staff.gate0.b.${testRunId}@qcet.edu.vn`,
        name: 'Staff Gate0 B',
        role: UserRole.CHUYEN_VIEN,

        passwordHash: '$2a$10$FakePasswordHashForStaffB1234567890abcdef',
        isActive: true,
      },
    });

    leadershipUser = await prisma.user.create({
      data: {
        id: `leadership-gate0-${testRunId}`,
        email: `leadership.gate0.${testRunId}@qcet.edu.vn`,
        name: 'Hiệu trưởng Gate0',
        role: UserRole.BAN_GIAM_HIEU,
        title: 'Hiệu trưởng',

        passwordHash: '$2a$10$FakePasswordHashForLeadership1234567890abcdef',
        isActive: true,
      },
    });

    adminToken = signSessionToken({
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: adminUser.role,

    });

    leadershipToken = signSessionToken({
      id: leadershipUser.id,
      email: leadershipUser.email,
      name: leadershipUser.name,
      role: leadershipUser.role,

    });

    staffAToken = signSessionToken({
      id: staffA.id,
      email: staffA.email,
      name: staffA.name,
      role: staffA.role,

    });

    staffBToken = signSessionToken({
      id: staffB.id,
      email: staffB.email,
      name: staffB.name,
      role: staffB.role,

    });

    // 3. Create Tasks
    taskA = await prisma.task.create({
      data: {
        title: `Task Gate0 Dept A ${testRunId}`,
        code: `TASK-G0-A-${testRunId}`,
        scope: TaskScope.DEPARTMENT,
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.NORMAL,

        createdById: staffA.id,
        academicMonth: 9,
        academicYear: '2026-2027',
        dueDate: new Date(Date.now() + 7 * 86400000),
        actors: {
          create: [{ userId: staffA.id, role: TaskActorRole.DRI, isPrimaryDRI: true, appointedAt: new Date() }],
        },
      },
    });

    taskB = await prisma.task.create({
      data: {
        title: `Task Gate0 Dept B ${testRunId}`,
        code: `TASK-G0-B-${testRunId}`,
        scope: TaskScope.DEPARTMENT,
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.HIGH,

        createdById: staffB.id,
        academicMonth: 9,
        academicYear: '2026-2027',
        dueDate: new Date(Date.now() + 7 * 86400000),
        actors: {
          create: [{ userId: staffB.id, role: TaskActorRole.DRI, isPrimaryDRI: true, appointedAt: new Date() }],
        },
      },
    });

    schoolTask = await prisma.task.create({
      data: {
        title: `School Task Gate0 ${testRunId}`,
        code: `TASK-G0-SCH-${testRunId}`,
        scope: TaskScope.SCHOOL,
        status: TaskStatus.NOT_STARTED,
        priority: TaskPriority.URGENT,
        createdById: adminUser.id,
        academicMonth: 9,
        academicYear: '2026-2027',
        dueDate: new Date(Date.now() + 14 * 86400000),
      },
    });

    // Subtask under Task A
    await prisma.task.create({
      data: {
        title: `Subtask Gate0 A ${testRunId}`,
        code: `SUB-G0-A-${testRunId}`,
        scope: TaskScope.INDIVIDUAL,
        status: TaskStatus.IN_PROGRESS,
        parentTaskId: taskA.id,

        createdById: staffA.id,
        academicMonth: 9,
        academicYear: '2026-2027',
        dueDate: new Date(Date.now() + 3 * 86400000),
        actors: {
          create: [{ userId: staffA.id, role: TaskActorRole.DRI, isPrimaryDRI: true, appointedAt: new Date() }],
        },
      },
    });

    // Deliverable under Task B
    deliverableB = await prisma.taskDeliverable.create({
      data: {
        taskId: taskB.id,
        title: `Deliverable B ${testRunId}`,
        fileUrl: `uploads/deliv_b_${testRunId}.pdf`,
        fileType: 'application/pdf',
        fileSize: 1024,
        uploadedById: staffB.id,
        reviewStatus: DeliverableReviewStatus.PENDING,
      },
    });

    // Result under Task B
    resultB = await prisma.taskResult.create({
      data: {
        taskId: taskB.id,
        summary: `Báo cáo kết quả nhiệm vụ B ${testRunId}`,
        submittedByUserId: staffB.id,
      },
    });

    // Write orphan file on disk
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(orphanFilePath, Buffer.from('Orphan File Content'));
  });

  after(async () => {
    // Cleanup files
    try {
      if (fs.existsSync(orphanFilePath)) {
        fs.unlinkSync(orphanFilePath);
      }
    } catch {}

    // Cleanup DB
    try {
      await prisma.taskDeliverable.deleteMany({ where: { taskId: { in: [taskA?.id, taskB?.id, schoolTask?.id] } } });
      await prisma.taskResult.deleteMany({ where: { taskId: { in: [taskA?.id, taskB?.id, schoolTask?.id] } } });
      await prisma.taskActor.deleteMany({ where: { taskId: { in: [taskA?.id, taskB?.id, schoolTask?.id] } } });
      await prisma.task.deleteMany({ where: { parentTaskId: taskA?.id } });
      await prisma.task.deleteMany({ where: { id: { in: [taskA?.id, taskB?.id, schoolTask?.id] } } });
      await prisma.user.deleteMany({ where: { id: { in: [adminUser?.id, staffA?.id, staffB?.id, leadershipUser?.id] } } });
      await prisma.organizationalUnit.deleteMany({ where: { id: { in: [deptAId, deptBId] } } });
    } catch {}
  });

  describe('Task 1 (F01: Eliminate raw Prisma models & passwordHash leaks)', () => {
    test('taskQueryService.getTaskById does not leak passwordHash', async () => {
      const result = await taskQueryService.getTaskById(taskA.id);
      assert.ok(result, 'Task should be returned');
      assert.ok(result.task, 'result.task must exist');
      assert.ok(result.data, 'result.data must exist');

      // Check serialized JSON for any passwordHash leak
      const serialized = JSON.stringify(result);
      assert.equal(serialized.includes('passwordHash'), false, 'Serialized result must not contain passwordHash');
      assert.equal(serialized.includes('FakePasswordHash'), false, 'Serialized result must not contain password values');
    });

    test('GET /api/tasks/[id] returns clean DTO without raw property', async () => {
      const req = createRequest(`http://localhost:3000/api/tasks/${taskA.id}`, {
        token: staffAToken,
      });
      const res = await getTaskById(req, { params: Promise.resolve({ id: taskA.id }) });
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data || json.task);
      assert.equal(json.raw, undefined, 'GET response must not expose raw Prisma model');

      const jsonStr = JSON.stringify(json);
      assert.equal(jsonStr.includes('passwordHash'), false, 'Response JSON must not contain passwordHash');
    });

    test('PATCH /api/tasks/[id] returns clean DTO without raw property', async () => {
      const req = createRequest(`http://localhost:3000/api/tasks/${taskA.id}`, {
        method: 'PATCH',
        token: staffAToken,
        body: {
          title: `Updated Title Task A ${testRunId}`,
        },
      });
      const res = await patchTaskById(req, { params: Promise.resolve({ id: taskA.id }) });
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data || json.task);
      assert.equal(json.raw, undefined, 'PATCH response must not expose raw Prisma model');
    });
  });

  describe('Task 2 (F02: Task list authorization at database level)', () => {
    test('non-admin, non-leadership user queryTasks filters out cross-department tasks and unassigned school tasks', async () => {
      const result = await taskQueryService.queryTasks({ user: staffA }, { search: testRunId });
      const taskIds = result.tasks.map((t) => t.id);

      assert.ok(taskIds.includes(taskA.id), 'Staff A should see Task A (own department)');
      assert.equal(taskIds.includes(taskB.id), false, 'Staff A must NOT see Task B (other department)');
      assert.equal(taskIds.includes(schoolTask.id), false, 'Staff A must NOT see unassigned school task');
    });

    test('institutional leadership (HIEU_TRUONG/BGH) queryTasks has school-wide oversight', async () => {
      const result = await taskQueryService.queryTasks({ user: leadershipUser }, { search: testRunId });
      const taskIds = result.tasks.map((t) => t.id);

      assert.ok(taskIds.includes(taskA.id), 'Leadership should see Task A');
      assert.ok(taskIds.includes(taskB.id), 'Leadership should see Task B');
      assert.ok(taskIds.includes(schoolTask.id), 'Leadership should see School Task');
    });

    test('admin user queryTasks is not restricted by department boundaries', async () => {
      const result = await taskQueryService.queryTasks({ user: adminUser }, { search: testRunId });
      const taskIds = result.tasks.map((t) => t.id);

      assert.ok(taskIds.includes(taskA.id), 'Admin should see Task A');
      assert.ok(taskIds.includes(taskB.id), 'Admin should see Task B');
      assert.ok(taskIds.includes(schoolTask.id), 'Admin should see School Task');
    });

    test('queryTasks enforces pagination limit cap of 100 items', async () => {
      const resultHighLimit = await taskQueryService.queryTasks({ user: staffA }, { limit: 500 });
      assert.ok(resultHighLimit.pagination.limit <= 100, 'Pagination limit must be capped at maximum 100');

      const resultAll = await taskQueryService.queryTasks({ user: staffA }, { all: true });
      assert.ok(resultAll.pagination.limit <= 100, 'All query limit must be clamped at maximum 100');
    });

    test('F02-1: non-admin querying dept=other-dept cannot see other unit private tasks', async () => {
      const result = await taskQueryService.queryTasks(
        { user: staffA },
        { departmentId: deptBId, search: testRunId }
      );
      const taskIds = result.tasks.map((t) => t.id);

      assert.equal(
        taskIds.includes(taskB.id),
        false,
        'Staff A querying Dept B must NOT see Dept B private task'
      );
      assert.equal(result.tasks.length, 0, 'No unauthorized tasks should be returned for Dept B');
    });
  });

  describe('Task 3 (F04: Enforce child resource aggregate ID binding)', () => {
    test('loadTaskAndBuildResource rejects deliverable belonging to a different task', async () => {
      await assert.rejects(
        async () => {
          await loadTaskAndBuildResource(taskA.id, { deliverableId: deliverableB.id });
        },
        (err: any) => {
          assert.ok(err instanceof NotFoundError);
          assert.equal(err.message, 'Không tìm thấy tệp bàn giao thuộc nhiệm vụ này');
          return true;
        }
      );
    });

    test('loadTaskAndBuildResource rejects result belonging to a different task', async () => {
      await assert.rejects(
        async () => {
          await loadTaskAndBuildResource(taskA.id, { resultId: resultB.id });
        },
        (err: any) => {
          assert.ok(err instanceof NotFoundError);
          assert.equal(err.message, 'Không tìm thấy kết quả thuộc nhiệm vụ này');
          return true;
        }
      );
    });

    test('loadTaskAndBuildResource rejects stepId not belonging to the task', async () => {
      await assert.rejects(
        async () => {
          await loadTaskAndBuildResource(taskA.id, { stepId: 'unrelated-step-id' });
        },
        (err: any) => {
          assert.ok(err instanceof NotFoundError);
          assert.equal(err.message, 'Không tìm thấy bước phê duyệt thuộc nhiệm vụ này');
          return true;
        }
      );
    });

    test('requestRevision rejects deliverable belonging to a different task', async () => {
      const staffASession = {
        id: staffA.id,
        email: staffA.email,
        name: staffA.name,
        role: staffA.role,

      };

      await assert.rejects(
        async () => {
          await taskDomainActionService.requestRevision(staffASession, taskA.id, {
            deliverableId: deliverableB.id,
            reason: 'Yêu cầu sửa đổi tệp',
            expectedVersion: taskA.version,
          });
        },
        (err: any) => {
          assert.ok(err instanceof NotFoundError);
          return true;
        }
      );
    });
  });

  describe('Task 4 (F07: File access default deny)', () => {
    test('GET /api/files/[...path] rejects orphan file on disk without DB association with 404', async () => {
      const req = createRequest(`http://localhost:3000/api/files/${orphanFileName}`, {
        token: staffAToken,
      });
      const res = await getFileRoute(req, { params: Promise.resolve({ path: [orphanFileName] }) });

      assert.equal(res.status, 404);
      const json = await res.json();
      assert.equal(json.code, 'NOT_FOUND');
      assert.equal(json.message, 'Không tìm thấy tệp hoặc tệp không thuộc tài nguyên được cấp quyền');
    });

    test('F07-1: Attempting to access an unlinked file by matching only its basename fails with 404', async () => {
      const basenameTestFileName = `basename_match_${testRunId}.pdf`;
      const basenameTestFilePath = path.join(uploadsDir, basenameTestFileName);
      fs.writeFileSync(basenameTestFilePath, Buffer.from('Unlinked Basename Test Content'));

      const docA = await prisma.document.create({
        data: {
          type: 'VAN_BAN_DEN',
          documentYear: 2026,
          registrationNumber: Math.floor(Math.random() * 800000) + 100000,
          originalNumber: `ORIG-BASE-${testRunId}`,
          summary: 'Basename Test Document',
          category: 'Kế hoạch',
          issuingAuthority: 'Dept A Authority',
          issuedDate: new Date(),
          leadDepartmentId: deptAId,
          registeredById: staffA.id,
        },
      });

      const attachmentA = await prisma.documentAttachment.create({
        data: {
          documentId: docA.id,
          fileName: basenameTestFileName,
          fileUrl: `different_directory/${basenameTestFileName}`,
          fileSize: 100,
          mimeType: 'application/pdf',
        },
      });

      try {
        const req = createRequest(`http://localhost:3000/api/files/${basenameTestFileName}`, {
          token: staffAToken,
        });
        const res = await getFileRoute(req, { params: Promise.resolve({ path: [basenameTestFileName] }) });

        assert.equal(res.status, 404);
        const json = await res.json();
        assert.equal(json.code, 'NOT_FOUND');
        assert.equal(json.message, 'Không tìm thấy tệp hoặc tệp không thuộc tài nguyên được cấp quyền');
      } finally {
        try {
          if (fs.existsSync(basenameTestFilePath)) {
            fs.unlinkSync(basenameTestFilePath);
          }
          await prisma.documentAttachment.delete({ where: { id: attachmentA.id } });
          await prisma.document.delete({ where: { id: docA.id } });
        } catch {}
      }
    });
  });

  describe('Task 5 (F08: PWA Service Worker cache isolation & logout cleanup)', () => {
    test('POST /api/auth/logout includes Clear-Site-Data cache header', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/logout', { method: 'POST' });
      const res = await logoutRoute(req);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('Clear-Site-Data'), '"cache"');
    });
  });
});
