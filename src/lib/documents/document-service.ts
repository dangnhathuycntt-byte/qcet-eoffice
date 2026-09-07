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
  draftingDeptId?: string | null;
  recipientList?: string | null;
  distributedCopies?: number | null;
  leadDepartmentId?: string | null;
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

export interface ListDocumentsFilter {
  type?: DocumentType;
  documentYear?: number;
  status?: DocumentStatus;
  urgency?: DocumentUrgency;
  securityLevel?: DocumentSecurityLevel;
  leadDepartmentId?: string;
  draftingDeptId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

const defaultInclude = {
  draftingDept: true,
  leadDepartment: true,
  leadUser: true,
  registeredBy: true,
  attachments: true,
  directives: {
    include: {
      leader: true,
      assignedDept: true,
    },
  },
  linkedTask: true,
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
    draftingDeptId: record.draftingDeptId || null,
    draftingDeptName: record.draftingDept?.name || null,
    recipientList: record.recipientList || null,
    distributedCopies: record.distributedCopies ?? 1,

    leadDepartmentId: record.leadDepartmentId || null,
    leadDepartmentName: record.leadDepartment?.name || null,
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
      assignedDeptId: dir.assignedDeptId,
      assignedDeptName: dir.assignedDept?.name,
      collaboratorIds: dir.collaboratorIds || null,
      isTaskGenerated: dir.isTaskGenerated ?? false,
      createdAt:
        dir.createdAt instanceof Date ? dir.createdAt.toISOString() : dir.createdAt ? String(dir.createdAt) : undefined,
    })),

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
    draftingDeptId: payload.draftingDeptId || null,
    recipientList: payload.recipientList || null,
    distributedCopies: payload.distributedCopies ?? 1,
    dueDate,
    leadDepartmentId: payload.leadDepartmentId || null,
    leadUserId: payload.leadUserId || null,
    notes: payload.notes || null,
    registeredById: payload.registeredById,
  };

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
 * Lists documents based on provided filters.
 */
export async function listDocuments(
  filter: ListDocumentsFilter = {},
  client?: any
): Promise<DocumentItem[]> {
  const db = client || defaultPrisma;
  const where: any = {};

  if (filter.type) {
    where.type = filter.type;
  }
  if (filter.documentYear) {
    where.documentYear = Number(filter.documentYear);
  }
  if (filter.status) {
    where.status = filter.status;
  }
  if (filter.urgency) {
    where.urgency = filter.urgency;
  }
  if (filter.securityLevel) {
    where.securityLevel = filter.securityLevel;
  }
  if (filter.leadDepartmentId) {
    where.leadDepartmentId = filter.leadDepartmentId;
  }
  if (filter.draftingDeptId) {
    where.draftingDeptId = filter.draftingDeptId;
  }
  if (filter.search && filter.search.trim()) {
    const q = filter.search.trim();
    where.OR = [
      { summary: { contains: q, mode: "insensitive" } },
      { originalNumber: { contains: q, mode: "insensitive" } },
      { issuingAuthority: { contains: q, mode: "insensitive" } },
    ];
  }

  const records = await db.document.findMany({
    where,
    orderBy: [
      { documentYear: "desc" },
      { registrationNumber: "desc" },
    ],
    take: filter.limit ?? 100,
    skip: filter.offset ?? 0,
    include: defaultInclude,
  });

  return records.map(mapPrismaDocumentToItem);
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
 * Convenience method to register an incoming official dispatch (Văn bản đến).
 */
export async function registerIncomingDocument(
  payload: Omit<CreateDocumentPayload, "type">,
  client?: any
): Promise<DocumentItem> {
  return createDocument({ ...payload, type: "VAN_BAN_DEN" }, client);
}

export { getNextRegistrationNumber };
