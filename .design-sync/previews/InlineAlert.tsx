import React from "react";
import { InlineAlert } from "qcet-eoffice";

export function Variants() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "460px" }}>
      <InlineAlert variant="error" actionLabel="Thử lại" onAction={() => alert("Thử lại")}>
        Không thể kết nối đến máy chủ văn bản.
      </InlineAlert>
      <InlineAlert variant="warning">
        Nhiệm vụ này sắp đến hạn trong vòng 24 giờ tới.
      </InlineAlert>
      <InlineAlert variant="info">
        Tệp đính kèm đã được quét an toàn tự động.
      </InlineAlert>
    </div>
  );
}
