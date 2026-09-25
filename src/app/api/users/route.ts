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

    // If search q is provided, apply await assertRateLimit(authUser.id, 'SEARCH')
    const searchQuery = validatedQuery.q || validatedQuery.search;
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
      orderBy: { name: "asc" },
      take,
      skip: (validatedQuery.page - 1) * take,
      include: {
        positionAssignments: {
          where: activeAssignmentFilter,
          include: {
            positionDefinition: true,
            unit: true,
          },
        },
      },
    });

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
