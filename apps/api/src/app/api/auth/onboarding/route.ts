import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { completeOnboarding } from "@/server/users/user-profile-service";
import { apiSuccess, apiError } from "@/server/api/response";
import { assertCsrf } from '@/server/security/csrf';

export async function POST(req: Request) {
  let requestId = crypto.randomUUID();
  try {
    assertCsrf(req);
    const context = await getApiContext(req);
    requestId = context.requestId;
    const authUser = requireAuthenticated(context);

    const updatedUser = await completeOnboarding(authUser.id);

    return apiSuccess(
      { success: true, user: updatedUser },
      { headers: { "Cache-Control": "private, no-store" }, requestId }
    );
  } catch (error) {
    return apiError(error, requestId, { headers: { "Cache-Control": "private, no-store" } });
  }
}
