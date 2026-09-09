import { NextRequest } from 'next/server';
import { getApiContext } from '@/server/api/request-context';
import { apiError, apiSuccess } from '@/server/api/response';
import { getVapidPublicKey } from '@/lib/push-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let requestId = 'req-push-key';
  try {
    const context = await getApiContext(request);
    requestId = context.requestId;
    const publicKey = getVapidPublicKey();

    return apiSuccess(
      { publicKey },
      {
        requestId,
        headers: {
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        },
        legacyCompat: true,
      }
    );
  } catch (error) {
    return apiError(error, requestId, { legacyCompat: true });
  }
}
