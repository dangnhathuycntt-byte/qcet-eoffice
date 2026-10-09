import React from "react";
import { BulkActionBar } from "qcet-eoffice";
import { Send, Download, Trash2, CheckCircle } from "lucide-react";

export function Default() {
  const [selectedCount, setSelectedCount] = React.useState(3);

  return (
    <div style={{ width: 680, padding: 20, background: "var(--background)" }}>
      <BulkActionBar
        selectedCount={selectedCount}
        itemLabel="văn bản"
        totalCount={412}
        onSelectAllPages={() => alert("Chọn tất cả 412 văn bản")}
        onClearSelection={() => setSelectedCount(0)}
        actions={[
          {
            label: "Phân phối",
            icon: <Send className="size-4" />,
            onClick: () => alert("Phân phối văn bản"),
          },
          {
            label: "Xuất",
            icon: <Download className="size-4" />,
            onClick: () => alert("Xuất sổ"),
          },
          {
            label: "Xóa",
            variant: "destructive",
            icon: <Trash2 className="size-4" />,
            onClick: () => alert("Xóa các văn bản đã chọn"),
          },
        ]}
      />
    </div>
  );
}

export function TaskBulk() {
  const [selectedCount, setSelectedCount] = React.useState(2);

  return (
    <div style={{ width: 680, padding: 20, background: "var(--background)" }}>
      <BulkActionBar
        selectedCount={selectedCount}
        itemLabel="nhiệm vụ"
        onClearSelection={() => setSelectedCount(0)}
        actions={[
          {
            label: "Đổi trạng thái",
            icon: <CheckCircle className="size-4" />,
            onClick: () => alert("Đổi trạng thái"),
          },
          {
            label: "Đổi hạn…",
            onClick: () => alert("Đổi hạn"),
          },
          {
            label: "Giao lại…",
            onClick: () => alert("Giao lại"),
          },
        ]}
      />
    </div>
  );
}
