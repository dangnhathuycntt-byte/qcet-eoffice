import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Readiness Probe: checks whether the service is ready to accept incoming traffic.
 * Validates database connectivity without exposing connection strings or internal credentials.
 */
export async function GET() {
  const startTime = Date.now();
  let dbHealthy = false;
  let dbLatencyMs = 0;

  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - dbStart;
    dbHealthy = true;
  } catch (err) {
    dbHealthy = false;
  }

  const totalDurationMs = Date.now() - startTime;

  return NextResponse.json(
    {
      status: dbHealthy ? 'ready' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: dbHealthy ? 'healthy' : 'unreachable',
          latencyMs: dbLatencyMs,
        },
      },
      durationMs: totalDurationMs,
    },
    {
      status: dbHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
