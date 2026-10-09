import React from "react";
import { TrendLine } from "qcet-eoffice";

const trendData = [
  { xLabel: "T2", value: 12 },
  { xLabel: "T3", value: 19 },
  { xLabel: "T4", value: 15 },
  { xLabel: "T5", value: 28 },
  { xLabel: "T6", value: 34 },
  { xLabel: "T7", value: 22 },
  { xLabel: "CN", value: 30 },
];

export function Default() {
  return (
    <div style={{ width: 460, padding: 20 }}>
      <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
        XU HƯỚNG VĂN BẢN ĐẾN TRONG TUẦN
      </p>
      <TrendLine data={trendData} finalLabel="30 văn bản" />
    </div>
  );
}
