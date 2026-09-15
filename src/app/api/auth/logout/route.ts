import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, getSessionFromRequest } from "@/lib/jwt-session";
import { revokeSession } from "@/server/auth/session-policy";
import { extractTokenFromRequest } from "@/server/auth/current-session";

export async function POST(req: NextRequest | Request): Promise<NextResponse> {
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

  const response = NextResponse.json(
    { success: true },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    expires: new Date(0),
    path: "/",
  });

  return response;
}

export async function GET(req: NextRequest | Request): Promise<NextResponse> {
  return POST(req);
}
