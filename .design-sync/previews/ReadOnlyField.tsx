import React from "react";
import { ReadOnlyField } from "qcet-eoffice";

export function Default() {
  return (
    <div style={{ width: 380, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
      <ReadOnlyField
        label="Mã định danh nhiệm vụ"
        value="NV-2026-09-129"
        mono
        hint="Bấm nút bên phải để sao chép mã liên kết"
      />
      <ReadOnlyField
        label="Số ký hiệu văn bản nguồn"
        value="1245/SGDĐT-GDNN"
        mono
      />
    </div>
  );
}
