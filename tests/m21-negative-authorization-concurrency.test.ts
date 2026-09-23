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
  AssignmentType,
  AssignmentStatus,
  OrganizationalBodyType,
  BodyMemberRole,
  TaskPriority,
  TaskScope,
  TaskStatus,
} from '@prisma/client';
import { signSessionToken, SESSION_COOKIE_NAME } from '@/lib/jwt-session';
import { POST as createBodyRoute } from '@/app/api/organization/bodies/route';
import { POST as addBodyMemberRoute } from '@/app/api/organization/bodies/[id]/route';
import { POST as createDelegationRoute } from '@/app/api/delegations/route';
import { PATCH as patchTaskRoute } from '@/app/api/tasks/[id]/route';
import { updateTaskWithOCC, ConcurrencyConflictError } from '@/lib/db/occ';

describe('Milestone 21: Negative Authorization & Concurrency Invariants', () => {
  const runId = String(Date.now());

  let testUnit: any;
  let testDept: any;
  let regularUser: any;
  let rectorUser: any;
  let viceRectorUser: any;
  let delegatorUser: any;
  let delegateeUser: any;

  let regularToken: string;
  let rectorToken: string;
  let viceRectorToken: string;
  let delegatorToken: string;

  let delegatorAssignment: any;
  let delegateeAssignment: any;

  let createdBodyIds: string[] = [];
  let createdDelegationIds: string[] = [];
  let createdTaskIds: string[] = [];

  const authHeaders = (token: string) => ({
    cookie: `${SESSION_COOKIE_NAME}=${token}`,
    'content-type': 'application/json',
    origin: 'http://localhost:3000',
    referer: 'http://localhost:3000',
  });

  before(async () => {
    testDept = await prisma.organizationalUnit.create({
      data: {
        id: `dept_m21_${runId}`,
        name: `Phòng Ban Thử Nghiệm M21 ${runId}`,
      },
    });

    testUnit = await prisma.organizationalUnit.create({
      data: {
        code: `OU_M21_${runId}`,
        name: `Đơn vị Thử nghiệm M21 ${runId}`,
        type: UnitType.DEPARTMENT,
      },
    });

    let rectorDef = await prisma.positionDefinition.findUnique({
      where: { code: 'HIEU_TRUONG' },
    });
    if (!rectorDef) {
      rectorDef = await prisma.positionDefinition.create({
        data: {
          code: 'HIEU_TRUONG',
          title: 'Hiệu trưởng',
          group: JobCatalogGroup.LDPU,
          isLeadership: true,
        },
      });
    }

    let viceRectorDef = await prisma.positionDefinition.findUnique({
      where: { code: 'PHO_HIEU_TRUONG' },
    });
    if (!viceRectorDef) {
      viceRectorDef = await prisma.positionDefinition.create({
        data: {
          code: 'PHO_HIEU_TRUONG',
          title: 'Phó Hiệu trưởng',
          group: JobCatalogGroup.LDPU,
          isLeadership: true,
        },
      });
    }

    const posDefDelegator = await prisma.positionDefinition.create({
      data: {
        code: `POS_MGR_M21_${runId}`,
        title: `Trưởng phòng Khảo thí ${runId}`,
        group: JobCatalogGroup.LDPU,
        isLeadership: true,
      },
    });

    const posDefDelegatee = await prisma.positionDefinition.create({
      data: {
        code: `POS_DEP_M21_${runId}`,
        title: `Phó Trưởng phòng Khảo thí ${runId}`,
        group: JobCatalogGroup.LDPU,
        isLeadership: true,
      },
    });

    regularUser = await prisma.user.create({
      data: {
        email: `regular_m21_${runId}@qcet.edu.vn`,
        name: 'Chuyên viên nghiệp vụ',
        role: UserRole.CHUYEN_VIEN,
        isActive: true,
      },
    });

    rectorUser = await prisma.user.create({
      data: {
        email: `rector_m21_${runId}@qcet.edu.vn`,
        name: 'Hiệu trưởng Nhà trường',
        role: UserRole.BAN_GIAM_HIEU,
        isActive: true,
      },
    });

    viceRectorUser = await prisma.user.create({
      data: {
        email: `vicerector_m21_${runId}@qcet.edu.vn`,
        name: 'Phó Hiệu trưởng Nhà trường',
        role: UserRole.BAN_GIAM_HIEU,
        isActive: true,
      },
    });

    delegatorUser = await prisma.user.create({
      data: {
        email: `delegator_m21_${runId}@qcet.edu.vn`,
        name: 'Trưởng phòng Khảo thí',
        role: UserRole.TRUONG_PHONG,

        isActive: true,
      },
    });

    delegateeUser = await prisma.user.create({
      data: {
        email: `delegatee_m21_${runId}@qcet.edu.vn`,
        name: 'Phó Trưởng phòng Khảo thí',
        role: UserRole.CHUYEN_VIEN,

        isActive: true,
      },
    });

    await prisma.positionAssignment.create({
      data: {
        userId: rectorUser.id,
        positionDefinitionId: rectorDef.id,
        unitId: testUnit.id,
        status: AssignmentStatus.ACTIVE,
        type: AssignmentType.PRIMARY,
      },
    });

    await prisma.positionAssignment.create({
      data: {
        userId: viceRectorUser.id,
        positionDefinitionId: viceRectorDef.id,
        unitId: testUnit.id,
        status: AssignmentStatus.ACTIVE,
        type: AssignmentType.PRIMARY,
      },
    });

    delegatorAssignment = await prisma.positionAssignment.create({
      data: {
        userId: delegatorUser.id,
        unitId: testUnit.id,
        positionDefinitionId: posDefDelegator.id,
        status: AssignmentStatus.ACTIVE,
        type: AssignmentType.PRIMARY,
      },
    });

    delegateeAssignment = await prisma.positionAssignment.create({
      data: {
        userId: delegateeUser.id,
        unitId: testUnit.id,
        positionDefinitionId: posDefDelegatee.id,
        status: AssignmentStatus.ACTIVE,
        type: AssignmentType.PRIMARY,
      },
    });

    regularToken = signSessionToken({
      id: regularUser.id,
      email: regularUser.email,
      name: regularUser.name,
      role: regularUser.role,
    });

    rectorToken = signSessionToken({
      id: rectorUser.id,
      email: rectorUser.email,
      name: rectorUser.name,
      role: rectorUser.role,
    });

    viceRectorToken = signSessionToken({
      id: viceRectorUser.id,
      email: viceRectorUser.email,
      name: viceRectorUser.name,
      role: viceRectorUser.role,
    });

    delegatorToken = signSessionToken({
      id: delegatorUser.id,
      email: delegatorUser.email,
      name: delegatorUser.name,
      role: delegatorUser.role,

    });
  });

  after(async () => {
    if (createdTaskIds.length > 0) {
      await prisma.auditEvent.deleteMany({
        where: { entityId: { in: createdTaskIds } },
      });
      await prisma.task.deleteMany({
        where: { id: { in: createdTaskIds } },
      });
    }

    if (createdDelegationIds.length > 0) {
      await prisma.delegationGrant.deleteMany({
        where: { id: { in: createdDelegationIds } },
      });
    }

    if (createdBodyIds.length > 0) {
      await prisma.bodyMembership.deleteMany({
        where: { bodyId: { in: createdBodyIds } },
      });
      await prisma.auditEvent.deleteMany({
        where: { entityId: { in: createdBodyIds } },
      });
      await prisma.organizationalBody.deleteMany({
        where: { id: { in: createdBodyIds } },
      });
    }

    const userIds = [
      regularUser?.id,
      rectorUser?.id,
      viceRectorUser?.id,
      delegatorUser?.id,
      delegateeUser?.id,
    ].filter(Boolean);

    await prisma.positionAssignment.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: userIds } },
    });
    if (testUnit) {
      await prisma.organizationalUnit.delete({ where: { id: testUnit.id } });
    }
    if (testDept) {
      await prisma.organizationalUnit.delete({ where: { id: testDept.id } });
    }
  });

  describe('1. Negative Authorization: Council Creation (POST /api/organization/bodies)', () => {
    test('Unauthorized council creation by regular user (CHUYEN_VIEN) returns 403 Forbidden', async () => {
      const req = new NextRequest('http://localhost:3000/api/organization/bodies', {
        method: 'POST',
        headers: authHeaders(regularToken),
        body: JSON.stringify({
          code: `HD_UNAUTH_${runId}`,
          name: 'Hội đồng Khoa học Trái phép',
          type: OrganizationalBodyType.COUNCIL,
        }),
      });

      const res = await createBodyRoute(req);
      assert.strictEqual(res.status, 403, 'Unauthorized creation must return HTTP 403');
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.code, 'FORBIDDEN');
    });

    test('Authorized council creation by Rector returns 201 Created', async () => {
      const req = new NextRequest('http://localhost:3000/api/organization/bodies', {
        method: 'POST',
        headers: authHeaders(rectorToken),
        body: JSON.stringify({
          code: `HD_AUTH_${runId}`,
          name: 'Hội đồng Khoa học và Đào tạo Hợp lệ',
          type: OrganizationalBodyType.COUNCIL,
        }),
      });

      const res = await createBodyRoute(req);
      assert.strictEqual(res.status, 201, 'Rector creation must return HTTP 201');
      const json = await res.json();
      const bodyId = json.id || json.data?.id;
      assert.ok(bodyId);
      createdBodyIds.push(bodyId);
    });
  });

  describe('2. Negative Authorization: Self-Appointment as CHAIR', () => {
    test('Unauthorized self-appointment as CHAIR via POST /api/organization/bodies/:id returns 403 Forbidden', async () => {
      const bodyId = createdBodyIds[0];
      assert.ok(bodyId, 'Requires an existing council');

      // Regular staff attempting to add self as CHAIR
      const reqRegular = new NextRequest(`http://localhost:3000/api/organization/bodies/${bodyId}`, {
        method: 'POST',
        headers: authHeaders(regularToken),
        body: JSON.stringify({
          userId: regularUser.id,
          role: BodyMemberRole.CHAIR,
        }),
      });

      const resRegular = await addBodyMemberRoute(reqRegular, { params: Promise.resolve({ id: bodyId }) });
      assert.strictEqual(resRegular.status, 403, 'Regular staff self-appointing as CHAIR must return HTTP 403');
      const jsonRegular = await resRegular.json();
      assert.strictEqual(jsonRegular.success, false);
      assert.strictEqual(jsonRegular.code, 'FORBIDDEN');

      // Vice Rector attempting to self-appoint as CHAIR (only Rector may hold/appoint statutory council chair)
      const reqViceRector = new NextRequest(`http://localhost:3000/api/organization/bodies/${bodyId}`, {
        method: 'POST',
        headers: authHeaders(viceRectorToken),
        body: JSON.stringify({
          userId: viceRectorUser.id,
          role: BodyMemberRole.CHAIR,
        }),
      });

      const resViceRector = await addBodyMemberRoute(reqViceRector, { params: Promise.resolve({ id: bodyId }) });
      assert.strictEqual(resViceRector.status, 403, 'Non-Rector self-appointing as CHAIR must return HTTP 403');
      const jsonViceRector = await resViceRector.json();
      assert.strictEqual(jsonViceRector.success, false);
      assert.strictEqual(jsonViceRector.code, 'FORBIDDEN');
    });
  });

  describe('3. Negative Authorization: Delegation of Non-Delegable Capabilities', () => {
    test('Delegation of budget approval / treasury disbursement returns 403 NON_DELEGABLE_POWER', async () => {
      const fromDate = new Date();
      const untilDate = new Date(Date.now() + 7 * 86400000);

      const req = new NextRequest('http://localhost:3000/api/delegations', {
        method: 'POST',
        headers: authHeaders(delegatorToken),
        body: JSON.stringify({
          grantorAssignmentId: delegatorAssignment.id,
          granteeAssignmentId: delegateeAssignment.id,
          action: 'finance.treasury_disbursement',
          sourceDocumentNumber: `123/QD-CDKTCNQN-${runId}`,
          validFrom: fromDate.toISOString(),
          validUntil: untilDate.toISOString(),
        }),
      });

      const res = await createDelegationRoute(req);
      assert.strictEqual(res.status, 403, 'Delegating budget capability must return HTTP 403');
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.code, 'NON_DELEGABLE_POWER');
    });

    test('Delegation of disciplinary action returns 403 NON_DELEGABLE_POWER', async () => {
      const fromDate = new Date();
      const untilDate = new Date(Date.now() + 7 * 86400000);

      const req = new NextRequest('http://localhost:3000/api/delegations', {
        method: 'POST',
        headers: authHeaders(delegatorToken),
        body: JSON.stringify({
          grantorAssignmentId: delegatorAssignment.id,
          granteeAssignmentId: delegateeAssignment.id,
          action: 'statutory.disciplinary_action',
          sourceDocumentNumber: `124/QD-CDKTCNQN-${runId}`,
          validFrom: fromDate.toISOString(),
          validUntil: untilDate.toISOString(),
        }),
      });

      const res = await createDelegationRoute(req);
      assert.strictEqual(res.status, 403, 'Delegating disciplinary action must return HTTP 403');
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.code, 'NON_DELEGABLE_POWER');
    });

    test('Delegation of executive budget approval returns 403 NON_DELEGABLE_POWER', async () => {
      const fromDate = new Date();
      const untilDate = new Date(Date.now() + 7 * 86400000);

      const req = new NextRequest('http://localhost:3000/api/delegations', {
        method: 'POST',
        headers: authHeaders(delegatorToken),
        body: JSON.stringify({
          grantorAssignmentId: delegatorAssignment.id,
          granteeAssignmentId: delegateeAssignment.id,
          action: 'executive.approve_budget',
          sourceDocumentNumber: `125/QD-CDKTCNQN-${runId}`,
          validFrom: fromDate.toISOString(),
          validUntil: untilDate.toISOString(),
        }),
      });

      const res = await createDelegationRoute(req);
      assert.strictEqual(res.status, 403, 'Delegating executive budget approval must return HTTP 403');
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.code, 'NON_DELEGABLE_POWER');
    });
  });

  describe('4. Concurrency Invariants: Stale Version Conflict & ConcurrencyConflictError', () => {
    let taskRecord: any;

    before(async () => {
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      taskRecord = await prisma.task.create({
        data: {
          code: `TASK-M21-${runId}`,
          title: `Nhiệm vụ kiểm thử OCC M21 ${runId}`,
          description: 'Kiểm tra xung đột đồng thời với expectedVersion',
          priority: TaskPriority.NORMAL,
          scope: TaskScope.DEPARTMENT,

          createdById: delegatorUser.id,
          dueDate,
          academicMonth: 9,
          academicYear: '2026-2027',
          status: TaskStatus.IN_PROGRESS,
          version: 1,
        },
      });
      createdTaskIds.push(taskRecord.id);
    });

    test('Direct OCC updateTaskWithOCC throws ConcurrencyConflictError (HTTP 409) on stale expectedVersion', async () => {
      const staleVersion = 999;

      await assert.rejects(
        async () => {
          await updateTaskWithOCC(prisma, taskRecord.id, staleVersion, {
            title: 'Tiêu đề cập nhật không hợp lệ',
          });
        },
        (err: any) => {
          assert.ok(err instanceof ConcurrencyConflictError, 'Must throw ConcurrencyConflictError');
          assert.strictEqual(err.status, 409, 'ConcurrencyConflictError must have status 409');
          assert.strictEqual(err.code, 'CONCURRENCY_CONFLICT');
          assert.strictEqual(err.entity, 'Task');
          assert.strictEqual(err.entityId, taskRecord.id);
          assert.strictEqual(err.expectedVersion, staleVersion);
          assert.strictEqual(err.actualVersion, 1);
          return true;
        }
      );
    });

    test('HTTP Route PATCH /api/tasks/:id returns 409 on version mismatch with stale expectedVersion', async () => {
      const req = new NextRequest(`http://localhost:3000/api/tasks/${taskRecord.id}`, {
        method: 'PATCH',
        headers: authHeaders(delegatorToken),
        body: JSON.stringify({
          title: 'Cập nhật xung đột',
          expectedVersion: 999,
        }),
      });

      const res = await patchTaskRoute(req, { params: Promise.resolve({ id: taskRecord.id }) });
      assert.strictEqual(res.status, 409, 'Stale expectedVersion update must return HTTP 409');
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.code, 'CONFLICT');
      assert.match(json.error, /xung đột phiên bản/i);
    });
  });
});
