import type { UserQuery } from "@/contracts/users";

type DirectoryQueryInput = Pick<
  UserQuery,
  "page" | "pageSize" | "limit" | "role" | "q" | "search"
>;

export function buildUserDirectoryQueryOptions(query: DirectoryQueryInput) {
  const searchQuery = (query.q || query.search || "").trim();
  const filters: Record<string, unknown> = {};

  if (query.role) filters.role = query.role;
  if (searchQuery) {
    filters.OR = [
      { name: { contains: searchQuery, mode: "insensitive" } },
      { email: { contains: searchQuery, mode: "insensitive" } },
    ];
  }

  const take = query.limit ?? query.pageSize;
  return {
    filters,
    searchQuery: searchQuery || undefined,
    take,
    skip: (query.page - 1) * take,
  };
}

export function buildUserDirectoryPagination(page: number, pageSize: number, total: number) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
    hasMore: page * pageSize < total,
  };
}
