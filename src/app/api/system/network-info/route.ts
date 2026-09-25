import { NextRequest } from 'next/server';
import os from 'os';
import { getApiContext } from '@/server/api/request-context';
import { apiError, apiSuccess } from '@/server/api/response';
import { NotFoundError } from '@/server/api/errors';
import { isAdmin } from '@/server/policies/document-policy';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(request);
    requestId = context.requestId;

    const isProd = process.env.NODE_ENV === 'production';
    if (isProd) {
      const user = context.user;
      if (!user || !isAdmin(user)) {
        throw new NotFoundError('Endpoint not available in production');
      }
    }

    const interfaces = os.networkInterfaces();
    let tailscaleIp: string | null = null;
    let lanIp: string | null = null;

    for (const [name, addrs] of Object.entries(interfaces)) {
      if (!addrs) continue;
      for (const addr of addrs) {
        if (addr.family === 'IPv4' && !addr.internal) {
          // Check for Tailscale (100.64.0.0/10 CGNAT range or utun/tailscale interface)
          if (
            addr.address.startsWith('100.') ||
            name.toLowerCase().includes('tailscale')
          ) {
            tailscaleIp = addr.address;
          } else if (
            addr.address.startsWith('192.168.') ||
            addr.address.startsWith('10.') ||
            addr.address.startsWith('172.')
          ) {
            if (!lanIp) {
              lanIp = addr.address;
            }
          }
        }
      }
    }

    const port = process.env.PORT || '3001';

    return apiSuccess(
      {
        tailscaleIp,
        lanIp,
        port: Number(port),
        tailscaleUrl: tailscaleIp ? `http://${tailscaleIp}:${port}` : null,
        lanUrl: lanIp ? `http://${lanIp}:${port}` : null,
      },
      {
        requestId,
        headers: {
          'Cache-Control': 'private, no-store',
        },
        legacyCompat: true,
      }
    );
  } catch (error) {
    return apiError(error, requestId, { legacyCompat: true });
  }
}
