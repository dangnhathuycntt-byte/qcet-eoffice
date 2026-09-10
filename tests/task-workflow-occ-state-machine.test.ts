import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { prisma } from '../src/lib/prisma';
import { taskCommandService } from '../src/server/tasks/task-command-service';
import { taskQueryService } from '../src/server/tasks/task-query-service';
import {
  TaskScope,
  TaskStatus,
  TaskPriority,
  UserRole,
} from '@prisma/client';
import { ValidationError, PreconditionFailedError } from '../src/server/api/errors';
import { POST as createResolutionRoute } from '../src/app/api/executive/resolutions/route';
import { NextRequest } from 'next/server';
import { signSessionToken, SESSION_COOKIE_NAME } from '../src/lib/jwt-session';
import {
  isTaskOverdue,
  getSystemReferenceDateStr,
  getIctReferenceDateStart,
} from '../src/domain/tasks/deadlines';

describe('Task State Machine Integration & Executive OCC Tests', () => {
  let adminUser: any;
  let bghUser: any;
  let staffUser: any;
  let bghToken: string;
  let testDepartmentId: string;
  const createdTaskIds: string[] = [];
  const createdResolutionIds: string[] = [];

  before(async () => {
    adminUser = await prisma.user.findFirst({
      where: { role: UserRole.ADMIN },
    });
    bghUser = await prisma.user.findFirst({
      where: { role: UserRole.BAN_GIAM_HIEU },
    });
    staffUser = await prisma.user.findFirst({
      where: { role: UserRole.CHUYEN_VIEN },
    });
    const dept = await prisma.department.findFirst();
    testDepartmentId = dept ? dept.id : 'dept-test-1';

    assert.ok(adminUser, 'Admin user must exist');
    assert.ok(bghUser, 'BGH user must exist');
    assert.ok(staffUser, 'Staff user must exist');

    bghToken = signSessionToken({
      id: bghUser.id,
      email: bghUser.email,
      name: bghUser.name,
      role: bghUser.role,
      departmentId: bghUser.departmentId,
    });
  });

  after(async () => {
    if (createdResolutionIds.length > 0) {
      await prisma.executiveResolution.deleteMany({
        where: { id: { in: createdResolutionIds } },
      });
    }
    if (createdTaskIds.length > 0) {
      await prisma.executiveResolution.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      });
      await prisma.taskAssignee.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      });
      await prisma.taskDeliverable.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      });
      await prisma.task.deleteMany({
        where: { id: { in: createdTaskIds } },
      });
    }
  });

  describe('1. Task State Machine Enforcement in taskCommandService', () => {
    it('rejects illegal status transition: NOT_STARTED -> COMPLETED with ValidationError (400)', async () => {
      const task = await taskCommandService.createTask(
        { user: staffUser },
        {
          title: 'Task FSM Illegal Transition Test',
          scope: TaskScope.DEPARTMENT,
          departmentId: testDepartmentId,
          dueDate: new Date('2026-11-20T17:00:00.000Z'),
          priority: 'medium',
          academicMonth: 11,
          academicYear: '2026-2027',
          assigneeId: staffUser.id,
        }
      );
      createdTaskIds.push(task.id);
      assert.strictEqual(task.status, TaskStatus.NOT_STARTED);

      await assert.rejects(
        async () => {
          await taskCommandService.updateTask(
            { user: staffUser },
            task.id,
            { status: TaskStatus.COMPLETED }
          );
        },
        (err: any) => {
          assert.ok(err instanceof ValidationError, 'Expected ValidationError');
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /chuyển đổi trạng thái không hợp lệ|không được phép|không hợp lệ|không thể nhảy trực tiếp/i);
          return true;
        }
      );
    });

    it('rejects illegal status transition: CANCELLED task cannot transition to COMPLETED', async () => {
      const task = await taskCommandService.createTask(
        { user: adminUser },
        {
          title: 'Task FSM Cancelled Transition Test',
          scope: TaskScope.DEPARTMENT,
          departmentId: testDepartmentId,
          dueDate: new Date('2026-11-20T17:00:00.000Z'),
          priority: 'medium',
          academicMonth: 11,
          academicYear: '2026-2027',
          assigneeId: staffUser.id,
        }
      );
      createdTaskIds.push(task.id);

      // Cancel task via updateTask
      const cancelledTask = await taskCommandService.updateTask(
        { user: adminUser },
        task.id,
        { status: TaskStatus.CANCELLED }
      );
      assert.strictEqual(cancelledTask.status, TaskStatus.CANCELLED);

      // Attempt to transition CANCELLED -> COMPLETED
      await assert.rejects(
        async () => {
          await taskCommandService.updateTask(
            { user: adminUser },
            task.id,
            { status: TaskStatus.COMPLETED }
          );
        },
        (err: any) => {
          assert.ok(err instanceof ValidationError, 'Expected ValidationError');
          assert.strictEqual(err.statusCode, 400);
          return true;
        }
      );
    });

    it('allows legal status transition: NOT_STARTED -> IN_PROGRESS -> WAITING_APPROVAL', async () => {
      const task = await taskCommandService.createTask(
        { user: staffUser },
        {
          title: 'Task FSM Legal Transition Test',
          scope: TaskScope.DEPARTMENT,
          departmentId: testDepartmentId,
          dueDate: new Date('2026-11-20T17:00:00.000Z'),
          priority: 'medium',
          academicMonth: 11,
          academicYear: '2026-2027',
          assigneeId: staffUser.id,
        }
      );
      createdTaskIds.push(task.id);

      // NOT_STARTED -> IN_PROGRESS
      const inProgressTask = await taskCommandService.updateTask(
        { user: staffUser },
        task.id,
        { status: TaskStatus.IN_PROGRESS }
      );
      assert.strictEqual(inProgressTask.status, TaskStatus.IN_PROGRESS);

      // IN_PROGRESS -> WAITING_APPROVAL
      const waitingTask = await taskCommandService.updateTask(
        { user: staffUser },
        task.id,
        { status: TaskStatus.WAITING_APPROVAL }
      );
      assert.strictEqual(waitingTask.status, TaskStatus.WAITING_APPROVAL);
    });
  });

  describe('2. Executive Resolutions OCC Enforcement', () => {
    it('increments task version when executive resolution updates the task', async () => {
      const task = await taskCommandService.createTask(
        { user: bghUser },
        {
          title: 'Task OCC Executive Resolution Test',
          scope: TaskScope.SCHOOL,
          departmentId: testDepartmentId,
          dueDate: new Date('2026-09-20T00:00:00Z'),
          priority: 'high',
          academicMonth: 9,
          academicYear: '2026-2027',
          assigneeId: staffUser.id,
        }
      );
      createdTaskIds.push(task.id);
      const initialVersion = task.version;

      const req = new NextRequest('http://localhost:3000/api/executive/resolutions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
          cookie: `${SESSION_COOKIE_NAME}=${bghToken}`,
        },
        body: JSON.stringify({
          taskId: task.id,
          resolutionType: 'EXTEND_DEADLINE',
          grantedDays: 5,
          directiveNote: 'Gia hạn kiểm thử OCC',
        }),
      });

      const res = await createResolutionRoute(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      if (json.resolution?.id) createdResolutionIds.push(json.resolution.id);

      // Check that task version incremented
      const updatedTask = await prisma.task.findUnique({ where: { id: task.id } });
      assert.ok(updatedTask);
      assert.strictEqual(updatedTask.version, initialVersion + 1);
      assert.strictEqual(res.headers.get('ETag'), `"${initialVersion + 1}"`);
    });

    it('rejects executive resolution when expectedVersion mismatches (HTTP 412)', async () => {
      const task = await taskCommandService.createTask(
        { user: bghUser },
        {
          title: 'Task OCC Mismatch Test',
          scope: TaskScope.SCHOOL,
          departmentId: testDepartmentId,
          dueDate: new Date('2026-09-20T00:00:00Z'),
          priority: 'high',
          academicMonth: 9,
          academicYear: '2026-2027',
          assigneeId: staffUser.id,
        }
      );
      createdTaskIds.push(task.id);

      // Send with stale expectedVersion
      const req = new NextRequest('http://localhost:3000/api/executive/resolutions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
          cookie: `${SESSION_COOKIE_NAME}=${bghToken}`,
        },
        body: JSON.stringify({
          taskId: task.id,
          expectedVersion: task.version + 99, // stale / mismatched version
          resolutionType: 'DIRECTIVE_NOTE',
          directiveNote: 'Chỉ đạo với version cũ',
        }),
      });

      const res = await createResolutionRoute(req);
      assert.strictEqual(res.status, 412);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.code, 'PRECONDITION_FAILED');
    });

    it('rejects executive resolution when If-Match header mismatches (HTTP 412)', async () => {
      const task = await taskCommandService.createTask(
        { user: bghUser },
        {
          title: 'Task OCC If-Match Mismatch Test',
          scope: TaskScope.SCHOOL,
          departmentId: testDepartmentId,
          dueDate: new Date('2026-09-20T00:00:00Z'),
          priority: 'high',
          academicMonth: 9,
          academicYear: '2026-2027',
          assigneeId: staffUser.id,
        }
      );
      createdTaskIds.push(task.id);

      const req = new NextRequest('http://localhost:3000/api/executive/resolutions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'If-Match': '"0"', // Stale ETag
          Origin: 'http://localhost:3000',
          cookie: `${SESSION_COOKIE_NAME}=${bghToken}`,
        },
        body: JSON.stringify({
          taskId: task.id,
          resolutionType: 'DIRECTIVE_NOTE',
          directiveNote: 'Chỉ đạo với If-Match ETag cũ',
        }),
      });

      const res = await createResolutionRoute(req);
      assert.strictEqual(res.status, 412);
      const json = await res.json();
      assert.strictEqual(json.success, false);
    });
  });

  describe('3. Reconciled Status Bifurcation & Overdue Calculation', () => {
    it('calculates overdue consistently in ICT (UTC+7)', () => {
      const refDateStr = getSystemReferenceDateStr();
      assert.ok(refDateStr, 'Reference date string must exist');
      assert.match(refDateStr, /^\d{4}-\d{2}-\d{2}$/);

      // Task with past dueDate (2020-01-01) in IN_PROGRESS should be overdue
      const pastDueDate = new Date('2020-01-01T00:00:00Z');
      assert.strictEqual(isTaskOverdue(TaskStatus.IN_PROGRESS, pastDueDate), true);
      assert.strictEqual(isTaskOverdue(TaskStatus.NOT_STARTED, pastDueDate), true);

      // Terminal tasks should NOT be overdue
      assert.strictEqual(isTaskOverdue(TaskStatus.COMPLETED, pastDueDate), false);
      assert.strictEqual(isTaskOverdue(TaskStatus.CANCELLED, pastDueDate), false);

      // Future task should NOT be overdue
      const futureDueDate = new Date('2030-01-01T00:00:00Z');
      assert.strictEqual(isTaskOverdue(TaskStatus.IN_PROGRESS, futureDueDate), false);

      // getIctReferenceDateStart gives valid Date in ICT
      const ictStart = getIctReferenceDateStart(refDateStr);
      assert.ok(ictStart instanceof Date && !isNaN(ictStart.getTime()));
    });

    it('taskQueryService applies reconciled overdue status on tasks with past due dates', async () => {
      const task = await taskCommandService.createTask(
        { user: staffUser },
        {
          title: 'Task Overdue Query Reconciliation Test',
          scope: TaskScope.DEPARTMENT,
          departmentId: testDepartmentId,
          dueDate: new Date('2026-11-20T17:00:00.000Z'),
          priority: 'medium',
          academicMonth: 11,
          academicYear: '2026-2027',
          assigneeId: staffUser.id,
        }
      );
      createdTaskIds.push(task.id);

      // Set to IN_PROGRESS
      await taskCommandService.updateTask(
        { user: staffUser },
        task.id,
        { status: TaskStatus.IN_PROGRESS }
      );

      // Update dates directly in DB to past dates respecting chk_tasks_due_date_after_start_date (dueDate >= startDate)
      await prisma.task.update({
        where: { id: task.id },
        data: {
          startDate: new Date('2020-01-01T00:00:00Z'),
          dueDate: new Date('2020-01-15T00:00:00Z'),
        },
      });

      const queried = await taskQueryService.getTaskById(task.id);

      assert.ok(queried);
      const detail = queried.task;
      assert.strictEqual(detail.isOverdue, true);
      assert.strictEqual(detail.status, TaskStatus.IN_PROGRESS);

      // And querying with status='overdue' returns this task due to reconciled overdue logic
      const overdueList = await taskQueryService.queryTasks(
        { user: staffUser },
        { status: 'overdue' }
      );
      const foundInOverdue = overdueList.tasks.some((t: any) => t.id === task.id);
      assert.strictEqual(foundInOverdue, true);
    });
  });
});
