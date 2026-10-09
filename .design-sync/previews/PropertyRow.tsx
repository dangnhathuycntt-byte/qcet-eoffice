import React from "react";
import { PropertyRow, Badge, UserAvatar } from "qcet-eoffice";
import { Calendar, User, Tag } from "lucide-react";

export function Default() {
  return (
    <div style={{ maxWidth: "340px", display: "flex", flexDirection: "column", gap: "4px", padding: "12px", background: "var(--color-bg-panel)", borderRadius: "8px" }}>
      <PropertyRow label="Người thực hiện" icon={<User className="size-3.5" />} interactive>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <UserAvatar name="Nguyễn Văn An" size="xs" />
          <span style={{ fontSize: "13px" }}>Nguyễn Văn An</span>
        </div>
      </PropertyRow>
      <PropertyRow label="Hạn hoàn thành" icon={<Calendar className="size-3.5" />} interactive>
        <span style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>15/10/2026</span>
      </PropertyRow>
      <PropertyRow label="Trạng thái" icon={<Tag className="size-3.5" />}>
        <Badge variant="sapphire">Đang xử lý</Badge>
      </PropertyRow>
    </div>
  );
}
