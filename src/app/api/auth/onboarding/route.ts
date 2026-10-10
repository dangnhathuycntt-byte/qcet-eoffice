import { prisma } from "@/lib/prisma";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiSuccess, apiError } from "@/server/api/response";
import { assertCsrf } from '@/server/security/csrf';

export async function POST(req: Request) {
  let requestId = crypto.randomUUID();
  try {
    assertCsrf(req);
    const context = await getApiContext(req);
    requestId = context.requestId;
    const authUser = requireAuthenticated(context);

    const updatedUser = await prisma.user.update({
      where: { id: authUser.id },
      data: {
        onboardedAt: new Date(),
        onboardingData: {
          hasSeenWelcome: true,
          hasCompletedTour: true,
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        onboardedAt: true,
      },
    });

    return apiSuccess(
      { success: true, user: updatedUser },
      { headers: { "Cache-Control": "private, no-store" }, requestId }
    );
  } catch (error) {
    return apiError(error, requestId, { "Cache-Control": "private, no-store" });
  }
}
