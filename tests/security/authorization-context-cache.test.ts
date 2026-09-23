import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import nextEnvPkg from '@next/env';

const loadEnvConfig =
  (nextEnvPkg as any)?.loadEnvConfig ||
  (nextEnvPkg as any)?.default?.loadEnvConfig ||
  (nextEnvPkg as any);
if (typeof loadEnvConfig === 'function') {
  loadEnvConfig(process.cwd());
}

if (!process.env.QCET_ALLOW_DB_TESTS) {
  process.env.QCET_ALLOW_DB_TESTS = '1';
}
if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'test') {
  (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
}
if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('/qcet_eoffice')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(
    /\/qcet_eoffice(\?.*)?$/,
    '/qcet_test$1'
  );
}

import { prisma } from '@/lib/prisma';
import {
  UserRole,
  AssignmentType,
  AssignmentStatus,
  DelegationStatus,
  UnitType,
  UnitStatus,
  JobCatalogGroup,
  ResponsibilityCategory,
} from '@prisma/client';
import {
  loadAuthorizationContext,
  loadFreshAuthorizationContext,
  loadAuthorizationContextFromDb,
} from '@/server/authorization/authorization-context-service';
import {
  authorizationContextCache,
  getCachedAuthorizationContext,
  loadAuthorizationContextWithCache,
  invalidateAuthorizationContextCache,
  invalidateAllAuthorizationContextCaches,
  getCacheMetrics,
  invalidateOnUserDisable,
  invalidateOnUserUpdate,
  invalidateOnPositionAssignmentChange,
  invalidateOnPortfolioAssignmentChange,
  invalidateOnDelegationGrantChange,
  AuthorizationContextCacheManager,
} from '@/server/authorization/authorization-context-cache';
import { AccountDisabledAuthError } from '@/server/authorization/errors';

describe('Sprint 2: Task 12 - AuthorizationContext Cache Strategy', () => {
  const testRunId = String(Date.now());
  const now = new Date('2026-09-10T10:00:00.000Z');

  // DB entities
  const deptId = `DEPT-CACHE-${testRunId}`;
  const unitId = `UNIT-CACHE-${testRunId}`;
  const posDefId = `POSDEF-CACHE-${testRunId}`;
  const posDefRectorId = `POSDEF-REC-CACHE-${testRunId}`;
  const respAreaId = `RESP-CACHE-${testRunId}`;

  let testUser: { id: string; email: string };
  let grantorUser: { id: string; email: string };
  let testPosAssignmentId: string;
  let grantorPosAssignmentId: string;
  let testPortfolioId: string;
  let testDelegationId: string;

  before(async () => {
    // 0. Isolated DB guard
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

    // 1. Create Department and Unit
    await prisma.organizationalUnit.create({
      data: {
        id: deptId,
        name: `Phòng Ban Test Cache ${testRunId}`,

      },
    });

    await prisma.organizationalUnit.create({
      data: {
        id: unitId,
        code: `UNIT_CACHE_${testRunId}`,
        name: `Đơn vị Cache Test ${testRunId}`,
        type: UnitType.DEPARTMENT,
        status: UnitStatus.ACTIVE,
        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      },
    });

    // 2. Position Definitions
    await prisma.positionDefinition.createMany({
      data: [
        {
          id: posDefId,
          code: `TRUONG_PHONG_CACHE_${testRunId}`,
          title: 'Trưởng phòng thử nghiệm',
          group: JobCatalogGroup.LDPU,
          minLevel: 2,
          isLeadership: true,
        },
        {
          id: posDefRectorId,
          code: `HIEU_TRUONG_CACHE_${testRunId}`,
          title: 'Hiệu trưởng thử nghiệm',
          group: JobCatalogGroup.LDPU,
          minLevel: 1,
          isLeadership: true,
        },
      ],
    });

    // 3. Responsibility Area
    await prisma.responsibilityArea.create({
      data: {
        id: respAreaId,
        code: `RESP_CACHE_${testRunId}`,
        name: 'Lĩnh vực Quản trị Cache',
        category: ResponsibilityCategory.EXECUTIVE,
      },
    });

    // 4. Users
    testUser = await prisma.user.create({
      data: {
        id: `user-cache-${testRunId}`,
        email: `cache.user.${testRunId}@qcet.edu.vn`,
        name: 'Người dùng Thử nghiệm Cache',
        role: UserRole.TRUONG_PHONG,
        title: 'Trưởng phòng ban đầu',

        isActive: true,
      },
      select: { id: true, email: true },
    });

    grantorUser = await prisma.user.create({
      data: {
        id: `user-grantor-cache-${testRunId}`,
        email: `grantor.cache.${testRunId}@qcet.edu.vn`,
        name: 'Người ủy quyền Thử nghiệm Cache',
        role: UserRole.ADMIN,
        title: 'Hiệu trưởng',

        isActive: true,
      },
      select: { id: true, email: true },
    });

    // 5. Position Assignments
    const testPos = await prisma.positionAssignment.create({
      data: {
        id: `pos-cache-${testRunId}`,
        userId: testUser.id,
        positionDefinitionId: posDefId,
        unitId: unitId,
        type: AssignmentType.PRIMARY,
        status: AssignmentStatus.ACTIVE,
        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        effectiveTo: null,
      },
    });
    testPosAssignmentId = testPos.id;

    const grantorPos = await prisma.positionAssignment.create({
      data: {
        id: `pos-grantor-cache-${testRunId}`,
        userId: grantorUser.id,
        positionDefinitionId: posDefRectorId,
        unitId: unitId,
        type: AssignmentType.PRIMARY,
        status: AssignmentStatus.ACTIVE,
        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        effectiveTo: null,
      },
    });
    grantorPosAssignmentId = grantorPos.id;

    // 6. Portfolio Assignment
    const testPort = await prisma.portfolioAssignment.create({
      data: {
        id: `port-cache-${testRunId}`,
        positionAssignmentId: testPosAssignmentId,
        responsibilityAreaId: respAreaId,
        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        effectiveTo: null,
      },
    });
    testPortfolioId = testPort.id;

    // 7. Delegation Grant
    const testDel = await prisma.delegationGrant.create({
      data: {
        id: `del-cache-${testRunId}`,
        grantorAssignmentId: grantorPosAssignmentId,
        granteeAssignmentId: testPosAssignmentId,
        responsibilityAreaId: respAreaId,
        action: 'document.outgoing.sign',
        resourceScope: 'UNIT_ONLY',
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        validUntil: new Date('2026-12-31T23:59:59.000Z'),
        sourceDocumentNumber: `QD-DEL-CACHE-${testRunId}`,
        status: DelegationStatus.ACTIVE,
        revokedAt: null,
      },
    });
    testDelegationId = testDel.id;
  });

  after(async () => {
    try {
      if (testDelegationId) {
        await prisma.delegationGrant.deleteMany({
          where: { id: testDelegationId },
        });
      }
      if (testPortfolioId) {
        await prisma.portfolioAssignment.deleteMany({
          where: { id: testPortfolioId },
        });
      }
      const posIds = [testPosAssignmentId, grantorPosAssignmentId].filter(Boolean);
      if (posIds.length > 0) {
        await prisma.positionAssignment.deleteMany({
          where: { id: { in: posIds } },
        });
      }
      await prisma.responsibilityArea.deleteMany({
        where: { id: respAreaId },
      });
      await prisma.positionDefinition.deleteMany({
        where: { id: { in: [posDefId, posDefRectorId] } },
      });
      const userIds = [testUser?.id, grantorUser?.id].filter(Boolean) as string[];
      if (userIds.length > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: userIds } },
        });
      }
      await prisma.organizationalUnit.deleteMany({
        where: { id: unitId },
      });
      await prisma.organizationalUnit.deleteMany({
        where: { id: deptId },
      });
    } catch (e) {
      console.error('Test cleanup error in authorization-context-cache.test.ts:', e);
    }
  });

  beforeEach(() => {
    invalidateAllAuthorizationContextCaches();
    authorizationContextCache.resetCacheMetrics();
  });

  test('1. Default behavior is per-request fresh DB evaluation (no stale reads)', async () => {
    // Calling loadAuthorizationContext without options or with { useCache: false }
    const ctx1 = await loadAuthorizationContext(testUser.id, now);
    assert.equal(ctx1.user.title, 'Trưởng phòng ban đầu');

    // Update DB directly
    await prisma.user.update({
      where: { id: testUser.id },
      data: { title: 'Trưởng phòng đã cập nhật DB' },
    });

    // Fresh per-request evaluation immediately sees DB change
    const ctx2 = await loadAuthorizationContext(testUser.id, now);
    assert.equal(ctx2.user.title, 'Trưởng phòng đã cập nhật DB');

    // Restore user title in DB
    await prisma.user.update({
      where: { id: testUser.id },
      data: { title: 'Trưởng phòng ban đầu' },
    });
  });

  test('2. Cache hit behavior within short TTL when caching is enabled', async () => {
    const metricsBefore = getCacheMetrics();
    assert.equal(metricsBefore.hits, 0);
    assert.equal(metricsBefore.misses, 0);

    // First call: cache miss, evaluates from DB
    const ctx1 = await loadAuthorizationContextWithCache(testUser.id, { now });
    const metricsAfterMiss = getCacheMetrics();
    assert.equal(metricsAfterMiss.misses, 1);
    assert.equal(metricsAfterMiss.hits, 0);
    assert.equal(metricsAfterMiss.size, 1);

    // Second call within TTL (same now or now + 2s): cache hit!
    const withinTtlTime = new Date(now.getTime() + 2_000);
    const ctx2 = await loadAuthorizationContextWithCache(testUser.id, { now: withinTtlTime });
    const metricsAfterHit = getCacheMetrics();
    assert.equal(metricsAfterHit.hits, 1);
    assert.equal(metricsAfterHit.misses, 1);

    assert.equal(ctx1.userId, ctx2.userId);
    assert.equal(ctx1.generatedAt.getTime(), ctx2.generatedAt.getTime());
  });

  test('3. Invalidation via invalidateAuthorizationContextCache immediately purges cached entry', async () => {
    // Populate cache
    await loadAuthorizationContextWithCache(testUser.id, { now });
    assert.equal(getCacheMetrics().size, 1);

    // Invalidate
    invalidateAuthorizationContextCache(testUser.id);
    assert.equal(getCacheMetrics().size, 0);

    // Next call must be a miss and reload fresh
    await loadAuthorizationContextWithCache(testUser.id, { now });
    assert.equal(getCacheMetrics().misses, 2);
    assert.equal(getCacheMetrics().hits, 0);
  });

  test('4. TTL expiration purges stale context and reloads fresh', async () => {
    const customTtl = 5_000; // 5 seconds
    const t0 = new Date('2026-09-10T10:00:00.000Z');

    // 1. Initial load at t0
    await loadAuthorizationContextWithCache(testUser.id, { now: t0, ttlMs: customTtl });
    assert.equal(getCacheMetrics().misses, 1);

    // 2. Query at t0 + 4s (within 5s TTL) -> HIT
    const tHit = new Date('2026-09-10T10:00:04.000Z');
    await loadAuthorizationContextWithCache(testUser.id, { now: tHit, ttlMs: customTtl });
    assert.equal(getCacheMetrics().hits, 1);
    assert.equal(getCacheMetrics().misses, 1);

    // 3. Query at t0 + 6s (expired > 5s TTL) -> MISS & EVICTION
    const tExpired = new Date('2026-09-10T10:00:06.000Z');
    await loadAuthorizationContextWithCache(testUser.id, { now: tExpired, ttlMs: customTtl });
    assert.equal(getCacheMetrics().hits, 1);
    assert.equal(getCacheMetrics().misses, 2);

    const detailed = authorizationContextCache.getDetailedMetrics();
    assert.equal(detailed.evictions, 1);
  });

  test('5. Disabled user is immediately blocked after invalidateOnUserDisable', async () => {
    // 1. Cache the active user context
    const cachedCtx = await loadAuthorizationContextWithCache(testUser.id, { now });
    assert.equal(cachedCtx.user.isActive, true);

    // 2. User account disabled in DB
    await prisma.user.update({
      where: { id: testUser.id },
      data: { isActive: false },
    });

    // 3. Invalidate on user disable trigger
    invalidateOnUserDisable(testUser.id);

    // 4. Subsequent request must fail with AccountDisabledAuthError
    await assert.rejects(
      async () => {
        await loadAuthorizationContextWithCache(testUser.id, { now });
      },
      (err: any) => {
        assert.ok(err instanceof AccountDisabledAuthError);
        return true;
      }
    );

    // Restore user isActive in DB
    await prisma.user.update({
      where: { id: testUser.id },
      data: { isActive: true },
    });
  });

  test('6. Revoked delegation is not served stale data after invalidateOnDelegationGrantChange', async () => {
    // 1. Cache the context while delegation is active
    const ctx1 = await loadAuthorizationContextWithCache(testUser.id, { now });
    assert.equal(ctx1.delegations.length, 1);
    assert.equal(ctx1.delegations[0].action, 'document.outgoing.sign');

    // 2. Revoke delegation in DB
    await prisma.delegationGrant.update({
      where: { id: testDelegationId },
      data: {
        status: DelegationStatus.REVOKED,
        revokedAt: now,
        revokedReason: 'Thu hồi quyền ký thử nghiệm',
      },
    });

    // 3. Trigger delegation invalidation
    invalidateOnDelegationGrantChange({ granteeUserId: testUser.id });

    // 4. Fresh context loaded on next request has zero active delegations
    const ctx2 = await loadAuthorizationContextWithCache(testUser.id, { now });
    assert.equal(ctx2.delegations.length, 0);

    // Restore delegation in DB
    await prisma.delegationGrant.update({
      where: { id: testDelegationId },
      data: {
        status: DelegationStatus.ACTIVE,
        revokedAt: null,
        revokedReason: null,
      },
    });
  });

  test('7. Explicit invalidation triggers: Position and Portfolio changes', async () => {
    // Seed cache
    await loadAuthorizationContextWithCache(testUser.id, { now });
    assert.equal(getCacheMetrics().size, 1);

    // Position assignment invalidation
    invalidateOnPositionAssignmentChange(testUser.id);
    assert.equal(getCacheMetrics().size, 0);

    // Seed cache again
    await loadAuthorizationContextWithCache(testUser.id, { now });
    assert.equal(getCacheMetrics().size, 1);

    // Portfolio assignment invalidation
    invalidateOnPortfolioAssignmentChange(testUser.id);
    assert.equal(getCacheMetrics().size, 0);

    // User update invalidation
    await loadAuthorizationContextWithCache(testUser.id, { now });
    assert.equal(getCacheMetrics().size, 1);
    invalidateOnUserUpdate(testUser.id);
    assert.equal(getCacheMetrics().size, 0);
  });

  test('8. Single-flight promise coalescing prevents duplicate concurrent DB queries', async () => {
    // Execute 4 concurrent requests for the same user with cold cache
    const [c1, c2, c3, c4] = await Promise.all([
      loadAuthorizationContextWithCache(testUser.id, { now }),
      loadAuthorizationContextWithCache(testUser.id, { now }),
      loadAuthorizationContextWithCache(testUser.id, { now }),
      loadAuthorizationContextWithCache(testUser.id, { now }),
    ]);

    assert.equal(c1.userId, testUser.id);
    assert.equal(c2.userId, testUser.id);
    assert.equal(c3.userId, testUser.id);
    assert.equal(c4.userId, testUser.id);

    // Exactly 1 miss evaluated from DB; remaining coalesced on the in-flight promise
    assert.equal(getCacheMetrics().misses, 1);
  });

  test('9. Force refresh option bypasses cache and reloads context', async () => {
    await loadAuthorizationContextWithCache(testUser.id, { now });
    assert.equal(getCacheMetrics().misses, 1);

    // Query with forceRefresh: true
    await getCachedAuthorizationContext(testUser.id, now, { forceRefresh: true });
    assert.equal(getCacheMetrics().misses, 2);
  });

  test('10. Custom AuthorizationContextCacheManager instance respects maxEntries capacity pruning', async () => {
    let mockLoadCount = 0;
    const mockLoader = async (userId: string) => {
      mockLoadCount++;
      return {
        userId,
        user: { id: userId, email: `${userId}@qcet.edu.vn`, name: userId, isActive: true },
        systemRoles: [],
        positions: [],
        responsibilityAreas: [],
        portfolios: [],
        delegations: [],
        bodyMemberships: [],
        primaryUnitIds: [],
        generatedAt: now,
        hasSystemRole: () => false,
        isSystemAdmin: () => false,
        hasPosition: () => false,
        hasResponsibilityArea: () => false,
        hasLeadershipPosition: () => false,
        getPositionsInUnit: () => [],
        getActiveDelegationsForAction: () => [],
      } as any;
    };

    const smallCache = new AuthorizationContextCacheManager({
      maxEntries: 2,
      loader: mockLoader,
    });

    await smallCache.getCachedAuthorizationContext('u1', now);
    await smallCache.getCachedAuthorizationContext('u2', now);
    assert.equal(smallCache.getCacheMetrics().size, 2);

    // Inserting 3rd entry exceeds maxEntries (2), causing oldest entry to be evicted
    await smallCache.getCachedAuthorizationContext('u3', now);
    assert.equal(smallCache.getCacheMetrics().size, 2);
    assert.equal(smallCache.getDetailedMetrics().evictions, 1);

    // 'u1' was evicted, so loading 'u1' again must trigger a miss
    await smallCache.getCachedAuthorizationContext('u1', now);
    assert.equal(mockLoadCount, 4);
  });
});
