import React from "react";
import { StatsTile, StatsRow } from "qcet-eoffice";

export function StandardRow() {
  return (
    <div style={{ padding: 24, background: "var(--card)", maxWidth: 700 }}>
      <StatsRow>
        <StatsTile label="Nhiệm vụ đang mở" value="24" subtext="tháng 9" />
        <StatsTile label="Chờ duyệt" value="5" />
        <StatsTile label="Trễ hạn" value="2" variant="destructive" />
        <StatsTile label="Đúng hạn" value="86%" subtext="tháng này" variant="success" />
      </StatsRow>
    </div>
  );
}
