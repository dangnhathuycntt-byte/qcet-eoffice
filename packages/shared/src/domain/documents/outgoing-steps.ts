/**
 * Bước xử lý của văn bản đi: từ trạng thái nào có thao tác nào, ai đang giữ bước và việc đang chờ. Thuần túy, không đọc DB.
 * Server dùng để tính thao tác người xem được làm (`outgoingStep` của chi tiết văn bản); web dùng bảng thao tác để dựng
 * hộp xác nhận. Khớp `OutgoingDocumentService` (mỗi route kiểm đúng trạng thái xuất phát) và máy trạng thái
 * `OUTGOING_DOCUMENT_TRANSITIONS`; `to: null` là thao tác không đổi trạng thái (ký chức danh).
 * Phát hành làm ở khối nơi nhận (cần danh sách nơi nhận) nên không nằm ở đây.
 */
import type { OutgoingDocumentStatus } from "@qcet/contracts/documents";
import type { OutgoingStepSlug, OutgoingWaiting } from "@qcet/contracts/types/document";

export type { OutgoingStepSlug, OutgoingStepView, OutgoingWaiting } from "@qcet/contracts/types/document";

export interface OutgoingStepAction {
  action: OutgoingStepSlug;
  to: OutgoingDocumentStatus | null;
  /** Cần nhập lý do/ghi chú (gửi trong `notes`). */
  requiresNote?: boolean;
}

export const OUTGOING_STEP_ACTIONS: Partial<Record<OutgoingDocumentStatus, OutgoingStepAction[]>> = {
  DRAFT: [{ action: "submit-content-review", to: "CONTENT_REVIEW" }],
  CONTENT_REVIEW: [
    { action: "approve-content", to: "FORMAT_CHECK" },
    { action: "reject-content", to: "DRAFT", requiresNote: true },
    // Người soạn lấy lại dự thảo khi người duyệt chưa quyết (đang CONTENT_REVIEW nghĩa là chưa duyệt)
    { action: "withdraw-content-review", to: "DRAFT" },
  ],
  FORMAT_CHECK: [{ action: "approve-format", to: "AUTHORIZED_SIGN" }],
  AUTHORIZED_SIGN: [
    { action: "sign", to: null },
    { action: "assign-number", to: "NUMBERED" },
  ],
  NUMBERED: [{ action: "organization-sign", to: "ORGANIZATION_SIGNED" }],
};

/** Tiền tố ghi chú duyệt khi người duyệt trả dự thảo về Nháp; phần sau dấu hai chấm là lý do người trả nhập. */
export const RETURNED_NOTE_PREFIX = "[Trả lại]";

/** Ghi chú duyệt nội dung của dự thảo bị trả lại; `note` trống thì chỉ có tiền tố. */
export function formatReturnedNote(note?: string | null): string {
  const reason = note?.trim();
  return reason ? `${RETURNED_NOTE_PREFIX}: ${reason}` : RETURNED_NOTE_PREFIX;
}

/** Ghi chú duyệt có phải do người duyệt trả lại không (kể cả bản ghi cũ ghi "[Trả lại soạn thảo …]"). */
export function isReturnedNote(notes: string | null | undefined): boolean {
  return Boolean(notes?.startsWith("[Trả lại"));
}

/** Lý do người trả nhập, null khi không có (bản ghi cũ dùng câu mặc định thay cho lý do). */
export function returnedReasonOf(notes: string | null | undefined): string | null {
  if (!isReturnedNote(notes)) return null;
  const match = /^\[Trả lại\]:\s*([\s\S]+)$/.exec(notes ?? "");
  return match ? match[1].trim() || null : null;
}

/**
 * Thao tác của bước đang chờ. Ký chức danh không đổi trạng thái nên AUTHORIZED_SIGN gồm hai bước liên tiếp:
 * chờ ký (`authorizedSignedAt` trống), rồi chờ cấp số; chỉ hiện thao tác của đúng bước.
 */
export function outgoingStepSlugsForState(
  status: OutgoingDocumentStatus,
  authorizedSignedAt: Date | string | null | undefined
): OutgoingStepSlug[] {
  const all = (OUTGOING_STEP_ACTIONS[status] ?? []).map((step) => step.action);
  if (status !== "AUTHORIZED_SIGN") return all;
  return all.filter((action) => (authorizedSignedAt ? action === "assign-number" : action === "sign"));
}

type DateLike = Date | string | null | undefined;

export interface OutgoingWaitingInput {
  status: OutgoingDocumentStatus;
  contentReviewSubmittedAt?: DateLike;
  formatReviewSubmittedAt?: DateLike;
  formatApprovedAt?: DateLike;
  authorizedSignedAt?: DateLike;
  numberedAt?: DateLike;
  orgSignedAt?: DateLike;
  contentReviewerName?: string | null;
  authorizedSignerName?: string | null;
}

function iso(value: DateLike): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Bước đang chờ của văn bản đi; null ở nháp và khi không còn bước nào trước phát hành. */
export function describeOutgoingWaiting(input: OutgoingWaitingInput): OutgoingWaiting | null {
  switch (input.status) {
    case "CONTENT_REVIEW":
      return {
        who: input.contentReviewerName || "Trưởng đơn vị",
        task: "duyệt nội dung",
        since: iso(input.contentReviewSubmittedAt),
      };
    case "FORMAT_CHECK":
      // Duyệt nội dung xong là thể thức chờ kiểm ngay (`formatReviewSubmittedAt` ghi lúc duyệt).
      return { who: "Văn thư", task: "kiểm tra thể thức", since: iso(input.formatReviewSubmittedAt) };
    case "AUTHORIZED_SIGN":
      return input.authorizedSignedAt
        ? { who: "Văn thư", task: "cấp số", since: iso(input.authorizedSignedAt) }
        : { who: input.authorizedSignerName || "Lãnh đạo", task: "ký", since: iso(input.formatApprovedAt) };
    case "NUMBERED":
      return { who: "Văn thư", task: "đóng dấu cơ quan", since: iso(input.numberedAt) };
    case "ORGANIZATION_SIGNED":
      return { who: "Văn thư", task: "phát hành", since: iso(input.orgSignedAt) };
    default:
      return null;
  }
}
