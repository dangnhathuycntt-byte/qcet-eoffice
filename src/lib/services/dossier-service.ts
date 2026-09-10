/**
 * Work Dossier & Archival Service (Nghị định 30/2020/NĐ-CP & Luật Lưu trữ)
 *
 * Implements the official institutional records management and archival domain:
 * 1. OPEN -> ACTIVE: Tạo lập và cập nhật tài liệu vào hồ sơ công việc.
 * 2. CLOSED: Đóng hồ sơ sau khi hoàn thành nhiệm vụ / giải quyết xong văn bản.
 * 3. READY_FOR_ARCHIVE / SUBMITTED_TO_ARCHIVE: Chuyên viên / Lãnh đạo đơn vị nộp lưu hồ sơ vào lưu trữ cơ quan.
 * 4. ACCEPTED / ARCHIVED: Lưu trữ viên / Văn thư kiểm tra, tiếp nhận và vào sổ lưu trữ cơ quan.
 *
 * Invariants Enforced:
 * - Separation of Duties (SoD): Submitter (responsiblePerson) != Archivist (archivedBy).
 * - Immutability: Cannot add or remove items from CLOSED or ARCHIVED dossiers.
 * - Atomic database operations via prisma.$transaction.
 * - Immutable Audit Logging via auditService.
 * - Reliable Outbox Event Publishing via publishOutboxEvent.
 * - Hybrid Authorization via assertAuthorized().
 */

import { prisma } from "@/lib/prisma";
import type { Prisma, WorkDossier, DossierItem, RetentionRule } from "@prisma/client";
import {
  DossierStatus,
  DossierItemType,
  DataClassification,
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
  InvalidTransitionError,
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from "@/server/api/errors";
import type { SessionPayload } from "@/lib/jwt-session";

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface CreateDossierInput {
  title: string;
  code?: string;
  owningUnitId: string;
  responsiblePersonId?: string;
  retentionRuleId?: string;
  classification?: DataClassification;
  storageLocation?: string;
  notes?: string;
}

export interface AddItemToDossierInput {
  dossierId: string;
  itemType: DossierItemType;
  itemId?: string;
  documentId?: string;
  taskId?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  title: string;
  documentNumber?: string;
  documentDate?: Date | string;
  pageCount?: number;
  sequence?: number;
  notes?: string;
}

export interface RemoveItemFromDossierInput {
  dossierId: string;
  itemId: string;
}

export interface CloseDossierInput {
  dossierId: string;
  notes?: string;
}

export interface SubmitArchiveInput {
  dossierId: string;
  notes?: string;
}

export interface AcceptArchiveInput {
  dossierId: string;
  storageLocation?: string;
  notes?: string;
}

export interface ListDossiersFilter {
  status?: DossierStatus;
  owningUnitId?: string;
  responsiblePersonId?: string;
  search?: string;
  classification?: DataClassification;
  limit?: number;
  offset?: number;
}

export type WorkDossierWithDetails = WorkDossier & {
  owningUnit: { id: string; name: string; code: string };
  responsiblePerson: { id: string; name: string; email: string };
  archivedBy?: { id: string; name: string; email: string } | null;
  retentionRule?: RetentionRule | null;
  items?: (DossierItem & { addedBy?: { id: string; name: string } })[];
  _count?: { items: number };
};

// ============================================================================
// Helper Methods
// ============================================================================

async function generateDossierCode(unitId: string): Promise<string> {
  const currentYear = new Date().getFullYear();
  const unit = await prisma.organizationalUnit.findUnique({
    where: { id: unitId },
    select: { code: true },
  });
  const unitCode = unit?.code || "DV";

  const count = await prisma.workDossier.count({
    where: {
      owningUnitId: unitId,
      openedAt: {
        gte: new Date(currentYear, 0, 1),
        lt: new Date(currentYear + 1, 0, 1),
      },
    },
  });

  const nextSeq = String(count + 1).padStart(3, "0");
  return `HS-${currentYear}-${unitCode}-${nextSeq}`;
}

function hasSchoolWideArchivalAccess(user: AuthenticatedUserContext): boolean {
  if (user.systemRole === "RECTOR") {
    return true;
  }

  const pos = (user.activePositionCode || "").toUpperCase();
  if (
    pos === "VAN_THU" ||
    pos === "CLERK" ||
    pos === "LUU_TRU" ||
    pos === "ARCHIVIST" ||
    pos === "HIEU_TRUONG" ||
    pos === "PHO_HIEU_TRUONG"
  ) {
    return true;
  }

  const grants = user.delegationGrants || [];
  return grants.some(
    (g) =>
      g.status === "ACTIVE" &&
      (g.capability === "*" ||
        g.capability === "document.archive" ||
        g.capability === "dossier.accept_archive")
  );
}

// ============================================================================
// Service Methods
// ============================================================================

export class DossierService {
  /**
   * 1. Create a new work dossier (Hồ sơ công việc).
   */
  static async createDossier(
    actor: AuthenticatedUserContext | SessionPayload,
    input: CreateDossierInput
  ): Promise<WorkDossier> {
    const user = await resolveUserContext(actor);

    if (!input.title || input.title.trim() === "") {
      throw new ValidationError("Tiêu đề hồ sơ không được để trống", {
        title: ["Tiêu đề hồ sơ không được để trống"],
      });
    }

    if (!input.owningUnitId) {
      throw new ValidationError("Đơn vị quản lý hồ sơ không được để trống", {
        owningUnitId: ["Đơn vị quản lý hồ sơ không được để trống"],
      });
    }

    const owningUnit = await prisma.organizationalUnit.findUnique({
      where: { id: input.owningUnitId },
    });
    if (!owningUnit) {
      throw new NotFoundError(`Không tìm thấy đơn vị: ${input.owningUnitId}`);
    }

    const responsiblePersonId = input.responsiblePersonId || user.id;

    const respPerson = await prisma.user.findUnique({
      where: { id: responsiblePersonId },
    });
    if (!respPerson) {
      throw new NotFoundError(`Không tìm thấy cán bộ chịu trách nhiệm: ${responsiblePersonId}`);
    }

    // Authorization check
    const resource: AuthorizationResource = {
      id: "new",
      type: "dossier",
      owningUnitId: input.owningUnitId,
      dossierOwnerId: responsiblePersonId,
      createdById: user.id,
    };
    await assertAuthorized(user, "dossier.open", resource);

    // Generate code if not provided
    const code = input.code?.trim() || (await generateDossierCode(input.owningUnitId));

    // Verify code uniqueness
    const existing = await prisma.workDossier.findUnique({
      where: { code },
    });
    if (existing) {
      throw new ValidationError(`Mã hồ sơ ${code} đã tồn tại trong hệ thống`, {
        code: [`Mã hồ sơ ${code} đã tồn tại`],
      });
    }

    return await prisma.$transaction(async (tx) => {
      const dossier = await tx.workDossier.create({
        data: {
          code,
          title: input.title.trim(),
          owningUnitId: input.owningUnitId,
          responsiblePersonId,
          retentionRuleId: input.retentionRuleId,
          classification: input.classification || DataClassification.INTERNAL,
          storageLocation: input.storageLocation,
          notes: input.notes,
          status: DossierStatus.OPEN,
          openedAt: new Date(),
        },
      });

      // Immutable Audit Event
      await auditService.logEvent(tx, {
        actorId: user.id,
        action: AuditAction.DOSSIER_CREATED,
        entityType: AuditEntityType.WORK_DOSSIER,
        entityId: dossier.id,
        afterData: {
          code: dossier.code,
          title: dossier.title,
          status: dossier.status,
          owningUnitId: dossier.owningUnitId,
          responsiblePersonId: dossier.responsiblePersonId,
        },
      });

      // Reliable Transactional Outbox Event
      await publishOutboxEvent(tx, {
        eventType: OutboxEventType.DOSSIER_CREATED_NOTIFICATION,
        aggregateType: OutboxAggregateType.WORK_DOSSIER,
        aggregateId: dossier.id,
        payload: {
          dossierId: dossier.id,
          code: dossier.code,
          title: dossier.title,
          responsiblePersonId: dossier.responsiblePersonId,
          openedAt: dossier.openedAt,
        },
      });

      return dossier;
    });
  }

  /**
   * 2. Add an item (document, task, deliverable, minutes) into a work dossier.
   */
  static async addItemToDossier(
    actor: AuthenticatedUserContext | SessionPayload,
    input: AddItemToDossierInput
  ): Promise<DossierItem> {
    const user = await resolveUserContext(actor);

    const dossier = await prisma.workDossier.findUnique({
      where: { id: input.dossierId },
      include: { items: true },
    });
    if (!dossier) {
      throw new NotFoundError(`Không tìm thấy hồ sơ: ${input.dossierId}`);
    }

    // Invariant: Cannot add items to closed or archived dossiers
    if (
      dossier.status === DossierStatus.CLOSED ||
      dossier.status === DossierStatus.READY_FOR_ARCHIVE ||
      dossier.status === DossierStatus.SUBMITTED_TO_ARCHIVE ||
      dossier.status === DossierStatus.ACCEPTED ||
      dossier.status === DossierStatus.ARCHIVED
    ) {
      throw new InvalidTransitionError(
        `Không thể thêm tài liệu vào hồ sơ đã đóng hoặc đã nộp lưu trữ (Trạng thái: ${dossier.status})`
      );
    }

    if (!input.title || input.title.trim() === "") {
      throw new ValidationError("Tiêu đề tài liệu không được để trống", {
        title: ["Tiêu đề tài liệu không được để trống"],
      });
    }

    // Authorization check
    const resource: AuthorizationResource = {
      type: "dossier",
      id: dossier.id,
      owningUnitId: dossier.owningUnitId,
      dossierOwnerId: dossier.responsiblePersonId,
    };
    await assertAuthorized(user, "dossier.add_item", resource);

    // Calculate next sequence
    let sequence = input.sequence;
    if (!sequence) {
      const maxSeq = dossier.items.reduce(
        (max, it) => (it.sequence > max ? it.sequence : max),
        0
      );
      sequence = maxSeq + 1;
    }

    const docDate = input.documentDate
      ? typeof input.documentDate === "string"
        ? new Date(input.documentDate)
        : input.documentDate
      : undefined;

    const targetItemId = input.itemId ?? input.documentId ?? input.taskId;

    return await prisma.$transaction(async (tx) => {
      const currentDossier = await tx.workDossier.findUnique({
        where: { id: dossier.id },
        select: { id: true, status: true },
      });
      if (!currentDossier) {
        throw new NotFoundError(`Không tìm thấy hồ sơ: ${dossier.id}`);
      }
      if (
        currentDossier.status === DossierStatus.CLOSED ||
        currentDossier.status === DossierStatus.READY_FOR_ARCHIVE ||
        currentDossier.status === DossierStatus.SUBMITTED_TO_ARCHIVE ||
        currentDossier.status === DossierStatus.ACCEPTED ||
        currentDossier.status === DossierStatus.ARCHIVED
      ) {
        throw new InvalidTransitionError(
          `Không thể thêm tài liệu vào hồ sơ đã đóng hoặc đã nộp lưu trữ (Trạng thái: ${currentDossier.status})`
        );
      }

      const item = await tx.dossierItem.create({
        data: {
          dossierId: dossier.id,
          itemType: input.itemType,
          itemId: targetItemId,
          title: input.title.trim(),
          documentNumber: input.documentNumber,
          documentDate: docDate,
          pageCount: input.pageCount,
          sequence,
          addedById: user.id,
          addedAt: new Date(),
          notes: input.notes,
        },
      });

      // Update dossier status from OPEN to ACTIVE if adding first item
      if (currentDossier.status === DossierStatus.OPEN) {
        await tx.workDossier.update({
          where: { id: dossier.id },
          data: { status: DossierStatus.ACTIVE },
        });
      }

      // Immutable Audit Event
      await auditService.logEvent(tx, {
        actorId: user.id,
        action: AuditAction.DOSSIER_ITEM_ADDED,
        entityType: AuditEntityType.DOSSIER_ITEM,
        entityId: item.id,
        metadata: {
          dossierId: dossier.id,
          itemType: item.itemType,
          title: item.title,
          sequence: item.sequence,
        },
      });

      return item;
    });
  }

  /**
   * 3. Remove an item from a work dossier.
   */
  static async removeItemFromDossier(
    actor: AuthenticatedUserContext | SessionPayload,
    input: RemoveItemFromDossierInput
  ): Promise<{ success: boolean }> {
    const user = await resolveUserContext(actor);

    const item = await prisma.dossierItem.findUnique({
      where: { id: input.itemId },
      include: { dossier: true },
    });
    if (!item || item.dossierId !== input.dossierId) {
      throw new NotFoundError(`Không tìm thấy tài liệu trong hồ sơ: ${input.itemId}`);
    }

    const dossier = item.dossier;

    // Invariant: Cannot remove items from closed or archived dossiers
    if (
      dossier.status === DossierStatus.CLOSED ||
      dossier.status === DossierStatus.READY_FOR_ARCHIVE ||
      dossier.status === DossierStatus.SUBMITTED_TO_ARCHIVE ||
      dossier.status === DossierStatus.ACCEPTED ||
      dossier.status === DossierStatus.ARCHIVED
    ) {
      throw new InvalidTransitionError(
        `Không thể xóa tài liệu khỏi hồ sơ đã đóng hoặc đã nộp lưu trữ (Tr��ng thái: ${dossier.status})`
      );
    }

    // Authorization check
    const resource: AuthorizationResource = {
      type: "dossier",
      id: dossier.id,
      owningUnitId: dossier.owningUnitId,
      dossierOwnerId: dossier.responsiblePersonId,
    };
    await assertAuthorized(user, "dossier.remove_item", resource);

    return await prisma.$transaction(async (tx) => {
      const currentItem = await tx.dossierItem.findUnique({
        where: { id: item.id },
        include: { dossier: { select: { id: true, status: true } } },
      });
      if (!currentItem || currentItem.dossierId !== input.dossierId) {
        throw new NotFoundError(`Không tìm thấy tài liệu trong hồ sơ: ${input.itemId}`);
      }
      if (
        currentItem.dossier.status === DossierStatus.CLOSED ||
        currentItem.dossier.status === DossierStatus.READY_FOR_ARCHIVE ||
        currentItem.dossier.status === DossierStatus.SUBMITTED_TO_ARCHIVE ||
        currentItem.dossier.status === DossierStatus.ACCEPTED ||
        currentItem.dossier.status === DossierStatus.ARCHIVED
      ) {
        throw new InvalidTransitionError(
          `Không thể xóa tài liệu khỏi hồ sơ đã đóng hoặc đã nộp lưu trữ (Trạng thái: ${currentItem.dossier.status})`
        );
      }

      await tx.dossierItem.delete({
        where: { id: item.id },
      });

      // Immutable Audit Event
      await auditService.logEvent(tx, {
        actorId: user.id,
        action: AuditAction.DOSSIER_ITEM_REMOVED,
        entityType: AuditEntityType.DOSSIER_ITEM,
        entityId: item.id,
        beforeData: {
          dossierId: dossier.id,
          title: item.title,
          itemType: item.itemType,
        },
      });

      return { success: true };
    });
  }

  /**
   * 4. Close work dossier (Kết thúc hồ sơ công việc).
   */
  static async closeDossier(
    actor: AuthenticatedUserContext | SessionPayload,
    input: CloseDossierInput
  ): Promise<WorkDossier> {
    const user = await resolveUserContext(actor);

    const dossier = await prisma.workDossier.findUnique({
      where: { id: input.dossierId },
      include: { items: true },
    });
    if (!dossier) {
      throw new NotFoundError(`Không tìm thấy hồ sơ: ${input.dossierId}`);
    }

    if (
      dossier.status !== DossierStatus.OPEN &&
      dossier.status !== DossierStatus.ACTIVE
    ) {
      throw new InvalidTransitionError(
        `Chỉ có thể đóng hồ sơ đang mở hoặc đang hoạt động (Trạng thái hiện tại: ${dossier.status})`
      );
    }

    // Authorization check
    const resource: AuthorizationResource = {
      type: "dossier",
      id: dossier.id,
      owningUnitId: dossier.owningUnitId,
      dossierOwnerId: dossier.responsiblePersonId,
    };
    await assertAuthorized(user, "dossier.close", resource);

    return await prisma.$transaction(async (tx) => {
      const currentDossier = await tx.workDossier.findUnique({
        where: { id: input.dossierId },
        include: { items: true },
      });
      if (!currentDossier) {
        throw new NotFoundError(`Không tìm thấy hồ sơ: ${input.dossierId}`);
      }
      if (
        currentDossier.status !== DossierStatus.OPEN &&
        currentDossier.status !== DossierStatus.ACTIVE
      ) {
        throw new InvalidTransitionError(
          `Chỉ có thể đóng hồ sơ đang mở hoặc đang hoạt động (Trạng thái hiện tại: ${currentDossier.status})`
        );
      }
      if (!currentDossier.items || currentDossier.items.length === 0) {
        throw new ValidationError("Không thể đóng hồ sơ rỗng chưa có tài liệu, văn bản");
      }

      const updated = await tx.workDossier.update({
        where: { id: currentDossier.id },
        data: {
          status: DossierStatus.CLOSED,
          closedAt: new Date(),
          notes: input.notes
            ? currentDossier.notes
              ? `${currentDossier.notes}\n[Đóng hồ sơ]: ${input.notes}`
              : `[Đóng hồ sơ]: ${input.notes}`
            : currentDossier.notes,
        },
      });

      // Immutable Audit Event
      await auditService.logEvent(tx, {
        actorId: user.id,
        action: AuditAction.DOSSIER_CLOSED,
        entityType: AuditEntityType.WORK_DOSSIER,
        entityId: currentDossier.id,
        beforeData: { status: currentDossier.status },
        afterData: { status: updated.status, closedAt: updated.closedAt },
      });

      // Reliable Transactional Outbox Event
      await publishOutboxEvent(tx, {
        eventType: OutboxEventType.DOSSIER_CLOSED_NOTIFICATION,
        aggregateType: OutboxAggregateType.WORK_DOSSIER,
        aggregateId: currentDossier.id,
        payload: {
          dossierId: currentDossier.id,
          code: currentDossier.code,
          title: currentDossier.title,
          closedAt: updated.closedAt,
          closedByUserId: user.id,
        },
      });

      return updated;
    });
  }

  /**
   * 5. Submit dossier to institutional archives (Nộp lưu hồ sơ vào lưu trữ cơ quan).
   */
  static async submitArchive(
    actor: AuthenticatedUserContext | SessionPayload,
    input: SubmitArchiveInput
  ): Promise<WorkDossier> {
    const user = await resolveUserContext(actor);

    const dossier = await prisma.workDossier.findUnique({
      where: { id: input.dossierId },
    });
    if (!dossier) {
      throw new NotFoundError(`Không tìm thấy hồ sơ: ${input.dossierId}`);
    }

    if (
      dossier.status === DossierStatus.OPEN ||
      dossier.status === DossierStatus.ACTIVE
    ) {
      throw new InvalidTransitionError(
        "Hồ sơ công việc phải được đóng trước khi nộp lưu trữ cơ quan"
      );
    }

    if (
      dossier.status === DossierStatus.SUBMITTED_TO_ARCHIVE ||
      dossier.status === DossierStatus.ACCEPTED ||
      dossier.status === DossierStatus.ARCHIVED
    ) {
      throw new InvalidTransitionError(
        `Hồ sơ đã ở trạng thái ${dossier.status}, không thể nộp lại`
      );
    }

    // Authorization check
    const resource: AuthorizationResource = {
      type: "dossier",
      id: dossier.id,
      owningUnitId: dossier.owningUnitId,
      dossierOwnerId: dossier.responsiblePersonId,
    };
    await assertAuthorized(user, "dossier.submit_archive", resource);

    return await prisma.$transaction(async (tx) => {
      const currentDossier = await tx.workDossier.findUnique({
        where: { id: input.dossierId },
        include: { items: true },
      });
      if (!currentDossier) {
        throw new NotFoundError(`Không tìm thấy hồ sơ: ${input.dossierId}`);
      }
      if (
        currentDossier.status === DossierStatus.OPEN ||
        currentDossier.status === DossierStatus.ACTIVE
      ) {
        throw new InvalidTransitionError(
          "Hồ sơ công việc phải được đóng trước khi nộp lưu trữ cơ quan"
        );
      }
      if (
        currentDossier.status === DossierStatus.SUBMITTED_TO_ARCHIVE ||
        currentDossier.status === DossierStatus.ACCEPTED ||
        currentDossier.status === DossierStatus.ARCHIVED
      ) {
        throw new InvalidTransitionError(
          `Hồ sơ đã ở trạng thái ${currentDossier.status}, không thể nộp lại`
        );
      }
      if (!currentDossier.retentionRuleId) {
        throw new ValidationError(
          "Hồ sơ phải xác định Bảng thời hạn bảo quản (RetentionRule) trước khi nộp lưu trữ cơ quan theo Luật Lưu trữ"
        );
      }
      if (!currentDossier.items || currentDossier.items.length === 0) {
        throw new ValidationError("Không thể nộp lưu hồ sơ rỗng chưa có tài liệu, văn bản");
      }

      const updated = await tx.workDossier.update({
        where: { id: currentDossier.id },
        data: {
          status: DossierStatus.SUBMITTED_TO_ARCHIVE,
          submittedArchiveAt: new Date(),
          submittedById: user.id,
          notes: input.notes
            ? currentDossier.notes
              ? `${currentDossier.notes}\n[Nộp lưu]: ${input.notes}`
              : `[Nộp lưu]: ${input.notes}`
            : currentDossier.notes,
        },
      });

      // Immutable Audit Event
      await auditService.logEvent(tx, {
        actorId: user.id,
        action: AuditAction.DOSSIER_SUBMITTED_ARCHIVE,
        entityType: AuditEntityType.WORK_DOSSIER,
        entityId: currentDossier.id,
        beforeData: { status: currentDossier.status },
        afterData: {
          status: updated.status,
          submittedArchiveAt: updated.submittedArchiveAt,
        },
      });

      // Reliable Transactional Outbox Event
      await publishOutboxEvent(tx, {
        eventType: OutboxEventType.DOSSIER_SUBMITTED_ARCHIVE_NOTIFICATION,
        aggregateType: OutboxAggregateType.WORK_DOSSIER,
        aggregateId: currentDossier.id,
        payload: {
          dossierId: currentDossier.id,
          code: currentDossier.code,
          title: currentDossier.title,
          submittedArchiveAt: updated.submittedArchiveAt,
          submittedByUserId: user.id,
        },
      });

      return updated;
    });
  }

  /**
   * 6. Accept dossier into institutional archives (Tiếp nhận hồ sơ lưu trữ cơ quan).
   * Invariant: Separation of Duties (SoD) - Submitter (responsiblePerson) != Archivist.
   */
  static async acceptArchive(
    actor: AuthenticatedUserContext | SessionPayload,
    input: AcceptArchiveInput
  ): Promise<WorkDossier> {
    const user = await resolveUserContext(actor);

    const dossier = await prisma.workDossier.findUnique({
      where: { id: input.dossierId },
    });
    if (!dossier) {
      throw new NotFoundError(`Không tìm thấy hồ sơ: ${input.dossierId}`);
    }

    if (
      dossier.status !== DossierStatus.SUBMITTED_TO_ARCHIVE &&
      dossier.status !== DossierStatus.READY_FOR_ARCHIVE
    ) {
      throw new InvalidTransitionError(
        `Chỉ có thể tiếp nhận hồ sơ đã nộp lưu trữ (Trạng thái hiện tại: ${dossier.status})`
      );
    }

    // Invariant: Separation of Duties (SoD)
    // Người lập / chịu trách nhiệm nộp lưu hồ sơ tuyệt đối không được tự tiếp nhận hồ sơ vào lưu trữ cơ quan
    if (
      dossier.responsiblePersonId === user.id ||
      (dossier.submittedById && dossier.submittedById === user.id)
    ) {
      throw new ForbiddenError(
        "Người nộp lưu hồ sơ không được tự tiếp nhận hồ sơ vào lưu trữ cơ quan (Vi phạm nguyên tắc phân công độc lập SoD)"
      );
    }

    // Authorization check (Requires archival capability / clerical or archivist duty)
    const resource: AuthorizationResource = {
      type: "dossier",
      id: dossier.id,
      owningUnitId: dossier.owningUnitId,
      dossierOwnerId: dossier.responsiblePersonId,
      submittedByUserId: dossier.submittedById || dossier.responsiblePersonId,
    };
    await assertAuthorized(user, "dossier.accept_archive", resource);

    return await prisma.$transaction(async (tx) => {
      const currentDossier = await tx.workDossier.findUnique({
        where: { id: input.dossierId },
        include: { items: true },
      });
      if (!currentDossier) {
        throw new NotFoundError(`Không tìm thấy hồ sơ: ${input.dossierId}`);
      }
      if (
        currentDossier.status !== DossierStatus.SUBMITTED_TO_ARCHIVE &&
        currentDossier.status !== DossierStatus.READY_FOR_ARCHIVE
      ) {
        throw new InvalidTransitionError(
          `Chỉ có thể tiếp nhận hồ sơ đã nộp lưu trữ (Trạng thái hiện tại: ${currentDossier.status})`
        );
      }
      if (
        currentDossier.responsiblePersonId === user.id ||
        (currentDossier.submittedById && currentDossier.submittedById === user.id)
      ) {
        throw new ForbiddenError(
          "Người nộp lưu hồ sơ không được tự tiếp nhận hồ sơ vào lưu trữ cơ quan (Vi phạm nguyên tắc phân công độc lập SoD)"
        );
      }
      if (!currentDossier.retentionRuleId) {
        throw new ValidationError(
          "Hồ sơ phải có Bảng thời hạn bảo quản hợp lệ trước khi tiếp nhận lưu trữ cơ quan"
        );
      }
      if (!currentDossier.items || currentDossier.items.length === 0) {
        throw new ValidationError("Không thể tiếp nhận lưu trữ hồ sơ rỗng");
      }

      const updated = await tx.workDossier.update({
        where: { id: currentDossier.id },
        data: {
          status: DossierStatus.ARCHIVED,
          archivedAt: new Date(),
          archivedById: user.id,
          storageLocation: input.storageLocation || currentDossier.storageLocation,
          notes: input.notes
            ? currentDossier.notes
              ? `${currentDossier.notes}\n[Tiếp nhận lưu trữ]: ${input.notes}`
              : `[Tiếp nhận lưu trữ]: ${input.notes}`
            : currentDossier.notes,
        },
      });

      // Immutable Audit Events
      await auditService.logEvent(tx, {
        actorId: user.id,
        action: AuditAction.DOSSIER_ACCEPTED_ARCHIVE,
        entityType: AuditEntityType.WORK_DOSSIER,
        entityId: dossier.id,
        metadata: {
          archivedById: user.id,
          storageLocation: updated.storageLocation,
        },
      });

      await auditService.logEvent(tx, {
        actorId: user.id,
        action: AuditAction.DOSSIER_ARCHIVED,
        entityType: AuditEntityType.WORK_DOSSIER,
        entityId: dossier.id,
        beforeData: { status: dossier.status },
        afterData: {
          status: updated.status,
          archivedAt: updated.archivedAt,
          archivedById: updated.archivedById,
        },
      });

      // Reliable Transactional Outbox Event
      await publishOutboxEvent(tx, {
        eventType: OutboxEventType.DOSSIER_ACCEPTED_ARCHIVE_NOTIFICATION,
        aggregateType: OutboxAggregateType.WORK_DOSSIER,
        aggregateId: dossier.id,
        payload: {
          dossierId: dossier.id,
          code: dossier.code,
          title: dossier.title,
          archivedAt: updated.archivedAt,
          archivedById: user.id,
          storageLocation: updated.storageLocation,
        },
      });

      return updated;
    });
  }

  /**
   * 7. List work dossiers with scoping and filtering.
   */
  static async listDossiers(
    actor: AuthenticatedUserContext | SessionPayload,
    filter: ListDossiersFilter = {}
  ): Promise<{ items: WorkDossierWithDetails[]; total: number; limit: number; offset: number }> {
    const user = await resolveUserContext(actor);
    const limit = Math.min(Math.max(filter.limit || 20, 1), 100);
    const offset = Math.max(filter.offset || 0, 0);

    const where: Prisma.WorkDossierWhereInput = {};

    // Scoping enforcement:
    // If not school-wide authority, restrict to user's unit or dossiers where user is responsible
    if (!hasSchoolWideArchivalAccess(user)) {
      if (user.departmentId) {
        where.OR = [
          { owningUnitId: user.departmentId },
          { responsiblePersonId: user.id },
        ];
      } else {
        where.responsiblePersonId = user.id;
      }
    }

    if (filter.status) {
      where.status = filter.status;
    }

    if (filter.owningUnitId) {
      where.owningUnitId = filter.owningUnitId;
    }

    if (filter.responsiblePersonId) {
      where.responsiblePersonId = filter.responsiblePersonId;
    }

    if (filter.classification) {
      where.classification = filter.classification;
    }

    if (filter.search && filter.search.trim() !== "") {
      const term = filter.search.trim();
      where.AND = [
        {
          OR: [
            { title: { contains: term } },
            { code: { contains: term } },
            { notes: { contains: term } },
          ],
        },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.workDossier.count({ where }),
      prisma.workDossier.findMany({
        where,
        include: {
          owningUnit: { select: { id: true, name: true, code: true } },
          responsiblePerson: { select: { id: true, name: true, email: true } },
          archivedBy: { select: { id: true, name: true, email: true } },
          retentionRule: true,
          _count: { select: { items: true } },
        },
        orderBy: [{ openedAt: "desc" }],
        take: limit,
        skip: offset,
      }),
    ]);

    return {
      items: items as WorkDossierWithDetails[],
      total,
      limit,
      offset,
    };
  }

  /**
   * 8. Get work dossier details with full item list.
   */
  static async getDossierDetail(
    actor: AuthenticatedUserContext | SessionPayload,
    id: string
  ): Promise<WorkDossierWithDetails> {
    const user = await resolveUserContext(actor);

    const dossier = await prisma.workDossier.findUnique({
      where: { id },
      include: {
        owningUnit: { select: { id: true, name: true, code: true } },
        responsiblePerson: { select: { id: true, name: true, email: true } },
        archivedBy: { select: { id: true, name: true, email: true } },
        retentionRule: true,
        items: {
          include: {
            addedBy: { select: { id: true, name: true } },
          },
          orderBy: { sequence: "asc" },
        },
      },
    });

    if (!dossier) {
      throw new NotFoundError(`Không tìm thấy hồ sơ: ${id}`);
    }

    // Read access check
    if (!hasSchoolWideArchivalAccess(user)) {
      const isOwner = dossier.responsiblePersonId === user.id;
      const isSameUnit =
        (user.departmentId && dossier.owningUnitId === user.departmentId) ||
        (user.activeUnitId && dossier.owningUnitId === user.activeUnitId);
      if (!isOwner && !isSameUnit) {
        throw new ForbiddenError("Bạn không có quyền truy cập hồ sơ công việc này");
      }
    }

    return dossier as WorkDossierWithDetails;
  }

  /**
   * 9. List retention rules (Bảng thời hạn bảo quản hồ sơ).
   */
  static async listRetentionRules(): Promise<RetentionRule[]> {
    return await prisma.retentionRule.findMany({
      orderBy: { code: "asc" },
    });
  }
}
