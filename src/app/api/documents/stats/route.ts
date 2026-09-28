import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiContext } from "@/server/api/context";
import { requireAuthenticated } from "@/server/api/auth";
import { apiSuccess, apiError } from "@/server/api/response";
import { assertRateLimit } from "@/server/security/rate-limit";
import { buildDocumentReadWhere } from "@/server/policies/document-policy";

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
    const baseFilter = { AND: [{ archivedAt: null }, aclWhere] };

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
    ] = await Promise.all([
      prisma.document.count({ where: baseFilter }),
      prisma.document.count({ where: { ...baseFilter, type: "VAN_BAN_DEN" } }),
      prisma.document.count({ where: { ...baseFilter, type: "VAN_BAN_DI" } }),
      prisma.document.count({ where: { ...baseFilter, type: "TO_TRINH_NOI_BO" } }),
      prisma.document.count({ where: { ...baseFilter, status: "CHO_PHAN_CONG" } }),
      prisma.document.count({
        where: {
          ...baseFilter,
          status: { in: ["DANG_XU_LY", "CHO_PHE_DUYET"] },
        },
      }),
      prisma.document.count({
        where: {
          ...baseFilter,
          status: { in: ["DA_HOAN_THANH", "LUU_THEO_DOI"] },
        },
      }),
      prisma.document.count({
        where: {
          ...baseFilter,
          urgency: { in: ["KHAN", "THUONG_KHAN", "HOA_TOC"] },
        },
      }),
      prisma.document.count({
        where: {
          ...baseFilter,
          dueDate: { lt: now },
          status: { notIn: ["DA_HOAN_THANH", "LUU_THEO_DOI"] },
        },
      }),
      prisma.document.count({
        where: {
          ...baseFilter,
          linkedTaskId: { not: null },
        },
      }),
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
