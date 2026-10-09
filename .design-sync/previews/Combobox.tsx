import React from "react";
import { Combobox } from "qcet-eoffice";

const people = [
  { value: "1", label: "Nguyễn Văn An", description: "Trưởng khoa Công nghệ thông tin" },
  { value: "2", label: "Trần Thị Bình", description: "Phòng Tổ chức nhân sự" },
  { value: "3", label: "Lê Minh Châu", description: "Phòng Đào tạo" },
  { value: "4", label: "Phạm Quốc Dũng", description: "Khoa Điện tử viễn thông" },
];

export function Default() {
  return (
    <div style={{ width: 340, padding: 20 }}>
      <Combobox aria-label="Người phụ trách" options={people} placeholder="Tìm người phụ trách" />
    </div>
  );
}

export function Open() {
  return (
    <div style={{ width: 340, height: 320, padding: 20 }}>
      <Combobox aria-label="Người phụ trách" options={people} defaultOpen placeholder="Tìm người phụ trách" />
    </div>
  );
}

export function NoResult() {
  return (
    <div style={{ width: 340, height: 140, padding: 20 }}>
      <Combobox aria-label="Người phụ trách" options={people} defaultOpen defaultInputValue="zzz" />
    </div>
  );
}

export function Invalid() {
  return (
    <div style={{ width: 340, padding: 20 }}>
      <Combobox aria-label="Người phụ trách" options={people} invalid placeholder="Chưa chọn người phụ trách" />
    </div>
  );
}
