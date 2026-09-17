import { NextRequest, NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/google-oauth";
import { sanitizeRedirectUrl } from "@/lib/login-helpers";
import { isFeatureEnabled } from "@/features/flags";

export async function GET(req: NextRequest) {
  const baseUrl = getAppBaseUrl(req);

  if (!isFeatureEnabled("externalGoogleLogin")) {
    return NextResponse.redirect(new URL("/login?error=oauth_not_configured", baseUrl));
  }

  const rawReturnTo =
    req.nextUrl.searchParams.get("returnTo") ||
    req.nextUrl.searchParams.get("redirect") ||
    req.nextUrl.searchParams.get("callbackUrl");
  const returnTo = sanitizeRedirectUrl(rawReturnTo);

  const loginUrl = new URL("/login", baseUrl);
  loginUrl.searchParams.set("startGoogle", "1");
  if (returnTo !== "/tasks") loginUrl.searchParams.set("returnTo", returnTo);
  return NextResponse.redirect(loginUrl);
}
