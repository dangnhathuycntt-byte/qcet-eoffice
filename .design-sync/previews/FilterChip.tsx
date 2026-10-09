import React from "react";
import { FilterChip } from "qcet-eoffice";

export function Default() {
  return (
    <div style={{ padding: 20, display: "flex", gap: 6, flexWrap: "wrap" }}>
      <FilterChip label="Trạng thái" value="Đang thực hiện" onRemove={() => {}} />
      <FilterChip label="Hạn" value="Tuần này" onRemove={() => {}} />
      <FilterChip label="Người phụ trách" value="Nguyễn Văn An" />
    </div>
  );
}
