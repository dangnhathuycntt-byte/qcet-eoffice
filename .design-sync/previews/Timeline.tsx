import React from "react";
import { Timeline, type TimelineItem } from "qcet-eoffice";

const mockActivities: TimelineItem[] = [
  {
    id: "act-1",
    type: "change_request",
    actor: {
      name: "Nguyễn Ngọc Vinh",
      roleTitle: "Trưởng phòng Đào tạo",
    },
    action: "yêu cầu chỉnh sửa “Báo cáo tháng 9”",
    timestamp: "10 phút trước",
    unread: true,
    decisionNote: "Cần bổ sung số liệu tuyển sinh hệ Cao đẳng liên thông tại trang 4 trước 15:00.",
  },
  {
    id: "act-2",
    type: "approval",
    actor: {
      name: "Ngô Lê Minh Khuê",
      roleTitle: "Kỹ thuật viên",
    },
    action: "đã hoàn thành việc con “Cài đặt hệ thống”",
    timestamp: "Hôm qua, 16:10",
  },
  {
    id: "act-3",
    type: "comment",
    actor: {
      name: "Nguyễn Thị Hồng Trinh",
      roleTitle: "Chuyên viên CNTT",
    },
    action: "đã bình luận trong “Báo cáo chuyển đổi số”",
    timestamp: "27/09/2026",
    content: "Đã rà soát xong 12 tiêu chí an toàn thông tin theo yêu cầu của Sở.",
  },
];

export function Standard() {
  return (
    <div style={{ maxWidth: 520, padding: 24, background: "var(--card)" }}>
      <Timeline items={mockActivities} />
    </div>
  );
}
