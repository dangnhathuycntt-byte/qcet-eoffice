import React from "react";
import { CompletionState } from "qcet-eoffice";

export function Default() {
  return (
    <CompletionState
      title="Đã chuyển giao nhiệm vụ thành công"
      description="Hồ sơ đã được bàn giao cho Phòng Hành chính tổng hợp xử lý. Cán bộ thụ lý sẽ nhận được thông báo qua hệ thống."
      primaryAction={{ label: "Về danh sách nhiệm vụ", onClick: () => {} }}
      secondaryAction={{ label: "Xem chi tiết", onClick: () => {} }}
      meta={
        <div style={{ padding: "8px 12px", background: "var(--color-bg-panel)", borderRadius: "8px", fontSize: "13px" }}>
          Mã giao dịch: <strong>TX-2026-10-0992</strong>
        </div>
      }
    />
  );
}
