import { NextRequest, NextResponse } from "next/server";
import { getAppBaseUrl, buildGoogleAuthUrl } from "@/lib/google-oauth";
import { serverEnv } from "@/config/env.server";
import { isFeatureEnabled } from "@/features/flags";
import { sanitizeRedirectUrl } from "@/lib/login-helpers";

export async function GET(req: NextRequest) {
  const baseUrl = getAppBaseUrl(req);

  if (!isFeatureEnabled("externalGoogleLogin")) {
    return NextResponse.redirect(new URL("/login?error=oauth_not_configured", baseUrl));
  }

  const clientId = serverEnv.GOOGLE_CLIENT_ID;
  const clientSecret = serverEnv.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/login?error=oauth_not_configured", baseUrl));
  }

  const rawReturnTo = req.nextUrl.searchParams.get("returnTo") || req.nextUrl.searchParams.get("redirect") || req.nextUrl.searchParams.get("callbackUrl");
  const returnTo = sanitizeRedirectUrl(rawReturnTo);

  const state = crypto.randomUUID();
  const redirectUri = `${baseUrl}/api/auth/callback/google`;
  const authUrl = buildGoogleAuthUrl({
    clientId,
    redirectUri,
    state,
  });

  const response = NextResponse.redirect(authUrl);

  response.cookies.set("qcet_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: serverEnv.NODE_ENV === "production",
    maxAge: 300, // 5 minutes
    path: "/api/auth",
  });

  if (returnTo && returnTo !== "/tasks") {
    response.cookies.set("qcet_return_to", returnTo, {
      httpOnly: true,
      sameSite: "lax",
      secure: serverEnv.NODE_ENV === "production",
      maxAge: 300, // 5 minutes
      path: "/api/auth",
    });
  }

  return response;
}
