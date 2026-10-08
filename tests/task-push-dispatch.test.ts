import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { prisma } from '../src/lib/prisma';
import { signSessionToken, SESSION_COOKIE_NAME } from '../src/lib/jwt-session';
import { setPushSenderForTesting } from '../src/lib/push-service';
import {
  dispatchTaskAssignedPush,
  dispatchExecutiveDirectivePush,
  safeAfter,
  flushSafeAfter,
} from '../src/lib/push-dispatch';
import { POST as createTaskRoute } from '../src/app/api/tasks/route';
import { POST as createResolutionRoute } from '../src/app/api/executive/resolutions/route';
import { UserRole, TaskPriority, TaskScope, ResolutionType, UnitType, JobCatalogGroup, AssignmentType, AssignmentStatus, TaskActorRole } from '@prisma/client';

describe('Task Push Dispatch & Background after() Integration', () => {
  let adminUser: { id: string; name: string; email: string; role: string };
  let deptHeadUser: { id: string; name: string; email: string; role: string };
  let staffUser: { id: string; name: string; email: string; role: string };
  let testDepartmentId: string;

  let adminToken: string;
  let sentPushCalls: Array<{ subscription: any; payload: any }> = [];
  const createdTaskIds: string[] = [];
  const createdNotificationIds: string[] = [];
  let execUnitId: string | null = null;
  let execAssignmentId: string | null = null;
  // Dedicated test users created by this suite — isolated from concurrent tests.
  const ownedUserIds: string[] = [];

  before(async () => {
    // Intercept push notifications
    setPushSenderForTesting(async (sub, payload) => {
      sentPushCalls.push({
        subscription: sub,
        payload: payload ? JSON.parse(payload.toString()) : null,
      });
      return { statusCode: 200, body: 'OK', headers: {} };
    });

    // 1. Get or create test department (use any existing unit, not owned by this suite)
    const dept = await prisma.organizationalUnit.findFirst({
      where: { id: { notIn: ['dept-daotao', 'dept-cntt'] } },
    });
    assert.ok(dept, 'Database must contain at least one department');
    testDepartmentId = dept.id;

    // 2. Create dedicated test users owned by this suite.
    // Using create (not findFirst) ensures isolation from concurrent test suites that
    // may upsert or delete shared seeded users, which caused FK violation races.
    const ts = Date.now();

    // Admin user: BAN_GIAM_HIEU — will receive HIEU_TRUONG position below.
    const adminCreated = await prisma.user.create({
      data: {
        email: `push_dispatch_admin_${ts}@qcet-test.internal`,
        name: `Push Dispatch Admin ${ts}`,
        role: UserRole.BAN_GIAM_HIEU,
        isActive: true,
      },
    });
    ownedUserIds.push(adminCreated.id);

    // Staff user: CHUYEN_VIEN — used as task assignee / DRI.
    const staffCreated = await prisma.user.create({
      data: {
        email: `push_dispatch_staff_${ts}@qcet-test.internal`,
        name: `Push Dispatch Staff ${ts}`,
        role: UserRole.CHUYEN_VIEN,
        isActive: true,
      },
    });
    ownedUserIds.push(staffCreated.id);

    adminUser = {
      id: adminCreated.id,
      name: adminCreated.name,
      email: adminCreated.email,
      role: adminCreated.role,
    };

    deptHeadUser = adminUser; // BGH acts as dept-head for this suite

    staffUser = {
      id: staffCreated.id,
      name: staffCreated.name,
      email: staffCreated.email,
      role: staffCreated.role,
    };

    adminToken = signSessionToken({
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: adminUser.role,
      
    });

    // Canonical statutory mandate (Issue #27): the executive-resolution
    // integration below requires an ACTIVE executive PositionAssignment on
    // the calling BGH user, never the role string. Equip it here (scoped
    // cleanup in after()).
    let rectorDef = await prisma.positionDefinition.findUnique({ where: { code: 'HIEU_TRUONG' } });
    if (!rectorDef) {
      rectorDef = await prisma.positionDefinition.create({
        data: { code: 'HIEU_TRUONG', title: 'Hieu truong', group: JobCatalogGroup.LDPU, isLeadership: true },
      });
    }
    const execUnit = await prisma.organizationalUnit.create({
      data: { code: `U-PUSH-${Date.now()}`, name: 'Unit Push Exec', type: UnitType.DEPARTMENT },
    });
    execUnitId = execUnit.id;
    const execAssignment = await prisma.positionAssignment.create({
      data: {
        userId: adminUser.id,
        unitId: execUnit.id,
        positionDefinitionId: rectorDef.id,
        status: AssignmentStatus.ACTIVE,
        type: AssignmentType.PRIMARY,
        effectiveFrom: new Date('2020-01-01'),
      },
    });
    execAssignmentId = execAssignment.id;
  });

  after(async () => {
    setPushSenderForTesting(null);

    // Cleanup tasks
    if (createdTaskIds.length > 0) {
      await prisma.taskActor.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      }).catch(() => {});
      await prisma.executiveResolution.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      }).catch(() => {});
      await prisma.task.deleteMany({
        where: { id: { in: createdTaskIds } },
      }).catch(() => {});
    }

    // Cleanup notifications
    if (createdNotificationIds.length > 0) {
      await prisma.notification.deleteMany({
        where: { id: { in: createdNotificationIds } },
      }).catch(() => {});
    }

    // Cleanup scoped executive mandate fixture
    if (execUnitId) {
      await prisma.positionAssignment.deleteMany({ where: { unitId: execUnitId } }).catch(() => {});
      await prisma.organizationalUnit.deleteMany({ where: { id: execUnitId } }).catch(() => {});
    }

    // Cleanup dedicated test users created by this suite (all tasks/assignments already deleted above)
    if (ownedUserIds.length > 0) {
      // Delete any remaining position assignments first (FK guard)
      await prisma.positionAssignment.deleteMany({
        where: { userId: { in: ownedUserIds } },
      }).catch(() => {});
      await prisma.user.deleteMany({
        where: { id: { in: ownedUserIds } },
      }).catch(() => {});
    }
  });

  describe('dispatchTaskAssignedPush unit tests', () => {
    test('creates in-app notification and dispatches push to assignee', async () => {
      sentPushCalls = [];

      // Create a test task directly in DB
      const testTask = await prisma.task.create({
        data: {
          code: `NV-TEST-${Date.now()}`,
          title: 'Soạn thảo đề án mở ngành đào tạo mới Công Nghệ Bán Dẫn',
          leadUnitId: testDepartmentId,
          dueDate: new Date('2026-11-20T17:00:00Z'),
          academicMonth: 11,
          academicYear: '2026-2027',
          createdById: adminUser.id,
        },
      });
      createdTaskIds.push(testTask.id);

      const result = await dispatchTaskAssignedPush({
        task: testTask,
        assigneeId: staffUser.id,
        actorName: adminUser.name,
        actorId: adminUser.id,
      });

      assert.ok(result.notifiedUserIds.includes(staffUser.id));

      // Verify notification in database
      const notif = await prisma.notification.findFirst({
        where: {
          userId: staffUser.id,
          category: 'task',
          type: 'assigned',
          linkHref: { contains: testTask.id },
        },
        orderBy: { createdAt: 'desc' },
      });

      assert.ok(notif, 'Notification record must exist in DB');
      createdNotificationIds.push(notif.id);
      assert.strictEqual(notif.actorName, adminUser.name);
      assert.match(notif.title, /\[GIAO VIỆC\]/);
      assert.ok(notif.body.includes(adminUser.name));
    });

    test('gracefully handles task with no assignees', async () => {
      const result = await dispatchTaskAssignedPush({
        task: {
          id: 'dummy-id',
          title: 'Task without assignees',
          dueDate: null,
        },
        assigneeId: null,
        actorName: 'Tester',
      });

      assert.strictEqual(result.notifiedUserIds.length, 0);
    });
  });

  describe('dispatchExecutiveDirectivePush unit tests', () => {
    test('dispatches executive directive to department heads and assignees', async () => {
      sentPushCalls = [];

      // Create task with assignee
      const task = await prisma.task.create({
        data: {
          code: `NV-DIR-${Date.now()}`,
          title: 'Khảo sát cơ sở vật chất phòng thí nghiệm AI',
          leadUnitId: testDepartmentId,
          dueDate: new Date('2026-10-15T17:00:00Z'),
          academicMonth: 10,
          academicYear: '2026-2027',
          createdById: adminUser.id
        },
      });
      createdTaskIds.push(task.id);

      await prisma.taskActor.create({
        data: {
          taskId: task.id,
          userId: staffUser.id,
          role: TaskActorRole.DRI,
          isPrimaryDRI: true,
          unitId: testDepartmentId,
        },
      });

      const result = await dispatchExecutiveDirectivePush({
        taskId: task.id,
        taskTitle: task.title,
        resolutionType: ResolutionType.DIRECTIVE_NOTE,
        directiveNote: 'Yêu cầu hoàn thành trước ngày 20 để kịp nghiệm thu',
        actorName: adminUser.name,
        actorId: adminUser.id,
        departmentId: testDepartmentId,
      });

      // Should notify staffUser and deptHead (if different from admin)
      assert.ok(result.notifiedUserIds.length > 0);
      assert.ok(result.notifiedUserIds.includes(staffUser.id));

      // Verify notification in database
      const notif = await prisma.notification.findFirst({
        where: {
          userId: staffUser.id,
          category: 'resolution',
          type: 'directive',
          linkHref: { contains: task.id },
        },
        orderBy: { createdAt: 'desc' },
      });

      assert.ok(notif, 'Executive directive notification must be created in DB');
      createdNotificationIds.push(notif.id);
      assert.match(notif.title, /\[CHỈ ĐẠO BGH\]/);
      assert.match(notif.body, /Yêu cầu hoàn thành trước ngày 20/);
    });
  });

  describe('Integration with POST /api/tasks via safeAfter', () => {
    test('POST /api/tasks sends background push notification upon task creation', async () => {
      sentPushCalls = [];

      const req = new NextRequest('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'http://localhost:3000',
          'Referer': 'http://localhost:3000',
          cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
        },
        body: JSON.stringify({
          title: 'Nhiệm vụ tự động bắn push ngầm qua after()',
          description: 'Kiểm thử tích hợp after() Next.js 15',
          departmentId: testDepartmentId,
          dueDate: '2026-12-01T17:00:00.000Z',
          priority: 'urgent',
          scope: 'department',
          academicMonth: 12,
          academicYear: '2026-2027',
          assigneeId: staffUser.id,
        }),
      });

      const res = await createTaskRoute(req);
      assert.strictEqual(res.status, 201);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      const taskId = json.task.id;
      createdTaskIds.push(taskId);

      // Wait for any background after() tasks to finish
      await flushSafeAfter();

      // Check notification created
      const notif = await prisma.notification.findFirst({
        where: {
          userId: staffUser.id,
          category: 'task',
          type: 'assigned',
          linkHref: { contains: taskId },
        },
      });

      assert.ok(notif, 'Background after() must create notification in DB');
      createdNotificationIds.push(notif.id);
      assert.match(notif.title, /\[GIAO VIỆC\]/);
    });
  });

  describe('Integration with POST /api/executive/resolutions via safeAfter', () => {
    test('POST /api/executive/resolutions triggers background push for executive directive', async () => {
      // 1. Create a task first (created by staffUser to satisfy SoD rule on executive approval)
      const task = await prisma.task.create({
        data: {
          code: `NV-RES-${Date.now()}`,
          title: 'Chuẩn bị hồ sơ đánh giá chất lượng AUN-QA',
          leadUnitId: testDepartmentId,
          dueDate: new Date('2026-10-10T17:00:00Z'),
          academicMonth: 10,
          academicYear: '2026-2027',
          createdById: staffUser.id
        },
      });
      createdTaskIds.push(task.id);

      await prisma.taskActor.create({
        data: {
          taskId: task.id,
          userId: staffUser.id,
          role: TaskActorRole.DRI,
          isPrimaryDRI: true,
          unitId: testDepartmentId,
        },
      });

      // 2. Issue directive resolution via API
      const req = new NextRequest('http://localhost:3000/api/executive/resolutions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'http://localhost:3000',
          'Referer': 'http://localhost:3000',
          cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
        },
        body: JSON.stringify({
          taskId: task.id,
          resolutionType: 'DIRECTIVE_NOTE',
          directiveNote: 'Đề nghị khẩn trương hoàn thiện báo cáo tự đánh giá tiêu chí 3',
        }),
      });

      const res = await createResolutionRoute(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);

      // Wait for any background after() tasks to finish
      await flushSafeAfter();

      // Check notification created
      const notif = await prisma.notification.findFirst({
        where: {
          userId: staffUser.id,
          category: 'resolution',
          type: 'directive',
          linkHref: { contains: task.id },
        },
      });

      assert.ok(notif, 'Background after() must create executive directive notification');
      createdNotificationIds.push(notif.id);
      assert.match(notif.title, /\[CHỈ ĐẠO BGH\]/);
      assert.match(notif.body, /Đề nghị khẩn trương hoàn thiện/);
    });
  });
});
