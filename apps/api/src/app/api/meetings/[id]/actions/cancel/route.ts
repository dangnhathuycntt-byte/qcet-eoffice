/**
 * API Route: /api/meetings/[id]/actions/cancel
 * POST - Hủy cuộc họp (-> CANCELLED): cần quyền sửa cuộc họp (`meeting.update`), trạng thái cuối (đã duyệt biên bản, đã hủy)
 * không hủy được. Menu chuột phải và thanh thao tác hàng loạt của trang Cuộc họp gọi route này.
 */
import { CancelMeetingSchema } from '@qcet/contracts/meeting';
import { idActionRoute } from '@/server/api/action-route';
import { MeetingService } from '@/server/services/meeting-service';

export const POST = idActionRoute(
  CancelMeetingSchema,
  (user, body, { id, requestId }) => MeetingService.cancelMeeting(id, user.id, body.reason, requestId),
  { allowEmpty: true }
);
