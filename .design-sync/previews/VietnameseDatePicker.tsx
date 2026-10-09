import React from "react";
import { VietnameseDatePicker } from "qcet-eoffice";

export function Default() {
  const [date, setDate] = React.useState("2026-10-15");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "360px" }}>
      <VietnameseDatePicker
        label="Hạn hoàn thành:"
        value={date}
        onChange={setDate}
        variant="input"
      />
      <VietnameseDatePicker
        label="Ngày bắt đầu:"
        value="2026-10-01"
        variant="chip"
      />
    </div>
  );
}
