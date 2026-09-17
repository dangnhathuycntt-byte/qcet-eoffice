import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, SECURE_SESSION_COOKIE_NAME, LEGACY_SESSION_COOKIE_NAME } from "@/lib/jwt-session";
import { revokeSession } from "@/server/auth/session-policy";
import { extractTokensFromRequest } from "@/server/auth/current-session";

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
  const requestUrl = new URL(req.url);
  const origin = req.headers.get("origin");
  const fetchSite = req.headers.get("sec-fetch-site");
  if ((origin && origin !== requestUrl.origin) || fetchSite === "cross-site") {
    return NextResponse.json(
      { success: false, error: "Cross-site logout request rejected" },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    for (const token of extractTokensFromRequest(req as any)) {
      await revokeSession(token);
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
  return NextResponse.json(
    { success: false, error: "Method not allowed" },
    { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } }
  );
}
