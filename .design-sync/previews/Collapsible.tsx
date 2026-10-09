import React from "react";
import { StandardCollapsible, Button } from "qcet-eoffice";
import { ChevronDown } from "lucide-react";

export function Default() {
  const [open, setOpen] = React.useState(true);

  return (
    <div style={{ maxWidth: "420px" }}>
      <StandardCollapsible
        open={open}
        onOpenChange={setOpen}
        trigger={
          <Button variant="secondary" size="sm" style={{ width: "100%", justifyContent: "space-between" }}>
            <span>Thông tin bổ sung</span>
            <ChevronDown style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
          </Button>
        }
      >
        <div style={{ padding: "12px", fontSize: "14px", color: "var(--color-text-secondary)", background: "var(--color-bg-panel)", borderRadius: "8px", marginTop: "8px" }}>
          Nội dung mở rộng hiển thị các trường dữ liệu chi tiết kèm lịch sử cập nhật.
        </div>
      </StandardCollapsible>
    </div>
  );
}
