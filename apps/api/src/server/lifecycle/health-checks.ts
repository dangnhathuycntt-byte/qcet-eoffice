/**
 * Truy vấn kiểm tra CSDL cho probe /api/health và /api/health/ready. Route giữ phần đo thời gian,
 * xử lý lỗi, fallback và payload; các hàm này chỉ chạy truy vấn và ném lỗi nguyên trạng.
 */
import { prisma } from "@qcet/db/prisma";

export async function pingDatabase(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}

/** Số migration đã áp dụng (chưa rollback) trong `_prisma_migrations`. */
export async function countAppliedMigrations(): Promise<number> {
  const migrationRows = (await prisma.$queryRaw`
        SELECT COUNT(*)::int as count
        FROM _prisma_migrations
        WHERE rolled_back_at IS NULL
      `) as Array<{ count: number }>;

  return migrationRows[0]?.count ?? 0;
}

/** Số bảng trong schema public (dự phòng khi không đọc được `_prisma_migrations`). */
export async function countPublicTables(): Promise<number> {
  const tableRows = (await prisma.$queryRaw`
          SELECT COUNT(*)::int as count
          FROM information_schema.tables
          WHERE table_schema = 'public'
        `) as Array<{ count: number }>;
  return tableRows[0]?.count ?? 0;
}
