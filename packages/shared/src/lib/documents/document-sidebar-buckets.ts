/**
 * Nhóm trạng thái dùng cho menu con "Văn bản" ở sidebar.
 * - Văn bản đến: dựa trên `Document.status`.
 * - Văn bản đi: dựa trên `DocumentOutgoingWorkflow.status` (văn bản chưa có workflow
 *   được suy ra từ `Document.status`).
 */
export type DocumentBucket = "pending" | "done" | "issued" | "recalled";

export const DOCUMENT_BUCKETS: readonly DocumentBucket[] = ["pending", "done", "issued", "recalled"];

export function parseDocumentBucket(value: string | null | undefined): DocumentBucket | "" {
  const v = (value ?? "").trim().toLowerCase();
  return (DOCUMENT_BUCKETS as readonly string[]).includes(v) ? (v as DocumentBucket) : "";
}

/** `Document.status` đã xử lý xong: hết tính trễ hạn, vào nhóm "Đã xử lý". */
export const DOCUMENT_DONE_STATUSES = ["DA_HOAN_THANH", "LUU_THEO_DOI"] as const;
