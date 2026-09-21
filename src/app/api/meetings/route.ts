/**
 * API Route: /api/meetings
 * GET - Danh sách cuộc họp
 * POST - Tạo mới cuộc họp
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiContext, requireAuthenticated } from '@/server/api/request-context';
import { apiSuccess, apiError } from '@/server/api/response';
import { MeetingService } from '@/server/services/meeting-service';
import { CreateMeetingSchema, ListMeetingsQuerySchema } from '@/contracts/meeting';
import { checkRateLimit, RATE_LIMIT_TIERS, logRateLimitExceeded } from '@/server/api/rate-limit';

export async function GET(request: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await getApiContext(request);
    requestId = ctx.requestId;
    const authUser = requireAuthenticated(ctx);

    const { searchParams } = new URL(request.url);
    const query = ListMeetingsQuerySchema.parse({
      bodyId: searchParams.get('bodyId') || undefined,
      unitId: searchParams.get('unitId') || undefined,
      status: searchParams.get('status') || undefined,
      search: searchParams.get('search') || undefined,
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
      limit: searchParams.get('limit') || undefined,
      page: searchParams.get('page') || undefined,
    });

    const result = await MeetingService.listMeetings(query, authUser.id);
    return apiSuccess(result, { requestId, status: 200 });
  } catch (error: any) {
    return apiError(error, requestId);
  }
}

export async function POST(request: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const ctx = await getApiContext(request);
    requestId = ctx.requestId;
    const authUser = requireAuthenticated(ctx);

    const rateResult = await checkRateLimit('MUTATION', authUser.id);
    if (!rateResult.success) {
      await logRateLimitExceeded('MUTATION', authUser.id, request.url, authUser.id);
      return NextResponse.json(
        { error: 'Too Many Requests', retryAt: rateResult.resetAt.toISOString() },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateResult.resetAt.getTime() - Date.now()) / 1000)),
            'X-RateLimit-Limit': String(RATE_LIMIT_TIERS.MUTATION.limit),
            'X-RateLimit-Remaining': String(rateResult.remaining),
          },
        },
      );
    }

    const body = await request.json();
    const input = CreateMeetingSchema.parse(body);

    const meeting = await MeetingService.createMeeting(input, authUser.id, requestId);
    return apiSuccess(meeting, { requestId, status: 201 });
  } catch (error: any) {
    return apiError(error, requestId);
  }
}
