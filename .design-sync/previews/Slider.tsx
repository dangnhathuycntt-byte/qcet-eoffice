import React from "react";
import { Slider } from "qcet-eoffice";

export function Default() {
  return (
    <div style={{ width: 340, padding: 20, display: "flex", flexDirection: "column", gap: 24 }}>
      <Slider
        label="Tiến độ thực hiện nhiệm vụ"
        showValue
        defaultValue={65}
      />
      <Slider
        label="Đánh giá chất lượng giảng dạy"
        showValue
        defaultValue={8}
        min={0}
        max={10}
        step={0.5}
        formatValue={(val) => `${val}/10 điểm`}
      />
      <Slider
        label="Không khả dụng"
        showValue
        defaultValue={40}
        disabled
      />
    </div>
  );
}

export function Range() {
  return (
    <div style={{ width: 340, padding: 20, display: "flex", flexDirection: "column", gap: 24 }}>
      <Slider
        label="Khung phần trăm hoàn thành"
        showValue
        defaultValue={[25, 75]}
        formatValue={(val) => `${val}%`}
      />
    </div>
  );
}
