import { NextRequest } from "next/server";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiSuccess, apiError } from "@/server/api/response";
import { assertRateLimit } from "@/server/security/rate-limit";
import { buildDocumentReadWhere } from "@/server/policies/document-policy";
import { DOCUMENT_DONE_STATUSES } from "@/lib/documents/document-sidebar-buckets";
import { getDocumentStatsRows } from "@/server/documents/document-service";
import { canViewApprovalReport } from "@/server/documents/submission-approval-service";
import { resolveDocumentTypeParam } from "@/domain/documents/document-type-param";
import { loadCachedAuthorizationContext } from "@/server/authorization/authorization-context-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest): Promise<Response> {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(request);
    requestId = context.requestId;
    const authUser = requireAuthenticated(context);
    await assertRateLimit(authUser.id, "DEFAULT_API");

    const now = new Date();
    // ACL: scope document counts to what the authenticated user can read
    const aclWhere = buildDocumentReadWhere(await loadCachedAuthorizationContext(authUser.id));
    const typeParam = request.nextUrl.searchParams.get("type");
    const scopedType = resolveDocumentTypeParam(typeParam);

    const [
      {
        byType,
        byStatus,
        urgent,
        overdue,
        linkedTasks,
        incomingPending,
        incomingDone,
        outgoingPending,
        outgoingDone,
        outgoingIssued,
      },
      canSeeApprovalReport,
    ] = await Promise.all([
      getDocumentStatsRows({ aclWhere, scopedType, now }),
      canViewApprovalReport(authUser),
    ]);

    const countOf = (rows: { _count: { _all: number } }[]) => rows.reduce((sum, row) => sum + row._count._all, 0);
    const typeCount = (...types: string[]) => countOf(byType.filter((row) => types.includes(row.type)));
    const statusCount = (...statuses: string[]) => countOf(byStatus.filter((row) => statuses.includes(row.status)));
    const total = countOf(byType);
    const incoming = typeCount("VAN_BAN_DEN");
    const outgoing = typeCount("VAN_BAN_DI");
    const internal = typeCount("TO_TRINH_NOI_BO");
    const pending = statusCount("CHO_PHAN_CONG");
    const processing = statusCount("DANG_XU_LY", "CHO_PHE_DUYET");
    const completed = statusCount(...DOCUMENT_DONE_STATUSES);

    return apiSuccess(
      {
        success: true,
        data: {
          total,
          incoming,
          outgoing,
          internal,
          pending,
          processing,
          completed,
          urgent,
          overdue,
          linkedTasks,
          buckets: { incomingPending, incomingDone, outgoingPending, outgoingDone, outgoingIssued },
          canViewApprovalReport: canSeeApprovalReport,
        },
      },
      { headers: { "Cache-Control": "private, no-store" }, requestId }
    );
  } catch (error) {
    return apiError(error, requestId, {
      headers: { "Cache-Control": "private, no-store" },
      legacyCompat: true,
    });
  }
}
