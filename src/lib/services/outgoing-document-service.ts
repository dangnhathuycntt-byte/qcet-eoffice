/**
 * Outgoing Document Service V2 (Nghị định 30/2020/NĐ-CP & Nghị định 68/2024/NĐ-CP)
 *
 * Enforces the strict sequential lifecycle and separation of duties for outgoing documents:
 * 1. DRAFT: Chuyên viên / Lãnh đạo đơn vị tạo dự thảo văn bản đi.
 * 2. CONTENT_REVIEW: Trưởng đơn vị thẩm định và phê duyệt nội dung.
 * 3. FORMAT_CHECK: Văn thư cơ quan kiểm tra thể thức kỹ thuật NĐ 30/2020.
 * 4. AUTHORIZED_SIGN: Người có thẩm quyền (Hiệu trưởng / Phó HT ký thay) ký số chức danh NĐ 68/2024.
 * 5. NUMBERED: Văn thư cấp số văn bản đi liên tục và ngày ban hành.
 * 6. ORGANIZATION_SIGNED: Văn thư đóng dấu số cơ quan (chữ ký số tổ chức).
 * 7. ISSUED: Văn thư phát hành văn bản tới nơi nhận.
 *
 * Invariants Enforced:
 * - Separation of Duties: Drafter != Content Reviewer; Format Checker != Signer; Signer != Numberer; Signer != Org Signer.
 * - Version Immutability: Once signed, content/metadata at that version is immutable; edits require bumping to version N+1.
 * - Atomic database operations via prisma.$transaction.
 * - Immutable Audit Logging via auditService.
 * - Reliable Outbox Event Publishing via publishOutboxEvent.
 * - Hybrid Authorization via assertAuthorized().
 */

import { prisma } from "@/lib/prisma";
import type { Prisma, Document, DocumentOutgoingWorkflow, SignatureRecord } from "@prisma/client";
import {
  OutgoingDocumentStatus,
  SignatureType,
  SignatureVerificationStatus,
  DocumentType,
  DocumentSecurityLevel,
  DocumentUrgency,
  DocumentStatus,
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
import { INSTITUTION_CONFIG, getOfficialSigningCapacity } from "@/config/institution";
import { getNextRegistrationNumber } from "@/lib/documents/numbering-engine";
import {
  OutgoingDocumentStateMachine,
  isDocumentImmutable,
  mapOutgoingWorkflowStatusToDocumentStatus,
} from "@/lib/documents/state-machine";

// ============================================================================
// Types & Input Interfaces
// ============================================================================

export interface CreateOutgoingDraftInput {
  title: string;
  summary?: string;
  category?: string;
  securityLevel?: DocumentSecurityLevel;
  urgency?: DocumentUrgency;
  draftingDeptId?: string;
  authorizedSignerId?: string;
  recipientList?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  notes?: string;
}

export interface SubmitContentReviewInput {
  documentId: string;
  contentReviewerId?: string;
  notes?: string;
}

export interface ApproveContentInput {
  documentId: string;
  notes?: string;
}

export interface SubmitFormatCheckInput {
  documentId: string;
  formatReviewerId?: string;
  notes?: string;
}

export interface ApproveFormatInput {
  documentId: string;
  notes?: string;
}

export interface SignDocumentInput {
  documentId: string;
  signingCapacity?: string;
  signatureType?: SignatureType;
  certificateMetadata?: Record<string, unknown>;
  signingNotes?: string;
}

export interface AssignOutgoingNumberInput {
  documentId: string;
  outgoingNumberStr?: string;
  codeNotation?: string;
  issuedDate?: Date | string;
  securityLevel?: DocumentSecurityLevel;
  urgency?: DocumentUrgency;
}

export interface OrganizationSignInput {
  documentId: string;
  certificateMetadata?: Record<string, unknown>;
  notes?: string;
}

export interface IssueDocumentInput {
  documentId: string;
  recipientList?: string;
  deliveryMethod?: string;
  notes?: string;
}

export interface CreateDocumentRevisionInput {
  documentId: string;
  changeReason: string;
  title?: string;
  summary?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
}

export interface OutgoingWorkflowWithDetails extends DocumentOutgoingWorkflow {
  document: Document;
  contentReviewer: { id: string; name: string; email: string } | null;
  formatReviewer: { id: string; name: string; email: string } | null;
  authorizedSigner: { id: string; name: string; email: string } | null;
  numberer: { id: string; name: string; email: string } | null;
  orgSigner: { id: string; name: string; email: string } | null;
  issuer: { id: string; name: string; email: string } | null;
  signatures?: SignatureRecord[];
}

// ============================================================================
// Service Implementation
// ============================================================================

export class OutgoingDocumentService {
  /**
   * Helper to verify that a signed document cannot be modified directly.
   */
  private static assertDocumentModifiable(workflow: DocumentOutgoingWorkflow) {
    if (
      workflow.authorizedSignedAt !== null ||
      workflow.orgSignedAt !== null ||
      workflow.status === OutgoingDocumentStatus.AUTHORIZED_SIGN ||
      workflow.status === OutgoingDocumentStatus.NUMBERED ||
      workflow.status === OutgoingDocumentStatus.ORGANIZATION_SIGNED ||
      workflow.status === OutgoingDocumentStatus.ISSUED
    ) {
      throw new InvalidTransitionError(
        "Văn bản đã được ký số hoặc ban hành, nội dung và thể thức tại phiên bản này là bất biến (Immutable). Vui lòng tạo phiên bản sửa đổi mới (createDocumentRevision)."
      );
    }
  }

  /**
   * 1. CREATE OUTGOING DRAFT
   * Initiates an outgoing document draft in DRAFT status at version 1.
   */
  static async createOutgoingDraft(
    input: CreateOutgoingDraftInput,
    actor: AuthenticatedUserContext | SessionPayload,
    context?: { requestId?: string }
  ) {
    const user = await resolveUserContext(actor);
    const requestId = context?.requestId || `req_${Date.now()}`;

    const summary = input.summary || input.title;
    if (!summary || !summary.trim()) {
      throw new ValidationError("Trích yếu hoặc tiêu đề dự thảo văn bản đi là bắt buộc.");
    }

    const resource: AuthorizationResource = {
      id: "new_outgoing_draft",
      type: "document",
      scope: "personal",
      primaryOwnerId: user.id,
      createdById: user.id,
    };

    await assertAuthorized(user, "document.outgoing.draft", resource);

    const now = new Date();
    const documentYear = now.getFullYear();

    return prisma.$transaction(async (tx) => {
      // Advisory lock during draft creation to prevent negative registration number collisions
      if (typeof (tx as any).$executeRaw === "function") {
        try {
          await (tx as any).$executeRaw`SELECT pg_advisory_xact_lock(hashtext('draft_numbering_' || ${documentYear}::text));`;
        } catch {
          // fallback if non-postgres or test harness
        }
      }

      // Draft registration numbers use atomic sequence with negative year to guarantee race-free unique negative numbers
      const draftSeq = await getNextRegistrationNumber(DocumentType.VAN_BAN_DI, -documentYear, tx);
      const regNumber = -draftSeq;

      // 1. Create canonical Document record
      const document = await tx.document.create({
        data: {
          type: DocumentType.VAN_BAN_DI,
          registrationNumber: regNumber,
          documentYear,
          registeredDate: now,
          originalNumber: `DRAFT-${documentYear}-${Math.abs(regNumber)}`,
          issuedDate: now,
          issuingAuthority: INSTITUTION_CONFIG.issuingAuthority,
          category: input.category || "Quyết định",
          summary,
          urgency: input.urgency || DocumentUrgency.THUONG,
          securityLevel: input.securityLevel || DocumentSecurityLevel.THUONG,
          status: mapOutgoingWorkflowStatusToDocumentStatus(OutgoingDocumentStatus.DRAFT),
          notes: input.notes,
          registeredById: user.id,
          // Phase 9: draftingDeptId dropped from Document
          recipientList: input.recipientList,
          version: 1,
        },
      });

      // 1b. Attachment if provided
      if (input.fileUrl) {
        await tx.documentAttachment.create({
          data: {
            documentId: document.id,
            fileName: input.fileName || "Dự thảo văn bản đi",
            fileUrl: input.fileUrl,
            fileSize: input.fileSize || 0,
            mimeType: input.fileType || "application/pdf",
          },
        });
      }

      // 2. Create Outgoing Workflow record
      const workflow = await tx.documentOutgoingWorkflow.create({
        data: {
          documentId: document.id,
          status: OutgoingDocumentStatus.DRAFT,
          currentVersion: 1,
          authorizedSignerId: input.authorizedSignerId,
        },
      });

      // 3. Audit log
      await auditService.logEvent(tx, {
        actorId: user.id,
        action: AuditAction.DOCUMENT_CREATED,
        entityType: AuditEntityType.DOCUMENT,
        entityId: document.id,
        requestId,
        afterData: {
          documentId: document.id,
          type: document.type,
          summary: document.summary,
          version: 1,
          status: workflow.status,
        },
      });

      // 4. Outbox event
      await publishOutboxEvent(tx, {
        eventType: "DOCUMENT_DRAFT_CREATED",
        aggregateType: OutboxAggregateType.DOCUMENT,
        aggregateId: document.id,
        payload: {
          documentId: document.id,
          workflowId: workflow.id,
          status: workflow.status,
          summary: document.summary,
          drafterId: user.id,
        },
      });

      return { document, workflow };
    });
  }

  /**
   * 2. SUBMIT CONTENT REVIEW
   * Submits draft to Unit Leader or authorized reviewer for content review.
   */
  static async submitContentReview(
    input: SubmitContentReviewInput,
    actor: AuthenticatedUserContext | SessionPayload,
    context?: { requestId?: string }
  ) {
    const user = await resolveUserContext(actor);
    const requestId = context?.requestId || `req_${Date.now()}`;

    const existing = await prisma.documentOutgoingWorkflow.findUnique({
      where: { documentId: input.documentId },
      include: { document: true },
    });

    if (!existing) {
      throw new NotFoundError("Hồ sơ văn bản đi không tồn tại.");
    }

    if (existing.status !== OutgoingDocumentStatus.DRAFT) {
      throw new InvalidTransitionError(
        `Không thể gửi duyệt nội dung từ trạng thái hiện tại (${existing.status}). Yêu cầu trạng thái DRAFT.`
      );
    }

    const resource: AuthorizationResource = {
      id: input.documentId,
      type: "document",
      scope: "unit",
      primaryOwnerId: existing.document.registeredById,
      createdById: existing.document.registeredById,
      drafterId: existing.document.registeredById,
    };

    await assertAuthorized(user, "document.outgoing.submit_content_review", resource);

    return prisma.$transaction(async (tx) => {
      const now = new Date();
      const updatedWorkflow = await tx.documentOutgoingWorkflow.update({
        where: { documentId: input.documentId },
        data: {
          status: OutgoingDocumentStatus.CONTENT_REVIEW,
          contentReviewSubmittedAt: now,
          contentReviewerId: input.contentReviewerId,
          contentReviewNotes: input.notes,
        },
      });

      await tx.document.update({
        where: { id: input.documentId },
        data: {
          status: mapOutgoingWorkflowStatusToDocumentStatus(OutgoingDocumentStatus.CONTENT_REVIEW),
        },
      });

      await auditService.logEvent(tx, {
        actorId: user.id,
        action: "DOCUMENT_CONTENT_REVIEW_REQUESTED",
        entityType: AuditEntityType.DOCUMENT,
        entityId: input.documentId,
        requestId,
        beforeData: { status: existing.status },
        afterData: {
          status: updatedWorkflow.status,
          contentReviewSubmittedAt: now,
          contentReviewerId: input.contentReviewerId,
        },
      });

      await publishOutboxEvent(tx, {
        eventType: "DOCUMENT_CONTENT_REVIEW_REQUESTED",
        aggregateType: OutboxAggregateType.DOCUMENT,
        aggregateId: input.documentId,
        payload: {
          documentId: input.documentId,
          contentReviewerId: input.contentReviewerId,
          submittedBy: user.id,
        },
      });

      return updatedWorkflow;
    });
  }

  /**
   * 3. APPROVE CONTENT
   * Unit Leader reviews and approves the content.
   * Separation of duties: Drafter CANNOT approve content!
   */
  static async approveContent(
    input: ApproveContentInput,
    actor: AuthenticatedUserContext | SessionPayload,
    context?: { requestId?: string }
  ) {
    const user = await resolveUserContext(actor);
    const requestId = context?.requestId || `req_${Date.now()}`;

    const existing = await prisma.documentOutgoingWorkflow.findUnique({
      where: { documentId: input.documentId },
      include: { document: true },
    });

    if (!existing) {
      throw new NotFoundError("Hồ sơ văn bản đi không tồn tại.");
    }

    if (
      existing.status !== OutgoingDocumentStatus.CONTENT_REVIEW &&
      existing.status !== OutgoingDocumentStatus.DRAFT
    ) {
      throw new InvalidTransitionError(
        `Không thể phê duyệt nội dung ở trạng thái hiện tại (${existing.status}).`
      );
    }

    // Separation of Duties check: Drafter cannot approve content!
    OutgoingDocumentStateMachine.assertDrafterNotContentReviewer(
      existing.document.registeredById,
      user.id
    );

    const resource: AuthorizationResource = {
      id: input.documentId,
      type: "document",
      scope: "unit",
      primaryOwnerId: existing.document.registeredById,
      createdById: existing.document.registeredById,
      drafterId: existing.document.registeredById,
      draftingUserId: existing.document.registeredById,
    };

    await assertAuthorized(user, "document.outgoing.approve_content", resource);

    return prisma.$transaction(async (tx) => {
      const now = new Date();
      const updatedWorkflow = await tx.documentOutgoingWorkflow.update({
        where: { documentId: input.documentId },
        data: {
          status: OutgoingDocumentStatus.FORMAT_CHECK,
          contentApprovedAt: now,
          contentReviewerId: user.id,
          contentReviewNotes: input.notes || existing.contentReviewNotes,
          formatReviewSubmittedAt: now,
        },
      });

      await tx.document.update({
        where: { id: input.documentId },
        data: {
          status: mapOutgoingWorkflowStatusToDocumentStatus(OutgoingDocumentStatus.FORMAT_CHECK),
        },
      });

      await auditService.logEvent(tx, {
        actorId: user.id,
        action: "DOCUMENT_CONTENT_APPROVED",
        entityType: AuditEntityType.DOCUMENT,
        entityId: input.documentId,
        requestId,
        beforeData: { status: existing.status },
        afterData: {
          status: updatedWorkflow.status,
          contentApprovedAt: now,
          contentReviewerId: user.id,
        },
      });

      await publishOutboxEvent(tx, {
        eventType: "DOCUMENT_CONTENT_APPROVED",
        aggregateType: OutboxAggregateType.DOCUMENT,
        aggregateId: input.documentId,
        payload: {
          documentId: input.documentId,
          contentReviewerId: user.id,
          status: updatedWorkflow.status,
        },
      });

      return updatedWorkflow;
    });
  }

  /**
   * 4. SUBMIT FORMAT CHECK
   * Submits document to Clerical Department for technical format check under NĐ 30/2020.
   */
  static async submitFormatCheck(
    input: SubmitFormatCheckInput,
    actor: AuthenticatedUserContext | SessionPayload,
    context?: { requestId?: string }
  ) {
    const user = await resolveUserContext(actor);
    const requestId = context?.requestId || `req_${Date.now()}`;

    const existing = await prisma.documentOutgoingWorkflow.findUnique({
      where: { documentId: input.documentId },
      include: { document: true },
    });

    if (!existing) {
      throw new NotFoundError("Hồ sơ văn bản đi không tồn tại.");
    }

    if (
      existing.status !== OutgoingDocumentStatus.CONTENT_REVIEW &&
      existing.status !== OutgoingDocumentStatus.FORMAT_CHECK &&
      !existing.contentApprovedAt
    ) {
      throw new InvalidTransitionError("Văn bản phải được phê duyệt nội dung trước khi chuyển kiểm tra thể thức.");
    }

    const resource: AuthorizationResource = {
      id: input.documentId,
      type: "document",
      scope: "school",
      primaryOwnerId: existing.document.registeredById,
      createdById: existing.document.registeredById,
      drafterId: existing.document.registeredById,
    };

    await assertAuthorized(user, "document.outgoing.submit_format_check", resource);

    return prisma.$transaction(async (tx) => {
      const now = new Date();
      const updatedWorkflow = await tx.documentOutgoingWorkflow.update({
        where: { documentId: input.documentId },
        data: {
          status: OutgoingDocumentStatus.FORMAT_CHECK,
          formatReviewSubmittedAt: now,
          formatReviewerId: input.formatReviewerId,
          formatReviewNotes: input.notes,
        },
      });

      await tx.document.update({
        where: { id: input.documentId },
        data: {
          status: mapOutgoingWorkflowStatusToDocumentStatus(OutgoingDocumentStatus.FORMAT_CHECK),
        },
      });

      await auditService.logEvent(tx, {
        actorId: user.id,
        action: "DOCUMENT_FORMAT_CHECK_REQUESTED",
        entityType: AuditEntityType.DOCUMENT,
        entityId: input.documentId,
        requestId,
        beforeData: { status: existing.status },
        afterData: { status: updatedWorkflow.status },
      });

      return updatedWorkflow;
    });
  }

  /**
   * 5. APPROVE FORMAT
   * Văn thư checks technical format (quốc hiệu, tiêu ngữ, thể thức, phông chữ theo NĐ 30/2020).
   * Only Văn thư (Clerk) can approve format.
   */
  static async approveFormat(
    input: ApproveFormatInput,
    actor: AuthenticatedUserContext | SessionPayload,
    context?: { requestId?: string }
  ) {
    const user = await resolveUserContext(actor);
    const requestId = context?.requestId || `req_${Date.now()}`;

    const existing = await prisma.documentOutgoingWorkflow.findUnique({
      where: { documentId: input.documentId },
      include: { document: true },
    });

    if (!existing) {
      throw new NotFoundError("Hồ sơ văn bản đi không tồn tại.");
    }

    if (existing.status !== OutgoingDocumentStatus.FORMAT_CHECK) {
      throw new InvalidTransitionError(
        `Không thể kiểm tra thể thức ở trạng thái hiện tại (${existing.status}). Yêu cầu FORMAT_CHECK.`
      );
    }

    const resource: AuthorizationResource = {
      id: input.documentId,
      type: "document",
      scope: "school",
      primaryOwnerId: existing.document.registeredById,
      createdById: existing.document.registeredById,
      drafterId: existing.document.registeredById,
    };

    await assertAuthorized(user, "document.outgoing.approve_format", resource);

    return prisma.$transaction(async (tx) => {
      const now = new Date();
      const updatedWorkflow = await tx.documentOutgoingWorkflow.update({
        where: { documentId: input.documentId },
        data: {
          status: OutgoingDocumentStatus.AUTHORIZED_SIGN,
          formatApprovedAt: now,
          formatReviewerId: user.id,
          formatReviewNotes: input.notes || existing.formatReviewNotes,
        },
      });

      await tx.document.update({
        where: { id: input.documentId },
        data: {
          status: mapOutgoingWorkflowStatusToDocumentStatus(OutgoingDocumentStatus.AUTHORIZED_SIGN),
        },
      });

      await auditService.logEvent(tx, {
        actorId: user.id,
        action: "DOCUMENT_FORMAT_APPROVED",
        entityType: AuditEntityType.DOCUMENT,
        entityId: input.documentId,
        requestId,
        beforeData: { status: existing.status },
        afterData: {
          status: updatedWorkflow.status,
          formatApprovedAt: now,
          formatReviewerId: user.id,
        },
      });

      await publishOutboxEvent(tx, {
        eventType: "DOCUMENT_FORMAT_APPROVED",
        aggregateType: OutboxAggregateType.DOCUMENT,
        aggregateId: input.documentId,
        payload: {
          documentId: input.documentId,
          formatReviewerId: user.id,
          status: updatedWorkflow.status,
        },
      });

      return updatedWorkflow;
    });
  }

  /**
   * 6. SIGN DOCUMENT (Authorized Person Signature)
   * Hiệu trưởng or Phó Hiệu trưởng (ký thay) applies personal digital signature under NĐ 68/2024.
   * Separation of duties: Format Checker CANNOT sign! Clerk CANNOT sign! Staff CANNOT sign!
   */
  static async signDocument(
    input: SignDocumentInput,
    actor: AuthenticatedUserContext | SessionPayload,
    context?: { requestId?: string }
  ) {
    const user = await resolveUserContext(actor);
    const requestId = context?.requestId || `req_${Date.now()}`;

    const existing = await prisma.documentOutgoingWorkflow.findUnique({
      where: { documentId: input.documentId },
      include: { document: true },
    });

    if (!existing) {
      throw new NotFoundError("Hồ sơ văn bản đi không tồn tại.");
    }

    if (existing.status !== OutgoingDocumentStatus.AUTHORIZED_SIGN) {
      throw new InvalidTransitionError(
        `Văn bản chưa sẵn sàng để ký chức danh (Trạng thái hiện tại: ${existing.status}). Cần hoàn thành kiểm tra thể thức.`
      );
    }

    if (existing.authorizedSignedAt) {
      throw new InvalidTransitionError(
        "Văn bản đã được ký chức danh lãnh đạo. Không thể ký lại mà không tạo bản sửa đổi (revision)."
      );
    }

    // Separation of Duties check: Format reviewer cannot sign as authorized signer!
    if (existing.formatReviewerId === user.id) {
      throw new ForbiddenError(
        "Cán bộ kiểm tra thể thức không được tự ký thẩm quyền văn bản (Format Checker != Signer)."
      );
    }

    const resource: AuthorizationResource = {
      id: input.documentId,
      type: "document",
      scope: "school",
      primaryOwnerId: existing.document.registeredById,
      createdById: existing.document.registeredById,
      drafterId: existing.document.registeredById,
      formatReviewerId: existing.formatReviewerId || undefined,
    };

    // Determine appropriate sign action
    let signAction: "document.outgoing.authorized_sign" | "document.outgoing.sign_kt" =
      "document.outgoing.authorized_sign";
    const pos = (user.activePositionCode || "").toUpperCase();
    if (pos.includes("PHO_HIEU_TRUONG") || pos.includes("PHT")) {
      signAction = "document.outgoing.sign_kt";
    }

    await assertAuthorized(user, signAction, resource);

    return prisma.$transaction(async (tx) => {
      const now = new Date();
      const signingCapacity =
        input.signingCapacity ||
        (signAction === "document.outgoing.sign_kt"
          ? "KT. HIỆU TRƯỞNG - PHÓ HIỆU TRƯỞNG"
          : "HIỆU TRƯỞNG");

      // 1. Create SignatureRecord (Nghị định 68/2024/NĐ-CP)
      const signatureRecord = await tx.signatureRecord.create({
        data: {
          documentId: input.documentId,
          version: existing.currentVersion,
          signerUserId: user.id,
          signerAssignmentId: (user as any).activeAssignmentId || null,
          signingCapacity,
          signatureType: input.signatureType || SignatureType.PERSONAL_DIGITAL,
          certificateMetadata: (input.certificateMetadata as Prisma.InputJsonValue) || {
            provider: "Ban Cơ yếu Chính phủ",
            verifiedAt: now.toISOString(),
            status: "VALID",
          },
          signedAt: now,
          verificationStatus: SignatureVerificationStatus.VALID,
        },
      });

      // 2. Update workflow record
      const updatedWorkflow = await tx.documentOutgoingWorkflow.update({
        where: { documentId: input.documentId },
        data: {
          authorizedSignerId: user.id,
          authorizedSignedAt: now,
          signingNotes: input.signingNotes,
        },
      });

      // 3. Update canonical document record
      await tx.document.update({
        where: { id: input.documentId },
        data: {
          signerName: user.name,
          signerTitle: signingCapacity,
          status: mapOutgoingWorkflowStatusToDocumentStatus(existing.status),
        },
      });

      // 4. Audit log
      await auditService.logEvent(tx, {
        actorId: user.id,
        action: "DOCUMENT_AUTHORIZED_SIGNED",
        entityType: AuditEntityType.DOCUMENT,
        entityId: input.documentId,
        requestId,
        afterData: {
          signerUserId: user.id,
          signingCapacity,
          signatureRecordId: signatureRecord.id,
          signedAt: now,
          version: existing.currentVersion,
        },
      });

      // 5. Outbox event
      await publishOutboxEvent(tx, {
        eventType: "DOCUMENT_AUTHORIZED_SIGNED",
        aggregateType: OutboxAggregateType.DOCUMENT,
        aggregateId: input.documentId,
        payload: {
          documentId: input.documentId,
          signatureRecordId: signatureRecord.id,
          signerUserId: user.id,
          signingCapacity,
        },
      });

      return { workflow: updatedWorkflow, signatureRecord };
    });
  }

  /**
   * 7. ASSIGN OUTGOING NUMBER
   * Văn thư allocates sequential outgoing number and official date.
   * Invariant: Document MUST be authorized-signed before numbering.
   * Separation of duties: Signer CANNOT assign number! Only Văn thư can assign number.
   */
  static async assignOutgoingNumber(
    input: AssignOutgoingNumberInput,
    actor: AuthenticatedUserContext | SessionPayload,
    context?: { requestId?: string }
  ) {
    const user = await resolveUserContext(actor);
    const requestId = context?.requestId || `req_${Date.now()}`;

    const existing = await prisma.documentOutgoingWorkflow.findUnique({
      where: { documentId: input.documentId },
      include: { document: true },
    });

    if (!existing) {
      throw new NotFoundError("Hồ sơ văn bản đi không tồn tại.");
    }

    if (!existing.authorizedSignedAt) {
      throw new InvalidTransitionError(
        "Văn bản chưa có chữ ký số của người có thẩm quyền. Không được cấp số đi trước khi ký."
      );
    }

    // Separation of Duties check: Signer cannot assign number!
    OutgoingDocumentStateMachine.assertSignerNotNumberer(existing.authorizedSignerId, user.id);
    if (existing.document.signerName === user.name) {
      throw new ForbiddenError(
        "Người ký văn bản không được tự cấp số hoặc đóng dấu số cơ quan (Signer != Numberer)."
      );
    }

    const resource: AuthorizationResource = {
      id: input.documentId,
      type: "document",
      scope: "school",
      primaryOwnerId: existing.document.registeredById,
      createdById: existing.document.registeredById,
      signerId: existing.authorizedSignerId || undefined,
      authorizedSignerId: existing.authorizedSignerId || undefined,
    };

    await assertAuthorized(user, "document.outgoing.assign_number", resource);

    const now = new Date();
    const documentYear = now.getFullYear();

    return prisma.$transaction(async (tx) => {
      // Atomic sequential counter for VAN_BAN_DI in current year (race-free)
      const allocatedNumber = await getNextRegistrationNumber(DocumentType.VAN_BAN_DI, documentYear, tx);

      const notation = input.codeNotation || "QĐ-CĐKTCNQN";
      const outgoingNumberStr = input.outgoingNumberStr || `${allocatedNumber}/${notation}`;

      const updatedWorkflow = await tx.documentOutgoingWorkflow.update({
        where: { documentId: input.documentId },
        data: {
          status: OutgoingDocumentStatus.NUMBERED,
          numberedAt: now,
          numbererId: user.id,
          outgoingNumber: allocatedNumber,
          outgoingNumberStr,
        },
      });

      await tx.document.update({
        where: { id: input.documentId },
        data: {
          originalNumber: outgoingNumberStr,
          registrationNumber: allocatedNumber,
          issuedDate: input.issuedDate ? new Date(input.issuedDate) : now,
          status: mapOutgoingWorkflowStatusToDocumentStatus(OutgoingDocumentStatus.NUMBERED),
          securityLevel: input.securityLevel || existing.document.securityLevel,
          urgency: input.urgency || existing.document.urgency,
        },
      });

      await auditService.logEvent(tx, {
        actorId: user.id,
        action: "DOCUMENT_NUMBERED",
        entityType: AuditEntityType.DOCUMENT,
        entityId: input.documentId,
        requestId,
        beforeData: { status: existing.status },
        afterData: {
          status: updatedWorkflow.status,
          outgoingNumber: allocatedNumber,
          outgoingNumberStr,
          numberedAt: now,
          numbererId: user.id,
        },
      });

      await publishOutboxEvent(tx, {
        eventType: "DOCUMENT_NUMBERED",
        aggregateType: OutboxAggregateType.DOCUMENT,
        aggregateId: input.documentId,
        payload: {
          documentId: input.documentId,
          outgoingNumber: allocatedNumber,
          outgoingNumberStr,
          numbererId: user.id,
        },
      });

      return updatedWorkflow;
    });
  }

  /**
   * 8. ORGANIZATION SIGN (Văn thư đóng dấu số cơ quan)
   * Văn thư applies institutional digital certificate under NĐ 30/2020 & NĐ 68/2024.
   * Invariant: Document MUST be NUMBERED before organization sign.
   * Separation of duties: Signer CANNOT organization-sign! Only Văn thư can organization-sign.
   */
  static async organizationSign(
    input: OrganizationSignInput,
    actor: AuthenticatedUserContext | SessionPayload,
    context?: { requestId?: string }
  ) {
    const user = await resolveUserContext(actor);
    const requestId = context?.requestId || `req_${Date.now()}`;

    const existing = await prisma.documentOutgoingWorkflow.findUnique({
      where: { documentId: input.documentId },
      include: { document: true },
    });

    if (!existing) {
      throw new NotFoundError("Hồ sơ văn bản đi không tồn tại.");
    }

    if (existing.status !== OutgoingDocumentStatus.NUMBERED || !existing.outgoingNumberStr) {
      throw new InvalidTransitionError(
        "Văn bản phải được cấp số và ngày ban hành trước khi đóng dấu số cơ quan (Yêu cầu trạng thái NUMBERED)."
      );
    }

    // Separation of Duties check: Signer cannot organization-sign!
    OutgoingDocumentStateMachine.assertSignerNotOrganizationSigner(
      existing.authorizedSignerId,
      user.id
    );
    if (existing.document.signerName === user.name) {
      throw new ForbiddenError(
        "Người ký văn bản không được tự đóng dấu số cơ quan (Signer != Org Signer)."
      );
    }

    const resource: AuthorizationResource = {
      id: input.documentId,
      type: "document",
      scope: "school",
      primaryOwnerId: existing.document.registeredById,
      createdById: existing.document.registeredById,
      signerId: existing.authorizedSignerId || undefined,
      authorizedSignerId: existing.authorizedSignerId || undefined,
    };

    await assertAuthorized(user, "document.outgoing.organization_sign", resource);

    return prisma.$transaction(async (tx) => {
      const now = new Date();

      // 1. Create Organization Digital Signature Record
      const signatureRecord = await tx.signatureRecord.create({
        data: {
          documentId: input.documentId,
          version: existing.currentVersion,
          signerUserId: user.id,
          signerAssignmentId: (user as any).activeAssignmentId || null,
          signingCapacity: getOfficialSigningCapacity("VĂN PHÒNG"),
          signatureType: SignatureType.ORGANIZATION_DIGITAL,
          certificateMetadata: (input.certificateMetadata as Prisma.InputJsonValue) || {
            organization: INSTITUTION_CONFIG.officialName.toUpperCase(),
            ca: "Ban Cơ yếu Chính phủ - Cục Chứng thực số và Bảo mật thông tin",
            signedAt: now.toISOString(),
            status: "VALID",
          },
          signedAt: now,
          verificationStatus: SignatureVerificationStatus.VALID,
        },
      });

      // 2. Update workflow
      const updatedWorkflow = await tx.documentOutgoingWorkflow.update({
        where: { documentId: input.documentId },
        data: {
          status: OutgoingDocumentStatus.ORGANIZATION_SIGNED,
          orgSignedAt: now,
          orgSignerId: user.id,
        },
      });

      // 2b. Synchronize Document.status under ADR-004
      await tx.document.update({
        where: { id: input.documentId },
        data: {
          status: mapOutgoingWorkflowStatusToDocumentStatus(OutgoingDocumentStatus.ORGANIZATION_SIGNED),
        },
      });

      // 3. Audit log
      await auditService.logEvent(tx, {
        actorId: user.id,
        action: "DOCUMENT_ORGANIZATION_SIGNED",
        entityType: AuditEntityType.DOCUMENT,
        entityId: input.documentId,
        requestId,
        beforeData: { status: existing.status },
        afterData: {
          status: updatedWorkflow.status,
          orgSignedAt: now,
          orgSignerId: user.id,
          signatureRecordId: signatureRecord.id,
        },
      });

      // 4. Outbox event
      await publishOutboxEvent(tx, {
        eventType: "DOCUMENT_ORGANIZATION_SIGNED",
        aggregateType: OutboxAggregateType.DOCUMENT,
        aggregateId: input.documentId,
        payload: {
          documentId: input.documentId,
          signatureRecordId: signatureRecord.id,
          orgSignerId: user.id,
        },
      });

      return { workflow: updatedWorkflow, signatureRecord };
    });
  }

  /**
   * 9. ISSUE DOCUMENT (Phát hành)
   * Văn thư officially dispatches the signed and sealed document to recipients.
   * Invariant: Document MUST be ORGANIZATION_SIGNED before issuance.
   */
  static async issueDocument(
    input: IssueDocumentInput,
    actor: AuthenticatedUserContext | SessionPayload,
    context?: { requestId?: string }
  ) {
    const user = await resolveUserContext(actor);
    const requestId = context?.requestId || `req_${Date.now()}`;

    const existing = await prisma.documentOutgoingWorkflow.findUnique({
      where: { documentId: input.documentId },
      include: { document: true },
    });

    if (!existing) {
      throw new NotFoundError("Hồ sơ văn bản đi không tồn tại.");
    }

    if (existing.status !== OutgoingDocumentStatus.ORGANIZATION_SIGNED) {
      throw new InvalidTransitionError(
        "Văn bản phải được đóng dấu số cơ quan trước khi phát hành (Yêu cầu trạng thái ORGANIZATION_SIGNED)."
      );
    }

    const resource: AuthorizationResource = {
      id: input.documentId,
      type: "document",
      scope: "school",
      primaryOwnerId: existing.document.registeredById,
      createdById: existing.document.registeredById,
    };

    await assertAuthorized(user, "document.outgoing.issue", resource);

    return prisma.$transaction(async (tx) => {
      const now = new Date();
      const recipientList = input.recipientList || existing.document.recipientList || "Nội bộ và các đơn vị liên quan";
      const deliveryMethod = input.deliveryMethod || "TRUC_TUYEN_VA_VAN_BAN_GIAY";

      // 1. Update workflow
      const updatedWorkflow = await tx.documentOutgoingWorkflow.update({
        where: { documentId: input.documentId },
        data: {
          status: OutgoingDocumentStatus.ISSUED,
          issuedAt: now,
          issuerId: user.id,
          recipientList,
          deliveryMethod,
        },
      });

      // 2. Update canonical Document status
      await tx.document.update({
        where: { id: input.documentId },
        data: {
          status: mapOutgoingWorkflowStatusToDocumentStatus(OutgoingDocumentStatus.ISSUED),
          recipientList,
        },
      });

      // 3. Audit log
      await auditService.logEvent(tx, {
        actorId: user.id,
        action: "OUTGOING_DOCUMENT_ISSUED",
        entityType: AuditEntityType.DOCUMENT,
        entityId: input.documentId,
        requestId,
        beforeData: { status: existing.status },
        afterData: {
          status: updatedWorkflow.status,
          issuedAt: now,
          issuerId: user.id,
          recipientList,
        },
      });

      // 4. Outbox event
      await publishOutboxEvent(tx, {
        eventType: OutboxEventType.DOCUMENT_ISSUED_NOTIFICATION,
        aggregateType: OutboxAggregateType.DOCUMENT,
        aggregateId: input.documentId,
        payload: {
          documentId: input.documentId,
          issuerId: user.id,
          recipientList,
          outgoingNumberStr: existing.outgoingNumberStr,
        },
      });

      return updatedWorkflow;
    });
  }

  /**
   * 10. CREATE DOCUMENT REVISION (Version Immutability & Re-baseline)
   * If a signed document requires modification:
   * - Old version content & signatures are preserved immutably.
   * - Version increments (N -> N+1).
   * - Approval and signature states are reset to DRAFT for the new version.
   */
  static async createDocumentRevision(
    input: CreateDocumentRevisionInput,
    actor: AuthenticatedUserContext | SessionPayload,
    context?: { requestId?: string }
  ) {
    const user = await resolveUserContext(actor);
    const requestId = context?.requestId || `req_${Date.now()}`;

    if (!input.changeReason || !input.changeReason.trim()) {
      throw new ValidationError("Lý do tạo phiên bản sửa đổi văn bản là bắt buộc.");
    }

    const existing = await prisma.documentOutgoingWorkflow.findUnique({
      where: { documentId: input.documentId },
      include: { document: true },
    });

    if (!existing) {
      throw new NotFoundError("Hồ sơ văn bản đi không tồn tại.");
    }

    const resource: AuthorizationResource = {
      id: input.documentId,
      type: "document",
      scope: "personal",
      primaryOwnerId: existing.document.registeredById,
      createdById: existing.document.registeredById,
      drafterId: existing.document.registeredById,
    };

    await assertAuthorized(user, "document.outgoing.draft", resource);

    return prisma.$transaction(async (tx) => {
      const newVersion = existing.currentVersion + 1;
      const now = new Date();

      // Invalidate signatures on the previous version
      await tx.signatureRecord.updateMany({
        where: {
          documentId: input.documentId,
          version: existing.currentVersion,
        },
        data: {
          verificationStatus: SignatureVerificationStatus.REVOKED,
        },
      });

      // Reset workflow for new version
      const updatedWorkflow = await tx.documentOutgoingWorkflow.update({
        where: { documentId: input.documentId },
        data: {
          currentVersion: newVersion,
          status: OutgoingDocumentStatus.DRAFT,
          contentReviewSubmittedAt: null,
          contentReviewerId: null,
          contentApprovedAt: null,
          contentReviewNotes: `[Phiên bản ${newVersion}]: Tạo mới từ lý do: ${input.changeReason}`,
          formatReviewSubmittedAt: null,
          formatReviewerId: null,
          formatApprovedAt: null,
          formatReviewNotes: null,
          authorizedSignerId: null,
          authorizedSignedAt: null,
          signingNotes: null,
          numberedAt: null,
          numbererId: null,
          outgoingNumber: null,
          outgoingNumberStr: null,
          orgSignedAt: null,
          orgSignerId: null,
          issuedAt: null,
          issuerId: null,
        },
      });

      // Update Document record
      await tx.document.update({
        where: { id: input.documentId },
        data: {
          version: newVersion,
          summary: input.summary || existing.document.summary,
          status: mapOutgoingWorkflowStatusToDocumentStatus(OutgoingDocumentStatus.DRAFT),
          notes: `Phiên bản ${newVersion} - Lý do: ${input.changeReason}`,
        },
      });

      // Add new attachment if file uploaded
      if (input.fileUrl) {
        await tx.documentAttachment.create({
          data: {
            documentId: input.documentId,
            fileName: input.fileName || `Văn bản đi phiên bản ${newVersion}`,
            fileUrl: input.fileUrl,
            fileSize: input.fileSize || 0,
            mimeType: "application/pdf",
          },
        });
      }

      await auditService.logEvent(tx, {
        actorId: user.id,
        action: "DOCUMENT_REVISION_CREATED",
        entityType: AuditEntityType.DOCUMENT,
        entityId: input.documentId,
        requestId,
        beforeData: { version: existing.currentVersion, status: existing.status },
        afterData: { version: newVersion, status: updatedWorkflow.status, changeReason: input.changeReason },
      });

      await publishOutboxEvent(tx, {
        eventType: "DOCUMENT_REVISION_CREATED",
        aggregateType: OutboxAggregateType.DOCUMENT,
        aggregateId: input.documentId,
        payload: {
          documentId: input.documentId,
          version: newVersion,
          changeReason: input.changeReason,
          drafterId: user.id,
        },
      });

      return updatedWorkflow;
    });
  }

  /**
   * Direct Edit Guard: Verifies that direct edits on signed versions are rejected.
   */
  static async updateDraftContent(
    documentId: string,
    data: { summary?: string; notes?: string },
    actor: AuthenticatedUserContext | SessionPayload
  ) {
    const existing = await prisma.documentOutgoingWorkflow.findUnique({
      where: { documentId },
    });

    if (!existing) {
      throw new NotFoundError("Hồ sơ văn bản đi không tồn tại.");
    }

    // Version Immutability check
    OutgoingDocumentService.assertDocumentModifiable(existing);

    return prisma.document.update({
      where: { id: documentId },
      data,
    });
  }

  /**
   * Get Outgoing Document details with full workflow and signatures.
   */
  static async getOutgoingDocument(documentId: string): Promise<OutgoingWorkflowWithDetails | null> {
    return prisma.documentOutgoingWorkflow.findUnique({
      where: { documentId },
      include: {
        document: {
          include: {
            attachments: true,
            signatures: {
              orderBy: { signedAt: "asc" },
            },
          },
        },
        contentReviewer: { select: { id: true, name: true, email: true } },
        formatReviewer: { select: { id: true, name: true, email: true } },
        authorizedSigner: { select: { id: true, name: true, email: true } },
        numberer: { select: { id: true, name: true, email: true } },
        orgSigner: { select: { id: true, name: true, email: true } },
        issuer: { select: { id: true, name: true, email: true } },
      },
    }) as unknown as OutgoingWorkflowWithDetails | null;
  }

  /**
   * 11. DELIVER DOCUMENT (Chuyển phát văn bản đến nơi nhận)
   * Transition: ISSUED -> DELIVERED
   * Synchronizes Document.status -> DA_HOAN_THANH under ADR-004.
   */
  static async deliverDocument(
    input: { documentId: string; deliveryNotes?: string },
    actor: AuthenticatedUserContext | SessionPayload,
    context?: { requestId?: string }
  ) {
    const user = await resolveUserContext(actor);
    const requestId = context?.requestId || `req_${Date.now()}`;

    const existing = await prisma.documentOutgoingWorkflow.findUnique({
      where: { documentId: input.documentId },
      include: { document: true },
    });

    if (!existing) {
      throw new NotFoundError("Hồ sơ văn bản đi không tồn tại.");
    }

    OutgoingDocumentStateMachine.assertTransition(
      existing.status,
      OutgoingDocumentStatus.DELIVERED,
      input.documentId
    );

    const resource: AuthorizationResource = {
      id: input.documentId,
      type: "document",
      scope: "school",
      primaryOwnerId: existing.document.registeredById,
      createdById: existing.document.registeredById,
    };

    await assertAuthorized(user, "document.outgoing.issue", resource);

    return prisma.$transaction(async (tx) => {
      const updatedWorkflow = await tx.documentOutgoingWorkflow.update({
        where: { documentId: input.documentId },
        data: {
          status: OutgoingDocumentStatus.DELIVERED,
        },
      });

      await tx.document.update({
        where: { id: input.documentId },
        data: {
          status: mapOutgoingWorkflowStatusToDocumentStatus(OutgoingDocumentStatus.DELIVERED),
        },
      });

      await auditService.logEvent(tx, {
        actorId: user.id,
        action: "OUTGOING_DOCUMENT_DELIVERED",
        entityType: AuditEntityType.DOCUMENT,
        entityId: input.documentId,
        requestId,
        beforeData: { status: existing.status },
        afterData: { status: updatedWorkflow.status },
      });

      return updatedWorkflow;
    });
  }

  /**
   * 12. FILE / ARCHIVE OUTGOING DOCUMENT (Lưu trữ hồ sơ văn bản đi)
   * Transition: ISSUED | DELIVERED -> FILED | ARCHIVED
   * Synchronizes Document.status -> LUU_THEO_DOI under ADR-004.
   */
  static async fileOutgoingDocument(
    input: { documentId: string; archiveNow?: boolean; filingNotes?: string },
    actor: AuthenticatedUserContext | SessionPayload,
    context?: { requestId?: string }
  ) {
    const user = await resolveUserContext(actor);
    const requestId = context?.requestId || `req_${Date.now()}`;

    const existing = await prisma.documentOutgoingWorkflow.findUnique({
      where: { documentId: input.documentId },
      include: { document: true },
    });

    if (!existing) {
      throw new NotFoundError("Hồ sơ văn bản đi không tồn tại.");
    }

    const targetStatus = input.archiveNow
      ? OutgoingDocumentStatus.ARCHIVED
      : OutgoingDocumentStatus.FILED;

    OutgoingDocumentStateMachine.assertTransition(
      existing.status,
      targetStatus,
      input.documentId
    );

    const resource: AuthorizationResource = {
      id: input.documentId,
      type: "document",
      scope: "school",
      primaryOwnerId: existing.document.registeredById,
      createdById: existing.document.registeredById,
    };

    await assertAuthorized(user, "document.outgoing.issue", resource);

    return prisma.$transaction(async (tx) => {
      const now = new Date();
      const updatedWorkflow = await tx.documentOutgoingWorkflow.update({
        where: { documentId: input.documentId },
        data: {
          status: targetStatus,
          filedAt: now,
          filedById: user.id,
          ...(input.archiveNow ? { archivedAt: now, archivedById: user.id } : {}),
        },
      });

      await tx.document.update({
        where: { id: input.documentId },
        data: {
          status: mapOutgoingWorkflowStatusToDocumentStatus(targetStatus),
          archiveReason: input.filingNotes,
          ...(input.archiveNow ? { archivedAt: now, archivedById: user.id } : {}),
        },
      });

      await auditService.logEvent(tx, {
        actorId: user.id,
        action: "OUTGOING_DOCUMENT_FILED",
        entityType: AuditEntityType.DOCUMENT,
        entityId: input.documentId,
        requestId,
        beforeData: { status: existing.status },
        afterData: { status: updatedWorkflow.status },
      });

      return updatedWorkflow;
    });
  }
}
