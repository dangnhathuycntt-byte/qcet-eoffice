import { prisma } from "@/lib/prisma";
import type { AuditLogEntryDTO } from "@/contracts/audit-logs";

// Nhật ký kiểm toán hệ thống: một trang bản ghi đã lọc kèm tổng số.

export async function listAuditLogEntries({
  where,
  page,
  pageSize,
}: {
  where: Record<string, unknown>;
  page: number;
  pageSize: number;
}) {
  const [rows, total] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
      select: {
        id: true,
        actorId: true,
        action: true,
        entityType: true,
        entityId: true,
        requestId: true,
        createdAt: true,
      },
    }),
    prisma.auditEvent.count({ where }),
  ]);

  const entries: AuditLogEntryDTO[] = rows.map((row) => ({
    id: row.id,
    actorId: row.actorId,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    requestId: row.requestId,
    createdAt: row.createdAt.toISOString(),
  }));

  return { entries, total };
}
