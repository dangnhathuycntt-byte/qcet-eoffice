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

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  UserRole,
  AssignmentType,
  AssignmentStatus,
  DelegationStatus,
  JobCatalogGroup,
  UnitType,
  UnitStatus,
  ResponsibilityCategory,
} from '@prisma/client';
import { signSessionToken, getJwtSecret, SESSION_COOKIE_NAME } from '@/lib/jwt-session';
import {
  revokeSession,
  clearRevocationStoreForTesting,
} from '@/server/auth/session-policy';
import { GET as getMeContext } from '@/app/api/me/context/route';

describe('Sprint 2: Task 9 - AuthorizationContext API (GET /api/me/context)', () => {
  const testRunId = String(Date.now());
  const deptId = `DEPT-ME-${testRunId}`;
  const unitId = `UNIT-ME-${testRunId}`;
  const posDefLeaderId = `POSDEF-LEAD-${testRunId}`;
  const posDefStaffId = `POSDEF-STAFF-${testRunId}`;
  const respAreaId = `RESP-ME-${testRunId}`;

  let institutionalUser: any;
  let disabledUser: any;
  let adminUser: any;
  let granterUser: any;

  let posAssignmentLeader: any;
  let posAssignmentStaff: any;
  let delegationGrant: any;

  function signToken(payload: Record<string, any>): string {
    return jwt.sign(payload, getJwtSecret(), { expiresIn: '30d' });
  }

  function createRequest(
    url: string,
    options: {
      method?: string;
      token?: string;
      headers?: Record<string, string>;
    } = {}
  ) {
    const headers = new Headers(options.headers);
    headers.set('Origin', 'http://localhost:3000');
    headers.set('Referer', 'http://localhost:3000');
    if (options.token) {
      headers.set('Cookie', `${SESSION_COOKIE_NAME}=${options.token}`);
    }
    return new NextRequest(url, {
      method: options.method || 'GET',
      headers,
    });
  }

  before(async () => {
    // Verify DB isolation
    const dbUrl = process.env.DATABASE_URL || '';
    let dbName = '';
    try {
      dbName = new URL(dbUrl).pathname.replace(/^\//, '');
    } catch {}

    const isExplicitTestOptIn = process.env.QCET_ALLOW_DB_TESTS === '1';
    const isTestEnv = process.env.NODE_ENV === 'test';
    const isLocalHost = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
    const isTestDbName = dbName.endsWith('_test') || dbName.endsWith('test');

    if (!isExplicitTestOptIn || !isTestEnv || !isLocalHost || !isTestDbName) {
      throw new Error(
        `SECURITY INVARIANT VIOLATION: Requires test DB ending in '_test'. Current: dbName=${dbName}`
      );
    }

    // 1. Department & Unit
    await prisma.organizationalUnit.create({
      data: {
        id: deptId,
        name: `MeContext Dept ${testRunId}`,

      },
    });

    await prisma.organizationalUnit.create({
      data: {
        id: unitId,
        code: `UNIT_ME_${testRunId}`,
        name: `Khoa MeContext ${testRunId}`,
        type: UnitType.FACULTY,
        status: UnitStatus.ACTIVE,
      },
    });

    // 2. Position Definitions
    await prisma.positionDefinition.create({
      data: {
        id: posDefLeaderId,
        code: `HEAD_ME_${testRunId}`,
        title: `Trưởng khoa MeContext ${testRunId}`,
        group: JobCatalogGroup.LDPU,
        isLeadership: true,
        minLevel: 1,
      },
    });

    await prisma.positionDefinition.create({
      data: {
        id: posDefStaffId,
        code: `STAFF_ME_${testRunId}`,
        title: `Chuyên viên MeContext ${testRunId}`,
        group: JobCatalogGroup.VCMN,
        isLeadership: false,
        minLevel: 3,
      },
    });

    // 3. Responsibility Area
    await prisma.responsibilityArea.create({
      data: {
        id: respAreaId,
        code: `RA_ME_${testRunId}`,
        name: `Quản lý Đào tạo MeContext ${testRunId}`,
        category: ResponsibilityCategory.ACADEMIC,
      },
    });

    // 4. Test Users
    institutionalUser = await prisma.user.create({
      data: {
        email: `staff.${testRunId}@qncet.edu.vn`,
        name: 'Trần Cán Bộ Institutional',
        role: UserRole.CHUYEN_VIEN,
        title: 'Chuyên viên QLĐT',
        phone: '0901234567',

        isActive: true,
      },
    });

    granterUser = await prisma.user.create({
      data: {
        email: `leader.${testRunId}@qncet.edu.vn`,
        name: 'Nguyễn Trưởng Khoa Grantor',
        role: UserRole.CHUYEN_VIEN,
        title: 'Trưởng Khoa',

        isActive: true,
      },
    });

    disabledUser = await prisma.user.create({
      data: {
        email: `disabled.${testRunId}@qncet.edu.vn`,
        name: 'Lê Vô Hiệu Hóa',
        role: UserRole.CHUYEN_VIEN,

        isActive: false,
      },
    });

    adminUser = await prisma.user.create({
      data: {
        email: `sysadmin.${testRunId}@qncet.edu.vn`,
        name: 'Quản Trị Viên Kỹ Thuật',
        role: UserRole.ADMIN,
        isActive: true,
      },
    });

    // 5. Position Assignments
    posAssignmentLeader = await prisma.positionAssignment.create({
      data: {
        userId: granterUser.id,
        positionDefinitionId: posDefLeaderId,
        unitId: unitId,
        type: AssignmentType.PRIMARY,
        status: AssignmentStatus.ACTIVE,
        effectiveFrom: new Date('2025-01-01'),
      },
    });

    posAssignmentStaff = await prisma.positionAssignment.create({
      data: {
        userId: institutionalUser.id,
        positionDefinitionId: posDefStaffId,
        unitId: unitId,
        type: AssignmentType.PRIMARY,
        status: AssignmentStatus.ACTIVE,
        effectiveFrom: new Date('2025-01-01'),
      },
    });

    // 6. Portfolio Assignment (Linked to staff assignment)
    await prisma.portfolioAssignment.create({
      data: {
        positionAssignmentId: posAssignmentStaff.id,
        responsibilityAreaId: respAreaId,
        effectiveFrom: new Date('2025-01-01'),
      },
    });

    // 7. Active DelegationGrant from Leader to Staff
    delegationGrant = await prisma.delegationGrant.create({
      data: {
        grantorAssignmentId: posAssignmentLeader.id,
        granteeAssignmentId: posAssignmentStaff.id,
        responsibilityAreaId: respAreaId,
        action: 'academic.program.review',
        resourceScope: `unit:${unitId}`,
        validFrom: new Date('2025-01-01'),
        validUntil: new Date('2027-12-31'),
        sourceDocumentNumber: `QĐ-${testRunId}/QCET`,
        status: DelegationStatus.ACTIVE,
      },
    });
  });

  beforeEach(() => {
    clearRevocationStoreForTesting();
  });

  after(async () => {
    try {
      if (delegationGrant) {
        await prisma.delegationScopeRule.deleteMany({ where: { delegationGrantId: delegationGrant.id } });
        await prisma.delegationGrant.deleteMany({ where: { id: delegationGrant.id } });
      }
      if (posAssignmentStaff) {
        await prisma.portfolioAssignment.deleteMany({ where: { positionAssignmentId: posAssignmentStaff.id } });
      }
      await prisma.positionAssignment.deleteMany({
        where: { id: { in: [posAssignmentLeader?.id, posAssignmentStaff?.id].filter(Boolean) } },
      });
      await prisma.positionDefinition.deleteMany({
        where: { id: { in: [posDefLeaderId, posDefStaffId] } },
      });
      await prisma.responsibilityArea.deleteMany({ where: { id: respAreaId } });
      await prisma.organizationalUnit.deleteMany({ where: { id: unitId } });
      await prisma.session.deleteMany({
        where: { userId: { in: [institutionalUser?.id, granterUser?.id, disabledUser?.id, adminUser?.id].filter(Boolean) } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [institutionalUser?.id, granterUser?.id, disabledUser?.id, adminUser?.id].filter(Boolean) } },
      });
      await prisma.organizationalUnit.deleteMany({ where: { id: deptId } });
    } catch (e) {
      console.error('Cleanup error:', e);
    }
  });

  test('1. GET /api/me/context with valid active session returns expected DTO mapped from canonical AuthorizationContext', async () => {
    const token = signToken({
      id: institutionalUser.id,
      email: institutionalUser.email,
      name: institutionalUser.name,
      role: institutionalUser.role,
      sessionId: `sess-inst-${testRunId}`,
    });

    const req = createRequest('http://localhost:3000/api/me/context', { token });
    const res = await getMeContext(req);

    assert.equal(res.status, 200);
    const body = await res.json();
    const data = body;

    // Check identity
    assert.equal(data.identity.id, institutionalUser.id);
    assert.equal(data.identity.email, institutionalUser.email);
    assert.equal(data.identity.name, institutionalUser.name);
    assert.equal(data.identity.title, 'Chuyên viên QLĐT');
    assert.equal(data.identity.phone, '0901234567');

    // Check active assignments
    assert.equal(Array.isArray(data.activeAssignments), true);
    assert.equal(data.activeAssignments.length, 1);
    assert.equal(data.activeAssignments[0].position.title, `Chuyên viên MeContext ${testRunId}`);
    assert.equal(data.activeAssignments[0].unit.name, `Khoa MeContext ${testRunId}`);
    assert.equal(data.activeAssignments[0].position.category, JobCatalogGroup.VCMN);

    // Check responsibility areas (from portfolio)
    assert.equal(Array.isArray(data.responsibilityAreas), true);
    assert.equal(data.responsibilityAreas.length, 1);
    assert.equal(data.responsibilityAreas[0].code, `RA_ME_${testRunId}`);

    // Check delegations (received delegation from Leader)
    assert.equal(Array.isArray(data.delegations), true);
    assert.equal(data.delegations.length, 1);
    assert.equal(data.delegations[0].direction, 'DELEGATED_TO_ME');
    assert.equal(data.delegations[0].counterpartName, granterUser.name);
    assert.ok(data.delegations[0].capabilities.includes('academic.program.review'));

    // Check viewScopes (PERSONAL + UNIT)
    assert.ok(data.viewScopes.includes('PERSONAL'));
    assert.ok(data.viewScopes.includes('UNIT'));
    assert.equal(data.viewScopes.includes('SCHOOL'), false); // staff is not school-level

    // Check technical capabilities (non-admin)
    assert.ok(data.technicalCapabilities.includes('task.read'));
    assert.ok(data.technicalCapabilities.includes('document.read'));
    assert.equal(data.technicalCapabilities.includes('SYSTEM_ADMIN'), false);
  });

  test('2. Disabled account returns 401 ACCOUNT_DISABLED', async () => {
    const token = signToken({
      id: disabledUser.id,
      email: disabledUser.email,
      name: disabledUser.name,
      role: disabledUser.role,
      sessionId: `sess-disabled-${testRunId}`,
    });

    const req = createRequest('http://localhost:3000/api/me/context', { token });
    const res = await getMeContext(req);

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.code, 'ACCOUNT_DISABLED');
  });

  test('3. Revoked session returns 401 SESSION_INVALID', async () => {
    const sessionId = `sess-revoked-${testRunId}`;
    const token = signToken({
      id: institutionalUser.id,
      email: institutionalUser.email,
      name: institutionalUser.name,
      role: institutionalUser.role,
      sessionId,
    });

    // Revoke the session
    await revokeSession(sessionId, { revokeReason: 'Session explicitly revoked for security test' });

    const req = createRequest('http://localhost:3000/api/me/context', { token });
    const res = await getMeContext(req);

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.code, 'SESSION_INVALID');
  });

  test('4. Expired session returns 401 SESSION_INVALID', async () => {
    // Generate expired token (expired 1 hour ago)
    const expiredToken = jwt.sign(
      {
        id: institutionalUser.id,
        email: institutionalUser.email,
        name: institutionalUser.name,
        role: institutionalUser.role,
        sessionId: `sess-expired-${testRunId}`,
        exp: Math.floor(Date.now() / 1000) - 3600,
        iat: Math.floor(Date.now() / 1000) - 7200,
      },
      getJwtSecret()
    );

    const req = createRequest('http://localhost:3000/api/me/context', { token: expiredToken });
    const res = await getMeContext(req);

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.code, 'SESSION_INVALID');
  });

  test('5. Unauthenticated request returns 401 AUTH_REQUIRED', async () => {
    const req = createRequest('http://localhost:3000/api/me/context');
    const res = await getMeContext(req);

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.code, 'AUTH_REQUIRED');
  });

  test('6. SYSTEM_ADMIN gets technical capabilities but NOT institutional authority', async () => {
    const token = signToken({
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: adminUser.role,
      sessionId: `sess-admin-${testRunId}`,
    });

    const req = createRequest('http://localhost:3000/api/me/context', { token });
    const res = await getMeContext(req);

    assert.equal(res.status, 200);
    const body = await res.json();
    const data = body;

    // Technical capabilities present
    assert.ok(data.technicalCapabilities.includes('SYSTEM_ADMIN'));
    assert.ok(data.technicalCapabilities.includes('system.configure'));
    assert.ok(data.technicalCapabilities.includes('account.manage'));
    assert.ok(data.technicalCapabilities.includes('audit.read'));
    assert.ok(data.technicalCapabilities.includes('integration.manage'));

    // NO institutional authority
    assert.equal(data.activeAssignments.length, 0);
    assert.equal(data.responsibilityAreas.length, 0);
    assert.equal(data.delegations.length, 0);
    assert.equal(data.highestPositionLevel, 'CHUYEN_VIEN');
  });
});
