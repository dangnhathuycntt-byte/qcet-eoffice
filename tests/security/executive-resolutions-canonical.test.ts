import nextEnvPkg from '@next/env';
const loadEnvConfig = (nextEnvPkg as any)?.loadEnvConfig || (nextEnvPkg as any)?.default?.loadEnvConfig || (nextEnvPkg as any);
if (typeof loadEnvConfig === 'function') {
  loadEnvConfig(process.cwd());
}

if (!process.env.QCET_ALLOW_DB_TESTS) {
  process.env.QCET_ALLOW_DB_TESTS = '1';
}
if (!process.env.NODE_ENV) {
  (process.env as any).NODE_ENV = 'test';
}
if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('/qcet_eoffice')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/\/qcet_eoffice(\?.*)?$/, '/qcet_test$1');
}

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  UserRole,
  UnitType,
  JobCatalogGroup,
  TaskScope,
  TaskPriority,
  TaskStatus,
  AssignmentType,
  AssignmentStatus,
  TaskPriority as TaskPriorityEnum
} from '@prisma/client';
import { signSessionToken } from '@/lib/jwt-session';
import { GET as getResolutions, POST as createResolution } from '@/app/api/executive/resolutions/route';

// Local fallback: AssigneeRole was removed from @prisma/client in Phase 9
const AssigneeRole = {
  PRIMARY_OWNER: 'PRIMARY_OWNER',
  COLLABORATOR: 'COLLABORATOR',
  SUPERVISOR: 'SUPERVISOR',
} as const;
type AssigneeRole = keyof typeof AssigneeRole;


/**
 * Issue #27 corrective review: `/api/executive/*` business authority must
 * come from the canonical authorization layer (active PositionAssignment),
 * never from technical role strings. Technical ADMIN without an executive
 * assignment is denied; a rector/BGH holding a valid HIEU_TRUONG assignment
 * is allowed. A BAN_GIAM_HIEU *role* without any assignment is denied.
 */
describe('Issue #27: executive resolutions canonical statutory authority', () => {
  const runId = `exec-${Date.now()}`;

  let dept: any;
  let unit: any;
  let rectorUser: any;
  let adminUser: any;
  let staffUser: any;
  let bghNoAssignUser: any;

  let rectorToken: string;
  let adminToken: string;
  let staffToken: string;
  let bghNoAssignToken: string;

  let task: any;

  const bearer = (token: string) => ({
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  });

  before(async () => {
    dept = await prisma.department.create({
      data: { id: `DEPT_EXEC_${runId}`, name: `Dept Exec ${runId}` },
    });
    unit = await prisma.organizationalUnit.create({
      data: { code: `U-EXEC-${runId}`, name: `Unit Exec ${runId}`, type: UnitType.DEPARTMENT },
    });

    let rectorDef = await prisma.positionDefinition.findUnique({ where: { code: 'HIEU_TRUONG' } });
    if (!rectorDef) {
      rectorDef = await prisma.positionDefinition.create({
        data: { code: 'HIEU_TRUONG', title: 'Hieu truong', group: JobCatalogGroup.LDPU, isLeadership: true },
      });
    }

    rectorUser = await prisma.user.create({
      data: { email: `rector.${runId}@qnc.edu.vn`, name: `Rector ${runId}`, role: UserRole.BAN_GIAM_HIEU, isActive: true },
    });
    adminUser = await prisma.user.create({
      data: { email: `admin.${runId}@qnc.edu.vn`, name: `Admin ${runId}`, role: UserRole.ADMIN, isActive: true },
    });
    staffUser = await prisma.user.create({
      data: { email: `staff.${runId}@qnc.edu.vn`, name: `Staff ${runId}`, role: UserRole.CHUYEN_VIEN, departmentId: dept.id, isActive: true },
    });
    bghNoAssignUser = await prisma.user.create({
      data: { email: `bghna.${runId}@qnc.edu.vn`, name: `BGH NoAssign ${runId}`, role: UserRole.BAN_GIAM_HIEU, isActive: true },
    });

    await prisma.positionAssignment.create({
      data: {
        userId: rectorUser.id,
        unitId: unit.id,
        positionDefinitionId: rectorDef.id,
        status: AssignmentStatus.ACTIVE,
        type: AssignmentType.PRIMARY,
        effectiveFrom: new Date('2020-01-01'),
      },
    });

    rectorToken = signSessionToken({ id: rectorUser.id, email: rectorUser.email, name: rectorUser.name, role: rectorUser.role });
    adminToken = signSessionToken({ id: adminUser.id, email: adminUser.email, name: adminUser.name, role: adminUser.role });
    staffToken = signSessionToken({ id: staffUser.id, email: staffUser.email, name: staffUser.name, role: staffUser.role, departmentId: dept.id });
    bghNoAssignToken = signSessionToken({ id: bghNoAssignUser.id, email: bghNoAssignUser.email, name: bghNoAssignUser.name, role: bghNoAssignUser.role });

    task = await prisma.task.create({
      data: {
        code: `NV-EXEC-${runId}`,
        title: `Nhiem vu can chi dao ${runId}`,
        scope: TaskScope.DEPARTMENT,
        priority: TaskPriority.NORMAL,
        status: TaskStatus.IN_PROGRESS,
        academicMonth: 10,
        academicYear: '2026-2027',
        dueDate: new Date('2026-11-01'),
        createdById: staffUser.id,
        departmentId: dept.id,
        assignees: { create: [{ userId: staffUser.id, roleInTask: AssigneeRole.PRIMARY_OWNER }] },
      },
    });
  });

  after(async () => {
    await prisma.executiveResolution.deleteMany({ where: { taskId: task?.id } }).catch(() => undefined);
    await prisma.taskAssignee.deleteMany({ where: { taskId: task?.id } }).catch(() => undefined);
    await prisma.taskActor.deleteMany({ where: { taskId: task?.id } }).catch(() => undefined);
    if (task) await prisma.task.deleteMany({ where: { id: task.id } }).catch(() => undefined);
    await prisma.auditEvent.deleteMany({
      where: { actorId: { in: [rectorUser?.id, adminUser?.id, staffUser?.id, bghNoAssignUser?.id].filter(Boolean) } },
    }).catch(() => undefined);
    await prisma.positionAssignment.deleteMany({
      where: { userId: { in: [rectorUser?.id, adminUser?.id, staffUser?.id, bghNoAssignUser?.id].filter(Boolean) } },
    }).catch(() => undefined);
    await prisma.user.deleteMany({
      where: { id: { in: [rectorUser?.id, adminUser?.id, staffUser?.id, bghNoAssignUser?.id].filter(Boolean) } },
    }).catch(() => undefined);
    if (unit) await prisma.organizationalUnit.delete({ where: { id: unit.id } }).catch(() => undefined);
    if (dept) await prisma.department.deleteMany({ where: { id: dept.id } }).catch(() => undefined);
  });

  const getReq = (token?: string, query = '') =>
    new NextRequest(`http://localhost/api/executive/resolutions${query}`, {
      method: 'GET',
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

  const postReq = (token: string, body: unknown) =>
    new NextRequest('http://localhost/api/executive/resolutions', {
      method: 'POST',
      headers: bearer(token),
      body: JSON.stringify(body),
    });

  test('GET: technical ADMIN without executive assignment is denied (403)', async () => {
    const res = await getResolutions(getReq(adminToken));
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(!JSON.stringify(body).includes(task.title), 'must not leak executive payload');
  });

  test('GET: staff without mandate is denied (403)', async () => {
    const res = await getResolutions(getReq(staffToken));
    assert.equal(res.status, 403);
  });

  test('GET: BAN_GIAM_HIEU role WITHOUT assignment is denied (role string grants nothing)', async () => {
    const res = await getResolutions(getReq(bghNoAssignToken));
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.success, false);
  });

  test('GET: rector with active HIEU_TRUONG assignment is allowed (200)', async () => {
    const res = await getResolutions(getReq(rectorToken));
    assert.equal(res.status, 200);
  });

  test('POST: technical ADMIN cannot issue executive directive (403, nothing mutated)', async () => {
    const res = await createResolution(
      postReq(adminToken, { taskId: task.id, resolutionType: 'DIRECTIVE_NOTE', directiveNote: `Chi dao hanh chinh ${runId}` })
    );
    assert.equal(res.status, 403);
    const count = await prisma.executiveResolution.count({ where: { taskId: task.id } });
    assert.equal(count, 0);
  });

  test('POST: staff without mandate is denied (403)', async () => {
    const res = await createResolution(
      postReq(staffToken, { taskId: task.id, resolutionType: 'DIRECTIVE_NOTE', directiveNote: `Chi dao tu staff ${runId}` })
    );
    assert.equal(res.status, 403);
  });

  test('POST: rector issues DIRECTIVE_NOTE (accepted) and task is escalated', async () => {
    const res = await createResolution(
      postReq(rectorToken, { taskId: task.id, resolutionType: 'DIRECTIVE_NOTE', directiveNote: `Chi dao khac phuc ${runId}` })
    );
    // NOTE: the route historically answers 200 with legacyCompat payload on
    // create (no `status: 201`); the contract is intentionally left untouched.
    // What matters here is canonical authorization + persistence + effect.
    assert.equal(res.status, 200);
    const persisted = await prisma.executiveResolution.findFirst({ where: { taskId: task.id } });
    assert.ok(persisted, 'resolution must be persisted');
    assert.equal(persisted.actorId, rectorUser.id);
    const updated = await prisma.task.findUnique({ where: { id: task.id }, select: { priority: true } });
    assert.equal(updated?.priority, TaskPriorityEnum.URGENT);
  });
});
