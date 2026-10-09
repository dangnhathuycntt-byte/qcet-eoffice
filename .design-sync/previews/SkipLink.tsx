import React from "react";
import { SkipLink } from "qcet-eoffice";

export function Default() {
  return (
    <div style={{ width: 440, padding: 20, background: "var(--card)" }}>
      <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 12 }}>
        Bấm phím <code style={{ background: "var(--border)", padding: "2px 6px", borderRadius: 4 }}>Tab</code> để thấy liên kết bỏ qua xuất hiện ở góc trên màn hình:
      </p>
      <SkipLink targetId="main-content" />
      <div
        id="main-content"
        style={{
          padding: 16,
          borderRadius: 12,
          background: "var(--secondary)",
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        Vùng nội dung chính (#main-content)
      </div>
    </div>
  );
}
