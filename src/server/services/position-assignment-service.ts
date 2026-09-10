/**
 * QCET E-Office: Canonical Position & Assignment Management Service
 * Sprint 6 - Workstream 6.2 (Organization Administration & Dossier)
 *
 * Invariants Enforced:
 * 1. Distinction between PositionDefinition (chức danh tiêu chuẩn) and PositionAssignment (bổ nhiệm cụ thể).
 * 2. Effective-dating: Assignments have effectiveFrom, effectiveTo, and status (ACTIVE, SUPERSEDED, TERMINATED, EXPIRED).
 * 3. Primary Assignment Uniqueness: A staff member can only have ONE active PRIMARY assignment at any point in time.
 * 4. Transfer Lifecycle: Transferring an assignment atomically supersedes the previous appointment and terminates bound delegations.
 * 5. 11 Responsibility Areas (QĐ 420): Idempotently managed and assigned via PortfolioAssignment.
 * 6. Audit & Cache Consistency: All assignment mutations invalidate AuthorizationContextCache and write immutable audit logs.
 */

import { prisma } from "@/lib/prisma";
import type {
  PositionDefinition,
  PositionAssignment,
  PortfolioAssignment,
  ResponsibilityArea,
  Prisma,
} from "@prisma/client";
import {
  AssignmentType,
  AssignmentStatus,
  JobCatalogGroup,
  UnitStatus,
  ResponsibilityCategory,
  DelegationStatus,
} from "@prisma/client";
import {
  assertAuthorized,
  type AuthenticatedUserContext,
  type AuthorizationResource,
} from "@/lib/auth/hybrid-authorization";
import { resolveUserContext } from "@/lib/services/incoming-document-service";
import { auditService, AuditAction, AuditEntityType } from "@/lib/db/audit";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  ForbiddenError,
} from "@/server/api/errors";
import type { SessionPayload } from "@/lib/jwt-session";
import { authorizationContextCache } from "@/server/authorization/authorization-context-cache";
import { CANONICAL_RESPONSIBILITY_AREAS } from "../../../prisma/seeds/canonical-org-seed";

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface CreatePositionDefinitionInput {
  code: string;
  title: string;
  group: JobCatalogGroup;
  minLevel?: number;
  isLeadership?: boolean;
  dacumJobCatalogId?: string | null;
}

export interface UpdatePositionDefinitionInput {
  title?: string;
  group?: JobCatalogGroup;
  minLevel?: number;
  isLeadership?: boolean;
  dacumJobCatalogId?: string | null;
}

export interface AppointPositionInput {
  userId: string;
  positionDefinitionId: string;
  unitId: string;
  type?: AssignmentType;
  effectiveFrom?: Date | string;
  effectiveTo?: Date | string | null;
  sourceDecisionNumber: string;
  notes?: string;
}

export interface TransferAssignmentInput {
  currentAssignmentId: string;
  newUnitId: string;
  newPositionDefinitionId: string;
  newType?: AssignmentType;
  effectiveDate?: Date | string;
  transferDate?: Date | string;
  sourceDecisionNumber?: string;
  decisionNumber?: string;
  notes?: string;
  reason?: string;
}

export interface TerminateAssignmentInput {
  assignmentId: string;
  effectiveTo?: Date | string;
  endDate?: Date | string;
  status?: AssignmentStatus;
  reason?: string;
  sourceDecisionNumber?: string;
  decisionNumber?: string;
}

export interface AssignPortfolioInput {
  positionAssignmentId: string;
  responsibilityAreaId: string;
  effectiveFrom?: Date | string;
  effectiveTo?: Date | string | null;
  sourceDecisionNumber?: string;
  notes?: string;
}

export interface ListAssignmentsFilter {
  userId?: string;
  unitId?: string;
  positionDefinitionId?: string;
  status?: AssignmentStatus;
  type?: AssignmentType;
  atDate?: Date | string;
}

export class PositionAssignmentService {
  // ============================================================================
  // 1. POSITION DEFINITION (CHỨC DANH TIÊU CHUẨN)
  // ============================================================================

  /**
   * Create standard PositionDefinition.
   */
  static async createPositionDefinition(
    actor: AuthenticatedUserContext | SessionPayload,
    input: CreatePositionDefinitionInput
  ): Promise<PositionDefinition> {
    const user = await resolveUserContext(actor);

    const resource: AuthorizationResource = {
      type: "position_definition",
      id: "new",
      createdById: user.id,
    };
    await assertAuthorized(user, "position.manage", resource);

    const code = input.code?.trim().toUpperCase();
    if (!code) {
      throw new ValidationError("Mã chức danh không được để trống");
    }

    const title = input.title?.trim();
    if (!title) {
      throw new ValidationError("Tên chức vụ / chức danh không được để trống");
    }

    if (!input.group) {
      throw new ValidationError("Nhóm vị trí việc làm (JobCatalogGroup) không được để trống");
    }

    const existing = await prisma.positionDefinition.findUnique({
      where: { code },
    });
    if (existing) {
      throw new ConflictError(`Mã chức danh '${code}' đã tồn tại`);
    }

    return await prisma.$transaction(async (tx) => {
      const posDef = await tx.positionDefinition.create({
        data: {
          code,
          title,
          group: input.group,
          minLevel: input.minLevel ?? 1,
          isLeadership: input.isLeadership ?? false,
          dacumJobCatalogId: input.dacumJobCatalogId || null,
        },
      });

      await auditService.logEvent(tx, {
        actorId: user.id,
        action: "POSITION_DEFINITION_CREATED",
        entityType: "PositionDefinition",
        entityId: posDef.id,
        afterData: {
          code: posDef.code,
          title: posDef.title,
          group: posDef.group,
          isLeadership: posDef.isLeadership,
        },
      });

      return posDef;
    });
  }

  /**
   * Update PositionDefinition.
   */
  static async updatePositionDefinition(
    actor: AuthenticatedUserContext | SessionPayload,
    id: string,
    input: UpdatePositionDefinitionInput
  ): Promise<PositionDefinition> {
    const user = await resolveUserContext(actor);

    const existing = await prisma.positionDefinition.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundError(`Không tìm thấy chức danh: ${id}`);
    }

    const resource: AuthorizationResource = {
      type: "position_definition",
      id,
    };
    await assertAuthorized(user, "position.manage", resource);

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.positionDefinition.update({
        where: { id },
        data: {
          title: input.title?.trim() || existing.title,
          group: input.group || existing.group,
          minLevel: input.minLevel !== undefined ? input.minLevel : existing.minLevel,
          isLeadership: input.isLeadership !== undefined ? input.isLeadership : existing.isLeadership,
          dacumJobCatalogId: input.dacumJobCatalogId !== undefined ? input.dacumJobCatalogId : existing.dacumJobCatalogId,
        },
      });

      await auditService.logEvent(tx, {
        actorId: user.id,
        action: "POSITION_DEFINITION_UPDATED",
        entityType: "PositionDefinition",
        entityId: id,
        beforeData: { title: existing.title, isLeadership: existing.isLeadership },
        afterData: { title: updated.title, isLeadership: updated.isLeadership },
      });

      return updated;
    });
  }

  // ============================================================================
  // 2. POSITION ASSIGNMENT (QUYẾT ĐỊNH BỔ NHIỆM CỤ THỂ)
  // ============================================================================

  /**
   * Appoint user to a specific position in an organizational unit.
   * Enforces:
   * - Staff must exist and be active.
   * - Unit must be ACTIVE.
   * - If type is PRIMARY, checks for existing active PRIMARY assignment conflict.
   * - Source decision number is required.
   */
  static async appointPosition(
    actor: AuthenticatedUserContext | SessionPayload,
    input: AppointPositionInput
  ): Promise<PositionAssignment> {
    const user = await resolveUserContext(actor);

    // 1. Check user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: input.userId },
    });
    if (!targetUser) {
      throw new NotFoundError(`Không tìm thấy cán bộ: ${input.userId}`);
    }
    if (!targetUser.isActive) {
      throw new ValidationError(`Cán bộ '${targetUser.name}' đang bị vô hiệu hóa, không thể bổ nhiệm`);
    }

    // 2. Check position definition
    const posDef = await prisma.positionDefinition.findUnique({
      where: { id: input.positionDefinitionId },
    });
    if (!posDef) {
      throw new NotFoundError(`Không tìm thấy chức danh: ${input.positionDefinitionId}`);
    }

    // 3. Check unit
    const unit = await prisma.organizationalUnit.findUnique({
      where: { id: input.unitId },
    });
    if (!unit) {
      throw new NotFoundError(`Không tìm thấy đơn vị tổ chức: ${input.unitId}`);
    }
    if (unit.status !== UnitStatus.ACTIVE) {
      throw new ValidationError(`Đơn vị '${unit.name}' không ở trạng thái ACTIVE (hiện tại: ${unit.status})`);
    }

    // Authorization check
    const reqCapability = posDef.isLeadership ? "position.manage_leadership" : "position.manage";
    const resource: AuthorizationResource = {
      type: "position_assignment",
      id: "new",
      owningUnitId: unit.id,
    };
    await assertAuthorized(user, reqCapability, resource);

    // Validate decision number
    const decisionNumber = input.sourceDecisionNumber?.trim();
    if (!decisionNumber) {
      throw new ValidationError("Số quyết định bổ nhiệm (sourceDecisionNumber) là bắt buộc theo quy định công vụ");
    }

    const assignmentType = input.type || AssignmentType.PRIMARY;
    const effectiveFrom = input.effectiveFrom ? new Date(input.effectiveFrom) : new Date();
    const effectiveTo = input.effectiveTo ? new Date(input.effectiveTo) : null;

    if (effectiveTo && effectiveTo <= effectiveFrom) {
      throw new ValidationError("Ngày kết thúc nhiệm kỳ (effectiveTo) phải sau ngày có hiệu lực (effectiveFrom)");
    }

    // Primary Assignment Invariant: Only ONE active PRIMARY assignment at any time
    if (assignmentType === AssignmentType.PRIMARY) {
      const activePrimary = await prisma.positionAssignment.findFirst({
        where: {
          userId: input.userId,
          type: AssignmentType.PRIMARY,
          status: AssignmentStatus.ACTIVE,
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: effectiveFrom } },
          ],
        },
        include: { positionDefinition: true, unit: true },
      });

      if (activePrimary) {
        throw new ConflictError(
          `Cán bộ '${targetUser.name}' đã có chức vụ chính (PRIMARY): '${activePrimary.positionDefinition.title}' tại '${activePrimary.unit.name}'. Để thay đổi chức vụ chính, vui lòng thực hiện quy trình Điều động công tác (transferAssignment) hoặc Miễn nhiệm chức vụ cũ.`
        );
      }
    }

    return await prisma.$transaction(async (tx) => {
      const assignment = await tx.positionAssignment.create({
        data: {
          userId: input.userId,
          positionDefinitionId: input.positionDefinitionId,
          unitId: input.unitId,
          type: assignmentType,
          status: AssignmentStatus.ACTIVE,
          effectiveFrom,
          effectiveTo,
          sourceDecisionNumber: decisionNumber,
        },
        include: {
          positionDefinition: true,
          unit: true,
          user: true,
        },
      });

      // Invalidate context cache for target user
      authorizationContextCache.invalidateAuthorizationContextCache(input.userId);

      // Audit event
      await auditService.logEvent(tx, {
        actorId: user.id,
        action: AuditAction.USER_ROLE_CHANGED || "POSITION_ASSIGNMENT_CREATED",
        entityType: "PositionAssignment",
        entityId: assignment.id,
        afterData: {
          userId: assignment.userId,
          position: posDef.title,
          unit: unit.name,
          type: assignment.type,
          sourceDecisionNumber: decisionNumber,
          effectiveFrom,
        },
      });

      return assignment;
    });
  }

  /**
   * Transfer assignment (Điều động công tác).
   * Atomically:
   * 1. Marks current assignment as SUPERSEDED with effectiveTo = effectiveDate.
   * 2. Auto-revokes any active delegations granted under the old assignment.
   * 3. Creates the new assignment starting from effectiveDate.
   * 4. Invalidates cache and records audit history.
   */
  static async transferAssignment(
    actor: AuthenticatedUserContext | SessionPayload,
    input: TransferAssignmentInput
  ): Promise<{ previousAssignment: PositionAssignment; newAssignment: PositionAssignment; oldAssignment: PositionAssignment }> {
    const user = await resolveUserContext(actor);

    const current = await prisma.positionAssignment.findUnique({
      where: { id: input.currentAssignmentId },
      include: { positionDefinition: true, unit: true, user: true },
    });
    if (!current) {
      throw new NotFoundError(`Không tìm thấy quyết định bổ nhiệm hiện tại: ${input.currentAssignmentId}`);
    }
    if (current.status !== AssignmentStatus.ACTIVE) {
      throw new ValidationError(`Quyết định bổ nhiệm hiện tại không ở trạng thái ACTIVE (hiện tại: ${current.status})`);
    }

    const newUnit = await prisma.organizationalUnit.findUnique({
      where: { id: input.newUnitId },
    });
    if (!newUnit) {
      throw new NotFoundError(`Không tìm thấy đơn vị tổ chức mới: ${input.newUnitId}`);
    }
    if (newUnit.status !== UnitStatus.ACTIVE) {
      throw new ValidationError(`Đơn vị mới '${newUnit.name}' đang ở trạng thái ${newUnit.status}`);
    }

    const newPosDef = await prisma.positionDefinition.findUnique({
      where: { id: input.newPositionDefinitionId },
    });
    if (!newPosDef) {
      throw new NotFoundError(`Không tìm thấy chức danh mới: ${input.newPositionDefinitionId}`);
    }

    const reqCap = (current.positionDefinition.isLeadership || newPosDef.isLeadership)
      ? "position.manage_leadership"
      : "position.manage";
    const resource: AuthorizationResource = {
      type: "position_assignment",
      id: current.id,
      owningUnitId: current.unitId,
    };
    await assertAuthorized(user, reqCap, resource);

    const decisionNumber = (input.sourceDecisionNumber || input.decisionNumber)?.trim();
    if (!decisionNumber) {
      throw new ValidationError("Số quyết định điều động (sourceDecisionNumber) là bắt buộc");
    }

    const rawDate = input.transferDate || input.effectiveDate || new Date();
    const transferDate = new Date(rawDate);

    return await prisma.$transaction(async (tx) => {
      // 1. Supersede previous assignment
      const previousAssignment = await tx.positionAssignment.update({
        where: { id: current.id },
        data: {
          status: AssignmentStatus.SUPERSEDED,
          effectiveTo: transferDate,
        },
      });

      // 2. Terminate bound delegation grants originating from the old assignment
      const activeGrants = await tx.delegationGrant.findMany({
        where: {
          grantorAssignmentId: current.id,
          status: DelegationStatus.ACTIVE,
        },
      });

      if (activeGrants.length > 0) {
        await tx.delegationGrant.updateMany({
          where: {
            grantorAssignmentId: current.id,
            status: DelegationStatus.ACTIVE,
          },
          data: {
            status: DelegationStatus.REVOKED,
            revokedAt: transferDate,
            revokedReason: `Tự động chấm dứt do cán bộ được điều động sang vị trí mới theo QĐ ${decisionNumber}`,
          },
        });
      }

      // 3. Create new assignment
      const newAssignment = await tx.positionAssignment.create({
        data: {
          userId: current.userId,
          positionDefinitionId: input.newPositionDefinitionId,
          unitId: input.newUnitId,
          type: input.newType || current.type,
          status: AssignmentStatus.ACTIVE,
          effectiveFrom: transferDate,
          sourceDecisionNumber: decisionNumber,
        },
        include: {
          positionDefinition: true,
          unit: true,
        },
      });

      // 4. Invalidate authorization cache
      authorizationContextCache.invalidateAuthorizationContextCache(current.userId);

      // 5. Audit Log
      await auditService.logEvent(tx, {
        actorId: user.id,
        action: "POSITION_ASSIGNMENT_TRANSFERRED",
        entityType: "PositionAssignment",
        entityId: newAssignment.id,
        beforeData: {
          previousAssignmentId: current.id,
          previousUnit: current.unit.name,
          previousPosition: current.positionDefinition.title,
        },
        afterData: {
          newAssignmentId: newAssignment.id,
          newUnit: newUnit.name,
          newPosition: newPosDef.title,
          decisionNumber,
          transferDate,
        },
      });

      return { previousAssignment, newAssignment, oldAssignment: previousAssignment };
    });
  }

  /**
   * Terminate assignment (Miễn nhiệm / Kết thúc nhiệm kỳ).
   */
  static async terminateAssignment(
    actor: AuthenticatedUserContext | SessionPayload,
    input: TerminateAssignmentInput
  ): Promise<PositionAssignment> {
    const user = await resolveUserContext(actor);

    const assignment = await prisma.positionAssignment.findUnique({
      where: { id: input.assignmentId },
      include: { positionDefinition: true, unit: true },
    });
    if (!assignment) {
      throw new NotFoundError(`Không tìm thấy quyết định bổ nhiệm: ${input.assignmentId}`);
    }
    if (assignment.status !== AssignmentStatus.ACTIVE) {
      throw new ValidationError(`Quyết định bổ nhiệm không ở trạng thái ACTIVE (hiện tại: ${assignment.status})`);
    }

    const reqCap = assignment.positionDefinition.isLeadership
      ? "position.manage_leadership"
      : "position.manage";
    const resource: AuthorizationResource = {
      type: "position_assignment",
      id: assignment.id,
      owningUnitId: assignment.unitId,
    };
    await assertAuthorized(user, reqCap, resource);

    const termDate = input.endDate
      ? new Date(input.endDate)
      : (input.effectiveTo ? new Date(input.effectiveTo) : new Date());
    const finalStatus = input.status || AssignmentStatus.TERMINATED;

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.positionAssignment.update({
        where: { id: input.assignmentId },
        data: {
          status: finalStatus,
          effectiveTo: termDate,
        },
      });

      // Auto-revoke active delegations granted by this assignment
      await tx.delegationGrant.updateMany({
        where: {
          grantorAssignmentId: assignment.id,
          status: DelegationStatus.ACTIVE,
        },
        data: {
          status: DelegationStatus.REVOKED,
          revokedAt: termDate,
          revokedReason: input.reason || "Tự động thu hồi do cán bộ kết thúc nhiệm kỳ công tác",
        },
      });

      authorizationContextCache.invalidateAuthorizationContextCache(assignment.userId);

      await auditService.logEvent(tx, {
        actorId: user.id,
        action: "POSITION_ASSIGNMENT_TERMINATED",
        entityType: "PositionAssignment",
        entityId: assignment.id,
        beforeData: { status: assignment.status },
        afterData: {
          status: finalStatus,
          effectiveTo: termDate,
          reason: input.reason,
          sourceDecisionNumber: input.sourceDecisionNumber,
        },
      });

      return updated;
    });
  }

  // ============================================================================
  // 3. RESPONSIBILITY AREA & PORTFOLIO (11 MẢNG PHỤ TRÁCH QĐ 420)
  // ============================================================================

  /**
   * Idempotently ensure the 11 canonical responsibility areas from QĐ 420 exist.
   */
  static async ensureCanonicalResponsibilityAreas(): Promise<ResponsibilityArea[]> {
    const results: ResponsibilityArea[] = [];

    for (const area of CANONICAL_RESPONSIBILITY_AREAS) {
      const record = await prisma.responsibilityArea.upsert({
        where: { code: area.code },
        update: {
          name: area.name,
          description: area.description,
          category: area.category,
        },
        create: {
          code: area.code,
          name: area.name,
          description: area.description,
          category: area.category,
        },
      });
      results.push(record);
    }

    return results;
  }

  /**
   * Assign a ResponsibilityArea to a PositionAssignment (PortfolioAssignment).
   */
  static async assignPortfolio(
    actor: AuthenticatedUserContext | SessionPayload,
    input: AssignPortfolioInput
  ): Promise<PortfolioAssignment> {
    const user = await resolveUserContext(actor);

    const assignment = await prisma.positionAssignment.findUnique({
      where: { id: input.positionAssignmentId },
      include: { positionDefinition: true, user: true },
    });
    if (!assignment) {
      throw new NotFoundError(`Không tìm thấy quyết định bổ nhiệm: ${input.positionAssignmentId}`);
    }
    if (assignment.status !== AssignmentStatus.ACTIVE) {
      throw new ValidationError(`Không thể giao mảng phụ trách cho quyết định bổ nhiệm không ở trạng thái ACTIVE`);
    }

    const area = await prisma.responsibilityArea.findUnique({
      where: { id: input.responsibilityAreaId },
    });
    if (!area) {
      throw new NotFoundError(`Không tìm thấy mảng trách nhiệm: ${input.responsibilityAreaId}`);
    }

    const reqCap = assignment.positionDefinition.isLeadership
      ? "position.manage_leadership"
      : "position.manage";
    const resource: AuthorizationResource = {
      type: "portfolio_assignment",
      id: "new",
      owningUnitId: assignment.unitId,
    };
    await assertAuthorized(user, reqCap, resource);

    // Check duplicate portfolio
    const existing = await prisma.portfolioAssignment.findUnique({
      where: {
        assignment_responsibility_unique: {
          positionAssignmentId: input.positionAssignmentId,
          responsibilityAreaId: input.responsibilityAreaId,
        },
      },
    });
    if (existing) {
      throw new ConflictError(`Chức vụ này đã được giao mảng trách nhiệm '${area.name}'`);
    }

    const effectiveFrom = input.effectiveFrom ? new Date(input.effectiveFrom) : new Date();
    const effectiveTo = input.effectiveTo ? new Date(input.effectiveTo) : null;

    return await prisma.$transaction(async (tx) => {
      const portfolio = await tx.portfolioAssignment.create({
        data: {
          positionAssignmentId: input.positionAssignmentId,
          responsibilityAreaId: input.responsibilityAreaId,
          effectiveFrom,
          effectiveTo,
          sourceDecisionNumber: input.sourceDecisionNumber || "QĐ-420",
        },
        include: {
          responsibilityArea: true,
          positionAssignment: true,
        },
      });

      authorizationContextCache.invalidateAuthorizationContextCache(assignment.userId);

      await auditService.logEvent(tx, {
        actorId: user.id,
        action: "PORTFOLIO_ASSIGNED",
        entityType: "PortfolioAssignment",
        entityId: portfolio.id,
        afterData: {
          positionAssignmentId: assignment.id,
          responsibilityArea: area.name,
          code: area.code,
          effectiveFrom,
        },
      });

      return portfolio;
    });
  }

  /**
   * Terminate portfolio assignment.
   */
  static async terminatePortfolio(
    actor: AuthenticatedUserContext | SessionPayload,
    portfolioId: string,
    effectiveTo?: Date | string,
    reason?: string
  ): Promise<PortfolioAssignment> {
    const user = await resolveUserContext(actor);

    const portfolio = await prisma.portfolioAssignment.findUnique({
      where: { id: portfolioId },
      include: {
        positionAssignment: {
          include: { positionDefinition: true },
        },
        responsibilityArea: true,
      },
    });
    if (!portfolio) {
      throw new NotFoundError(`Không tìm thấy phân công phụ trách: ${portfolioId}`);
    }

    const reqCap = portfolio.positionAssignment.positionDefinition.isLeadership
      ? "position.manage_leadership"
      : "position.manage";
    const resource: AuthorizationResource = {
      type: "portfolio_assignment",
      id: portfolio.id,
      owningUnitId: portfolio.positionAssignment.unitId,
    };
    await assertAuthorized(user, reqCap, resource);

    const termDate = effectiveTo ? new Date(effectiveTo) : new Date();

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.portfolioAssignment.update({
        where: { id: portfolioId },
        data: { effectiveTo: termDate },
      });

      authorizationContextCache.invalidateAuthorizationContextCache(portfolio.positionAssignment.userId);

      await auditService.logEvent(tx, {
        actorId: user.id,
        action: "PORTFOLIO_TERMINATED",
        entityType: "PortfolioAssignment",
        entityId: portfolioId,
        beforeData: { effectiveTo: portfolio.effectiveTo },
        afterData: { effectiveTo: termDate, reason },
      });

      return updated;
    });
  }

  // ============================================================================
  // 4. QUERIES
  // ============================================================================

  static async getActiveAssignmentsAt(
    atDate: Date | string,
    filter: { userId?: string; unitId?: string; positionDefinitionId?: string } = {}
  ): Promise<PositionAssignment[]> {
    return await this.listAssignments({
      ...filter,
      atDate,
    });
  }

  static async listAssignments(filter: ListAssignmentsFilter = {}): Promise<PositionAssignment[]> {
    const where: Prisma.PositionAssignmentWhereInput = {};

    if (filter.userId) where.userId = filter.userId;
    if (filter.unitId) where.unitId = filter.unitId;
    if (filter.positionDefinitionId) where.positionDefinitionId = filter.positionDefinitionId;
    if (filter.type) where.type = filter.type;

    if (filter.atDate) {
      const at = new Date(filter.atDate);
      where.effectiveFrom = { lte: at };
      where.OR = [
        { effectiveTo: null, status: AssignmentStatus.ACTIVE },
        { effectiveTo: { gte: at } },
      ];
    } else if (filter.status) {
      where.status = filter.status;
    }

    return await prisma.positionAssignment.findMany({
      where,
      orderBy: [{ status: "asc" }, { effectiveFrom: "desc" }],
      include: {
        positionDefinition: true,
        unit: true,
        user: {
          select: { id: true, name: true, email: true },
        },
        portfolios: {
          include: { responsibilityArea: true },
        },
      },
    });
  }

  static async getAssignmentById(id: string): Promise<PositionAssignment | null> {
    return await prisma.positionAssignment.findUnique({
      where: { id },
      include: {
        positionDefinition: true,
        unit: true,
        user: true,
        portfolios: {
          include: { responsibilityArea: true },
        },
        delegationsGranted: {
          where: { status: DelegationStatus.ACTIVE },
        },
      },
    });
  }

  static async listResponsibilityAreas(): Promise<ResponsibilityArea[]> {
    return await prisma.responsibilityArea.findMany({
      orderBy: [{ category: "asc" }, { code: "asc" }],
    });
  }

  static async listPositionDefinitions(): Promise<PositionDefinition[]> {
    return await prisma.positionDefinition.findMany({
      orderBy: [{ isLeadership: "desc" }, { code: "asc" }],
    });
  }

  // Aliases for admin operations
  static async createAssignment(
    actor: AuthenticatedUserContext | SessionPayload,
    input: AppointPositionInput
  ): Promise<PositionAssignment> {
    return this.appointPosition(actor, input);
  }

  static async endAssignment(
    actor: AuthenticatedUserContext | SessionPayload,
    input: TerminateAssignmentInput
  ): Promise<PositionAssignment> {
    return this.terminateAssignment(actor, input);
  }
}
