/**
 * API Route: /api/meetings/[id]/actions/draft-minutes
 * POST - Soạn biên bản cuộc họp (HELD -> MINUTES_DRAFT)
 */

import { idActionRoute } from '@/server/api/action-route';
import { MeetingService } from '@/server/services/meeting-service';
import { DraftMinutesSchema } from '@qcet/contracts/meeting';

export const POST = idActionRoute(
  DraftMinutesSchema,
  (user, input, { id, requestId }) => MeetingService.draftMinutes(id, input, user.id, requestId),
  { legacyErrors: true }
);
