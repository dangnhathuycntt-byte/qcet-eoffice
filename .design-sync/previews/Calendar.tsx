import React from "react";
import { Calendar } from "qcet-eoffice";

export function Default() {
  const [selected, setSelected] = React.useState<Date | null>(new Date());

  return (
    <div style={{ padding: "16px", background: "var(--card)", display: "inline-block" }}>
      <Calendar selected={selected} onSelect={setSelected} />
    </div>
  );
}
