/**
 * Nhãn trạng thái cuộc họp, dùng chung cho danh sách và trang chi tiết. `tone` cho biết việc còn lại (biên bản chờ duyệt) hay
 * đã xong/không còn hiệu lực; hiển thị bằng màu chữ, không tô nền.
 */
export type MeetingStatusTone = "default" | "muted" | "warning";

const MEETING_STATUS: Record<string, { label: string; tone: MeetingStatusTone }> = {
  DRAFT_AGENDA: { label: "Dự thảo chương trình", tone: "muted" },
  INVITED: { label: "Đã mời", tone: "default" },
  HELD: { label: "Đã họp", tone: "default" },
  MINUTES_DRAFT: { label: "Dự thảo biên bản", tone: "warning" },
  MINUTES_CONFIRMED: { label: "Biên bản đã duyệt", tone: "muted" },
  CANCELLED: { label: "Đã hủy", tone: "muted" },
};

export const MEETING_STATUS_TONE_CLASS: Record<MeetingStatusTone, string> = {
  default: "text-foreground",
  muted: "text-muted-foreground",
  warning: "text-warning",
};

export function meetingStatus(status: string): { label: string; tone: MeetingStatusTone } {
  return MEETING_STATUS[status] ?? { label: status, tone: "muted" };
}
