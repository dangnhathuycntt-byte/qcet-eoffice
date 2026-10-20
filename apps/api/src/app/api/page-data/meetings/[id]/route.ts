/**
 * API Route: /api/page-data/meetings/[id]
 * GET - Dữ liệu trang chi tiết cuộc họp (src/app/meetings/[id]/page.tsx). Kiểm meeting.read như
 * GET /api/meetings/[id]; không có hoặc không được đọc trả 404.
 */

import { NextRequest } from "next/server";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { NotFoundError } from "@/server/api/errors";
import { readMeetingDetailPageData } from "@/server/services/meeting-detail-page-data";
import type { MeetingDetailPageData } from "@qcet/contracts/page-data";

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  let requestId = crypto.randomUUID();
  try {
    const { id } = await props.params;
    const ctx = await getApiContext(request);
    requestId = ctx.requestId;
    const user = requireAuthenticated(ctx);
    const userId = user.id;

    // Kiểm meeting.read; không có quyền -> null -> 404
    const meeting = await readMeetingDetailPageData(id, userId);
    if (!meeting) throw new NotFoundError("Không tìm thấy cuộc họp");

    const data: MeetingDetailPageData = {
      meeting,
      currentUser: { id: userId, name: user.name ?? "Người dùng", role: user.role ?? "CHUYEN_VIEN" },
    };
    return apiSuccess(data, { requestId, headers: NO_STORE });
  } catch (error) {
    return apiError(error, requestId, { headers: NO_STORE });
  }
}
