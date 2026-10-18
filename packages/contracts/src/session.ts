import type { UserRole } from "./types/auth";

/** Tên cookie phiên (Auth.js v5 và bản cũ). API đọc, ký và xóa; web chỉ kiểm có cookie để chuyển trang sớm. */
export const SESSION_COOKIE_NAME = "authjs.session-token";
export const SECURE_SESSION_COOKIE_NAME = "__Secure-authjs.session-token";
export const LEGACY_SESSION_COOKIE_NAME = "qcet_session";

/** Thông tin phiên đã xác minh (JWT/JWE/phiên DB) mà API dùng. */
export interface SessionPayload {
  id: string;
  email: string;
  name: string;
  role: UserRole | "BAN_GIAM_HIEU" | "TRUONG_PHONG" | "CHUYEN_VIEN" | string;
  departmentId?: string | null;
  title?: string | null;
  isActive?: boolean;
  sessionId?: string;
  jti?: string;
}
