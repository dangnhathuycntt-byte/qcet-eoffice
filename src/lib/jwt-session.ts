import jwt from "jsonwebtoken";
import { decode } from "next-auth/jwt";
import { UserRole } from "@/types/auth";
import { serverEnv } from "@/config/env.server";
import { prisma } from "@/lib/prisma";
import { AuthenticationError } from "@/server/api/errors";
import { isSessionExpired, isSessionRevoked, assertSessionPolicy } from "@/server/auth/session-policy";

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

// ---------------------------------------------------------------------------
// Canonical token-level session resolver (Issue #27, corrective review).
//
// This is the SINGLE implementation of token -> authenticated-session
// decision logic. It resolves, in order:
//   1. opaque Auth.js/PrismaAdapter database session (`sessions` table,
//      with expires / revokedAt / revocation-store / user.isActive checks);
//   2. HMAC-SHA256 JWT (crypto verify + session-policy + DB user refresh);
//   3. Auth.js JWE (all cookie salts + session-policy + DB user refresh).
// It throws `AuthenticationError` (fail-closed) with `SESSION_INVALID` or
// `ACCOUNT_DISABLED`; it never returns a session for an invalid, expired,
// revoked, or disabled-account token.
//
// Consumers:
// - `verifySessionTokenAsync()` (this module) maps success to
//   `SessionPayload` and any `AuthenticationError` to `null` — used by
//   Next.js Node middleware and Server Components;
// - `resolveTokenSession()` in `src/server/auth/current-session.ts`
//   delegates here and maps success to identity-only `CurrentSession`
//   (request handlers must not treat the role snapshot as authority).
// Do NOT copy these rules a third time: extract-then-delegate.
// ---------------------------------------------------------------------------

export interface CanonicalTokenUser {
  id: string;
  email: string;
  name: string;
  role: string;
  departmentId: string | null;
  title: string | null;
  isActive: true;
}

export interface CanonicalTokenSession {
  sessionId: string;
  userId: string;
  user: CanonicalTokenUser;
  tokenKind: "database" | "jwt" | "jwe";
}

const JWE_COOKIE_SALTS = [
  SESSION_COOKIE_NAME,
  SECURE_SESSION_COOKIE_NAME,
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
] as const;

export async function resolveCanonicalTokenSession(token: string): Promise<CanonicalTokenSession> {
  if (!token || typeof token !== "string" || token.trim().length === 0) {
    throw new AuthenticationError("Phiên làm việc không hợp lệ", "SESSION_INVALID");
  }
  const trimmed = token.trim();

  // 1. Primary path: opaque database Session by sessionToken with User.
  try {
    const dbSession = await prisma.session.findUnique({
      where: { sessionToken: trimmed },
      include: { user: true },
    });

    if (dbSession) {
      if (isSessionExpired(dbSession.expires)) {
        throw new AuthenticationError("Phiên làm việc đã hết hạn", "SESSION_INVALID");
      }
      if (
        (dbSession as any).revokedAt != null ||
        isSessionRevoked(dbSession.id, dbSession.userId) ||
        isSessionRevoked(trimmed, dbSession.userId)
      ) {
        throw new AuthenticationError("Phiên làm việc đã bị thu hồi", "SESSION_INVALID");
      }
      if (!dbSession.user || !dbSession.user.isActive) {
        throw new AuthenticationError("Tài khoản đã bị vô hiệu hóa hoặc tạm khóa", "ACCOUNT_DISABLED");
      }

      return {
        sessionId: dbSession.id,
        userId: dbSession.user.id,
        user: {
          id: dbSession.user.id,
          email: dbSession.user.email,
          name: dbSession.user.name,
          role: dbSession.user.role,
          departmentId: null,
          title: dbSession.user.title ?? null,
          isActive: true,
        },
        tokenKind: "database",
      };
    }
  } catch (err) {
    if (err instanceof AuthenticationError) {
      throw err;
    }
    // Prisma unavailable / query failed: fall through to JWT / JWE paths.
  }

  // 2. Secondary path: HMAC-SHA256 JWT, then Auth.js JWE.
  let decoded: any = null;
  let tokenKind: "jwt" | "jwe" = "jwt";

  try {
    decoded = jwt.verify(trimmed, getJwtSecret()) as any;
    tokenKind = "jwt";
  } catch (err: any) {
    if (err?.name === "TokenExpiredError") {
      throw new AuthenticationError("Phiên làm việc đã hết hạn", "SESSION_INVALID");
    }

    // Try decoding as NextAuth / Auth.js JWE token (one salt matches).
    const secret = getJwtSecret();
    for (const salt of JWE_COOKIE_SALTS) {
      try {
        const decodedJwe = await decode({ token: trimmed, secret, salt });
        if (decodedJwe && (decodedJwe.id || decodedJwe.sub) && decodedJwe.email) {
          decoded = {
            id: decodedJwe.id || decodedJwe.sub,
            email: decodedJwe.email,
            name: decodedJwe.name || "",
            role: decodedJwe.role || "CHUYEN_VIEN",
            departmentId: decodedJwe.departmentId || null,
            title: decodedJwe.title || null,
            isActive: decodedJwe.isActive !== false,
            exp: decodedJwe.exp,
            iat: decodedJwe.iat,
            jti: decodedJwe.jti,
            sessionId: (decodedJwe as any).sessionId,
          };
          tokenKind = "jwe";
          break;
        }
      } catch {
        // A token is encrypted for one cookie salt; continue trying the others.
      }
    }
  }

  if (!decoded) {
    throw new AuthenticationError("Phiên làm việc không hợp lệ", "SESSION_INVALID");
  }

  const userId = decoded.id || decoded.userId;
  if (!userId) {
    throw new AuthenticationError("Phiên làm việc không hợp lệ", "SESSION_INVALID");
  }

  const sessionId = decoded.sessionId || decoded.jti || `session_${decoded.id}`;
  const expires = decoded.exp ? new Date(decoded.exp * 1000) : undefined;
  const issuedAt = decoded.iat ? new Date(decoded.iat * 1000) : undefined;

  // Expiry + revocation policy (covers JWT exp/iat and JWE exp/iat uniformly).
  assertSessionPolicy({ sessionId, expires, userId, issuedAt, token: trimmed });

  // DB user truth: missing user -> SESSION_INVALID, inactive -> ACCOUNT_DISABLED.
  // Role/department/title are refreshed from DB (never trusted from claims).
  let profile;
  try {
    profile = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        title: true,
        isActive: true,
      },
    });
  } catch {
    // Server session truth unavailable: fail closed instead of stale claims.
    throw new AuthenticationError("Phiên làm việc không hợp lệ", "SESSION_INVALID");
  }
  if (!profile) {
    throw new AuthenticationError("Phiên làm việc không hợp lệ", "SESSION_INVALID");
  }
  if (!profile.isActive) {
    throw new AuthenticationError("Tài khoản đã bị vô hiệu hóa hoặc tạm khóa", "ACCOUNT_DISABLED");
  }

  return {
    sessionId,
    userId: profile.id,
    user: {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      role: profile.role,
      departmentId: null,
      title: profile.title ?? null,
      isActive: true,
    },
    tokenKind,
  };
}

export async function verifySessionTokenAsync(token: string): Promise<SessionPayload | null> {
  if (!token || typeof token !== "string" || token.trim().length === 0) return null;
  try {
    const canonical = await resolveCanonicalTokenSession(token);
    return {
      id: canonical.user.id,
      email: canonical.user.email,
      name: canonical.user.name,
      role: canonical.user.role,
      departmentId: canonical.user.departmentId,
      title: canonical.user.title,
      isActive: true,
      sessionId: canonical.sessionId,
    };
  } catch {
    // Any AuthenticationError (invalid / expired / revoked / disabled) or
    // infrastructure failure resolves to unauthenticated: fail closed.
    return null;
  }
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
