import React from "react";
import { Switch } from "qcet-eoffice";

export function Standard() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "320px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "14px" }}>Chế độ bảo mật 2 lớp</span>
        <Switch defaultChecked />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "14px" }}>Tự động đồng bộ lịch</span>
        <Switch />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", opacity: 0.6 }}>
        <span style={{ fontSize: "14px" }}>Thông báo khẩn cấp (cố định)</span>
        <Switch disabled defaultChecked />
      </div>
    </div>
  );
}
