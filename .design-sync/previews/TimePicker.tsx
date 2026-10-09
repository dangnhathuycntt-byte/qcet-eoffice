import React from "react";
import { TimePicker } from "qcet-eoffice";

export function Default() {
  return (
    <div style={{ width: 340, padding: 20 }}>
      <TimePicker
        label="Thời gian bắt đầu phiên họp"
        defaultValue="08:00"
      />
    </div>
  );
}

export function AllDay() {
  return (
    <div style={{ width: 340, padding: 20 }}>
      <TimePicker
        label="Thời gian sự kiện"
        defaultValue="Cả ngày"
      />
    </div>
  );
}
