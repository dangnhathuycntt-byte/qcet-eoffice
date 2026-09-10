import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Liveness Probe: checks if the Node.js / Next.js process is alive and responsive.
 * Does NOT check external dependencies (like database) to avoid cascading container restarts.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
