import React from "react";
import { Toggle } from "qcet-eoffice";
import { Bold, Italic, Underline } from "lucide-react";

export function Default() {
  return (
    <div style={{ display: "flex", gap: "8px", padding: "16px", background: "var(--card)" }}>
      <Toggle aria-label="In đậm">
        <Bold className="size-4" />
        <span>In đậm</span>
      </Toggle>
      <Toggle aria-label="In nghiêng" defaultPressed>
        <Italic className="size-4" />
        <span>In nghiêng</span>
      </Toggle>
      <Toggle aria-label="Gạch chân">
        <Underline className="size-4" />
        <span>Gạch chân</span>
      </Toggle>
    </div>
  );
}

export function Sizes() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "16px", background: "var(--card)" }}>
      <Toggle size="sm">Nhỏ (SM)</Toggle>
      <Toggle size="default">Mặc định</Toggle>
      <Toggle size="lg">Lớn (LG)</Toggle>
    </div>
  );
}
