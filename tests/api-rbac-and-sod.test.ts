import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET as getOverview } from "../src/app/api/dashboard/overview/route";
import { PATCH as patchTask } from "../src/app/api/tasks/[id]/route";
import { taskCommandService } from "../src/server/tasks";
import { ForbiddenError } from "../src/server/api/errors";
import prisma from "../src/lib/prisma";
import { signSessionToken, SESSION_COOKIE_NAME } from "../src/lib/jwt-session";
import {
  AssignmentStatus,
  AssignmentType,
  JobCatalogGroup,
  TaskScope,
  TaskStatus,
  TaskActorRole,
  UnitType,
} from "@prisma/client";

describe("RBAC and Segregation of Duties (SoD) API Control", () => {
  let adminToken: string;
  let bghToken: string;
  let leaderDeptToken: string;
  let staffToken: string;

  let adminUser: any;
  let bghUser: any;
  let leaderUser: any;
  let staffUser: any;

  let schoolTaskId: string;
  let deptTaskId: string;
  let schoolUnitId: string;
  let departmentUnitId: string;
  let positionDefinitionIds: string[] = [];
  let positionAssignmentIds: string[] = [];
  let testDelegationId: string | null = null;

  before(async () => {
    // 1. Fetch real seeded users
    adminUser = await prisma.user.findFirst({ where: { role: "ADMIN", isActive: true }, orderBy: { id: "asc" } });
    bghUser = await prisma.user.findFirst({ where: { role: "BAN_GIAM_HIEU", isActive: true }, orderBy: { id: "asc" } });
    leaderUser = await prisma.user.findFirst({ where: { role: "TRUONG_PHONG", isActive: true }, orderBy: { id: "asc" } });
    staffUser = await prisma.user.findFirst({ where: { role: "CHUYEN_VIEN", isActive: true }, orderBy: { id: "asc" } });

    assert.ok(adminUser, "Must have ADMIN user in DB");
    assert.ok(bghUser, "Must have BAN_GIAM_HIEU user in DB");
    assert.ok(leaderUser, "Must have TRUONG_PHONG user in DB");
    assert.ok(staffUser, "Must have CHUYEN_VIEN user in DB");

    adminToken = signSessionToken({
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: adminUser.role,

    });

    bghToken = signSessionToken({
      id: bghUser.id,
      email: bghUser.email,
      name: bghUser.name,
      role: bghUser.role,

    });

    leaderDeptToken = signSessionToken({
      id: leaderUser.id,
      email: leaderUser.email,
      name: leaderUser.name,
      role: leaderUser.role,

    });

    staffToken = signSessionToken({
      id: staffUser.id,
      email: staffUser.email,
      name: staffUser.name,
      role: staffUser.role,

    });

    // Use dedicated canonical organizational and position assignments so the test
    // does not depend on whichever seeded account findFirst happens to return.
    const [schoolUnit, departmentUnit] = await Promise.all([
      prisma.organizationalUnit.create({
        data: {
          code: `RBAC-SCH-${Date.now()}`,
          name: 'Đơn vị nhiệm vụ cấp trường kiểm thử',
          type: UnitType.SCHOOL,
        },
        select: { id: true },
      }),
      prisma.organizationalUnit.create({
        data: {
          code: `RBAC-DEP-${Date.now()}`,
          name: 'Đơn vị nhiệm vụ phòng kiểm thử',
          type: UnitType.DEPARTMENT,
        },
        select: { id: true },
      }),
    ]);
    schoolUnitId = schoolUnit.id;
    departmentUnitId = departmentUnit.id;

    const positionSpecs = [
      ['HIEU_TRUONG', 'Hiệu trưởng kiểm thử', JobCatalogGroup.LDPU, true],
      ['TRUONG_PHONG', 'Trưởng phòng kiểm thử', JobCatalogGroup.LDPU, true],
      ['CHUYEN_VIEN', 'Chuyên viên kiểm thử', JobCatalogGroup.VCDC, false],
    ] as const;
    const positions = await Promise.all(positionSpecs.map(async ([code, title, group, isLeadership]) => {
      const existing = await prisma.positionDefinition.findUnique({ where: { code } });
      if (existing) return existing;
      const created = await prisma.positionDefinition.create({
        data: { code, title, group, isLeadership },
      });
      positionDefinitionIds.push(created.id);
      return created;
    }));
    const positionIdsByCode = new Map(positions.map((position) => [position.code, position.id]));
    const assignmentSpecs = [
      { userId: adminUser.id, code: 'HIEU_TRUONG', unitId: schoolUnitId },
      { userId: bghUser.id, code: 'HIEU_TRUONG', unitId: schoolUnitId },
      { userId: leaderUser.id, code: 'TRUONG_PHONG', unitId: departmentUnitId },
      { userId: staffUser.id, code: 'CHUYEN_VIEN', unitId: departmentUnitId },
    ];
    const assignments = await Promise.all(assignmentSpecs.map((spec) =>
      prisma.positionAssignment.create({
        data: {
          userId: spec.userId,
          positionDefinitionId: positionIdsByCode.get(spec.code)!,
          unitId: spec.unitId,
          type: AssignmentType.PRIMARY,
          status: AssignmentStatus.ACTIVE,
          effectiveFrom: new Date('2024-01-01T00:00:00.000Z'),
        },
        select: { id: true },
      })
    ));
    positionAssignmentIds = assignments.map((assignment) => assignment.id);

    // 2. Create dedicated test tasks for clean isolation
    const createdSchoolTask = await prisma.task.create({
      data: {
        code: `TEST-RBAC-SCH-${Date.now()}`,
        title: "Test RBAC School Scope Task",
        scope: TaskScope.SCHOOL,
        status: TaskStatus.WAITING_APPROVAL,
        academicMonth: 9,
        academicYear: "2026-2027",
        dueDate: new Date("2026-09-30"),
        createdById: adminUser.id,
        leadUnitId: schoolUnitId,
        actors: {
          create: [
            { userId: leaderUser.id, role: TaskActorRole.DRI, isPrimaryDRI: true, appointedAt: new Date() },
            { userId: staffUser.id, role: TaskActorRole.COLLABORATOR, isPrimaryDRI: false, appointedAt: new Date() },
          ],
        },
      },
    });
    schoolTaskId = createdSchoolTask.id;

    const createdDeptTask = await prisma.task.create({
      data: {
        code: `TEST-RBAC-DEP-${Date.now()}`,
        title: "Test RBAC Department Scope Task",
        scope: TaskScope.DEPARTMENT,
        status: TaskStatus.WAITING_APPROVAL,
        academicMonth: 9,
        academicYear: "2026-2027",
        dueDate: new Date("2026-09-30"),
        createdById: leaderUser.id,
        leadUnitId: departmentUnitId,
        actors: {
          create: [
            { userId: staffUser.id, role: TaskActorRole.DRI, isPrimaryDRI: true, appointedAt: new Date() },
          ],
        },
      },
    });
    deptTaskId = createdDeptTask.id;
  });

  after(async () => {
    // Cleanup created test records
    if (testDelegationId) {
      await prisma.delegationGrant.deleteMany({ where: { id: testDelegationId } });
    }
    if (schoolTaskId) {
      await prisma.taskActor.deleteMany({ where: { taskId: schoolTaskId } });
      await prisma.task.deleteMany({ where: { id: schoolTaskId } });
    }
    if (deptTaskId) {
      await prisma.taskActor.deleteMany({ where: { taskId: deptTaskId } });
      await prisma.task.deleteMany({ where: { id: deptTaskId } });
    }
    if (positionAssignmentIds.length > 0) {
      await prisma.positionAssignment.deleteMany({ where: { id: { in: positionAssignmentIds } } });
    }
    if (positionDefinitionIds.length > 0) {
      await prisma.positionDefinition.deleteMany({ where: { id: { in: positionDefinitionIds } } });
    }
    const unitIds = [schoolUnitId, departmentUnitId].filter(Boolean);
    if (unitIds.length > 0) {
      await prisma.organizationalUnit.deleteMany({ where: { id: { in: unitIds } } });
    }
  });

  test("GET /api/dashboard/overview returns 401 when unauthenticated NextRequest is provided", async () => {
    const unauthReq = new NextRequest("http://localhost:3000/api/dashboard/overview");
    const res = await getOverview(unauthReq);
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.success, false);
  });

  test("GET /api/dashboard/overview returns 200 when authenticated", async () => {
    const authReq = new NextRequest("http://localhost:3000/api/dashboard/overview", {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
      },
    });
    const res = await getOverview(authReq);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.source, "database");
  });

  test("PATCH /api/tasks/[id] requires canonical command for direct status mutation", async () => {
    const req = new NextRequest(`http://localhost:3000/api/tasks/${schoolTaskId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        origin: "http://localhost:3000",
        cookie: `${SESSION_COOKIE_NAME}=${leaderDeptToken}`,
      },
      body: JSON.stringify({ status: "completed" }),
    });

    const res = await patchTask(req, { params: Promise.resolve({ id: schoolTaskId }) });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.code, "CANONICAL_COMMAND_REQUIRED");
  });

  test("taskCommandService disallows non-BGH/admin from completing SCHOOL task", async () => {
    // Leader of department is assigned to this school task, attempts to complete it without delegation
    const ctx = { user: leaderUser, requestId: "req-rbac-sch-1" };
    await assert.rejects(
      async () => {
        await taskCommandService.updateTask(ctx, schoolTaskId, { status: "completed" });
      },
      (err: any) => {
        assert.strictEqual(err.statusCode, 403);
        return true;
      }
    );
  });

  test("taskCommandService disallows assignee self-approval (SoD) on department task without delegation", async () => {
    // staffUser is PRIMARY_OWNER of deptTaskId
    const ctx = { user: staffUser, requestId: "req-rbac-dep-sod" };
    await assert.rejects(
      async () => {
        await taskCommandService.updateTask(ctx, deptTaskId, { status: "completed" });
      },
      (err: any) => {
        assert.strictEqual(err.statusCode, 403);
        return true;
      }
    );
  });

  test("taskCommandService prevents task creator from self-approving department task", async () => {
    const ctx = { user: leaderUser, requestId: "req-rbac-dep-creator" };
    await assert.rejects(
      () => taskCommandService.updateTask(ctx, deptTaskId, { status: "completed" }),
      (err: any) => {
        assert.strictEqual(err.statusCode, 403);
        return true;
      }
    );
  });

  test("taskCommandService allows BGH to complete SCHOOL task", async () => {
    const ctx = { user: bghUser, requestId: "req-rbac-sch-bgh" };
    const updated = await taskCommandService.updateTask(ctx, schoolTaskId, { status: "completed" });
    assert.strictEqual(updated.status, TaskStatus.COMPLETED);
  });
});
