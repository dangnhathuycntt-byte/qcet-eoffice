import React from "react";
import { Toolbar, ToolbarGroup, ToolbarSeparator, ToolbarButton, FilterChip } from "qcet-eoffice";
import { Filter, ArrowUpDown, Download } from "lucide-react";

export function Default() {
  return (
    <div style={{ padding: 20, width: 560 }}>
      <Toolbar aria-label="Công cụ danh sách nhiệm vụ">
        <ToolbarGroup aria-label="Hiển thị">
          <ToolbarButton><Filter /> Bộ lọc</ToolbarButton>
          <ToolbarButton><ArrowUpDown /> Sắp xếp</ToolbarButton>
        </ToolbarGroup>
        <ToolbarSeparator />
        <ToolbarButton><Download /> Xuất</ToolbarButton>
      </Toolbar>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <FilterChip label="Trạng thái" value="Đang thực hiện" onRemove={() => {}} />
        <FilterChip label="Đơn vị" value="Khoa CNTT" onRemove={() => {}} />
      </div>
    </div>
  );
}
