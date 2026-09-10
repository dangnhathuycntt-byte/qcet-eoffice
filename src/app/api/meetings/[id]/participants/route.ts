/**
 * API Route: /api/meetings/[id]/participants
 * POST - Thêm thành viên/mời tham dự
 */

import { NextRequest } from 'next/server';
import { getApiContext, requireAuthenticated } from '@/server/api/request-context';
import { apiSuccess, apiError } from '@/server/api/response';
import { MeetingService } from '@/server/services/meeting-service';
import { AddParticipantSchema } from '@/contracts/meeting';

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
    const input = AddParticipantSchema.parse(body);

    const participant = await MeetingService.addParticipant(params.id, input, authUser.id, requestId);
    return apiSuccess(participant, { requestId, status: 201 });
  } catch (error: any) {
    return apiError(error, requestId);
  }
}
