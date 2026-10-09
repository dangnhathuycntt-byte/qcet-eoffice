import React from "react";
import { PersonPicker } from "qcet-eoffice";

const staffList = [
  {
    id: "1",
    name: "Đặng Nhật Huy",
    department: "Trung tâm Số và Truyền thông",
    roleTitle: "Giám đốc Trung tâm",
    email: "dnhhuy@cdktcnqn.edu.vn",
  },
  {
    id: "2",
    name: "Nguyễn Thị Hồng Trinh",
    department: "Trung tâm Số và Truyền thông",
    roleTitle: "Chuyên viên CNTT",
    email: "nthtrinh@cdktcnqn.edu.vn",
  },
  {
    id: "3",
    name: "Ngô Lê Minh Khuê",
    department: "Trung tâm Số và Truyền thông",
    roleTitle: "Kỹ thuật viên",
    email: "nlmkhue@cdktcnqn.edu.vn",
  },
  {
    id: "4",
    name: "Nguyễn Ngọc Vinh",
    department: "Phòng Quản lý Đào tạo",
    roleTitle: "Trưởng phòng Đào tạo",
    email: "nnvinh@cdktcnqn.edu.vn",
  },
  {
    id: "5",
    name: "Lê Minh Khoa",
    department: "Phòng Tổ chức - Hành chính",
    roleTitle: "Chuyên viên Tổ chức",
    email: "lmkhoa@cdktcnqn.edu.vn",
  },
];

export function Single() {
  return (
    <div style={{ width: 420, padding: 20 }}>
      <PersonPicker
        label="Cán bộ chủ trì"
        people={staffList}
        defaultValue="1"
        currentDepartment="Trung tâm Số và Truyền thông"
      />
    </div>
  );
}

export function Multiple() {
  return (
    <div style={{ width: 420, padding: 20 }}>
      <PersonPicker
        multiple
        label="Cán bộ phối hợp thực hiện"
        people={staffList}
        defaultValue={["2", "3"]}
        currentDepartment="Trung tâm Số và Truyền thông"
        placeholder="Chọn cán bộ phối hợp..."
      />
    </div>
  );
}
