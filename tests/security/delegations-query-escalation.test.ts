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
import { GET as getDelegationsRoute } from '@/app/api/delegations/route';

/**
 * Issue #28 hotspot 1: `GET /api/delegations?userId=&unitId=` must not let a
 * non-executive caller widen their authorized scope via query params.
 * - non-executive + own userId => allowed
 * - non-executive + other userId (even same unit) => 403, no payload leak
 * - non-executive + own unitId => allowed (narrowing)
 * - non-executive + foreign unitId => 403
 * - executive + foreign userId/unitId => allowed per policy
 */
describe('Issue #28: delegation query filter escalation guard', () => {
  const runId = `delesc-${Date.now()}`;

  let unitA: any;
  let unitB: any;
  let alice: any;
  let bob: any;
  let carol: any;
  let dave: any;
  let rector: any;

  let aliceToken: string;
  let bobToken: string;
  let rectorToken: string;

  let delegationId: string;
  let ownUnitDelegationId: string;

  const authHeaders = (token: string) => ({
    cookie: `${SESSION_COOKIE_NAME}=${token}`,
  });

  const get = (token: string, query = '') =>
    new NextRequest(`http://localhost/api/delegations${query}`, {
      method: 'GET',
      headers: authHeaders(token),
    });

  before(async () => {
    unitA = await prisma.organizationalUnit.create({
      data: { code: `U-A-${runId}`, name: `Unit A ${runId}`, type: UnitType.DEPARTMENT },
    });
    unitB = await prisma.organizationalUnit.create({
      data: { code: `U-B-${runId}`, name: `Unit B ${runId}`, type: UnitType.DEPARTMENT },
    });

    const posDef = await prisma.positionDefinition.create({
      data: {
        code: `POS-DEL-${runId}`,
        title: `Chuyen vien ${runId}`,
        group: JobCatalogGroup.VCDC,
        isLeadership: false,
      },
    });

    alice = await prisma.user.create({
      data: { email: `alice.${runId}@qnc.edu.vn`, name: `Alice ${runId}`, role: UserRole.CHUYEN_VIEN },
    });
    bob = await prisma.user.create({
      data: { email: `bob.${runId}@qnc.edu.vn`, name: `Bob ${runId}`, role: UserRole.CHUYEN_VIEN },
    });
    carol = await prisma.user.create({
      data: { email: `carol.${runId}@qnc.edu.vn`, name: `Carol ${runId}`, role: UserRole.CHUYEN_VIEN },
    });
    dave = await prisma.user.create({
      data: { email: `dave.${runId}@qnc.edu.vn`, name: `Dave ${runId}`, role: UserRole.CHUYEN_VIEN },
    });
    rector = await prisma.user.create({
      data: { email: `rector.${runId}@qnc.edu.vn`, name: `Rector ${runId}`, role: UserRole.BAN_GIAM_HIEU },
    });

    const mkAssignment = (userId: string, unitId: string) =>
      prisma.positionAssignment.create({
        data: { userId, unitId, positionDefinitionId: posDef.id, status: AssignmentStatus.ACTIVE, type: AssignmentType.PRIMARY },
      });

    const aliceAssignment = await mkAssignment(alice.id, unitA.id);
    const carolAssignment = await mkAssignment(carol.id, unitA.id);
    const daveAssignment = await mkAssignment(dave.id, unitA.id);
    await mkAssignment(bob.id, unitB.id);

    aliceToken = signSessionToken({ id: alice.id, email: alice.email, name: alice.name, role: alice.role });
    bobToken = signSessionToken({ id: bob.id, email: bob.email, name: bob.name, role: bob.role });
    rectorToken = signSessionToken({ id: rector.id, email: rector.email, name: rector.name, role: rector.role });

    const delegation = await prisma.delegationGrant.create({
      data: {
        grantorAssignmentId: aliceAssignment.id,
        granteeAssignmentId: carolAssignment.id,
        action: 'task.approve',
        resourceScope: 'UNIT',
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 7 * 86400000),
        sourceDocumentNumber: `QD-${runId}`,
        status: DelegationStatus.ACTIVE,
      },
    });
    delegationId = delegation.id;

    // Own-unit delegation involving neither alice nor bob (carol -> dave,
    // both in unitA). Proves the default scope resolves real
    // OrganizationalUnit membership instead of the Department id-space.
    const ownUnitDelegation = await prisma.delegationGrant.create({
      data: {
        grantorAssignmentId: carolAssignment.id,
        granteeAssignmentId: daveAssignment.id,
        action: 'task.review',
        resourceScope: 'UNIT',
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 7 * 86400000),
        sourceDocumentNumber: `QD-${runId}-UNIT`,
        status: DelegationStatus.ACTIVE,
      },
    });
    ownUnitDelegationId = ownUnitDelegation.id;
  });

  after(async () => {
    await prisma.delegationGrant.deleteMany({ where: { id: { in: [delegationId, ownUnitDelegationId].filter(Boolean) } } }).catch(() => undefined);
    await prisma.auditEvent.deleteMany({
      where: { actorId: { in: [alice?.id, bob?.id, carol?.id, dave?.id, rector?.id].filter(Boolean) } },
    }).catch(() => undefined);
    await prisma.positionAssignment.deleteMany({
      where: { userId: { in: [alice?.id, bob?.id, carol?.id, dave?.id, rector?.id].filter(Boolean) } },
    }).catch(() => undefined);
    await prisma.user.deleteMany({
      where: { id: { in: [alice?.id, bob?.id, carol?.id, dave?.id, rector?.id].filter(Boolean) } },
    }).catch(() => undefined);
    await prisma.positionDefinition.deleteMany({ where: { code: { contains: runId } } }).catch(() => undefined);
    if (unitA) await prisma.organizationalUnit.delete({ where: { id: unitA.id } }).catch(() => undefined);
    if (unitB) await prisma.organizationalUnit.delete({ where: { id: unitB.id } }).catch(() => undefined);
  });

  test('non-executive + own userId => allowed per policy', async () => {
    const res = await getDelegationsRoute(get(aliceToken, `?userId=${alice.id}`));
    assert.equal(res.status, 200);
    const list = await res.json();
    assert.ok(Array.isArray(list));
    assert.ok(list.some((d: any) => d.id === delegationId));
  });

  test('non-executive + other userId (foreign unit) => 403 without payload leak', async () => {
    const res = await getDelegationsRoute(get(aliceToken, `?userId=${bob.id}`));
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(!JSON.stringify(body).includes(bob.email), 'must not leak other user PII');
  });

  test('non-executive + other userId (same unit) => 403', async () => {
    const res = await getDelegationsRoute(get(aliceToken, `?userId=${carol.id}`));
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.success, false);
  });

  test('non-executive + own unitId => allowed (narrowing)', async () => {
    const res = await getDelegationsRoute(get(aliceToken, `?unitId=${unitA.id}`));
    assert.equal(res.status, 200);
    const list = await res.json();
    assert.ok(Array.isArray(list));
  });

  test('non-executive + foreign unitId => 403 without payload leak', async () => {
    const res = await getDelegationsRoute(get(aliceToken, `?unitId=${unitB.id}`));
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.success, false);
  });

  test('non-executive without filters stays within self/unit scope', async () => {
    const res = await getDelegationsRoute(get(bobToken));
    assert.equal(res.status, 200);
    const list = await res.json();
    assert.ok(Array.isArray(list));
    assert.ok(!list.some((d: any) => d.id === delegationId), 'foreign delegation must not be listed');
  });

  test('default listing resolves own OrganizationalUnit scope (own-unit delegation visible)', async () => {
    const res = await getDelegationsRoute(get(aliceToken));
    assert.equal(res.status, 200);
    const list = await res.json();
    assert.ok(Array.isArray(list));
    assert.ok(
      list.some((d: any) => d.id === ownUnitDelegationId),
      'carol->dave delegation (unitA, alice is unitA member) must be visible to alice'
    );
  });

  test('default listing hides own-unit delegations of foreign units', async () => {
    const res = await getDelegationsRoute(get(bobToken));
    assert.equal(res.status, 200);
    const list = await res.json();
    assert.ok(Array.isArray(list));
    assert.ok(
      !list.some((d: any) => d.id === ownUnitDelegationId),
      'unitA delegation must be hidden from unitB member bob'
    );
  });

  test('executive + foreign userId => allowed per policy', async () => {
    const res = await getDelegationsRoute(get(rectorToken, `?userId=${bob.id}`));
    assert.equal(res.status, 200);
    const list = await res.json();
    assert.ok(Array.isArray(list));
  });

  test('executive + foreign unitId => allowed per policy', async () => {
    const res = await getDelegationsRoute(get(rectorToken, `?unitId=${unitB.id}`));
    assert.equal(res.status, 200);
    const list = await res.json();
    assert.ok(Array.isArray(list));
  });
});
