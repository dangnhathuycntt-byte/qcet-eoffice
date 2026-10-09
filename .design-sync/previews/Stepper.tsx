import React from "react";
import { Stepper } from "qcet-eoffice";

export function SoanVanBan() {
  return (
    <div style={{ padding: 20 }}>
      <Stepper current={1} steps={[{ label: "Nội dung" }, { label: "Người ký và nơi nhận" }, { label: "Xem lại" }]} />
    </div>
  );
}

export function HoanTat() {
  return (
    <div style={{ padding: 20 }}>
      <Stepper current={3} steps={[{ label: "Nội dung" }, { label: "Người ký" }, { label: "Trình ký" }]} />
    </div>
  );
}
