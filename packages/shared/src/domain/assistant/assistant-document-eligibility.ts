/**
 * Quy tắc văn bản Trợ lý được đọc, dùng chung cho server (công cụ văn bản) và giao diện (menu Thao tác của văn bản).
 * Thuần, không import Prisma hay module server; phần phân loại RESTRICTED/PERSONAL_DATA ở server vẫn chạy thêm.
 */

/** Mẫu ghi chú đánh dấu văn bản hạn chế (chữ thường, đã chuẩn hóa NFC). */
export const RESTRICTED_NOTE_MARKERS = ["restricted", "giới hạn", "gioi_han"] as const;

/**
 * Ghi chú có mẫu hạn chế, không phân biệt hoa thường và chuẩn hóa Unicode. So cả chữ thường lẫn chữ hoa: bộ phân loại
 * ở server so sau khi viết hoa, nên "reſtricted" (ſ dài) hay "restrıcted" (ı không chấm) cũng phải bị loại ở đây.
 */
export function hasRestrictedNote(notes: string | null | undefined): boolean {
  if (!notes) return false;
  const normalized = notes.normalize("NFC");
  const lower = normalized.toLowerCase();
  const upper = normalized.toUpperCase();
  return RESTRICTED_NOTE_MARKERS.some((marker) => lower.includes(marker) || upper.includes(marker.toUpperCase()));
}

/** Văn bản THUONG và ghi chú không có mẫu hạn chế: điều kiện tối thiểu để Trợ lý đọc. */
export function isAssistantEligibleDocument(doc: { securityLevel?: string | null; notes?: string | null }): boolean {
  // Giá trị "THUONG" trùng DocumentSecurityLevel.THUONG; không import Prisma để giữ lớp domain thuần
  return doc.securityLevel === "THUONG" && !hasRestrictedNote(doc.notes);
}
