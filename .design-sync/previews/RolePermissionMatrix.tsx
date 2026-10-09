import React from "react";
import { RolePermissionMatrix } from "qcet-eoffice";

const roles = [
  { id: "bgh", name: "Ban Giám hiệu", description: "Lãnh đạo trường" },
  { id: "truong_phong", name: "Trưởng phòng/khoa", description: "Quản lý đơn vị" },
  { id: "chuyen_vien", name: "Chuyên viên", description: "Xử lý văn bản" },
  { id: "giang_vien", name: "Giảng viên", description: "Người dùng cơ bản" },
];

const permissionGroups = [
  {
    id: "van_ban",
    name: "Quản lý Văn bản & Tờ tr��nh",
    permissions: [
      {
        id: "vb_view",
        name: "Xem danh sách văn bản",
        description: "Truy cập sổ văn bản đến/đi thuộc phạm vi",
        roles: { bgh: true, truong_phong: true, chuyen_vien: true, giang_vien: true },
      },
      {
        id: "vb_create",
        name: "Soạn thảo dự thảo & Tờ trình",
        description: "Khởi tạo văn bản mới",
        roles: { bgh: true, truong_phong: true, chuyen_vien: true, giang_vien: false },
      },
      {
        id: "vb_approve",
        name: "Ký duyệt & Ban hành",
        description: "Thẩm quyền ký số và phát hành văn bản chính thức",
        roles: { bgh: true, truong_phong: false, chuyen_vien: false, giang_vien: false },
      },
    ],
  },
  {
    id: "nhiem_vu",
    name: "Quản lý Nhiệm vụ & Giao việc",
    permissions: [
      {
        id: "task_assign",
        name: "Giao nhiệm vụ cấp dưới",
        description: "Tạo và phân công nhiệm vụ cho cán bộ trong đơn vị",
        roles: { bgh: true, truong_phong: true, chuyen_vien: false, giang_vien: false },
      },
      {
        id: "task_report",
        name: "Báo cáo tiến độ & Nộp kết quả",
        description: "Cập nhật % hoàn thành và đính kèm sản phẩm",
        roles: { bgh: true, truong_phong: true, chuyen_vien: true, giang_vien: true },
      },
    ],
  },
];

export function MaTranPhanQuyen() {
  return (
    <div style={{ width: 680, padding: 20 }}>
      <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>MA TRẬN PHÂN QUYỀN VAI TRÒ HỆ THỐNG</p>
      <RolePermissionMatrix
        roles={roles}
        groups={permissionGroups}
        onToggle={(permId, roleId) => console.log("Toggle:", permId, roleId)}
      />
    </div>
  );
}
