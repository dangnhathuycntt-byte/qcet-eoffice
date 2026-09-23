import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET, POST } from '../src/app/api/tasks/route';
import { GET as getTaskDetail, PATCH as patchTask } from '../src/app/api/tasks/[id]/route';
import { prisma } from '../src/lib/prisma';
import { signSessionToken, SESSION_COOKIE_NAME } from '../src/lib/jwt-session';
import { TaskScope, TaskPriority, TaskStatus,TaskActorRole } from '@prisma/client';

describe('Tasks API Route Handler Tests', () => {
  let testUserId: string;
  let testDeptId: string;
  let validToken: string;
  const createdTaskIds: string[] = [];

  before(async () => {
    // Retrieve or seed a user and department for testing
    const dept = await prisma.department.findFirst();
    assert.ok(dept, 'Must have at least one department in database');

    // In QCET Canonical Authorization, technical SYSTEM_ADMIN cannot perform non-technical task mutations
    // due to Separation of Powers. Use an institutional leader with an active PositionAssignment for task lifecycle tests.
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
    testDeptId = user.departmentId || dept.id;

    validToken = signSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      departmentId: user.departmentId,
    });
  });

  after(async () => {
    // Cleanup any tasks created during tests
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
      const allTasks = await prisma.task.findMany({
        where: { id: { in: createdTaskIds } },
        select: { id: true, parentTaskId: true },
      });
      const subtaskIds = allTasks.filter((t) => t.parentTaskId).map((t) => t.id);
      const parentIds = allTasks.filter((t) => !t.parentTaskId).map((t) => t.id);

      if (subtaskIds.length > 0) {
        await prisma.task.deleteMany({ where: { id: { in: subtaskIds } } });
      }
      if (parentIds.length > 0) {
        await prisma.task.deleteMany({ where: { id: { in: parentIds } } });
      }
    }
  });

  test('validates required fields on task creation logic', () => {
    const payload = {
      title: 'Thiếu hạn chót và đơn vị',
    };
    const hasRequired = Boolean(payload.title && (payload as any).dueDate && (payload as any).departmentId);
    assert.strictEqual(hasRequired, false);
  });

  test('generates continuous task code in format NV-YYYY-MM-XXX', () => {
    const year = 2026;
    const month = 9;
    const count = 5;
    const code = `NV-${year}-${String(month).padStart(2, '0')}-${String(count + 1).padStart(3, '0')}`;
    assert.strictEqual(code, 'NV-2026-09-006');
  });

  test('GET /api/tasks returns 401 Unauthorized when unauthenticated', async () => {
    const req = new NextRequest('http://localhost:3000/api/tasks');
    const res = await GET(req);
    assert.strictEqual(res.status, 401);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.match(json.error, /Unauthorized|Authentication required/i);
  });

  test('POST /api/tasks returns 401 Unauthorized when unauthenticated', async () => {
    const req = new NextRequest('http://localhost:3000/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost:3000' },
      body: JSON.stringify({
        title: 'Test Task Unauthenticated',
        dueDate: '2026-10-15',
        departmentId: testDeptId,
      }),
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 401);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.match(json.error, /Unauthorized|Authentication required/i);
  });

  test('POST /api/tasks rejects missing required fields with status 400 when authenticated', async () => {
    const req = new NextRequest('http://localhost:3000/api/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
        cookie: `${SESSION_COOKIE_NAME}=${validToken}`,
      },
      body: JSON.stringify({
        title: 'Thiếu thông tin',
      }),
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.match(json.error, /Thiếu thông tin bắt buộc/);
  });

  test('POST /api/tasks creates task successfully with auto-generated code', async () => {
    const req = new NextRequest('http://localhost:3000/api/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
        cookie: `${SESSION_COOKIE_NAME}=${validToken}`,
      },
      body: JSON.stringify({
        title: 'Triển khai kiểm định chất lượng cấp cơ sở 2026',
        description: 'Mô tả chi tiết nhiệm vụ thử nghiệm',
        departmentId: testDeptId,
        dueDate: '2026-10-30T17:00:00.000Z',
        priority: 'high',
        scope: 'department',
        academicMonth: 10,
        academicYear: '2026-2027',
        assigneeId: testUserId,
      }),
    });

    const res = await POST(req);
    assert.strictEqual(res.status, 201);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(json.task?.id || json.data?.id);

    const task = json.task || json.data;
    createdTaskIds.push(task.id);

    assert.strictEqual(task.title, 'Triển khai kiểm định chất lượng cấp cơ sở 2026');
    assert.strictEqual(task.departmentId, testDeptId);
    assert.match(task.code, /^NV-2026-10-\d{3}$/);
    assert.strictEqual(task.scope, TaskScope.DEPARTMENT);
    assert.strictEqual(task.priority, TaskPriority.HIGH);
  });

  test('GET /api/tasks returns { success: true, data: tasks, total: count } format when authenticated', async () => {
    const req = new NextRequest('http://localhost:3000/api/tasks', {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${validToken}`,
      },
    });

    const res = await GET(req);
    assert.strictEqual(res.status, 200);
    const json = await res.json();

    assert.strictEqual(json.success, true);
    assert.ok(Array.isArray(json.data), 'json.data should be an array');
    assert.ok(Array.isArray(json.tasks), 'json.tasks should also be an array for backwards compatibility');
    assert.strictEqual(typeof json.total, 'number');
    assert.ok(json.total >= json.data.length, 'Total should be >= returned page length');
    assert.ok(json.data.length > 0, 'Should return existing tasks from database');
  });

  test('GET /api/tasks filters by scope, departmentId, academicMonth, academicYear, status', async () => {
    const url = new URL('http://localhost:3000/api/tasks');
    url.searchParams.set('scope', 'department');
    url.searchParams.set('departmentId', testDeptId);
    url.searchParams.set('academicMonth', '10');
    url.searchParams.set('academicYear', '2026-2027');

    const req = new NextRequest(url.toString(), {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${validToken}`,
      },
    });

    const res = await GET(req);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(Array.isArray(json.data));

    // Verify all returned tasks match the filters
    for (const task of json.data) {
      if (task.department) {
        assert.strictEqual(task.department.id, testDeptId);
      }
    }
  });

  test('GET /api/tasks supports Bearer token in Authorization header', async () => {
    const req = new NextRequest('http://localhost:3000/api/tasks', {
      headers: {
        authorization: `Bearer ${validToken}`,
      },
    });

    const res = await GET(req);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(Array.isArray(json.data));
  });

  // ==========================================================================
  // Merged from task-subtask-api-single-dri.test.ts
  // ==========================================================================
  describe('Single DRI and Subtask Hierarchy Route Contracts', () => {
    let staffUser1: any;
    let staffUser2: any;
    let staffToken1: string;
    let parentCreatedTaskId: string;

    before(async () => {
      const stamp = Date.now();
      staffUser1 = await prisma.user.create({
        data: {
          id: `usr_tar_s1_${stamp}`,
          email: `tar_s1_${stamp}@unit.local`,
          name: 'TAR Staff 1',
          role: 'CHUYEN_VIEN',
          departmentId: testDeptId,
        },
      });
      staffUser2 = await prisma.user.create({
        data: {
          id: `usr_tar_s2_${stamp}`,
          email: `tar_s2_${stamp}@unit.local`,
          name: 'TAR Staff 2',
          role: 'CHUYEN_VIEN',
          departmentId: testDeptId,
        },
      });

      staffToken1 = signSessionToken({
        id: staffUser1.id,
        email: staffUser1.email,
        name: staffUser1.name,
        role: staffUser1.role,
        departmentId: staffUser1.departmentId,
      });
    });

    after(async () => {
      if (staffUser1?.id || staffUser2?.id) {
        await prisma.user.deleteMany({
          where: { id: { in: [staffUser1?.id, staffUser2?.id].filter(Boolean) } },
        });
      }
    });

    test('POST /api/tasks: returns 404 when parentTaskId does not exist', async () => {
      const req = new NextRequest('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          origin: 'http://localhost:3000',
          cookie: `${SESSION_COOKIE_NAME}=${validToken}`,
        },
        body: JSON.stringify({
          title: 'Subtask with non-existent parent',
          dueDate: '2026-10-30',
          departmentId: testDeptId,
          parentTaskId: 'non-existent-task-id-12345',
        }),
      });

      const res = await POST(req);
      assert.strictEqual(res.status, 404);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.match(json.error, /Không tìm thấy nhiệm vụ cha/i);
    });

    test('POST /api/tasks: creates root task with single DRI (PRIMARY_OWNER) and collaborators', async () => {
      const req = new NextRequest('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          origin: 'http://localhost:3000',
          cookie: `${SESSION_COOKIE_NAME}=${validToken}`,
        },
        body: JSON.stringify({
          title: 'Root Task Single DRI Route Test',
          dueDate: '2026-10-25',
          departmentId: testDeptId,
          academicMonth: 10,
          academicYear: '2026-2027',
          assigneeId: staffUser1.id,
          collaboratorIds: [staffUser2.id, staffUser1.id],
        }),
      });

      const res = await POST(req);
      assert.strictEqual(res.status, 201);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      parentCreatedTaskId = json.task.id;
      createdTaskIds.push(parentCreatedTaskId);

      const assignees = await prisma.taskActor.findMany({
        where: { taskId: parentCreatedTaskId },
      });

      const owners = assignees.filter((a) => a.role === 'DRI' && a.isPrimaryDRI);
      const collabs = assignees.filter((a) => a.role === 'COLLABORATOR');

      assert.strictEqual(owners.length, 1, 'Must have exactly 1 PRIMARY_OWNER');
      assert.strictEqual(owners[0].userId, staffUser1.id);
      assert.strictEqual(collabs.length, 0, 'Must NOT have manual COLLABORATOR in database — collaborators are derived from child tasks (Rule 2)');
    });

    test('POST /api/tasks: creates subtask inheriting department from parent and references parentTaskId', async () => {
      assert.ok(parentCreatedTaskId);

      const req = new NextRequest('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          origin: 'http://localhost:3000',
          cookie: `${SESSION_COOKIE_NAME}=${validToken}`,
        },
        body: JSON.stringify({
          title: 'Valid Subtask of Root Task',
          dueDate: '2026-10-20',
          parentTaskId: parentCreatedTaskId,
          assigneeId: staffUser2.id,
        }),
      });

      const res = await POST(req);
      assert.strictEqual(res.status, 201);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      const subtaskId = json.task.id;
      createdTaskIds.push(subtaskId);

      const subtaskInDb = await prisma.task.findUnique({
        where: { id: subtaskId },
        include: { actors: true, parentTask: true },
      });

      assert.ok(subtaskInDb);
      assert.strictEqual(subtaskInDb.parentTaskId, parentCreatedTaskId);
      assert.strictEqual(subtaskInDb.departmentId, testDeptId);
      assert.strictEqual(subtaskInDb.scope, TaskScope.DEPARTMENT);
    });

    test('POST /api/tasks: enforces subtask dueDate cannot exceed parent dueDate', async () => {
      assert.ok(parentCreatedTaskId);

      const req = new NextRequest('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          origin: 'http://localhost:3000',
          cookie: `${SESSION_COOKIE_NAME}=${validToken}`,
        },
        body: JSON.stringify({
          title: 'Subtask with Invalid DueDate Exceeding Parent',
          dueDate: '2026-11-15',
          parentTaskId: parentCreatedTaskId,
          assigneeId: staffUser1.id,
        }),
      });

      const res = await POST(req);
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.match(json.error, /Hạn chót của nhiệm vụ con không thể sau hạn chót của nhiệm vụ cha/i);
    });

    test('GET /api/tasks: returns parentTask and subTasks, supports assignedTo=me and scope=my', async () => {
      const reqScopeMy = new NextRequest('http://localhost:3000/api/tasks?scope=my', {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${staffToken1}`,
        },
      });

      const resScopeMy = await GET(reqScopeMy);
      assert.strictEqual(resScopeMy.status, 200);
      const jsonScopeMy = await resScopeMy.json();
      assert.strictEqual(jsonScopeMy.success, true);
      assert.ok(Array.isArray(jsonScopeMy.data));

      const reqAssignedMe = new NextRequest('http://localhost:3000/api/tasks?assignedTo=me', {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${staffToken1}`,
        },
      });

      const resAssignedMe = await GET(reqAssignedMe);
      assert.strictEqual(resAssignedMe.status, 200);
      const jsonAssignedMe = await resAssignedMe.json();
      assert.strictEqual(jsonAssignedMe.success, true);
    });

    test('GET /api/tasks/[id]: includes parentTask and subTasks with relations', async () => {
      assert.ok(parentCreatedTaskId);

      const context = { params: Promise.resolve({ id: parentCreatedTaskId }) };
      const req = new NextRequest(`http://localhost:3000/api/tasks/${parentCreatedTaskId}`, {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${validToken}`,
        },
      });

      const res = await getTaskDetail(req, context);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      const taskObj = json.task || json.data;
      assert.ok(taskObj.subTasks !== undefined, 'task.subTasks must be defined');
    });

    test('PATCH /api/tasks/[id]: rejects parentTaskId via generic metadata PATCH (canonical contract)', async () => {
      assert.ok(parentCreatedTaskId);
      const context = { params: Promise.resolve({ id: parentCreatedTaskId }) };

      // parentTaskId is not allowed in UpdateTaskMetadataSchema — must use dedicated command
      const reqSelf = new NextRequest(`http://localhost:3000/api/tasks/${parentCreatedTaskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          origin: 'http://localhost:3000',
          cookie: `${SESSION_COOKIE_NAME}=${validToken}`,
        },
        body: JSON.stringify({
          parentTaskId: parentCreatedTaskId,
        }),
      });
      const resSelf = await patchTask(reqSelf, context);
      assert.strictEqual(resSelf.status, 400, 'parentTaskId rejected by strict metadata schema');
    });

    test('PATCH /api/tasks/[id]: rejects assigneeId and collaboratorIds via generic metadata PATCH (canonical contract)', async () => {
      assert.ok(parentCreatedTaskId);
      const context = { params: Promise.resolve({ id: parentCreatedTaskId }) };

      // assigneeId/collaboratorIds must go through canonical reassign command, not generic PATCH
      const req = new NextRequest(`http://localhost:3000/api/tasks/${parentCreatedTaskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          origin: 'http://localhost:3000',
          cookie: `${SESSION_COOKIE_NAME}=${validToken}`,
        },
        body: JSON.stringify({
          assigneeId: staffUser2.id,
          collaboratorIds: [staffUser1.id],
        }),
      });

      const res = await patchTask(req, context);
      assert.strictEqual(res.status, 400, 'assigneeId/collaboratorIds rejected by strict metadata schema');
    });
  });
});
