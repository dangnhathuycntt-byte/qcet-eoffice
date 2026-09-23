import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/jwt-session";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { toUserPublicDTO } from "@/server/dto";
import { apiError, apiSuccess } from "@/server/api/response";
import { AuthenticationError, ValidationError } from "@/server/api/errors";
import { assertCsrf } from "@/server/security/csrf";
import { assertJsonContentType, assertRequestBodySize } from "@/server/api/validation";
import { UpdateUserProfileSchema } from "@/contracts/users";

export async function GET(req: Request) {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(req);
    requestId = context.requestId;

    // Verify server session truth using getSessionFromRequest(req) supporting cookies and Authorization: Bearer <token>
    const session = (await getSessionFromRequest(req as any)) || (context.user ? { id: context.user.id } : null);

    if (!session || !session.id) {
      return apiSuccess(
        { authenticated: false, user: null },
        {
          headers: { "Cache-Control": "private, no-store" },
          requestId: context.requestId,
        }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: session.id },
    });

    if (!dbUser || !dbUser.isActive) {
      return apiSuccess(
        { authenticated: false, user: null },
        {
          headers: { "Cache-Control": "private, no-store" },
          requestId: context.requestId,
        }
      );
    }

    const publicUser = toUserPublicDTO(dbUser);
    const userResult = {
      ...publicUser,
      title: dbUser.title,
      phone: dbUser.phone,
      avatarUrl: dbUser.avatarUrl,
      isActive: dbUser.isActive,
      onboardedAt: dbUser.onboardedAt ? dbUser.onboardedAt.toISOString() : null,
      onboardingData: dbUser.onboardingData || null,
    };

    return apiSuccess(
      {
        authenticated: true,
        user: userResult,
      },
      {
        headers: { "Cache-Control": "private, no-store" },
        requestId: context.requestId,
      }
    );
  } catch (error) {
    if (error instanceof AuthenticationError || (error as any)?.code === 'ACCOUNT_DISABLED' || (error as any)?.code === 'AUTH_REQUIRED') {
      return apiSuccess(
        { authenticated: false, user: null },
        {
          headers: { "Cache-Control": "private, no-store" },
          requestId,
        }
      );
    }
    return apiError(error, requestId, { "Cache-Control": "private, no-store" });
  }
}

export async function PATCH(req: Request) {
  let requestId = crypto.randomUUID();
  try {
    assertCsrf(req);
    assertJsonContentType(req);
    assertRequestBodySize(req, 16 * 1024);

    const context = await getApiContext(req);
    requestId = context.requestId;

    const authUser = requireAuthenticated(context);

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      throw new ValidationError('Payload JSON không hợp lệ', undefined, 'INVALID_JSON');
    }

    const parseResult = UpdateUserProfileSchema.safeParse(rawBody);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      const field = issue.path.join('.');
      throw new ValidationError(
        issue.message || `Dữ liệu hồ sơ không hợp lệ: ${field}`,
        field ? { [field]: [issue.message] } : undefined,
        'VALIDATION_FAILED'
      );
    }

    const { name, phone, title } = parseResult.data;

    if (name === undefined && phone === undefined && title === undefined) {
      throw new ValidationError('Cần cung cấp ít nhất một trường thông tin để cập nhật', undefined, 'EMPTY_UPDATE');
    }

    const updatedUser = await prisma.user.update({
      where: { id: authUser.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(title !== undefined ? { title } : {}),
      },
    });

    const publicUser = toUserPublicDTO(updatedUser);
    const userResult = {
      ...publicUser,
      title: updatedUser.title,
      phone: updatedUser.phone,
      avatarUrl: updatedUser.avatarUrl,
      isActive: updatedUser.isActive,
      onboardedAt: updatedUser.onboardedAt ? updatedUser.onboardedAt.toISOString() : null,
      onboardingData: updatedUser.onboardingData || null,
    };

    return apiSuccess(
      {
        success: true,
        user: userResult,
      },
      {
        headers: { 'Cache-Control': 'private, no-store' },
        requestId,
      }
    );
  } catch (error) {
    return apiError(error, requestId, { 'Cache-Control': 'private, no-store' });
  }
}

