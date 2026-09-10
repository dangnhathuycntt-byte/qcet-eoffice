import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/jwt-session";
import { getApiContext } from "@/server/api/request-context";
import { toUserPublicDTO } from "@/server/dto";
import { apiError, apiSuccess } from "@/server/api/response";

export async function GET(req: Request) {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(req);
    requestId = context.requestId;

    // Verify server session truth using getSessionFromRequest(req) supporting cookies and Authorization: Bearer <token>
    const session = getSessionFromRequest(req as any) || (context.user ? { id: context.user.id } : null);

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
      include: {
        department: {
          select: { id: true, name: true, shortName: true },
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
    return apiError(error, requestId, { "Cache-Control": "private, no-store" });
  }
}
