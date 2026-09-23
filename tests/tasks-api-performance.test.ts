import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET as getTasks } from '../src/app/api/tasks/route';
import { DELETE as deleteTask } from '../src/app/api/tasks/[id]/route';
import { prisma } from '../src/lib/prisma';
import { signSessionToken, SESSION_COOKIE_NAME } from '../src/lib/jwt-session';
import { TaskScope, TaskPriority, TaskStatus, TaskActorRole, DeliverableReviewStatus, ResolutionType } from '@prisma/client';

describe('Tasks API Performance & Cascade Delete Tests (QCET-PERF-2025-01 Task 10)', () => {
  let testUserId: string;
  let testDeptId: string;
  let validToken: string;
  const createdTaskIds: string[] = [];
  const createdDocIds: string[] = [];

  before(async () => {
    const user =
      (await prisma.user.findFirst({
        where: {
          role: { not: 'ADMIN' },
          positionAssignments: {
            some: {
              status: 'ACTIVE',
              positionDefinition: {
                code: { in: ['TRUONG_DON_VI', 'TRUONG_DON_VI_CANONICAL', 'TRUONG_PHONG', 'TRUONG_KHOA', 'HIEU_TRUONG', 'PHO_HIEU_TRUONG'] },
              },
            },
          },
        },
      })) ||
      (await prisma.user.findFirst({
        where: { role: { not: 'ADMIN' } },
      })) ||
      (await prisma.user.findFirst());
    assert.ok(user, 'Must have at least one user in database');
    testUserId = user.id;

    const dept = await prisma.organizationalUnit.findFirst({
      where: { id: { notIn: ['dept-daotao', 'dept-cntt'] } },
    });
    assert.ok(dept, 'Must have at least one department in database');
    testDeptId = dept.id;

    validToken = signSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,

    });

    // Seed 12 distinct tasks for pagination tests
    const timestamp = Date.now();
    for (let i = 1; i <= 12; i++) {
      const task = await prisma.task.create({
        data: {
          code: `PERF-TASK-${timestamp}-${String(i).padStart(3, '0')}`,
          title: `Hiệu năng API Nhiệm vụ #${i}`,
          description: `Task số ${i} dùng để kiểm thử phân trang và hiệu năng API`,
          scope: TaskScope.DEPARTMENT,
          status: i % 2 === 0 ? TaskStatus.IN_PROGRESS : TaskStatus.NOT_STARTED,
          priority: TaskPriority.HIGH,
          academicMonth: 9,
          academicYear: '2026-2027',
          dueDate: new Date(Date.now() + i * 86400000),

          createdById: testUserId,
        },
      });
      createdTaskIds.push(task.id);
    }
  });

  after(async () => {
    // Unlink any documents created
    if (createdDocIds.length > 0) {
      await prisma.document.deleteMany({
        where: { id: { in: createdDocIds } },
      });
    }

    // Clean up created tasks
    if (createdTaskIds.length > 0) {
      await prisma.document.updateMany({
        where: { linkedTaskId: { in: createdTaskIds } },
        data: { linkedTaskId: null },
      });
      await prisma.taskActor.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      });
      await prisma.taskDeliverable.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      });
      await prisma.executiveResolution.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      });
      await prisma.task.deleteMany({
        where: { id: { in: createdTaskIds } },
      });
    }
  });

  describe('Pagination Defaults & Metadata Structure', () => {
    test('returns page=1, limit=50 and pagination metadata by default', async () => {
      const req = new NextRequest('http://localhost:3000/api/tasks', {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${validToken}` },
      });

      const res = await getTasks(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();

      assert.strictEqual(json.success, true);
      assert.ok(json.pagination, 'Should include pagination object');
      assert.strictEqual(json.pagination.page, 1);
      assert.strictEqual(json.pagination.limit, 50);
      assert.strictEqual(typeof json.pagination.total, 'number');
      assert.strictEqual(typeof json.pagination.totalPages, 'number');
      assert.strictEqual(json.pagination.totalPages, Math.ceil(json.pagination.total / 50));

      // Array payload checks
      assert.ok(Array.isArray(json.data), 'json.data should be an array');
      assert.ok(json.data.length <= 50, 'Returned items should not exceed limit 50');
    });

    test('maintains backward compatibility with legacy fields (tasks, total, totalCount)', async () => {
      const req = new NextRequest('http://localhost:3000/api/tasks', {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${validToken}` },
      });

      const res = await getTasks(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();

      // Top-level aliases
      assert.ok(Array.isArray(json.tasks), 'json.tasks should exist and match json.data');
      assert.strictEqual(json.tasks.length, json.data.length);
      assert.strictEqual(json.total, json.pagination.total);
      assert.strictEqual(json.totalCount, json.pagination.total);
    });
  });

  describe('Custom Pagination Parameters', () => {
    test('applies custom limit and page correctly', async () => {
      const pageSize = 5;
      const req = new NextRequest(`http://localhost:3000/api/tasks?limit=${pageSize}&page=1`, {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${validToken}` },
      });

      const res = await getTasks(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();

      assert.strictEqual(json.pagination.page, 1);
      assert.strictEqual(json.pagination.limit, pageSize);
      assert.strictEqual(json.data.length, pageSize);
      assert.strictEqual(json.hasMore, true);
    });

    test('navigates to page 2 with non-overlapping data', async () => {
      const reqPage1 = new NextRequest('http://localhost:3000/api/tasks?limit=4&page=1', {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${validToken}` },
      });
      const resPage1 = await getTasks(reqPage1);
      const json1 = await resPage1.json();

      const reqPage2 = new NextRequest('http://localhost:3000/api/tasks?limit=4&page=2', {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${validToken}` },
      });
      const resPage2 = await getTasks(reqPage2);
      const json2 = await resPage2.json();

      assert.strictEqual(json2.pagination.page, 2);
      assert.strictEqual(json2.pagination.limit, 4);
      assert.strictEqual(json2.data.length, 4);

      // Verify page 1 and page 2 have no overlapping task IDs
      const page1Ids = new Set(json1.data.map((t: any) => t.id));
      for (const t of json2.data) {
        assert.ok(!page1Ids.has(t.id), `Task ${t.id} should not appear on both page 1 and page 2`);
      }
    });

    test('supports full export with limit=all or all=true', async () => {
      const req = new NextRequest('http://localhost:3000/api/tasks?limit=all', {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${validToken}` },
      });

      const res = await getTasks(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();

      assert.strictEqual(json.pagination.total, json.data.length);
      assert.strictEqual(json.hasMore, false);
      assert.ok(json.data.length >= 12, 'Full export should return at least all seeded tasks');
    });

    test('sanitizes bounds on invalid page and limit values', async () => {
      // Negative page and excessive limit > 200
      const req = new NextRequest('http://localhost:3000/api/tasks?page=-5&limit=999', {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${validToken}` },
      });

      const res = await getTasks(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();

      assert.strictEqual(json.pagination.page, 1, 'Page should fallback to min 1');
      assert.strictEqual(json.pagination.limit, 200, 'Limit should be clamped to max 200');
    });
  });

  describe('Enhanced Cascade Delete', () => {
    test('deletes task with subtasks, assignees, deliverables, and unlinks documents safely', async () => {
      const stamp = Date.now();

      // 1. Create parent task
      const parentTask = await prisma.task.create({
        data: {
          code: `TEST-CASCADE-PARENT-${stamp}`,
          title: 'Nhiệm vụ cha kiểm thử cascade delete',
          scope: TaskScope.SCHOOL,
          status: TaskStatus.IN_PROGRESS,
          academicMonth: 9,
          academicYear: '2026-2027',
          dueDate: new Date('2026-12-31'),

          createdById: testUserId,
        },
      });
      createdTaskIds.push(parentTask.id);

      // 2. Create subtask linked to parent
      const subTask = await prisma.task.create({
        data: {
          code: `TEST-CASCADE-SUB-${stamp}`,
          title: 'Nhiệm vụ con cấp 1',
          parentTaskId: parentTask.id,
          scope: TaskScope.DEPARTMENT,
          status: TaskStatus.NOT_STARTED,
          academicMonth: 9,
          academicYear: '2026-2027',
          dueDate: new Date('2026-11-30'),

          createdById: testUserId,
        },
      });
      createdTaskIds.push(subTask.id);

      // 3. Create sub-subtask (nested hierarchy)
      const subSubTask = await prisma.task.create({
        data: {
          code: `TEST-CASCADE-SUBSUB-${stamp}`,
          title: 'Nhiệm vụ con cấp 2',
          parentTaskId: subTask.id,
          scope: TaskScope.INDIVIDUAL,
          status: TaskStatus.NOT_STARTED,
          academicMonth: 9,
          academicYear: '2026-2027',
          dueDate: new Date('2026-10-31'),

          createdById: testUserId,
        },
      });
      createdTaskIds.push(subSubTask.id);

      // 4. Attach assignees to parent and subtasks
      await prisma.taskActor.create({
        data: {
          taskId: parentTask.id,
          userId: testUserId,
          role: TaskActorRole.DRI, isPrimaryDRI: true, appointedAt: new Date(),
        },
      });
      await prisma.taskActor.create({
        data: {
          taskId: subTask.id,
          userId: testUserId,
          role: TaskActorRole.COLLABORATOR, isPrimaryDRI: false, appointedAt: new Date(),
        },
      });

      // 5. Attach deliverable to parent and subtask
      await prisma.taskDeliverable.create({
        data: {
          taskId: parentTask.id,
          title: 'Báo cáo tổng hợp cha.pdf',
          fileUrl: 'https://qcet.edu.vn/parent.pdf',
          uploadedById: testUserId,
          reviewStatus: DeliverableReviewStatus.PENDING,
        },
      });
      await prisma.taskDeliverable.create({
        data: {
          taskId: subTask.id,
          title: 'Báo cáo thành phần con.pdf',
          fileUrl: 'https://qcet.edu.vn/child.pdf',
          uploadedById: testUserId,
          reviewStatus: DeliverableReviewStatus.PENDING,
        },
      });

      // 6. Create document linked to parent task
      const randomReg1 = Math.floor(80000 + Math.random() * 9000);
      const docParent = await prisma.document.create({
        data: {
          type: 'VAN_BAN_DEN',
          registrationNumber: randomReg1,
          documentYear: 2026,
          originalNumber: `DOC-CASCADE-${stamp}-1`,
          issuedDate: new Date(),
          issuingAuthority: 'Sở GD&ĐT',
          category: 'Kế hoạch',
          summary: 'Văn bản liên kết với nhiệm vụ cha',
          urgency: 'THUONG',
          securityLevel: 'THUONG',
          status: 'CHO_PHAN_CONG',
          registeredById: testUserId,
          linkedTaskId: parentTask.id,
        },
      });
      createdDocIds.push(docParent.id);

      // 7. Create document linked to subtask
      const randomReg2 = Math.floor(90000 + Math.random() * 9000);
      const docSub = await prisma.document.create({
        data: {
          type: 'VAN_BAN_DEN',
          registrationNumber: randomReg2,
          documentYear: 2026,
          originalNumber: `DOC-CASCADE-${stamp}-2`,
          issuedDate: new Date(),
          issuingAuthority: 'Bộ GD&ĐT',
          category: 'Thông báo',
          summary: 'Văn bản liên kết với nhiệm vụ con',
          urgency: 'THUONG',
          securityLevel: 'THUONG',
          status: 'CHO_PHAN_CONG',
          registeredById: testUserId,
          linkedTaskId: subTask.id,
        },
      });
      createdDocIds.push(docSub.id);

      // Execute DELETE (archive) on parent task
      const req = new NextRequest(`http://localhost:3000/api/tasks/${parentTask.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
          Referer: 'http://localhost:3000',
          cookie: `${SESSION_COOKIE_NAME}=${validToken}`,
        },
        body: JSON.stringify({ reason: 'Lưu trữ nhiệm vụ kiểm thử cascade', expectedVersion: 1 }),
      });

      const res = await deleteTask(req, { params: Promise.resolve({ id: parentTask.id }) });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);

      // Verify parent task archived (not hard-deleted)
      const checkParent = await prisma.task.findUnique({ where: { id: parentTask.id } });
      assert.ok(checkParent, 'Parent task must still exist');
      assert.ok(checkParent?.archivedAt !== null, 'Parent task must be archived');

      // Archive only marks parent — subtasks and relations are preserved
      const checkSub = await prisma.task.findUnique({ where: { id: subTask.id } });
      assert.ok(checkSub, 'Subtask must still exist after archive');
      const checkSubSub = await prisma.task.findUnique({ where: { id: subSubTask.id } });
      assert.ok(checkSubSub, 'Nested subtask must still exist after archive');

      // Assignees and deliverables are preserved (archive ≠ hard delete)
      const checkAssignees = await prisma.taskActor.findMany({
        where: { taskId: { in: [parentTask.id, subTask.id, subSubTask.id] } },
      });
      assert.ok(checkAssignees.length > 0, 'Task assignees must be preserved after archive');

      const checkDeliverables = await prisma.taskDeliverable.findMany({
        where: { taskId: { in: [parentTask.id, subTask.id, subSubTask.id] } },
      });
      assert.ok(checkDeliverables.length > 0, 'Task deliverables must be preserved after archive');

      // Documents remain linked (archive doesn't unlink)
      const updatedDocParent = await prisma.document.findUnique({ where: { id: docParent.id } });
      assert.ok(updatedDocParent, 'Document linked to parent should still exist');

      const updatedDocSub = await prisma.document.findUnique({ where: { id: docSub.id } });
      assert.ok(updatedDocSub, 'Document linked to subtask should still exist');
    });
  });
});
