import React from "react";
import { DateRangePicker } from "qcet-eoffice";

export function Default() {
  return (
    <div style={{ width: 380, padding: 20 }}>
      <DateRangePicker
        label="Mốc thời gian nhiệm vụ"
        defaultValue={{ from: "2026-09-01", to: "2026-09-30" }}
      />
    </div>
  );
}

export function AcademicPreset() {
  return (
    <div style={{ width: 380, padding: 20 }}>
      <DateRangePicker
        label="Thời gian theo học kỳ"
        placeholder="Chọn học kỳ hoặc khoảng ngày..."
      />
    </div>
  );
}
