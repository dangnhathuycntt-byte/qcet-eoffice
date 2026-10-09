import React from "react";
import { Button } from "qcet-eoffice";
import { Plus, Check, ArrowRight, Trash2 } from "lucide-react";

export function Primary() {
  return <Button variant="default">Lưu thay đổi</Button>;
}

export function Variants() {
  return (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
      <Button variant="default">Chính (Primary)</Button>
      <Button variant="secondary">Phụ (Secondary)</Button>
      <Button variant="outline">Đường viền (Outline)</Button>
      <Button variant="ghost">Trong suốt (Ghost)</Button>
      <Button variant="destructive">Nguy hiểm (Destructive)</Button>
    </div>
  );
}

export function Sizes() {
  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
      <Button size="xs">Cực nhỏ (XS)</Button>
      <Button size="sm">Nhỏ (SM)</Button>
      <Button size="default">Mặc định</Button>
      <Button size="lg">Lớn (LG)</Button>
    </div>
  );
}

export function WithIcons() {
  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
      <Button>
        <Plus className="size-4" />
        Tạo nhiệm vụ
      </Button>
      <Button variant="secondary">
        <Check className="size-4" />
        Hoàn tất
      </Button>
      <Button variant="destructive">
        <Trash2 className="size-4" />
        Xóa
      </Button>
    </div>
  );
}

export function Disabled() {
  return (
    <div style={{ display: "flex", gap: "8px" }}>
      <Button disabled>Không khả dụng</Button>
      <Button variant="secondary" disabled>Vô hiệu hóa</Button>
    </div>
  );
}
