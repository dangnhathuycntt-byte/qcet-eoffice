import type { Prisma, IncomingDocumentStatus, OutgoingDocumentStatus } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import type {
  DocumentItem,
  DocumentType,
  DocumentUrgency,
  DocumentSecurityLevel,
  DocumentStatus,
  DocumentAttachmentItem,
  DocumentDirectiveItem,
} from "@/types/document";
import { getNextRegistrationNumber } from "./numbering-engine";
import type { AuthenticatedUser } from "@/server/api/request-context";
import type { AuthorizationContext } from "@/server/authorization/authorization-context";
import { canReadDocument, buildDocumentReadWhere } from "@/server/policies/document-policy";
import { OrganizationalUnitService } from "@/server/services/organization-unit-service";
import {
  isDocumentImmutable,
  mapIncomingWorkflowStatusToDocumentStatus,
  mapOutgoingWorkflowStatusToDocumentStatus,
} from "./state-machine";
import { NotFoundError, ValidationError } from "@/server/api/errors";

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
      leadUnit: { select: { id: true, name: true, code: true } },
    },
  },
  incomingWorkflow: {
    include: { leadUnit: { select: { id: true, name: true, code: true } } },
  },
  outgoingWorkflow: true,
  signatures: true,
};

export function mapPrismaDocumentToItem(record: any): DocumentItem {
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
    signatures: record.signatures || [],
    linkedTaskId: record.linkedTaskId || null,
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

  // Phase 9: `Document.draftingDeptId` / `leadDepartmentId` were dropped. The
  // canonical unit is the incoming workflow's `leadUnit`, so a unit supplied at
  // registration seeds the workflow instead of a document column.
  if (payload.leadUnitId) {
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

  if (filter.type) {
    queryConditions.push({ type: filter.type as any });
  }
  if (filter.documentYear) {
    queryConditions.push({ documentYear: Number(filter.documentYear) });
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

  const effectiveUser = filter.authUser || filter.userContext;
  const aclCondition =
    filter.aclWhere || (effectiveUser ? buildDocumentReadWhere(effectiveUser) : undefined);

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

  const existing = await db.document.findUnique({
    where: { id },
    include: defaultInclude,
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

/**
 * Synchronizes Document.status with the corresponding workflow status within a transaction.
 * Invariant (ADR-004): Must be executed in the same prisma.$transaction as the workflow transition.
 */
export async function syncDocumentStatusFromIncomingWorkflow(
  tx: Prisma.TransactionClient,
  documentId: string,
  workflowStatus: IncomingDocumentStatus | string
): Promise<DocumentStatus> {
  const targetStatus = mapIncomingWorkflowStatusToDocumentStatus(workflowStatus);
  await tx.document.update({
    where: { id: documentId },
    data: { status: targetStatus },
  });
  return targetStatus;
}

export async function syncDocumentStatusFromOutgoingWorkflow(
  tx: Prisma.TransactionClient,
  documentId: string,
  workflowStatus: OutgoingDocumentStatus | string
): Promise<DocumentStatus> {
  const targetStatus = mapOutgoingWorkflowStatusToDocumentStatus(workflowStatus);
  await tx.document.update({
    where: { id: documentId },
    data: { status: targetStatus },
  });
  return targetStatus;
}

export { getNextRegistrationNumber };
