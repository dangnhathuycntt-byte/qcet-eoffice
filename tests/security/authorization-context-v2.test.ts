import { test, describe, before, after } from 'node:test';
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
  UserRole,
  AssignmentType,
  AssignmentStatus,
  DelegationStatus,
  BodyStatus,
  BodyMemberRole,
  OrganizationalBodyType,
  ResponsibilityCategory,
  UnitType,
  UnitStatus,
  JobCatalogGroup,
} from '@prisma/client';
import { loadAuthorizationContext } from '@/server/authorization/authorization-context-service';
import { SystemRole } from '@/server/authorization/authorization-context';
import {
  AccountDisabledAuthError,
  AccountNotFoundError,
} from '@/server/authorization/errors';

describe('Sprint 2: Task 2 - AuthorizationContext V2 & Authority Resolution', () => {
  const testRunId = String(Date.now());
  const now = new Date('2026-09-10T10:00:00.000Z');

  // Entities created during test
  const deptId = `DEPT-AUTH2-${testRunId}`;
  const unitId = `UNIT-AUTH2-${testRunId}`;
  const unitSecondaryId = `UNIT2-AUTH2-${testRunId}`;

  // Position Definitions
  const posDefRectorId = `POSDEF-REC-${testRunId}`;
  const posDefViceRectorId = `POSDEF-VREC-${testRunId}`;
  const posDefHeadId = `POSDEF-HEAD-${testRunId}`;
  const posDefStaffId = `POSDEF-STAFF-${testRunId}`;

  // Responsibility Areas
  const respAreaTrainingId = `RESP-TRAIN-${testRunId}`;
  const respAreaFinanceId = `RESP-FIN-${testRunId}`;

  // Organizational Body
  const bodyCouncilId = `BODY-COUNCIL-${testRunId}`;
  const bodyDissolvedId = `BODY-DISSOLVED-${testRunId}`;

  // Users
  let adminUser: { id: string; email: string };
  let rectorUser: { id: string; email: string };
  let viceRectorUser: { id: string; email: string };
  let staffUser: { id: string; email: string };
  let disabledUser: { id: string; email: string };

  // Position Assignments
  let activePrimaryPosId: string;
  let activeConcurrentPosId: string;
  let expiredPosId: string;
  let futurePosId: string;
  let terminatedPosId: string;
  let rectorPosId: string;

  before(async () => {
    // 0. Test isolation check
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
        `SECURITY INVARIANT VIOLATION: Test requires isolated test database ending in '_test'. Aborting.`
      );
    }

    // 1. Department & Units
    await prisma.organizationalUnit.create({
      data: {
        id: deptId,
        name: `Phòng Ban Thử Nghiệm ${testRunId}`,
        shortName: `PBT-${testRunId}`,
      },
    });

    await prisma.organizationalUnit.createMany({
      data: [
        {
          id: unitId,
          code: `UNIT_MAIN_${testRunId}`,
          name: `Đơn vị chính ${testRunId}`,
          type: UnitType.DEPARTMENT,
          status: UnitStatus.ACTIVE,
          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          id: unitSecondaryId,
          code: `UNIT_SEC_${testRunId}`,
          name: `Đơn vị phụ ${testRunId}`,
          type: UnitType.SECTION,
          status: UnitStatus.ACTIVE,
          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });

    // 2. Position Definitions
    await prisma.positionDefinition.createMany({
      data: [
        {
          id: posDefRectorId,
          code: `HIEU_TRUONG_${testRunId}`,
          title: 'Hiệu trưởng',
          group: JobCatalogGroup.LDPU,
          minLevel: 1,
          isLeadership: true,
        },
        {
          id: posDefViceRectorId,
          code: `PHO_HIEU_TRUONG_${testRunId}`,
          title: 'Phó Hiệu trưởng',
          group: JobCatalogGroup.LDPU,
          minLevel: 2,
          isLeadership: true,
        },
        {
          id: posDefHeadId,
          code: `TRUONG_PHONG_${testRunId}`,
          title: 'Trưởng phòng',
          group: JobCatalogGroup.LDPU,
          minLevel: 3,
          isLeadership: true,
        },
        {
          id: posDefStaffId,
          code: `CHUYEN_VIEN_${testRunId}`,
          title: 'Chuyên viên',
          group: JobCatalogGroup.VCDC,
          minLevel: 4,
          isLeadership: false,
        },
      ],
    });

    // 3. Responsibility Areas
    await prisma.responsibilityArea.createMany({
      data: [
        {
          id: respAreaTrainingId,
          code: `TRAINING_${testRunId}`,
          name: 'Đào tạo & Quản lý người học',
          category: ResponsibilityCategory.ACADEMIC,
        },
        {
          id: respAreaFinanceId,
          code: `FINANCE_${testRunId}`,
          name: 'Tài chính & Đầu tư',
          category: ResponsibilityCategory.EXECUTIVE,
        },
      ],
    });

    // 4. Organizational Bodies
    await prisma.organizationalBody.createMany({
      data: [
        {
          id: bodyCouncilId,
          code: `COUNCIL_${testRunId}`,
          name: `Hội đồng Khoa học và Đào tạo ${testRunId}`,
          type: OrganizationalBodyType.COUNCIL,
          status: BodyStatus.ACTIVE,
          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          id: bodyDissolvedId,
          code: `DISSOLVED_${testRunId}`,
          name: `Ban chỉ đạo đã giải thể ${testRunId}`,
          type: OrganizationalBodyType.STEERING_COMMITTEE,
          status: BodyStatus.DISSOLVED,
          effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
        },
      ],
    });

    // 5. Users
    adminUser = await prisma.user.create({
      data: {
        id: `user-admin-${testRunId}`,
        email: `admin.${testRunId}@qcet.edu.vn`,
        name: 'Quản trị viên hệ thống',
        role: UserRole.ADMIN,

        isActive: true,
      },
    });

    rectorUser = await prisma.user.create({
      data: {
        id: `user-rector-${testRunId}`,
        email: `rector.${testRunId}@qcet.edu.vn`,
        name: 'Hiệu trưởng Nhà trường',
        role: UserRole.BAN_GIAM_HIEU,

        isActive: true,
      },
    });

    viceRectorUser = await prisma.user.create({
      data: {
        id: `user-vrector-${testRunId}`,
        email: `vrector.${testRunId}@qcet.edu.vn`,
        name: 'Phó Hiệu trưởng Đào tạo',
        role: UserRole.BAN_GIAM_HIEU,

        isActive: true,
      },
    });

    staffUser = await prisma.user.create({
      data: {
        id: `user-staff-${testRunId}`,
        email: `staff.${testRunId}@qcet.edu.vn`,
        name: 'Chuyên viên Phòng Đào tạo',
        role: UserRole.CHUYEN_VIEN,

        isActive: true,
      },
    });

    disabledUser = await prisma.user.create({
      data: {
        id: `user-disabled-${testRunId}`,
        email: `disabled.${testRunId}@qcet.edu.vn`,
        name: 'Người dùng bị vô hiệu hóa',
        role: UserRole.CHUYEN_VIEN,

        isActive: false,
      },
    });

    // 6. Position Assignments for Rector
    const rectorPos = await prisma.positionAssignment.create({
      data: {
        id: `pos-rector-${testRunId}`,
        userId: rectorUser.id,
        positionDefinitionId: posDefRectorId,
        unitId: unitId,
        type: AssignmentType.PRIMARY,
        status: AssignmentStatus.ACTIVE,
        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        effectiveTo: null,
      },
    });
    rectorPosId = rectorPos.id;

    // 7. Position Assignments for Vice Rector (Active Primary with Portfolio)
    const vrPos = await prisma.positionAssignment.create({
      data: {
        id: `pos-vrector-${testRunId}`,
        userId: viceRectorUser.id,
        positionDefinitionId: posDefViceRectorId,
        unitId: unitId,
        type: AssignmentType.PRIMARY,
        status: AssignmentStatus.ACTIVE,
        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        effectiveTo: null,
      },
    });
    activePrimaryPosId = vrPos.id;

    // Active Concurrent Position for Vice Rector in Secondary Unit
    const vrConcurrentPos = await prisma.positionAssignment.create({
      data: {
        id: `pos-vrector-concurrent-${testRunId}`,
        userId: viceRectorUser.id,
        positionDefinitionId: posDefHeadId,
        unitId: unitSecondaryId,
        type: AssignmentType.CONCURRENT,
        status: AssignmentStatus.ACTIVE,
        effectiveFrom: new Date('2026-02-01T00:00:00.000Z'),
        effectiveTo: new Date('2026-12-31T00:00:00.000Z'),
      },
    });
    activeConcurrentPosId = vrConcurrentPos.id;

    // Expired Position for Vice Rector (effectiveTo in past)
    const expiredPos = await prisma.positionAssignment.create({
      data: {
        id: `pos-vrector-expired-${testRunId}`,
        userId: viceRectorUser.id,
        positionDefinitionId: posDefHeadId,
        unitId: unitId,
        type: AssignmentType.CONCURRENT,
        status: AssignmentStatus.ACTIVE,
        effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
        effectiveTo: new Date('2026-01-01T00:00:00.000Z'), // Past
      },
    });
    expiredPosId = expiredPos.id;

    // Future Position for Vice Rector (effectiveFrom in future)
    const futurePos = await prisma.positionAssignment.create({
      data: {
        id: `pos-vrector-future-${testRunId}`,
        userId: viceRectorUser.id,
        positionDefinitionId: posDefHeadId,
        unitId: unitId,
        type: AssignmentType.CONCURRENT,
        status: AssignmentStatus.ACTIVE,
        effectiveFrom: new Date('2026-12-01T00:00:00.000Z'), // Future
        effectiveTo: null,
      },
    });
    futurePosId = futurePos.id;

    // Terminated Position for Vice Rector (status != ACTIVE)
    const termPos = await prisma.positionAssignment.create({
      data: {
        id: `pos-vrector-term-${testRunId}`,
        userId: viceRectorUser.id,
        positionDefinitionId: posDefHeadId,
        unitId: unitId,
        type: AssignmentType.CONCURRENT,
        status: AssignmentStatus.TERMINATED,
        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        effectiveTo: null,
      },
    });
    terminatedPosId = termPos.id;

    // 8. Portfolio Assignments for Vice Rector
    // Active Portfolio (TRAINING)
    await prisma.portfolioAssignment.create({
      data: {
        id: `port-vrector-training-${testRunId}`,
        positionAssignmentId: activePrimaryPosId,
        responsibilityAreaId: respAreaTrainingId,
        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        effectiveTo: null,
        sourceDecisionNumber: `QD-420-${testRunId}`,
      },
    });

    // Expired Portfolio (FINANCE)
    await prisma.portfolioAssignment.create({
      data: {
        id: `port-vrector-finance-expired-${testRunId}`,
        positionAssignmentId: activePrimaryPosId,
        responsibilityAreaId: respAreaFinanceId,
        effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
        effectiveTo: new Date('2026-01-01T00:00:00.000Z'), // Past
      },
    });

    // 9. Staff Position Assignment
    const staffPos = await prisma.positionAssignment.create({
      data: {
        id: `pos-staff-${testRunId}`,
        userId: staffUser.id,
        positionDefinitionId: posDefStaffId,
        unitId: unitId,
        type: AssignmentType.PRIMARY,
        status: AssignmentStatus.ACTIVE,
        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      },
    });

    // 10. DelegationGrants (Canonical DelegationGrant from Rector to ViceRector and ViceRector to Staff)
    // Valid Active Delegation (Rector -> ViceRector for document signing)
    await prisma.delegationGrant.create({
      data: {
        id: `del-valid-${testRunId}`,
        grantorAssignmentId: rectorPosId,
        granteeAssignmentId: activePrimaryPosId,
        responsibilityAreaId: respAreaTrainingId,
        action: 'document.outgoing.sign_kt',
        resourceScope: 'INSTITUTION_WIDE',
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        validUntil: new Date('2026-12-31T23:59:59.000Z'),
        sourceDocumentNumber: `QD-DEL-282-${testRunId}`,
        status: DelegationStatus.ACTIVE,
        revokedAt: null,
      },
    });

    // Expired Delegation
    await prisma.delegationGrant.create({
      data: {
        id: `del-expired-${testRunId}`,
        grantorAssignmentId: rectorPosId,
        granteeAssignmentId: activePrimaryPosId,
        responsibilityAreaId: respAreaFinanceId,
        action: 'finance.treasury_disbursement',
        resourceScope: 'UNIT_ONLY',
        validFrom: new Date('2025-01-01T00:00:00.000Z'),
        validUntil: new Date('2026-01-01T00:00:00.000Z'), // Past
        sourceDocumentNumber: `QD-DEL-EXP-${testRunId}`,
        status: DelegationStatus.ACTIVE,
        revokedAt: null,
      },
    });

    // Revoked Delegation
    await prisma.delegationGrant.create({
      data: {
        id: `del-revoked-${testRunId}`,
        grantorAssignmentId: rectorPosId,
        granteeAssignmentId: activePrimaryPosId,
        responsibilityAreaId: respAreaTrainingId,
        action: 'document.outgoing.sign',
        resourceScope: 'INSTITUTION_WIDE',
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        validUntil: new Date('2026-12-31T23:59:59.000Z'),
        sourceDocumentNumber: `QD-DEL-REV-${testRunId}`,
        status: DelegationStatus.REVOKED,
        revokedAt: new Date('2026-05-01T00:00:00.000Z'),
        revokedReason: 'Thu hồi theo Quyết định điều chỉnh nhân sự',
      },
    });

    // 11. Body Memberships
    // Active Council Membership for Vice Rector
    await prisma.bodyMembership.create({
      data: {
        id: `body-mem-active-${testRunId}`,
        bodyId: bodyCouncilId,
        userId: viceRectorUser.id,
        role: BodyMemberRole.VICE_CHAIR,
        appointedAt: new Date('2026-01-01T00:00:00.000Z'),
        expiresAt: new Date('2026-12-31T00:00:00.000Z'),
      },
    });

    // Membership in Dissolved Body
    await prisma.bodyMembership.create({
      data: {
        id: `body-mem-dissolved-${testRunId}`,
        bodyId: bodyDissolvedId,
        userId: viceRectorUser.id,
        role: BodyMemberRole.MEMBER,
        appointedAt: new Date('2025-01-01T00:00:00.000Z'),
        expiresAt: null,
      },
    });
  });

  after(async () => {
    // Cleanup in reverse dependency order
    try {
      await prisma.bodyMembership.deleteMany({
        where: { id: { in: [`body-mem-active-${testRunId}`, `body-mem-dissolved-${testRunId}`] } },
      });
      await prisma.delegationScopeRule.deleteMany({
        where: { delegationGrantId: { in: [`del-valid-${testRunId}`, `del-expired-${testRunId}`, `del-revoked-${testRunId}`] } },
      });
      await prisma.delegationGrant.deleteMany({
        where: { id: { in: [`del-valid-${testRunId}`, `del-expired-${testRunId}`, `del-revoked-${testRunId}`] } },
      });
      await prisma.portfolioAssignment.deleteMany({
        where: {
          id: {
            in: [
              `port-vrector-training-${testRunId}`,
              `port-vrector-finance-expired-${testRunId}`,
            ],
          },
        },
      });
      await prisma.positionAssignment.deleteMany({
        where: {
          id: {
            in: [
              `pos-rector-${testRunId}`,
              `pos-vrector-${testRunId}`,
              `pos-vrector-concurrent-${testRunId}`,
              `pos-vrector-expired-${testRunId}`,
              `pos-vrector-future-${testRunId}`,
              `pos-vrector-term-${testRunId}`,
              `pos-staff-${testRunId}`,
            ],
          },
        },
      });
      await prisma.organizationalBody.deleteMany({
        where: { id: { in: [bodyCouncilId, bodyDissolvedId] } },
      });
      await prisma.responsibilityArea.deleteMany({
        where: { id: { in: [respAreaTrainingId, respAreaFinanceId] } },
      });
      await prisma.positionDefinition.deleteMany({
        where: { id: { in: [posDefRectorId, posDefViceRectorId, posDefHeadId, posDefStaffId] } },
      });
      await prisma.user.deleteMany({
        where: {
          id: {
            in: [
              adminUser.id,
              rectorUser.id,
              viceRectorUser.id,
              staffUser.id,
              disabledUser.id,
            ],
          },
        },
      });
      await prisma.organizationalUnit.deleteMany({
        where: { id: { in: [unitId, unitSecondaryId] } },
      });
      await prisma.organizationalUnit.deleteMany({
        where: { id: deptId },
      });
    } catch (e) {
      console.error('Test cleanup error:', e);
    }
  });

  test('1. Active position assignment is loaded with definition and unit details', async () => {
    const ctx = await loadAuthorizationContext(viceRectorUser.id, now);

    assert.equal(ctx.userId, viceRectorUser.id);
    assert.equal(ctx.user.isActive, true);

    // Vice Rector should have 2 active positions: PRIMARY (VR) and CONCURRENT (Head)
    assert.equal(ctx.positions.length, 2);

    const primaryPos = ctx.positions.find((p) => p.type === AssignmentType.PRIMARY);
    assert.ok(primaryPos, 'Must have primary position');
    assert.equal(primaryPos.id, activePrimaryPosId);
    assert.equal(primaryPos.positionCode, `PHO_HIEU_TRUONG_${testRunId}`);
    assert.equal(primaryPos.positionTitle, 'Phó Hiệu trưởng');
    assert.equal(primaryPos.positionLevel, 2);
    assert.equal(primaryPos.isLeadership, true);
    assert.equal(primaryPos.unitId, unitId);
    assert.equal(primaryPos.unitCode, `UNIT_MAIN_${testRunId}`);
    assert.equal(primaryPos.unitType, UnitType.DEPARTMENT);
    assert.equal(primaryPos.isActing, false);
    assert.equal(primaryPos.status, AssignmentStatus.ACTIVE);
  });

  test('2. Expired position assignment (effectiveTo in past) is ignored', async () => {
    const ctx = await loadAuthorizationContext(viceRectorUser.id, now);
    const hasExpired = ctx.positions.some((p) => p.id === expiredPosId);
    assert.equal(hasExpired, false, 'Expired position must not be present in active positions');
  });

  test('3. Future position assignment (effectiveFrom in future) is ignored', async () => {
    const ctx = await loadAuthorizationContext(viceRectorUser.id, now);
    const hasFuture = ctx.positions.some((p) => p.id === futurePosId);
    assert.equal(hasFuture, false, 'Future position must not be present in active positions');
  });

  test('4. Terminated position assignment (status != ACTIVE) is ignored', async () => {
    const ctx = await loadAuthorizationContext(viceRectorUser.id, now);
    const hasTerminated = ctx.positions.some((p) => p.id === terminatedPosId);
    assert.equal(hasTerminated, false, 'Terminated position must not be present in active positions');
  });

  test('5. Portfolio assignment is loaded and linked to responsibility areas', async () => {
    const ctx = await loadAuthorizationContext(viceRectorUser.id, now);

    // Must include active TRAINING portfolio
    assert.equal(ctx.portfolios.length, 1);
    const trainingPortfolio = ctx.portfolios[0];
    assert.equal(trainingPortfolio.responsibilityAreaId, respAreaTrainingId);
    assert.equal(trainingPortfolio.responsibilityArea.code, `TRAINING_${testRunId}`);
    assert.equal(trainingPortfolio.responsibilityArea.category, ResponsibilityCategory.ACADEMIC);
    assert.equal(trainingPortfolio.sourceDecisionNumber, `QD-420-${testRunId}`);

    // Context.responsibilityAreas should expose the active responsibility areas
    assert.ok(ctx.responsibilityAreas.length >= 1);
    const hasTrainingArea = ctx.responsibilityAreas.some(
      (a) => a.code === `TRAINING_${testRunId}`
    );
    assert.equal(hasTrainingArea, true, 'TRAINING responsibility area must be present in context');

    // Expired portfolio (FINANCE) must NOT be present in portfolios
    const hasExpiredFinance = ctx.portfolios.some(
      (p) => p.responsibilityAreaId === respAreaFinanceId
    );
    assert.equal(hasExpiredFinance, false, 'Expired portfolio must be ignored');
  });

  test('6. Valid active DelegationGrant is loaded with scope and responsibility', async () => {
    const ctx = await loadAuthorizationContext(viceRectorUser.id, now);

    // Vice Rector received valid delegation from Rector
    const validDel = ctx.delegations.find((d) => d.id === `del-valid-${testRunId}`);
    assert.ok(validDel, 'Valid delegation must be present');
    assert.equal(validDel.grantorAssignmentId, rectorPosId);
    assert.equal(validDel.granteeAssignmentId, activePrimaryPosId);
    assert.equal(validDel.action, 'document.outgoing.sign_kt');
    assert.equal(validDel.resourceScope, 'INSTITUTION_WIDE');
    assert.equal(validDel.status, DelegationStatus.ACTIVE);
    assert.equal(validDel.revokedAt, null);
  });

  test('7. Expired and revoked DelegationGrants are excluded', async () => {
    const ctx = await loadAuthorizationContext(viceRectorUser.id, now);

    const hasExpired = ctx.delegations.some((d) => d.id === `del-expired-${testRunId}`);
    assert.equal(hasExpired, false, 'Expired delegation must be excluded');

    const hasRevoked = ctx.delegations.some((d) => d.id === `del-revoked-${testRunId}`);
    assert.equal(hasRevoked, false, 'Revoked delegation must be excluded');
  });

  test('8. Body membership: Active body membership loaded, dissolved body excluded', async () => {
    const ctx = await loadAuthorizationContext(viceRectorUser.id, now);

    // Active Council membership must be present
    const activeMem = ctx.bodyMemberships.find((m) => m.bodyId === bodyCouncilId);
    assert.ok(activeMem, 'Active council membership must be present');
    assert.equal(activeMem.role, BodyMemberRole.VICE_CHAIR);
    assert.equal(activeMem.bodyStatus, BodyStatus.ACTIVE);

    // Dissolved body membership must be excluded
    const dissolvedMem = ctx.bodyMemberships.find((m) => m.bodyId === bodyDissolvedId);
    assert.equal(dissolvedMem, undefined, 'Dissolved body membership must be excluded');
  });

  test('9. SystemRole separation: Admin user gets SYSTEM_ADMIN; Leadership user does NOT', async () => {
    // 9A: Technical Admin User
    const adminCtx = await loadAuthorizationContext(adminUser.id, now);
    assert.ok(
      adminCtx.systemRoles.includes(SystemRole.SYSTEM_ADMIN),
      'User with role ADMIN must receive SYSTEM_ADMIN'
    );
    assert.equal(adminCtx.isSystemAdmin(), true);

    // 9B: Rector (Institutional Leadership)
    const rectorCtx = await loadAuthorizationContext(rectorUser.id, now);
    assert.equal(
      rectorCtx.systemRoles.includes(SystemRole.SYSTEM_ADMIN),
      false,
      'INVARIANT: HIEU_TRUONG must NEVER be mapped to SYSTEM_ADMIN'
    );
    assert.equal(rectorCtx.isSystemAdmin(), false);
    assert.equal(rectorCtx.hasLeadershipPosition(), true);

    // 9C: Vice Rector (Institutional Leadership)
    const vRectorCtx = await loadAuthorizationContext(viceRectorUser.id, now);
    assert.equal(
      vRectorCtx.systemRoles.includes(SystemRole.SYSTEM_ADMIN),
      false,
      'INVARIANT: PHO_HIEU_TRUONG must NEVER be mapped to SYSTEM_ADMIN'
    );
    assert.equal(vRectorCtx.isSystemAdmin(), false);

    // 9D: Professional Staff
    const staffCtx = await loadAuthorizationContext(staffUser.id, now);
    assert.equal(staffCtx.systemRoles.length, 0);
    assert.equal(staffCtx.isSystemAdmin(), false);
    assert.equal(staffCtx.hasLeadershipPosition(), false);
  });

  test('10. Primary Unit IDs resolution', async () => {
    const ctx = await loadAuthorizationContext(viceRectorUser.id, now);
    // Primary position is in unitId
    assert.ok(ctx.primaryUnitIds.includes(unitId));
    // Secondary position is CONCURRENT, not PRIMARY
    assert.equal(ctx.primaryUnitIds.length, 1);
  });

  test('11. Inactive account throws AccountDisabledAuthError', async () => {
    await assert.rejects(
      async () => {
        await loadAuthorizationContext(disabledUser.id, now);
      },
      (err: unknown) => {
        assert.ok(err instanceof AccountDisabledAuthError);
        assert.equal((err as AccountDisabledAuthError).code, 'ACCOUNT_DISABLED');
        assert.equal((err as AccountDisabledAuthError).statusCode, 401);
        return true;
      }
    );
  });

  test('12. Non-existent account throws AccountNotFoundError', async () => {
    await assert.rejects(
      async () => {
        await loadAuthorizationContext('non-existent-user-id', now);
      },
      (err: unknown) => {
        assert.ok(err instanceof AccountNotFoundError);
        assert.equal((err as AccountNotFoundError).code, 'SESSION_INVALID');
        assert.equal((err as AccountNotFoundError).statusCode, 401);
        return true;
      }
    );
  });
});
