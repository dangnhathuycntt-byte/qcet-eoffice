import { NextRequest } from "next/server";
import { isCronAuthorized } from "@/server/security/cron-auth";
import { sendAssistantBriefings } from "@/server/assistant/assistant-briefing";
import { logger } from "@/server/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/cron/assistant-briefing — gửi bản tin sáng của Trợ lý cho người đã bật (ADR-012). Lịch trong vercel.json
 * (00:00 UTC = 07:00 giờ Việt Nam); worker outbox cũng quét. Mỗi người một bản một ngày nên gọi lặp lại an toàn.
 */
export async function GET(request: NextRequest): Promise<Response> {
  if (!isCronAuthorized(request)) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await sendAssistantBriefings();
    return Response.json({ success: true, ...result });
  } catch (error) {
    logger.error("assistant.briefing.cron_failed", undefined, error);
    return Response.json({ success: false, error: "Briefing failed" }, { status: 500 });
  }
}
