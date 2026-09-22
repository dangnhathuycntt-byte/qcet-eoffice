/**
 * CANONICAL DOCUMENT STATE MACHINES (Nghị định 30/2020/NĐ-CP & Nghị định 68/2024/NĐ-CP)
 *
 * Sprint 5 Master Cutover:
 * 1. IncomingDocumentStateMachine:
 *    RECEIVED -> REGISTERED -> PRESENTED -> DIRECTED -> ASSIGNED_TO_LEAD_UNIT
 *    -> UNIT_ASSIGNED_PERSON -> IN_PROGRESS -> RESOLVED -> FILED -> ARCHIVED
 *
 * 2. OutgoingDocumentStateMachine:
 *    DRAFT -> CONTENT_REVIEW -> FORMAT_CHECK -> AUTHORIZED_SIGN
 *    -> NUMBERED -> ORGANIZATION_SIGNED -> ISSUED -> DELIVERED -> FILED -> ARCHIVED
 *
 * Invariants:
 * - Separation of Duties (SoD):
 *   - Drafter != Content Reviewer
 *   - Signer != Numberer
 *   - Signer != Organization Signer
 * - Document Immutability:
 *   - Once signed (AUTHORIZED_SIGN / NUMBERED / ORGANIZATION_SIGNED / ISSUED / DA_HOAN_THANH),
 *     the document and its attachments are strictly immutable.
 *   - Any modifications require creating a new revision (version N -> N+1) or an erratum document.
 */

import {
  IncomingDocumentStatus,
  OutgoingDocumentStatus,
  DocumentStatus,
} from "@prisma/client";
import { InvalidTransitionError, ValidationError, ForbiddenError } from "@/server/api/errors";

// ============================================================================
// INCOMING DOCUMENT STATE MACHINE
// ============================================================================

export const INCOMING_DOCUMENT_TRANSITIONS: Record<
  IncomingDocumentStatus,
  IncomingDocumentStatus[]
> = {
  RECEIVED: [IncomingDocumentStatus.REGISTERED],
  REGISTERED: [
    IncomingDocumentStatus.PRESENTED,
    IncomingDocumentStatus.DIRECTED,
    IncomingDocumentStatus.ASSIGNED_TO_LEAD_UNIT,
  ],
  PRESENTED: [
    IncomingDocumentStatus.DIRECTED,
    IncomingDocumentStatus.ASSIGNED_TO_LEAD_UNIT,
  ],
  DIRECTED: [
    IncomingDocumentStatus.ASSIGNED_TO_LEAD_UNIT,
    IncomingDocumentStatus.UNIT_ASSIGNED_PERSON,
    IncomingDocumentStatus.IN_PROGRESS,
  ],
  ASSIGNED_TO_LEAD_UNIT: [
    IncomingDocumentStatus.UNIT_ASSIGNED_PERSON,
    IncomingDocumentStatus.IN_PROGRESS,
  ],
  UNIT_ASSIGNED_PERSON: [
    IncomingDocumentStatus.IN_PROGRESS,
    IncomingDocumentStatus.RESOLVED,
  ],
  IN_PROGRESS: [IncomingDocumentStatus.RESOLVED],
  RESOLVED: [IncomingDocumentStatus.FILED, IncomingDocumentStatus.ARCHIVED],
  FILED: [IncomingDocumentStatus.ARCHIVED],
  ARCHIVED: [],
};

export class IncomingDocumentStateMachine {
  /**
   * Check whether a transition from one incoming status to another is permitted.
   */
  static canTransition(
    fromStatus: IncomingDocumentStatus,
    toStatus: IncomingDocumentStatus
  ): boolean {
    if (fromStatus === toStatus) return true;
    const allowed = INCOMING_DOCUMENT_TRANSITIONS[fromStatus] || [];
    return allowed.includes(toStatus);
  }

  /**
   * Assert that a transition is valid or throw an InvalidTransitionError.
   */
  static assertTransition(
    fromStatus: IncomingDocumentStatus,
    toStatus: IncomingDocumentStatus,
    documentId?: string
  ): void {
    if (!this.canTransition(fromStatus, toStatus)) {
      throw new InvalidTransitionError(
        `Không thể chuyển trạng thái văn bản đến từ '${fromStatus}' sang '${toStatus}'. Chuyển đổi không hợp lệ theo quy trình Nghị định 30/2020.`
      );
    }
  }

  /**
   * Check if incoming document has reached terminal / finalized state.
   */
  static isFinalized(status: IncomingDocumentStatus): boolean {
    return (
      status === IncomingDocumentStatus.RESOLVED ||
      status === IncomingDocumentStatus.FILED ||
      status === IncomingDocumentStatus.ARCHIVED
    );
  }
}

// ============================================================================
// OUTGOING DOCUMENT STATE MACHINE
// ============================================================================

export const OUTGOING_DOCUMENT_TRANSITIONS: Record<
  OutgoingDocumentStatus,
  OutgoingDocumentStatus[]
> = {
  DRAFT: [
    OutgoingDocumentStatus.CONTENT_REVIEW,
    OutgoingDocumentStatus.FORMAT_CHECK,
  ],
  CONTENT_REVIEW: [
    OutgoingDocumentStatus.DRAFT,
    OutgoingDocumentStatus.FORMAT_CHECK,
    OutgoingDocumentStatus.AUTHORIZED_SIGN,
  ],
  FORMAT_CHECK: [
    OutgoingDocumentStatus.CONTENT_REVIEW,
    OutgoingDocumentStatus.AUTHORIZED_SIGN,
  ],
  AUTHORIZED_SIGN: [
    OutgoingDocumentStatus.DRAFT, // When rejected or returned for revision
    OutgoingDocumentStatus.NUMBERED,
  ],
  NUMBERED: [OutgoingDocumentStatus.ORGANIZATION_SIGNED],
  ORGANIZATION_SIGNED: [OutgoingDocumentStatus.ISSUED],
  ISSUED: [
    OutgoingDocumentStatus.DELIVERED,
    OutgoingDocumentStatus.FILED,
    OutgoingDocumentStatus.ARCHIVED,
  ],
  DELIVERED: [OutgoingDocumentStatus.FILED, OutgoingDocumentStatus.ARCHIVED],
  FILED: [OutgoingDocumentStatus.ARCHIVED],
  ARCHIVED: [],
};

export class OutgoingDocumentStateMachine {
  /**
   * Check whether a transition from one outgoing status to another is permitted.
   */
  static canTransition(
    fromStatus: OutgoingDocumentStatus,
    toStatus: OutgoingDocumentStatus
  ): boolean {
    if (fromStatus === toStatus) return true;
    const allowed = OUTGOING_DOCUMENT_TRANSITIONS[fromStatus] || [];
    return allowed.includes(toStatus);
  }

  /**
   * Assert that a transition is valid or throw an InvalidTransitionError.
   */
  static assertTransition(
    fromStatus: OutgoingDocumentStatus,
    toStatus: OutgoingDocumentStatus,
    documentId?: string
  ): void {
    if (!this.canTransition(fromStatus, toStatus)) {
      throw new InvalidTransitionError(
        `Không thể chuyển trạng thái văn bản đi từ '${fromStatus}' sang '${toStatus}'. Chuyển đổi không hợp lệ theo quy trình Nghị định 30/2020 & 68/2024.`
      );
    }
  }

  /**
   * Separation of Duties: Drafter cannot approve their own content.
   */
  static assertDrafterNotContentReviewer(
    drafterId?: string | null,
    reviewerId?: string | null
  ): void {
    if (drafterId && reviewerId && drafterId === reviewerId) {
      throw new ForbiddenError(
        "Người soạn thảo không được tự phê duyệt nội dung văn bản (SoD: Drafter != Content Reviewer)."
      );
    }
  }

  /**
   * Separation of Duties: Signer cannot allocate outgoing number.
   */
  static assertSignerNotNumberer(
    signerId?: string | null,
    numbererId?: string | null
  ): void {
    if (signerId && numbererId && signerId === numbererId) {
      throw new ForbiddenError(
        "Người ký văn bản không được tự cấp số đi (Separation of Duties: Signer != Numberer)."
      );
    }
  }

  /**
   * Separation of Duties: Signer cannot apply organization digital seal.
   */
  static assertSignerNotOrganizationSigner(
    signerId?: string | null,
    orgSignerId?: string | null
  ): void {
    if (signerId && orgSignerId && signerId === orgSignerId) {
      throw new ForbiddenError(
        "Người ký văn bản không được tự đóng dấu số cơ quan (Separation of Duties: Signer != Org Signer)."
      );
    }
  }

  /**
   * Checks if an outgoing document is already signed or issued.
   */
  static isSignedOrIssued(
    status: OutgoingDocumentStatus | string,
    hasSignatureRecord = false,
    hasAuthorizedSignedAt = false
  ): boolean {
    if (hasSignatureRecord || hasAuthorizedSignedAt) return true;
    const signedStatuses: string[] = [
      OutgoingDocumentStatus.NUMBERED,
      OutgoingDocumentStatus.ORGANIZATION_SIGNED,
      OutgoingDocumentStatus.ISSUED,
      OutgoingDocumentStatus.DELIVERED,
      OutgoingDocumentStatus.FILED,
      OutgoingDocumentStatus.ARCHIVED,
    ];
    return signedStatuses.includes(status);
  }
}

// ============================================================================
// ADR-004 CANONICAL STATUS SYNCHRONIZATION MAPPING
// ============================================================================

/**
 * ADR-004 Canonical Synchronization Mapping:
 * Maps IncomingDocumentStatus (Tier 2a) to persisted DocumentStatus (Tier 1).
 *
 * Canonical Mapping Rules:
 * - RECEIVED, REGISTERED, PRESENTED, DIRECTED, ASSIGNED_TO_LEAD_UNIT, UNIT_ASSIGNED_PERSON -> CHO_PHAN_CONG
 * - IN_PROGRESS -> DANG_XU_LY
 * - RESOLVED -> DA_HOAN_THANH
 * - FILED, ARCHIVED -> LUU_THEO_DOI
 */
export function mapIncomingWorkflowStatusToDocumentStatus(
  status: IncomingDocumentStatus | string
): DocumentStatus {
  switch (status) {
    case IncomingDocumentStatus.RECEIVED:
    case IncomingDocumentStatus.REGISTERED:
    case IncomingDocumentStatus.PRESENTED:
    case IncomingDocumentStatus.DIRECTED:
    case IncomingDocumentStatus.ASSIGNED_TO_LEAD_UNIT:
    case IncomingDocumentStatus.UNIT_ASSIGNED_PERSON:
    case "RECEIVED":
    case "REGISTERED":
    case "PRESENTED":
    case "DIRECTED":
    case "ASSIGNED_TO_LEAD_UNIT":
    case "UNIT_ASSIGNED_PERSON":
      return DocumentStatus.CHO_PHAN_CONG;

    case IncomingDocumentStatus.IN_PROGRESS:
    case "IN_PROGRESS":
      return DocumentStatus.DANG_XU_LY;

    case IncomingDocumentStatus.RESOLVED:
    case "RESOLVED":
      return DocumentStatus.DA_HOAN_THANH;

    case IncomingDocumentStatus.FILED:
    case IncomingDocumentStatus.ARCHIVED:
    case "FILED":
    case "ARCHIVED":
      return DocumentStatus.LUU_THEO_DOI;

    default:
      throw new InvalidTransitionError(
        `Không xác định được trạng thái hành chính DocumentStatus tương ứng với IncomingWorkflowStatus '${status}'.`
      );
  }
}

/**
 * ADR-004 Canonical Synchronization Mapping:
 * Maps OutgoingDocumentStatus (Tier 2b) to persisted DocumentStatus (Tier 1).
 *
 * Canonical Mapping Rules:
 * - DRAFT, CONTENT_REVIEW, FORMAT_CHECK -> DANG_XU_LY
 * - AUTHORIZED_SIGN -> CHO_PHE_DUYET
 * - NUMBERED, ORGANIZATION_SIGNED -> DANG_XU_LY
 * - ISSUED, DELIVERED -> DA_HOAN_THANH
 * - FILED, ARCHIVED -> LUU_THEO_DOI
 */
export function mapOutgoingWorkflowStatusToDocumentStatus(
  status: OutgoingDocumentStatus | string
): DocumentStatus {
  switch (status) {
    case OutgoingDocumentStatus.DRAFT:
    case OutgoingDocumentStatus.CONTENT_REVIEW:
    case OutgoingDocumentStatus.FORMAT_CHECK:
    case "DRAFT":
    case "CONTENT_REVIEW":
    case "FORMAT_CHECK":
      return DocumentStatus.DANG_XU_LY;

    case OutgoingDocumentStatus.AUTHORIZED_SIGN:
    case "AUTHORIZED_SIGN":
      return DocumentStatus.CHO_PHE_DUYET;

    case OutgoingDocumentStatus.NUMBERED:
    case OutgoingDocumentStatus.ORGANIZATION_SIGNED:
    case "NUMBERED":
    case "ORGANIZATION_SIGNED":
      return DocumentStatus.DANG_XU_LY;

    case OutgoingDocumentStatus.ISSUED:
    case OutgoingDocumentStatus.DELIVERED:
    case "ISSUED":
    case "DELIVERED":
      return DocumentStatus.DA_HOAN_THANH;

    case OutgoingDocumentStatus.FILED:
    case OutgoingDocumentStatus.ARCHIVED:
    case "FILED":
    case "ARCHIVED":
      return DocumentStatus.LUU_THEO_DOI;

    default:
      throw new InvalidTransitionError(
        `Không xác định được trạng thái hành chính DocumentStatus tương ứng với OutgoingWorkflowStatus '${status}'.`
      );
  }
}

// ============================================================================
// DOCUMENT IMMUTABILITY AUDITOR
// ============================================================================

export interface DocumentImmutabilityTarget {
  status?: DocumentStatus | string | null;
  signerName?: string | null;
  signatures?: Array<unknown> | null;
  incomingWorkflow?: {
    status?: IncomingDocumentStatus | string | null;
  } | null;
  outgoingWorkflow?: {
    status?: OutgoingDocumentStatus | string | null;
    authorizedSignedAt?: Date | string | null;
  } | null;
}

/**
 * Checks whether a document is legally sealed / signed / finalized and therefore IMMUTABLE.
 * When immutable, no content, metadata, or attachments can be modified via generic update.
 * Invariant (ADR-004): Must freeze documents when DA_HOAN_THANH / ISSUED / ARCHIVED.
 */
export function isDocumentImmutable(doc: DocumentImmutabilityTarget): boolean {
  if (!doc) return false;

  // 1. Canonical document status is DA_HOAN_THANH, LUU_THEO_DOI, or final status string
  if (
    doc.status === DocumentStatus.DA_HOAN_THANH ||
    doc.status === "DA_HOAN_THANH" ||
    doc.status === DocumentStatus.LUU_THEO_DOI ||
    doc.status === "LUU_THEO_DOI" ||
    doc.status === "completed" ||
    doc.status === "ISSUED" ||
    doc.status === "ARCHIVED" ||
    doc.status === "FILED" ||
    doc.status === "DELIVERED" ||
    doc.status === "RESOLVED"
  ) {
    return true;
  }

  // 2. Contains digital signature records
  if (Array.isArray(doc.signatures) && doc.signatures.length > 0) {
    return true;
  }

  // 3. Outgoing workflow is signed, numbered, org-signed, issued, or filed
  if (doc.outgoingWorkflow) {
    if (doc.outgoingWorkflow.authorizedSignedAt) return true;
    const status = doc.outgoingWorkflow.status as OutgoingDocumentStatus | string | undefined;
    const finalOutgoingStatuses: (OutgoingDocumentStatus | string)[] = [
      OutgoingDocumentStatus.NUMBERED,
      OutgoingDocumentStatus.ORGANIZATION_SIGNED,
      OutgoingDocumentStatus.ISSUED,
      OutgoingDocumentStatus.DELIVERED,
      OutgoingDocumentStatus.FILED,
      OutgoingDocumentStatus.ARCHIVED,
      "NUMBERED",
      "ORGANIZATION_SIGNED",
      "ISSUED",
      "DELIVERED",
      "FILED",
      "ARCHIVED",
    ];
    if (status && finalOutgoingStatuses.includes(status)) {
      return true;
    }
  }

  // 4. Incoming workflow is resolved or filed
  if (doc.incomingWorkflow) {
    const status = doc.incomingWorkflow.status as IncomingDocumentStatus | string | undefined;
    const finalIncomingStatuses: (IncomingDocumentStatus | string)[] = [
      IncomingDocumentStatus.RESOLVED,
      IncomingDocumentStatus.FILED,
      IncomingDocumentStatus.ARCHIVED,
      "RESOLVED",
      "FILED",
      "ARCHIVED",
    ];
    if (status && finalIncomingStatuses.includes(status)) {
      return true;
    }
  }

  return false;
}

/**
 * Assert that document is not immutable, or throw ValidationError.
 */
export function assertDocumentNotImmutable(
  doc: DocumentImmutabilityTarget,
  operationDescription = "chỉnh sửa"
): void {
  if (isDocumentImmutable(doc)) {
    throw new ValidationError(
      `Văn bản đã ký hoặc ban hành là bất biến (immutable). Không thể ${operationDescription} trực tiếp qua generic PATCH. Vui lòng tạo bản sửa đổi (revision) hoặc văn bản đính chính.`,
      undefined,
      "IMMUTABLE_DOCUMENT"
    );
  }
}
