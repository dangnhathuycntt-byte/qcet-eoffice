import { prisma } from "@/lib/prisma";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { UserQuerySchema } from "@/contracts/users";
import { assertRateLimit } from "@/server/security/rate-limit";
import { toUserPublicDTOArray } from "@/server/dto";
import { apiError, apiSuccess } from "@/server/api/response";
import { assertQueryStringLength } from "@/server/api/validation";

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

    // If search q is provided, apply await assertRateLimit(context.user.id, 'SEARCH')
    const searchQuery = validatedQuery.q || validatedQuery.search;
    if (searchQuery && searchQuery.trim().length > 0) {
      await assertRateLimit(authUser.id, "SEARCH");
    }

    const where: any = {};
    if (validatedQuery.departmentId) {
      where.departmentId = validatedQuery.departmentId;
    }
    if (validatedQuery.role) {
      where.role = validatedQuery.role;
    }
    if (searchQuery && searchQuery.trim().length > 0) {
      where.OR = [
        { name: { contains: searchQuery.trim(), mode: "insensitive" } },
        { email: { contains: searchQuery.trim(), mode: "insensitive" } },
      ];
    }

    const take = validatedQuery.limit ?? validatedQuery.pageSize;
    const users = await prisma.user.findMany({
      where,
      include: {
        department: {
          select: { id: true, name: true, shortName: true },
        },
      },
      orderBy: { name: "asc" },
      take,
      skip: (validatedQuery.page - 1) * take,
    });

    return apiSuccess(
      {
        success: true,
        users: toUserPublicDTOArray(users),
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
