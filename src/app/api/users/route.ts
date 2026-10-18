import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { UserQuerySchema } from "@qcet/contracts/users";
import { assertRateLimit } from "@/server/security/rate-limit";
import { toUserPublicDTOArray } from "@/server/dto";
import { buildOffsetPagination } from "@/server/api/pagination";
import { apiError, apiSuccess } from "@/server/api/response";
import { assertQueryStringLength } from "@/server/api/validation";
import { buildUserDirectoryQueryOptions } from "@/server/users/user-directory-query";
import { listDirectoryUsers } from "@/server/users/user-directory-service";

export async function GET(req: Request) {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(req);
    requestId = context.requestId;

    // Require authentication: requireAuthenticated(context)
    const authUser = requireAuthenticated(context);

    // Validate query params with UserQuerySchema from @/contracts/users
    assertQueryStringLength(req);
    const url = new URL(req.url);
    const rawParams = Object.fromEntries(url.searchParams.entries());
    const validatedQuery = UserQuerySchema.parse(rawParams);

    // If search q is provided, apply await assertRateLimit(authUser.id, 'SEARCH')
    const queryOptions = buildUserDirectoryQueryOptions(validatedQuery);
    const searchQuery = queryOptions.searchQuery;
    if (searchQuery && searchQuery.trim().length > 0) {
      await assertRateLimit(authUser.id, "SEARCH", {
        requestId,
        endpoint: "GET /api/users",
        userId: authUser.id,
      });
    }

    const currentPage = validatedQuery.page;
    const { users: enrichedUsers, total } = await listDirectoryUsers(validatedQuery, queryOptions);

    return apiSuccess(
      {
        success: true,
        users: toUserPublicDTOArray(enrichedUsers, authUser),
        pagination: {
          ...buildOffsetPagination(currentPage, queryOptions.take, total),
        },
      },
      {
        headers: { "Cache-Control": "private, no-store" },
        requestId: context.requestId,
      }
    );
  } catch (error) {
    return apiError(error, requestId, { headers: { "Cache-Control": "private, no-store" } });
  }
}
