import React from "react";
import { TaskStatusIcon } from "qcet-eoffice";

export function AllStatuses() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "16px", background: "var(--card)", maxWidth: "320px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
        <TaskStatusIcon status="NOT_STARTED" />
        <span>Chưa bắt đầu (NOT_STARTED)</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
        <TaskStatusIcon status="IN_PROGRESS" />
        <span>Đang thực hiện (IN_PROGRESS)</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
        <TaskStatusIcon status="WAITING_APPROVAL" />
        <span>Chờ phê duyệt (WAITING_APPROVAL)</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
        <TaskStatusIcon status="NEEDS_REVIEW" />
        <span>Cần chỉnh sửa (NEEDS_REVIEW)</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
        <TaskStatusIcon status="COMPLETED" />
        <span>Đã hoàn thành (COMPLETED)</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
        <TaskStatusIcon status="CANCELLED" />
        <span>Đã hủy (CANCELLED)</span>
      </div>
    </div>
  );
}
