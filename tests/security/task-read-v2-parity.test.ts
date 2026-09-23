import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

if (!process.env.QCET_ALLOW_DB_TESTS) {
  process.env.QCET_ALLOW_DB_TESTS = '1';
}
if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'test') {
  (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
}
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('_test')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/\/qcet_eoffice(\?.*)?$/, '/qcet_test$1');
}

import { prisma } from '@/lib/prisma';
import {
  TaskScope,
  TaskStatus,
  TaskPriority,
  UserRole,
  TaskActorRole,
  AssignmentStatus,
  UnitType
} from '@prisma/client';
import {
  buildTaskReadWhere,
  isAuthorizationContext,
  taskQueryService,
} from '@/server/tasks/task-query-service';
import type { AuthenticatedUser } from '@/server/api/request-context';
import {
  AuthorizationContextModel,
  SystemRole,
  type ActivePositionAssignment,
} from '@/server/authorization/authorization-context';


describe('Task Read V2 Parity & Canonical Authorization Filter Suite (Task 7 / F02)', () => {
  const testRunId = `v2_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const deptAId = `dept_a_${testRunId}`;
  const deptBId = `dept_b_${testRunId}`;

  let staffAUser: AuthenticatedUser;
  let adminUser: AuthenticatedUser;
  let leadershipUser: AuthenticatedUser;

  let taskAId: string;
  let taskBId: string;
  let schoolTaskId: string;
  let assignedTaskId: string;

  before(async () => {
    const dbUrl = process.env.DATABASE_URL || '';
    let dbName = '';
    try {
      dbName = new URL(dbUrl).pathname.replace(/^\//, '');
    } catch {}

    const isExplicitTestOptIn = process.env.QCET_ALLOW_DB_TESTS === '1';
    const isTestEnv = process.env.NODE_ENV === 'test';
    const isLocalHost = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
    const isTestDbName = dbName.endsWith('_test') || dbName.endsWith('test');
    const isKnownProductionOrCloud =
      dbUrl.includes('production') ||
      dbUrl.includes('prod.') ||
      dbUrl.includes('supabase') ||
      dbUrl.includes('neon.tech');

    const passesStrictIsolation =
      isExplicitTestOptIn &&
      isTestEnv &&
      isLocalHost &&
      isTestDbName &&
      !isKnownProductionOrCloud;

    if (!passesStrictIsolation) {
      throw new Error(
        `SECURITY INVARIANT VIOLATION: tests/security/task-read-v2-parity.test.ts requires: ` +
        `QCET_ALLOW_DB_TESTS=1 AND NODE_ENV=test AND localhost/127.0.0.1 AND test database name ending in '_test'. Execution aborted.`
      );
    }

    // 1. Create test departments
    await prisma.organizationalUnit.createMany({
      data: [
        {
          id: deptAId,
          name: `Phòng Ban Test A ${testRunId}`,
          code: deptAId,
          type: 'PHONG_BAN' as any,
          status: 'ACTIVE' as any,
        },
        {
          id: deptBId,
          name: `Phòng Ban Test B ${testRunId}`,
          code: deptBId,
          type: 'PHONG_BAN' as any,
          status: 'ACTIVE' as any,
        },
      ],
    });

    // 2. Create users
    const dbStaffA = await prisma.user.create({
      data: {
        email: `staff.a.${testRunId}@qcet.edu.vn`,
        name: `Chuyên viên A ${testRunId}`,
        role: UserRole.CHUYEN_VIEN,

        passwordHash: 'FakePasswordHash123',
      },
    });

    const dbStaffB = await prisma.user.create({
      data: {
        email: `staff.b.${testRunId}@qcet.edu.vn`,
        name: `Chuyên viên B ${testRunId}`,
        role: UserRole.CHUYEN_VIEN,

        passwordHash: 'FakePasswordHash123',
      },
    });

    const dbAdmin = await prisma.user.create({
      data: {
        email: `admin.${testRunId}@qcet.edu.vn`,
        name: `Quản trị hệ thống ${testRunId}`,
        role: UserRole.ADMIN,

        passwordHash: 'FakePasswordHash123',
      },
    });

    const dbLeadership = await prisma.user.create({
      data: {
        email: `ht.${testRunId}@qcet.edu.vn`,
        name: `Hiệu trưởng ${testRunId}`,
        role: UserRole.BAN_GIAM_HIEU,
        title: 'Hiệu trưởng',

        passwordHash: 'FakePasswordHash123',
      },
    });

    staffAUser = {
      id: dbStaffA.id,
      email: dbStaffA.email,
      name: dbStaffA.name,
      role: dbStaffA.role,

    };

    adminUser = {
      id: dbAdmin.id,
      email: dbAdmin.email,
      name: dbAdmin.name,
      role: dbAdmin.role,

    };

    leadershipUser = {
      id: dbLeadership.id,
      email: dbLeadership.email,
      name: dbLeadership.name,
      role: dbLeadership.role,

      title: dbLeadership.title,
    };

    // 3. Create test tasks
    // Task A: in Dept A
    const tA = await prisma.task.create({
      data: {
        title: `Task Dept A ${testRunId}`,
        code: `TA-${testRunId}`.slice(0, 20),
        scope: TaskScope.DEPARTMENT,
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.NORMAL,

        createdById: dbStaffA.id,
        academicMonth: 9,
        academicYear: '2026-2027',
        dueDate: new Date(Date.now() + 7 * 86400000),
      },
    });
    taskAId = tA.id;

    // Task B: in Dept B (cross-department from Staff A)
    const tB = await prisma.task.create({
      data: {
        title: `Task Dept B ${testRunId}`,
        code: `TB-${testRunId}`.slice(0, 20),
        scope: TaskScope.DEPARTMENT,
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.NORMAL,

        createdById: dbStaffB.id,
        academicMonth: 9,
        academicYear: '2026-2027',
        dueDate: new Date(Date.now() + 7 * 86400000),
      },
    });
    taskBId = tB.id;

    // School Task: Scope SCHOOL, unassigned to any department
    const tSchool = await prisma.task.create({
      data: {
        title: `School Task ${testRunId}`,
        code: `TS-${testRunId}`.slice(0, 20),
        scope: TaskScope.SCHOOL,
        status: TaskStatus.NOT_STARTED,
        priority: TaskPriority.URGENT,
        createdById: dbAdmin.id,
        academicMonth: 9,
        academicYear: '2026-2027',
        dueDate: new Date(Date.now() + 14 * 86400000),
      },
    });
    schoolTaskId = tSchool.id;

    // Assigned Task: in Dept B, but Staff A is an assignee
    const tAssigned = await prisma.task.create({
      data: {
        title: `Assigned Task Dept B ${testRunId}`,
        code: `TAB-${testRunId}`.slice(0, 20),
        scope: TaskScope.DEPARTMENT,
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.NORMAL,

        createdById: dbStaffB.id,
        academicMonth: 9,
        academicYear: '2026-2027',
        dueDate: new Date(Date.now() + 7 * 86400000),
        actors: {
          create: [
            { userId: dbStaffA.id, role: TaskActorRole.COLLABORATOR, isPrimaryDRI: false, appointedAt: new Date() },
          ],
        },
      },
    });
    assignedTaskId = tAssigned.id;
  });

  after(async () => {
    try {
      await prisma.taskActor.deleteMany({
        where: { taskId: { in: [taskAId, taskBId, schoolTaskId, assignedTaskId] } },
      });
      await prisma.task.deleteMany({
        where: { id: { in: [taskAId, taskBId, schoolTaskId, assignedTaskId] } },
      });
      await prisma.user.deleteMany({
        where: {
          id: {
            in: [staffAUser?.id, adminUser?.id, leadershipUser?.id],
          },
        },
      });
      await prisma.organizationalUnit.deleteMany({
        where: { id: { in: [deptAId, deptBId] } },
      });
    } catch {}
  });

  describe('1. Unit / In-Memory Parity of buildTaskReadWhere', () => {
    test('isAuthorizationContext distinguishes context from user model', () => {
      assert.equal(isAuthorizationContext(staffAUser), false);

      const authContext = new AuthorizationContextModel({
        userId: staffAUser.id,
        user: { id: staffAUser.id, email: staffAUser.email, name: staffAUser.name, isActive: true },
        systemRoles: [],
        positions: [],
        responsibilityAreas: [],
        portfolios: [],
        delegations: [],
        bodyMemberships: [],
        primaryUnitIds: [deptAId],
      });
      assert.equal(isAuthorizationContext(authContext), true);
    });

    test('Anonymous/null context returns default deny filter', () => {
      const filter = buildTaskReadWhere(null as any);
      assert.deepEqual(filter, { id: '__DENY_ANONYMOUS__' });
    });

    test('AuthenticatedUser System Admin returns unconstrained filter {}', () => {
      const filter = buildTaskReadWhere(adminUser);
      assert.deepEqual(filter, {});
    });

    test('AuthenticatedUser Leadership returns unconstrained filter {}', () => {
      const filter = buildTaskReadWhere(leadershipUser);
      assert.deepEqual(filter, {});
    });

    test('AuthenticatedUser Staff returns unit and direct-participation filter', () => {
      const filter = buildTaskReadWhere(staffAUser);
      assert.ok(Array.isArray((filter as any).OR));
      const conditions = (filter as any).OR;
      assert.equal(conditions.length, 3);
      assert.deepEqual(conditions[0], { assignees: { some: { userId: staffAUser.id } } });
      assert.deepEqual(conditions[1], { actors: { some: { userId: staffAUser.id } } });
      assert.deepEqual(conditions[2], { departmentId: deptAId });
    });

    test('AuthorizationContext System Admin returns unconstrained filter {}', () => {
      const ctx = new AuthorizationContextModel({
        userId: adminUser.id,
        user: { id: adminUser.id, email: adminUser.email, name: adminUser.name, isActive: true },
        systemRoles: [SystemRole.SYSTEM_ADMIN],
        positions: [],
        responsibilityAreas: [],
        portfolios: [],
        delegations: [],
        bodyMemberships: [],
        primaryUnitIds: [],
      });
      const filter = buildTaskReadWhere(ctx);
      assert.deepEqual(filter, {});
    });

    test('AuthorizationContext Active Institutional Leadership returns unconstrained filter {}', () => {
      const leadershipPosition: ActivePositionAssignment = {
        id: `pos_ht_${testRunId}`,
        userId: leadershipUser.id,
        positionDefinitionId: 'def_hieu_truong',
        positionCode: 'HIEU_TRUONG',
        positionTitle: 'Hiệu trưởng',
        positionLevel: 1,
        isLeadership: true,
        unitId: deptAId,
        unitCode: 'BGH',
        unitName: 'Ban Giám hiệu',
        unitType: UnitType.SCHOOL,
        unitStatus: 'ACTIVE' as any,
        type: 'PRIMARY' as any,
        isActing: false,
        effectiveFrom: new Date('2020-01-01'),
        effectiveTo: null,
        status: AssignmentStatus.ACTIVE,
        sourceDecisionNumber: 'QD-01',
      };

      const ctx = new AuthorizationContextModel({
        userId: leadershipUser.id,
        user: { id: leadershipUser.id, email: leadershipUser.email, name: leadershipUser.name, isActive: true },
        systemRoles: [],
        positions: [leadershipPosition],
        responsibilityAreas: [],
        portfolios: [],
        delegations: [],
        bodyMemberships: [],
        primaryUnitIds: [deptAId],
      });
      const filter = buildTaskReadWhere(ctx);
      assert.deepEqual(filter, {});
    });

    test('AuthorizationContext Expired Leadership Assignment drops back to staff scope', () => {
      const expiredLeadershipPosition: ActivePositionAssignment = {
        id: `pos_expired_ht_${testRunId}`,
        userId: staffAUser.id,
        positionDefinitionId: 'def_hieu_truong',
        positionCode: 'HIEU_TRUONG',
        positionTitle: 'Hiệu trưởng tiền nhiệm',
        positionLevel: 1,
        isLeadership: true,
        unitId: deptAId,
        unitCode: 'BGH',
        unitName: 'Ban Giám hiệu',
        unitType: UnitType.SCHOOL,
        unitStatus: 'ACTIVE' as any,
        type: 'PRIMARY' as any,
        isActing: false,
        effectiveFrom: new Date('2020-01-01'),
        effectiveTo: new Date(Date.now() - 86400000), // Expired yesterday
        status: AssignmentStatus.ACTIVE,
        sourceDecisionNumber: 'QD-EXPIRED',
      };

      const activeStaffPosition: ActivePositionAssignment = {
        id: `pos_staff_${testRunId}`,
        userId: staffAUser.id,
        positionDefinitionId: 'def_staff',
        positionCode: 'CHUYEN_VIEN',
        positionTitle: 'Chuyên viên',
        positionLevel: 4,
        isLeadership: false,
        unitId: deptAId,
        unitCode: 'DA',
        unitName: 'Phòng A',
        unitType: UnitType.DEPARTMENT,
        unitStatus: 'ACTIVE' as any,
        type: 'PRIMARY' as any,
        isActing: false,
        effectiveFrom: new Date('2020-01-01'),
        effectiveTo: null,
        status: AssignmentStatus.ACTIVE,
        sourceDecisionNumber: 'QD-STAFF',
      };

      const ctx = new AuthorizationContextModel({
        userId: staffAUser.id,
        user: { id: staffAUser.id, email: staffAUser.email, name: staffAUser.name, isActive: true },
        systemRoles: [],
        positions: [expiredLeadershipPosition, activeStaffPosition],
        responsibilityAreas: [],
        portfolios: [],
        delegations: [],
        bodyMemberships: [],
        primaryUnitIds: [deptAId],
      });

      const filter = buildTaskReadWhere(ctx);

      // Must NOT be unconstrained {}
      assert.notDeepEqual(filter, {});
      assert.ok(Array.isArray((filter as any).OR));
      const conditions = (filter as any).OR;
      assert.deepEqual(conditions[0], { assignees: { some: { userId: staffAUser.id } } });
      assert.deepEqual(conditions[1], { actors: { some: { userId: staffAUser.id } } });
      assert.deepEqual(conditions[2], { departmentId: deptAId });
    });

    test('AuthorizationContext multi-unit manager builds in filter across assigned units', () => {
      const ctx = new AuthorizationContextModel({
        userId: staffAUser.id,
        user: { id: staffAUser.id, email: staffAUser.email, name: staffAUser.name, isActive: true },
        systemRoles: [],
        positions: [],
        responsibilityAreas: [],
        portfolios: [],
        delegations: [],
        bodyMemberships: [],
        primaryUnitIds: [deptAId, deptBId],
      });

      const filter = buildTaskReadWhere(ctx);
      assert.ok(Array.isArray((filter as any).OR));
      const conditions = (filter as any).OR;
      assert.deepEqual(conditions[2], { departmentId: { in: [deptAId, deptBId] } });
    });
  });

  describe('2. QueryTasks Database Execution Parity', () => {
    test('Staff with unit A: sees task in unit A, sees assigned task, does NOT see task in unit B, does NOT see unassigned school task', async () => {
      const result = await taskQueryService.queryTasks(
        { user: staffAUser },
        { search: testRunId }
      );

      const returnedIds = result.tasks.map((t) => t.id);

      assert.ok(returnedIds.includes(taskAId), 'Staff A must see task in own unit A');
      assert.ok(returnedIds.includes(assignedTaskId), 'Staff A must see task where they are an assignee');
      assert.equal(returnedIds.includes(taskBId), false, 'Staff A must NOT see task in unit B');
      assert.equal(returnedIds.includes(schoolTaskId), false, 'Staff A must NOT see unassigned school task');
    });

    test('Staff with unit A via AuthorizationContext: enforces identical read boundaries', async () => {
      const staffAContext = new AuthorizationContextModel({
        userId: staffAUser.id,
        user: { id: staffAUser.id, email: staffAUser.email, name: staffAUser.name, isActive: true },
        systemRoles: [],
        positions: [
          {
            id: `pos_staff_a_${testRunId}`,
            userId: staffAUser.id,
            positionDefinitionId: 'def_staff',
            positionCode: 'CHUYEN_VIEN',
            positionTitle: 'Chuyên viên',
            positionLevel: 4,
            isLeadership: false,
            unitId: deptAId,
            unitCode: 'DA',
            unitName: 'Phòng A',
            unitType: UnitType.DEPARTMENT,
            unitStatus: 'ACTIVE' as any,
            type: 'PRIMARY' as any,
            isActing: false,
            effectiveFrom: new Date('2020-01-01'),
            effectiveTo: null,
            status: AssignmentStatus.ACTIVE,
            sourceDecisionNumber: 'QD-CV',
          },
        ],
        responsibilityAreas: [],
        portfolios: [],
        delegations: [],
        bodyMemberships: [],
        primaryUnitIds: [deptAId],
      });

      const result = await taskQueryService.queryTasks(staffAContext, {
        search: testRunId,
      });

      const returnedIds = result.tasks.map((t) => t.id);

      assert.ok(returnedIds.includes(taskAId), 'Staff A Context must see task in own unit A');
      assert.ok(returnedIds.includes(assignedTaskId), 'Staff A Context must see assigned task');
      assert.equal(returnedIds.includes(taskBId), false, 'Staff A Context must NOT see unit B task');
      assert.equal(returnedIds.includes(schoolTaskId), false, 'Staff A Context must NOT see unassigned school task');
    });

    test('Institutional Leadership (HIEU_TRUONG context): sees unit A, unit B, and school tasks', async () => {
      const leadershipContext = new AuthorizationContextModel({
        userId: leadershipUser.id,
        user: { id: leadershipUser.id, email: leadershipUser.email, name: leadershipUser.name, isActive: true },
        systemRoles: [],
        positions: [
          {
            id: `pos_leadership_${testRunId}`,
            userId: leadershipUser.id,
            positionDefinitionId: 'def_ht',
            positionCode: 'HIEU_TRUONG',
            positionTitle: 'Hiệu trưởng',
            positionLevel: 1,
            isLeadership: true,
            unitId: deptAId,
            unitCode: 'BGH',
            unitName: 'Ban Giám hiệu',
            unitType: UnitType.SCHOOL,
            unitStatus: 'ACTIVE' as any,
            type: 'PRIMARY' as any,
            isActing: false,
            effectiveFrom: new Date('2020-01-01'),
            effectiveTo: null,
            status: AssignmentStatus.ACTIVE,
            sourceDecisionNumber: 'QD-BGH',
          },
        ],
        responsibilityAreas: [],
        portfolios: [],
        delegations: [],
        bodyMemberships: [],
        primaryUnitIds: [deptAId],
      });

      const result = await taskQueryService.queryTasks(leadershipContext, {
        search: testRunId,
      });

      const returnedIds = result.tasks.map((t) => t.id);

      assert.ok(returnedIds.includes(taskAId), 'Institutional Leadership must see unit A task');
      assert.ok(returnedIds.includes(taskBId), 'Institutional Leadership must see unit B task');
      assert.ok(returnedIds.includes(schoolTaskId), 'Institutional Leadership must see unassigned school task');
      assert.ok(returnedIds.includes(assignedTaskId), 'Institutional Leadership must see assigned task');
    });

    test('System Admin context: sees all tasks', async () => {
      const adminContext = new AuthorizationContextModel({
        userId: adminUser.id,
        user: { id: adminUser.id, email: adminUser.email, name: adminUser.name, isActive: true },
        systemRoles: [SystemRole.SYSTEM_ADMIN],
        positions: [],
        responsibilityAreas: [],
        portfolios: [],
        delegations: [],
        bodyMemberships: [],
        primaryUnitIds: [],
      });

      const result = await taskQueryService.queryTasks(adminContext, {
        search: testRunId,
      });

      const returnedIds = result.tasks.map((t) => t.id);

      assert.ok(returnedIds.includes(taskAId), 'System Admin must see unit A task');
      assert.ok(returnedIds.includes(taskBId), 'System Admin must see unit B task');
      assert.ok(returnedIds.includes(schoolTaskId), 'System Admin must see school task');
      assert.ok(returnedIds.includes(assignedTaskId), 'System Admin must see assigned task');
    });

    test('Expired leadership assignment: drops back to staff scope in query execution', async () => {
      const expiredLeadershipContext = new AuthorizationContextModel({
        userId: staffAUser.id,
        user: { id: staffAUser.id, email: staffAUser.email, name: staffAUser.name, isActive: true },
        systemRoles: [],
        positions: [
          {
            id: `pos_expired_ht_query_${testRunId}`,
            userId: staffAUser.id,
            positionDefinitionId: 'def_ht',
            positionCode: 'HIEU_TRUONG',
            positionTitle: 'Hiệu trưởng',
            positionLevel: 1,
            isLeadership: true,
            unitId: deptAId,
            unitCode: 'BGH',
            unitName: 'Ban Giám hiệu',
            unitType: UnitType.SCHOOL,
            unitStatus: 'ACTIVE' as any,
            type: 'PRIMARY' as any,
            isActing: false,
            effectiveFrom: new Date('2020-01-01'),
            effectiveTo: new Date(Date.now() - 10000), // Expired
            status: AssignmentStatus.ACTIVE,
            sourceDecisionNumber: 'QD-EXP',
          },
        ],
        responsibilityAreas: [],
        portfolios: [],
        delegations: [],
        bodyMemberships: [],
        primaryUnitIds: [deptAId],
      });

      const result = await taskQueryService.queryTasks(expiredLeadershipContext, {
        search: testRunId,
      });

      const returnedIds = result.tasks.map((t) => t.id);

      assert.ok(returnedIds.includes(taskAId), 'User with expired leadership sees their unit A task');
      assert.equal(returnedIds.includes(taskBId), false, 'User with expired leadership must NOT see unit B task');
      assert.equal(returnedIds.includes(schoolTaskId), false, 'User with expired leadership must NOT see unassigned school task');
    });
  });
});
