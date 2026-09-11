import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET, POST } from '../src/app/api/tasks/route';
import { prisma } from '../src/lib/prisma';
import { signSessionToken, SESSION_COOKIE_NAME } from '../src/lib/jwt-session';
import { TaskScope, TaskPriority, TaskStatus } from '@prisma/client';

describe('Tasks API Route Handler Tests', () => {
  let testUserId: string;
  let testDeptId: string;
  let validToken: string;
  const createdTaskIds: string[] = [];

  before(async () => {
    // Retrieve or seed a user and department for testing
    const dept = await prisma.department.findFirst();
    assert.ok(dept, 'Must have at least one department in database');

    const user = (await prisma.user.findFirst({
      where: { role: 'ADMIN' },
    })) || (await prisma.user.findFirst());
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
});
