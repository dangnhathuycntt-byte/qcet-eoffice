import { decode } from "next-auth/jwt";
import {
  SessionPayload,
  SESSION_COOKIE_NAME,
  SECURE_SESSION_COOKIE_NAME,
  LEGACY_SESSION_COOKIE_NAME,
} from "./jwt-session";

export { SESSION_COOKIE_NAME, SECURE_SESSION_COOKIE_NAME, LEGACY_SESSION_COOKIE_NAME };
export type { SessionPayload };

export function getEdgeJwtSecret(): string {
  const secret =
    process.env.AUTH_SECRET ||
    process.env.JWT_SECRET ||
    "qcet_dev_fallback_secret_key_2026_super_safe_32_chars";
  return secret;
}

/**
 * Web Crypto standard JWT / JWE Verification for Edge Runtime and Middleware.
 * Handles both HMAC-SHA256 JWS tokens (3 parts) and NextAuth JWE tokens (5 parts).
 * Strictly verifies signature and expiration (exp). Returns null for invalid/expired tokens.
 */
export async function verifySessionTokenEdge(
  token: string,
  customSecret?: string
): Promise<SessionPayload | null> {
  if (!token || typeof token !== "string" || token.trim().length === 0) {
    return null;
  }

  const secret = customSecret || getEdgeJwtSecret();
  const trimmed = token.trim();
  const parts = trimmed.split(".");

  // 1. Standard HMAC-SHA256 JWT (3 parts: header.payload.signature)
  if (parts.length === 3) {
    try {
      const [headerB64, payloadB64, sigB64] = parts;
      const enc = new TextEncoder();

      // Import secret as HMAC-SHA256 key
      const key = await crypto.subtle.importKey(
        "raw",
        enc.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
      );

      // Decode base64url signature
      const base64Sig = sigB64.replace(/-/g, "+").replace(/_/g, "/");
      const padLen = (4 - (base64Sig.length % 4)) % 4;
      const paddedSig = base64Sig + "=".repeat(padLen);
      const sigStr = atob(paddedSig);
      const sigBytes = new Uint8Array(sigStr.length);
      for (let i = 0; i < sigStr.length; i++) {
        sigBytes[i] = sigStr.charCodeAt(i);
      }

      const dataBytes = enc.encode(`${headerB64}.${payloadB64}`);
      const isValid = await crypto.subtle.verify("HMAC", key, sigBytes, dataBytes);
      if (!isValid) {
        return null;
      }

      // Decode payload
      const base64Payload = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
      const padLenPayload = (4 - (base64Payload.length % 4)) % 4;
      const paddedPayload = base64Payload + "=".repeat(padLenPayload);
      const jsonStr = decodeURIComponent(
        Array.prototype.map
          .call(atob(paddedPayload), (c: string) => {
            return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join("")
      );

      const payload = JSON.parse(jsonStr) as SessionPayload & { exp?: number; nbf?: number };

      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && typeof payload.exp === "number" && now > payload.exp) {
        return null;
      }
      if (payload.nbf && typeof payload.nbf === "number" && now < payload.nbf) {
        return null;
      }

      if (!payload.id || !payload.email) {
        return null;
      }

      return {
        id: payload.id,
        email: payload.email,
        name: payload.name || "",
        role: payload.role || "CHUYEN_VIEN",
        departmentId: payload.departmentId ?? null,
        title: payload.title ?? null,
      };
    } catch {
      // Fall through to NextAuth decode
    }
  }

  // 2. NextAuth JWE token (5 parts) or Auth.js encrypted session token
  try {
    const decoded = await decode({
      token: trimmed,
      secret,
      salt: "authjs.session-token",
    });

    if (decoded && decoded.id && decoded.email) {
      const now = Math.floor(Date.now() / 1000);
      if (decoded.exp && typeof decoded.exp === "number" && now > decoded.exp) {
        return null;
      }
      return {
        id: decoded.id as string,
        email: decoded.email as string,
        name: (decoded.name as string) || "",
        role: (decoded.role as string) || "CHUYEN_VIEN",
        departmentId: (decoded.departmentId as string) || null,
        title: (decoded.title as string) || null,
      };
    }
  } catch {
    // ignore
  }

  return null;
}
