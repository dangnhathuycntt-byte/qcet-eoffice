import jwt from "jsonwebtoken";
import { decode } from "next-auth/jwt";
import { UserRole } from "@/types/auth";
import { serverEnv } from "@/config/env.server";

export const SESSION_COOKIE_NAME = "authjs.session-token";
export const SECURE_SESSION_COOKIE_NAME = "__Secure-authjs.session-token";
export const LEGACY_SESSION_COOKIE_NAME = "qcet_session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days
export const SESSION_COOKIE_MAX_AGE = SESSION_MAX_AGE_SECONDS;

export function getJwtSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET || serverEnv.AUTH_SECRET || serverEnv.JWT_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET or JWT_SECRET environment variable is required");
  }
  return secret;
}

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

export function signSessionToken(payload: SessionPayload): string {
  const sessionId = payload.sessionId || payload.jti || `sess_${crypto.randomUUID()}`;
  return jwt.sign(
    { ...payload, sessionId, jti: sessionId },
    getJwtSecret(),
    { expiresIn: "30d" }
  );
}

export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || typeof token !== "string") return null;

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as SessionPayload;
    return decoded;
  } catch {
    return null;
  }
}

export async function verifySessionTokenAsync(token: string): Promise<SessionPayload | null> {
  if (!token || typeof token !== "string" || token.trim().length === 0) return null;

  // 1. Try standard HMAC-SHA256 JWT
  const syncVerified = verifySessionToken(token);
  if (syncVerified) return syncVerified;

  // 2. Try NextAuth / Auth.js JWE token
  try {
    const secret = getJwtSecret();
    for (const salt of [
      SESSION_COOKIE_NAME,
      SECURE_SESSION_COOKIE_NAME,
      "next-auth.session-token",
      "__Secure-next-auth.session-token",
    ]) {
      try {
        const decodedJwe = await decode({
          token: token.trim(),
          secret,
          salt,
        });

        if (decodedJwe && (decodedJwe.id || decodedJwe.sub) && decodedJwe.email) {
          const now = Math.floor(Date.now() / 1000);
          if (decodedJwe.exp && typeof decodedJwe.exp === "number" && now > decodedJwe.exp) {
            return null;
          }
          return {
            id: (decodedJwe.id || decodedJwe.sub) as string,
            email: decodedJwe.email as string,
            name: (decodedJwe.name as string) || "",
            role: (decodedJwe.role as string) || "CHUYEN_VIEN",
            departmentId: (decodedJwe.departmentId as string) || null,
            title: (decodedJwe.title as string) || null,
            isActive: decodedJwe.isActive !== false,
          };
        }
      } catch {
        // Continue to next salt
      }
    }
  } catch {
    // ignore
  }

  return null;
}

export async function getSessionFromRequest(request: {
  cookies?: { get: (name: string) => { value: string } | undefined };
  headers?: { get: (name: string) => string | null };
}): Promise<SessionPayload | null> {
  if (!request) return null;

  // 1. Authorization: Bearer <token> (used by mobile PWA / API clients)
  if (request.headers && typeof request.headers.get === "function") {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const bearerToken = authHeader.substring(7).trim();
      const verified = await verifySessionTokenAsync(bearerToken);
      if (verified) return verified;
    }
  }

  // 2. Cookie object (NextRequest / next/headers cookies store)
  if (request.cookies && typeof request.cookies.get === "function") {
    for (const cookieName of [
      SESSION_COOKIE_NAME,
      SECURE_SESSION_COOKIE_NAME,
      LEGACY_SESSION_COOKIE_NAME,
      "next-auth.session-token",
      "__Secure-next-auth.session-token",
    ]) {
      const cookieVal = request.cookies.get(cookieName)?.value;
      if (cookieVal) {
        const verified = await verifySessionTokenAsync(cookieVal);
        if (verified) return verified;
      }
    }
  }

  // 3. Fallback: Cookie header raw string
  if (request.headers && typeof request.headers.get === "function") {
    const cookieHeader = request.headers.get("cookie");
    if (cookieHeader) {
      for (const cookieName of [
        SESSION_COOKIE_NAME,
        SECURE_SESSION_COOKIE_NAME,
        LEGACY_SESSION_COOKIE_NAME,
        "next-auth.session-token",
        "__Secure-next-auth.session-token",
      ]) {
        const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${cookieName}=([^;]*)`));
        if (match) {
          const verified = await verifySessionTokenAsync(decodeURIComponent(match[1]));
          if (verified) return verified;
        }
      }
    }
  }

  return null;
}
