import React from "react";
import { Menubar } from "qcet-eoffice";
import { FilePlus, FolderOpen, Save, Printer, Download, UserCheck, RefreshCw } from "lucide-react";

const sections = [
  {
    id: "file",
    label: "Tệp",
    items: [
      { id: "new", label: "Tạo văn bản mới", icon: <FilePlus />, shortcut: "⌘N" },
      { id: "open", label: "Mở hồ sơ lưu trữ...", icon: <FolderOpen />, shortcut: "⌘O" },
      { id: "sep1", label: "-", separator: true },
      { id: "save", label: "Lưu bản nháp", icon: <Save />, shortcut: "⌘S" },
      {
        id: "export",
        label: "Xuất tệp...",
        icon: <Download />,
        items: [
          { id: "pdf", label: "Định dạng PDF (.pdf)" },
          { id: "docx", label: "Định dạng Word (.docx)" },
        ],
      },
      { id: "sep2", label: "-", separator: true },
      { id: "print", label: "In trình ký (NĐ 30)", icon: <Printer />, shortcut: "⌘P" },
    ],
  },
  {
    id: "task",
    label: "Nhiệm vụ",
    items: [
      { id: "assign", label: "Giao việc mới...", shortcut: "⌘T" },
      { id: "review", label: "Chuyển BGH duyệt", icon: <UserCheck /> },
      { id: "sync", label: "Đồng bộ tiến độ", icon: <RefreshCw />, shortcut: "⌘R" },
    ],
  },
  {
    id: "view",
    label: "Xem",
    items: [
      { id: "table", label: "Dạng bảng chi tiết", checked: true },
      { id: "kanban", label: "Dạng bảng Kanban" },
      { id: "timeline", label: "Dạng dòng thời gian" },
    ],
  },
];

export function Default() {
  return (
    <div style={{ padding: 20, width: 500 }}>
      <Menubar sections={sections} />
    </div>
  );
}
