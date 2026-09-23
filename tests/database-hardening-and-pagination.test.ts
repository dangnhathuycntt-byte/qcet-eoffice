import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { prisma } from '../src/lib/prisma';
import { taskQueryService } from '../src/server/tasks/task-query-service';
import { GET as getTasksRoute } from '../src/app/api/tasks/route';
import { signSessionToken, SESSION_COOKIE_NAME } from '../src/lib/jwt-session';
import { TaskScope, TaskStatus, TaskPriority, TaskActorRole, UserRole } from '@prisma/client';

describe('Phase 12 & Phase 13: Database Hardening & Server-Side Filtering / Pagination Tests', () => {
  let testDept: any;
  let otherDept: any;
  let staffUser: any;
  let managerUser: any;
  let adminUser: any;
  let sessionToken: string;

  const createdTaskIds: string[] = [];

  const REFERENCE_DATE_STR = '2026-09-09';
  const PAST_START_DATE = new Date('2026-08-01T00:00:00.000Z');
  const OVERDUE_DUE_DATE = new Date('2026-09-01T00:00:00.000Z');
  const FUTURE_DUE_DATE = new Date('2026-09-20T00:00:00.000Z');

  before(async () => {
    // 1. Setup departments
    testDept = await prisma.organizationalUnit.upsert({
      where: { id: 'DEPT-HARDEN-01' },
      update: { name: 'Phòng Đào tạo Thử nghiệm' },
      create: {
        id: 'DEPT-HARDEN-01',
        code: 'DEPT-HARDEN-01',
        name: 'Phòng Đào tạo Thử nghiệm',
        type: 'PHONG_BAN' as any,
        status: 'ACTIVE' as any,
      },
    });

    otherDept = await prisma.organizationalUnit.upsert({
      where: { id: 'DEPT-HARDEN-02' },
      update: { name: 'Phòng Nghiên cứu Thử nghiệm' },
      create: {
        id: 'DEPT-HARDEN-02',
        code: 'DEPT-HARDEN-02',
        name: 'Phòng Nghiên cứu Thử nghiệm',
        type: 'PHONG_BAN' as any,
        status: 'ACTIVE' as any,
      },
    });

    // 2. Setup users
    staffUser = await prisma.user.upsert({
      where: { id: 'user-harden-staff' },
      update: { role: UserRole.CHUYEN_VIEN},
      create: {
        id: 'user-harden-staff',
        email: 'staff.harden@cdktcnqn.edu.vn',
        name: 'Chuyên Viên Hardening',
        role: UserRole.CHUYEN_VIEN,

      },
    });

    managerUser = await prisma.user.upsert({
      where: { id: 'user-harden-mgr' },
      update: { role: UserRole.TRUONG_PHONG},
      create: {
        id: 'user-harden-mgr',
        email: 'mgr.harden@cdktcnqn.edu.vn',
        name: 'Trưởng Phòng Hardening',
        role: UserRole.TRUONG_PHONG,

      },
    });

    adminUser = await prisma.user.upsert({
      where: { id: 'user-harden-admin' },
      update: { role: UserRole.ADMIN},
      create: {
        id: 'user-harden-admin',
        email: 'admin.harden@cdktcnqn.edu.vn',
        name: 'Admin Hardening',
        role: UserRole.ADMIN,

      },
    });

    sessionToken = signSessionToken({
      id: staffUser.id,
      email: staffUser.email,
      name: staffUser.name,
      role: staffUser.role,

    });

    // 3. Create test tasks representing diverse scopes, statuses, and overdue states
    // Task 1: Root School Task, In Progress, Future Due Date
    const task1 = await prisma.task.create({
      data: {
        code: 'QCET-HD-001',
        title: 'Nhiệm vụ Trường Kiểm toán Hệ thống',
        description: 'Mô tả chi tiết kiểm toán định kỳ toàn trường',
        scope: TaskScope.SCHOOL,
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.HIGH,
        progressPercent: 30,

        createdById: managerUser.id,
        academicYear: '2026-2027',
        academicMonth: 9,
        dueDate: FUTURE_DUE_DATE,
        actors: {
          create: [{ userId: staffUser.id, role: TaskActorRole.DRI, isPrimaryDRI: true, appointedAt: new Date() }],
        },
      },
    });
    createdTaskIds.push(task1.id);

    // Task 2: Subtask of Task 1, Department Scope, Overdue, In Progress
    const task2 = await prisma.task.create({
      data: {
        code: 'QCET-HD-002',
        title: 'Triển khai Kế hoạch Kiểm thử Đơn vị',
        description: 'Nội dung kế hoạch bộ phận chuyên môn',
        scope: TaskScope.DEPARTMENT,
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.NORMAL,
        progressPercent: 50,

        createdById: managerUser.id,
        parentTaskId: task1.id,
        academicYear: '2026-2027',
        academicMonth: 9,
        startDate: PAST_START_DATE,
        dueDate: OVERDUE_DUE_DATE, // Overdue!
        actors: {
          create: [{ userId: staffUser.id, role: TaskActorRole.COLLABORATOR, isPrimaryDRI: false, appointedAt: new Date() }],
        },
      },
    });
    createdTaskIds.push(task2.id);

    // Task 3: Individual Scope, Completed, Past Due Date (should NOT be classified as overdue)
    const task3 = await prisma.task.create({
      data: {
        code: 'QCET-HD-003',
        title: 'Báo cáo Cá nhân Định kỳ',
        description: 'Tổng hợp số liệu cá nhân gửi trưởng khoa',
        scope: TaskScope.INDIVIDUAL,
        status: TaskStatus.COMPLETED,
        priority: TaskPriority.LOW,
        progressPercent: 100,

        createdById: staffUser.id,
        academicYear: '2026-2027',
        academicMonth: 9,
        startDate: PAST_START_DATE,
        dueDate: OVERDUE_DUE_DATE, // Past due date but COMPLETED
        actors: {
          create: [{ userId: staffUser.id, role: TaskActorRole.DRI, isPrimaryDRI: true, appointedAt: new Date() }],
        },
      },
    });
    createdTaskIds.push(task3.id);

    // Task 4: Department Scope, Other Department, Not Started
    const task4 = await prisma.task.create({
      data: {
        code: 'QCET-HD-004',
        title: 'Xây dựng Định mức Giáo trình Khóa mới',
        description: 'Chỉ đạo chuyên ngành của phòng nghiên cứu',
        scope: TaskScope.DEPARTMENT,
        status: TaskStatus.NOT_STARTED,
        priority: TaskPriority.URGENT,
        progressPercent: 0,

        createdById: managerUser.id,
        academicYear: '2026-2027',
        academicMonth: 10,
        dueDate: FUTURE_DUE_DATE,
        actors: {
          create: [{ userId: managerUser.id, role: TaskActorRole.DRI, isPrimaryDRI: true, appointedAt: new Date() }],
        },
      },
    });
    createdTaskIds.push(task4.id);

    // Task 5: School Scope, Overdue Waiting Approval
    const task5 = await prisma.task.create({
      data: {
        code: 'QCET-HD-005',
        title: 'Phê duyệt Khung Chương trình Đào tạo DACUM',
        description: 'Thẩm định hồ sơ DACUM toàn diện',
        scope: TaskScope.SCHOOL,
        status: TaskStatus.WAITING_APPROVAL,
        priority: TaskPriority.HIGH,
        progressPercent: 90,

        createdById: managerUser.id,
        academicYear: '2026-2027',
        academicMonth: 9,
        startDate: PAST_START_DATE,
        dueDate: OVERDUE_DUE_DATE, // Overdue!
        actors: {
          create: [{ userId: managerUser.id, role: TaskActorRole.DRI, isPrimaryDRI: true, appointedAt: new Date() }],
        },
      },
    });
    createdTaskIds.push(task5.id);

    // Task 6: School Scope, Cancelled Past Due (should NOT be classified as overdue)
    const task6 = await prisma.task.create({
      data: {
        code: 'QCET-HD-006',
        title: 'Nhiệm vụ Hủy bỏ Do Điều chỉnh Mục tiêu',
        description: 'Không tiếp tục thực hiện theo nghị quyết mới',
        scope: TaskScope.SCHOOL,
        status: TaskStatus.CANCELLED,
        priority: TaskPriority.LOW,
        progressPercent: 10,

        createdById: managerUser.id,
        academicYear: '2026-2027',
        academicMonth: 9,
        startDate: PAST_START_DATE,
        dueDate: OVERDUE_DUE_DATE, // Past due date but CANCELLED
        actors: {
          create: [{ userId: managerUser.id, role: TaskActorRole.DRI, isPrimaryDRI: true, appointedAt: new Date() }],
        },
      },
    });
    createdTaskIds.push(task6.id);
  });

  after(async () => {
    // Teardown created tasks
    if (createdTaskIds.length > 0) {
      await prisma.taskActor.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      });
      // Delete subtasks first to satisfy foreign keys
      await prisma.task.deleteMany({
        where: {
          id: { in: createdTaskIds },
          parentTaskId: { not: null },
        },
      });
      await prisma.task.deleteMany({
        where: { id: { in: createdTaskIds } },
      });
    }

    // Teardown users and departments
    await prisma.user.deleteMany({
      where: { id: { in: ['user-harden-staff', 'user-harden-mgr', 'user-harden-admin'] } },
    });
    await prisma.organizationalUnit.deleteMany({
      where: { id: { in: ['DEPT-HARDEN-01', 'DEPT-HARDEN-02'] } },
    });
  });

  describe('1. Database Production Hardening & Indexes (Phase 12)', () => {
    test('Prisma schema defines required composite and foreign key indexes', () => {
      const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');
      const schemaContent = fs.readFileSync(schemaPath, 'utf8');

      // Task indexes
      assert.ok(
        schemaContent.includes('@@index([parentTaskId])'),
        'Task model must declare @@index([parentTaskId])'
      );
      assert.ok(
        schemaContent.includes('@@index([createdById])'),
        'Task model must declare @@index([createdById])'
      );
      assert.ok(
        schemaContent.includes('@@index([scope, status, dueDate])'),
        'Task model must declare @@index([scope, status, dueDate])'
      );

      // Notification indexes
      assert.ok(
        schemaContent.includes('@@index([userId, createdAt(sort: Desc)])'),
        'Notification model must declare @@index([userId, createdAt(sort: Desc)])'
      );
      assert.ok(
        schemaContent.includes('@@index([userId, readAt])'),
        'Notification model must declare @@index([userId, readAt])'
      );

      // Document indexes
      assert.ok(
        schemaContent.includes('@@index([originalNumber])'),
        'Document model must declare @@index([originalNumber])'
      );
    });

  });

  describe('2. Server-Side Offset Pagination (Phase 13)', () => {
    test('calculates correct pagination metadata (page, limit, totalPages, hasMore)', async () => {
      const result = await taskQueryService.queryTasks(
        { user: staffUser },
        {

          page: 1,
          limit: 2,
        }
      );

      assert.equal(result.page, 1);
      assert.equal(result.limit, 2);
      assert.equal(result.tasks.length, 2);
      assert.ok(result.total >= 5, `Expected total >= 5, got ${result.total}`);
      assert.equal(result.pagination.totalPages, Math.ceil(result.total / 2));
      assert.equal(result.hasMore, true);
      assert.equal(result.pagination.hasMore, true);
      assert.ok(result.nextCursor, 'nextCursor must be populated when hasMore is true');
      assert.equal(result.nextCursor, result.tasks[1].id);
    });

    test('handles second page and boundary limits correctly', async () => {
      const page1 = await taskQueryService.queryTasks(
        { user: staffUser },
        {

          page: 1,
          limit: 2,
        }
      );

      const page2 = await taskQueryService.queryTasks(
        { user: staffUser },
        {

          page: 2,
          limit: 2,
        }
      );

      assert.equal(page2.page, 2);
      assert.equal(page2.limit, 2);
      assert.equal(page2.tasks.length, 2);
      // Items on page 2 must be distinct from page 1
      const page1Ids = page1.tasks.map((t) => t.id);
      for (const t of page2.tasks) {
        assert.ok(!page1Ids.includes(t.id), `Task ${t.id} on page 2 should not be on page 1`);
      }
    });

    test('supports all: true to bypass pagination limits', async () => {
      const result = await taskQueryService.queryTasks(
        { user: staffUser },
        {

          all: true,
        }
      );

      assert.equal(result.hasMore, false);
      assert.equal(result.nextCursor, null);
      assert.equal(result.page, 1);
      assert.equal(result.tasks.length, result.total);
    });
  });

  describe('3. Server-Side Cursor-Based Pagination (Phase 13)', () => {
    test('fetches forward pages using cursor and take parameters', async () => {
      // 1. Get first page with take: 2
      const firstPage = await taskQueryService.queryTasks(
        { user: staffUser },
        {

          take: 2,
        }
      );

      assert.equal(firstPage.tasks.length, 2);
      assert.ok(firstPage.hasMore, 'First page must indicate hasMore = true');
      assert.ok(firstPage.nextCursor, 'First page must return nextCursor');

      const firstCursor = firstPage.nextCursor;

      // 2. Query next page using cursor
      const secondPage = await taskQueryService.queryTasks(
        { user: staffUser },
        {

          cursor: firstCursor!,
          take: 2,
        }
      );

      assert.equal(secondPage.tasks.length, 2);
      // Ensure records in second page do not include first page items or the cursor item itself
      const firstPageIds = firstPage.tasks.map((t) => t.id);
      for (const task of secondPage.tasks) {
        assert.ok(
          !firstPageIds.includes(task.id),
          `Second page task ${task.id} must not be in first page`
        );
      }

      // 3. Query beyond second page using new nextCursor
      if (secondPage.hasMore && secondPage.nextCursor) {
        const thirdPage = await taskQueryService.queryTasks(
          { user: staffUser },
          {

            cursor: secondPage.nextCursor,
            take: 2,
          }
        );
        assert.ok(thirdPage.tasks.length >= 1, 'Third page should return remaining tasks');
      }
    });
  });

  describe('4. Server-Side Filtering (Phase 13)', () => {
    test('filters by canonical scope (school, department/unit, individual/personal, my)', async () => {
      // Scope: SCHOOL
      const schoolTasks = await taskQueryService.queryTasks(
        { user: staffUser },
        {

          scope: 'school',
          all: true,
        }
      );
      for (const t of schoolTasks.tasks) {
        assert.equal(t.scope, 'SCHOOL');
      }

      // Scope: DEPARTMENT (unit)
      const deptTasks = await taskQueryService.queryTasks(
        { user: staffUser },
        {

          scope: 'unit',
          all: true,
        }
      );
      for (const t of deptTasks.tasks) {
        assert.equal(t.scope, 'DEPARTMENT');
      }

      // Scope: INDIVIDUAL (personal)
      const personalTasks = await taskQueryService.queryTasks(
        { user: staffUser },
        {

          scope: 'personal',
          all: true,
        }
      );
      for (const t of personalTasks.tasks) {
        assert.equal(t.scope, 'INDIVIDUAL');
      }

      // Scope: my (assigned to staffUser)
      const myTasks = await taskQueryService.queryTasks(
        { user: staffUser },
        {
          scope: 'my',
          all: true,
        }
      );
      const myTaskIds = myTasks.tasks.map((t) => t.id);
      assert.ok(myTaskIds.includes(createdTaskIds[0]), 'Staff user must see task1 in my scope');
      assert.ok(myTaskIds.includes(createdTaskIds[1]), 'Staff user must see task2 in my scope');
      assert.ok(!myTaskIds.includes(createdTaskIds[3]), 'Staff user must NOT see unassigned task4');
    });

    test('filters by status: overdue logic correctly excludes COMPLETED and CANCELLED', async () => {
      const overdueResult = await taskQueryService.queryTasks(
        { user: staffUser },
        {

          status: 'overdue',
          referenceDate: REFERENCE_DATE_STR,
          all: true,
        }
      );

      const overdueIds = overdueResult.tasks.map((t) => t.id);

      // task2 is IN_PROGRESS and due before reference date -> OVERDUE
      assert.ok(
        overdueIds.includes(createdTaskIds[1]),
        'Task 2 (IN_PROGRESS, past due) must be returned as overdue'
      );

      // task5 is WAITING_APPROVAL and due before reference date -> OVERDUE
      assert.ok(
        overdueIds.includes(createdTaskIds[4]),
        'Task 5 (WAITING_APPROVAL, past due) must be returned as overdue'
      );

      // task3 is COMPLETED with past due date -> MUST NOT be in overdue
      assert.ok(
        !overdueIds.includes(createdTaskIds[2]),
        'Task 3 (COMPLETED) must NOT be returned as overdue'
      );

      // task6 is CANCELLED with past due date -> MUST NOT be in overdue
      assert.ok(
        !overdueIds.includes(createdTaskIds[5]),
        'Task 6 (CANCELLED) must NOT be returned as overdue'
      );

      // task1 is future due date -> MUST NOT be in overdue
      assert.ok(
        !overdueIds.includes(createdTaskIds[0]),
        'Task 1 (future due date) must NOT be returned as overdue'
      );
    });

    test('filters by departmentId and dept alias', async () => {
      const res1 = await taskQueryService.queryTasks(
        { user: adminUser },
        {

          all: true,
        }
      );
      assert.equal(res1.tasks.length, 1);
      assert.equal(res1.tasks[0].id, createdTaskIds[3]);

      const res2 = await taskQueryService.queryTasks(
        { user: adminUser },
        {
          dept: otherDept.id,
          all: true,
        }
      );
      assert.equal(res2.tasks.length, 1);
      assert.equal(res2.tasks[0].id, createdTaskIds[3]);
    });

    test('filters by academicMonth/month and academicYear/year', async () => {
      // 1. Scoped to otherDept where task4 is the only task created
      const month10 = await taskQueryService.queryTasks(
        { user: adminUser },
        {

          month: 10,
          year: '2026-2027',
          all: true,
        }
      );
      assert.equal(month10.tasks.length, 1);
      assert.equal(month10.tasks[0].id, createdTaskIds[3]);
      assert.equal(month10.tasks[0].academicMonth, 10);
      assert.equal(month10.tasks[0].academicYear, '2026-2027');

      // 2. Global query also verifies all returned tasks have month 10
      const allMonth10 = await taskQueryService.queryTasks(
        { user: adminUser },
        {
          month: 10,
          year: '2026-2027',
          all: true,
        }
      );
      assert.ok(allMonth10.tasks.length >= 1);
      for (const t of allMonth10.tasks) {
        assert.equal(t.academicMonth, 10);
        assert.equal(t.academicYear, '2026-2027');
      }
    });

    test('filters by parentTaskId (root vs subtasks)', async () => {
      // Root tasks only
      const rootResult = await taskQueryService.queryTasks(
        { user: staffUser },
        {

          parentTaskId: 'root',
          all: true,
        }
      );
      const rootIds = rootResult.tasks.map((t) => t.id);
      assert.ok(rootIds.includes(createdTaskIds[0]), 'Root task1 must be in root tasks');
      assert.ok(!rootIds.includes(createdTaskIds[1]), 'Subtask task2 must NOT be in root tasks');

      // Subtasks of task1
      const subtasksResult = await taskQueryService.queryTasks(
        { user: staffUser },
        {
          parentTaskId: createdTaskIds[0],
          all: true,
        }
      );
      assert.equal(subtasksResult.tasks.length, 1);
      assert.equal(subtasksResult.tasks[0].id, createdTaskIds[1]);
    });

    test('performs case-insensitive search on title, code, and description', async () => {
      // Search by title (case-insensitive: lowercase "kiểm toán" matches "Kiểm toán")
      const titleSearch = await taskQueryService.queryTasks(
        { user: staffUser },
        {
          search: 'kiểm toán',
          all: true,
        }
      );
      const titleIds = titleSearch.tasks.map((t) => t.id);
      assert.ok(titleIds.includes(createdTaskIds[0]), 'Search "kiểm toán" should match task1');

      // Search by code (case-insensitive: "qcet-hd-002" matches "QCET-HD-002")
      const codeSearch = await taskQueryService.queryTasks(
        { user: staffUser },
        {
          q: 'qcet-hd-002',
          all: true,
        }
      );
      assert.equal(codeSearch.tasks.length, 1);
      assert.equal(codeSearch.tasks[0].id, createdTaskIds[1]);

      // Search by description (case-insensitive: "dacum" matches "DACUM")
      const descSearch = await taskQueryService.queryTasks(
        { user: staffUser },
        {
          search: 'dacum',
          all: true,
        }
      );
      const descIds = descSearch.tasks.map((t) => t.id);
      assert.ok(descIds.includes(createdTaskIds[4]), 'Search "dacum" should match task5');
    });
  });

  describe('5. GET /api/tasks Route Handler (Contract & Param Forwarding)', () => {
    test('forwards query params and returns standard { data, pagination, meta } contract', async () => {
      const url = new URL(
        'http://localhost:3000/api/tasks?dept=DEPT-HARDEN-01&status=in_progress&page=1&limit=5&search=kiểm'
      );
      const request = new NextRequest(url, {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
        },
      });

      const response = await getTasksRoute(request);
      assert.equal(response.status, 200);

      const json = await response.json();
      assert.equal(json.success, true);
      assert.ok(Array.isArray(json.data), 'json.data must be an array of tasks');
      assert.ok(json.pagination, 'json.pagination must be present');
      assert.equal(typeof json.pagination.total, 'number');
      assert.equal(typeof json.pagination.page, 'number');
      assert.equal(typeof json.pagination.limit, 'number');
      assert.equal(typeof json.pagination.totalPages, 'number');
      assert.equal(typeof json.pagination.hasMore, 'boolean');

      assert.ok(json.meta, 'json.meta must be present');
      assert.equal(json.meta.page, 1);
      assert.equal(json.meta.limit, 5);

      // Backward compatibility assertions
      assert.ok(Array.isArray(json.tasks));
      assert.equal(typeof json.total, 'number');
    });

    test('supports cursor parameter forwarded via route', async () => {
      // 1. Get first task via API
      const req1 = new NextRequest('http://localhost:3000/api/tasks?dept=DEPT-HARDEN-01&take=1', {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
        },
      });
      const res1 = await getTasksRoute(req1);
      const json1 = await res1.json();
      assert.equal(json1.data.length, 1);
      assert.ok(json1.nextCursor, 'Must have nextCursor');

      // 2. Request next page with cursor
      const req2 = new NextRequest(
        `http://localhost:3000/api/tasks?dept=DEPT-HARDEN-01&take=1&cursor=${json1.nextCursor}`,
        {
          headers: {
            cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
          },
        }
      );
      const res2 = await getTasksRoute(req2);
      const json2 = await res2.json();
      assert.equal(json2.data.length, 1);
      assert.notEqual(json2.data[0].id, json1.data[0].id, 'Cursor page must return subsequent task');
    });
  });
});
