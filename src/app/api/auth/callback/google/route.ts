import { NextRequest, NextResponse } from "next/server";
import {
  getAppBaseUrl,
  isAllowedDomain,
  exchangeGoogleCode,
  fetchGoogleUserInfo,
} from "@/lib/google-oauth";
import { signSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/jwt-session";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { serverEnv } from "@/config/env.server";
import { isFeatureEnabled } from "@/features/flags";

export async function GET(req: NextRequest) {
  const baseUrl = getAppBaseUrl(req);

  // Operational kill switch: externalGoogleLogin
  if (!isFeatureEnabled("externalGoogleLogin")) {
    const response = NextResponse.redirect(new URL("/login?error=oauth_not_configured", baseUrl));
    response.cookies.delete({ name: "qcet_oauth_state", path: "/api/auth" });
    return response;
  }

  const searchParams = req.nextUrl.searchParams;

  // 1. Kiểm tra lỗi trả về từ Google (người dùng bấm Hủy)
  const oauthError = searchParams.get("error");
  if (oauthError) {
    const response = NextResponse.redirect(new URL("/login?error=oauth_cancelled", baseUrl));
    response.cookies.delete({ name: "qcet_oauth_state", path: "/api/auth" });
    return response;
  }

  // 2. Xác thực CSRF state
  const stateQuery = searchParams.get("state");
  const stateCookie = req.cookies.get("qcet_oauth_state")?.value;

  if (!stateQuery || !stateCookie || stateQuery !== stateCookie) {
    const response = NextResponse.redirect(new URL("/login?error=oauth_state_invalid", baseUrl));
    response.cookies.delete({ name: "qcet_oauth_state", path: "/api/auth" });
    return response;
  }

  const code = searchParams.get("code");
  if (!code) {
    const response = NextResponse.redirect(new URL("/login?error=missing_code", baseUrl));
    response.cookies.delete({ name: "qcet_oauth_state", path: "/api/auth" });
    return response;
  }

  const clientId = serverEnv.GOOGLE_CLIENT_ID;
  const clientSecret = serverEnv.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    const response = NextResponse.redirect(new URL("/login?error=oauth_not_configured", baseUrl));
    response.cookies.delete({ name: "qcet_oauth_state", path: "/api/auth" });
    return response;
  }

  try {
    const redirectUri = `${baseUrl}/api/auth/callback/google`;

    // 3. Đổi code lấy Tokens
    const tokenData = await exchangeGoogleCode({
      code,
      clientId,
      clientSecret,
      redirectUri,
    });

    // 4. Lấy UserInfo từ Google
    const googleUser = await fetchGoogleUserInfo(tokenData.access_token);

    // 5. Kiểm tra tính hợp lệ & Dual-layer domain restriction
    if (!googleUser.email_verified || !isAllowedDomain(googleUser.email, googleUser.hd)) {
      const response = NextResponse.redirect(
        new URL(
          `/login?error=domain_not_allowed&email=${encodeURIComponent(googleUser.email || "")}`,
          baseUrl
        )
      );
      response.cookies.delete({ name: "qcet_oauth_state", path: "/api/auth" });
      return response;
    }

    const normalizedEmail = googleUser.email.toLowerCase().trim();

    // 6. Đồng bộ & Liên kết CSDL qua Atomic Transaction
    const user = await prisma.$transaction(async (tx) => {
      // A. Kiểm tra Account Google đã liên kết trước đó
      const existingAccount = await tx.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider: "google",
            providerAccountId: googleUser.sub,
          },
        },
        include: { user: true },
      });

      if (existingAccount) {
        // Cập nhật avatar nếu user chưa có
        if (!existingAccount.user.avatarUrl && googleUser.picture) {
          await tx.user.update({
            where: { id: existingAccount.user.id },
            data: { avatarUrl: googleUser.picture },
          });
        }
        return existingAccount.user;
      }

      // B. Kiểm tra User tồn tại theo email
      const existingUser = await tx.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        // Liên kết Account Google vào User hiện hữu
        await tx.account.create({
          data: {
            userId: existingUser.id,
            type: "oauth",
            provider: "google",
            providerAccountId: googleUser.sub,
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token || null,
            expires_at: tokenData.expires_in
              ? Math.floor(Date.now() / 1000) + tokenData.expires_in
              : null,
            token_type: tokenData.token_type || "Bearer",
            scope: tokenData.scope || null,
            id_token: tokenData.id_token || null,
          },
        });

        if (!existingUser.avatarUrl && googleUser.picture) {
          await tx.user.update({
            where: { id: existingUser.id },
            data: { avatarUrl: googleUser.picture },
          });
        }

        return existingUser;
      }

      // C. Chưa tồn tại User -> Tự động khởi tạo User mới
      let defaultRole: UserRole = UserRole.CHUYEN_VIEN;
      let defaultDepartmentId: string | null = null;
      let defaultTitle = "Chuyên viên";

      if (normalizedEmail.includes("tt.stt") || normalizedEmail.includes("quantrimang")) {
        defaultRole = UserRole.ADMIN;
        defaultDepartmentId = "TT_STT";
        defaultTitle = "Trung tâm Số - Truyền thông (Quản trị mạng)";
      } else if (normalizedEmail.includes("bgh") || normalizedEmail.includes("tuongpv")) {
        defaultRole = UserRole.BAN_GIAM_HIEU;
        defaultDepartmentId = "BGH";
        defaultTitle = "Ban Giám hiệu";
      }

      const newUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          name: googleUser.name || normalizedEmail.split("@")[0],
          role: defaultRole,
          departmentId: defaultDepartmentId,
          avatarUrl: googleUser.picture || null,
          provider: "google",
          isActive: true,
          title: defaultTitle,
          onboardedAt: null,
          accounts: {
            create: {
              type: "oauth",
              provider: "google",
              providerAccountId: googleUser.sub,
              access_token: tokenData.access_token,
              refresh_token: tokenData.refresh_token || null,
              expires_at: tokenData.expires_in
                ? Math.floor(Date.now() / 1000) + tokenData.expires_in
                : null,
              token_type: tokenData.token_type || "Bearer",
              scope: tokenData.scope || null,
              id_token: tokenData.id_token || null,
            },
          },
        },
      });

      return newUser;
    });

    // 7. Kiểm tra trạng thái tài khoản
    if (!user.isActive) {
      const response = NextResponse.redirect(new URL("/login?error=account_disabled", baseUrl));
      response.cookies.delete({ name: "qcet_oauth_state", path: "/api/auth" });
      return response;
    }

    // 8. Cấp phát Session JWT Token & ghi Cookie
    const sessionToken = signSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      departmentId: user.departmentId ?? undefined,
      title: user.title ?? undefined,
    });

    const response = NextResponse.redirect(new URL("/", baseUrl));

    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: serverEnv.NODE_ENV === "production",
      maxAge: SESSION_MAX_AGE_SECONDS,
      path: "/",
    });

    response.cookies.delete({ name: "qcet_oauth_state", path: "/api/auth" });

    return response;
  } catch (error) {
    console.error("[Google OAuth Callback Error]", error);
    const response = NextResponse.redirect(new URL("/login?error=oauth_failed", baseUrl));
    response.cookies.delete({ name: "qcet_oauth_state", path: "/api/auth" });
    return response;
  }
}
