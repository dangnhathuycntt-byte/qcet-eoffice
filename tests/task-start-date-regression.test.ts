import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { prisma } from '../src/lib/prisma';
import { PATCH } from '../src/app/api/tasks/[id]/route';
import { signSessionToken, SESSION_COOKIE_NAME } from '../src/lib/jwt-session';
import { UpdateTaskMetadataSchema } from '../src/contracts/tasks';
import { TaskStatus, TaskPriority, TaskScope,TaskActorRole } from '@prisma/client';
import { AuditAction } from '../src/lib/db/audit';


describe('Task Detail Start Date Regression & Schedule Contract Tests', () => {
  let testDept: any;
  let leaderUser: any;
  let staffUser: any;
  let leaderToken: string;

  const createdTaskIds: string[] = [];
  const createdUserIds: string[] = [];

  before(async () => {
    testDept = await prisma.department.create({
      data: {
        id: `dept_reg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: 'Phòng Khảo thí & ĐBCL Regression Test',
      },
    });

    leaderUser = await prisma.user.create({
      data: {
        email: `reg_leader_${Date.now()}@qncet.edu.vn`,
        name: 'Trưởng đơn vị Regression',
        role: 'TRUONG_PHONG',
        departmentId: testDept.id,
      },
    });
    createdUserIds.push(leaderUser.id);

    leaderToken = signSessionToken({
      id: leaderUser.id,
      email: leaderUser.email,
      name: leaderUser.name,
      role: leaderUser.role,
      departmentId: leaderUser.departmentId,
    });

    staffUser = await prisma.user.create({
      data: {
        email: `reg_staff_${Date.now()}@qncet.edu.vn`,
        name: 'Chuyên viên Regression',
        role: 'CHUYEN_VIEN',
        departmentId: testDept.id,
      },
    });
    createdUserIds.push(staffUser.id);
  });

  after(async () => {
    if (createdTaskIds.length > 0) {
      await prisma.auditEvent.deleteMany({
        where: { entityId: { in: createdTaskIds } },
      });
      await prisma.taskDeliverable.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      });
      await prisma.taskActor.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      });
      await prisma.taskActor.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      });
      await prisma.task.deleteMany({
        where: { id: { in: createdTaskIds } },
      });
    }

    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }

    if (testDept?.id) {
      await prisma.department.deleteMany({
        where: { id: testDept.id },
      });
    }
  });

  async function createFixtureTask(startDate: Date, dueDate: Date) {
    const task = await prisma.task.create({
      data: {
        code: `NV-REG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        title: 'Nhiệm vụ kiểm thử Regression Schedule',
        priority: TaskPriority.HIGH,
        scope: TaskScope.DEPARTMENT,
        departmentId: testDept.id,
        createdById: leaderUser.id,
        startDate,
        dueDate,
        academicMonth: 9,
        academicYear: '2026-2027',
        status: TaskStatus.IN_PROGRESS,
        version: 1,
        assignees: {
          create: [
            {
              userId: staffUser.id,
              role: TaskActorRole.DRI, isPrimaryDRI: true, appointedAt: new Date(),
            },
          ],
        },
      },
    });
    createdTaskIds.push(task.id);
    return task;
  }

  describe('1. Schema Contract (UpdateTaskMetadataSchema)', () => {
    test('accepts valid startDate in ISO format', () => {
      const parsed = UpdateTaskMetadataSchema.safeParse({
        startDate: '2026-09-10T00:00:00.000+07:00',
        expectedVersion: 1,
      });
      assert.strictEqual(parsed.success, true);
      assert.strictEqual(parsed.data?.startDate, '2026-09-10T00:00:00.000+07:00');
    });

    test('accepts valid startDate and dueDate when startDate <= dueDate', () => {
      const parsed = UpdateTaskMetadataSchema.safeParse({
        startDate: '2026-09-10T00:00:00.000+07:00',
        dueDate: '2026-09-20T23:59:59.000+07:00',
        expectedVersion: 1,
      });
      assert.strictEqual(parsed.success, true);
    });

    test('rejects payload when startDate > dueDate directly in schema refine', () => {
      const parsed = UpdateTaskMetadataSchema.safeParse({
        startDate: '2026-09-25T00:00:00.000+07:00',
        dueDate: '2026-09-10T23:59:59.000+07:00',
        expectedVersion: 1,
      });
      assert.strictEqual(parsed.success, false);
      assert.match(parsed.error?.issues[0]?.message || '', /không được sau thời hạn/);
    });

    test('strictly preserves boundary: rejects sensitive fields (status, assigneeId, etc.)', () => {
      for (const forbidden of [
        { status: 'COMPLETED' },
        { assigneeId: 'some-user-id' },
        { collaboratorIds: ['user-1'] },
        { parentTaskId: 'task-parent' },
        { progressPercent: 80 },
        { approved: true },
      ]) {
        const parsed = UpdateTaskMetadataSchema.safeParse({
          startDate: '2026-09-10T00:00:00.000+07:00',
          ...forbidden,
        });
        assert.strictEqual(parsed.success, false, `Field ${Object.keys(forbidden)[0]} must be rejected by strict schema`);
      }
    });
  });

  describe('2. Canonical PATCH /api/tasks/[id] Endpoint', () => {
    test('updates startDate successfully, increments version, and logs audit', async () => {
      const initialStart = new Date('2026-09-01T00:00:00.000Z');
      const initialDue = new Date('2026-09-30T23:59:59.000Z');
      const task = await createFixtureTask(initialStart, initialDue);

      const newStartDateIso = '2026-09-10T00:00:00.000+07:00';
      const req = new NextRequest(`http://localhost:3000/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          origin: 'http://localhost:3000',
          cookie: `${SESSION_COOKIE_NAME}=${leaderToken}`,
        },
        body: JSON.stringify({
          startDate: newStartDateIso,
          expectedVersion: 1,
        }),
      });

      const res = await PATCH(req, { params: Promise.resolve({ id: task.id }) });
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.task.version, 2);

      // Verify DB persistence
      const persisted = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
      assert.strictEqual(persisted.version, 2);
      assert.strictEqual(new Date(persisted.startDate).getTime(), new Date(newStartDateIso).getTime());

      // Verify Audit Log
      const audit = await prisma.auditEvent.findFirst({
        where: {
          entityId: task.id,
          action: AuditAction.TASK_START_DATE_CHANGED,
        },
        orderBy: { createdAt: 'desc' },
      });
      assert.ok(audit, 'Audit log for TASK_START_DATE_CHANGED must exist');
      assert.strictEqual(audit.actorId, leaderUser.id);
    });

    test('rejects startDate when after existing dueDate (startDate > dueDate) with 400 ValidationError', async () => {
      const initialStart = new Date('2026-09-01T00:00:00.000Z');
      const initialDue = new Date('2026-09-15T23:59:59.000Z');
      const task = await createFixtureTask(initialStart, initialDue);

      // Attempt to set start date to 2026-09-20 (> 2026-09-15)
      const invalidStartDateIso = '2026-09-20T00:00:00.000+07:00';
      const req = new NextRequest(`http://localhost:3000/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          origin: 'http://localhost:3000',
          cookie: `${SESSION_COOKIE_NAME}=${leaderToken}`,
        },
        body: JSON.stringify({
          startDate: invalidStartDateIso,
          expectedVersion: 1,
        }),
      });

      const res = await PATCH(req, { params: Promise.resolve({ id: task.id }) });
      assert.strictEqual(res.status, 400);

      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.match(json.error || json.message, /Ngày bắt đầu không được sau thời hạn hoàn thành/);
    });

    test('rejects dueDate when before existing startDate (dueDate < startDate) with 400 ValidationError', async () => {
      const initialStart = new Date('2026-09-10T00:00:00.000Z');
      const initialDue = new Date('2026-09-30T23:59:59.000Z');
      const task = await createFixtureTask(initialStart, initialDue);

      // Attempt to set due date to 2026-09-05 (< 2026-09-10)
      const invalidDueDateIso = '2026-09-05T23:59:59.000+07:00';
      const req = new NextRequest(`http://localhost:3000/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          origin: 'http://localhost:3000',
          cookie: `${SESSION_COOKIE_NAME}=${leaderToken}`,
        },
        body: JSON.stringify({
          dueDate: invalidDueDateIso,
          expectedVersion: 1,
        }),
      });

      const res = await PATCH(req, { params: Promise.resolve({ id: task.id }) });
      assert.strictEqual(res.status, 400);

      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.match(json.error || json.message, /Ngày bắt đầu không được sau thời hạn hoàn thành/);
    });

    test('rejects empty or invalid startDate with 400 ValidationError', async () => {
      const task = await createFixtureTask(new Date('2026-09-01Z'), new Date('2026-09-30Z'));

      const req = new NextRequest(`http://localhost:3000/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          origin: 'http://localhost:3000',
          cookie: `${SESSION_COOKIE_NAME}=${leaderToken}`,
        },
        body: JSON.stringify({
          startDate: null,
          expectedVersion: 1,
        }),
      });

      const res = await PATCH(req, { params: Promise.resolve({ id: task.id }) });
      assert.strictEqual(res.status, 400);

      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.match(json.error || json.message, /Ngày bắt đầu không được để trống/);
    });

    test('enforces OCC: returns 409 Conflict when expectedVersion is stale', async () => {
      const task = await createFixtureTask(new Date('2026-09-01Z'), new Date('2026-09-30Z'));
      // Task version is 1

      const req = new NextRequest(`http://localhost:3000/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          origin: 'http://localhost:3000',
          cookie: `${SESSION_COOKIE_NAME}=${leaderToken}`,
        },
        body: JSON.stringify({
          startDate: '2026-09-05T00:00:00.000+07:00',
          expectedVersion: 999, // Stale version
        }),
      });

      const res = await PATCH(req, { params: Promise.resolve({ id: task.id }) });
      assert.strictEqual(res.status, 409, 'OCC mismatch without If-Match must return 409 Conflict');

      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.match(json.error || json.message, /xung đột phiên bản/i);
    });

    test('enforces OCC: returns 412 Precondition Failed when If-Match header is stale', async () => {
      const task = await createFixtureTask(new Date('2026-09-01Z'), new Date('2026-09-30Z'));
      // Task version is 1

      const req = new NextRequest(`http://localhost:3000/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'If-Match': '"999"', // Stale ETag
          origin: 'http://localhost:3000',
          cookie: `${SESSION_COOKIE_NAME}=${leaderToken}`,
        },
        body: JSON.stringify({
          startDate: '2026-09-05T00:00:00.000+07:00',
        }),
      });

      const res = await PATCH(req, { params: Promise.resolve({ id: task.id }) });
      assert.strictEqual(res.status, 412, 'OCC mismatch with If-Match must return 412 Precondition Failed');

      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.match(json.error || json.message, /version conflict/i);
    });
  });
});
