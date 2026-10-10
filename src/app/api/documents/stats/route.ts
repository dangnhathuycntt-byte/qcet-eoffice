import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiContext } from "@/server/api/context";
import { requireAuthenticated } from "@/server/api/auth";
import { apiSuccess, apiError } from "@/server/api/response";
import { assertRateLimit } from "@/server/security/rate-limit";
import { buildDocumentReadWhere } from "@/server/policies/document-policy";
import { buildDocumentBucketWhere } from "@/lib/documents/document-sidebar-buckets";
import { canViewApprovalReport } from "@/server/documents/submission-approval-service";

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
    const scopedType: "VAN_BAN_DEN" | "VAN_BAN_DI" | "TO_TRINH_NOI_BO" | null =
      typeParam === "VAN_BAN_DEN" || typeParam === "inbox"
        ? "VAN_BAN_DEN"
        : typeParam === "VAN_BAN_DI" || typeParam === "outbox"
        ? "VAN_BAN_DI"
        : typeParam === "TO_TRINH_NOI_BO" || typeParam === "submission"
        ? "TO_TRINH_NOI_BO"
        : null;
    const baseFilter = { AND: [{ archivedAt: null }, aclWhere] };
    // Các chỉ số trạng thái/khẩn/trễ hạn bám theo loại văn bản đang xem (nếu có).
    const scopedFilter = scopedType ? { AND: [baseFilter, { type: scopedType }] } : baseFilter;

    const countBucket = (type: "VAN_BAN_DEN" | "VAN_BAN_DI", bucket: "pending" | "done" | "issued") =>
      prisma.document.count({
        where: { AND: [baseFilter, { type }, buildDocumentBucketWhere(type, bucket) ?? {}] },
      });

    const [
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
      incomingPending,
      incomingDone,
      outgoingPending,
      outgoingDone,
      outgoingIssued,
      canSeeApprovalReport,
    ] = await Promise.all([
      prisma.document.count({ where: baseFilter }),
      prisma.document.count({ where: { ...baseFilter, type: "VAN_BAN_DEN" } }),
      prisma.document.count({ where: { ...baseFilter, type: "VAN_BAN_DI" } }),
      prisma.document.count({ where: { ...baseFilter, type: "TO_TRINH_NOI_BO" } }),
      prisma.document.count({ where: { ...scopedFilter, status: "CHO_PHAN_CONG" } }),
      prisma.document.count({
        where: {
          ...scopedFilter,
          status: { in: ["DANG_XU_LY", "CHO_PHE_DUYET"] },
        },
      }),
      prisma.document.count({
        where: {
          ...scopedFilter,
          status: { in: ["DA_HOAN_THANH", "LUU_THEO_DOI"] },
        },
      }),
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
          status: { notIn: ["DA_HOAN_THANH", "LUU_THEO_DOI"] },
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
