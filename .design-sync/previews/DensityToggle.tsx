import React from "react";
import { DensityToggle } from "qcet-eoffice";

export function Default() {
  return (
    <div style={{ padding: "20px", display: "flex", gap: "12px", alignItems: "center" }}>
      <DensityToggle showLabel />
      <DensityToggle variant="ghost" />
    </div>
  );
}
