import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/api/response";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { assertRateLimit } from "@/server/security/rate-limit";
import type { SessionPayload } from "@/lib/jwt-session";
import { approvalReportToCsv, getApprovalReport } from "@/server/documents/submission-approval-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/documents/approval-report?from=&to=&format=csv — báo cáo thời gian duyệt tờ trình (V-06).
 * Lãnh đạo xem toàn bộ, trưởng đơn vị xem đơn vị mình. `format=csv` tải tệp mở được bằng Excel.
 */
export async function GET(request: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const apiContext = await getApiContext(request);
    requestId = apiContext.requestId;
    const user = requireAuthenticated(apiContext);
    await assertRateLimit(user.id, "DEFAULT_API");

    const params = request.nextUrl.searchParams;
    const report = await getApprovalReport(user as unknown as SessionPayload, {
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
    });

    if (params.get("format") === "csv") {
      return new Response(approvalReportToCsv(report), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="bao-cao-thoi-gian-duyet-to-trinh.csv"',
          "Cache-Control": "private, no-store",
        },
      });
    }
    return apiSuccess(report, { requestId, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, requestId, { rfc9457: true, instance: request.nextUrl.pathname });
  }
}
