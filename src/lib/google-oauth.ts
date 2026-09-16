import { serverEnv } from "@/config/env.server";
import { INSTITUTION_CONFIG } from "@/config/institution";

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

export const OFFICIAL_DOMAIN = INSTITUTION_CONFIG.domain || "cdktcnqn.edu.vn";

/**
 * Kiểm tra tài khoản có thuộc Google Workspace của trường (@cdktcnqn.edu.vn) hay không
 * dựa trên Google Workspace `hd` (hosted domain) claim và xác thực định danh email trên server.
 */
export function isAllowedDomain(email?: string | null, hd?: string | null): boolean {
  const officialDomain = OFFICIAL_DOMAIN.trim().toLowerCase();

  // 1. Kiểm tra Google Workspace Hosted Domain (`hd`) claim
  if (hd && typeof hd === "string") {
    if (hd.trim().toLowerCase() === officialDomain) {
      return true;
    }
  }

  // 2. Xác thực email suffix đối chiếu với tên miền chính thức của nhà trường
  if (email && typeof email === "string") {
    const normalized = email.trim().toLowerCase();
    if (normalized.endsWith(`@${officialDomain}`)) {
      return true;
    }
  }

  return false;
}

/**
 * Phân giải URL gốc của ứng dụng (Base URL), hỗ trợ Nginx/Docker reverse proxy
 */
export function getAppBaseUrl(req?: Request): string {
  if (req) {
    const forwardedHost = req.headers.get("x-forwarded-host");
    const forwardedProto = req.headers.get("x-forwarded-proto") || "https";
    if (forwardedHost) {
      return `${forwardedProto}://${forwardedHost.split(",")[0].trim()}`.replace(/\/$/, "");
    }
    const host = req.headers.get("host");
    if (host) {
      const proto = req.headers.get("x-forwarded-proto") || (host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https");
      return `${proto}://${host}`.replace(/\/$/, "");
    }
    try {
      const url = new URL(req.url);
      return url.origin;
    } catch {
      // ignore
    }
  }

  if (serverEnv.NEXTAUTH_URL) {
    return serverEnv.NEXTAUTH_URL.replace(/\/$/, "");
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }

  const port = process.env.PORT || "3001";
  return `http://localhost:${port}`;
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
    signal: AbortSignal.timeout(15000),
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
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Google userinfo fetch failed: ${res.status} ${errorBody}`);
  }

  return res.json();
}

/**
 * Xác thực Google ID Token (JWT) từ Google Identity Services / FedCM trên server
 * và bắt buộc kiểm tra claim `hd === "cdktcnqn.edu.vn"`.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  clientId?: string
): Promise<GoogleUserInfo | null> {
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      {
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!res.ok) {
      return null;
    }

    const payload = await res.json();

    // 1. Kiểm tra Client ID nếu được cung cấp
    if (clientId && payload.aud !== clientId) {
      return null;
    }

    // 2. Bắt buộc kiểm tra Google Workspace Hosted Domain (hd) claim
    const officialDomain = OFFICIAL_DOMAIN.trim().toLowerCase();
    const isDomainAllowed =
      payload.hd && typeof payload.hd === "string"
        ? payload.hd.trim().toLowerCase() === officialDomain
        : false;

    if (!isDomainAllowed && !isAllowedDomain(payload.email, payload.hd)) {
      return null;
    }

    // 3. Email phải được Google xác thực
    if (payload.email_verified !== "true" && payload.email_verified !== true) {
      return null;
    }

    return {
      sub: payload.sub,
      email: payload.email,
      email_verified: true,
      name: payload.name || payload.email,
      picture: payload.picture,
      hd: payload.hd,
    };
  } catch {
    return null;
  }
}
