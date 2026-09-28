import { prisma } from "@/lib/prisma";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { UserQuerySchema } from "@/contracts/users";
import { assertRateLimit } from "@/server/security/rate-limit";
import { toUserPublicDTOArray } from "@/server/dto";
import { apiError, apiSuccess } from "@/server/api/response";
import { assertQueryStringLength } from "@/server/api/validation";
import {
  buildUserDirectoryPagination,
  buildUserDirectoryQueryOptions,
} from "@/server/users/user-directory-query";

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

    const activeAssignmentFilter = {
      status: "ACTIVE" as const,
      effectiveFrom: { lte: new Date() },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
      unit: { status: "ACTIVE" as const },
    };

    const where: any = {
      isActive: true,
    };

    // Canonical membership: User must have active PositionAssignment in an active unit
    if (validatedQuery.departmentId) {
      where.positionAssignments = {
        some: {
          unitId: validatedQuery.departmentId,
          ...activeAssignmentFilter,
        },
      };
    } else {
      where.positionAssignments = {
        some: activeAssignmentFilter,
      };
    }

    Object.assign(where, queryOptions.filters);

    const currentPage = validatedQuery.page;
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { name: "asc" },
        take: queryOptions.take,
        skip: queryOptions.skip,
        include: {
          positionAssignments: {
            where: activeAssignmentFilter,
            include: {
              positionDefinition: true,
              unit: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const enrichedUsers = users.map((u) => {
      const chosenAssignment =
        (validatedQuery.departmentId
          ? u.positionAssignments.find((pa) => pa.unitId === validatedQuery.departmentId)
          : null) ??
        u.positionAssignments.find((pa) => pa.type === "PRIMARY") ??
        u.positionAssignments[0];

      return {
        ...u,
        position: chosenAssignment?.positionDefinition?.title ?? null,
        title: chosenAssignment?.positionDefinition?.title ?? null,
        departmentId: chosenAssignment?.unit?.id ?? null,
        department: chosenAssignment?.unit
          ? {
              id: chosenAssignment.unit.id,
              code: chosenAssignment.unit.code,
              shortName: chosenAssignment.unit.code,
              name: chosenAssignment.unit.name,
            }
          : null,
      };
    });

    return apiSuccess(
      {
        success: true,
        users: toUserPublicDTOArray(enrichedUsers, authUser),
        pagination: {
          ...buildUserDirectoryPagination(currentPage, queryOptions.take, total),
        },
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
