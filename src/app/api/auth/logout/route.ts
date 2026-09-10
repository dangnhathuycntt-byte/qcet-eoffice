import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, getSessionFromRequest } from "@/lib/jwt-session";
import { revokeSession } from "@/server/auth/session-policy";
import { extractTokenFromRequest } from "@/server/auth/current-session";

export async function POST(req?: Request | NextRequest) {
  if (req) {
    try {
      const token = extractTokenFromRequest(req as any);
      if (token) {
        await revokeSession(token);
      }
      const session = getSessionFromRequest(req as any);
      if (session?.id) {
        const sessionId = (session as any).sessionId || `session_${session.id}`;
        await revokeSession(sessionId);
      }
    } catch {
      // Gracefully continue on error
    }
  }

  const response = NextResponse.json({ success: true });
  response.headers.set("Clear-Site-Data", '"cache"');
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
