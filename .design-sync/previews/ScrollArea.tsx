import React from "react";
import { ScrollArea } from "qcet-eoffice";

const list = Array.from({ length: 15 }, (_, i) => ({
  id: i + 1,
  title: `Văn bản số ${i + 1}/QCET-TB ngày ${(i + 1).toString().padStart(2, "0")}/10/2026`,
  desc: "Thông báo về việc triển khai kế hoạch chuyên môn học kỳ I",
}));

export function Default() {
  return (
    <div style={{ padding: 20, width: 440 }}>
      <ScrollArea style={{ height: 220, paddingRight: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((item) => (
            <div
              key={item.id}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                backgroundColor: "var(--secondary)",
                fontSize: 13,
              }}
            >
              <p style={{ margin: 0, fontWeight: 500 }}>{item.title}</p>
              <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "var(--muted-foreground)" }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
