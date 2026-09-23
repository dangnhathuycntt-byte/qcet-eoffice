/**
 * Regression coverage for department confinement in the dashboard overview API.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import {
  AssignmentStatus,
  AssignmentType,
  JobCatalogGroup,
  TaskActorRole,
  TaskPriority,
  TaskScope,
  TaskStatus,
  UnitType,
  UserRole,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { signSessionToken, SESSION_COOKIE_NAME } from '@/lib/jwt-session';
import { GET as getDashboardOverview } from '@/app/api/dashboard/overview/route';

describe('GET /api/dashboard/overview — non-admin scope confinement', () => {
  const runId = `dash-scope-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  let unitId: string | undefined;
  let createdPositionDefinitionId: string | undefined;
  const positionAssignmentIds: string[] = [];
  let userWithUnitId: string | undefined;
  let userWithoutUnitId: string | undefined;
  let scopedTaskId: string | undefined;
  let outOfUnitTaskId: string | undefined;
  let outsideUnitId: string | undefined;
  let tokenWithUnit: string;
  let tokenWithoutUnit: string;

  before(async () => {
    const unit = await prisma.organizationalUnit.create({
      data: {
        code: `U-${runId}`,
        name: `Đơn vị kiểm thử dashboard ${runId}`,
        type: UnitType.DEPARTMENT,
      },
    });
    unitId = unit.id;

    let positionDefinition = await prisma.positionDefinition.findFirst({
      where: { code: 'CHUYEN_VIEN_HDNS' },
      select: { id: true },
    });
    if (!positionDefinition) {
      positionDefinition = await prisma.positionDefinition.create({
        data: {
          code: `CV-${runId}`,
          title: 'Chuyên viên kiểm thử dashboard',
          group: JobCatalogGroup.VCDC,
          isLeadership: false,
        },
        select: { id: true },
      });
      createdPositionDefinitionId = positionDefinition.id;
    }

    const userWithUnit = await prisma.user.create({
      data: {
        email: `dash.unit.${runId}@qcet.edu.vn`,
        name: `Nhân viên có đơn vị ${runId}`,
        role: UserRole.CHUYEN_VIEN,
        isActive: true,
      },
    });
    userWithUnitId = userWithUnit.id;

    const assignment = await prisma.positionAssignment.create({
      data: {
        userId: userWithUnit.id,
        unitId: unit.id,
        positionDefinitionId: positionDefinition.id,
        status: AssignmentStatus.ACTIVE,
        type: AssignmentType.PRIMARY,
        effectiveFrom: new Date('2024-01-01T00:00:00.000Z'),
      },
    });
    positionAssignmentIds.push(assignment.id);

    tokenWithUnit = signSessionToken({
      id: userWithUnit.id,
      email: userWithUnit.email,
      name: userWithUnit.name,
      role: userWithUnit.role,
    });
    await prisma.session.create({
      data: {
        sessionToken: tokenWithUnit,
        userId: userWithUnit.id,
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const userWithoutUnit = await prisma.user.create({
      data: {
        email: `dash.nounit.${runId}@qcet.edu.vn`,
        name: `Nhân viên không có đơn vị ${runId}`,
        role: UserRole.CHUYEN_VIEN,
        isActive: true,
      },
    });
    userWithoutUnitId = userWithoutUnit.id;

    const rootTask = await prisma.task.create({
      data: {
        code: `DASH-${runId}`,
        title: `Nhiệm vụ cấp trường ${runId}`,
        scope: TaskScope.SCHOOL,
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.NORMAL,
        academicMonth: 9,
        academicYear: '2026-2027',
        dueDate: new Date('2026-10-30T00:00:00.000Z'),
        createdById: userWithUnit.id,
        leadUnitId: unit.id,
        actors: {
          create: [
            {
              userId: userWithUnit.id,
              role: TaskActorRole.DRI,
              isPrimaryDRI: true,
            },
            {
              userId: userWithoutUnit.id,
              role: TaskActorRole.COLLABORATOR,
              isPrimaryDRI: false,
            },
          ],
        },
      },
    });
    scopedTaskId = rootTask.id;

    const outsideUnit = await prisma.organizationalUnit.create({
      data: {
        code: `U-OUT-${runId}`,
        name: `Đơn vị ngoài phạm vi ${runId}`,
        type: UnitType.DEPARTMENT,
      },
    });
    outsideUnitId = outsideUnit.id;
    const outsideTask = await prisma.task.create({
      data: {
        code: `DASH-OUT-${runId}`,
        title: `Nhiệm vụ đơn vị ngoài ${runId}`,
        scope: TaskScope.DEPARTMENT,
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.NORMAL,
        academicMonth: 9,
        academicYear: '2026-2027',
        dueDate: new Date('2026-10-30T00:00:00.000Z'),
        createdById: userWithUnit.id,
        leadUnitId: outsideUnit.id,
        parentTaskId: rootTask.id,
        actors: {
          create: {
            userId: userWithUnit.id,
            role: TaskActorRole.DRI,
            isPrimaryDRI: true,
          },
        },
      },
    });
    outOfUnitTaskId = outsideTask.id;

    tokenWithoutUnit = signSessionToken({
      id: userWithoutUnit.id,
      email: userWithoutUnit.email,
      name: userWithoutUnit.name,
      role: userWithoutUnit.role,
    });
    await prisma.session.create({
      data: {
        sessionToken: tokenWithoutUnit,
        userId: userWithoutUnit.id,
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  });

  after(async () => {
    if (scopedTaskId) {
      await prisma.task.deleteMany({ where: { id: scopedTaskId } });
    }
    if (outOfUnitTaskId) {
      await prisma.task.deleteMany({ where: { id: outOfUnitTaskId } });
    }
    const userIds = [userWithUnitId, userWithoutUnitId].filter(
      (id): id is string => Boolean(id)
    );
    if (userIds.length > 0) {
      await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    }
    if (positionAssignmentIds.length > 0) {
      await prisma.positionAssignment.deleteMany({
        where: { id: { in: positionAssignmentIds } },
      });
    }
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    const unitIds = [unitId, outsideUnitId].filter((id): id is string => Boolean(id));
    if (unitIds.length > 0) {
      await prisma.organizationalUnit.deleteMany({ where: { id: { in: unitIds } } });
    }
    if (createdPositionDefinitionId) {
      await prisma.positionDefinition.deleteMany({
        where: { id: createdPositionDefinitionId },
      });
    }
  });

  it('returns 401 when unauthenticated', async () => {
    const response = await getDashboardOverview(
      new NextRequest('http://localhost/api/dashboard/overview')
    );
    assert.strictEqual(response.status, 401);
  });

  it('confines department health, tasks, and activities to a non-admin unit', async () => {
    const response = await getDashboardOverview(
      new NextRequest('http://localhost/api/dashboard/overview', {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${tokenWithUnit}` },
      })
    );
    assert.strictEqual(response.status, 200);

    const json = await response.json();
    assert.ok(Array.isArray(json.departmentHealth));
    assert.ok(json.departmentHealth.length <= 1);
    for (const department of json.departmentHealth) {
      assert.strictEqual(department.departmentId, unitId);
    }

    assert.ok(Array.isArray(json.tasks));
    for (const task of json.tasks) {
      assert.strictEqual(task.departmentId, unitId);
      for (const subTask of task.subTasks ?? []) {
        assert.ok(
          subTask.departmentId === unitId || subTask.assigneeId === userWithUnitId,
          'Không được trả nhiệm vụ con ngoài đơn vị nếu không thuộc caller'
        );
      }
    }
    assert.deepStrictEqual(json.activities, []);
  });

  it('ignores a cross-unit department query parameter for non-admin users', async () => {
    const response = await getDashboardOverview(
      new NextRequest(
        `http://localhost/api/dashboard/overview?departmentId=other-unit-${runId}`,
        { headers: { cookie: `${SESSION_COOKIE_NAME}=${tokenWithUnit}` } }
      )
    );
    assert.strictEqual(response.status, 200);

    const json = await response.json();
    for (const department of json.departmentHealth) {
      assert.strictEqual(department.departmentId, unitId);
    }
    for (const task of json.tasks) {
      assert.strictEqual(task.departmentId, unitId);
    }
  });

  it('fails closed for a non-admin account without a unit', async () => {
    const response = await getDashboardOverview(
      new NextRequest('http://localhost/api/dashboard/overview', {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${tokenWithoutUnit}` },
      })
    );
    assert.strictEqual(response.status, 200);

    const json = await response.json();
    assert.deepStrictEqual(json.departmentHealth, []);
    assert.deepStrictEqual(json.activities, []);
    assert.ok(Array.isArray(json.tasks));
    const visibleParentTask = json.tasks.find(
      (task: { id: string }) => task.id === scopedTaskId
    );
    assert.ok(visibleParentTask, 'Người tham gia vẫn thấy nhiệm vụ được giao cho mình');
    assert.ok(
      !visibleParentTask.subTasks?.some(
        (task: { id: string }) => task.id === outOfUnitTaskId
      ),
      'Không được lộ nhiệm vụ con của đơn vị khác chỉ vì người dùng thấy nhiệm vụ cha'
    );
  });
});
