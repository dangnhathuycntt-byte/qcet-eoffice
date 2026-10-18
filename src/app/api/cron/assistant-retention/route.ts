import { NextRequest } from "next/server";
import { isCronAuthorized } from "@/server/security/cron-auth";
import { purgeExpiredConversations } from "@/server/assistant/assistant-conversations";
import { logger } from "@/server/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/cron/assistant-retention — xóa hẳn cuộc trò chuyện Trợ lý đã quá hạn lưu giữ (90 ngày).
 * Chạy hằng ngày theo lịch trong vercel.json; an toàn khi gọi lặp lại.
 */
export async function GET(request: NextRequest): Promise<Response> {
  if (!isCronAuthorized(request)) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const deleted = await purgeExpiredConversations();
    return Response.json({ success: true, deleted });
  } catch (error) {
    logger.error("assistant.retention.cron_failed", undefined, error);
    return Response.json({ success: false, error: "Purge failed" }, { status: 500 });
  }
}
