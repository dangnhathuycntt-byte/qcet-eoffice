import { prisma } from "@qcet/db/prisma";
import type { AuditLogEntryDTO } from "@qcet/contracts/audit-logs";

// Nhật ký kiểm toán hệ thống: một trang bản ghi đã lọc kèm tổng số.

export async function listAuditLogEntries({
  action,
  entityType,
  actorId,
  createdRange,
  page,
  pageSize,
}: {
  action?: string;
  entityType?: string;
  actorId?: string;
  createdRange?: { gte?: string | Date; lte?: string | Date };
  page: number;
  pageSize: number;
}) {
  const where: Record<string, unknown> = {};

  if (action) {
    where.action = action;
  }
  if (entityType) {
    where.entityType = entityType;
  }
  if (actorId) {
    where.actorId = actorId;
  }
  if (createdRange) {
    const createdAt: Record<string, string | Date> = {};
    if (createdRange.gte !== undefined) createdAt.gte = createdRange.gte;
    if (createdRange.lte !== undefined) createdAt.lte = createdRange.lte;
    where.createdAt = createdAt;
  }

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
