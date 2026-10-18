import { prisma } from "@/lib/prisma";
import type { UserQuery } from "@/contracts/users";
import type { buildUserDirectoryQueryOptions } from "@/server/users/user-directory-query";

// Danh bạ người dùng: người đang hoạt động có phân công hiệu lực trong đơn vị đang hoạt động.

/** Một trang người dùng kèm đơn vị/chức vụ được chọn và tổng khớp bộ lọc. */
export async function listDirectoryUsers(
  validatedQuery: UserQuery,
  queryOptions: ReturnType<typeof buildUserDirectoryQueryOptions>
) {
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

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { name: "asc" },
      take: queryOptions.take,
      skip: queryOptions.skip,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
        positionAssignments: {
          where: activeAssignmentFilter,
          select: {
            unitId: true,
            type: true,
            positionDefinition: { select: { title: true } },
            unit: { select: { id: true, code: true, name: true } },
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

  return { users: enrichedUsers, total };
}
