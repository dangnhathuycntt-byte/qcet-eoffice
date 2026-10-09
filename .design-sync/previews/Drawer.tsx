import React from "react";
import { DrawerRoot, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, Button } from "qcet-eoffice";

export function Default() {
  return (
    <div>
      <DrawerRoot direction="right">
        <DrawerTrigger asChild>
          <Button variant="secondary">Mở ngăn kéo chi tiết</Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Chi tiết hồ sơ</DrawerTitle>
            <DrawerDescription>Mã hồ sơ: HS-2026-09-042</DrawerDescription>
          </DrawerHeader>
          <div style={{ padding: "16px", fontSize: "14px", color: "var(--color-text-secondary)" }}>
            Thông tin tóm tắt và danh sách văn bản kèm theo hồ sơ nhiệm vụ.
          </div>
          <DrawerFooter>
            <Button>Lưu thông tin</Button>
          </DrawerFooter>
        </DrawerContent>
      </DrawerRoot>
    </div>
  );
}
