import React from "react";
import { RadioGroup } from "qcet-eoffice";

const priorities = [
  { value: "high", label: "Cao", description: "Cần xử lý trong tuần này" },
  { value: "normal", label: "Trung bình", description: "Xử lý theo kế hoạch" },
  { value: "low", label: "Thấp" },
  { value: "hold", label: "Tạm hoãn", disabled: true },
];

export function Default() {
  return (
    <div style={{ width: 320, padding: 20 }}>
      <RadioGroup aria-label="Mức ưu tiên" options={priorities} defaultValue="normal" />
    </div>
  );
}

export function Horizontal() {
  return (
    <div style={{ padding: 20 }}>
      <RadioGroup
        aria-label="Phạm vi"
        orientation="horizontal"
        defaultValue="all"
        options={[
          { value: "all", label: "Toàn trường" },
          { value: "unit", label: "Đơn vị" },
          { value: "me", label: "Của tôi" },
        ]}
      />
    </div>
  );
}
