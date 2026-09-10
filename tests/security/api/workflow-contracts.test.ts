import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { UserRole, TaskStatus, TaskPriority, TaskScope } from '@prisma/client';
import { TaskStateMachine, ActorContext, TaskContext } from '@/domain/tasks/state-machine';
import { signSessionToken, SESSION_COOKIE_NAME } from '@/lib/jwt-session';
import { PATCH as patchTask } from '@/app/api/tasks/[id]/route';

describe('Workflow Contract & Business State Machine (Task 14, Phase 30)', () => {
  const testRunId = Date.now();
  const fsm = new TaskStateMachine();

  const deptAId = `DEPT-WF-A-${testRunId}`;
  const deptBId = `DEPT-WF-B-${testRunId}`;

  let staffA: any;
  let leaderA: any;
  let staffB: any;
  let leaderB: any;
  let bghUser: any;
  let leaderAToken: string;

  before(async () => {
    // 1. Setup departments
    await prisma.department.createMany({
      data: [
        { id: deptAId, name: `Phòng Ban A WF ${testRunId}`, shortName: `PA-WF-${testRunId}` },
        { id: deptBId, name: `Phòng Ban B WF ${testRunId}`, shortName: `PB-WF-${testRunId}` },
      ],
    });

    // 2. Setup users
    staffA = await prisma.user.create({
      data: {
        id: `staff-wf-a-${testRunId}`,
        email: `staff.wf.a.${testRunId}@qcet.edu.vn`,
        name: 'Staff Dept A',
        role: UserRole.CHUYEN_VIEN,
        departmentId: deptAId,
        isActive: true,
      },
    });

    leaderA = await prisma.user.create({
      data: {
        id: `leader-wf-a-${testRunId}`,
        email: `leader.wf.a.${testRunId}@qcet.edu.vn`,
        name: 'Leader Dept A',
        role: UserRole.TRUONG_PHONG,
        departmentId: deptAId,
        isActive: true,
      },
    });

    leaderAToken = signSessionToken({
      id: leaderA.id,
      email: leaderA.email,
      name: leaderA.name,
      role: leaderA.role,
      departmentId: leaderA.departmentId,
    });

    staffB = await prisma.user.create({
      data: {
        id: `staff-wf-b-${testRunId}`,
        email: `staff.wf.b.${testRunId}@qcet.edu.vn`,
        name: 'Staff Dept B',
        role: UserRole.CHUYEN_VIEN,
        departmentId: deptBId,
        isActive: true,
      },
    });

    leaderB = await prisma.user.create({
      data: {
        id: `leader-wf-b-${testRunId}`,
        email: `leader.wf.b.${testRunId}@qcet.edu.vn`,
        name: 'Leader Dept B',
        role: UserRole.TRUONG_PHONG,
        departmentId: deptBId,
        isActive: true,
      },
    });

    bghUser = await prisma.user.create({
      data: {
        id: `bgh-wf-${testRunId}`,
        email: `bgh.wf.${testRunId}@qcet.edu.vn`,
        name: 'Ban Giam Hieu WF',
        role: UserRole.BAN_GIAM_HIEU,
        departmentId: null,
        isActive: true,
      },
    });
  });

  describe('1. State Machine Transitions & Maker-Checker (Segregation of Duties)', () => {
    test('Staff as Maker can transition NEW -> IN_PROGRESS and IN_PROGRESS -> WAITING_APPROVAL', () => {
      const actor: ActorContext = {
        id: staffA.id,
        role: staffA.role,
        departmentId: staffA.departmentId,
      };

      const task: TaskContext = {
        id: `task-wf-1-${testRunId}`,
        scope: 'DON_VI',
        departmentId: deptAId,
        primaryOwnerId: staffA.id,
        assigneeIds: [staffA.id],
      };

      // NEW -> IN_PROGRESS
      const r1 = fsm.canTransition(actor, task, 'NEW', 'IN_PROGRESS');
      assert.equal(r1.allowed, true, 'Staff should be allowed to start task');

      // IN_PROGRESS -> WAITING_APPROVAL (Submitting for review)
      const r2 = fsm.canTransition(actor, task, 'IN_PROGRESS', 'WAITING_APPROVAL');
      assert.equal(r2.allowed, true, 'Staff should be allowed to submit for approval');
    });

    test('Maker-Checker: Staff Maker is strictly FORBIDDEN from self-approving to COMPLETED', () => {
      const actor: ActorContext = {
        id: staffA.id,
        role: staffA.role,
        departmentId: staffA.departmentId,
      };

      const task: TaskContext = {
        id: `task-wf-2-${testRunId}`,
        scope: 'DON_VI',
        departmentId: deptAId,
        primaryOwnerId: staffA.id,
        assigneeIds: [staffA.id],
      };

      // WAITING_APPROVAL -> COMPLETED by Maker
      const res = fsm.canTransition(actor, task, 'WAITING_APPROVAL', 'COMPLETED');
      assert.equal(res.allowed, false, 'Maker must not self-approve');
      assert.equal(res.code, 'MAKER_CANNOT_BE_CHECKER');
    });

    test('Manager of the same department can approve WAITING_APPROVAL -> COMPLETED', () => {
      const actor: ActorContext = {
        id: leaderA.id,
        role: leaderA.role,
        departmentId: leaderA.departmentId,
      };

      const task: TaskContext = {
        id: `task-wf-3-${testRunId}`,
        scope: 'DON_VI',
        departmentId: deptAId,
        primaryOwnerId: staffA.id,
        assigneeIds: [staffA.id],
      };

      const res = fsm.canTransition(actor, task, 'WAITING_APPROVAL', 'COMPLETED');
      assert.equal(res.allowed, true, 'Department manager should be allowed to approve task within department');
    });

    test('Cross-department: Manager of Dept B is FORBIDDEN from approving Dept A task', () => {
      const actor: ActorContext = {
        id: leaderB.id,
        role: leaderB.role,
        departmentId: leaderB.departmentId,
      };

      const task: TaskContext = {
        id: `task-wf-4-${testRunId}`,
        scope: 'DON_VI',
        departmentId: deptAId,
        primaryOwnerId: staffA.id,
        assigneeIds: [staffA.id],
      };

      const res = fsm.canTransition(actor, task, 'WAITING_APPROVAL', 'COMPLETED');
      assert.equal(res.allowed, false, 'Cross-department manager must not approve foreign task');
      assert.equal(res.code, 'DEPARTMENT_MISMATCH');
    });

    test('School Scope (TRUONG): Only Executive (BGH) can approve to COMPLETED, not department manager', () => {
      const managerActor: ActorContext = {
        id: leaderA.id,
        role: leaderA.role,
        departmentId: leaderA.departmentId,
      };

      const bghActor: ActorContext = {
        id: bghUser.id,
        role: bghUser.role,
        departmentId: null,
      };

      const schoolTask: TaskContext = {
        id: `task-wf-5-${testRunId}`,
        scope: 'TRUONG',
        departmentId: deptAId,
        primaryOwnerId: staffA.id,
        assigneeIds: [staffA.id],
      };

      // Department manager trying to approve School task
      const r1 = fsm.canTransition(managerActor, schoolTask, 'WAITING_APPROVAL', 'COMPLETED');
      assert.equal(r1.allowed, false, 'Department manager cannot approve School-scope task');
      assert.equal(r1.code, 'SCHOOL_SCOPE_REQUIRES_EXECUTIVE');

      // BGH approving School task
      const r2 = fsm.canTransition(bghActor, schoolTask, 'WAITING_APPROVAL', 'COMPLETED');
      assert.equal(r2.allowed, true, 'Executive BGH can approve School-scope task');
    });

    test('Terminal State Protection: Reopening COMPLETED task is restricted to Executive and only to IN_PROGRESS', () => {
      const staffActor: ActorContext = { id: staffA.id, role: staffA.role, departmentId: staffA.departmentId };
      const bghActor: ActorContext = { id: bghUser.id, role: bghUser.role, departmentId: null };

      const task: TaskContext = {
        id: `task-wf-6-${testRunId}`,
        scope: 'DON_VI',
        departmentId: deptAId,
      };

      // Staff trying to reopen to IN_PROGRESS -> rejected
      const r1 = fsm.canTransition(staffActor, task, 'COMPLETED', 'IN_PROGRESS');
      assert.equal(r1.allowed, false, 'Staff cannot reopen completed task');

      // BGH trying to reopen directly to NEW -> rejected (must go to IN_PROGRESS)
      const r2 = fsm.canTransition(bghActor, task, 'COMPLETED', 'NEW');
      assert.equal(r2.allowed, false, 'Cannot reopen to state other than IN_PROGRESS');
      assert.equal(r2.code, 'TERMINAL_STATE_LOCKED');

      // BGH reopening to IN_PROGRESS -> allowed
      const r3 = fsm.canTransition(bghActor, task, 'COMPLETED', 'IN_PROGRESS');
      assert.equal(r3.allowed, true, 'BGH can reopen completed task to IN_PROGRESS');
    });
  });

  describe('2. OCC (Optimistic Concurrency Control) & Duplicate/Conflicting Updates', () => {
    test('OCC: Detects version conflict and throws ConflictError (HTTP 409)', async () => {
      // Create a task in DB
      const task = await prisma.task.create({
        data: {
          code: `TSK-OCC-1-${testRunId}`,
          title: `Task OCC Test ${testRunId}`,
          status: TaskStatus.IN_PROGRESS,
          priority: TaskPriority.NORMAL,
          scope: TaskScope.DEPARTMENT,
          departmentId: deptAId,
          createdById: leaderA.id,
          academicMonth: 9,
          academicYear: '2026-2027',
          dueDate: new Date(Date.now() + 86400000),
          version: 1,
        },
      });

      // User A reads version 1
      // User B updates task, advancing version to 2
      await prisma.task.update({
        where: { id: task.id },
        data: {
          title: `Updated by User B ${testRunId}`,
          version: { increment: 1 },
        },
      });

      // User A attempts update with stale expectedVersion = 1
      const req = new NextRequest(`http://localhost:3000/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${leaderAToken}`,
          cookie: `${SESSION_COOKIE_NAME}=${leaderAToken}`,
          origin: 'http://localhost:3000',
        },
        body: JSON.stringify({
          title: `Updated by User A with stale version`,
          expectedVersion: 1, // Stale! Current version is 2
        }),
      });

      const res = await patchTask(req, { params: Promise.resolve({ id: task.id }) });
      assert.equal(res.status, 409, 'Must return HTTP 409 Conflict');
      const json = await res.json();
      assert.equal(json.code, 'CONFLICT');
      assert(json.message.includes('xung đột phiên bản') || json.message.includes('conflict'));
    });

    test('OCC: Succeeds when expectedVersion matches current database version', async () => {
      const task = await prisma.task.create({
        data: {
          code: `TSK-OCC-2-${testRunId}`,
          title: `Task OCC Match Test ${testRunId}`,
          status: TaskStatus.IN_PROGRESS,
          priority: TaskPriority.NORMAL,
          scope: TaskScope.DEPARTMENT,
          departmentId: deptAId,
          createdById: leaderA.id,
          academicMonth: 9,
          academicYear: '2026-2027',
          dueDate: new Date(Date.now() + 86400000),
          version: 1,
        },
      });

      // Valid update with expectedVersion = 1
      const req = new NextRequest(`http://localhost:3000/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=${leaderAToken}`,
          origin: 'http://localhost:3000',
        },
        body: JSON.stringify({
          title: `Successfully updated with version 1`,
          expectedVersion: 1,
        }),
      });

      const res = await patchTask(req, { params: Promise.resolve({ id: task.id }) });
      assert.equal(res.status, 200, 'Must return HTTP 200 OK');
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.title, `Successfully updated with version 1`);
      assert.equal(json.data.version, 2, 'Version should increment to 2');
    });
  });
});
