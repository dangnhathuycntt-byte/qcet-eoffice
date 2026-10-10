import { NextRequest } from "next/server";
import { isCronAuthorized } from "@/server/security/cron-auth";
import { scanTaskReminders } from "@/server/tasks/task-reminder-scanner";
import { logger } from "@/server/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/cron/task-reminders — quét nhắc hạn nhiệm vụ (T-06). Worker trong app đã quét định kỳ;
 * route này dành cho lịch ngoài (cron hệ thống) khi muốn chạy chủ động. An toàn khi gọi lặp lại.
 */
export async function GET(request: NextRequest): Promise<Response> {
  if (!isCronAuthorized(request)) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const start = Date.now();
  try {
    const result = await scanTaskReminders();
    return Response.json({ success: true, durationMs: Date.now() - start, ...result });
  } catch (error) {
    logger.error("task.reminder.cron_failed", undefined, error);
    return Response.json({ success: false, error: "Scan failed" }, { status: 500 });
  }
}
