import React from "react";
import { Badge } from "qcet-eoffice";
import { CheckCircle2, Clock, AlertCircle } from "lucide-react";

export function Default() {
  return <Badge>Mặc định</Badge>;
}

export function StatusVariants() {
  return (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
      <Badge variant="default">Đang xử lý</Badge>
      <Badge variant="secondary">Nháp</Badge>
      <Badge variant="outline">Chờ duyệt</Badge>
      <Badge variant="destructive">Quá hạn</Badge>
      <Badge variant="sapphire">Chuyên môn</Badge>
      <Badge variant="emerald">Hoàn thành</Badge>
      <Badge variant="amber">Tạm dừng</Badge>
    </div>
  );
}

export function WithIcons() {
  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
      <Badge variant="emerald">
        <CheckCircle2 className="size-3.5" />
        Đã duyệt
      </Badge>
      <Badge variant="amber">
        <Clock className="size-3.5" />
        Đang chờ
      </Badge>
      <Badge variant="destructive">
        <AlertCircle className="size-3.5" />
        Khẩn cấp
      </Badge>
    </div>
  );
}
