/**
 * QCET E-Office: Canonical Organizational Unit & Structure Management Service
 * Sprint 6 - Workstream 6.1 (Organization Administration & Dossier)
 *
 * Invariants Enforced:
 * 1. Effective-dating: Units have effectiveFrom, effectiveTo, and status (ACTIVE, SUSPENDED, DISSOLVED...).
 * 2. Closure Table Consistency: UnitClosurePath maintains complete transitive hierarchy (depth 0, 1, 2...).
 * 3. Cycle & Self-Parenting Prevention: An organizational unit can NEVER be parented to itself or its own descendants.
 * 4. Hard-Delete Invariant: Prohibit hard-deleting any unit that has historical assignments, tasks, dossiers, or child units.
 * 5. Audit Logging: Every structural and metadata mutation is immutably recorded via auditService.
 */

import { prisma } from "@/lib/prisma";
import type { OrganizationalUnit, UnitClosurePath } from "@prisma/client";
import { Prisma, UnitType, UnitStatus } from "@prisma/client";
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

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface CreateUnitInput {
  code: string;
  name: string;
  type: UnitType;
  parentId?: string | null;
  status?: UnitStatus;
  effectiveFrom?: Date | string;
  effectiveTo?: Date | string | null;
  metadata?: Prisma.InputJsonValue;
}

export interface UpdateUnitInput {
  name?: string;
  type?: UnitType;
  metadata?: Prisma.InputJsonValue;
  effectiveFrom?: Date | string;
  effectiveTo?: Date | string | null;
}

export interface MoveUnitInput {
  unitId: string;
  newParentId: string | null;
  reason?: string;
}

export interface ListUnitsFilter {
  type?: UnitType;
  status?: UnitStatus;
  parentId?: string | null;
  rootOnly?: boolean;
  search?: string;
  effectiveAt?: Date | string;
}

export type OrganizationalUnitWithRelations = OrganizationalUnit & {
  parent?: OrganizationalUnit | null;
  children?: OrganizationalUnit[];
  _count?: {
    children: number;
    positionAssignments: number;
    leadTasks: number;
    workDossiers: number;
  };
};

export class OrganizationalUnitService {
  /**
   * 1. Create a new OrganizationalUnit and compute its transitive UnitClosurePaths.
   */
  static async createUnit(
    actor: AuthenticatedUserContext | SessionPayload,
    input: CreateUnitInput
  ): Promise<OrganizationalUnit> {
    const user = await resolveUserContext(actor);

    // Authorization assertion
    const resource: AuthorizationResource = {
      type: "organization_unit",
      id: "new",
      createdById: user.id,
    };
    await assertAuthorized(user, "org.manage", resource);

    // Validate inputs
    const code = input.code?.trim().toUpperCase();
    if (!code) {
      throw new ValidationError("Mã đơn vị tổ chức không được để trống");
    }

    const name = input.name?.trim();
    if (!name) {
      throw new ValidationError("Tên đơn vị tổ chức không được để trống");
    }

    if (!input.type) {
      throw new ValidationError("Loại đơn vị (UnitType) không được để trống");
    }

    // Check code uniqueness
    const existing = await prisma.organizationalUnit.findUnique({
      where: { code },
    });
    if (existing) {
      throw new ConflictError(`Mã đơn vị '${code}' đã tồn tại trong cơ sở dữ liệu`);
    }

    // Validate parent if provided
    let parentUnit: OrganizationalUnit | null = null;
    if (input.parentId) {
      parentUnit = await prisma.organizationalUnit.findUnique({
        where: { id: input.parentId },
      });
      if (!parentUnit) {
        throw new NotFoundError(`Không tìm thấy đơn vị cấp trên: ${input.parentId}`);
      }
      if (parentUnit.status !== UnitStatus.ACTIVE) {
        throw new ValidationError(
          `Đơn vị cấp trên '${parentUnit.name}' đang ở trạng thái ${parentUnit.status}, không thể thêm đơn vị trực thuộc`
        );
      }
    }

    const effectiveFromDate = input.effectiveFrom
      ? new Date(input.effectiveFrom)
      : new Date();
    const effectiveToDate = input.effectiveTo
      ? new Date(input.effectiveTo)
      : null;

    if (effectiveToDate && effectiveToDate <= effectiveFromDate) {
      throw new ValidationError("Thời điểm kết thúc hiệu lực (effectiveTo) phải sau ngày bắt đầu hiệu lực (effectiveFrom)");
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Create unit record
      const unit = await tx.organizationalUnit.create({
        data: {
          code,
          name,
          type: input.type,
          parentId: input.parentId || null,
          status: input.status || UnitStatus.ACTIVE,
          effectiveFrom: effectiveFromDate,
          effectiveTo: effectiveToDate,
          metadata: input.metadata ?? Prisma.DbNull,
        },
      });

      // 2. Build Closure Paths:
      // Self-path (depth 0)
      await tx.unitClosurePath.create({
        data: {
          ancestorId: unit.id,
          descendantId: unit.id,
          depth: 0,
        },
      });

      // Transitive paths from parent's ancestors
      if (input.parentId) {
        const parentAncestors = await tx.unitClosurePath.findMany({
          where: { descendantId: input.parentId },
        });

        for (const ancestorPath of parentAncestors) {
          await tx.unitClosurePath.create({
            data: {
              ancestorId: ancestorPath.ancestorId,
              descendantId: unit.id,
              depth: ancestorPath.depth + 1,
            },
          });
        }
      }

      // 3. Audit log
      await auditService.logEvent(tx, {
        actorId: user.id,
        action: AuditAction.ORGANIZATIONAL_UNIT_CREATED || "ORGANIZATIONAL_UNIT_CREATED",
        entityType: AuditEntityType.ORGANIZATIONAL_UNIT || "OrganizationalUnit",
        entityId: unit.id,
        afterData: {
          code: unit.code,
          name: unit.name,
          type: unit.type,
          parentId: unit.parentId,
          status: unit.status,
          effectiveFrom: unit.effectiveFrom,
        },
      });

      return unit;
    });
  }

  /**
   * 2. Update unit metadata and operational properties.
   */
  static async updateUnit(
    actor: AuthenticatedUserContext | SessionPayload,
    unitId: string,
    input: UpdateUnitInput
  ): Promise<OrganizationalUnit> {
    const user = await resolveUserContext(actor);

    const existing = await prisma.organizationalUnit.findUnique({
      where: { id: unitId },
    });
    if (!existing) {
      throw new NotFoundError(`Không tìm thấy đơn vị tổ chức: ${unitId}`);
    }

    const resource: AuthorizationResource = {
      type: "organization_unit",
      id: unitId,
      owningUnitId: unitId,
    };
    await assertAuthorized(user, "org.manage", resource);

    const dataToUpdate: Prisma.OrganizationalUnitUpdateInput = {};

    if (input.name !== undefined) {
      const trimmed = input.name.trim();
      if (!trimmed) {
        throw new ValidationError("Tên đơn vị không được để trống");
      }
      dataToUpdate.name = trimmed;
    }

    if (input.type !== undefined) {
      dataToUpdate.type = input.type;
    }

    if (input.metadata !== undefined) {
      dataToUpdate.metadata = input.metadata ?? Prisma.DbNull;
    }

    if (input.effectiveFrom !== undefined) {
      dataToUpdate.effectiveFrom = new Date(input.effectiveFrom);
    }

    if (input.effectiveTo !== undefined) {
      dataToUpdate.effectiveTo = input.effectiveTo ? new Date(input.effectiveTo) : null;
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.organizationalUnit.update({
        where: { id: unitId },
        data: dataToUpdate,
      });

      await auditService.logEvent(tx, {
        actorId: user.id,
        action: AuditAction.ORGANIZATIONAL_UNIT_UPDATED || "ORGANIZATIONAL_UNIT_UPDATED",
        entityType: AuditEntityType.ORGANIZATIONAL_UNIT || "OrganizationalUnit",
        entityId: unitId,
        beforeData: {
          name: existing.name,
          type: existing.type,
          effectiveFrom: existing.effectiveFrom,
          effectiveTo: existing.effectiveTo,
        },
        afterData: {
          name: updated.name,
          type: updated.type,
          effectiveFrom: updated.effectiveFrom,
          effectiveTo: updated.effectiveTo,
        },
      });

      return updated;
    });
  }

  /**
   * 3. Move an organizational unit to a new parent in the hierarchy.
   * Enforces:
   * - No self-parenting (unitId === newParentId).
   * - No cycle creation (newParentId cannot be a descendant of unitId).
   * - Atomically rebuilds all affected closure table paths.
   */
  static async moveUnitHierarchy(
    actor: AuthenticatedUserContext | SessionPayload,
    input: MoveUnitInput
  ): Promise<OrganizationalUnit> {
    const user = await resolveUserContext(actor);

    const { unitId, newParentId } = input;

    const unit = await prisma.organizationalUnit.findUnique({
      where: { id: unitId },
    });
    if (!unit) {
      throw new NotFoundError(`Không tìm thấy đơn vị tổ chức: ${unitId}`);
    }

    const resource: AuthorizationResource = {
      type: "organization_unit",
      id: unitId,
      owningUnitId: unitId,
    };
    await assertAuthorized(user, "org.manage", resource);

    // Invariant: Cannot parent to itself
    if (newParentId === unitId) {
      throw new ValidationError("Đơn vị tổ chức không thể là cấp trên của chính nó");
    }

    // If newParentId is identical to current parent, no-op
    if (newParentId === unit.parentId) {
      return unit;
    }

    // If moving under a new parent, verify new parent exists and is ACTIVE
    if (newParentId) {
      const newParent = await prisma.organizationalUnit.findUnique({
        where: { id: newParentId },
      });
      if (!newParent) {
        throw new NotFoundError(`Không tìm thấy đơn vị cấp trên mới: ${newParentId}`);
      }
      if (newParent.status !== UnitStatus.ACTIVE) {
        throw new ValidationError(
          `Đơn vị cấp trên mới '${newParent.name}' đang ở trạng thái ${newParent.status}, không thể nhận đơn vị cấp dưới`
        );
      }

      // Invariant: Cycle check — newParentId MUST NOT be in the subtree/descendants of unitId
      const cycleCheck = await prisma.unitClosurePath.findUnique({
        where: {
          ancestorId_descendantId: {
            ancestorId: unitId,
            descendantId: newParentId,
          },
        },
      });
      if (cycleCheck) {
        throw new ValidationError(
          "Không thể chuyển đơn vị vào đơn vị cấp dưới của chính nó (Phát hiện xung đột vòng lặp cây tổ chức)"
        );
      }
    }

    return await prisma.$transaction(async (tx) => {
      // Step A: Find all descendants in the subtree of unitId (including unitId itself)
      const subtreePaths = await tx.unitClosurePath.findMany({
        where: { ancestorId: unitId },
      });
      const descendantIds = subtreePaths.map((p) => p.descendantId);

      // Step B: Disconnect subtree from current ancestors (ancestors that are outside the subtree)
      // Delete paths where descendantId IN (subtree) AND ancestorId NOT IN (subtree)
      await tx.unitClosurePath.deleteMany({
        where: {
          descendantId: { in: descendantIds },
          ancestorId: { notIn: descendantIds },
        },
      });

      // Step C: If newParentId is provided, connect the subtree to new parent's ancestors
      if (newParentId) {
        const newParentAncestors = await tx.unitClosurePath.findMany({
          where: { descendantId: newParentId },
        });

        // For each ancestor of new parent (including new parent itself)
        // and each node in unit's subtree:
        for (const ancestorPath of newParentAncestors) {
          for (const subPath of subtreePaths) {
            await tx.unitClosurePath.create({
              data: {
                ancestorId: ancestorPath.ancestorId,
                descendantId: subPath.descendantId,
                depth: ancestorPath.depth + 1 + subPath.depth,
              },
            });
          }
        }
      }

      // Step D: Update parentId on unit record
      const updated = await tx.organizationalUnit.update({
        where: { id: unitId },
        data: { parentId: newParentId },
      });

      // Step E: Invalidate cache & Audit Log
      authorizationContextCache.invalidateAllAuthorizationContextCaches();

      await auditService.logEvent(tx, {
        actorId: user.id,
        action: "ORGANIZATIONAL_UNIT_MOVED",
        entityType: AuditEntityType.ORGANIZATIONAL_UNIT || "OrganizationalUnit",
        entityId: unitId,
        beforeData: { parentId: unit.parentId },
        afterData: { parentId: newParentId, reason: input.reason },
      });

      return updated;
    });
  }

  /**
   * 4. Change unit operational status (ACTIVE, SUSPENDED, DISSOLVED...).
   */
  static async setUnitStatus(
    actor: AuthenticatedUserContext | SessionPayload,
    unitId: string,
    status: UnitStatus,
    reason?: string
  ): Promise<OrganizationalUnit> {
    const user = await resolveUserContext(actor);

    const unit = await prisma.organizationalUnit.findUnique({
      where: { id: unitId },
      include: {
        children: { where: { status: UnitStatus.ACTIVE } },
        positionAssignments: { where: { status: "ACTIVE" } },
      },
    });
    if (!unit) {
      throw new NotFoundError(`Không tìm thấy đơn vị tổ chức: ${unitId}`);
    }

    const resource: AuthorizationResource = {
      type: "organization_unit",
      id: unitId,
      owningUnitId: unitId,
    };
    await assertAuthorized(user, "org.manage", resource);

    // If dissolving/suspending, warn or check active child units
    if (status !== UnitStatus.ACTIVE && unit.children.length > 0) {
      throw new ValidationError(
        `Không thể chuyển trạng thái ${status} khi đơn vị còn ${unit.children.length} đơn vị cấp dưới đang hoạt động. Hãy điều chuyển hoặc giải thể đơn vị cấp dưới trước.`
      );
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.organizationalUnit.update({
        where: { id: unitId },
        data: {
          status,
          effectiveTo: status !== UnitStatus.ACTIVE ? new Date() : unit.effectiveTo,
        },
      });

      authorizationContextCache.invalidateAllAuthorizationContextCaches();

      await auditService.logEvent(tx, {
        actorId: user.id,
        action: "ORGANIZATIONAL_UNIT_STATUS_CHANGED",
        entityType: AuditEntityType.ORGANIZATIONAL_UNIT || "OrganizationalUnit",
        entityId: unitId,
        beforeData: { status: unit.status },
        afterData: { status: updated.status, reason },
      });

      return updated;
    });
  }

  /**
   * 5. Hard delete organizational unit.
   * CRITICAL INVARIANT: Prohibit hard-delete if the unit has any historical linkages:
   * - Position assignments (lịch sử công tác, bổ nhiệm)
   * - Lead tasks (nhiệm vụ chủ trì)
   * - Task actor relationships (đơn vị phối hợp)
   * - Work dossiers (hồ sơ công việc)
   * - Incoming document workflows
   * - Child units
   */
  static async deleteUnit(
    actor: AuthenticatedUserContext | SessionPayload,
    unitId: string
  ): Promise<{ success: boolean }> {
    const user = await resolveUserContext(actor);

    const unit = await prisma.organizationalUnit.findUnique({
      where: { id: unitId },
      include: {
        _count: {
          select: {
            positionAssignments: true,
            leadTasks: true,
            taskActors: true,
            workDossiers: true,
            leadWorkflows: true,
            children: true,
            unitAssignments: true,
          },
        },
      },
    });
    if (!unit) {
      throw new NotFoundError(`Không tìm thấy đơn vị tổ chức: ${unitId}`);
    }

    const resource: AuthorizationResource = {
      type: "organization_unit",
      id: unitId,
      owningUnitId: unitId,
    };
    await assertAuthorized(user, "org.manage", resource);

    // Enforce Hard-Delete prohibition
    if (unit._count.positionAssignments > 0) {
      throw new ValidationError(
        `Không thể xóa vĩnh viễn đơn vị '${unit.name}' vì đã có ${unit._count.positionAssignments} lịch sử bổ nhiệm nhân sự (PositionAssignment). Quy định bắt buộc: Chuyển trạng thái sang SUSPENDED hoặc DISSOLVED để bảo lưu hồ sơ công vụ.`
      );
    }

    if (unit._count.leadTasks > 0 || unit._count.taskActors > 0 || unit._count.unitAssignments > 0) {
      throw new ValidationError(
        `Không thể xóa vĩnh viễn đơn vị '${unit.name}' vì có nhiệm vụ công việc gắn liền. Vui lòng chuyển trạng thái sang SUSPENDED hoặc DISSOLVED.`
      );
    }

    if (unit._count.workDossiers > 0) {
      throw new ValidationError(
        `Không thể xóa vĩnh viễn đơn vị '${unit.name}' vì đã có ${unit._count.workDossiers} hồ sơ công việc (WorkDossier). Hồ sơ lưu trữ công sở là bất biến.`
      );
    }

    if (unit._count.leadWorkflows > 0) {
      throw new ValidationError(
        `Không thể xóa vĩnh viễn đơn vị '${unit.name}' vì đã có quy trình luân chuyển văn bản đến gắn liền.`
      );
    }

    if (unit._count.children > 0) {
      throw new ValidationError(
        `Không thể xóa đơn vị '${unit.name}' vì đang chứa ${unit._count.children} đơn vị cấp dưới.`
      );
    }

    return await prisma.$transaction(async (tx) => {
      // Delete closure paths
      await tx.unitClosurePath.deleteMany({
        where: {
          OR: [{ ancestorId: unitId }, { descendantId: unitId }],
        },
      });

      // Delete the unit record
      await tx.organizationalUnit.delete({
        where: { id: unitId },
      });

      authorizationContextCache.invalidateAllAuthorizationContextCaches();

      await auditService.logEvent(tx, {
        actorId: user.id,
        action: "ORGANIZATIONAL_UNIT_DELETED",
        entityType: AuditEntityType.ORGANIZATIONAL_UNIT || "OrganizationalUnit",
        entityId: unitId,
        beforeData: { code: unit.code, name: unit.name },
      });

      return { success: true };
    });
  }

  /**
   * 6. Query Subtree (all descendants of a unit) using UnitClosurePath.
   */
  static async getSubtree(
    unitId: string,
    includeSelf = true
  ): Promise<OrganizationalUnit[]> {
    const paths = await prisma.unitClosurePath.findMany({
      where: {
        ancestorId: unitId,
        ...(includeSelf ? {} : { depth: { gt: 0 } }),
      },
      orderBy: { depth: "asc" },
      include: {
        descendant: {
          include: {
            parent: true,
          },
        },
      },
    });

    return paths.map((p) => p.descendant);
  }

  /**
   * 7. Query Ancestors (all parent nodes up to root) using UnitClosurePath.
   */
  static async getAncestors(
    unitId: string,
    includeSelf = true
  ): Promise<OrganizationalUnit[]> {
    const paths = await prisma.unitClosurePath.findMany({
      where: {
        descendantId: unitId,
        ...(includeSelf ? {} : { depth: { gt: 0 } }),
      },
      orderBy: { depth: "asc" },
      include: {
        ancestor: true,
      },
    });

    return paths.map((p) => p.ancestor);
  }

  /**
   * 8. List and filter units with effective-dating support.
   */
  static async listUnits(filter: ListUnitsFilter = {}): Promise<OrganizationalUnitWithRelations[]> {
    const where: Prisma.OrganizationalUnitWhereInput = {};

    if (filter.type) {
      where.type = filter.type;
    }

    if (filter.status) {
      where.status = filter.status;
    }

    if (filter.rootOnly) {
      where.parentId = null;
    } else if (filter.parentId !== undefined) {
      where.parentId = filter.parentId;
    }

    if (filter.search) {
      where.OR = [
        { code: { contains: filter.search, mode: "insensitive" } },
        { name: { contains: filter.search, mode: "insensitive" } },
      ];
    }

    if (filter.effectiveAt) {
      const atDate = new Date(filter.effectiveAt);
      where.effectiveFrom = { lte: atDate };
      where.OR = [
        { effectiveTo: null },
        { effectiveTo: { gte: atDate } },
      ];
    }

    return await prisma.organizationalUnit.findMany({
      where,
      orderBy: [{ type: "asc" }, { code: "asc" }],
      include: {
        parent: true,
        children: true,
        _count: {
          select: {
            children: true,
            positionAssignments: true,
            leadTasks: true,
            workDossiers: true,
          },
        },
      },
    });
  }

  /**
   * 9. Get single unit by ID with hierarchy details.
   */
  static async getUnitById(unitId: string): Promise<OrganizationalUnitWithRelations | null> {
    return await prisma.organizationalUnit.findUnique({
      where: { id: unitId },
      include: {
        parent: true,
        children: true,
        _count: {
          select: {
            children: true,
            positionAssignments: true,
            leadTasks: true,
            workDossiers: true,
          },
        },
      },
    });
  }

  /**
   * 10. Get single unit by Code.
   */
  static async getUnitByCode(code: string): Promise<OrganizationalUnit | null> {
    return await prisma.organizationalUnit.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        parent: true,
      },
    });
  }
}
