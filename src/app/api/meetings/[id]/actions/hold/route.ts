/**
 * API Route: /api/meetings/[id]/actions/hold
 * POST - Chuyển trạng thái cuộc họp thành HELD
 */

import { NextRequest } from 'next/server';
import { getApiContext, requireAuthenticated } from '@/server/api/request-context';
import { apiSuccess, apiError } from '@/server/api/response';
import { MeetingService } from '@/server/services/meeting-service';

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

    const meeting = await MeetingService.holdMeeting(params.id, authUser.id, requestId);
    return apiSuccess(meeting, { requestId, status: 200 });
  } catch (error: any) {
    return apiError(error, requestId);
  }
}
