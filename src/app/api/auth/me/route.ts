import { prisma } from "@/lib/prisma";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { toUserPublicDTO } from "@/server/dto";
import { apiError, apiSuccess } from "@/server/api/response";
import { AuthenticationError, ValidationError } from "@/server/api/errors";
import { assertCsrf } from "@/server/security/csrf";
import { parseAndValidateJson } from "@/server/api/validation";
import { UpdateUserProfileSchema } from "@/contracts/users";

export async function GET(req: Request) {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(req);
    requestId = context.requestId;

    if (!context.user) {
      return apiSuccess(
        { authenticated: false, user: null },
        {
          headers: { "Cache-Control": "private, no-store" },
          requestId: context.requestId,
        }
      );
    }

    const authUser = context.user;

    const dbUser = await prisma.user.findUnique({
      where: { id: authUser.id },
      include: {
        // Phase 9: `User.departmentId` dropped — đơn vị canonical là phân công vị trí
        // việc làm chính đang hiệu lực.
        positionAssignments: {
          where: { type: 'PRIMARY', status: 'ACTIVE' },
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
          include: {
            unit: { select: { id: true, code: true, name: true } },
            positionDefinition: { select: { code: true, title: true } },
          },
        },
      },
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

    // Flatten primary assignment into the legacy shape client expects
    const primaryAssignment = dbUser.positionAssignments?.[0];
    const unitInfo = primaryAssignment?.unit;
    const dbUserWithUnit = {
      ...dbUser,
      departmentId: unitInfo?.code || unitInfo?.id || null,
      department: unitInfo ? { id: unitInfo.id, name: unitInfo.name, shortName: unitInfo.code } : null,
    };

    const publicUser = toUserPublicDTO(dbUserWithUnit);
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

    const context = await getApiContext(req);
    requestId = context.requestId;

    const authUser = requireAuthenticated(context);

    const validatedData = await parseAndValidateJson(req, UpdateUserProfileSchema, { maxBytes: 16 * 1024 });

    const { name, phone, title } = validatedData;

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

