import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { loadAuthorizationContext } from "@/server/authorization/authorization-context-service";
import { authorize } from "@/server/authorization/authorization-engine";
import { AuthorizationError, ValidationError } from "@/server/api/errors";
import { AuditLogQuerySchema } from "@/contracts/audit-logs";
import { buildOffsetPagination } from "@/server/api/pagination";
import { apiError, apiSuccess } from "@/server/api/response";
import { assertQueryStringLength } from "@/server/api/validation";
import { normalizeIctDateRange } from "@/lib/ict-date-boundaries";
import { listAuditLogEntries } from "@/server/audit/audit-log-query-service";

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

    let createdRange: { gte?: string | Date; lte?: string | Date } | undefined;
    if (query.from || query.to) {
      const range = normalizeIctDateRange(query.from, query.to);
      if (range.error) {
        throw new ValidationError(range.error, { from: [range.error] });
      }
      createdRange = range;
    }

    const { entries, total } = await listAuditLogEntries({
      action: query.action,
      entityType: query.entityType,
      actorId: query.actorId,
      createdRange,
      page: query.page,
      pageSize: query.pageSize,
    });

    return apiSuccess(
      {
        data: entries,
        pagination: buildOffsetPagination(query.page, query.pageSize, total),
      },
      {
        headers: { "Cache-Control": "private, no-store" },
        requestId: context.requestId,
      }
    );
  } catch (error) {
    return apiError(error, requestId, { headers: { "Cache-Control": "private, no-store" } });
  }
}
