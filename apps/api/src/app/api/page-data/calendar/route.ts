/**
 * API Route: /api/page-data/calendar
 * GET - Dữ liệu ban đầu của trang Lịch (src/app/calendar/page.tsx): nhiệm vụ và cuộc họp của tháng học hiện tại.
 */

import { NextRequest } from "next/server";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { loadCalendarPageData } from "@/server/services/calendar-page-data";
import type { CalendarPageData } from "@qcet/contracts/page-data";

export async function GET(request: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await getApiContext(request);
    requestId = ctx.requestId;
    const user = requireAuthenticated(ctx);

    const data: CalendarPageData = await loadCalendarPageData(user.id);
    return apiSuccess(data, { requestId, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, requestId);
  }
}
