import React from "react";
import { DocumentStatusTimeline } from "qcet-eoffice";

const workflowSteps = [
  {
    id: "1",
    title: "Khởi tạo & Soạn thảo dự thảo",
    actor: {
      name: "Nguyễn Văn Hùng",
      title: "Chuyên viên Phòng Đào tạo",
    },
    timestamp: "2026-10-02T08:30:00",
    comment: "Đã hoàn thiện dự thảo kế hoạch tuyển sinh theo chỉ tiêu mới.",
    state: "completed" as const,
  },
  {
    id: "2",
    title: "Trưởng phòng thẩm tra & phê duyệt",
    actor: {
      name: "Trần Thị Lan",
      title: "Trưởng phòng Quản lý Đào tạo",
    },
    timestamp: "2026-10-02T14:15:00",
    comment: "Đồng ý chuyển Ban Giám hiệu ký duyệt ban hành.",
    state: "completed" as const,
  },
  {
    id: "3",
    title: "Hiệu trưởng ký duyệt điện tử",
    actor: {
      name: "PGS. TS. Nguyễn Văn Nam",
      title: "Hiệu trưởng",
    },
    timestamp: "2026-10-03T09:00:00",
    state: "current" as const,
  },
  {
    id: "4",
    title: "Văn thư cấp số & Phát hành văn bản",
    state: "pending" as const,
  },
];

export function TienTrinhXuLyVanBan() {
  return (
    <div style={{ width: 480, padding: 20 }}>
      <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>TIẾN TRÌNH DUYỆT TỜ TRÌNH</p>
      <DocumentStatusTimeline steps={workflowSteps} />
    </div>
  );
}

export function TienTrinhNgang() {
  return (
    <div style={{ width: 560, padding: 20 }}>
      <DocumentStatusTimeline steps={workflowSteps} orientation="horizontal" />
    </div>
  );
}
