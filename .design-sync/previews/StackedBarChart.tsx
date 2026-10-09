import React from "react";
import { StackedBarChart } from "qcet-eoffice";

const segments = [
  { label: "Đúng hạn (78%)", value: 78, color: "var(--foreground)" },
  { label: "Gần hạn (14%)", value: 14, color: "var(--muted-foreground)" },
  { label: "Quá hạn (8%)", value: 8, color: "var(--border)" },
];

export function Default() {
  return (
    <div style={{ width: 460, padding: 20 }}>
      <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
        TỶ LỆ HOÀN THÀNH NHIỆM VỤ THEO HẠN
      </p>
      <StackedBarChart segments={segments} showLegend />
    </div>
  );
}
