import { NextResponse } from 'next/server';
import { isServerShuttingDown } from '@/server/lifecycle/shutdown';

export const dynamic = 'force-dynamic';

/**
 * Liveness Probe: checks whether the container process is alive and responsive.
 * Does not query database or external dependencies to prevent cascading failures.
 */
export async function GET() {
  if (isServerShuttingDown()) {
    return NextResponse.json(
      {
        status: 'terminating',
        terminating: true,
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        uptime: Math.floor(process.uptime()),
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  }

  const memoryUsageRssMb =
    typeof process !== 'undefined' && process.memoryUsage
      ? Math.round(process.memoryUsage().rss / (1024 * 1024))
      : 0;

  return NextResponse.json(
    {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      uptime: Math.floor(process.uptime()),
      memoryUsageRssMb,
      memory: {
        rssMb: memoryUsageRssMb,
      },
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
