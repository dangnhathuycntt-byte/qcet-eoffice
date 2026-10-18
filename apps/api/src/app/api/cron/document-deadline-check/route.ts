import { NextRequest } from "next/server";
import { scanAndDispatchDocumentDeadlines } from "@/server/documents/document-deadline-scanner";
import { isCronAuthorized } from "@/server/security/cron-auth";
import { logger } from "@/server/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/cron/document-deadline-check
 * Triggered daily at 07:00 ICT (00:00 UTC) via Vercel Cron.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const start = Date.now();

  if (!isCronAuthorized(request)) {
    return Response.json(
      {
        success: false,
        error: "Unauthorized",
        message: "Yêu cầu không có quyền thực thi tác vụ định kỳ (Invalid or missing CRON_SECRET)",
      },
      { status: 401 }
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const dryRun = searchParams.get("dryRun") === "true";

    const scanResult = await scanAndDispatchDocumentDeadlines({
      dryRun,
    });

    const durationMs = Date.now() - start;

    return Response.json({
      success: true,
      timestamp: new Date().toISOString(),
      durationMs,
      dryRun,
      data: scanResult,
    });
  } catch (error) {
    logger.error("cron.document_deadline_check_failed", { error }, error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - start,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/document-deadline-check
 * Allows manual or automated webhook triggering with optional configuration.
 */
export async function POST(request: NextRequest): Promise<Response> {
  return GET(request);
}
