import React from 'react';
import { Button } from 'qcet-eoffice';

export function Default() {
  return (
    <div className="w-80 rounded-t-[24px] bg-card p-4 border-0 shadow-dialog space-y-3">
      <div className="mx-auto h-1 w-9 rounded-full bg-muted-foreground/30" />
      <h3 className="text-sm font-semibold text-foreground pt-1">Bảng chọn di động (BottomSheetPortal)</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Ngăn kéo phía dưới thay thế hộp thoại trên màn hình điện thoại.
      </p>
      <div className="flex justify-end gap-2 pt-2">
        <Button size="sm" className="w-full">Xác nhận</Button>
      </div>
    </div>
  );
}
