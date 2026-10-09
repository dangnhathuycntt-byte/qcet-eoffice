import React from 'react';
import { Button, StandardDialog } from 'qcet-eoffice';

export function Default() {
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      <Button onClick={() => setOpen(true)}>Mở hộp thoại StandardDialog</Button>
      <StandardDialog open={open} onOpenChange={setOpen} title="Giao nhiệm vụ mới" description="Điền thông tin nhiệm vụ bên dưới">
        <div className="p-4 text-xs text-muted-foreground">Nội dung hộp thoại hiển thị ở đây...</div>
      </StandardDialog>
    </div>
  );
}
