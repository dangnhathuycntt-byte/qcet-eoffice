import React from "react";
import { PrioritySignalBars } from "qcet-eoffice";

const rows: [string, string][] = [
  ["URGENT", "Khẩn cấp"],
  ["HIGH", "Cao"],
  ["NORMAL", "Bình thường"],
  ["LOW", "Thấp"],
];

export function AllPriorities() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map(([priority]) => (
        <PrioritySignalBars key={priority} priority={priority} showLabel />
      ))}
    </div>
  );
}

export function IconOnly() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      {rows.map(([priority]) => (
        <PrioritySignalBars key={priority} priority={priority} />
      ))}
    </div>
  );
}
