import type { DocumentItem, DocumentStatus, DocumentUrgency, OfficialDocument } from "@/types/document";
import {
  formatLedgerDate,
  getLedgerDueNote,
  getLedgerStepLabel,
  getLedgerUrgencyTag,
  type LedgerDueTone,
  type LedgerStepKind,
} from "@/lib/documents/document-ledger-format";
import { sortDocumentFiles } from "@/lib/documents/file-viewer-state";

/**
 * Mô hình hiển thị chung cho Quick View và Full Page: gom ba nguồn dữ liệu
 * (dòng danh sách, `DocumentItem` từ API, dữ liệu trang chi tiết) về một dạng,
 * để mọi bề mặt dựng cùng một tiêu đề, metadata và danh sách tệp.
 */
export type DocumentKind = "incoming" | "outgoing" | "submission";

export interface ViewFile {
  id: string;
  name: string;
  url?: string | null;
  sizeBytes?: number | null;
  mimeType?: string | null;
  isOriginal?: boolean;
}

export interface ViewLinkedTask {
  id: string;
  title?: string | null;
  code?: string | null;
  status?: string | null;
  dueDate?: string | null;
  progressPercent?: number | null;
}

export interface ViewDetailRow {
  label: string;
  value: string;
  mono?: boolean;
}

export interface DocumentViewModel {
  id: string;
  kind: DocumentKind;
  typeLabel: string;
  /** Ví dụ "Số đến 0028"; null khi chưa có. */
  numberLabel: string | null;
  title: string;
  step: { label: string; kind: LedgerStepKind };
  urgency: { label: string; tone: "danger" | "warning" } | null;
  dueDate: string | null;
  dueNote: { text: string; tone: LedgerDueTone } | null;
  /** Số/ký hiệu văn bản (hiển thị dạng mono). */
  documentNumber: string | null;
  detailRows: ViewDetailRow[];
  files: ViewFile[];
  linkedTaskId: string | null;
  linkedTask: ViewLinkedTask | null;
  /** Văn bản đã có chữ ký số (mở hộp thoại xem chữ ký). */
  hasSignature: boolean;
}

const KIND_BY_TYPE: Record<string, DocumentKind> = {
  VAN_BAN_DEN: "incoming",
  inbox: "incoming",
  VAN_BAN_DI: "outgoing",
  outbox: "outgoing",
  TO_TRINH_NOI_BO: "submission",
  submission: "submission",
};

export const KIND_LABEL: Record<DocumentKind, string> = {
  incoming: "Văn bản đến",
  outgoing: "Văn bản đi",
  submission: "Tờ trình",
};

export const SECURITY_LABEL: Record<string, string> = {
  THUONG: "Thường",
  PUBLIC: "Thường",
  INTERNAL: "Nội bộ",
  MAT: "Mật",
  CONFIDENTIAL: "Mật",
  TOI_MAT: "Tối mật",
  TUYET_MAT: "Tuyệt mật",
  SECRET: "Tuyệt mật",
};

const URGENCY_LABEL: Record<string, string> = {
  flash: "Hỏa tốc",
  HOA_TOC: "Hỏa tốc",
  top_urgent: "Thượng khẩn",
  THUONG_KHAN: "Thượng khẩn",
  urgent: "Khẩn",
  KHAN: "Khẩn",
  normal: "Thường",
  THUONG: "Thường",
};

export const urgencyLabel = (urgency: DocumentUrgency | string) => URGENCY_LABEL[urgency] ?? "Thường";

export function getDocumentKind(type: string | null | undefined): DocumentKind {
  return KIND_BY_TYPE[type ?? ""] ?? "incoming";
}

const pad4 = (value: number) => String(value).padStart(4, "0");
const dateOnly = (value?: string | Date | null) => (value ? (typeof value === "string" ? value : value.toISOString()).slice(0, 10) : "");

const toRows = (rows: Array<ViewDetailRow | null>): ViewDetailRow[] => rows.filter((row): row is ViewDetailRow => Boolean(row && row.value));

const stepKindOf = (status: DocumentStatus, workflowStatus: string | null | undefined, kind: DocumentKind) =>
  getLedgerStepLabel(status, workflowStatus ?? undefined, kind === "incoming" ? "inbox" : kind === "outgoing" ? "outbox" : "submission");

/** Đường dẫn trang đầy đủ của văn bản; `fileId` giữ tệp đang xem. */
export function getFullPageHref(kind: DocumentKind, id: string, fileId?: string | null): string {
  const base = kind === "incoming" ? `/documents/incoming/${id}` : kind === "outgoing" ? `/documents/outgoing/${id}` : `/documents/${id}`;
  return fileId ? `${base}?file=${encodeURIComponent(fileId)}` : base;
}

/** Từ dữ liệu API (`GET /api/documents/[id]`). */
export function fromDocumentItem(item: DocumentItem, now?: string): DocumentViewModel {
  const kind = getDocumentKind(item.type);
  const out = item.outgoingWorkflow as { status?: string; outgoingNumber?: string | number; codeNotation?: string; issuedDate?: string; draftingDeptName?: string; authorizedSigner?: { name?: string } } | null | undefined;
  const inc = item.incomingWorkflow as { leadUnit?: { name?: string } } | null | undefined;
  const workflowStatus = kind === "outgoing" ? out?.status ?? "DRAFT" : item.workflowStatus ?? null;
  const step = stepKindOf(item.status, workflowStatus, kind);
  const urgencyTag = getLedgerUrgencyTag(item.urgency);
  const due = dateOnly(item.dueDate);
  const outNumber = out?.outgoingNumber ? `${out.outgoingNumber}${out.codeNotation ? `/${out.codeNotation}` : ""}` : null;
  const issued = formatLedgerDate(dateOnly(out?.issuedDate) || dateOnly(item.issuedDate));
  const files = sortDocumentFiles(
    (item.attachments ?? []).map((a) => ({ id: a.id, name: a.fileName, url: a.fileUrl, sizeBytes: a.fileSize, mimeType: a.mimeType, isOriginal: a.isOriginal })),
  );
  const linkedTask = item.linkedTask
    ? {
        id: item.linkedTask.id,
        title: item.linkedTask.title,
        code: item.linkedTask.code,
        status: item.linkedTask.status,
        dueDate: item.linkedTask.dueDate,
        progressPercent: item.linkedTask.progressPercent,
      }
    : item.linkedTaskId
    ? { id: item.linkedTaskId }
    : null;
  const leadName = item.leadUnitName ?? inc?.leadUnit?.name ?? "";

  const detailRows =
    kind === "outgoing"
      ? toRows([
          { label: "Soạn thảo", value: out?.draftingDeptName || item.leadUnitName || "" },
          { label: "Người ký", value: out?.authorizedSigner?.name || item.signerName || "" },
          { label: "Độ mật", value: SECURITY_LABEL[item.securityLevel || "THUONG"] ?? String(item.securityLevel ?? "Thường") },
          { label: "Ngày ban hành", value: issued, mono: true },
        ])
      : toRows([
          { label: "Cơ quan ban hành", value: item.issuingAuthority },
          { label: "Người ký", value: item.signerName ? `${item.signerName}${item.signerTitle ? ` (${item.signerTitle})` : ""}` : "" },
          { label: "Ngày ban hành", value: issued, mono: true },
          { label: "Ngày đến", value: kind === "incoming" ? formatLedgerDate(dateOnly(item.registeredDate)) : "", mono: true },
          { label: "Chủ trì", value: leadName },
          { label: "Mức khẩn", value: urgencyLabel(item.urgency) },
        ]);

  return {
    id: item.id,
    kind,
    typeLabel: KIND_LABEL[kind],
    numberLabel:
      kind === "outgoing"
        ? outNumber ?? "Chưa cấp số"
        : item.registrationNumber != null
        ? `${kind === "incoming" ? "Số đến" : "Số"} ${pad4(item.registrationNumber)}`
        : null,
    title: item.summary || KIND_LABEL[kind],
    step: { label: step.label, kind: step.kind },
    urgency: urgencyTag ? { label: urgencyLabel(item.urgency), tone: urgencyTag.tone } : null,
    dueDate: due || null,
    dueNote: kind === "outgoing" ? null : getLedgerDueNote(due || undefined, step.kind === "done", now),
    documentNumber: kind === "outgoing" ? outNumber : item.originalNumber || null,
    detailRows,
    files,
    linkedTaskId: item.linkedTaskId ?? null,
    linkedTask,
    hasSignature: (item.signatures?.length ?? 0) > 0,
  };
}

/** Từ dòng danh sách đã map (`OfficialDocument`): đủ để dựng tiêu đề ngay khi dữ liệu chi tiết còn đang tải. */
export function fromOfficialDocument(doc: OfficialDocument, now?: string): DocumentViewModel {
  const kind = getDocumentKind(doc.type);
  const step = stepKindOf(doc.status, doc.workflowStatus, kind);
  const urgencyTag = getLedgerUrgencyTag(doc.urgency);
  const files = doc.attachments?.length
    ? doc.attachments.map((a) => ({ id: a.id, name: a.name, url: a.url, sizeBytes: a.sizeBytes, mimeType: a.mimeType }))
    : doc.fileAttachment
    ? [{ id: "primary", name: doc.fileAttachment.name, url: doc.fileAttachment.url }]
    : [];
  return {
    id: doc.id,
    kind,
    typeLabel: KIND_LABEL[kind],
    numberLabel: doc.registrationNumber != null ? `${kind === "incoming" ? "Số đến" : "Số"} ${pad4(doc.registrationNumber)}` : null,
    title: doc.summary || KIND_LABEL[kind],
    step: { label: step.label, kind: step.kind },
    urgency: urgencyTag ? { label: urgencyLabel(doc.urgency), tone: urgencyTag.tone } : null,
    dueDate: doc.dueDate ?? null,
    dueNote: kind === "outgoing" ? null : getLedgerDueNote(doc.dueDate, step.kind === "done", now),
    documentNumber: doc.documentNumber || null,
    detailRows: toRows([
      { label: "Cơ quan ban hành", value: doc.issuingAuthority },
      { label: "Người ký", value: doc.signatory },
      { label: "Ngày ban hành", value: formatLedgerDate(doc.issuedDate), mono: true },
      { label: "Ngày đến", value: kind === "incoming" ? formatLedgerDate(doc.receivedDate) : "", mono: true },
      { label: "Chủ trì", value: doc.leadDepartment },
      { label: "Mức khẩn", value: urgencyLabel(doc.urgency) },
    ]),
    files,
    linkedTaskId: doc.linkedTaskId ?? null,
    linkedTask: doc.linkedTaskId
      ? {
          id: doc.linkedTaskId,
          title: doc.linkedTaskTitle,
          status: doc.linkedTaskStatus,
          dueDate: doc.linkedTaskDueDate,
          progressPercent: doc.linkedTaskProgressPercent,
        }
      : null,
    hasSignature: (doc.signatures?.length ?? 0) > 0,
  };
}
