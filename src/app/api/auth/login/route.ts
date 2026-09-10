import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { signSessionToken, SESSION_COOKIE_NAME } from "@/lib/jwt-session";
import { UserRole } from "@/types/auth";
import { getApiContext } from "@/server/api/request-context";
import { parseAndValidateJson, MAX_AUTH_BODY_SIZE } from "@/server/api/validation";
import { LoginInputSchema } from "@/contracts/auth";
import { assertRateLimit } from "@/server/security/rate-limit";
import { AuthenticationError, ForbiddenError } from "@/server/api/errors";
import { toUserPublicDTO } from "@/server/dto";
import { apiError, apiSuccess } from "@/server/api/response";

export async function POST(req: Request) {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(req);
    requestId = context.requestId;

    const body = await parseAndValidateJson(req, LoginInputSchema, {
      maxBytes: MAX_AUTH_BODY_SIZE,
    });

    const normalizedEmail = body.email.trim().toLowerCase();

    // Rate limiting: Key by `${context.ip || 'ip'}:${normalizedEmail || 'login'}` using `RATE_LIMIT_PRESETS.AUTH_LOGIN`
    assertRateLimit(`${context.ip || 'ip'}:${normalizedEmail || 'login'}`, 'AUTH_LOGIN');

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        department: {
          select: { id: true, name: true, shortName: true },
        },
      },
    });

    if (!user || !user.passwordHash) {
      throw new AuthenticationError("Email hoặc mật khẩu không chính xác");
    }

    if (!user.isActive) {
      throw new ForbiddenError("Tài khoản đã bị khóa hoặc tạm ngưng");
    }

    const isMatch = await verifyPassword(body.password, user.passwordHash);
    if (!isMatch) {
      throw new AuthenticationError("Email hoặc mật khẩu không chính xác");
    }

    const sessionPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      departmentId: user.departmentId,
      title: user.title,
    };

    const token = signSessionToken(sessionPayload);

    const publicUser = toUserPublicDTO(user);
    const sanitizedUser = {
      ...publicUser,
      title: user.title,
      onboardedAt: user.onboardedAt ? user.onboardedAt.toISOString() : null,
      onboardingData: user.onboardingData || null,
    };

    const response = apiSuccess(
      {
        success: true,
        user: sanitizedUser,
      },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
        requestId: context.requestId,
      }
    );

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return response;
  } catch (error) {
    return apiError(error, requestId, { "Cache-Control": "private, no-store" });
  }
}
