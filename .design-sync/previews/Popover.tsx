import React from "react";
import { PopoverRoot, PopoverTrigger, PopoverContent, Button } from "qcet-eoffice";
import { Filter } from "lucide-react";

export function Default() {
  return (
    <div style={{ padding: "20px" }}>
      <PopoverRoot>
        <PopoverTrigger
          render={
            <Button variant="outline" size="sm">
              <Filter className="size-4" />
              Bộ lọc nhanh
            </Button>
          }
        />
        <PopoverContent style={{ width: "260px", padding: "12px" }}>
          <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "8px" }}>Bộ lọc nhiệm vụ</div>
          <p style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
            Lọc theo phòng ban hoặc mức độ ưu tiên của văn bản.
          </p>
        </PopoverContent>
      </PopoverRoot>
    </div>
  );
}
