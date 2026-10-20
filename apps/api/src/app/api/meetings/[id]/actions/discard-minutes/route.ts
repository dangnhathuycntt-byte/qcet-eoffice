/**
 * API Route: /api/meetings/[id]/actions/discard-minutes
 * POST - Xóa dự thảo biên bản để soạn lại (MINUTES_DRAFT -> HELD)
 */

import { z } from 'zod';
import { idActionRoute } from '@/server/api/action-route';
import { MeetingService } from '@/server/services/meeting-service';

export const POST = idActionRoute(
  z.object({}).strict(),
  (user, _input, { id, requestId }) => MeetingService.discardMinutes(id, user.id, requestId),
  { allowEmpty: true, legacyErrors: true }
);
