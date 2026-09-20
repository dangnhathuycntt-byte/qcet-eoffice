/**
 * QCET Work - Shared Format & Display Helpers
 * Tuân thủ quy chuẩn định dạng thời gian ICT (UTC+7) và chuẩn giao diện tiếng Việt.
 */

/**
 * Lấy chữ viết tắt (initials) cho avatar từ họ và tên tiếng Việt / tiếng Anh.
 * Ví dụ: "Đặng Nhật Huy" -> "ĐH", "Admin" -> "AD", "" -> "QC"
 */
export function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return "QC";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0].charAt(0);
  const last = parts[parts.length - 1].charAt(0);
  return (first + last).toUpperCase();
}
