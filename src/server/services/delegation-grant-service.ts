/**
 * QCET E-Office: Canonical Delegation Grant Management Service
 * Sprint 6 - Workstream 6.3 (Organization Administration & Dossier)
 *
 * Invariants Enforced:
 * 1. Anti-Self-Delegation: Staff cannot delegate power to themselves (grantor.userId !== grantee.userId).
 * 2. Active Tenures: Both grantor and grantee position assignments must be ACTIVE and effective.
 * 3. Non-Delegable Capabilities: Statutory non-delegable actions (position.manage_leadership, hr.disciplinary_action, etc.) are strictly prohibited from delegation.
 * 4. Portfolio Authority Boundary: Grantor cannot delegate responsibilities outside their assigned portfolios or statutory leadership purview.
 * 5. Anti-Circular Delegation: Prohibits direct or transitive circular delegation loops (A -> B -> A or A -> B -> C -> A).
 * 6. Mandatory Source Legal Document: Every delegation requires a valid legal decision number (sourceDocumentNumber) per Decree 30/2020/ND-CP.
 * 7. Two-Way Cache Invalidation: Atomically invalidates AuthorizationContextCache for both grantor and grantee upon grant or revocation.
 */

import { prisma } from "@/lib/prisma";
import type {
  DelegationGrant,
  DelegationScopeRule,
  Prisma,
} from "@prisma/client";
import {
  DelegationStatus,
  AssignmentStatus,
  UnitStatus,
} from "@prisma/client";
import {
  assertAuthorized,
  type AuthenticatedUserContext,
  type AuthorizationResource,
} from "@/lib/auth/hybrid-authorization";
import { resolveUserContext } from "@/lib/services/incoming-document-service";
import { auditService, AuditAction, AuditEntityType } from "@/lib/db/audit";
import { publishOutboxEvent, OutboxEventType, OutboxAggregateType } from "@/lib/db/outbox";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  ForbiddenError,
} from "@/server/api/errors";
import type { SessionPayload } from "@/lib/jwt-session";
import { authorizationContextCache } from "@/server/authorization/authorization-context-cache";
import {
  NON_DELEGABLE_CAPABILITIES,
  type CapabilityAction,
} from "@/server/authorization/capability";

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface CreateDelegationScopeRuleInput {
  entityType: string;
  entityId?: string | null;
  constraintType: string;
}

export interface CreateDelegationGrantInput {
  grantorAssignmentId: string;
  granteeAssignmentId: string;
  responsibilityAreaId?: string | null;
  action: CapabilityAction | (string & {});
  resourceScope?: string;
  validFrom: Date | string;
  validUntil: Date | string;
  sourceDocumentNumber: string;
  reason?: string;
  notes?: string;
  scopeRules?: CreateDelegationScopeRuleInput[];
}

export interface RevokeDelegationGrantInput {
  delegationId: string;
  reason?: string;
}

export interface ListDelegationsFilter {
  grantorUserId?: string;
  granteeUserId?: string;
  grantorAssignmentId?: string;
  granteeAssignmentId?: string;
  status?: DelegationStatus;
  action?: string;
  activeAt?: Date | string;
}

export class DelegationGrantService {
  /**
   * 1. Create a new DelegationGrant with rigorous statutory and safety checks.
   */
  static async createDelegation(
    actor: AuthenticatedUserContext | SessionPayload,
    input: CreateDelegationGrantInput
  ): Promise<DelegationGrant & { scopeRules: DelegationScopeRule[] }> {
    const user = await resolveUserContext(actor);

    // 1. Fetch grantor assignment
    const grantorAssignment = await prisma.positionAssignment.findUnique({
      where: { id: input.grantorAssignmentId },
      include: {
        positionDefinition: true,
        unit: true,
        user: true,
        portfolios: {
          include: { responsibilityArea: true },
        },
      },
    });
    if (!grantorAssignment) {
      throw new NotFoundError(`Không tìm thấy quyết định bổ nhiệm của người ủy quyền: ${input.grantorAssignmentId}`);
    }

    // 2. Fetch grantee assignment
    const granteeAssignment = await prisma.positionAssignment.findUnique({
      where: { id: input.granteeAssignmentId },
      include: {
        positionDefinition: true,
        unit: true,
        user: true,
      },
    });
    if (!granteeAssignment) {
      throw new NotFoundError(`Không tìm thấy quyết định bổ nhiệm của người được ủy quyền: ${input.granteeAssignmentId}`);
    }

    // INVARIANT 1: Anti-Self-Delegation
    if (grantorAssignment.userId === granteeAssignment.userId) {
      throw new ValidationError("Không thể tự ủy quyền cho chính mình (Vi phạm nguyên tắc phân công độc lập Anti-Self-Delegation)");
    }

    // INVARIANT 2: Grantor active and valid
    const now = new Date();
    if (
      grantorAssignment.status !== AssignmentStatus.ACTIVE ||
      grantorAssignment.effectiveFrom > now ||
      (grantorAssignment.effectiveTo && grantorAssignment.effectiveTo < now) ||
      grantorAssignment.unit.status !== UnitStatus.ACTIVE
    ) {
      throw new ValidationError("Người ủy quyền hiện không có chức vụ hoặc đơn vị công tác có hiệu lực để thực hiện ủy quyền");
    }

    // INVARIANT 3: Grantee active and valid
    if (
      granteeAssignment.status !== AssignmentStatus.ACTIVE ||
      granteeAssignment.effectiveFrom > now ||
      (granteeAssignment.effectiveTo && granteeAssignment.effectiveTo < now) ||
      granteeAssignment.unit.status !== UnitStatus.ACTIVE
    ) {
      throw new ValidationError("Người được ủy quyền hiện không có chức danh hoặc đơn vị công tác có hiệu lực để tiếp nhận ủy quyền");
    }

    // INVARIANT 4: Non-Delegable Capabilities
    if (NON_DELEGABLE_CAPABILITIES.includes(input.action as CapabilityAction)) {
      throw new ValidationError(
        `Hành động '${input.action}' thuộc danh mục thẩm quyền luật định TUYỆT ĐỐI KHÔNG ĐƯỢC PHÉP ỦY QUYỀN theo quy định pháp luật và Điều lệ Trường`
      );
    }

    // INVARIANT 5: Authority Check (Grantor must hold the responsibility area or be executive leadership)
    if (input.responsibilityAreaId) {
      const hasPortfolio = grantorAssignment.portfolios.some(
        (p) =>
          p.responsibilityAreaId === input.responsibilityAreaId &&
          (!p.effectiveTo || p.effectiveTo >= now)
      );

      const isExecutiveLeadership = grantorAssignment.positionDefinition.isLeadership;

      if (!hasPortfolio && !isExecutiveLeadership) {
        throw new ForbiddenError(
          "Người ủy quyền không phụ trách mảng trách nhiệm này, không có thẩm quyền ký văn bản ủy quyền"
        );
      }
    }

    // INVARIANT 6: Validity Window
    const validFrom = new Date(input.validFrom);
    const validUntil = new Date(input.validUntil);
    if (isNaN(validFrom.getTime()) || isNaN(validUntil.getTime())) {
      throw new ValidationError("Thời hạn ủy quyền (validFrom, validUntil) không hợp lệ");
    }
    if (validUntil <= validFrom) {
      throw new ValidationError("Thời điểm kết thúc ủy quyền (validUntil) phải sau ngày bắt đầu ủy quyền (validFrom)");
    }

    // INVARIANT 7: Legal Document Reference
    const sourceDocNumber = input.sourceDocumentNumber?.trim();
    if (!sourceDocNumber) {
      throw new ValidationError("Bắt buộc phải có số văn bản / quyết định ủy quyền (sourceDocumentNumber) theo Nghị định 30/2020/NĐ-CP");
    }

    // INVARIANT 8: Anti-Circular Delegation Detection
    await DelegationGrantService.detectCircularDelegation(
      input.grantorAssignmentId,
      input.granteeAssignmentId,
      input.action,
      validFrom,
      validUntil
    );

    // INVARIANT 9: Overlapping Delegation Conflict Detection
    const overlapping = await prisma.delegationGrant.findFirst({
      where: {
        grantorAssignmentId: input.grantorAssignmentId,
        granteeAssignmentId: input.granteeAssignmentId,
        action: input.action,
        status: DelegationStatus.ACTIVE,
        validFrom: { lte: validUntil },
        validUntil: { gte: validFrom },
      },
    });
    if (overlapping) {
      throw new ConflictError(
        `Đã tồn tại giấy ủy quyền có hiệu lực trùng lặp (ID: ${overlapping.id}) cho cùng người nhận và hành động trong khoảng thời gian này`
      );
    }

    // Authorization check: Actor must be the grantor user or an institutional admin
    if (user.id !== grantorAssignment.userId && user.systemRole !== "ADMIN") {
      const resource: AuthorizationResource = {
        type: "delegation_grant",
        id: "new",
        owningUnitId: grantorAssignment.unitId,
      };
      await assertAuthorized(user, "org.manage", resource);
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Create DelegationGrant
      const grant = await tx.delegationGrant.create({
        data: {
          grantorAssignmentId: input.grantorAssignmentId,
          granteeAssignmentId: input.granteeAssignmentId,
          responsibilityAreaId: input.responsibilityAreaId || null,
          action: input.action,
          resourceScope: input.resourceScope || "UNIT",
          validFrom,
          validUntil,
          sourceDocumentNumber: sourceDocNumber,
          reason: input.reason || null,
          status: validFrom > now ? DelegationStatus.PENDING : DelegationStatus.ACTIVE,
        },
      });

      // 2. Create scope rules if provided
      const scopeRules: DelegationScopeRule[] = [];
      if (input.scopeRules && input.scopeRules.length > 0) {
        for (const rule of input.scopeRules) {
          const createdRule = await tx.delegationScopeRule.create({
            data: {
              delegationGrantId: grant.id,
              entityType: rule.entityType,
              entityId: rule.entityId || null,
              constraintType: rule.constraintType,
            },
          });
          scopeRules.push(createdRule);
        }
      }

      // 3. Two-Way Cache Invalidation
      authorizationContextCache.invalidateAuthorizationContextCache(grantorAssignment.userId);
      authorizationContextCache.invalidateAuthorizationContextCache(granteeAssignment.userId);

      // 4. Audit Log
      await auditService.logEvent(tx, {
        actorId: user.id,
        action: AuditAction.DELEGATION_CREATED || "DELEGATION_CREATED",
        entityType: AuditEntityType.DELEGATION_GRANT || "DelegationGrant",
        entityId: grant.id,
        afterData: {
          grantor: grantorAssignment.user.name,
          grantee: granteeAssignment.user.name,
          action: grant.action,
          sourceDocumentNumber: grant.sourceDocumentNumber,
          validFrom,
          validUntil,
        },
      });

      // 5. Outbox Event
      await publishOutboxEvent(tx, {
        eventType: "DELEGATION_CREATED_NOTIFICATION",
        aggregateType: "DelegationGrant",
        aggregateId: grant.id,
        payload: {
          delegationId: grant.id,
          grantorUserId: grantorAssignment.userId,
          granteeUserId: granteeAssignment.userId,
          action: grant.action,
          validFrom,
          validUntil,
          sourceDocumentNumber: grant.sourceDocumentNumber,
        },
      });

      return { ...grant, scopeRules };
    });
  }

  /**
   * 2. Revoke an active delegation grant.
   */
  static async revokeDelegation(
    actor: AuthenticatedUserContext | SessionPayload,
    input: RevokeDelegationGrantInput
  ): Promise<DelegationGrant> {
    const user = await resolveUserContext(actor);

    const grant = await prisma.delegationGrant.findUnique({
      where: { id: input.delegationId },
      include: {
        grantorAssignment: { include: { user: true } },
        granteeAssignment: { include: { user: true } },
      },
    });
    if (!grant) {
      throw new NotFoundError(`Không tìm thấy quyết định ủy quyền: ${input.delegationId}`);
    }

    if (grant.status !== DelegationStatus.ACTIVE && grant.status !== DelegationStatus.PENDING) {
      throw new ValidationError(`Quyết định ủy quyền đã ở trạng thái ${grant.status}, không thể thu hồi`);
    }

    // Actor must be the grantor or an institutional admin
    if (user.id !== grant.grantorAssignment.userId && user.systemRole !== "ADMIN") {
      const resource: AuthorizationResource = {
        type: "delegation_grant",
        id: grant.id,
        owningUnitId: grant.grantorAssignment.unitId,
      };
      await assertAuthorized(user, "org.manage", resource);
    }

    const now = new Date();

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.delegationGrant.update({
        where: { id: grant.id },
        data: {
          status: DelegationStatus.REVOKED,
          revokedAt: now,
          revokedReason: input.reason || "Thu hồi ủy quyền theo yêu cầu của cấp có thẩm quyền",
        },
      });

      // Two-Way Cache Invalidation
      authorizationContextCache.invalidateAuthorizationContextCache(grant.grantorAssignment.userId);
      authorizationContextCache.invalidateAuthorizationContextCache(grant.granteeAssignment.userId);

      // Audit Log
      await auditService.logEvent(tx, {
        actorId: user.id,
        action: AuditAction.DELEGATION_REVOKED || "DELEGATION_REVOKED",
        entityType: AuditEntityType.DELEGATION_GRANT || "DelegationGrant",
        entityId: grant.id,
        beforeData: { status: grant.status },
        afterData: {
          status: updated.status,
          revokedAt: now,
          revokedReason: updated.revokedReason,
        },
      });

      // Outbox Event
      await publishOutboxEvent(tx, {
        eventType: "DELEGATION_REVOKED_NOTIFICATION",
        aggregateType: "DelegationGrant",
        aggregateId: grant.id,
        payload: {
          delegationId: grant.id,
          grantorUserId: grant.grantorAssignment.userId,
          granteeUserId: grant.granteeAssignment.userId,
          revokedAt: now,
          reason: updated.revokedReason,
        },
      });

      return updated;
    });
  }

  /**
   * 3. Helper: Detect Circular Delegation Chains.
   * Checks both:
   * - Direct inverse delegation (Grantee already has an active delegation to Grantor)
   * - Transitive cycle (Grantee -> ... -> Grantor)
   */
  private static async detectCircularDelegation(
    grantorAssignmentId: string,
    granteeAssignmentId: string,
    action: string,
    validFrom?: Date,
    validUntil?: Date
  ): Promise<void> {
    const timeFilter = validFrom && validUntil
      ? { validFrom: { lte: validUntil }, validUntil: { gte: validFrom } }
      : { validUntil: { gte: new Date() } };

    // 1. Direct inverse check
    const directInverse = await prisma.delegationGrant.findFirst({
      where: {
        grantorAssignmentId: granteeAssignmentId,
        granteeAssignmentId: grantorAssignmentId,
        status: DelegationStatus.ACTIVE,
        action,
        ...timeFilter,
      },
    });

    if (directInverse) {
      throw new ConflictError(
        "Phát hiện xung đột ủy quyền vòng tròn: Người nhận ủy quyền hiện đang ủy quyền lại hành động này cho người ủy quyền"
      );
    }

    // 2. Transitive graph search using BFS to detect multi-hop cycles
    // Start from granteeAssignmentId, see if we can reach grantorAssignmentId via active delegations for the action
    const visited = new Set<string>();
    const queue: string[] = [granteeAssignmentId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === grantorAssignmentId) {
        throw new ConflictError(
          "Phát hiện xung đột ủy quyền vòng tròn: Phát hiện xung đột vòng lặp ủy quyền nhiều cấp (Transitive Circular Delegation Chain). Không thể thiết lập ủy quyền vòng tròn."
        );
      }

      visited.add(current);

      const activeOutwardGrants = await prisma.delegationGrant.findMany({
        where: {
          grantorAssignmentId: current,
          status: DelegationStatus.ACTIVE,
          action,
          ...timeFilter,
        },
        select: { granteeAssignmentId: true },
      });

      for (const nextGrant of activeOutwardGrants) {
        if (!visited.has(nextGrant.granteeAssignmentId)) {
          queue.push(nextGrant.granteeAssignmentId);
        }
      }
    }
  }

  /**
   * Query active delegations at a specific point in time.
   */
  static async getActiveDelegationsAt(
    atDate: Date | string,
    filter: {
      grantorAssignmentId?: string;
      granteeAssignmentId?: string;
      grantorUserId?: string;
      granteeUserId?: string;
      action?: string;
    } = {}
  ): Promise<DelegationGrant[]> {
    const at = new Date(atDate);
    const where: Prisma.DelegationGrantWhereInput = {
      status: DelegationStatus.ACTIVE,
      validFrom: { lte: at },
      validUntil: { gte: at },
    };
    if (filter.grantorAssignmentId) where.grantorAssignmentId = filter.grantorAssignmentId;
    if (filter.granteeAssignmentId) where.granteeAssignmentId = filter.granteeAssignmentId;
    if (filter.grantorUserId) where.grantorAssignment = { userId: filter.grantorUserId };
    if (filter.granteeUserId) where.granteeAssignment = { userId: filter.granteeUserId };
    if (filter.action) where.action = filter.action;

    return await prisma.delegationGrant.findMany({
      where,
      include: {
        grantorAssignment: { include: { user: true, positionDefinition: true, unit: true } },
        granteeAssignment: { include: { user: true, positionDefinition: true, unit: true } },
      },
      orderBy: { validFrom: "asc" },
    });
  }

  /**
   * 4. Auto-expire delegations whose validity period has elapsed.
   */
  static async autoExpireDelegations(): Promise<number> {
    const now = new Date();

    const expiredGrants = await prisma.delegationGrant.findMany({
      where: {
        status: DelegationStatus.ACTIVE,
        validUntil: { lt: now },
      },
      include: {
        grantorAssignment: { select: { userId: true } },
        granteeAssignment: { select: { userId: true } },
      },
    });

    if (expiredGrants.length === 0) {
      return 0;
    }

    await prisma.delegationGrant.updateMany({
      where: {
        id: { in: expiredGrants.map((g) => g.id) },
      },
      data: {
        status: DelegationStatus.EXPIRED,
      },
    });

    for (const grant of expiredGrants) {
      authorizationContextCache.invalidateAuthorizationContextCache(grant.grantorAssignment.userId);
      authorizationContextCache.invalidateAuthorizationContextCache(grant.granteeAssignment.userId);
    }

    return expiredGrants.length;
  }

  /**
   * 5. Query active delegations for a specific user.
   */
  static async getActiveDelegationsForUser(
    userId: string,
    action?: string
  ): Promise<DelegationGrant[]> {
    const now = new Date();

    const where: Prisma.DelegationGrantWhereInput = {
      granteeAssignment: { userId },
      status: DelegationStatus.ACTIVE,
      validFrom: { lte: now },
      validUntil: { gte: now },
    };

    if (action) {
      where.action = action;
    }

    return await prisma.delegationGrant.findMany({
      where,
      include: {
        grantorAssignment: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            positionDefinition: true,
            unit: true,
          },
        },
        responsibilityArea: true,
        scopeRules: true,
      },
    });
  }

  /**
   * 6. List and filter delegations.
   */
  static async listDelegations(filter: ListDelegationsFilter = {}): Promise<DelegationGrant[]> {
    const where: Prisma.DelegationGrantWhereInput = {};

    if (filter.grantorUserId) {
      where.grantorAssignment = { userId: filter.grantorUserId };
    }
    if (filter.granteeUserId) {
      where.granteeAssignment = { userId: filter.granteeUserId };
    }
    if (filter.grantorAssignmentId) {
      where.grantorAssignmentId = filter.grantorAssignmentId;
    }
    if (filter.granteeAssignmentId) {
      where.granteeAssignmentId = filter.granteeAssignmentId;
    }
    if (filter.status) {
      where.status = filter.status;
    }
    if (filter.action) {
      where.action = filter.action;
    }
    if (filter.activeAt) {
      const at = new Date(filter.activeAt);
      where.validFrom = { lte: at };
      where.validUntil = { gte: at };
    }

    return await prisma.delegationGrant.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        grantorAssignment: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            positionDefinition: true,
            unit: true,
          },
        },
        granteeAssignment: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            positionDefinition: true,
            unit: true,
          },
        },
        responsibilityArea: true,
        scopeRules: true,
      },
    });
  }

  /**
   * 7. Get single delegation by ID.
   */
  static async getDelegationById(id: string): Promise<DelegationGrant | null> {
    return await prisma.delegationGrant.findUnique({
      where: { id },
      include: {
        grantorAssignment: {
          include: {
            user: true,
            positionDefinition: true,
            unit: true,
          },
        },
        granteeAssignment: {
          include: {
            user: true,
            positionDefinition: true,
            unit: true,
          },
        },
        responsibilityArea: true,
        scopeRules: true,
      },
    });
  }
}
