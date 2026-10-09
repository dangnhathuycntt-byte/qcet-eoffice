import React from "react";
import { Select } from "qcet-eoffice";

const units = [
  { value: "cntt", label: "Khoa Công nghệ thông tin", group: "Khoa" },
  { value: "dtvt", label: "Khoa Điện tử viễn thông", group: "Khoa" },
  { value: "tcns", label: "Phòng Tổ chức nhân sự", group: "Phòng ban" },
  { value: "dt", label: "Phòng Đào tạo", group: "Phòng ban" },
  { value: "kt", label: "Phòng Kế hoạch tài chính", group: "Phòng ban", disabled: true },
];

export function Default() {
  return (
    <div style={{ width: 320, padding: 20 }}>
      <Select label="Đơn vị phụ trách" options={units} placeholder="Chọn đơn vị" />
    </div>
  );
}

export function Open() {
  return (
    <div style={{ width: 320, height: 300, padding: 20 }}>
      <Select label="Đơn vị phụ trách" options={units} defaultValue="cntt" defaultOpen />
    </div>
  );
}

export function Invalid() {
  return (
    <div style={{ width: 320, padding: 20 }}>
      <Select aria-label="Đơn vị" options={units} invalid placeholder="Vui lòng chọn đơn vị" />
    </div>
  );
}

export function Disabled() {
  return (
    <div style={{ width: 320, padding: 20 }}>
      <Select aria-label="Đơn vị" options={units} defaultValue="dt" disabled />
    </div>
  );
}
