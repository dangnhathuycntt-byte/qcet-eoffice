import jwt from "jsonwebtoken";
import { UserRole } from "@/types/auth";
import { serverEnv } from "@/config/env.server";

export const SESSION_COOKIE_NAME = "qcet_session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days
export const SESSION_COOKIE_MAX_AGE = SESSION_MAX_AGE_SECONDS;

export function getJwtSecret(): string {
  if (
    process.env.NODE_ENV === "production" &&
    !process.env.JWT_SECRET &&
    !process.env.AUTH_SECRET
  ) {
    throw new Error("JWT_SECRET environment variable is required in production");
  }
  return serverEnv.AUTH_SECRET || "qcet_fallback_secret_key_2026";
}

export interface SessionPayload {
  id: string;
  email: string;
  name: string;
  role: UserRole | "BAN_GIAM_HIEU" | "TRUONG_PHONG" | "CHUYEN_VIEN" | string;
  departmentId?: string | null;
  title?: string | null;
}

export function signSessionToken(payload: SessionPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "30d" });
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as SessionPayload;
    return decoded;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(request: {
  cookies?: { get: (name: string) => { value: string } | undefined };
  headers?: { get: (name: string) => string | null };
}): SessionPayload | null {
  if (!request) return null;

  // 1. Authorization: Bearer <token> (used by mobile PWA / API clients)
  if (request.headers && typeof request.headers.get === "function") {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const bearerToken = authHeader.substring(7).trim();
      const verified = verifySessionToken(bearerToken);
      if (verified) return verified;
    }
  }

  // 2. Cookie object (NextRequest / next/headers cookies store)
  if (request.cookies && typeof request.cookies.get === "function") {
    const cookieVal = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (cookieVal) {
      const verified = verifySessionToken(cookieVal);
      if (verified) return verified;
    }
  }

  // 3. Fallback: Cookie header raw string
  if (request.headers && typeof request.headers.get === "function") {
    const cookieHeader = request.headers.get("cookie");
    if (cookieHeader) {
      const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]*)`));
      if (match) {
        const verified = verifySessionToken(decodeURIComponent(match[1]));
        if (verified) return verified;
      }
    }
  }

  return null;
}
