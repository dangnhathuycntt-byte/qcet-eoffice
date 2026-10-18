import { prisma } from "@/lib/prisma";

// Truy vấn cho /api/dev/login-as (chỉ dev cục bộ; route tự chặn production).

/** Tài khoản đang hoạt động để chọn vai trò thử. */
export async function listActiveUsersForDevLogin() {
  return prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true, role: true, title: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
}

/** Tài khoản đang hoạt động theo id, hoặc `null`. */
export async function findActiveUserForDevLogin(userId: string) {
  return prisma.user.findFirst({ where: { id: userId, isActive: true }, select: { id: true, email: true, name: true, role: true, title: true } });
}
