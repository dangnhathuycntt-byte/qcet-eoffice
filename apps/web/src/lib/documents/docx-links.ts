/**
 * Liên kết trong tệp Word lấy nguyên đích ghi trong tệp (có thể là `javascript:`, `file:`…).
 * Chỉ giữ liên kết web, thư điện tử và liên kết nội bộ (#mục) khi dựng tệp trong trình xem.
 */
export function isAllowedDocxHref(href: string | null | undefined): boolean {
  const value = (href ?? "").trim();
  if (!value) return false;
  if (value.startsWith("#")) return true;
  return /^(https?:|mailto:)/i.test(value);
}
