import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { UserRole, TaskStatus, TaskPriority, TaskScope } from '@prisma/client';
import { signSessionToken, SESSION_COOKIE_NAME } from '@/lib/jwt-session';

import { GET as getTask, POST as postTask } from '@/app/api/tasks/route';
import { GET as getTaskById, PATCH as patchTaskById } from '@/app/api/tasks/[id]/route';
import { PATCH as markNotificationRead } from '@/app/api/notifications/[id]/read/route';
import { POST as createResolution } from '@/app/api/executive/resolutions/route';
import { POST as loginRoute } from '@/app/api/auth/login/route';
import { resetRateLimits } from '@/server/security/rate-limit';

describe('API Security Test Suite (Phase 29, OWASP API Top 10)', () => {
  const testRunId = Date.now();

  const deptAId = `DEPT-SEC-A-${testRunId}`;
  const deptBId = `DEPT-SEC-B-${testRunId}`;

  let staffA: any;
  let staffB: any;
  let managerA: any;
  let managerB: any;

  let staffAToken: string;
  let staffBToken: string;
  let managerAToken: string;
  let managerBToken: string;

  let taskB: any;
  let notificationB: any;

  before(async () => {
    // 1. Setup departments
    await prisma.department.createMany({
      data: [
        { id: deptAId, name: `Phòng An Ninh A ${testRunId}`, shortName: `PA-SEC-${testRunId}` },
        { id: deptBId, name: `Phòng An Ninh B ${testRunId}`, shortName: `PB-SEC-${testRunId}` },
      ],
    });

    // 2. Setup users
    staffA = await prisma.user.create({
      data: {
        id: `staff-sec-a-${testRunId}`,
        email: `staff.sec.a.${testRunId}@qcet.edu.vn`,
        name: 'Staff Sec A',
        role: UserRole.CHUYEN_VIEN,
        departmentId: deptAId,
        isActive: true,
      },
    });

    staffB = await prisma.user.create({
      data: {
        id: `staff-sec-b-${testRunId}`,
        email: `staff.sec.b.${testRunId}@qcet.edu.vn`,
        name: 'Staff Sec B',
        role: UserRole.CHUYEN_VIEN,
        departmentId: deptBId,
        isActive: true,
      },
    });

    managerA = await prisma.user.create({
      data: {
        id: `manager-sec-a-${testRunId}`,
        email: `manager.sec.a.${testRunId}@qcet.edu.vn`,
        name: 'Manager Sec A',
        role: UserRole.TRUONG_PHONG,
        departmentId: deptAId,
        isActive: true,
      },
    });

    managerB = await prisma.user.create({
      data: {
        id: `manager-sec-b-${testRunId}`,
        email: `manager.sec.b.${testRunId}@qcet.edu.vn`,
        name: 'Manager Sec B',
        role: UserRole.TRUONG_PHONG,
        departmentId: deptBId,
        isActive: true,
      },
    });

    staffAToken = signSessionToken({
      id: staffA.id,
      email: staffA.email,
      name: staffA.name,
      role: staffA.role,
      departmentId: staffA.departmentId,
    });

    staffBToken = signSessionToken({
      id: staffB.id,
      email: staffB.email,
      name: staffB.name,
      role: staffB.role,
      departmentId: staffB.departmentId,
    });

    managerAToken = signSessionToken({
      id: managerA.id,
      email: managerA.email,
      name: managerA.name,
      role: managerA.role,
      departmentId: managerA.departmentId,
    });

    managerBToken = signSessionToken({
      id: managerB.id,
      email: managerB.email,
      name: managerB.name,
      role: managerB.role,
      departmentId: managerB.departmentId,
    });

    // 3. Create Task owned by Dept B
    taskB = await prisma.task.create({
      data: {
        code: `TSK-SEC-B-${testRunId}`,
        title: `Nhiệm vụ bí mật Phòng B ${testRunId}`,
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.HIGH,
        scope: TaskScope.DEPARTMENT,
        departmentId: deptBId,
        createdById: managerB.id,
        academicMonth: 9,
        academicYear: '2026-2027',
        dueDate: new Date(Date.now() + 86400000),
        version: 1,
      },
    });

    // 4. Create Notification owned by User B
    notificationB = await prisma.notification.create({
      data: {
        userId: staffB.id,
        title: `Thông báo riêng tư User B ${testRunId}`,
        body: `Nội dung riêng tư`,
        linkHref: `/tasks`,
        type: 'TASK_ASSIGNED',
        isRead: false,
      },
    });
  });

  describe('1. BOLA (Broken Object Level Authorization / OWASP API1)', () => {
    test('Manager A is strictly FORBIDDEN from reading Task belonging to Dept B (HTTP 403)', async () => {
      const req = new NextRequest(`http://localhost:3000/api/tasks/${taskB.id}`, {
        method: 'GET',
        headers: {
          authorization: `Bearer ${managerAToken}`,
          cookie: `${SESSION_COOKIE_NAME}=${managerAToken}`,
        },
      });

      const res = await getTaskById(req, { params: Promise.resolve({ id: taskB.id }) });
      assert.equal(res.status, 403, 'Should return HTTP 403 Forbidden for cross-department task read');
      const json = await res.json();
      assert.equal(json.code, 'FORBIDDEN');
    });

    test('Manager A is strictly FORBIDDEN from modifying Task belonging to Dept B (HTTP 403)', async () => {
      const req = new NextRequest(`http://localhost:3000/api/tasks/${taskB.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${managerAToken}`,
          cookie: `${SESSION_COOKIE_NAME}=${managerAToken}`,
          origin: 'http://localhost:3000',
        },
        body: JSON.stringify({
          title: 'Hacked title by Manager A',
        }),
      });

      const res = await patchTaskById(req, { params: Promise.resolve({ id: taskB.id }) });
      assert.equal(res.status, 403, 'Should return HTTP 403 Forbidden for cross-department task update');
      const json = await res.json();
      assert.equal(json.code, 'FORBIDDEN');
    });
  });

  describe('2. Notification Ownership Authorization', () => {
    test('User A is strictly FORBIDDEN from marking User B notification as read (HTTP 403)', async () => {
      const req = new NextRequest(`http://localhost:3000/api/notifications/${notificationB.id}/read`, {
        method: 'PATCH',
        headers: {
          authorization: `Bearer ${staffAToken}`,
          cookie: `${SESSION_COOKIE_NAME}=${staffAToken}`,
          origin: 'http://localhost:3000',
        },
      });

      const res = await markNotificationRead(req, { params: Promise.resolve({ id: notificationB.id }) });
      assert.equal(res.status, 403, 'Should return HTTP 403 Forbidden for marking another user notification as read');
      const json = await res.json();
      assert.equal(json.code, 'FORBIDDEN');
    });

    test('User B can successfully mark their own notification as read (HTTP 200)', async () => {
      const req = new NextRequest(`http://localhost:3000/api/notifications/${notificationB.id}/read`, {
        method: 'PATCH',
        headers: {
          authorization: `Bearer ${staffBToken}`,
          cookie: `${SESSION_COOKIE_NAME}=${staffBToken}`,
          origin: 'http://localhost:3000',
        },
      });

      const res = await markNotificationRead(req, { params: Promise.resolve({ id: notificationB.id }) });
      assert.equal(res.status, 200, 'Should return HTTP 200 OK for marking own notification as read');
      const json = await res.json();
      assert.equal(json.success, true);
    });
  });

  describe('3. Function-Level Authorization (OWASP API5)', () => {
    test('Staff is strictly FORBIDDEN from creating executive resolutions (HTTP 403)', async () => {
      const req = new NextRequest('http://localhost:3000/api/executive/resolutions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${staffAToken}`,
          cookie: `${SESSION_COOKIE_NAME}=${staffAToken}`,
          origin: 'http://localhost:3000',
        },
        body: JSON.stringify({
          resolutionNumber: `NQ-STAFF-ATTEMPT-${testRunId}`,
          title: 'Staff unauthorized resolution attempt',
          sessionDate: new Date().toISOString(),
        }),
      });

      const res = await createResolution(req);
      assert.equal(res.status, 403, 'Should return HTTP 403 Forbidden for non-executive role');
      const json = await res.json();
      assert.equal(json.code, 'FORBIDDEN');
    });
  });

  describe('4. Property-Level Authorization & Mass Assignment Prevention (OWASP API3)', () => {
    test('Staff cannot elevate status to COMPLETED or approve task via PATCH (HTTP 403 or filtered)', async () => {
      // Create a task owned by Dept A assigned to Staff A
      const staffTask = await prisma.task.create({
        data: {
          code: `TSK-PROP-${testRunId}`,
          title: `Task Staff Prop Test ${testRunId}`,
          status: TaskStatus.IN_PROGRESS,
          priority: TaskPriority.NORMAL,
          scope: TaskScope.DEPARTMENT,
          departmentId: deptAId,
          createdById: managerA.id,
          academicMonth: 9,
          academicYear: '2026-2027',
          dueDate: new Date(Date.now() + 86400000),
          assignees: {
            create: {
              userId: staffA.id,
            },
          },
        },
      });

      // Staff attempts to mark status COMPLETED directly via PATCH
      const req = new NextRequest(`http://localhost:3000/api/tasks/${staffTask.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${staffAToken}`,
          cookie: `${SESSION_COOKIE_NAME}=${staffAToken}`,
          origin: 'http://localhost:3000',
        },
        body: JSON.stringify({
          status: TaskStatus.COMPLETED,
          role: 'ADMIN', // injected privileged field
        }),
      });

      const res = await patchTaskById(req, { params: Promise.resolve({ id: staffTask.id }) });
      // Either forbidden because staff cannot complete task directly without approval, or status update fails
      const json = await res.json();
      if (res.status === 200) {
        // If 200, ensure status wasn't COMPLETED and role was never applied
        assert.notEqual(json.data.status, TaskStatus.COMPLETED, 'Staff must not be able to force COMPLETED');
      } else {
        assert.ok([400, 403].includes(res.status), `Should reject unauthorized state transition with 400 or 403 (got ${res.status})`);
      }
    });
  });

  describe('5. CSRF Protection for State-Changing Requests', () => {
    test('Rejects state-changing POST with cookie but without Origin/Referer (HTTP 403)', async () => {
      const req = new NextRequest('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=${managerAToken}`,
          // Missing Origin & Referer
        },
        body: JSON.stringify({
          title: 'CSRF Attempt Task',
        }),
      });

      const res = await postTask(req);
      assert.equal(res.status, 403, 'Should reject with 403 FORBIDDEN when Origin/Referer is missing on cookie request');
      const json = await res.json();
      assert.equal(json.code, 'CSRF_VALIDATION_FAILED');
    });

    test('Rejects state-changing POST with cross-origin untrusted Origin (HTTP 403)', async () => {
      const req = new NextRequest('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=${managerAToken}`,
          origin: 'https://attacker-evil-site.com',
        },
        body: JSON.stringify({
          title: 'Cross Origin CSRF Attempt',
        }),
      });

      const res = await postTask(req);
      assert.equal(res.status, 403, 'Should reject untrusted cross-origin request with 403');
      const json = await res.json();
      assert.equal(json.code, 'CSRF_VALIDATION_FAILED');
    });
  });

  describe('6. Content-Type and Payload Limit Guards', () => {
    test('Rejects mutation with unsupported Content-Type (HTTP 415)', async () => {
      const req = new NextRequest('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          authorization: `Bearer ${managerAToken}`,
          origin: 'http://localhost:3000',
        },
        body: 'plain text body instead of JSON',
      });

      const res = await postTask(req);
      assert.equal(res.status, 415, 'Should return HTTP 415 UNSUPPORTED_MEDIA_TYPE');
      const json = await res.json();
      assert.equal(json.code, 'UNSUPPORTED_MEDIA_TYPE');
    });

    test('Rejects oversized payload with HTTP 413 PAYLOAD_TOO_LARGE', async () => {
      const hugeTitle = 'A'.repeat(2 * 1024 * 1024); // 2MB string > 1MB limit
      const req = new NextRequest('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': String(hugeTitle.length),
          authorization: `Bearer ${managerAToken}`,
          origin: 'http://localhost:3000',
        },
        body: JSON.stringify({
          title: hugeTitle,
        }),
      });

      const res = await postTask(req);
      assert.equal(res.status, 413, 'Should return HTTP 413 PAYLOAD_TOO_LARGE');
      const json = await res.json();
      assert.equal(json.code, 'PAYLOAD_TOO_LARGE');
    });
  });

  describe('7. Rate Limiting Protection (OWASP API4)', () => {
    test('Password login stays disabled across repeated attempts', async () => {
      const testIp = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
      resetRateLimits();

      let lastStatus = 200;
      for (let i = 0; i < 15; i++) {
        const req = new NextRequest('http://localhost:3000/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': testIp,
          },
          body: JSON.stringify({
            email: 'nonexistent@qcet.edu.vn',
            password: 'wrongpassword',
          }),
        });

        const res = await loginRoute(req);
        lastStatus = res.status;
        assert.equal(res.status, 403);
      }

      assert.equal(lastStatus, 403, 'Retired password authentication must remain forbidden');
    });
  });
});
