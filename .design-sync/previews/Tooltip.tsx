import React from "react";
import { Tooltip, TooltipTrigger, TooltipContent, Button } from "qcet-eoffice";

export function Default() {
  return (
    <div style={{ padding: "40px 20px", display: "flex", gap: "16px" }}>
      <Tooltip open>
        <TooltipTrigger asChild>
          <Button variant="secondary" size="sm">Rê chuột vào đây</Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          Nhấn để xem thông tin chi tiết
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
