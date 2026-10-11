/**
 * API Route: /api/meetings/[id]/actions/confirm-minutes
 * POST - Phê duyệt / Xác nhận biên bản (MINUTES_DRAFT -> MINUTES_CONFIRMED)
 */

import { idActionRoute } from '@/server/api/action-route';
import { MeetingService } from '@/server/services/meeting-service';
import { ConfirmMinutesSchema } from '@/contracts/meeting';

export const POST = idActionRoute(
  ConfirmMinutesSchema,
  (user, input, { id, requestId }) => MeetingService.confirmMinutes(id, input, user.id, requestId),
  { allowEmpty: true, legacyErrors: true }
);
