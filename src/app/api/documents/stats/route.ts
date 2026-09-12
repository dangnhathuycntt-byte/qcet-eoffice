import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiContext } from "@/server/api/context";
import { requireAuthenticated } from "@/server/api/auth";
import { apiSuccess, apiError } from "@/server/api/response";
import { assertRateLimit } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest | Request): Promise<Response>;
export async function GET(): Promise<Response>;
export async function GET(request?: NextRequest | Request): Promise<Response> {
  let requestId = crypto.randomUUID();
  try {
    if (request) {
      const context = await getApiContext(request);
      requestId = context.requestId;
      const authUser = requireAuthenticated(context);
      assertRateLimit(authUser.id, "DEFAULT_API");
    }

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
        requestId,
      }
    );
  } catch (error) {
    return apiError(error, requestId, {
      headers: { "Cache-Control": "private, no-store" },
      legacyCompat: true,
    });
  }
}
