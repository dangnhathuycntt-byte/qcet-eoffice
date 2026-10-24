import type { Prisma } from "@prisma/client";
import { prisma as defaultPrisma } from "@qcet/db/prisma";
import type {
  DocumentItem,
  DocumentType,
  DocumentUrgency,
  DocumentSecurityLevel,
  DocumentStatus,
  DocumentAttachmentItem,
  DocumentDirectiveItem,
} from "@qcet/contracts/types/document";
import { getNextRegistrationNumber } from "./numbering-engine";
import type { AuthenticatedUser } from "@/server/api/request-context";
import type { AuthorizationContext } from "@/server/authorization/authorization-context";
import {
  buildDocumentReadWhere,
  buildInboxTypeWhere,
  canUpdateDocument,
  documentUserUnitIds,
} from "@/server/policies/document-policy";
import { OrganizationalUnitService } from "@/server/services/organization-unit-service";
import {
  isDocumentImmutable,
  isOutgoingUnderReview,
  patchTouchesLockedContent,
  OUTGOING_UNDER_REVIEW_CODE,
  OUTGOING_UNDER_REVIEW_MESSAGE,
  mapIncomingWorkflowStatusToDocumentStatus,
  mapOutgoingWorkflowStatusToDocumentStatus,
} from "./state-machine";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/api/errors";
import { DOCUMENT_DONE_STATUSES, type DocumentBucket } from "@qcet/shared/lib/documents/document-sidebar-buckets";
import { buildDocumentBucketWhere } from "./document-bucket-where";
import { outgoingAwaitingViewerWhere, outgoingQueueViewerOf } from "./outgoing-queue";
import {
  assertCanLinkTask,
  lockDocumentRows,
  normalizeLinkedTaskId,
  recordLinkedTaskChange,
  toLinkedTaskConflict,
} from "./linked-task-link";
import { logAuditEvent } from "@qcet/db/audit";
import type { UpdateDocumentInput } from "@qcet/contracts/documents";
import type { DocumentTypeCode } from "@qcet/shared/domain/documents/document-type-param";
import { isReturnedNote } from "@qcet/shared/domain/documents/outgoing-steps";

export {
  buildDocumentReadWhere,
  mapIncomingWorkflowStatusToDocumentStatus,
  mapOutgoingWorkflowStatusToDocumentStatus,
};

export interface CreateDocumentPayload {
  type: DocumentType;
  documentYear?: number;
  registrationNumber?: number;
  registeredDate?: string | Date;
  originalNumber: string;
  issuedDate: string | Date;
  issuingAuthority: string;
  category: string;
  summary: string;
  urgency?: DocumentUrgency;
  securityLevel?: DocumentSecurityLevel;
  dueDate?: string | Date | null;
  signerName?: string | null;
  signerTitle?: string | null;
  /** Đơn vị chủ trì — canonical `OrganizationalUnit.id` (hoặc `code`). */
  leadUnitId?: string | null;
  recipientList?: string | null;
  distributedCopies?: number | null;
  leadUserId?: string | null;
  status?: DocumentStatus;
  notes?: string | null;
  registeredById: string;
  attachments?: Array<{
    fileName: string;
    fileUrl: string;
    fileSize: number;
    mimeType: string;
    sha256Hash?: string | null;
    isOriginal?: boolean;
  }>;
}

export interface UpdateDocumentPayload {
  summary?: string;
  /** Số/ký hiệu và cơ quan ban hành: cho phép văn thư sửa sai sót khi vào sổ. */
  originalNumber?: string | null;
  issuingAuthority?: string | null;
  category?: string;
  urgency?: DocumentUrgency;
  securityLevel?: DocumentSecurityLevel;
  status?: DocumentStatus;
  dueDate?: string | Date | null;
  signerName?: string | null;
  signerTitle?: string | null;
  /** Đơn vị chủ trì — canonical `OrganizationalUnit.id` (hoặc `code`). */
  leadUnitId?: string | null;
  recipientList?: string | null;
  distributedCopies?: number | null;
  leadUserId?: string | null;
  notes?: string | null;
  linkedTaskId?: string | null;
}

export interface ListDocumentsFilter {
  type?: DocumentType;
  documentYear?: number;
  status?: DocumentStatus;
  /** Nhóm trạng thái của sidebar (cần kèm `type` là văn bản đến/đi). */
  bucket?: DocumentBucket;
  urgency?: DocumentUrgency;
  securityLevel?: DocumentSecurityLevel;
  /** Lọc theo đơn vị chủ trì — canonical `OrganizationalUnit.id`. */
  leadUnitId?: string;
  search?: string;
  limit?: number;
  offset?: number;
  userContext?: AuthenticatedUser | AuthorizationContext;
  authUser?: AuthenticatedUser | AuthorizationContext;
  aclWhere?: Prisma.DocumentWhereInput;
}

export type ListDocumentsResult = DocumentItem[] & {
  documents: DocumentItem[];
  total: number;
};

// Phase 9: the `Department` model and its `Document.draftingDept` /
// `Document.leadDepartment` relations were dropped. Unit ownership now travels
// through the incoming workflow's `leadUnit`, so no phantom relation may appear
// here — Prisma rejects any unknown include key.
const defaultInclude = {
  leadUser: {
    select: {
      id: true,
      name: true,
      title: true,
    },
  },
  registeredBy: {
    select: {
      id: true,
      name: true,
    },
  },
  attachments: true,
  directives: {
    include: {
      leader: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  // The directive's assigned unit is the unit of the task it generated, reached
  // through the document's `linkedTask`; `DocumentDirective.assignedDeptId` no
  // longer exists in the schema.
  linkedTask: {
    select: {
      id: true,
      code: true,
      archivedAt: true,
      title: true,
      status: true,
      progressPercent: true,
      dueDate: true,
      leadUnitId: true,
      leadUnit: { select: { id: true, name: true, code: true } },
    },
  },
  incomingWorkflow: {
    include: {
      leadUnit: { select: { id: true, name: true, code: true } },
      // Người phụ trách và thời điểm phân công: dùng cho luân chuyển và phần "Phụ trách" ở Quick View / Full Page
      unitAssignments: {
        include: { driUser: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  },
  outgoingWorkflow: true,
  // Nơi nhận trong trường: quyền đọc văn bản đi đã phát hành của đơn vị nhận (ADR-015, `deliveredUnitIds`).
  outgoingRecipients: { select: { kind: true, unitId: true } },
  signatures: true,
};

export function mapPrismaDocumentToItem(rawRecord: any): DocumentItem {
  // Nhiệm vụ đã lưu trữ ("xóa" trên giao diện) coi như không còn liên kết: không hiện ở dòng Nhiệm vụ, không trả linkedTaskId treo.
  const archivedLink = Boolean(rawRecord.linkedTask?.archivedAt);
  const record = archivedLink ? { ...rawRecord, linkedTask: null, linkedTaskId: null } : rawRecord;
  return {
    id: record.id,
    type: record.type,
    registrationNumber: record.registrationNumber,
    documentYear: record.documentYear,
    registeredDate:
      record.registeredDate instanceof Date
        ? record.registeredDate.toISOString()
        : String(record.registeredDate),
    originalNumber: record.originalNumber,
    issuedDate:
      record.issuedDate instanceof Date
        ? record.issuedDate.toISOString()
        : String(record.issuedDate),
    issuingAuthority: record.issuingAuthority,
    category: record.category,
    summary: record.summary,
    urgency: record.urgency,
    securityLevel: record.securityLevel,
    dueDate: record.dueDate
      ? record.dueDate instanceof Date
        ? record.dueDate.toISOString()
        : String(record.dueDate)
      : null,
    status: record.status,

    signerName: record.signerName || null,
    signerTitle: record.signerTitle || null,
    recipientList: record.recipientList || null,
    distributedCopies: record.distributedCopies ?? 1,

    // Unit ownership is canonical `OrganizationalUnit` via the incoming workflow.
    leadUnitId: record.incomingWorkflow?.leadUnitId || null,
    leadUnitName: record.incomingWorkflow?.leadUnit?.name || null,
    leadUnitCode: record.incomingWorkflow?.leadUnit?.code || null,
    leadUserId: record.leadUserId || null,
    leadUserName: record.leadUser?.name || null,
    workflowStatus:
      (record.type === "VAN_BAN_DI" ? record.outgoingWorkflow?.status : record.incomingWorkflow?.status) ?? null,

    notes: record.notes || null,
    registeredById: record.registeredById,
    registeredByName: record.registeredBy?.name || null,

    attachments: (record.attachments || []).map((att: any): DocumentAttachmentItem => ({
      id: att.id,
      documentId: att.documentId || record.id,
      fileName: att.fileName,
      fileUrl: att.fileUrl,
      fileSize: att.fileSize,
      mimeType: att.mimeType,
      sha256Hash: att.sha256Hash || null,
      isOriginal: att.isOriginal ?? true,
      createdAt:
        att.createdAt instanceof Date ? att.createdAt.toISOString() : att.createdAt ? String(att.createdAt) : undefined,
    })),

    directives: (record.directives || []).map((dir: any): DocumentDirectiveItem => ({
      id: dir.id,
      documentId: dir.documentId || record.id,
      leaderId: dir.leaderId,
      leaderName: dir.leader?.name,
      instruction: dir.instruction,
      deadline: dir.deadline
        ? dir.deadline instanceof Date
          ? dir.deadline.toISOString()
          : String(dir.deadline)
        : null,
      // The directive's assigned unit is the lead unit of the task it generated.
      leadUnitId: record.linkedTask?.leadUnit?.id || null,
      leadUnitName: record.linkedTask?.leadUnit?.name || null,
      linkedTaskId: record.linkedTask?.id || null,
      linkedTaskCode: record.linkedTask?.code || null,
      collaboratorIds: dir.collaboratorIds || null,
      isTaskGenerated: dir.isTaskGenerated ?? false,
      createdAt:
        dir.createdAt instanceof Date ? dir.createdAt.toISOString() : dir.createdAt ? String(dir.createdAt) : undefined,
    })),

    incomingWorkflow: record.incomingWorkflow || null,
    outgoingWorkflow: record.outgoingWorkflow || null,
    needsRevision:
      record.type === "VAN_BAN_DI" &&
      record.outgoingWorkflow?.status === "DRAFT" &&
      isReturnedNote(record.outgoingWorkflow?.contentReviewNotes),
    outgoingRecipients: record.outgoingRecipients || [],
    signatures: record.signatures || [],
    linkedTaskId: record.linkedTaskId || null,
    linkedTask: record.linkedTask
      ? {
          id: record.linkedTask.id,
          code: record.linkedTask.code,
          title: record.linkedTask.title,
          status: record.linkedTask.status,
          progressPercent: record.linkedTask.progressPercent,
          dueDate: record.linkedTask.dueDate
            ? record.linkedTask.dueDate instanceof Date
              ? record.linkedTask.dueDate.toISOString()
              : String(record.linkedTask.dueDate)
            : null,
          leadUnitId: record.linkedTask.leadUnitId ?? record.linkedTask.leadUnit?.id ?? null,
        }
      : null,
    createdAt:
      record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt ? String(record.createdAt) : undefined,
    updatedAt:
      record.updatedAt instanceof Date ? record.updatedAt.toISOString() : record.updatedAt ? String(record.updatedAt) : undefined,
  };
}

/**
 * Creates and registers a new document record.
 * Automatically obtains the next registration sequence number if omitted.
 */
export async function createDocument(
  payload: CreateDocumentPayload,
  client?: any
): Promise<DocumentItem> {
  const db = client || defaultPrisma;

  // Guard: VAN_BAN_DI phải tạo qua OutgoingDocumentService để đảm bảo
  // DocumentOutgoingWorkflow được khởi tạo cùng Document.
  if (payload.type === 'VAN_BAN_DI') {
    throw new ValidationError(
      'Văn bản đi (VAN_BAN_DI) phải được tạo qua OutgoingDocumentService.createOutgoingDraft() để khởi tạo DocumentOutgoingWorkflow đi kèm. Xem src/lib/services/outgoing-document-service.ts.',
      undefined,
      'USE_OUTGOING_SERVICE'
    );
  }

  const year = payload.documentYear || new Date().getFullYear();

  const registrationNumber =
    payload.registrationNumber !== undefined
      ? payload.registrationNumber
      : await getNextRegistrationNumber(payload.type, year, db);

  const issuedDate =
    typeof payload.issuedDate === "string"
      ? new Date(payload.issuedDate)
      : payload.issuedDate;

  const dueDate = payload.dueDate
    ? typeof payload.dueDate === "string"
      ? new Date(payload.dueDate)
      : payload.dueDate
    : null;

  const registeredDate = payload.registeredDate
    ? typeof payload.registeredDate === "string"
      ? new Date(payload.registeredDate)
      : payload.registeredDate
    : new Date();

  const createData: any = {
    type: payload.type,
    registrationNumber,
    documentYear: year,
    registeredDate,
    originalNumber: payload.originalNumber,
    issuedDate,
    issuingAuthority: payload.issuingAuthority,
    category: payload.category,
    summary: payload.summary,
    urgency: payload.urgency || "THUONG",
    securityLevel: payload.securityLevel || "THUONG",
    status: payload.status || "CHO_PHAN_CONG",
    signerName: payload.signerName || null,
    signerTitle: payload.signerTitle || null,
    recipientList: payload.recipientList || null,
    distributedCopies: payload.distributedCopies ?? 1,
    dueDate,
    leadUserId: payload.leadUserId || null,
    notes: payload.notes || null,
    registeredById: payload.registeredById,
  };

  // Phase 9: `Document.draftingDeptId` / `leadDepartmentId` were dropped. The only
  // canonical unit home left is the incoming workflow's `leadUnit`, which drives
  // the incoming lifecycle — so it may only be created for `VAN_BAN_DEN`.
  // A unit supplied for any other type would be silently lost, so it is rejected.
  if (payload.leadUnitId) {
    if (payload.type !== "VAN_BAN_DEN") {
      throw new ValidationError(
        `Đơn vị chủ trì chỉ áp dụng cho văn bản đến; loại "${payload.type}" không có trường đơn vị canonical nào để lưu.`,
        { leadUnitId: [`Không thể gán đơn vị chủ trì cho văn bản loại "${payload.type}"`] },
        "LEAD_UNIT_NOT_APPLICABLE"
      );
    }
    const unit = await OrganizationalUnitService.resolveUnitRef(payload.leadUnitId);
    if (!unit) {
      throw new ValidationError(
        `Đơn vị chủ trì "${payload.leadUnitId}" không tồn tại trong hệ thống đơn vị.`,
        { leadUnitId: [`Không tìm thấy đơn vị với id/mã "${payload.leadUnitId}"`] },
        "ORG_UNIT_NOT_FOUND"
      );
    }
    createData.incomingWorkflow = { create: { leadUnitId: unit.id } };
  }

  if (payload.attachments && payload.attachments.length > 0) {
    createData.attachments = {
      create: payload.attachments.map((att) => ({
        fileName: att.fileName,
        fileUrl: att.fileUrl,
        fileSize: att.fileSize,
        mimeType: att.mimeType,
        sha256Hash: att.sha256Hash || null,
        isOriginal: att.isOriginal ?? true,
      })),
    };
  }

  const record = await db.document.create({
    data: createData,
    include: defaultInclude,
  });

  return mapPrismaDocumentToItem(record);
}

/**
 * Lists documents based on provided filters and ACL access control.
 * Applies database-level WHERE predicates before pagination to prevent
 * post-query filtering defects (F13 Document ACL-Before-Pagination).
 */
export async function listDocuments(
  filter: ListDocumentsFilter = {},
  client?: any
): Promise<ListDocumentsResult> {
  const db = client || defaultPrisma;
  const queryConditions: Prisma.DocumentWhereInput[] = [];
  const effectiveUser = filter.authUser || filter.userContext;
  // Sổ Văn bản đến của một người gồm cả văn bản đi đã phát hành tới đơn vị của họ (ADR-015).
  const inboxUnitIds = filter.type === "VAN_BAN_DEN" && effectiveUser ? documentUserUnitIds(effectiveUser) : undefined;

  if (filter.type) {
    queryConditions.push(
      filter.type === "VAN_BAN_DEN" && effectiveUser ? buildInboxTypeWhere(effectiveUser) : { type: filter.type as any }
    );
  }
  if (filter.documentYear) {
    queryConditions.push({ documentYear: Number(filter.documentYear) });
  }
  if (filter.bucket && (filter.type === "VAN_BAN_DEN" || filter.type === "VAN_BAN_DI")) {
    const bucketWhere = buildDocumentBucketWhere(
      filter.type,
      filter.bucket,
      inboxUnitIds,
      filter.type === "VAN_BAN_DI" && effectiveUser ? outgoingQueueViewerOf(effectiveUser as never) : undefined
    );
    if (bucketWhere) queryConditions.push(bucketWhere);
  }
  if (filter.status) {
    queryConditions.push({ status: filter.status as any });
  }
  if (filter.urgency) {
    queryConditions.push({ urgency: filter.urgency as any });
  }
  if (filter.securityLevel) {
    queryConditions.push({ securityLevel: filter.securityLevel as any });
  }
  // Phase 9: unit ownership lives on the incoming workflow (canonical
  // `OrganizationalUnit`); `Document.leadDepartmentId` / `draftingDeptId` no
  // longer exist, so the filter is expressed through the relation.
  if (filter.leadUnitId) {
    queryConditions.push({
      incomingWorkflow: { is: { leadUnitId: filter.leadUnitId } },
    });
  }
  if (filter.search && filter.search.trim()) {
    const q = filter.search.trim();
    queryConditions.push({
      OR: [
        { summary: { contains: q, mode: "insensitive" } },
        { originalNumber: { contains: q, mode: "insensitive" } },
        { issuingAuthority: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  // Sổ Văn bản đi không tính văn bản đơn vị khác gửi tới: nơi nhận thấy chúng ở sổ Văn bản đến.
  const aclCondition =
    filter.aclWhere ||
    (effectiveUser ? buildDocumentReadWhere(effectiveUser, { delivered: filter.type !== "VAN_BAN_DI" }) : undefined);

  const andClauses: Prisma.DocumentWhereInput[] = [...queryConditions];
  if (aclCondition) {
    andClauses.push(aclCondition);
  }

  const where: Prisma.DocumentWhereInput =
    andClauses.length === 0
      ? {}
      : andClauses.length === 1
      ? andClauses[0]
      : { AND: andClauses };

  const [total, records] = await Promise.all([
    typeof db.document?.count === "function"
      ? db.document.count({ where })
      : Promise.resolve(0),
    db.document.findMany({
      where,
      orderBy: [
        { documentYear: "desc" },
        { registrationNumber: "desc" },
      ],
      take: filter.limit ?? 100,
      skip: filter.offset ?? 0,
      include: defaultInclude,
    }),
  ]);

  const items = records.map(mapPrismaDocumentToItem);
  const effectiveTotal =
    typeof db.document?.count === "function" ? total : items.length;

  return Object.assign([...items], {
    documents: items,
    total: effectiveTotal,
  }) as ListDocumentsResult;
}

/**
 * Retrieves a single document by its unique ID.
 */
export async function getDocumentById(
  id: string,
  client?: any
): Promise<DocumentItem | null> {
  const db = client || defaultPrisma;
  const record = await db.document.findUnique({
    where: { id },
    include: defaultInclude,
  });

  if (!record) return null;
  return mapPrismaDocumentToItem(record);
}

/**
 * Updates an existing document record.
 */
export async function updateDocument(
  id: string,
  payload: UpdateDocumentPayload,
  client?: any
): Promise<DocumentItem> {
  const db = client || defaultPrisma;

  // Chỉ nạp những gì kiểm tra bất biến cần; bản đầy đủ được trả về từ lệnh update bên dưới.
  const existing = await db.document.findUnique({
    where: { id },
    include: {
      signatures: { select: { id: true, signatureType: true, verificationStatus: true } },
      outgoingWorkflow: { select: { status: true, authorizedSignedAt: true } },
      incomingWorkflow: { select: { id: true, status: true } },
    },
  });

  if (!existing) {
    throw new NotFoundError("Văn bản không tồn tại", "DOCUMENT_NOT_FOUND");
  }

  if (isDocumentImmutable(existing)) {
    throw new ValidationError(
      "Văn bản đã được ký hoặc đã ban hành/hoàn thành/lưu trữ là bất biến, không thể chỉnh sửa metadata.",
      undefined,
      "IMMUTABLE_DOCUMENT"
    );
  }
  if (isOutgoingUnderReview(existing) && patchTouchesLockedContent(payload)) {
    throw new ValidationError(OUTGOING_UNDER_REVIEW_MESSAGE, undefined, OUTGOING_UNDER_REVIEW_CODE);
  }

  if (
    payload.status !== undefined ||
    payload.signerName !== undefined ||
    payload.signerTitle !== undefined
  ) {
    throw new ValidationError(
      "Trạng thái và người ký văn bản phải được cập nhật qua canonical workflow command tương ứng.",
      undefined,
      "CANONICAL_COMMAND_REQUIRED"
    );
  }

  const data: any = {};

  if (payload.summary !== undefined) data.summary = payload.summary;
  // Hai cột bắt buộc trong DB: không cho xóa trống (tránh lỗi 500 từ Prisma)
  if (payload.originalNumber !== undefined) {
    if (!payload.originalNumber?.trim()) {
      throw new ValidationError("Số/ký hiệu văn bản không được để trống.", { originalNumber: ["Bắt buộc"] });
    }
    data.originalNumber = payload.originalNumber.trim();
  }
  if (payload.issuingAuthority !== undefined) {
    if (!payload.issuingAuthority?.trim()) {
      throw new ValidationError("Cơ quan ban hành không được để trống.", { issuingAuthority: ["Bắt buộc"] });
    }
    data.issuingAuthority = payload.issuingAuthority.trim();
  }
  if (payload.category !== undefined) data.category = payload.category;
  if (payload.urgency !== undefined) data.urgency = payload.urgency;
  if (payload.securityLevel !== undefined) data.securityLevel = payload.securityLevel;
  if (payload.status !== undefined) data.status = payload.status;
  if (payload.signerName !== undefined) data.signerName = payload.signerName;
  if (payload.signerTitle !== undefined) data.signerTitle = payload.signerTitle;
  if (payload.recipientList !== undefined) data.recipientList = payload.recipientList;
  if (payload.distributedCopies !== undefined) data.distributedCopies = payload.distributedCopies;
  if (payload.leadUserId !== undefined) data.leadUserId = payload.leadUserId;

  // Phase 9: unit ownership is canonical `OrganizationalUnit` on the incoming
  // workflow — upserted so a document can receive its lead unit at any step.
  if (payload.leadUnitId !== undefined) {
    if (payload.leadUnitId === null) {
      // Only an existing workflow can be cleared; creating one just to hold a
      // NULL unit would fabricate an incoming lifecycle for an outgoing document.
      if (existing.incomingWorkflow) {
        data.incomingWorkflow = { update: { leadUnitId: null } };
      }
    } else {
      const unit = await OrganizationalUnitService.resolveUnitRef(payload.leadUnitId);
      if (!unit) {
        throw new ValidationError(
          `Đơn vị chủ trì "${payload.leadUnitId}" không tồn tại trong hệ thống đơn vị.`,
          { leadUnitId: [`Không tìm thấy đơn vị với id/mã "${payload.leadUnitId}"`] },
          "ORG_UNIT_NOT_FOUND"
        );
      }
      data.incomingWorkflow = {
        upsert: {
          update: { leadUnitId: unit.id },
          create: { leadUnitId: unit.id },
        },
      };
    }
  }
  if (payload.notes !== undefined) data.notes = payload.notes;
  if (payload.linkedTaskId !== undefined) data.linkedTaskId = payload.linkedTaskId;

  if (payload.dueDate !== undefined) {
    data.dueDate = payload.dueDate
      ? typeof payload.dueDate === "string"
        ? new Date(payload.dueDate)
        : payload.dueDate
      : null;
  }

  const record = await db.document.update({
    where: { id },
    data,
    include: defaultInclude,
  });

  return mapPrismaDocumentToItem(record);
}

/**
 * Convenience method to register an incoming official dispatch (Văn bản đến).
 */
export async function registerIncomingDocument(
  payload: Omit<CreateDocumentPayload, "type">,
  client?: any
): Promise<DocumentItem> {
  return createDocument({ ...payload, type: "VAN_BAN_DEN" }, client);
}

export { getNextRegistrationNumber };

/**
 * PATCH metadata văn bản sau khi route đã kiểm tồn tại, bất biến, quyền và validate.
 * `validated` là payload đã qua `UpdateDocumentSchema` (không phải body thô).
 */
export async function applyDocumentPatch(
  id: string,
  validated: UpdateDocumentInput,
  {
    authUser,
    authContext,
    requestId,
  }: { authUser: AuthenticatedUser; authContext: AuthorizationContext; requestId: string }
) {
  // S-1: gắn/đổi/gỡ nhiệm vụ liên kết làm đổi đơn vị xử lý văn bản nên phải kiểm quyền và ghi nhật ký.
  // Mọi đọc-quyết định-ghi diễn ra trong một transaction sau khi khóa dòng, để hai PATCH đồng thời
  // không dựa vào trạng thái đã cũ (bỏ sót kiểm quyền hoặc ghi sai nhật ký).
  let updated;
  if (validated.linkedTaskId !== undefined) {
    const { linkedTaskId: requestedLink, ...rest } = validated;
    try {
      updated = await defaultPrisma.$transaction(async (tx) => {
        await lockDocumentRows(tx, id);
        const fresh = await getDocumentById(id, tx);
        if (!fresh) {
          throw new NotFoundError("Văn bản không tồn tại", "DOCUMENT_NOT_FOUND");
        }
        if (isDocumentImmutable(fresh)) {
          throw new ValidationError(
            "Văn bản đã được ký hoặc đã ban hành/hoàn thành/lưu trữ là bất biến, không thể chỉnh sửa metadata.",
            undefined,
            "IMMUTABLE_DOCUMENT"
          );
        }
        if (isOutgoingUnderReview(fresh) && patchTouchesLockedContent(rest)) {
          throw new ValidationError(OUTGOING_UNDER_REVIEW_MESSAGE, undefined, OUTGOING_UNDER_REVIEW_CODE);
        }
        if (!canUpdateDocument(authUser, fresh)) {
          throw new ForbiddenError("Bạn không có quyền cập nhật văn bản này (Forbidden)");
        }
        const change = {
          documentId: id,
          currentTaskId: fresh.linkedTaskId ?? null,
          nextTaskId: normalizeLinkedTaskId(requestedLink),
        };
        const changing = change.nextTaskId !== change.currentTaskId;
        const task = changing ? await assertCanLinkTask(tx, authContext, change) : null;
        const result = await updateDocument(
          id,
          { ...(rest as any), ...(changing ? { linkedTaskId: change.nextTaskId } : {}) },
          tx
        );
        if (changing) {
          await recordLinkedTaskChange(tx, { ...change, actorId: authUser.id, requestId, task });
        }
        return result;
      });
    } catch (error) {
      throw toLinkedTaskConflict(error);
    }
  } else {
    // Ghi nhật ký các trường đã sửa (chỉ tên trường) để thay đổi thông tin hiện trong luân chuyển
    updated = await defaultPrisma.$transaction(async (tx) => {
      const result = await updateDocument(id, validated as any, tx);
      await logAuditEvent(tx, {
        actorId: authUser.id,
        action: "DOCUMENT_UPDATED",
        entityType: "Document",
        entityId: id,
        requestId,
        metadata: { fields: Object.keys(validated) },
      });
      return result;
    });
  }
  return updated;
}

/** Xóa văn bản cùng chỉ đạo và tệp đính kèm trong một transaction (route đã kiểm quyền, bất biến). */
export async function deleteDocumentCascade(id: string): Promise<void> {
  await defaultPrisma.$transaction(async (tx) => {
    await tx.documentDirective.deleteMany({ where: { documentId: id } });
    await tx.documentAttachment.deleteMany({ where: { documentId: id } });
    await tx.document.delete({ where: { id } });
  });
}

/** Người dùng đã đánh dấu văn bản này chưa. */
export async function isDocumentMarked(documentId: string, userId: string): Promise<boolean> {
  return Boolean(await defaultPrisma.documentMark.findUnique({ where: { documentId_userId: { documentId, userId } }, select: { userId: true } }));
}

/** Đánh dấu / hủy đánh dấu văn bản cho riêng người dùng (route đã kiểm quyền đọc). */
export async function setDocumentMark(documentId: string, userId: string, marked: boolean): Promise<void> {
  const key = { documentId_userId: { documentId, userId } };
  if (marked) {
    await defaultPrisma.documentMark.upsert({ where: key, create: { documentId, userId }, update: {} });
  } else {
    await defaultPrisma.documentMark.deleteMany({ where: { documentId, userId } });
  }
}

/** Chỉ đọc loại văn bản (để rẽ nhánh đến/đi theo ADR-004); `null` khi không tồn tại. */
export async function getDocumentTypeById(id: string) {
  return defaultPrisma.document.findUnique({ where: { id }, select: { type: true } });
}

/**
 * Gắn tệp đã tải lên qua `POST /api/upload` vào văn bản (route đã kiểm quyền, bất biến).
 * Chỉ gắn được tệp do chính người thao tác tải lên; tên, dung lượng, định dạng lấy từ máy chủ.
 */
export async function addUploadedFileAttachment({
  documentId,
  fileId,
  actorId,
  requestId,
}: {
  documentId: string;
  fileId: string;
  actorId: string;
  requestId: string;
}) {
  const file = await defaultPrisma.fileObject.findUnique({ where: { id: fileId } });
  if (!file || file.isArchived || file.uploadedById !== actorId) {
    throw new NotFoundError("Không tìm thấy tệp đã tải lên", "FILE_NOT_FOUND");
  }
  if (file.scanStatus === "INFECTED") {
    throw new ValidationError("Tệp không an toàn, không thể đính kèm.", undefined, "FILE_INFECTED");
  }

  return defaultPrisma.$transaction(async (tx) => {
    const created = await tx.documentAttachment.create({
      data: {
        documentId,
        fileName: file.originalName,
        fileUrl: `/api/file-objects/${file.id}`,
        fileObjectId: file.id,
        fileSize: Number(file.byteSize),
        mimeType: file.mimeType,
        sha256Hash: file.contentHash,
        isOriginal: false,
      },
    });
    await logAuditEvent(tx, {
      actorId,
      action: "DOCUMENT_ATTACHMENT_ADDED",
      entityType: "Document",
      entityId: documentId,
      requestId,
      metadata: { attachmentId: created.id, fileName: created.fileName },
    });
    return created;
  });
}

/** Số văn bản đi đang chờ chính người xem làm bước của mình (chấm báo việc ở sidebar), trong phạm vi họ đọc được. */
export function countOutgoingAwaitingViewer(authContext: AuthorizationContext): Promise<number> {
  return defaultPrisma.document.count({
    where: {
      AND: [
        { archivedAt: null },
        { type: "VAN_BAN_DI" },
        buildDocumentReadWhere(authContext, { delivered: false }),
        outgoingAwaitingViewerWhere(outgoingQueueViewerOf(authContext as never), { attentionOnly: true }),
      ],
    },
  });
}

/**
 * Số liệu thô cho thống kê sổ văn bản, trong phạm vi người xem đọc được.
 * Route tự tổng hợp theo loại/trạng thái từ các dòng `groupBy`. Sổ Văn bản đến và Văn bản đi đếm đúng như danh sách
 * (`listDocuments`): văn bản đi đã phát hành tới đơn vị người xem nằm ở sổ đến, không nằm ở sổ đi (ADR-015).
 */
export async function getDocumentStatsRows({
  authContext,
  scopedType,
  now,
}: {
  authContext: AuthorizationContext;
  scopedType: DocumentTypeCode | null;
  now: Date;
}) {
  const baseFilter = { AND: [{ archivedAt: null }, buildDocumentReadWhere(authContext)] };
  const inboxUnitIds = documentUserUnitIds(authContext);
  const typeWhere = (type: DocumentTypeCode): Prisma.DocumentWhereInput =>
    type === "VAN_BAN_DEN"
      ? buildInboxTypeWhere(authContext)
      : type === "VAN_BAN_DI"
      ? { AND: [{ type }, buildDocumentReadWhere(authContext, { delivered: false })] }
      : { type };
  // Các chỉ số trạng thái/khẩn/trễ hạn bám theo loại văn bản đang xem (nếu có).
  const scopedFilter = scopedType ? { AND: [baseFilter, typeWhere(scopedType)] } : baseFilter;

  const countBucket = (type: "VAN_BAN_DEN" | "VAN_BAN_DI", bucket: "pending" | "done" | "issued") =>
    defaultPrisma.document.count({
      where: {
        AND: [
          baseFilter,
          typeWhere(type),
          buildDocumentBucketWhere(type, bucket, type === "VAN_BAN_DEN" ? inboxUnitIds : undefined) ?? {},
        ],
      },
    });
  const countType = (type: DocumentTypeCode) =>
    defaultPrisma.document.count({ where: { AND: [baseFilter, typeWhere(type)] } });

  const [
    byType,
    byStatus,
    urgent,
    overdue,
    linkedTasks,
    incomingTotal,
    outgoingTotal,
    incomingPending,
    incomingDone,
    outgoingPending,
    outgoingDone,
    outgoingIssued,
  ] = await Promise.all([
    defaultPrisma.document.groupBy({ by: ["type"], where: baseFilter, _count: { _all: true } }),
    defaultPrisma.document.groupBy({ by: ["status"], where: scopedFilter, _count: { _all: true } }),
    defaultPrisma.document.count({
      where: {
        ...scopedFilter,
        urgency: { in: ["KHAN", "THUONG_KHAN", "HOA_TOC"] },
      },
    }),
    defaultPrisma.document.count({
      where: {
        ...scopedFilter,
        dueDate: { lt: now },
        status: { notIn: [...DOCUMENT_DONE_STATUSES] },
      },
    }),
    defaultPrisma.document.count({
      where: {
        ...scopedFilter,
        linkedTaskId: { not: null },
      },
    }),
    countType("VAN_BAN_DEN"),
    countType("VAN_BAN_DI"),
    countBucket("VAN_BAN_DEN", "pending"),
    countBucket("VAN_BAN_DEN", "done"),
    countBucket("VAN_BAN_DI", "pending"),
    countBucket("VAN_BAN_DI", "done"),
    countBucket("VAN_BAN_DI", "issued"),
  ]);

  return {
    byType,
    byStatus,
    urgent,
    overdue,
    linkedTasks,
    incomingTotal,
    outgoingTotal,
    incomingPending,
    incomingDone,
    outgoingPending,
    outgoingDone,
    outgoingIssued,
  };
}
