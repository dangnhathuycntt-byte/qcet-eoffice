import React from "react";
import { FormField, Input, Textarea } from "qcet-eoffice";

export function Default() {
  return (
    <div style={{ width: 360, padding: 20 }}>
      <FormField label="Tên nhiệm vụ" required hint="Ngắn gọn, nêu rõ việc cần làm.">
        <Input placeholder="Ví dụ: Báo cáo giảng dạy học kỳ I" />
      </FormField>
    </div>
  );
}

export function CoLoi() {
  return (
    <div style={{ width: 360, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
      <FormField label="Tên nhiệm vụ" required error="Vui lòng nhập tên nhiệm vụ.">
        <Input />
      </FormField>
      <FormField label="Ghi chú" hint="Không bắt buộc.">
        <Textarea rows={3} />
      </FormField>
    </div>
  );
}
