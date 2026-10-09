import React from "react";
import { BottomSheet, BottomSheetTrigger, BottomSheetContent, BottomSheetHeader, BottomSheetTitle, BottomSheetDescription, Button } from "qcet-eoffice";

export function Default() {
  return (
    <div>
      <BottomSheet>
        <BottomSheetTrigger asChild>
          <Button variant="outline">Mở Bottom Sheet (Mobile)</Button>
        </BottomSheetTrigger>
        <BottomSheetContent>
          <BottomSheetHeader>
            <BottomSheetTitle>Tùy chọn thao tác</BottomSheetTitle>
            <BottomSheetDescription>Chọn hành động cần thực hiện</BottomSheetDescription>
          </BottomSheetHeader>
          <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <Button variant="default">Chuyển xử lý</Button>
            <Button variant="secondary">Lưu trữ</Button>
          </div>
        </BottomSheetContent>
      </BottomSheet>
    </div>
  );
}
