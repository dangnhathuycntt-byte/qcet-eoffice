import React from "react";
import { Checkbox } from "qcet-eoffice";

export function Standard() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px" }}>
        <Checkbox defaultChecked />
        <span>Gửi thông báo qua email</span>
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px" }}>
        <Checkbox />
        <span>Đính kèm tệp tin gốc</span>
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: "8px", opacity: 0.6, fontSize: "14px" }}>
        <Checkbox disabled defaultChecked />
        <span>Bắt buộc theo quy định (vô hiệu hóa)</span>
      </label>
    </div>
  );
}
