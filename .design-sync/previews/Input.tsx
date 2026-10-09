import React from "react";
import { Input } from "qcet-eoffice";

export function Default() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxWidth: "360px" }}>
      <label style={{ fontSize: "13px", fontWeight: 500 }}>Họ và tên</label>
      <Input placeholder="Nhập họ và tên cán bộ..." />
    </div>
  );
}

export function States() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "360px" }}>
      <div>
        <label style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Trạng thái mặc định</label>
        <Input defaultValue="Nguyễn Văn An" />
      </div>
      <div>
        <label style={{ fontSize: "12px", color: "var(--color-destructive)" }}>Trạng thái lỗi</label>
        <Input aria-invalid defaultValue="email_khong_hop_le" />
      </div>
      <div>
        <label style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Vô hiệu hóa</label>
        <Input disabled value="Không thể chỉnh sửa" />
      </div>
    </div>
  );
}
