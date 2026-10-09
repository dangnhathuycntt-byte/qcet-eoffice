import React from "react";
import { TaskStatusCircle } from "qcet-eoffice";

const rows: [string, string][] = [
  ["NOT_STARTED", "Chưa bắt đầu"],
  ["IN_PROGRESS", "Đang thực hiện"],
  ["WAITING_APPROVAL", "Chờ duyệt"],
  ["NEEDS_REVIEW", "Cần xem lại"],
  ["COMPLETED", "Hoàn thành"],
  ["CANCELLED", "Đã hủy"],
];

export function AllStatuses() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
      {rows.map(([status, label]) => (
        <div key={status} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <TaskStatusCircle status={status} />
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
