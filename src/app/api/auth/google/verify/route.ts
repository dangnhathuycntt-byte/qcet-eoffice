import { NextRequest, NextResponse } from "next/server";
import { verifyGoogleIdToken, isAllowedDomain } from "@/lib/google-oauth";
import { signSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/jwt-session";
import { sanitizeRedirectUrl } from "@/lib/login-helpers";
import { prisma } from "@/lib/prisma";
import { serverEnv } from "@/config/env.server";
import { isFeatureEnabled } from "@/features/flags";

export async function POST(req: NextRequest) {
  try {
    if (!isFeatureEnabled("externalGoogleLogin")) {
      return NextResponse.json(
        { success: false, error: "Hệ thống đăng nhập Google chưa được kích hoạt." },
        { status: 503 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const idToken = body.idToken || body.credential;
    const returnTo = sanitizeRedirectUrl(body.returnTo);

    if (!idToken || typeof idToken !== "string") {
      return NextResponse.json(
        { success: false, error: "Mã xác thực Google không hợp lệ." },
        { status: 400 }
      );
    }

    const clientId = serverEnv.GOOGLE_CLIENT_ID;
    const googleUser = await verifyGoogleIdToken(idToken, clientId);

    if (!googleUser || !isAllowedDomain(googleUser.email, googleUser.hd)) {
      return NextResponse.json(
        {
          success: false,
          error: "Tài khoản không thuộc miền @cdktcnqn.edu.vn được cấp phép.",
          email: googleUser?.email,
        },
        { status: 403 }
      );
    }

    const normalizedEmail = googleUser.email.toLowerCase().trim();

    // Đồng bộ & Liên kết CSDL qua Atomic Transaction sử dụng Google sub làm định danh bền vững
    const user = await prisma.$transaction(async (tx) => {
      // 1. Kiểm tra Account Google đã liên kết trước đó theo google.sub
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
        if (!existingAccount.user.avatarUrl && googleUser.picture) {
          await tx.user.update({
            where: { id: existingAccount.user.id },
            data: { avatarUrl: googleUser.picture },
          });
        }
        return existingAccount.user;
      }

      // 2. Kiểm tra User tồn tại theo email
      const existingUser = await tx.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        await tx.account.create({
          data: {
            userId: existingUser.id,
            type: "oauth",
            provider: "google",
            providerAccountId: googleUser.sub,
            id_token: idToken,
            token_type: "Bearer",
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

      // 3. User không tồn tại trong DB -> KHÔNG auto-provisioning, KHÔNG auto-elevation role
      return null;
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Tài khoản chưa được cấp quyền trong hệ thống. Vui lòng liên hệ Quản trị viên.",
          code: "account_not_found",
        },
        { status: 403 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: "Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ Phòng Quản trị mạng.",
          code: "account_disabled",
        },
        { status: 403 }
      );
    }

    // Cấp phát Session JWT Token
    const sessionToken = signSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      departmentId: user.departmentId ?? undefined,
      title: user.title ?? undefined,
    });

    const response = NextResponse.json({
      success: true,
      returnTo: returnTo || "/tasks",
    });

    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: serverEnv.NODE_ENV === "production",
      maxAge: SESSION_MAX_AGE_SECONDS,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[Google Identity Services Verify Error]", error);
    return NextResponse.json(
      { success: false, error: "Đã xảy ra lỗi trong quá trình xác thực với Google." },
      { status: 500 }
    );
  }
}
