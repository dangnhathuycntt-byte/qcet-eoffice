import React from "react";
import { ToggleGroup, Toggle } from "qcet-eoffice";
import { AlignLeft, AlignCenter, AlignRight, AlignJustify } from "lucide-react";

export function SingleSelect() {
  return (
    <div style={{ padding: "16px", background: "var(--card)" }}>
      <ToggleGroup defaultValue={["center"]} aria-label="Căn lề văn bản">
        <Toggle value="left" aria-label="Căn trái">
          <AlignLeft className="size-4" />
        </Toggle>
        <Toggle value="center" aria-label="Căn giữa">
          <AlignCenter className="size-4" />
        </Toggle>
        <Toggle value="right" aria-label="Căn phải">
          <AlignRight className="size-4" />
        </Toggle>
        <Toggle value="justify" aria-label="Căn đều">
          <AlignJustify className="size-4" />
        </Toggle>
      </ToggleGroup>
    </div>
  );
}
