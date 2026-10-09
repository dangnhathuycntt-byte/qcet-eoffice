import React from "react";
import { StandardDialog, Button } from "qcet-eoffice";

export function Default() {
  const [open, setOpen] = React.useState(false);

  return (
    <div>
      <Button onClick={() => setOpen(true)}>Mở hộp thoại</Button>
      <StandardDialog
        open={open}
        onOpenChange={setOpen}
        title="Xác nhận gửi văn bản"
        description="Văn bản sau khi gửi sẽ được chuyển đến Ban Giám hiệu để phê duyệt."
      >
        <div style={{ padding: "12px 0", fontSize: "14px", color: "var(--color-text-secondary)" }}>
          Vui lòng kiểm tra kỹ các thông tin người nhận trước khi hoàn tất.
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
          <Button variant="secondary" onClick={() => setOpen(false)}>Hủy</Button>
          <Button onClick={() => setOpen(false)}>Xác nhận gửi</Button>
        </div>
      </StandardDialog>
    </div>
  );
}
