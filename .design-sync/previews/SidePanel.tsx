import React from "react";
import { SidePanel, Button } from "qcet-eoffice";

export function Default() {
  const [open, setOpen] = React.useState(false);

  return (
    <div style={{ padding: 20 }}>
      <Button onClick={() => setOpen(true)}>Mở Panel chi tiết</Button>
      <SidePanel
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Nhiệm vụ: Soạn thảo kế hoạch kiểm định"
        subtitle="Mã: NV-2026-09-042"
        stats={{
          total: 8,
          completed: 5,
          inProgress: 2,
          overdue: 1,
          completionRate: 62.5,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 13, margin: 0 }}>
            Tiến độ và các tài liệu đính kèm theo nhiệm vụ trọng tâm học kỳ I.
          </p>
        </div>
      </SidePanel>
    </div>
  );
}
