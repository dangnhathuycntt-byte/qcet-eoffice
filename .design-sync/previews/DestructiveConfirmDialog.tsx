import React from "react";
import { DestructiveConfirmDialog, Button } from "qcet-eoffice";

export function Default() {
  const [open, setOpen] = React.useState(false);

  return (
    <div>
      <Button variant="destructive" onClick={() => setOpen(true)}>Xóa nhiệm vụ</Button>
      <DestructiveConfirmDialog
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={() => setOpen(false)}
        title="Xác nhận xóa nhiệm vụ"
        entityName="Dự thảo kế hoạch đào tạo Q4/2026"
        description="sẽ bị xóa vĩnh viễn khỏi hệ thống quản lý."
      />
    </div>
  );
}
