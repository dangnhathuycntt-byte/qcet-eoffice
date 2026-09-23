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
  /** Đơn vị nhận chỉ đạo — lấy từ nhiệm vụ được sinh ra (Phase 9). */
  leadUnitId?: string | null;
  leadUnitName?: string | null;
  assignedUnit?: DocumentDepartmentDTO | null;
  linkedTaskId?: string | null;
  linkedTaskCode?: string | null;
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
  registeredById?: string | null;
  /** Đơn vị chủ trì — canonical `OrganizationalUnit`. */
  leadUnitId?: string | null;
  leadUnitName?: string | null;
  leadUnitCode?: string | null;
  leadUserId?: string | null;
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

/**
 * Đơn vị chủ trì của văn bản.
 * Phase 9: chỉ còn một nguồn chân lý là `OrganizationalUnit` gắn qua quy trình
 * văn bản đến — các cột `departmentId` / `leadDepartmentId` / `draftingDeptId`
 * trên `Document` đã bị drop.
 */
function extractDocumentDepartment(raw: Record<string, any>): DocumentDepartmentDTO | null {
  const unit =
    (raw.leadUnit && typeof raw.leadUnit === 'object' ? raw.leadUnit : null) ??
    (raw.incomingWorkflow?.leadUnit && typeof raw.incomingWorkflow.leadUnit === 'object'
      ? raw.incomingWorkflow.leadUnit
      : null);

  if (unit) {
    return {
      id: unit.id ? String(unit.id) : undefined,
      code: unit.code ?? unit.shortName ?? null,
      name: String(unit.name ?? ''),
    };
  }

  if (typeof raw.leadUnitName === 'string' && raw.leadUnitName.trim()) {
    const id = raw.leadUnitId ?? raw.incomingWorkflow?.leadUnitId;
    return {
      id: id ? String(id) : undefined,
      code: typeof raw.leadUnitCode === 'string' ? raw.leadUnitCode : null,
      name: raw.leadUnitName.trim(),
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
      ...mapDirectiveUnitFields(d),
      collaboratorIds: d.collaboratorIds ?? null,
      isTaskGenerated: Boolean(d.isTaskGenerated),
      createdAt: d.createdAt ? extractDateString(d.createdAt) : undefined,
    }));
}

/**
 * Đơn vị nhận chỉ đạo của một bút phê.
 * Phase 9: `DocumentDirective.assignedDeptId` đã bị drop; nguồn chân lý là đơn vị
 * chủ trì của nhiệm vụ mà bút phê sinh ra (`linkedTask.leadUnit`).
 */
function mapDirectiveUnitFields(d: Record<string, any>): Pick<
  DocumentDirectiveDTO,
  'leadUnitId' | 'leadUnitName' | 'assignedUnit' | 'linkedTaskId' | 'linkedTaskCode'
> {
  const task = d.linkedTask && typeof d.linkedTask === 'object' ? d.linkedTask : null;
  const unit =
    (task?.leadUnit && typeof task.leadUnit === 'object' ? task.leadUnit : null) ??
    (d.leadUnit && typeof d.leadUnit === 'object' ? d.leadUnit : null);

  const leadUnitId =
    d.leadUnitId ?? unit?.id ?? task?.leadUnitId ?? null;
  const leadUnitName = d.leadUnitName ?? unit?.name ?? null;

  return {
    leadUnitId: leadUnitId ? String(leadUnitId) : null,
    leadUnitName: leadUnitName ?? null,
    assignedUnit: leadUnitName
      ? {
          id: leadUnitId ? String(leadUnitId) : undefined,
          code: unit?.code ?? unit?.shortName ?? d.leadUnitCode ?? null,
          name: String(leadUnitName),
        }
      : null,
    linkedTaskId: task?.id ? String(task.id) : d.linkedTaskId ? String(d.linkedTaskId) : null,
    linkedTaskCode: task?.code ? String(task.code) : d.linkedTaskCode ? String(d.linkedTaskCode) : null,
  };
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
    registeredById: doc.registeredById ? String(doc.registeredById) : null,
    leadUnitId: doc.leadUnitId
      ? String(doc.leadUnitId)
      : doc.incomingWorkflow?.leadUnitId
      ? String(doc.incomingWorkflow.leadUnitId)
      : null,
    leadUnitName: doc.leadUnitName ?? doc.incomingWorkflow?.leadUnit?.name ?? null,
    leadUnitCode: doc.leadUnitCode ?? doc.incomingWorkflow?.leadUnit?.code ?? null,
    leadUserId: doc.leadUserId ? String(doc.leadUserId) : null,
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

/**
 * Maps raw directive to DocumentDirectiveDTO.
 * Returns null if raw directive is null, undefined, or not an object.
 */
export function toDocumentDirectiveDTO(raw: unknown): DocumentDirectiveDTO | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, any>;
  return {
    id: String(d.id ?? ''),
    documentId: d.documentId ? String(d.documentId) : undefined,
    leaderId: String(d.leaderId ?? ''),
    leaderName: d.leaderName ?? d.leader?.name ?? null,
    leader: d.leader ? toUserSummaryDTO(d.leader) : null,
    instruction: String(d.instruction ?? d.content ?? ''),
    deadline: d.deadline ? extractDateString(d.deadline) : null,
    ...mapDirectiveUnitFields(d),
    collaboratorIds: d.collaboratorIds ?? null,
    isTaskGenerated: Boolean(d.isTaskGenerated),
    createdAt: d.createdAt ? extractDateString(d.createdAt) : undefined,
  };
}

/**
 * Maps an array of raw directives to DocumentDirectiveDTO[].
 */
export function toDocumentDirectiveDTOArray(rawList: unknown[]): DocumentDirectiveDTO[] {
  if (!Array.isArray(rawList)) return [];
  return rawList
    .map(toDocumentDirectiveDTO)
    .filter((d): d is DocumentDirectiveDTO => d !== null);
}
