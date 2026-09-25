/**
 * API Route: /api/meetings/[id]/resolutions
 * GET - Lấy danh sách quyết nghị / kết luận cuộc họp
 * POST - Ban hành quyết nghị / kết luận (tùy chọn tự động sinh nhiệm vụ)
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiContext, requireAuthenticated } from '@/server/api/request-context';
import { apiSuccess, apiError } from '@/server/api/response';
import { MeetingService } from '@/server/services/meeting-service';
import { CreateMeetingResolutionSchema } from '@/contracts/meeting';
import { assertCsrf } from '@/server/security/csrf';
import { assertRateLimit } from '@/server/security/rate-limit';
import { parseAndValidateJson } from '@/server/api/validation';

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  let requestId = crypto.randomUUID();
  try {
    const params = await props.params;
    const ctx = await getApiContext(request);
    requestId = ctx.requestId;
    const authUser = requireAuthenticated(ctx);

    // Enforce read authorization on parent meeting
    await MeetingService.getMeeting(params.id, authUser.id);

    const resolutions = await prisma.meetingResolution.findMany({
      where: { meetingId: params.id },
      include: {
        leadUnit: true,
        leadUser: {
          select: { id: true, name: true, email: true },
        },
        resultingTask: {
          select: { id: true, title: true, status: true, dueDate: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return apiSuccess(resolutions, { requestId, status: 200 });
  } catch (error: any) {
    return apiError(error, requestId);
  }
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  let requestId = crypto.randomUUID();
  try {
    assertCsrf(request);
    const params = await props.params;
    const ctx = await getApiContext(request);
    requestId = ctx.requestId;
    const authUser = requireAuthenticated(ctx);

    await assertRateLimit(authUser.id, 'MUTATIONS_SENSITIVE');

    const input = await parseAndValidateJson(request, CreateMeetingResolutionSchema);

    const resolution = await MeetingService.createResolution(params.id, input, authUser.id, requestId);
    return apiSuccess(resolution, { requestId, status: 201 });
  } catch (error: any) {
    return apiError(error, requestId);
  }
}
