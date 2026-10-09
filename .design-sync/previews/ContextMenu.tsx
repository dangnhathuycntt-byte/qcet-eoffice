import React from "react";
import { ContextMenu } from "qcet-eoffice";
import { Eye, Edit3, UserCheck, Trash2, ArrowRight } from "lucide-react";

const items = [
  { id: "view", label: "Xem chi tiết nhiệm vụ", icon: <Eye />, shortcut: "Enter" },
  { id: "edit", label: "Chỉnh sửa nội dung", icon: <Edit3 />, shortcut: "E" },
  {
    id: "status",
    label: "Đổi trạng thái",
    icon: <ArrowRight />,
    items: [
      { id: "st-inprogress", label: "Đang thực hiện" },
      { id: "st-review", label: "Chờ BGH duyệt" },
      { id: "st-complete", label: "Đã hoàn thành" },
    ],
  },
  { id: "assign", label: "Chuyển người phụ trách...", icon: <UserCheck />, shortcut: "P" },
  { id: "sep", label: "-", separator: true },
  { id: "delete", label: "Xóa nhiệm vụ", icon: <Trash2 />, destructive: true },
];

export function Default() {
  return (
    <div style={{ padding: 24, width: 480 }}>
      <ContextMenu items={items}>
        <div
          style={{
            padding: "32px 24px",
            textAlign: "center",
            borderRadius: 12,
            backgroundColor: "var(--secondary)",
            fontSize: 14,
            cursor: "context-menu",
          }}
        >
          <span style={{ fontWeight: 500 }}>Nhấn chuột phải vào vùng này</span>
          <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "var(--muted-foreground)" }}>
            để mở menu ngữ cảnh với các thao tác nhanh và menu con ngang.
          </p>
        </div>
      </ContextMenu>
    </div>
  );
}
