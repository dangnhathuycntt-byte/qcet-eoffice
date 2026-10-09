import React from 'react';
import { Button, StandardPopover } from 'qcet-eoffice';

export function Default() {
  return (
    <StandardPopover trigger={<Button variant="secondary" size="sm">Mở Popover</Button>}>
      <div className="p-2 text-xs text-foreground">Nội dung popover thông tin nhanh.</div>
    </StandardPopover>
  );
}
