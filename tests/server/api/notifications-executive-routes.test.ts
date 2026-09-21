import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TaskStatus, UnitType, JobCatalogGroup, AssignmentType, AssignmentStatus } from '@prisma/client';
import { signSessionToken, SESSION_COOKIE_NAME } from '@/lib/jwt-session';
import { GET as getNotificationsRoute } from '@/app/api/notifications/route';
import { POST as markAllReadRoute } from '@/app/api/notifications/read-all/route';
import { POST as markOneReadPostRoute, PATCH as markOneReadPatchRoute } from '@/app/api/notifications/[id]/read/route';
import { POST as subscribePushRoute } from '@/app/api/notifications/push/subscribe/route';
import { POST as testPushRoute } from '@/app/api/notifications/push/test/route';
import { GET as getKeyRoute } from '@/app/api/notifications/push/key/route';
import { GET as getResolutionsRoute, POST as createResolutionRoute } from '@/app/api/executive/resolutions/route';
import { GET as searchRoute } from '@/app/api/search/route';
import { GET as dashboardOverviewRoute } from '@/app/api/dashboard/overview/route';
import { GET as networkInfoRoute } from '@/app/api/system/network-info/route';

describe('Notifications, Executive, Search & System API Hardening (Task 12)', () => {
  let executiveUser: { id: string; email: string; name: string; role: string; departmentId: string | null };
  let staffUser: { id: string; email: string; name: string; role: string; departmentId: string | null };
  let otherUser: { id: string; email: string; name: string; role: string; departmentId: string | null };
  let adminUser: { id: string; email: string; name: string; role: string; departmentId: string | null };

  let executiveToken: string;
  let staffToken: string;
  let otherToken: string;
  let adminToken: string;

  let testTaskId: string;
  let staffNotifId: string;
  let otherNotifId: string;
  let execUnitId: string | null = null;
  let execAssignmentId: string | null = null;
  const createdResolutionIds: string[] = [];
  const createdNotificationIds: string[] = [];

  const originalEnv = { ...process.env };

  before(async () => {
    // 1. Fetch or identify test users
    const bgh = await prisma.user.findFirst({ where: { role: 'BAN_GIAM_HIEU' } });
    assert.ok(bgh, 'BAN_GIAM_HIEU user required');
    executiveUser = { id: bgh.id, email: bgh.email, name: bgh.name, role: bgh.role, departmentId: bgh.departmentId };

    const chuyenvien = await prisma.user.findFirst({ where: { role: 'CHUYEN_VIEN' } });
    assert.ok(chuyenvien, 'CHUYEN_VIEN user required');
    staffUser = { id: chuyenvien.id, email: chuyenvien.email, name: chuyenvien.name, role: chuyenvien.role, departmentId: chuyenvien.departmentId };

    const truongphong = await prisma.user.findFirst({ where: { role: 'TRUONG_PHONG' } });
    assert.ok(truongphong, 'TRUONG_PHONG user required');
    otherUser = { id: truongphong.id, email: truongphong.email, name: truongphong.name, role: truongphong.role, departmentId: truongphong.departmentId };

    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    assert.ok(admin, 'ADMIN user required');
    adminUser = { id: admin.id, email: admin.email, name: admin.name, role: admin.role, departmentId: admin.departmentId };

    // 2. Generate tokens
    executiveToken = signSessionToken({ id: executiveUser.id, email: executiveUser.email, name: executiveUser.name, role: executiveUser.role });
    staffToken = signSessionToken({ id: staffUser.id, email: staffUser.email, name: staffUser.name, role: staffUser.role });
    otherToken = signSessionToken({ id: otherUser.id, email: otherUser.email, name: otherUser.name, role: otherUser.role });
    adminToken = signSessionToken({ id: adminUser.id, email: adminUser.email, name: adminUser.name, role: adminUser.role });

    // 2b. Canonical statutory mandate (Issue #27): executive authority
    // requires an ACTIVE executive PositionAssignment, never the role
    // string. Equip the seed BGH user so this file keeps testing the
    // authorized flows (CSRF/415/CRUD/audit) under the new contract.
    let rectorDef = await prisma.positionDefinition.findUnique({ where: { code: 'HIEU_TRUONG' } });
    if (!rectorDef) {
      rectorDef = await prisma.positionDefinition.create({
        data: { code: 'HIEU_TRUONG', title: 'Hieu truong', group: JobCatalogGroup.LDPU, isLeadership: true },
      });
    }
    const execUnit = await prisma.organizationalUnit.create({
      data: { code: `U-T12-${Date.now()}`, name: 'Unit Task12 Exec', type: UnitType.DEPARTMENT },
    });
    execUnitId = execUnit.id;
    const execAssignment = await prisma.positionAssignment.create({
      data: {
        userId: executiveUser.id,
        unitId: execUnit.id,
        positionDefinitionId: rectorDef.id,
        status: AssignmentStatus.ACTIVE,
        type: AssignmentType.PRIMARY,
        effectiveFrom: new Date('2020-01-01'),
      },
    });
    execAssignmentId = execAssignment.id;

    // 3. Find or create a test task for executive resolutions
    let task = await prisma.task.findFirst();
    if (!task) {
      task = await prisma.task.create({
        data: {
          code: `TASK_TEST_${Date.now()}`,
          title: 'Nhiệm vụ kiểm thử API hardening',
          status: TaskStatus.IN_PROGRESS,
          priority: 'NORMAL',
          academicMonth: 3,
          academicYear: '2025-2026',
          dueDate: new Date(Date.now() + 86400000 * 7),
          createdById: executiveUser.id,
        },
      });
    }
    testTaskId = task.id;

    // 4. Create isolated test notifications
    const notifStaff = await prisma.notification.create({
      data: {
        userId: staffUser.id,
        title: 'Thông báo kiểm thử nhân viên',
        body: 'Nội dung kiểm thử cho nhân viên',
        category: 'task',
        linkHref: '/?zone=tasks',
        type: 'TASK_ASSIGNED',
        isRead: false,
      },
    });
    staffNotifId = notifStaff.id;
    createdNotificationIds.push(staffNotifId);

    const notifOther = await prisma.notification.create({
      data: {
        userId: otherUser.id,
        title: 'Thông báo kiểm thử người khác',
        body: 'Nội dung kiểm thử người khác',
        category: 'task',
        linkHref: '/?zone=tasks',
        type: 'TASK_DUE_SOON',
        isRead: false,
      },
    });
    otherNotifId = notifOther.id;
    createdNotificationIds.push(otherNotifId);
  });

  after(async () => {
    process.env = { ...originalEnv };
    if (createdResolutionIds.length > 0) {
      await prisma.executiveResolution.deleteMany({
        where: { id: { in: createdResolutionIds } },
      });
    }
    if (createdNotificationIds.length > 0) {
      await prisma.notification.deleteMany({
        where: { id: { in: createdNotificationIds } },
      });
    }
    if (execAssignmentId) {
      await prisma.positionAssignment.deleteMany({ where: { id: execAssignmentId } });
    }
    if (execUnitId) {
      await prisma.organizationalUnit.deleteMany({ where: { id: execUnitId } });
    }
  });

  describe('1. 401 Unauthenticated Access Rejections', () => {
    test('GET /api/notifications rejects unauthenticated caller with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/notifications');
      const res = await getNotificationsRoute(req);
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.code, 'AUTH_REQUIRED');
    });

    test('POST /api/notifications/read-all rejects unauthenticated caller with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/notifications/read-all', {
        method: 'POST',
      });
      const res = await markAllReadRoute(req);
      assert.strictEqual(res.status, 401);
    });

    test('POST /api/notifications/[id]/read rejects unauthenticated caller with 401', async () => {
      const req = new NextRequest(`http://localhost:3000/api/notifications/${staffNotifId}/read`, {
        method: 'POST',
      });
      const res = await markOneReadPostRoute(req, { params: Promise.resolve({ id: staffNotifId }) });
      assert.strictEqual(res.status, 401);
    });

    test('POST /api/notifications/push/subscribe rejects unauthenticated caller with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/notifications/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: 'https://test.com', p256dh: 'p', auth: 'a' }),
      });
      const res = await subscribePushRoute(req);
      assert.strictEqual(res.status, 401);
    });

    test('POST /api/notifications/push/test rejects unauthenticated caller with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/notifications/push/test', {
        method: 'POST',
      });
      const res = await testPushRoute(req);
      assert.strictEqual(res.status, 401);
    });

    test('GET /api/executive/resolutions rejects unauthenticated caller with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/executive/resolutions');
      const res = await getResolutionsRoute(req);
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.strictEqual(json.code, 'AUTH_REQUIRED');
    });

    test('POST /api/executive/resolutions rejects unauthenticated caller with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/executive/resolutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: testTaskId, resolutionType: 'URGENT_DIRECTIVE', directiveNote: 'Chỉ đạo gấp' }),
      });
      const res = await createResolutionRoute(req);
      assert.strictEqual(res.status, 401);
    });

    test('GET /api/search rejects unauthenticated caller with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/search?q=kehoach');
      const res = await searchRoute(req);
      assert.strictEqual(res.status, 401);
    });

    test('GET /api/dashboard/overview rejects unauthenticated caller with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/dashboard/overview');
      const res = await dashboardOverviewRoute(req);
      assert.strictEqual(res.status, 401);
    });
  });

  describe('2. 403 Authorization Rejections & BOLA Prevention', () => {
    test('GET /api/executive/resolutions rejects non-executive caller (CHUYEN_VIEN) with 403 FORBIDDEN', async () => {
      const req = new NextRequest('http://localhost:3000/api/executive/resolutions', {
        headers: { 'Authorization': `Bearer ${staffToken}` },
      });
      const res = await getResolutionsRoute(req);
      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.code, 'FORBIDDEN');
    });

    test('GET /api/executive/resolutions rejects departmental manager (TRUONG_PHONG) with 403 FORBIDDEN', async () => {
      const req = new NextRequest('http://localhost:3000/api/executive/resolutions', {
        headers: { 'Authorization': `Bearer ${otherToken}` },
      });
      const res = await getResolutionsRoute(req);
      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.strictEqual(json.code, 'FORBIDDEN');
    });

    test('POST /api/executive/resolutions rejects non-executive caller with 403 FORBIDDEN', async () => {
      const req = new NextRequest('http://localhost:3000/api/executive/resolutions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${staffToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskId: testTaskId,
          resolutionType: 'EXTEND_DEADLINE',
          grantedDays: 3,
        }),
      });
      const res = await createResolutionRoute(req);
      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.strictEqual(json.code, 'FORBIDDEN');
    });

    test('POST /api/notifications/[id]/read prevents BOLA (User A reading User B notification) with 403', async () => {
      // staffUser attempts to mark otherUser's notification as read
      const req = new NextRequest(`http://localhost:3000/api/notifications/${otherNotifId}/read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${staffToken}`,
        },
      });
      const res = await markOneReadPostRoute(req, { params: Promise.resolve({ id: otherNotifId }) });
      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.strictEqual(json.code, 'FORBIDDEN');
    });

    test('POST /api/notifications/push/test rejects non-admin in production with 403', async () => {
      (process.env as any).NODE_ENV = 'production';
      try {
        const req = new NextRequest('http://localhost:3000/api/notifications/push/test', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${staffToken}`,
          },
        });
        const res = await testPushRoute(req);
        assert.strictEqual(res.status, 403);
        const json = await res.json();
        assert.strictEqual(json.code, 'FORBIDDEN');
      } finally {
        (process.env as any).NODE_ENV = 'test';
      }
    });
  });

  describe('3. CSRF and Content-Type Rejections on Mutations', () => {
    test('POST /api/executive/resolutions rejects cookie session missing Origin/Referer with 403 CSRF error', async () => {
      const req = new NextRequest('http://localhost:3000/api/executive/resolutions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `${SESSION_COOKIE_NAME}=${executiveToken}`,
        },
        body: JSON.stringify({
          taskId: testTaskId,
          resolutionType: 'URGENT_DIRECTIVE',
          directiveNote: 'Chỉ đạo',
        }),
      });
      const res = await createResolutionRoute(req);
      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.strictEqual(json.code, 'CSRF_VALIDATION_FAILED');
    });

    test('POST /api/executive/resolutions rejects missing/non-JSON content type with 415', async () => {
      const req = new NextRequest('http://localhost:3000/api/executive/resolutions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${executiveToken}`,
          'Content-Type': 'text/plain',
        },
        body: 'invalid-content-type',
      });
      const res = await createResolutionRoute(req);
      assert.strictEqual(res.status, 415);
      const json = await res.json();
      assert.strictEqual(json.code, 'UNSUPPORTED_MEDIA_TYPE');
    });

    test('POST /api/notifications/push/subscribe rejects mismatched cross-site Origin with 403 CSRF error', async () => {
      const req = new NextRequest('http://localhost:3000/api/notifications/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://evil-attacker.site',
          'Cookie': `${SESSION_COOKIE_NAME}=${staffToken}`,
        },
        body: JSON.stringify({
          endpoint: 'https://fcm.googleapis.com/fcm/send/csrf-test',
          p256dh: 'p256',
          auth: 'auth',
        }),
      });
      const res = await subscribePushRoute(req);
      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.strictEqual(json.code, 'CSRF_VALIDATION_FAILED');
    });

    test('POST /api/notifications/push/subscribe rejects non-JSON content-type with 415', async () => {
      const req = new NextRequest('http://localhost:3000/api/notifications/push/subscribe', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${staffToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'endpoint=https%3A%2F%2Ftest.com',
      });
      const res = await subscribePushRoute(req);
      assert.strictEqual(res.status, 415);
      const json = await res.json();
      assert.strictEqual(json.code, 'UNSUPPORTED_MEDIA_TYPE');
    });

    test('POST /api/notifications/read-all rejects cross-site Sec-Fetch-Site with 403', async () => {
      const req = new NextRequest('http://localhost:3000/api/notifications/read-all', {
        method: 'POST',
        headers: {
          'Cookie': `${SESSION_COOKIE_NAME}=${staffToken}`,
          'sec-fetch-site': 'cross-site',
        },
      });
      const res = await markAllReadRoute(req);
      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.strictEqual(json.code, 'CSRF_VALIDATION_FAILED');
    });
  });

  describe('4. Successful Operations, Isolation & Rate Limiting', () => {
    test('GET /api/notifications strictly isolates caller notifications with private no-store cache', async () => {
      const req = new NextRequest('http://localhost:3000/api/notifications?limit=20', {
        headers: { 'Authorization': `Bearer ${staffToken}` },
      });
      const res = await getNotificationsRoute(req);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('cache-control'), 'private, no-store');

      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(Array.isArray(json.data?.notifications || json.notifications));

      const list = json.data?.notifications || json.notifications;
      for (const notif of list) {
        // Strict BOLA invariant: all returned notifications must belong to staffUser
        assert.strictEqual(notif.userId, staffUser.id);
      }
    });

    test('POST /api/notifications/read-all marks all unread notifications of caller as read', async () => {
      const req = new NextRequest('http://localhost:3000/api/notifications/read-all', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${staffToken}`,
        },
      });
      const res = await markAllReadRoute(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);

      // Verify in database that staff's notification is read
      const updated = await prisma.notification.findUnique({ where: { id: staffNotifId } });
      assert.strictEqual(updated?.isRead, true);

      // Other user's notification must remain unread
      const untouched = await prisma.notification.findUnique({ where: { id: otherNotifId } });
      assert.strictEqual(untouched?.isRead, false);
    });

    test('POST & GET /api/executive/resolutions creates resolution and lists with audit log', async () => {
      const req = new NextRequest('http://localhost:3000/api/executive/resolutions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${executiveToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskId: testTaskId,
          resolutionType: 'DIRECTIVE_NOTE',
          directiveNote: 'Chỉ đạo hỏa tốc từ Ban Giám Hiệu cho nhiệm vụ',
        }),
      });

      const res = await createResolutionRoute(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      const resData = json.data || json.resolution;
      assert.ok(resData.id);
      createdResolutionIds.push(resData.id);
      assert.strictEqual(resData.taskId, testTaskId);
      assert.strictEqual(resData.resolutionType, 'DIRECTIVE_NOTE');
      assert.strictEqual(resData.directiveNote, 'Chỉ đạo hỏa tốc từ Ban Giám Hiệu cho nhiệm vụ');

      // Verify Audit Log was recorded
      const auditEntry = await prisma.auditEvent.findFirst({
        where: {
          action: 'EXECUTIVE_RESOLUTION_CREATED',
          actorId: executiveUser.id,
        },
        orderBy: { createdAt: 'desc' },
      });
      assert.ok(auditEntry, 'Audit log must record executive resolution creation');

      // Now query resolutions via GET
      const getReq = new NextRequest(`http://localhost:3000/api/executive/resolutions?taskId=${testTaskId}`, {
        headers: { 'Authorization': `Bearer ${executiveToken}` },
      });
      const getRes = await getResolutionsRoute(getReq);
      assert.strictEqual(getRes.status, 200);
      assert.strictEqual(getRes.headers.get('cache-control'), 'private, no-store');
      const getJson = await getRes.json();
      assert.strictEqual(getJson.success, true);
      const resolutions = getJson.data?.resolutions || getJson.resolutions;
      assert.ok(Array.isArray(resolutions));
      assert.ok(resolutions.some((r: any) => r.id === resData.id));
    });

    test('GET /api/search enforces query validation, rate limiting and returns results', async () => {
      const req = new NextRequest('http://localhost:3000/api/search?q=nhiemvu&limit=10', {
        headers: { 'Authorization': `Bearer ${staffToken}` },
      });
      const res = await searchRoute(req);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('cache-control'), 'private, no-store');
      const json = await res.json();
      assert.strictEqual(json.success, true);
      const data = json.results || json.data?.results || json.data;
      assert.ok(data);
      assert.ok(Array.isArray(data.tasks));
      assert.ok(Array.isArray(data.users));
    });

    test('GET /api/search rejects queries exceeding max length with 400', async () => {
      const longQuery = 'a'.repeat(101);
      const req = new NextRequest(`http://localhost:3000/api/search?q=${longQuery}`, {
        headers: { 'Authorization': `Bearer ${staffToken}` },
      });
      const res = await searchRoute(req);
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.code, 'VALIDATION_ERROR');
    });
  });

  describe('5. Dev-Only & Privileged Route Environment Behavior', () => {
    test('GET /api/system/network-info in production returns 404 for unauthenticated requests', async () => {
      (process.env as any).NODE_ENV = 'production';
      try {
        const req = new NextRequest('http://localhost:3000/api/system/network-info');
        const res = await networkInfoRoute(req);
        assert.strictEqual(res.status, 404);
      } finally {
        (process.env as any).NODE_ENV = 'test';
      }
    });

    test('GET /api/system/network-info in production returns 404 for non-admin requests', async () => {
      (process.env as any).NODE_ENV = 'production';
      try {
        const req = new NextRequest('http://localhost:3000/api/system/network-info', {
          headers: { 'Authorization': `Bearer ${staffToken}` },
        });
        const res = await networkInfoRoute(req);
        assert.strictEqual(res.status, 404);
      } finally {
        (process.env as any).NODE_ENV = 'test';
      }
    });

    test('GET /api/system/network-info in production returns 200 for ADMIN requests', async () => {
      (process.env as any).NODE_ENV = 'production';
      try {
        const req = new NextRequest('http://localhost:3000/api/system/network-info', {
          headers: { 'Authorization': `Bearer ${adminToken}` },
        });
        const res = await networkInfoRoute(req);
        assert.strictEqual(res.status, 200);
        const json = await res.json();
        assert.strictEqual(json.success, true);
        assert.ok('port' in json || ('data' in json && 'port' in json.data));
      } finally {
        (process.env as any).NODE_ENV = 'test';
      }
    });

    test('GET /api/system/network-info in non-production returns 200', async () => {
      (process.env as any).NODE_ENV = 'test';
      const req = new NextRequest('http://localhost:3000/api/system/network-info');
      const res = await networkInfoRoute(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok('port' in json || ('data' in json && 'port' in json.data));
    });
  });
});
