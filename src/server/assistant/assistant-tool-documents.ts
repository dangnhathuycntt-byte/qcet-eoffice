/**
 * Công cụ văn bản của Trợ lý (chỉ đọc). Chỉ trả văn bản THUONG và không thuộc loại RESTRICTED/PERSONAL_DATA,
 * kể cả khi người hỏi có quan hệ trực tiếp với văn bản đó.
 */
import { z } from "zod";
import { DocumentStatus, DocumentType, DocumentSecurityLevel, type Prisma } from "@prisma/client";
import { listDocuments } from "@/server/documents/document-service";
import { KIND_LABEL, getDocumentKind, urgencyLabel } from "@/lib/documents/document-view-model";
import { getLedgerStepLabel } from "@/lib/documents/document-ledger-format";
import type { AssistantSourceRef } from "@/contracts/assistant";
import type { AuthorizationContext } from "@/server/authorization/authorization-context";
import { resolveDocumentApplicationClassification } from "@/server/authorization/document-classification";
import { buildDocumentReadWhere, canReadDocument } from "@/server/policies/document-policy";
import { assistantSourceHref } from "@/domain/assistant/assistant-sources";
import { isAssistantEligibleDocument, RESTRICTED_NOTE_MARKERS } from "@/domain/assistant/assistant-document-eligibility";
import { getStatusDisplay } from "@/domain/tasks/display-config";
import type { DocumentItem } from "@/types/document";
import { readDocumentForUser } from "@/server/documents/read-document-for-user";
import { readTaskForUser } from "@/server/tasks/read-task-for-user";
import { clip, ictDate, isAccessDenial, redactContact, RESTRICTED_MESSAGE, ToolFailure } from "./assistant-tool-shared";

/** Số văn bản tối đa trong một lần liệt kê. */
export const DOCUMENT_LIST_LIMIT = 20;
/** Số văn bản tối đa cho một lần tìm kiếm. */
export const DOCUMENT_SEARCH_LIMIT = 10;
/** Số văn bản hạn chế tối đa được quét để đếm excludedRestricted. */
const EXCLUDED_SCAN_LIMIT = 100;
const DOCUMENT_SUMMARY_LIST_MAX = 300;
const DOCUMENT_SUMMARY_DETAIL_MAX = 1500;
const DIRECTIVE_INSTRUCTION_MAX = 500;

const TYPE_BY_ARG = {
  incoming: DocumentType.VAN_BAN_DEN,
  outgoing: DocumentType.VAN_BAN_DI,
  internal: DocumentType.TO_TRINH_NOI_BO,
} as const;

export const ListDocumentsArgs = z
  .object({
    type: z.enum(["incoming", "outgoing", "internal"]).optional(),
    bucket: z.enum(["pending", "done", "issued", "recalled"]).optional(),
    status: z.enum(DocumentStatus).optional(),
    query: z.string().trim().min(1).max(100).optional(),
    limit: z.number().int().min(1).max(DOCUMENT_LIST_LIMIT).optional(),
  })
  .strict()
  .refine((value) => value.bucket === undefined || value.type === "incoming" || value.type === "outgoing", {
    message: "bucket chỉ dùng với văn bản đến hoặc văn bản đi.",
  });
export type ListDocumentsInput = z.infer<typeof ListDocumentsArgs>;

export const GetDocumentArgs = z.object({ id: z.string().trim().min(1).max(64) }).strict();

/**
 * Văn bản không gửi cho Trợ lý: không phải THUONG, hoặc ghi chú/phân loại là hạn chế (RESTRICTED/PERSONAL_DATA).
 * Ghi chú dùng chung mẫu với bộ lọc DB và menu giao diện (domain/assistant), để các nơi không lệch nhau.
 */
export function isRestrictedDocument(doc: { securityLevel?: string | null; notes?: string | null }): boolean {
  if (!isAssistantEligibleDocument(doc)) return true;
  const { applicationClassification } = resolveDocumentApplicationClassification({
    securityLevel: doc.securityLevel,
    notes: doc.notes,
  });
  return applicationClassification === "RESTRICTED" || applicationClassification === "PERSONAL_DATA";
}

/**
 * Điều kiện ACL của danh sách văn bản. Quản trị hệ thống không có chức danh không đọc nghiệp vụ văn bản
 * (cùng quy tắc canAccessClassification), nên không lấy gì cả.
 */
function documentAclWhere(authz: AuthorizationContext): Prisma.DocumentWhereInput {
  if (authz.isSystemAdmin() && authz.positions.length === 0) {
    return { id: "__DENY_SYSTEM_ADMIN_WITHOUT_POSITION__" };
  }
  return buildDocumentReadWhere(authz);
}

/** Loại trừ ở DB các văn bản có ghi chú hạn chế; NULL được giữ lại (NOT với NULL sẽ làm rơi dòng). */
function notRestrictedNotesWhere(): Prisma.DocumentWhereInput {
  return {
    OR: [
      { notes: null },
      {
        AND: RESTRICTED_NOTE_MARKERS.map((marker) => ({
          NOT: { notes: { contains: marker, mode: "insensitive" as const } },
        })),
      },
    ],
  };
}

/** Số ký hiệu gốc đã che liên hệ (số thường giữ nguyên), null khi trống. Dùng chung cho số hiển thị và mã nguồn. */
function originalNumberOf(doc: DocumentItem): string | null {
  const original = doc.originalNumber?.trim();
  return original ? redactContact(original) : null;
}

export function documentNumberOf(doc: DocumentItem): string {
  return originalNumberOf(doc) ?? `Số sổ ${doc.registrationNumber}/${doc.documentYear}`;
}

function documentStatusLabel(doc: DocumentItem): string {
  return getLedgerStepLabel(doc.status, doc.workflowStatus ?? undefined, doc.type).label;
}

export function documentSource(doc: DocumentItem): AssistantSourceRef {
  return {
    type: "document",
    id: doc.id,
    code: originalNumberOf(doc),
    title: clip(doc.summary, 200),
    href: assistantSourceHref("document", doc.id),
  };
}

function toDocumentListItem(doc: DocumentItem) {
  return {
    id: doc.id,
    number: documentNumberOf(doc),
    summary: clip(doc.summary, DOCUMENT_SUMMARY_LIST_MAX),
    typeLabel: KIND_LABEL[getDocumentKind(doc.type)],
    issuingAuthority: doc.issuingAuthority ? redactContact(doc.issuingAuthority) : null,
    issuedDate: ictDate(doc.issuedDate),
    dueDate: ictDate(doc.dueDate),
    statusLabel: documentStatusLabel(doc),
    urgency: urgencyLabel(doc.urgency),
    leadUnit: doc.leadUnitName ?? null,
  };
}

export interface DocumentListRead {
  total: number;
  /** Số văn bản bị loại vì mật/hạn chế trong phạm vi người hỏi được xem (chỉ đếm, không trả nội dung). */
  excludedRestricted: number;
  documents: DocumentItem[];
}

/**
 * Văn bản người hỏi được xem theo bộ lọc, đã loại văn bản mật/hạn chế.
 * `total` là số sau lọc khi trang đầu không bị loại dòng; nếu có dòng bị loại ở trang đầu thì đó là ước lượng.
 */
export async function listReadableDocuments(
  authz: AuthorizationContext,
  filter: { type?: DocumentType; bucket?: "pending" | "done" | "issued" | "recalled"; status?: DocumentStatus; query?: string; limit: number }
): Promise<DocumentListRead> {
  const acl = documentAclWhere(authz);
  const base = {
    type: filter.type,
    bucket: filter.bucket,
    status: filter.status,
    search: filter.query,
  };
  const readable = await listDocuments({
    ...base,
    limit: filter.limit,
    aclWhere: { AND: [acl, { securityLevel: DocumentSecurityLevel.THUONG }, notRestrictedNotesWhere()] },
  });
  // Số bị loại chỉ đếm văn bản THUONG có ghi chú hạn chế mà người hỏi vẫn được xem theo chính sách.
  // Không đếm văn bản mật (chính sách chặn dù ACL cho qua) và không đếm văn bản hạn chế của người không liên quan,
  // để con số không dò được sự tồn tại của chúng. Với nhiều hơn EXCLUDED_SCAN_LIMIT dòng thì đây là cận dưới.
  const restrictedScan = await listDocuments({
    ...base,
    limit: EXCLUDED_SCAN_LIMIT,
    aclWhere: { AND: [acl, { securityLevel: DocumentSecurityLevel.THUONG }, { NOT: notRestrictedNotesWhere() }] },
  });

  const kept = readable.documents.filter((doc) => canReadDocument(authz, doc) && !isRestrictedDocument(doc));
  const dropped = readable.documents.length - kept.length;
  return {
    total: Math.max(0, readable.total - dropped),
    excludedRestricted: restrictedScan.documents.filter((doc) => canReadDocument(authz, doc)).length,
    documents: kept,
  };
}

export function listDocumentItems(documents: DocumentItem[]) {
  return documents.map(toDocumentListItem);
}

export function resolveDocumentType(type: ListDocumentsInput["type"]): DocumentType | undefined {
  return type ? TYPE_BY_ARG[type] : undefined;
}

export function listTypeLabel(type: ListDocumentsInput["type"]): string {
  if (type === "incoming") return "văn bản đến";
  if (type === "outgoing") return "văn bản đi";
  if (type === "internal") return "tờ trình nội bộ";
  return "văn bản";
}

export interface DocumentDetailRead {
  view: Record<string, unknown>;
  self: AssistantSourceRef;
  related: AssistantSourceRef[];
}

/**
 * Chi tiết một văn bản: qua readDocumentForUser (ACL và nhánh người tham gia tờ trình), rồi mới kiểm
 * THUONG và phân loại. Văn bản bị loại thì ném ToolFailure với câu riêng.
 */
export async function readDocumentDetail(authz: AuthorizationContext, documentId: string): Promise<DocumentDetailRead> {
  const { document } = await readDocumentForUser(authz, documentId);
  if (isRestrictedDocument(document)) {
    throw new ToolFailure(RESTRICTED_MESSAGE);
  }

  let linkedTask: Record<string, unknown> | null = null;
  const related: AssistantSourceRef[] = [];
  if (document.linkedTask) {
    try {
      const { task } = await readTaskForUser(authz, document.linkedTask.id);
      linkedTask = {
        id: task.id,
        code: task.code,
        title: redactContact(task.title),
        statusLabel: getStatusDisplay(task.status).label,
        dueDate: ictDate(task.dueDate),
      };
      related.push({
        type: "task",
        id: task.id,
        code: task.code,
        title: redactContact(task.title),
        href: assistantSourceHref("task", task.id),
      });
    } catch (error) {
      // Nhiệm vụ liên kết không đọc được thì ẩn, không báo lỗi cả văn bản.
      if (!isAccessDenial(error)) throw error;
    }
  }

  const view: Record<string, unknown> = {
    id: document.id,
    number: documentNumberOf(document),
    typeLabel: KIND_LABEL[getDocumentKind(document.type)],
    statusLabel: documentStatusLabel(document),
    urgency: urgencyLabel(document.urgency),
    summary: clip(document.summary, DOCUMENT_SUMMARY_DETAIL_MAX),
    issuingAuthority: document.issuingAuthority ? redactContact(document.issuingAuthority) : null,
    issuedDate: ictDate(document.issuedDate),
    dueDate: ictDate(document.dueDate),
    leadUnit: document.leadUnitName ?? null,
    leadUser: document.leadUserName ?? null,
    signer: document.signerName ?? null,
    signerTitle: document.signerTitle ?? null,
    linkedTask,
    directives: (document.directives ?? []).map((directive) => ({
      leaderName: directive.leaderName ?? null,
      instruction: clip(directive.instruction, DIRECTIVE_INSTRUCTION_MAX),
      deadline: ictDate(directive.deadline),
    })),
    attachments: (document.attachments ?? []).map((file) => redactContact(file.fileName)),
  };

  return { view, self: documentSource(document), related };
}

export const DOCUMENT_DETAIL_LISTS = ["directives", "attachments"] as const;
export const DOCUMENT_LIST_LISTS = ["documents"] as const;
