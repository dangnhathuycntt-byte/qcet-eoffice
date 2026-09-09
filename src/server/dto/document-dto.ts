/**
 * Document Data Transfer Objects (DTOs) & Sanitization Mappers
 *
 * Implements OWASP API3 (Excessive Data Exposure) safeguards.
 * Adheres to Decree 30/2020/ND-CP clerical operations without exposing
 * internal storage paths, raw database secrets, or arbitrary metadata dumps.
 */

import {
  toUserSummaryDTO,
  type UserSummaryDTO,
} from './user-dto';

export interface DocumentSignerDTO {
  name: string;
  title?: string | null;
}

export interface DocumentDepartmentDTO {
  id?: string;
  code?: string | null;
  name: string;
}

export interface DocumentAttachmentDTO {
  id: string;
  documentId?: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  isOriginal?: boolean;
  createdAt?: string;
}

export interface DocumentDirectiveDTO {
  id: string;
  documentId?: string;
  leaderId: string;
  leaderName?: string | null;
  leader?: UserSummaryDTO | null;
  instruction: string;
  deadline?: string | null;
  assignedDeptId?: string | null;
  assignedDeptName?: string | null;
  assignedDept?: DocumentDepartmentDTO | null;
  collaboratorIds?: string | null;
  isTaskGenerated?: boolean;
  createdAt?: string;
}

export interface DocumentListDTO {
  id: string;
  documentCode: string;
  title: string;
  type: string;
  releaseDate: string;
  department?: DocumentDepartmentDTO | null;
  status?: string | null;
  signer?: DocumentSignerDTO | null;
  version?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentDetailDTO extends DocumentListDTO {
  content?: string | null;
  attachments?: DocumentAttachmentDTO[];
  directives?: DocumentDirectiveDTO[];
  category?: string | null;
  urgency?: string | null;
  securityLevel?: string | null;
  originalNumber?: string | null;
  registrationNumber?: number | null;
  documentYear?: number | null;
  registeredDate?: string | null;
  issuingAuthority?: string | null;
  dueDate?: string | null;
  recipientList?: string | null;
  distributedCopies?: number | null;
  linkedTaskId?: string | null;
  notes?: string | null;
  registeredBy?: UserSummaryDTO | null;
}

function toISOStringSafe(val: unknown): string {
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? new Date(0).toISOString() : val.toISOString();
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(0).toISOString();
}

function extractDateString(val: unknown): string {
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? '' : val.toISOString();
  }
  if (typeof val === 'string') {
    return val;
  }
  if (typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? '' : d.toISOString();
  }
  return '';
}

function extractVersion(raw: Record<string, any>): number {
  if (typeof raw.version === 'number' && !isNaN(raw.version)) {
    return raw.version;
  }
  if (typeof raw.version === 'string') {
    const parsed = parseInt(raw.version, 10);
    if (!isNaN(parsed)) return parsed;
  }
  if (raw.updatedAt) {
    const ts = new Date(raw.updatedAt).getTime();
    if (!isNaN(ts)) return ts;
  }
  return 1;
}

function extractSigner(raw: Record<string, any>): DocumentSignerDTO | null {
  if (raw.signer && typeof raw.signer === 'object') {
    return {
      name: String(raw.signer.name ?? ''),
      title: raw.signer.title ?? null,
    };
  }
  if (typeof raw.signer === 'string' && raw.signer.trim()) {
    return {
      name: raw.signer.trim(),
      title: raw.signerTitle ?? null,
    };
  }
  if (raw.signerName && typeof raw.signerName === 'string' && raw.signerName.trim()) {
    return {
      name: raw.signerName.trim(),
      title: raw.signerTitle ?? null,
    };
  }
  if (raw.signatory && typeof raw.signatory === 'string' && raw.signatory.trim()) {
    return {
      name: raw.signatory.trim(),
      title: null,
    };
  }
  return null;
}

function extractDocumentDepartment(raw: Record<string, any>): DocumentDepartmentDTO | null {
  // Explicit department relation/object
  if (raw.department && typeof raw.department === 'object') {
    return {
      id: raw.department.id ? String(raw.department.id) : undefined,
      code: raw.department.code ?? raw.department.shortName ?? null,
      name: String(raw.department.name ?? ''),
    };
  }
  if (typeof raw.department === 'string' && raw.department.trim()) {
    return {
      id: raw.departmentId ? String(raw.departmentId) : undefined,
      code: raw.departmentCode ?? null,
      name: raw.department.trim(),
    };
  }

  // Decree 30 Lead Department (Van ban den)
  if (raw.leadDepartment && typeof raw.leadDepartment === 'object') {
    return {
      id: raw.leadDepartment.id ? String(raw.leadDepartment.id) : undefined,
      code: raw.leadDepartment.code ?? raw.leadDepartment.shortName ?? null,
      name: String(raw.leadDepartment.name ?? ''),
    };
  }
  if (typeof raw.leadDepartment === 'string' && raw.leadDepartment.trim()) {
    return {
      id: raw.leadDepartmentId ? String(raw.leadDepartmentId) : undefined,
      name: raw.leadDepartment.trim(),
    };
  }
  if (raw.leadDepartmentName && typeof raw.leadDepartmentName === 'string') {
    return {
      id: raw.leadDepartmentId ? String(raw.leadDepartmentId) : undefined,
      name: raw.leadDepartmentName.trim(),
    };
  }

  // Decree 30 Drafting Department (Van ban di)
  if (raw.draftingDept && typeof raw.draftingDept === 'object') {
    return {
      id: raw.draftingDept.id ? String(raw.draftingDept.id) : undefined,
      code: raw.draftingDept.code ?? raw.draftingDept.shortName ?? null,
      name: String(raw.draftingDept.name ?? ''),
    };
  }
  if (typeof raw.draftingDept === 'string' && raw.draftingDept.trim()) {
    return {
      id: raw.draftingDeptId ? String(raw.draftingDeptId) : undefined,
      name: raw.draftingDept.trim(),
    };
  }
  if (raw.draftingDeptName && typeof raw.draftingDeptName === 'string') {
    return {
      id: raw.draftingDeptId ? String(raw.draftingDeptId) : undefined,
      name: raw.draftingDeptName.trim(),
    };
  }

  return null;
}

function extractAttachments(raw: Record<string, any>): DocumentAttachmentDTO[] {
  if (!Array.isArray(raw.attachments)) return [];

  return raw.attachments
    .filter((a: any) => a && typeof a === 'object')
    .map((a: any) => ({
      id: String(a.id ?? ''),
      documentId: a.documentId ? String(a.documentId) : undefined,
      fileName: String(a.fileName ?? ''),
      fileUrl: String(a.fileUrl ?? ''),
      fileSize: typeof a.fileSize === 'number' ? a.fileSize : 0,
      mimeType: String(a.mimeType ?? 'application/octet-stream'),
      isOriginal: a.isOriginal !== undefined ? Boolean(a.isOriginal) : true,
      createdAt: a.createdAt ? extractDateString(a.createdAt) : undefined,
    }));
}

function extractDirectives(raw: Record<string, any>): DocumentDirectiveDTO[] {
  if (!Array.isArray(raw.directives)) return [];

  return raw.directives
    .filter((d: any) => d && typeof d === 'object')
    .map((d: any) => ({
      id: String(d.id ?? ''),
      documentId: d.documentId ? String(d.documentId) : undefined,
      leaderId: String(d.leaderId ?? ''),
      leaderName: d.leaderName ?? d.leader?.name ?? null,
      leader: d.leader ? toUserSummaryDTO(d.leader) : null,
      instruction: String(d.instruction ?? ''),
      deadline: d.deadline ? extractDateString(d.deadline) : null,
      assignedDeptId: d.assignedDeptId ? String(d.assignedDeptId) : null,
      assignedDeptName: d.assignedDeptName ?? d.assignedDept?.name ?? null,
      assignedDept: d.assignedDept && typeof d.assignedDept === 'object'
        ? {
            id: d.assignedDept.id ? String(d.assignedDept.id) : undefined,
            code: d.assignedDept.code ?? d.assignedDept.shortName ?? null,
            name: String(d.assignedDept.name ?? ''),
          }
        : null,
      collaboratorIds: d.collaboratorIds ?? null,
      isTaskGenerated: Boolean(d.isTaskGenerated),
      createdAt: d.createdAt ? extractDateString(d.createdAt) : undefined,
    }));
}

/**
 * Maps raw document to DocumentListDTO.
 * Returns null if raw document is null, undefined, or not an object.
 */
export function toDocumentListDTO(rawDoc: unknown): DocumentListDTO | null {
  if (!rawDoc || typeof rawDoc !== 'object') return null;
  const doc = rawDoc as Record<string, any>;

  return {
    id: String(doc.id ?? ''),
    documentCode: String(doc.documentCode ?? doc.originalNumber ?? doc.documentNumber ?? ''),
    title: String(doc.title ?? doc.summary ?? ''),
    type: String(doc.type ?? ''),
    releaseDate: extractDateString(doc.releaseDate ?? doc.issuedDate ?? doc.registeredDate),
    department: extractDocumentDepartment(doc),
    status: doc.status ? String(doc.status) : null,
    signer: extractSigner(doc),
    version: extractVersion(doc),
    createdAt: toISOStringSafe(doc.createdAt),
    updatedAt: toISOStringSafe(doc.updatedAt),
  };
}

/**
 * Maps raw document to DocumentDetailDTO.
 * Returns null if raw document is null, undefined, or not an object.
 */
export function toDocumentDetailDTO(rawDoc: unknown): DocumentDetailDTO | null {
  if (!rawDoc || typeof rawDoc !== 'object') return null;
  const doc = rawDoc as Record<string, any>;

  const base = toDocumentListDTO(doc);
  if (!base) return null;

  return {
    ...base,
    content: doc.content ?? doc.summary ?? doc.notes ?? null,
    attachments: extractAttachments(doc),
    directives: extractDirectives(doc),
    category: doc.category ? String(doc.category) : null,
    urgency: doc.urgency ? String(doc.urgency) : null,
    securityLevel: doc.securityLevel ? String(doc.securityLevel) : null,
    originalNumber: doc.originalNumber ? String(doc.originalNumber) : null,
    registrationNumber: typeof doc.registrationNumber === 'number' ? doc.registrationNumber : null,
    documentYear: typeof doc.documentYear === 'number' ? doc.documentYear : null,
    registeredDate: doc.registeredDate ? extractDateString(doc.registeredDate) : null,
    issuingAuthority: doc.issuingAuthority ? String(doc.issuingAuthority) : null,
    dueDate: doc.dueDate ? extractDateString(doc.dueDate) : null,
    recipientList: doc.recipientList ? String(doc.recipientList) : null,
    distributedCopies: typeof doc.distributedCopies === 'number' ? doc.distributedCopies : null,
    linkedTaskId: doc.linkedTaskId ? String(doc.linkedTaskId) : null,
    notes: doc.notes ? String(doc.notes) : null,
    registeredBy: doc.registeredBy ? toUserSummaryDTO(doc.registeredBy) : null,
  };
}

/**
 * Array mapping helpers
 */
export function toDocumentListDTOArray(rawDocs: unknown[]): DocumentListDTO[] {
  if (!Array.isArray(rawDocs)) return [];
  return rawDocs
    .map(toDocumentListDTO)
    .filter((d): d is DocumentListDTO => d !== null);
}
