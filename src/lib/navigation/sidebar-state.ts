/**
 * Trạng thái thu gọn của sidebar lưu trong cookie để server render đúng ngay lần vẽ đầu
 * (đọc localStorage sau hydrate làm sidebar mở 247px rồi co lại ở mỗi lần tải trang).
 * Module thường, không "use client": root layout (server) cần giá trị thật của tên cookie.
 */
export const SIDEBAR_COLLAPSED_COOKIE = "qcet_sidebar_collapsed";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function parseSidebarCollapsed(value: string | null | undefined): boolean | null {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

export function serializeSidebarCollapsedCookie(collapsed: boolean): string {
  return `${SIDEBAR_COLLAPSED_COOKIE}=${collapsed}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
}

/** Đọc giá trị từ chuỗi `document.cookie`; `null` khi chưa có cookie. */
export function readSidebarCollapsedFromCookieString(cookieString: string): boolean | null {
  for (const part of cookieString.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SIDEBAR_COLLAPSED_COOKIE) return parseSidebarCollapsed(rest.join("="));
  }
  return null;
}
