import { serverEnv } from "@/config/env.server";
import { INSTITUTION_CONFIG } from "@qcet/shared/config/institution";

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

  // 1. If hd is provided, it must strictly match official domain
  if (hd && typeof hd === "string") {
    if (hd.trim().toLowerCase() !== officialDomain) {
      return false;
    }
  }

  // 2. Email suffix must strictly match official domain
  if (email && typeof email === "string") {
    const normalized = email.trim().toLowerCase();
    if (normalized.endsWith(`@${officialDomain}`)) {
      return true;
    }
  }

  return false;
}

export function isVerifiedGoogleWorkspaceIdentity(profile: {
  email?: string | null;
  email_verified?: boolean | string | null;
  hd?: string | null;
}): boolean {
  const isVerified =
    profile.email_verified === true || profile.email_verified === "true";
  return Boolean(isVerified && profile.hd && isAllowedDomain(profile.email, profile.hd));
}

/**
 * Phân giải URL gốc của ứng dụng (Base URL), hỗ trợ Nginx/Docker reverse proxy
 */
export function getAppBaseUrl(req?: Request): string {
  // In production, never let client-controlled Host/X-Forwarded-Host headers
  // override the deployment's canonical OAuth origin.
  if (serverEnv.NODE_ENV === "production" && serverEnv.NEXTAUTH_URL) {
    return serverEnv.NEXTAUTH_URL.replace(/\/$/, "");
  }

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
