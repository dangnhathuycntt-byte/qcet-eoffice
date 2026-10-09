import React from "react";
import { SegmentedControl } from "qcet-eoffice";
import { Table, Kanban } from "lucide-react";

export function CachXem() {
  return (
    <div style={{ padding: 20 }}>
      <SegmentedControl
        aria-label="Cách xem nhiệm vụ"
        defaultValue="table"
        options={[
          { value: "table", label: "Bảng", icon: <Table /> },
          { value: "kanban", label: "Kanban", icon: <Kanban /> },
        ]}
      />
    </div>
  );
}

export function ThoiGian() {
  return (
    <div style={{ padding: 20 }}>
      <SegmentedControl
        aria-label="Phạm vi thời gian"
        defaultValue="week"
        options={[
          { value: "day", label: "Ngày" },
          { value: "week", label: "Tuần" },
          { value: "month", label: "Tháng" },
          { value: "year", label: "Năm", disabled: true },
        ]}
      />
    </div>
  );
}
