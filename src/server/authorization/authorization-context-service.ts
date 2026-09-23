import { prisma } from '@/lib/prisma';
import {
  AssignmentStatus,
  AssignmentType,
  BodyStatus,
  DelegationStatus,
  JobCatalogGroup,
  UnitStatus,
  UnitType,
  UserRole,
} from '@prisma/client';
import {
  ActiveBodyMembership,
  ActiveDelegationGrant,
  ActivePortfolioAssignment,
  ActivePositionAssignment,
  ActiveResponsibilityArea,
  AuthorizationContext,
  AuthorizationContextModel,
  SystemRole,
} from './authorization-context';
import {
  AccountDisabledAuthError,
  AccountNotFoundError,
} from './errors';
import { getCachedAuthorizationContext } from './authorization-context-cache';

export interface LoadAuthorizationContextOptions {
  useCache?: boolean;
  ttlMs?: number;
  forceRefresh?: boolean;
}

/**
 * Loads the canonical AuthorizationContext V2 for a given user directly from the database.
 * Evaluates live database state without caching.
 */
export async function loadFreshAuthorizationContext(
  userId: string,
  now: Date = new Date()
): Promise<AuthorizationContext> {
  if (!userId || typeof userId !== 'string') {
    throw new AccountNotFoundError('Mã định danh người dùng không hợp lệ');
  }

  // 1. Load User
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      title: true,
      phone: true,
      avatarUrl: true,
      provider: true,
      isActive: true,
    },
  });

  if (!user) {
    throw new AccountNotFoundError('Người dùng không tồn tại trong hệ thống');
  }

  if (!user.isActive) {
    throw new AccountDisabledAuthError('Tài khoản đã bị vô hiệu hóa hoặc tạm khóa');
  }

  // 2. Resolve SystemRole (Strict Separation: ADMIN -> SYSTEM_ADMIN, never leadership titles)
  const systemRoles: SystemRole[] = [];
  if (user.role === UserRole.ADMIN) {
    systemRoles.push(SystemRole.SYSTEM_ADMIN);
  }

  // 3. Load Active Position Assignments ("Active means active")
  const rawPositions = await prisma.positionAssignment.findMany({
    where: {
      userId,
      status: AssignmentStatus.ACTIVE,
      effectiveFrom: { lte: now },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gte: now } },
      ],
    },
    include: {
      positionDefinition: true,
      unit: true,
      portfolios: {
        where: {
          effectiveFrom: { lte: now },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: now } },
          ],
        },
        include: {
          responsibilityArea: true,
        },
      },
    },
    orderBy: [
      { type: 'asc' },
      { effectiveFrom: 'desc' },
    ],
  });

  // Defensive in-memory verification for strict boundary checking
  const activePositions: ActivePositionAssignment[] = [];
  const activePortfolios: ActivePortfolioAssignment[] = [];
  const activePositionIds: string[] = [];

  for (const pos of rawPositions) {
    if (pos.status !== AssignmentStatus.ACTIVE) continue;
    if (pos.effectiveFrom > now) continue;
    if (pos.effectiveTo && pos.effectiveTo < now) continue;
    if (pos.unit && pos.unit.status !== UnitStatus.ACTIVE) continue;

    activePositionIds.push(pos.id);

    activePositions.push({
      id: pos.id,
      userId: pos.userId,
      positionDefinitionId: pos.positionDefinitionId,
      positionCode: pos.positionDefinition.code,
      positionTitle: pos.positionDefinition.title,
      positionGroup: pos.positionDefinition.group,
      positionLevel: pos.positionDefinition.minLevel,
      isLeadership: pos.positionDefinition.isLeadership,
      unitId: pos.unitId,
      unitCode: pos.unit.code,
      unitName: pos.unit.name,
      unitType: pos.unit.type,
      unitStatus: pos.unit.status,
      type: pos.type,
      isActing: pos.type === AssignmentType.ACTING,
      effectiveFrom: pos.effectiveFrom,
      effectiveTo: pos.effectiveTo,
      status: pos.status,
      sourceDecisionNumber: pos.sourceDecisionNumber,
    });

    // Extract active portfolios
    for (const port of pos.portfolios) {
      if (port.effectiveFrom > now) continue;
      if (port.effectiveTo && port.effectiveTo < now) continue;

      activePortfolios.push({
        id: port.id,
        positionAssignmentId: port.positionAssignmentId,
        responsibilityAreaId: port.responsibilityAreaId,
        responsibilityArea: {
          id: port.responsibilityArea.id,
          code: port.responsibilityArea.code,
          name: port.responsibilityArea.name,
          description: port.responsibilityArea.description,
          category: port.responsibilityArea.category,
        },
        effectiveFrom: port.effectiveFrom,
        effectiveTo: port.effectiveTo,
        sourceDecisionNumber: port.sourceDecisionNumber,
      });
    }
  }

  // 4. Load Active DelegationGrants (Only canonical DelegationGrant, never DacumDelegation)
  const activeDelegations: ActiveDelegationGrant[] = [];

  if (activePositionIds.length > 0) {
    const rawDelegations = await prisma.delegationGrant.findMany({
      where: {
        OR: [
          { granteeAssignmentId: { in: activePositionIds } },
          { grantorAssignmentId: { in: activePositionIds } },
        ],
        status: DelegationStatus.ACTIVE,
        revokedAt: null,
        validFrom: { lte: now },
        validUntil: { gte: now },
      },
      include: {
        grantorAssignment: {
          include: {
            user: {
              select: { id: true, name: true },
            },
            positionDefinition: true,
          },
        },
        granteeAssignment: {
          include: {
            user: {
              select: { id: true, name: true },
            },
            positionDefinition: true,
          },
        },
        responsibilityArea: true,
        scopeRules: true,
      },
    });

    for (const del of rawDelegations) {
      if (del.status !== DelegationStatus.ACTIVE) continue;
      if (del.revokedAt !== null) continue;
      if (del.validFrom > now) continue;
      if (del.validUntil < now) continue;

      activeDelegations.push({
        id: del.id,
        grantorAssignmentId: del.grantorAssignmentId,
        grantorUserId: del.grantorAssignment.userId,
        grantorPositionCode: del.grantorAssignment.positionDefinition?.code,
        grantorName: del.grantorAssignment.user?.name,
        grantorPositionTitle: del.grantorAssignment.positionDefinition?.title,
        granteeAssignmentId: del.granteeAssignmentId,
        granteeUserId: del.granteeAssignment.userId,
        granteePositionCode: del.granteeAssignment.positionDefinition?.code,
        granteeName: del.granteeAssignment.user?.name,
        granteePositionTitle: del.granteeAssignment.positionDefinition?.title,
        responsibilityAreaId: del.responsibilityAreaId,
        responsibilityArea: del.responsibilityArea
          ? {
              id: del.responsibilityArea.id,
              code: del.responsibilityArea.code,
              name: del.responsibilityArea.name,
              description: del.responsibilityArea.description,
              category: del.responsibilityArea.category,
            }
          : null,
        action: del.action,
        resourceScope: del.resourceScope,
        validFrom: del.validFrom,
        validUntil: del.validUntil,
        sourceDocumentNumber: del.sourceDocumentNumber,
        reason: del.reason,
        status: del.status,
        revokedAt: del.revokedAt,
        revokedReason: del.revokedReason,
        scopeRules: del.scopeRules.map((sr) => ({
          id: sr.id,
          delegationGrantId: sr.delegationGrantId,
          entityType: sr.entityType,
          entityId: sr.entityId,
          constraintType: sr.constraintType,
        })),
      });
    }
  }

  // 5. Load Active Body Memberships ("Active means active", body must be ACTIVE)
  const rawMemberships = await prisma.bodyMembership.findMany({
    where: {
      OR: [
        { userId },
        ...(activePositionIds.length > 0 ? [{ positionAssignmentId: { in: activePositionIds } }] : []),
      ],
      appointedAt: { lte: now },
      AND: [
        {
          OR: [
            { expiresAt: null },
            { expiresAt: { gte: now } },
          ],
        },
      ],
    },
    include: {
      body: true,
    },
  });

  const activeBodyMemberships: ActiveBodyMembership[] = [];
  for (const mem of rawMemberships) {
    if (mem.appointedAt > now) continue;
    if (mem.expiresAt && mem.expiresAt < now) continue;
    if (mem.body.status !== BodyStatus.ACTIVE) continue;
    if (mem.body.effectiveFrom > now) continue;
    if (mem.body.effectiveTo && mem.body.effectiveTo < now) continue;

    activeBodyMemberships.push({
      id: mem.id,
      bodyId: mem.bodyId,
      bodyCode: mem.body.code,
      bodyName: mem.body.name,
      bodyType: mem.body.type,
      bodyStatus: mem.body.status,
      role: mem.role,
      positionAssignmentId: mem.positionAssignmentId,
      userId: mem.userId,
      appointedAt: mem.appointedAt,
      expiresAt: mem.expiresAt,
    });
  }

  // 6. Aggregate Unique Responsibility Areas
  const responsibilityAreasMap = new Map<string, ActiveResponsibilityArea>();
  for (const port of activePortfolios) {
    responsibilityAreasMap.set(port.responsibilityArea.id, port.responsibilityArea);
  }
  for (const del of activeDelegations) {
    if (del.granteeUserId === userId && del.responsibilityArea) {
      responsibilityAreasMap.set(del.responsibilityArea.id, del.responsibilityArea);
    }
  }
  const responsibilityAreas = Array.from(responsibilityAreasMap.values());

  // 7. Resolve Primary Unit IDs
  const primaryUnitIdsSet = new Set<string>();
  for (const pos of activePositions) {
    if (pos.type === AssignmentType.PRIMARY) {
      primaryUnitIdsSet.add(pos.unitId);
    }
  }
  // Fallback to all active position units if no PRIMARY position is assigned
  if (primaryUnitIdsSet.size === 0) {
    for (const pos of activePositions) {
      primaryUnitIdsSet.add(pos.unitId);
    }
  }
  const primaryUnitIds = Array.from(primaryUnitIdsSet);

  return new AuthorizationContextModel({
    userId: user.id,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      title: user.title,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      provider: user.provider,
      departmentId: undefined,
      isActive: user.isActive,
    },
    systemRoles,
    positions: activePositions,
    responsibilityAreas,
    portfolios: activePortfolios,
    delegations: activeDelegations,
    bodyMemberships: activeBodyMemberships,
    primaryUnitIds,
    generatedAt: now,
  });
}

/**
 * Loads the canonical AuthorizationContext V2 for a given user.
 *
 * Invariants:
 * 1. Default to per-request freshness: By default (options.useCache is falsy),
 *    evaluates live database state to prioritize correctness and security.
 * 2. Opt-in short-TTL caching: High-throughput read endpoints can set options.useCache = true
 *    to leverage bounded in-memory caching with explicit invalidation triggers.
 * 3. Throws AccountDisabledAuthError if user is inactive / disabled.
 * 4. Throws AccountNotFoundError if user does not exist.
 */
export async function loadAuthorizationContext(
  userId: string,
  now: Date = new Date(),
  options?: LoadAuthorizationContextOptions
): Promise<AuthorizationContext> {
  if (options?.useCache) {
    return getCachedAuthorizationContext(userId, now, {
      ttlMs: options.ttlMs,
      forceRefresh: options.forceRefresh,
    });
  }
  return loadFreshAuthorizationContext(userId, now);
}

/**
 * Direct alias for fresh DB evaluation (bypasses any cache).
 */
export const loadAuthorizationContextFromDb = loadFreshAuthorizationContext;

