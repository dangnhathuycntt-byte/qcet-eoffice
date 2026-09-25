import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/server/observability/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();
  let dbStatus: "healthy" | "unhealthy" = "healthy";
  let dbLatencyMs = 0;

  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - dbStart;
  } catch (error) {
    dbStatus = "unhealthy";
    logger.error("[Healthcheck] CSDL PostgreSQL mất kết nối", { error });
  }

  const isHealthy = dbStatus === "healthy";
  const totalDurationMs = Date.now() - startTime;

  return NextResponse.json(
    {
      status: isHealthy ? "ok" : "degraded",
      system: "QCET E-Office On-Premise",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
      durationMs: totalDurationMs,
    },
    {
      status: isHealthy ? 200 : 503,
    }
  );
}
