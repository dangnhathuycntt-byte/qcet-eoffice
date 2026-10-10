import type { OutgoingDocumentStatus } from "@/contracts/documents";

/**
 * Thao tác theo bước của văn bản đi: từ trạng thái nào gọi route nào và route đó chuyển sang trạng thái nào.
 * Khớp với `OutgoingDocumentService` (mỗi route kiểm đúng trạng thái xuất phát) và máy trạng thái
 * `OUTGOING_DOCUMENT_TRANSITIONS`; `to: null` là thao tác không đổi trạng thái (ký chức danh).
 * Phát hành làm ở khối nơi nhận (cần danh sách nơi nhận) nên không nằm ở đây.
 */
export interface OutgoingStepAction {
  action: string;
  to: OutgoingDocumentStatus | null;
  /** Cần nhập lý do/ghi chú (gửi trong `notes`). */
  requiresNote?: boolean;
}

export const OUTGOING_STEP_ACTIONS: Partial<Record<OutgoingDocumentStatus, OutgoingStepAction[]>> = {
  DRAFT: [{ action: "submit-content-review", to: "CONTENT_REVIEW" }],
  CONTENT_REVIEW: [
    { action: "approve-content", to: "FORMAT_CHECK" },
    { action: "reject-content", to: "DRAFT", requiresNote: true },
  ],
  FORMAT_CHECK: [{ action: "approve-format", to: "AUTHORIZED_SIGN" }],
  AUTHORIZED_SIGN: [
    { action: "sign", to: null },
    { action: "assign-number", to: "NUMBERED" },
  ],
  NUMBERED: [{ action: "organization-sign", to: "ORGANIZATION_SIGNED" }],
};
