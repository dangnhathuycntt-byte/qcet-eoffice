import { NextRequest, NextResponse } from "next/server";
import { verifyGoogleIdToken, isAllowedDomain } from "@/lib/google-oauth";
import { signSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/jwt-session";
import { sanitizeRedirectUrl } from "@/lib/login-helpers";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
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

      // 3. Khởi tạo User mới với vai trò mặc định
      let defaultRole: UserRole = UserRole.CHUYEN_VIEN;
      let defaultDepartmentId: string | null = null;
      let defaultTitle = "Chuyên viên";

      if (normalizedEmail.includes("tt.stt") || normalizedEmail.includes("quantrimang")) {
        defaultRole = UserRole.ADMIN;
        defaultDepartmentId = "TT_STT";
        defaultTitle = "Trung tâm Số - Truyền thông (Quản trị mạng)";
      } else if (normalizedEmail.includes("bgh") || normalizedEmail.includes("dangnhathuy") || normalizedEmail.includes("tuongpv")) {
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
              id_token: idToken,
              token_type: "Bearer",
            },
          },
        },
      });

      return newUser;
    });

    if (!user.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: "Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ Phòng Quản trị mạng.",
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
