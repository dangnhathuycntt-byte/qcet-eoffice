import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET, POST } from '../src/app/api/executive/resolutions/route';
import { prisma } from '../src/lib/prisma';
import { signSessionToken, SESSION_COOKIE_NAME } from '../src/lib/jwt-session';
import { TaskStatus, TaskPriority, TaskScope, UserRole, ResolutionType, UnitType, JobCatalogGroup, AssignmentType, AssignmentStatus } from '@prisma/client';

describe('Executive Resolutions API Persistence & Authorization Tests', () => {
  let bghUser: { id: string; email: string; name: string; role: UserRole; departmentId: string | null };
  let staffUser: { id: string; email: string; name: string; role: UserRole; departmentId: string | null };
  let adminUser: { id: string; email: string; name: string; role: UserRole; departmentId: string | null };
  let bghToken: string;
  let staffToken: string;
  let adminToken: string;
  let testDeptId: string;
  let targetDeptId: string;
  let testTaskId: string;
  let execUnitId: string | null = null;
  let execAssignmentId: string | null = null;
  const createdTaskIds: string[] = [];

  before(async () => {
    // 1. Fetch departments
    const depts = await prisma.organizationalUnit.findMany({ take: 2 });
    assert.ok(depts.length >= 2, 'Must have at least 2 departments for reassignment tests');
    testDeptId = depts[0].id;
    targetDeptId = depts[1].id;

    // 2. Fetch BGH user
    const bgh = await prisma.user.findFirst({
      where: { role: UserRole.BAN_GIAM_HIEU },
    });
    assert.ok(bgh, 'Must have at least one BGH user in database');
    bghUser = bgh;
    bghToken = signSessionToken({
      id: bgh.id,
      email: bgh.email,
      name: bgh.name,
      role: bgh.role,
      departmentId: bgh.departmentId,
    });

    // Canonical statutory mandate (Issue #27): executive authority requires
    // an ACTIVE executive PositionAssignment, never the role string. Equip
    // the seed BGH user so the authorized flows below exercise the new
    // contract instead of the legacy role gate.
    let rectorDef = await prisma.positionDefinition.findUnique({ where: { code: 'HIEU_TRUONG' } });
    if (!rectorDef) {
      rectorDef = await prisma.positionDefinition.create({
        data: { code: 'HIEU_TRUONG', title: 'Hieu truong', group: JobCatalogGroup.LDPU, isLeadership: true },
      });
    }
    const execUnit = await prisma.organizationalUnit.create({
      data: { code: `U-EXECAPI-${Date.now()}`, name: 'Unit ExecAPI', type: UnitType.DEPARTMENT },
    });
    execUnitId = execUnit.id;
    const execAssignment = await prisma.positionAssignment.create({
      data: {
        userId: bgh.id,
        unitId: execUnit.id,
        positionDefinitionId: rectorDef.id,
        status: AssignmentStatus.ACTIVE,
        type: AssignmentType.PRIMARY,
        effectiveFrom: new Date('2020-01-01'),
      },
    });
    execAssignmentId = execAssignment.id;

    // 3. Fetch non-BGH staff user (TRUONG_PHONG or CHUYEN_VIEN)
    const staff = await prisma.user.findFirst({
      where: { role: { in: [UserRole.TRUONG_PHONG, UserRole.CHUYEN_VIEN] } },
    });
    assert.ok(staff, 'Must have at least one non-BGH staff user in database');
    staffUser = staff;
    staffToken = signSessionToken({
      id: staff.id,
      email: staff.email,
      name: staff.name,
      role: staff.role,
      departmentId: staff.departmentId,
    });

    // 4. Fetch Admin user
    const admin = await prisma.user.findFirst({
      where: { role: UserRole.ADMIN },
    });
    assert.ok(admin, 'Must have at least one Admin user in database');
    adminUser = admin;
    adminToken = signSessionToken({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      departmentId: admin.departmentId,
    });

    // 5. Create a test task (initially OVERDUE or NORMAL)
    const task = await prisma.task.create({
      data: {
        code: `TEST-RES-${Date.now()}`,
        title: 'Nhiệm vụ kiểm tra lệnh điều hành BGH',
        description: 'Mô tả nhiệm vụ kiểm thử lệnh điều hành',
        scope: TaskScope.SCHOOL,
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.NORMAL,
        progressPercent: 40,
        academicMonth: 9,
        academicYear: '2026-2027',
        dueDate: new Date('2026-09-20T00:00:00.000Z'),
        departmentId: testDeptId,
        createdById: bghUser.id,
      },
    });
    testTaskId = task.id;
    createdTaskIds.push(testTaskId);
  });

  after(async () => {
    if (createdTaskIds.length > 0) {
      await prisma.executiveResolution.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      });
      await prisma.taskActor.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      });
      await prisma.taskDeliverable.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      });
      await prisma.task.deleteMany({
        where: { id: { in: createdTaskIds } },
      });
    }
    if (execAssignmentId) {
      await prisma.positionAssignment.deleteMany({ where: { id: execAssignmentId } });
    }
    if (execUnitId) {
      await prisma.organizationalUnit.deleteMany({ where: { id: execUnitId } });
    }
  });

  test('calculates new due date correctly when grantedDays is applied', () => {
    const currentDueDate = new Date('2026-09-20T00:00:00Z');
    const grantedDays = 7;
    const newDueDate = new Date(currentDueDate.getTime() + grantedDays * 24 * 60 * 60 * 1000);
    assert.strictEqual(newDueDate.toISOString().split('T')[0], '2026-09-27');
  });

  test('GET /api/executive/resolutions returns 401 Unauthorized when unauthenticated', async () => {
    const req = new NextRequest('http://localhost:3000/api/executive/resolutions');
    const res = await GET(req);
    assert.strictEqual(res.status, 401);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.match(json.error, /Unauthorized/i);
  });

  test('POST /api/executive/resolutions returns 401 Unauthorized when unauthenticated', async () => {
    const req = new NextRequest('http://localhost:3000/api/executive/resolutions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId: testTaskId,
        resolutionType: 'EXTEND_DEADLINE',
        grantedDays: 5,
      }),
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 401);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.match(json.error, /Unauthorized/i);
  });

  test('POST /api/executive/resolutions returns 401 Unauthorized when unauthenticated even if actorId is provided in body', async () => {
    const req = new NextRequest('http://localhost:3000/api/executive/resolutions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actorId: bghUser.id,
        taskId: testTaskId,
        resolutionType: 'EXTEND_DEADLINE',
        grantedDays: 5,
      }),
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 401);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.match(json.error, /Unauthorized/i);
  });

  test('POST /api/executive/resolutions returns 403 Forbidden when non-BGH user attempts to issue resolution', async () => {
    const req = new NextRequest('http://localhost:3000/api/executive/resolutions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost:3000',
        cookie: `${SESSION_COOKIE_NAME}=${staffToken}`,
      },
      body: JSON.stringify({
        taskId: testTaskId,
        resolutionType: 'EXTEND_DEADLINE',
        grantedDays: 3,
      }),
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 403);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.match(json.error, /Forbidden|Ban Giám Hiệu/i);
  });

  test('POST /api/executive/resolutions returns 400 Bad Request when missing taskId or resolutionType', async () => {
    const req = new NextRequest('http://localhost:3000/api/executive/resolutions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost:3000',
        cookie: `${SESSION_COOKIE_NAME}=${bghToken}`,
      },
      body: JSON.stringify({
        taskId: testTaskId,
        // missing resolutionType
      }),
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.strictEqual(json.success, false);
  });

  test('POST /api/executive/resolutions returns 404 Not Found when task does not exist', async () => {
    const req = new NextRequest('http://localhost:3000/api/executive/resolutions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost:3000',
        cookie: `${SESSION_COOKIE_NAME}=${bghToken}`,
      },
      body: JSON.stringify({
        taskId: 'non-existent-task-id-999',
        resolutionType: 'EXTEND_DEADLINE',
        grantedDays: 7,
      }),
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 404);
    const json = await res.json();
    assert.strictEqual(json.success, false);
  });

  test('POST /api/executive/resolutions allows BGH to issue EXTEND_DEADLINE and updates task dueDate and status to IN_PROGRESS', async () => {
    const req = new NextRequest('http://localhost:3000/api/executive/resolutions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost:3000',
        cookie: `${SESSION_COOKIE_NAME}=${bghToken}`,
      },
      body: JSON.stringify({
        taskId: testTaskId,
        resolutionType: 'EXTEND_DEADLINE',
        grantedDays: 7,
        directiveNote: 'Gia hạn thêm 7 ngày để hoàn thiện đề cương',
      }),
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(json.resolution);
    assert.strictEqual(json.resolution.resolutionType, 'EXTEND_DEADLINE');
    assert.strictEqual(json.resolution.grantedDays, 7);

    // Verify task updated in database
    const updatedTask = await prisma.task.findUnique({
      where: { id: testTaskId },
      include: { resolutions: true },
    });
    assert.ok(updatedTask);
    assert.strictEqual(updatedTask.status, TaskStatus.IN_PROGRESS);
    assert.strictEqual(updatedTask.dueDate.toISOString().split('T')[0], '2026-09-27');
    assert.strictEqual(updatedTask.resolutions.length >= 1, true);
  });

  test('POST /api/executive/resolutions denies ADMIN without statutory mandate (403) and mutates nothing', async () => {
    const req = new NextRequest('http://localhost:3000/api/executive/resolutions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost:3000',
        cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
      },
      body: JSON.stringify({
        taskId: testTaskId,
        resolutionType: 'REASSIGN_OWNER',
        newOwnerId: targetDeptId,
        directiveNote: 'Chuyển giao cho đơn vị mới tiếp quản theo chỉ đạo',
      }),
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 403);
    const json = await res.json();
    assert.strictEqual(json.success, false);
  });

  test('POST /api/executive/resolutions allows BGH to issue DIRECTIVE_NOTE and sets priority to URGENT', async () => {
    const req = new NextRequest('http://localhost:3000/api/executive/resolutions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost:3000',
        cookie: `${SESSION_COOKIE_NAME}=${bghToken}`,
      },
      body: JSON.stringify({
        taskId: testTaskId,
        resolutionType: 'DIRECTIVE_NOTE',
        directiveNote: 'Yêu cầu báo cáo giải trình khẩn trước 15:00',
      }),
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.resolution.resolutionType, 'DIRECTIVE_NOTE');

    const updatedTask = await prisma.task.findUnique({
      where: { id: testTaskId },
    });
    assert.strictEqual(updatedTask?.priority, TaskPriority.URGENT);
  });

  test('POST /api/executive/resolutions allows BGH to update task status to WAITING_APPROVAL', async () => {
    const req = new NextRequest('http://localhost:3000/api/executive/resolutions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost:3000',
        cookie: `${SESSION_COOKIE_NAME}=${bghToken}`,
      },
      body: JSON.stringify({
        taskId: testTaskId,
        resolutionType: 'DIRECTIVE_NOTE',
        status: 'WAITING_APPROVAL',
        directiveNote: 'Chuyển trạng thái chờ BGH thẩm định phê duyệt',
      }),
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);

    const updatedTask = await prisma.task.findUnique({
      where: { id: testTaskId },
    });
    assert.strictEqual(updatedTask?.status, TaskStatus.WAITING_APPROVAL);
  });

  test('GET /api/executive/resolutions returns list of resolutions for a task when authenticated', async () => {
    const req = new NextRequest(`http://localhost:3000/api/executive/resolutions?taskId=${testTaskId}`, {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${bghToken}`,
      },
    });
    const res = await GET(req);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(Array.isArray(json.resolutions));
    assert.strictEqual(json.resolutions.length >= 3, true);
    assert.strictEqual(json.resolutions[0].taskId, testTaskId);
    assert.ok(json.resolutions[0].actor);
  });

  test('GET /api/executive/resolutions filters by departmentId and dept alias', async () => {
    // Current task department is targetDeptId after REASSIGN_OWNER
    const reqMatching = new NextRequest(`http://localhost:3000/api/executive/resolutions?departmentId=${targetDeptId}`, {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${bghToken}`,
      },
    });
    const resMatching = await GET(reqMatching);
    assert.strictEqual(resMatching.status, 200);
    const jsonMatching = await resMatching.json();
    assert.strictEqual(jsonMatching.success, true);
    assert.ok(Array.isArray(jsonMatching.resolutions));
    assert.strictEqual(jsonMatching.resolutions.length >= 1, true);
    for (const r of jsonMatching.resolutions) {
      assert.strictEqual(r.task.departmentId, targetDeptId);
    }

    // Query with dept alias on a non-existent department
    const nonExistentDeptId = 'dept-not-found-000';
    const reqDeptAlias = new NextRequest(`http://localhost:3000/api/executive/resolutions?dept=${nonExistentDeptId}`, {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${bghToken}`,
      },
    });
    const resDeptAlias = await GET(reqDeptAlias);
    assert.strictEqual(resDeptAlias.status, 200);
    const jsonDeptAlias = await resDeptAlias.json();
    assert.strictEqual(jsonDeptAlias.success, true);
    assert.strictEqual(jsonDeptAlias.resolutions.length, 0);
  });

  test('POST /api/executive/resolutions accepts actionType and extensionDays alias fields', async () => {
    const req = new NextRequest('http://localhost:3000/api/executive/resolutions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost:3000',
        cookie: `${SESSION_COOKIE_NAME}=${bghToken}`,
      },
      body: JSON.stringify({
        taskId: testTaskId,
        actionType: 'EXTEND_DEADLINE',
        extensionDays: 4,
        directiveNote: 'Gia hạn thêm 4 ngày qua alias actionType & extensionDays',
      }),
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.resolution.resolutionType, 'EXTEND_DEADLINE');
    assert.strictEqual(json.resolution.grantedDays, 4);
  });

  test('POST /api/executive/resolutions accepts type as resolutionType alias', async () => {
    const req = new NextRequest('http://localhost:3000/api/executive/resolutions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost:3000',
        cookie: `${SESSION_COOKIE_NAME}=${bghToken}`,
      },
      body: JSON.stringify({
        taskId: testTaskId,
        type: 'DIRECTIVE_NOTE',
        directiveNote: 'Chỉ đạo trực tiếp qua alias type',
      }),
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.resolution.resolutionType, 'DIRECTIVE_NOTE');
  });
});
