import React from "react";
import { StandardMenu, Button } from "qcet-eoffice";
import { Edit3, Copy, Archive, Trash2, MoreHorizontal } from "lucide-react";

export function Default() {
  return (
    <div style={{ padding: "20px" }}>
      <StandardMenu
        trigger={
          <Button variant="secondary" size="sm">
            <MoreHorizontal className="size-4" />
            Thao tác
          </Button>
        }
        items={[
          { id: "edit", label: "Chỉnh sửa thông tin", icon: Edit3 },
          { id: "copy", label: "Nhân bản văn bản", icon: Copy },
          { id: "archive", label: "Lưu trữ hồ sơ", icon: Archive, separator: true },
          { id: "delete", label: "Xóa vĩnh viễn", icon: Trash2, destructive: true },
        ]}
      />
    </div>
  );
}
