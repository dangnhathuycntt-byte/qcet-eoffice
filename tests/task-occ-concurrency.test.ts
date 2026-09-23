import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { prisma } from '../src/lib/prisma';
import { taskCommandService } from '../src/server/tasks/task-command-service';
import { PreconditionFailedError } from '../src/server/api/errors';
import { GET, PATCH } from '../src/app/api/tasks/[id]/route';
import { signSessionToken, SESSION_COOKIE_NAME } from '../src/lib/jwt-session';
import { TaskStatus, TaskPriority, TaskScope, TaskActorRole, DeliverableReviewStatus } from '@prisma/client';

describe('Task 3.9 - 3.11: Optimistic Concurrency Control (OCC) & Aggregate Version Invariant', () => {
  let testDept: any;
  let leaderUser: any;
  let staffUser: any;
  let leaderToken: string;
  let staffToken: string;

  const createdTaskIds: string[] = [];
  const createdUserIds: string[] = [];

  before(async () => {
    // 1. Create dedicated isolated Department
    testDept = await prisma.organizationalUnit.create({
      data: {
        id: `dept_occ_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: 'Phòng Đào tạo - Quản lý Khoa học OCC',
      },
    });

    // 2. Create leader user (HIEU_TRUONG / TRUONG_PHONG)
    leaderUser = await prisma.user.create({
      data: {
        email: `occ_leader_${Date.now()}@qncet.edu.vn`,
        name: 'Trưởng đơn vị OCC',
        role: 'TRUONG_PHONG',

      },
    });
    createdUserIds.push(leaderUser.id);

    leaderToken = signSessionToken({
      id: leaderUser.id,
      email: leaderUser.email,
      name: leaderUser.name,
      role: leaderUser.role,

    });

    // 3. Create staff user (CHUYEN_VIEN)
    staffUser = await prisma.user.create({
      data: {
        email: `occ_staff_${Date.now()}@qncet.edu.vn`,
        name: 'Chuyên viên OCC',
        role: 'CHUYEN_VIEN',

      },
    });
    createdUserIds.push(staffUser.id);

    staffToken = signSessionToken({
      id: staffUser.id,
      email: staffUser.email,
      name: staffUser.name,
      role: staffUser.role,

    });
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
      await prisma.organizationalUnit.deleteMany({
        where: { id: testDept.id },
      });
    }
  });

  async function createTestTask(initialTitle = 'Nhiệm vụ kiểm thử OCC') {
    const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const task = await prisma.task.create({
      data: {
        code: `NV-OCC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        title: initialTitle,
        priority: TaskPriority.HIGH,
        scope: TaskScope.DEPARTMENT,

        createdById: leaderUser.id,
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

  describe('1. TaskCommandService Concurrency & Version Invariant', () => {
    test('concurrent updateTask with same expectedVersion: exactly 1 succeeds, exactly 1 fails with PreconditionFailedError', async () => {
      const task = await createTestTask('OCC Race Condition Test');
      assert.strictEqual(task.version, 1);

      const ctxA = { user: leaderUser, requestId: 'req-client-a' };
      const ctxB = { user: leaderUser, requestId: 'req-client-b' };

      // Two concurrent updates both expecting version = 1
      const results = await Promise.allSettled([
        taskCommandService.updateTask(ctxA, task.id, {
          title: 'Updated by Client A',
          expectedVersion: 1,
        }),
        taskCommandService.updateTask(ctxB, task.id, {
          title: 'Updated by Client B',
          expectedVersion: 1,
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      assert.strictEqual(fulfilled.length, 1, 'Exactly one concurrent mutation must succeed');
      assert.strictEqual(rejected.length, 1, 'Exactly one concurrent mutation must fail');

      // Check failure error type and status
      const rejectedReason = (rejected[0] as PromiseRejectedResult).reason;
      assert.ok(
        rejectedReason instanceof PreconditionFailedError,
        'Failure must be an instance of PreconditionFailedError'
      );
      assert.strictEqual(rejectedReason.statusCode, 412);
      assert.strictEqual(rejectedReason.code, 'PRECONDITION_FAILED');

      // Check task state in database
      const finalTask = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
      assert.strictEqual(finalTask.version, 2, 'Aggregate version must be incremented to 2');

      // Verify AuditEvent is logged for the successful mutation
      const auditEvents = await prisma.auditEvent.findMany({
        where: { entityId: task.id },
      });
      assert.ok(auditEvents.length > 0, 'Audit event must be logged');
    });

    test('updateTask without expectedVersion increments version on every mutation', async () => {
      const task = await createTestTask('Auto-increment Version Test');
      assert.strictEqual(task.version, 1);

      const ctx = { user: leaderUser, requestId: 'req-update-1' };
      const updated1 = await taskCommandService.updateTask(ctx, task.id, {
        description: 'First change',
      });
      assert.strictEqual(updated1.version, 2);

      const updated2 = await taskCommandService.updateTask(ctx, task.id, {
        description: 'Second change',
      });
      assert.strictEqual(updated2.version, 3);
    });

    test('submitDeliverable enforces expectedVersion and increments version', async () => {
      const task = await createTestTask('Submit Deliverable OCC Test');
      assert.strictEqual(task.version, 1);

      const ctx = { user: staffUser, requestId: 'req-submit-1' };

      // Wrong expectedVersion throws PreconditionFailedError
      await assert.rejects(
        async () => {
          await taskCommandService.submitDeliverable(ctx, task.id, {
            title: 'Báo cáo sai version',
            fileUrl: 'https://example.com/report-invalid.pdf',
            expectedVersion: 999,
          });
        },
        (err: any) => {
          assert.ok(err instanceof PreconditionFailedError);
          assert.strictEqual(err.statusCode, 412);
          assert.strictEqual(err.code, 'PRECONDITION_FAILED');
          return true;
        }
      );

      // Correct expectedVersion succeeds and increments version
      const deliverable = await taskCommandService.submitDeliverable(ctx, task.id, {
        title: 'Báo cáo hợp lệ',
        fileUrl: 'https://example.com/report-valid.pdf',
        expectedVersion: 1,
      });
      assert.ok(deliverable);

      const updatedTask = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
      assert.strictEqual(updatedTask.version, 2);
    });

    test('reviewDeliverable enforces expectedVersion and increments version', async () => {
      const task = await createTestTask('Review Deliverable OCC Test');

      const submitCtx = { user: staffUser, requestId: 'req-submit-2' };
      const deliverable = await taskCommandService.submitDeliverable(submitCtx, task.id, {
        title: 'Báo cáo chờ duyệt',
        fileUrl: 'https://example.com/report-review.pdf',
      });

      const currentTask = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
      const currentVersion = currentTask.version;

      const reviewCtx = { user: leaderUser, requestId: 'req-review-1' };

      // Wrong expectedVersion throws PreconditionFailedError
      await assert.rejects(
        async () => {
          await taskCommandService.reviewDeliverable(reviewCtx, task.id, {
            deliverableId: deliverable.id,
            reviewStatus: 'REVISION_REQUIRED',
            reviewNote: 'Cần sửa đổi số liệu',
            expectedVersion: currentVersion + 50,
          });
        },
        (err: any) => {
          assert.ok(err instanceof PreconditionFailedError);
          assert.strictEqual(err.statusCode, 412);
          assert.strictEqual(err.code, 'PRECONDITION_FAILED');
          return true;
        }
      );

      // Correct expectedVersion succeeds and increments version
      const reviewed = await taskCommandService.reviewDeliverable(reviewCtx, task.id, {
        deliverableId: deliverable.id,
        reviewStatus: 'REVISION_REQUIRED',
        reviewNote: 'Cần sửa đổi số liệu',
        expectedVersion: currentVersion,
      });
      assert.strictEqual(reviewed.reviewStatus, DeliverableReviewStatus.REVISION_REQUIRED);

      const finalTask = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
      assert.strictEqual(finalTask.version, currentVersion + 1);
    });

    test('approveTask enforces expectedVersion and increments version', async () => {
      const task = await createTestTask('Approve Task OCC Test');
      // Task must be in WAITING_APPROVAL state to be approved per canonical TaskStateMachine
      await prisma.task.update({
        where: { id: task.id },
        data: { status: TaskStatus.WAITING_APPROVAL },
      });
      assert.strictEqual(task.version, 1);

      const ctx = { user: leaderUser, requestId: 'req-approve-1' };

      // Wrong expectedVersion throws PreconditionFailedError
      await assert.rejects(
        async () => {
          await taskCommandService.approveTask(ctx, task.id, {
            expectedVersion: 42,
          });
        },
        (err: any) => {
          assert.ok(err instanceof PreconditionFailedError);
          assert.strictEqual(err.statusCode, 412);
          assert.strictEqual(err.code, 'PRECONDITION_FAILED');
          return true;
        }
      );

      // Correct expectedVersion succeeds
      const approved = await taskCommandService.approveTask(ctx, task.id, {
        expectedVersion: 1,
      });
      assert.strictEqual(approved.version, 2);
      assert.strictEqual(approved.status, TaskStatus.COMPLETED);
    });
  });

  describe('2. HTTP Route Handlers: ETag and If-Match Concurrency', () => {
    test('GET /api/tasks/[id] returns ETag header matching task version', async () => {
      const task = await createTestTask('GET ETag Test');

      const req = new NextRequest(`http://localhost:3000/api/tasks/${task.id}`, {
        method: 'GET',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${leaderToken}`,
        },
      });

      const res = await GET(req, { params: Promise.resolve({ id: task.id }) });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('etag'), `"${task.version}"`);
    });

    test('PATCH /api/tasks/[id] with concurrent If-Match: 1 succeeds (200 + new ETag), 1 fails (412 PRECONDITION_FAILED)', async () => {
      const task = await createTestTask('PATCH Concurrent If-Match Test');
      assert.strictEqual(task.version, 1);

      const createPatchReq = (title: string) =>
        new NextRequest(`http://localhost:3000/api/tasks/${task.id}`, {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            'sec-fetch-site': 'same-origin',
            origin: 'http://localhost:3000',
            referer: 'http://localhost:3000',
            'if-match': '"1"',
            cookie: `${SESSION_COOKIE_NAME}=${leaderToken}`,
          },
          body: JSON.stringify({
            title,
          }),
        });

      const [resA, resB] = await Promise.all([
        PATCH(createPatchReq('PATCH from Client A'), { params: Promise.resolve({ id: task.id }) }),
        PATCH(createPatchReq('PATCH from Client B'), { params: Promise.resolve({ id: task.id }) }),
      ]);

      const statuses = [resA.status, resB.status];
      assert.ok(statuses.includes(200), 'One request must succeed with 200 OK');
      assert.ok(statuses.includes(412), 'One request must fail with 412 PRECONDITION_FAILED');

      const successRes = resA.status === 200 ? resA : resB;
      const failRes = resA.status === 412 ? resA : resB;

      assert.strictEqual(successRes.headers.get('etag'), '"2"', 'Successful response must return ETag: "2"');

      const failJson = await failRes.json();
      assert.strictEqual(failJson.success, false);
      assert.strictEqual(failJson.code, 'PRECONDITION_FAILED');
      assert.match(failJson.error, /version conflict/i);
    });

    test('PATCH /api/tasks/[id] with stale If-Match returns 412 PRECONDITION_FAILED', async () => {
      const task = await createTestTask('Stale If-Match Test');

      const req = new NextRequest(`http://localhost:3000/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'sec-fetch-site': 'same-origin',
          origin: 'http://localhost:3000',
          referer: 'http://localhost:3000',
          'if-match': '"999"',
          cookie: `${SESSION_COOKIE_NAME}=${leaderToken}`,
        },
        body: JSON.stringify({
          title: 'Should fail immediately',
        }),
      });

      const res = await PATCH(req, { params: Promise.resolve({ id: task.id }) });
      assert.strictEqual(res.status, 412);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.code, 'PRECONDITION_FAILED');
    });
  });
});
