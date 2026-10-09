import React from 'react';
import { Button } from 'qcet-eoffice';

export function Default() {
  return (
    <div className="w-64 p-3.5 rounded-xl bg-popover border-0 shadow-dropdown space-y-2 text-xs">
      <h4 className="font-semibold text-foreground">Thông tin Popover (PopoverPortal)</h4>
      <p className="text-muted-foreground leading-relaxed">
        Cửa sổ nổi hiển thị chi tiết khi bấm vào một điểm kích hoạt.
      </p>
      <div className="flex justify-end pt-1">
        <Button variant="secondary" size="sm">Đóng</Button>
      </div>
    </div>
  );
}
