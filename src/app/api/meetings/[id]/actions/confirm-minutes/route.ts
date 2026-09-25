/**
 * API Route: /api/meetings/[id]/actions/confirm-minutes
 * POST - Phê duyệt / Xác nhận biên bản (MINUTES_DRAFT -> MINUTES_CONFIRMED)
 */

import { NextRequest } from 'next/server';
import { getApiContext, requireAuthenticated } from '@/server/api/request-context';
import { apiSuccess, apiError } from '@/server/api/response';
import { MeetingService } from '@/server/services/meeting-service';
import { ConfirmMinutesSchema } from '@/contracts/meeting';
import { assertCsrf } from '@/server/security/csrf';
import { assertRateLimit } from '@/server/security/rate-limit';
import { parseAndValidateJson } from '@/server/api/validation';

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

    const input = await parseAndValidateJson(request, ConfirmMinutesSchema, { allowEmpty: true });

    const meeting = await MeetingService.confirmMinutes(params.id, input, authUser.id, requestId);
    return apiSuccess(meeting, { requestId, status: 200 });
  } catch (error: any) {
    return apiError(error, requestId);
  }
}
