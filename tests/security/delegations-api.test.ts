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
  DelegationStatus,
  AssignmentType,
  AssignmentStatus,
} from '@prisma/client';
import { signSessionToken, SESSION_COOKIE_NAME } from '@/lib/jwt-session';
import { GET as getDelegationsRoute, POST as createDelegationRoute } from '@/app/api/delegations/route';
import { POST as revokeDelegationRoute } from '@/app/api/delegations/[id]/revoke/route';
import { AuditAction } from '@/lib/db/audit';

describe('Task 2: Canonical Delegation API & Statutory Enforcement', () => {
  const runId = String(Date.now());

  let testUnit: any;
  let regularUser: any;
  let delegatorUser: any;
  let delegateeUser: any;
  let rectorUser: any;

  let regularToken: string;
  let delegatorToken: string;
  let delegateeToken: string;
  let rectorToken: string;

  let delegatorAssignment: any;
  let delegateeAssignment: any;
  let regularAssignment: any;

  let createdDelegationIds: string[] = [];

  const authHeaders = (token: string) => ({
    cookie: `${SESSION_COOKIE_NAME}=${token}`,
    'content-type': 'application/json',
  });

  before(async () => {
    testUnit = await prisma.organizationalUnit.create({
      data: {
        code: `U-DEL-${runId}`,
        name: `Đơn vị Thử nghiệm Ủy quyền ${runId}`,
        type: UnitType.DEPARTMENT,
      },
    });

    const posDefDelegator = await prisma.positionDefinition.create({
      data: {
        code: `POS-MGR-${runId}`,
        title: `Trưởng phòng Khảo thí ${runId}`,
        group: JobCatalogGroup.LDPU,
        isLeadership: true,
      },
    });

    const posDefDelegatee = await prisma.positionDefinition.create({
      data: {
        code: `POS-DEP-${runId}`,
        title: `Phó Trưởng phòng Khảo thí ${runId}`,
        group: JobCatalogGroup.LDPU,
        isLeadership: false,
      },
    });

    const posDefRegular = await prisma.positionDefinition.create({
      data: {
        code: `POS-STF-${runId}`,
        title: `Chuyên viên ${runId}`,
        group: JobCatalogGroup.VCDC,
        isLeadership: false,
      },
    });

    const posDefRector = await prisma.positionDefinition.create({
      data: {
        code: `POS-REC-${runId}`,
        title: `Hiệu trưởng ${runId}`,
        group: JobCatalogGroup.LDPU,
        isLeadership: true,
      },
    });

    regularUser = await prisma.user.create({
      data: {
        email: `regular.del.${runId}@qnc.edu.vn`,
        name: `Regular Staff ${runId}`,
        role: UserRole.CHUYEN_VIEN,
      },
    });

    delegatorUser = await prisma.user.create({
      data: {
        email: `delegator.del.${runId}@qnc.edu.vn`,
        name: `Manager Delegator ${runId}`,
        role: UserRole.TRUONG_PHONG,
      },
    });

    delegateeUser = await prisma.user.create({
      data: {
        email: `delegatee.del.${runId}@qnc.edu.vn`,
        name: `Deputy Delegatee ${runId}`,
        role: UserRole.CHUYEN_VIEN,
      },
    });

    rectorUser = await prisma.user.create({
      data: {
        email: `rector.del.${runId}@qnc.edu.vn`,
        name: `Rector Executive ${runId}`,
        role: UserRole.BAN_GIAM_HIEU,
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

    regularAssignment = await prisma.positionAssignment.create({
      data: {
        userId: regularUser.id,
        unitId: testUnit.id,
        positionDefinitionId: posDefRegular.id,
        status: AssignmentStatus.ACTIVE,
        type: AssignmentType.PRIMARY,
      },
    });

    await prisma.positionAssignment.create({
      data: {
        userId: rectorUser.id,
        unitId: testUnit.id,
        positionDefinitionId: posDefRector.id,
        status: AssignmentStatus.ACTIVE,
        type: AssignmentType.PRIMARY,
      },
    });

    regularToken = await signSessionToken({
      id: regularUser.id,
      email: regularUser.email,
      name: regularUser.name,
      role: regularUser.role,

    });

    delegatorToken = await signSessionToken({
      id: delegatorUser.id,
      email: delegatorUser.email,
      name: delegatorUser.name,
      role: delegatorUser.role,

    });

    delegateeToken = await signSessionToken({
      id: delegateeUser.id,
      email: delegateeUser.email,
      name: delegateeUser.name,
      role: delegateeUser.role,

    });

    rectorToken = await signSessionToken({
      id: rectorUser.id,
      email: rectorUser.email,
      name: rectorUser.name,
      role: rectorUser.role,

    });
  });

  after(async () => {
    if (createdDelegationIds.length > 0) {
      await prisma.delegationGrant.deleteMany({
        where: { id: { in: createdDelegationIds } },
      });
    }
    await prisma.auditEvent.deleteMany({
      where: {
        actorId: {
          in: [regularUser.id, delegatorUser.id, delegateeUser.id, rectorUser.id],
        },
      },
    });
    await prisma.positionAssignment.deleteMany({
      where: {
        userId: {
          in: [regularUser.id, delegatorUser.id, delegateeUser.id, rectorUser.id],
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [regularUser.id, delegatorUser.id, delegateeUser.id, rectorUser.id],
        },
      },
    });
    await prisma.positionDefinition.deleteMany({
      where: { code: { contains: runId } },
    });
    if (testUnit) {
      await prisma.organizationalUnit.delete({
        where: { id: testUnit.id },
      });
    }
  });

  test('1. Reject non-delegable capability (e.g. budget sign-off / disciplinary) with 403', async () => {
    const fromDate = new Date();
    const untilDate = new Date(Date.now() + 7 * 86400000);

    const req = new NextRequest('http://localhost/api/delegations', {
      method: 'POST',
      headers: authHeaders(delegatorToken),
      body: JSON.stringify({
        grantorAssignmentId: delegatorAssignment.id,
        granteeAssignmentId: delegateeAssignment.id,
        action: 'finance.treasury_disbursement',
        sourceDocumentNumber: '123/QD-CDKTCNQN',
        validFrom: fromDate.toISOString(),
        validUntil: untilDate.toISOString(),
      }),
    });

    const res = await createDelegationRoute(req);
    assert.equal(res.status, 403);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.code, 'NON_DELEGABLE_POWER');
  });

  test('2. Reject self-delegation (grantor === grantee) with 400', async () => {
    const fromDate = new Date();
    const untilDate = new Date(Date.now() + 7 * 86400000);

    const req = new NextRequest('http://localhost/api/delegations', {
      method: 'POST',
      headers: authHeaders(delegatorToken),
      body: JSON.stringify({
        grantorAssignmentId: delegatorAssignment.id,
        granteeAssignmentId: delegatorAssignment.id,
        action: 'task.approve',
        sourceDocumentNumber: '124/QD-CDKTCNQN',
        validFrom: fromDate.toISOString(),
        validUntil: untilDate.toISOString(),
      }),
    });

    const res = await createDelegationRoute(req);
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.code, 'SELF_DELEGATION_PROHIBITED');
  });

  test('3. Reject unauthorized caller (neither delegator nor executive admin) with 403', async () => {
    const fromDate = new Date();
    const untilDate = new Date(Date.now() + 7 * 86400000);

    // Regular user attempting to establish delegation between delegator and delegatee
    const req = new NextRequest('http://localhost/api/delegations', {
      method: 'POST',
      headers: authHeaders(regularToken),
      body: JSON.stringify({
        grantorAssignmentId: delegatorAssignment.id,
        granteeAssignmentId: delegateeAssignment.id,
        action: 'task.approve',
        sourceDocumentNumber: '125/QD-CDKTCNQN',
        validFrom: fromDate.toISOString(),
        validUntil: untilDate.toISOString(),
      }),
    });

    const res = await createDelegationRoute(req);
    assert.equal(res.status, 403);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.code, 'FORBIDDEN');
  });

  test('4. Successfully create delegation grant by delegator with transactional audit log', async () => {
    const fromDate = new Date();
    const untilDate = new Date(Date.now() + 7 * 86400000);

    const req = new NextRequest('http://localhost/api/delegations', {
      method: 'POST',
      headers: authHeaders(delegatorToken),
      body: JSON.stringify({
        grantorAssignmentId: delegatorAssignment.id,
        granteeAssignmentId: delegateeAssignment.id,
        action: 'task.approve',
        resourceScope: 'UNIT',
        sourceDocumentNumber: '126/QD-CDKTCNQN',
        reason: 'Ủy quyền phê duyệt nhiệm vụ trong thời gian đi công tác',
        validFrom: fromDate.toISOString(),
        validUntil: untilDate.toISOString(),
      }),
    });

    const res = await createDelegationRoute(req);
    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.action, 'task.approve');
    assert.equal(json.status, 'ACTIVE');
    assert.ok(json.id);

    createdDelegationIds.push(json.id);

    // Verify transactional audit log
    const auditLog = await prisma.auditEvent.findFirst({
      where: {
        entityId: json.id,
        action: AuditAction.DELEGATION_CREATED,
      },
    });
    assert.ok(auditLog, 'Audit log DELEGATION_CREATED must be recorded transactionally');
    assert.equal(auditLog.actorId, delegatorUser.id);
  });

  test('5. GET /api/delegations lists active delegations for user/unit', async () => {
    const req = new NextRequest('http://localhost/api/delegations', {
      method: 'GET',
      headers: authHeaders(delegateeToken),
    });

    const res = await getDelegationsRoute(req);
    assert.equal(res.status, 200);
    const list = await res.json();
    assert.ok(Array.isArray(list));
    const created = list.find((d: any) => createdDelegationIds.includes(d.id));
    assert.ok(created, 'Created delegation must be found in active delegations list');
    assert.equal(created.status, 'ACTIVE');
  });

  test('6. POST /api/delegations/[id]/revoke enforces authorization and updates status', async () => {
    const delegationId = createdDelegationIds[0];
    assert.ok(delegationId, 'Delegation ID must exist');

    // Attempt revoke by unauthorized regular staff -> 403 Forbidden
    const unauthReq = new NextRequest(`http://localhost/api/delegations/${delegationId}/revoke`, {
      method: 'POST',
      headers: authHeaders(regularToken),
      body: JSON.stringify({ reason: 'Malicious attempt to revoke' }),
    });

    const unauthRes = await revokeDelegationRoute(unauthReq, {
      params: Promise.resolve({ id: delegationId }),
    });
    assert.equal(unauthRes.status, 403);

    // Revoke by delegator -> 200 OK
    const authReq = new NextRequest(`http://localhost/api/delegations/${delegationId}/revoke`, {
      method: 'POST',
      headers: authHeaders(delegatorToken),
      body: JSON.stringify({ reason: 'Kết thúc chuyến công tác trước hạn' }),
    });

    const authRes = await revokeDelegationRoute(authReq, {
      params: Promise.resolve({ id: delegationId }),
    });
    assert.equal(authRes.status, 200);
    const updated = await authRes.json();
    assert.equal(updated.status, 'REVOKED');
    assert.ok(updated.revokedAt, 'revokedAt must be set');

    // Verify audit log DELEGATION_REVOKED
    const revokeAudit = await prisma.auditEvent.findFirst({
      where: {
        entityId: delegationId,
        action: AuditAction.DELEGATION_REVOKED,
      },
    });
    assert.ok(revokeAudit, 'Audit log DELEGATION_REVOKED must be recorded transactionally');
  });
});
