import { prisma } from "@/lib/prisma";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { loadAuthorizationContext } from "@/server/authorization/authorization-context-service";
import { authorize } from "@/server/authorization/authorization-engine";
import { AuthorizationError } from "@/server/api/errors";
import { AuditLogQuerySchema, type AuditLogEntryDTO } from "@/contracts/audit-logs";
import { apiError, apiSuccess } from "@/server/api/response";
import { assertQueryStringLength } from "@/server/api/validation";
import { normalizeIctDateRange } from "@/lib/ict-date-boundaries";

export async function GET(req: Request) {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(req);
    requestId = context.requestId;

    const authUser = requireAuthenticated(context);

    const authCtx = await loadAuthorizationContext(authUser.id);
    const authResult = authorize(authCtx, 'system.audit.view');
    if (!authResult.allowed) {
      throw new AuthorizationError(authResult.reason || 'Không có quyền xem nhật ký kiểm toán');
    }

    assertQueryStringLength(req);
    const url = new URL(req.url);
    const rawParams = Object.fromEntries(url.searchParams.entries());
    const query = AuditLogQuerySchema.parse(rawParams);

    const where: Record<string, unknown> = {};

    if (query.action) {
      where.action = query.action;
    }
    if (query.entityType) {
      where.entityType = query.entityType;
    }
    if (query.actorId) {
      where.actorId = query.actorId;
    }
    if (query.from || query.to) {
      const range = normalizeIctDateRange(query.from, query.to);
      if (range.error) {
        return apiError(
          { message: range.error, statusCode: 400 },
          context.requestId,
          { 'Cache-Control': 'private, no-store' }
        );
      }
      const createdAt: Record<string, string | Date> = {};
      if (range.gte !== undefined) createdAt.gte = range.gte;
      if (range.lte !== undefined) createdAt.lte = range.lte;
      where.createdAt = createdAt;
    }

    const [rows, total] = await Promise.all([
      prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.pageSize,
        skip: (query.page - 1) * query.pageSize,
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

    return apiSuccess(
      {
        data: entries,
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: Math.ceil(total / query.pageSize),
          hasMore: query.page * query.pageSize < total,
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
