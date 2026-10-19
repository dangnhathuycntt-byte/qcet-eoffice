import { NextRequest } from 'next/server';
import { getApiContext, requireAuthenticated } from '@/server/api/request-context';
import { apiError, apiSuccess } from '@/server/api/response';
import { ValidationError } from '@/server/api/errors';
import { extractFieldErrors } from '@/server/api/validation';
import { SearchQuerySchema } from '@qcet/contracts/common';
import { assertRateLimit } from '@/server/security/rate-limit';
import { searchGlobal } from '@/server/search/global-search-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  let requestId = 'req-search-get';
  try {
    const context = await getApiContext(request);
    requestId = context.requestId;
    const authUser = requireAuthenticated(context);

    // Enforce SENSITIVE_READ rate limit tier
    await assertRateLimit(authUser.id, 'SENSITIVE_READ', {
      requestId,
      endpoint: 'GET /api/search',
      userId: authUser.id,
    });

    const searchParams = request.nextUrl.searchParams;
    const queryParams: Record<string, any> = {};
    searchParams.forEach((val, key) => {
      queryParams[key] = val;
    });

    const parseResult = SearchQuerySchema.safeParse(queryParams);
    if (!parseResult.success) {
      throw new ValidationError(
        parseResult.error.issues[0]?.message || 'Validation failed',
        extractFieldErrors(parseResult.error)
      );
    }
    const { q: rawQParam, query: rawQueryParam, limit = 20, scope } = parseResult.data;
    const q = (rawQParam || rawQueryParam || '').trim();

    const searchPayload = await searchGlobal(authUser.id, { q, limit, scope });

    return apiSuccess(
      searchPayload,
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
