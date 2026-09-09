import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiContext } from "@/server/api/context";
import { requireAuthenticated } from "@/server/api/auth";
import { apiSuccess, apiError } from "@/server/api/response";
import { assertRateLimit } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request?: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const req = request || new NextRequest("http://localhost:3000/api/documents/stats");
    const context = await getApiContext(req);
    requestId = context.requestId;
    const authUser = requireAuthenticated(context);

    // Rate limiting for stats aggregation
    assertRateLimit(authUser.id, "DEFAULT_API");

    const [total, incoming, outgoing, internal, pending, urgent] = await Promise.all([
      prisma.document.count(),
      prisma.document.count({ where: { type: "VAN_BAN_DEN" } }),
      prisma.document.count({ where: { type: "VAN_BAN_DI" } }),
      prisma.document.count({ where: { type: "TO_TRINH_NOI_BO" } }),
      prisma.document.count({ where: { status: "CHO_PHAN_CONG" } }),
      prisma.document.count({ where: { urgency: { in: ["KHAN", "THUONG_KHAN", "HOA_TOC"] } } }),
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
          urgent,
        },
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
        requestId: context.requestId,
      }
    );
  } catch (error) {
    return apiError(error, requestId, {
      headers: { "Cache-Control": "private, no-store" },
      legacyCompat: true,
    });
  }
}
