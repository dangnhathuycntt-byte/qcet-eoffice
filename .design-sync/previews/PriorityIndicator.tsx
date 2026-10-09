import React from "react";
import { PriorityIndicator } from "qcet-eoffice";

export function AllLevels() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "16px", background: "var(--card)", maxWidth: "320px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <PriorityIndicator priority="LOW" showLabel />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <PriorityIndicator priority="MEDIUM" showLabel />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <PriorityIndicator priority="HIGH" showLabel />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <PriorityIndicator priority="URGENT" showLabel />
      </div>
    </div>
  );
}

export function BarsOnly() {
  return (
    <div style={{ display: "flex", gap: "16px", padding: "16px", background: "var(--card)" }}>
      <PriorityIndicator priority="LOW" />
      <PriorityIndicator priority="MEDIUM" />
      <PriorityIndicator priority="HIGH" />
      <PriorityIndicator priority="URGENT" />
    </div>
  );
}
