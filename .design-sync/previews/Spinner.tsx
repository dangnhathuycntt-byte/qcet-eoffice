import React from "react";
import { Spinner } from "qcet-eoffice";

export function Sizes() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "16px", background: "var(--card)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <Spinner size="xs" />
        <span style={{ fontSize: "12px" }}>XS (14px)</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <Spinner size="sm" />
        <span style={{ fontSize: "12px" }}>SM (16px)</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <Spinner size="md" />
        <span style={{ fontSize: "12px" }}>MD (20px)</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <Spinner size="lg" />
        <span style={{ fontSize: "12px" }}>LG (24px)</span>
      </div>
    </div>
  );
}
