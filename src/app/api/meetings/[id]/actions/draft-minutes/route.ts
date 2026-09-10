/**
 * API Route: /api/meetings/[id]/actions/draft-minutes
 * POST - Soạn biên bản cuộc họp (HELD -> MINUTES_DRAFT)
 */

import { NextRequest } from 'next/server';
import { getApiContext, requireAuthenticated } from '@/server/api/request-context';
import { apiSuccess, apiError } from '@/server/api/response';
import { MeetingService } from '@/server/services/meeting-service';
import { DraftMinutesSchema } from '@/contracts/meeting';

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  let requestId = crypto.randomUUID();
  try {
    const params = await props.params;
    const ctx = await getApiContext(request);
    requestId = ctx.requestId;
    const authUser = requireAuthenticated(ctx);

    const body = await request.json();
    const input = DraftMinutesSchema.parse(body);

    const meeting = await MeetingService.draftMinutes(params.id, input, authUser.id, requestId);
    return apiSuccess(meeting, { requestId, status: 200 });
  } catch (error: any) {
    return apiError(error, requestId);
  }
}
