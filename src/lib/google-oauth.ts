import { serverEnv } from "@/config/env.server";

export interface GoogleTokens {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

export interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
  hd?: string;
}

export const OFFICIAL_DOMAIN = "cdktcnqn.edu.vn";

/**
 * Kiểm tra địa chỉ email có thuộc tên miền Google Workspace chính thức của trường hay không.
 * Yêu cầu: Email bắt buộc kết thúc bằng @cdktcnqn.edu.vn
 */
export function isAllowedDomain(email?: string | null, _hd?: string | null): boolean {
  if (!email || typeof email !== "string") return false;
  const normalized = email.trim().toLowerCase();
  return normalized.endsWith(`@${OFFICIAL_DOMAIN}`);
}

/**
 * Phân giải URL gốc của ứng dụng (Base URL), hỗ trợ Nginx/Docker reverse proxy
 */
export function getAppBaseUrl(req?: Request): string {
  if (serverEnv.NEXTAUTH_URL) {
    return serverEnv.NEXTAUTH_URL.replace(/\/$/, "");
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }

  if (req) {
    const forwardedHost = req.headers.get("x-forwarded-host");
    const forwardedProto = req.headers.get("x-forwarded-proto") || "https";
    if (forwardedHost) {
      return `${forwardedProto}://${forwardedHost}`.replace(/\/$/, "");
    }
    try {
      const url = new URL(req.url);
      return url.origin;
    } catch {
      // ignore
    }
  }

  return "http://localhost:3000";
}

/**
 * Xây dựng Authorization URL để chuyển hướng sang Google
 */
export function buildGoogleAuthUrl(options: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", options.clientId);
  url.searchParams.set("redirect_uri", options.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", options.state);
  url.searchParams.set("hd", OFFICIAL_DOMAIN);
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("access_type", "offline");
  return url.toString();
}

/**
 * Đổi authorization code lấy bộ tokens từ Google
 */
export async function exchangeGoogleCode(options: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<GoogleTokens> {
  const params = new URLSearchParams({
    code: options.code,
    client_id: options.clientId,
    client_secret: options.clientSecret,
    redirect_uri: options.redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Google token exchange failed: ${res.status} ${errorBody}`);
  }

  return res.json();
}

/**
 * Lấy thông tin người dùng từ Google qua access token
 */
export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Google userinfo fetch failed: ${res.status} ${errorBody}`);
  }

  return res.json();
}
