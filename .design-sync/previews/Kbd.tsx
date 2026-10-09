import React from "react";
import { Kbd, KbdGroup } from "qcet-eoffice";

const rows: [string, React.ReactNode][] = [
  ["Tạo việc mới", <Kbd key="c">C</Kbd>],
  ["Mở việc đang chọn", <Kbd key="e">Enter</Kbd>],
  ["Gửi bình luận", <KbdGroup key="s"><Kbd>Ctrl</Kbd><Kbd>Enter</Kbd></KbdGroup>],
  ["Đóng, bỏ chọn", <Kbd key="x">Esc</Kbd>],
];

export function PhimTat() {
  return (
    <div style={{ width: 300, padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map(([label, keys]) => (
        <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14 }}>
          <span>{label}</span>
          {keys}
        </div>
      ))}
    </div>
  );
}
