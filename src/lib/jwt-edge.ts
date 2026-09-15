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
 * Web Crypto standard HMAC-SHA256 JWT Verification.
 * 100% compatible with Next.js Edge Runtime, Node.js 18+, and browsers.
 * Does NOT require or import the Node.js 'crypto' module.
 */
export async function verifySessionTokenEdge(
  token: string,
  customSecret?: string
): Promise<SessionPayload | null> {
  if (!token || typeof token !== "string") return null;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;

    const secret = customSecret || getEdgeJwtSecret();
    const enc = new TextEncoder();

    // Import secret as HMAC-SHA256 key
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    // Decode base64url signature to binary bytes
    const base64Sig = sigB64.replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (base64Sig.length % 4)) % 4;
    const paddedSig = base64Sig + "=".repeat(padLen);
    const sigStr = atob(paddedSig);
    const sigBytes = new Uint8Array(sigStr.length);
    for (let i = 0; i < sigStr.length; i++) {
      sigBytes[i] = sigStr.charCodeAt(i);
    }

    // Verify HMAC-SHA256 signature against header.payload
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

    // Check expiration and not-before timestamps
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && typeof payload.exp === "number" && now > payload.exp) {
      return null;
    }
    if (payload.nbf && typeof payload.nbf === "number" && now < payload.nbf) {
      return null;
    }

    if (!payload.id || !payload.email || !payload.role) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
