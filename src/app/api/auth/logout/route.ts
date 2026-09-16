import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  SECURE_SESSION_COOKIE_NAME,
  LEGACY_SESSION_COOKIE_NAME,
  getSessionFromRequest,
} from "@/lib/jwt-session";
import { revokeSession } from "@/server/auth/session-policy";
import { extractTokenFromRequest } from "@/server/auth/current-session";

const COOKIES_TO_CLEAR = [
  SESSION_COOKIE_NAME,
  SECURE_SESSION_COOKIE_NAME,
  LEGACY_SESSION_COOKIE_NAME,
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
  "authjs.csrf-token",
  "__Host-authjs.csrf-token",
  "authjs.callback-url",
  "__Secure-authjs.callback-url",
  "next-auth.csrf-token",
  "__Host-next-auth.csrf-token",
  "next-auth.callback-url",
  "__Secure-next-auth.callback-url",
  "qcet_oauth_state",
  "qcet_return_to",
];

export async function POST(req: NextRequest | Request): Promise<NextResponse> {
  try {
    const token = extractTokenFromRequest(req as any);
    if (token) {
      await revokeSession(token);
    }
    const session = await getSessionFromRequest(req as any);
    if (session) {
      const sessionId = (session as any).sessionId || (session as any).jti;
      if (sessionId && sessionId !== session.id && sessionId !== `session_${session.id}`) {
        await revokeSession(sessionId);
      }
    }
  } catch {
    // Gracefully continue on error
  }

  const response = NextResponse.json(
    { success: true },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        "Clear-Site-Data": '"cache"',
      },
    }
  );

  for (const cookieName of COOKIES_TO_CLEAR) {
    response.cookies.set({
      name: cookieName,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      expires: new Date(0),
      path: "/",
    });
  }

  return response;
}

export async function GET(req: NextRequest | Request): Promise<NextResponse> {
  return POST(req);
}
