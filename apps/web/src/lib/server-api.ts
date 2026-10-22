import { cache } from "react";
import { headers } from "next/headers";
import type { z } from "zod";
import {
  AuthMeResponseSchema,
  PublicRuntimeConfigSchema,
  type AuthMeUser,
  type PublicRuntimeConfig,
} from "@qcet/contracts/page-data";

// Trang và layout của web đọc phiên, cấu hình và dữ liệu ban đầu qua API (D4, D5), không gọi service hay DB.
// Chỉ dùng ở server component: đọc header của yêu cầu trang qua next/headers.

/** Header của yêu cầu trang chuyển sang API: phiên, mã yêu cầu và địa chỉ gốc của người dùng. */
const FORWARDED_HEADERS = [
  "cookie",
  "authorization",
  "x-request-id",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
] as const;

/** Địa chỉ nội bộ của API (`API_INTERNAL_URL`, bắt buộc ở production); dev mặc định API ở cổng `API_PORT` (3100). */
export function apiInternalUrl(): string {
  const base =
    process.env.API_INTERNAL_URL ||
    (process.env.NODE_ENV === "production" ? "" : `http://127.0.0.1:${process.env.API_PORT || 3100}`);
  if (!base) throw new Error("API_INTERNAL_URL chưa đặt");
  return base.replace(/\/+$/, "");
}

/**
 * Header gửi kèm lời gọi API từ yêu cầu trang. Thiếu `x-forwarded-host` thì lấy Host của trang
 * (như proxy rewrite của Next) để API thấy tên miền người dùng mở, không phải địa chỉ nội bộ.
 */
export function forwardedHeaders(incoming: Pick<Headers, "get">): Headers {
  const out = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = incoming.get(name);
    if (value) out.set(name, value);
  }
  const host = incoming.get("host");
  if (!out.has("x-forwarded-host") && host) out.set("x-forwarded-host", host);
  return out;
}

/** fetch tới API nội bộ với phiên của yêu cầu trang hiện tại; không dùng cache của Next. */
export async function serverApiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const requestHeaders = forwardedHeaders(await headers());
  new Headers(init.headers).forEach((value, key) => requestHeaders.set(key, value));
  return fetch(`${apiInternalUrl()}${path}`, { ...init, headers: requestHeaders, cache: "no-store" });
}

export type PageDataResult<T> = { ok: true; data: T } | { ok: false; status: number };

/** GET dữ liệu trang: 2xx thì kiểm theo schema của @qcet/contracts, mã khác trả về để trang tự xử lý (401, 404…). */
export async function fetchPageData<T>(path: string, schema: z.ZodType<T>): Promise<PageDataResult<T>> {
  const response = await serverApiFetch(path);
  if (!response.ok) return { ok: false, status: response.status };
  return { ok: true, data: schema.parse(await response.json()) };
}

/**
 * Người dùng đang đăng nhập theo `GET /api/auth/me`; `null` khi chưa đăng nhập hoặc tài khoản đã khóa.
 * `cache`: layout gốc và trang cùng gọi trong một yêu cầu thì chỉ một lần tới API.
 */
export const getWebSession = cache(async (): Promise<AuthMeUser | null> => {
  const response = await serverApiFetch("/api/auth/me");
  if (!response.ok) throw new Error(`GET /api/auth/me trả ${response.status}`);
  const body = AuthMeResponseSchema.parse(await response.json());
  return body.authenticated ? body.user : null;
});

/** Cấu hình công khai theo `GET /api/runtime-config`; `null` khi API lỗi hoặc không gọi được. Một lần mỗi yêu cầu (`cache`). */
export const getRuntimeConfig = cache(async (): Promise<PublicRuntimeConfig | null> => {
  try {
    const response = await serverApiFetch("/api/runtime-config");
    if (!response.ok) return null;
    return PublicRuntimeConfigSchema.parse(await response.json());
  } catch {
    return null;
  }
});
