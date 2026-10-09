import React from "react";
import { InlineExplanation } from "qcet-eoffice";

export function Default() {
  return (
    <div style={{ padding: "20px", display: "flex", gap: "16px", alignItems: "center" }}>
      <span>Trạng thái: Quá hạn</span>
      <InlineExplanation
        triggerText="Vì sao trễ?"
        title="Lý do chậm trễ"
        showIcon
      >
        Nhiệm vụ chưa được duyệt trước mốc 17:00 ngày 25/09 do chờ văn bản phụ lục từ Ban Đào tạo.
      </InlineExplanation>
    </div>
  );
}
