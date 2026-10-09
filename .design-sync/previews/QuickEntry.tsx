import React from "react";
import { QuickEntry } from "qcet-eoffice";

export function Default() {
  const [tasks, setTasks] = React.useState<string[]>([
    "Liên hệ Phòng Quản lý Đào tạo xin số liệu",
    "Gửi phụ lục 2 cho Tổ Tuyển sinh",
  ]);

  return (
    <div style={{ width: 440, padding: 20, background: "var(--card)", display: "flex", flexDirection: "column", gap: 12 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted-foreground)" }}>
        Danh sách việc con ({tasks.length})
      </span>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {tasks.map((task, i) => (
          <div
            key={i}
            style={{
              padding: "8px 12px",
              borderRadius: "12px",
              background: "var(--secondary)",
              fontSize: "13px",
            }}
          >
            {task}
          </div>
        ))}
      </div>

      <QuickEntry
        placeholder="Thêm việc con mới..."
        onSave={(newVal) => setTasks((prev) => [...prev, newVal])}
      />
    </div>
  );
}
