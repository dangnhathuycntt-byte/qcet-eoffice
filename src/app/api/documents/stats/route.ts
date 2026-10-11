import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiSuccess, apiError } from "@/server/api/response";
import { assertRateLimit } from "@/server/security/rate-limit";
import { buildDocumentReadWhere } from "@/server/policies/document-policy";
import { buildDocumentBucketWhere, DOCUMENT_DONE_STATUSES } from "@/lib/documents/document-sidebar-buckets";
import { canViewApprovalReport } from "@/server/documents/submission-approval-service";
import { resolveDocumentTypeParam } from "@/domain/documents/document-type-param";

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
    const aclWhere = buildDocumentReadWhere(authUser);
    const typeParam = request.nextUrl.searchParams.get("type");
    const scopedType = resolveDocumentTypeParam(typeParam);
    const baseFilter = { AND: [{ archivedAt: null }, aclWhere] };
    // Các chỉ số trạng thái/khẩn/trễ hạn bám theo loại văn bản đang xem (nếu có).
    const scopedFilter = scopedType ? { AND: [baseFilter, { type: scopedType }] } : baseFilter;

    const countBucket = (type: "VAN_BAN_DEN" | "VAN_BAN_DI", bucket: "pending" | "done" | "issued") =>
      prisma.document.count({
        where: { AND: [baseFilter, { type }, buildDocumentBucketWhere(type, bucket) ?? {}] },
      });

    const [
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
      canSeeApprovalReport,
    ] = await Promise.all([
      prisma.document.groupBy({ by: ["type"], where: baseFilter, _count: { _all: true } }),
      prisma.document.groupBy({ by: ["status"], where: scopedFilter, _count: { _all: true } }),
      prisma.document.count({
        where: {
          ...scopedFilter,
          urgency: { in: ["KHAN", "THUONG_KHAN", "HOA_TOC"] },
        },
      }),
      prisma.document.count({
        where: {
          ...scopedFilter,
          dueDate: { lt: now },
          status: { notIn: [...DOCUMENT_DONE_STATUSES] },
        },
      }),
      prisma.document.count({
        where: {
          ...scopedFilter,
          linkedTaskId: { not: null },
        },
      }),
      countBucket("VAN_BAN_DEN", "pending"),
      countBucket("VAN_BAN_DEN", "done"),
      countBucket("VAN_BAN_DI", "pending"),
      countBucket("VAN_BAN_DI", "done"),
      countBucket("VAN_BAN_DI", "issued"),
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
