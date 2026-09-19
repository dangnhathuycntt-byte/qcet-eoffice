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

/**
 * Định dạng ngày theo chuẩn hành chính Việt Nam (DD/MM/YYYY hoặc tương đối).
 */
export function formatTaskDate(
  dateInput?: string | Date | null,
  options: { relative?: boolean; showYear?: boolean } = {}
): string {
  if (!dateInput) return "Chưa đặt";

  const { relative = false, showYear = true } = options;

  let d: Date;
  if (typeof dateInput === "string") {
    // Nếu chỉ là YYYY-MM-DD
    const clean = dateInput.split("T")[0];
    const parts = clean.split("-");
    if (parts.length === 3) {
      const [year, month, day] = parts;
      if (!relative) {
        return showYear
          ? `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`
          : `${day.padStart(2, "0")}/${month.padStart(2, "0")}`;
      }
      d = new Date(Number(year), Number(month) - 1, Number(day));
    } else {
      d = new Date(dateInput);
    }
  } else {
    d = dateInput;
  }

  if (isNaN(d.getTime())) return typeof dateInput === "string" ? dateInput : "Chưa đặt";

  if (relative) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Hôm nay";
    if (diffDays === 1) return "Ngày mai";
    if (diffDays === -1) return "Hôm qua";
    if (diffDays < -1) return `Quá hạn ${Math.abs(diffDays)} ngày`;
    if (diffDays <= 7) return `Còn ${diffDays} ngày`;
  }

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  return showYear ? `${day}/${month}/${year}` : `${day}/${month}`;
}
