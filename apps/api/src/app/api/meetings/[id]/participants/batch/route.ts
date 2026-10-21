/**
 * API Route: /api/meetings/[id]/participants/batch
 * POST - Mời nhiều người làm thành viên trong một lệnh (dòng "all" của đơn vị, "Toàn trường")
 */

import { NextRequest } from 'next/server';
import { getApiContext, requireAuthenticated } from '@/server/api/request-context';
import { apiSuccess, apiError } from '@/server/api/response';
import { MeetingService } from '@/server/services/meeting-service';
import { AddParticipantsSchema } from '@qcet/contracts/meeting';
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

    await assertRateLimit(authUser.id, 'MUTATION');

    const input = await parseAndValidateJson(request, AddParticipantsSchema);

    const result = await MeetingService.addParticipants(params.id, input, authUser.id, requestId);
    return apiSuccess(result, { requestId, status: 201 });
  } catch (error: any) {
    return apiError(error, requestId);
  }
}
