import { NextRequest } from "next/server";
import { scanAndDispatchDocumentDeadlines } from "@/lib/documents/document-deadline-scanner";
import { serverEnv } from "@/config/env.server";
import { logger } from "@/server/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Validates whether the incoming request is authorized to execute the Cron Job.
 * According to Vercel Cron specification:
 * - Vercel sends `Authorization: Bearer <CRON_SECRET>`
 * - In non-production or test environments without CRON_SECRET configured, allows local invocation.
 */
function isCronAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET || serverEnv.CRON_SECRET;
  const isProduction = process.env.NODE_ENV === "production";

  // If a CRON_SECRET is configured, enforce strict Bearer authentication
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader === `Bearer ${cronSecret}`) {
      return true;
    }
    // Also support direct CRON_SECRET header
    const customHeader = request.headers.get("x-cron-secret");
    if (customHeader === cronSecret) {
      return true;
    }
    return false;
  }

  // If in production and NO CRON_SECRET is configured, fail closed
  if (isProduction) {
    return false;
  }

  // In development/test mode without CRON_SECRET, allow invocation
  return true;
}

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
