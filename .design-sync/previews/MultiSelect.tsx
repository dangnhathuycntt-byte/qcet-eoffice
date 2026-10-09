import React from "react";
import { MultiSelect } from "qcet-eoffice";

const units = [
  { value: "ttstt", label: "Trung tâm Số và Truyền thông", description: "Đơn vị CNTT & Chuyển đổi số" },
  { value: "pdt", label: "Phòng Quản lý Đào tạo", description: "Quản lý đào tạo & Tuyển sinh" },
  { value: "ptchc", label: "Phòng Tổ chức - Hành chính", description: "Văn thư & Nhân sự" },
  { value: "pkhtc", label: "Phòng Kế hoạch - Tài chính", description: "Tài chính & Cơ sở vật chất" },
  { value: "kck", label: "Khoa Cơ khí", description: "Khoa chuyên môn kỹ thuật" },
  { value: "kdt", label: "Khoa Điện - Điện tử", description: "Khoa chuyên môn kỹ thuật" },
];

export function Default() {
  return (
    <div style={{ width: 420, padding: 20 }}>
      <MultiSelect
        label="Đơn vị phối hợp thực hiện"
        options={units}
        defaultValue={["ttstt", "pdt"]}
        placeholder="Chọn các đơn vị phối hợp..."
      />
    </div>
  );
}

export function MaxChips() {
  return (
    <div style={{ width: 420, padding: 20 }}>
      <MultiSelect
        label="Đơn vị nhận văn bản thông báo (giới hạn hiển thị 2 thẻ)"
        options={units}
        defaultValue={["ttstt", "pdt", "ptchc", "pkhtc"]}
        maxChips={2}
      />
    </div>
  );
}

export function Invalid() {
  return (
    <div style={{ width: 420, padding: 20 }}>
      <MultiSelect
        label="Đơn vị chủ trì"
        options={units}
        invalid
        placeholder="Chưa chọn đơn vị"
      />
    </div>
  );
}
