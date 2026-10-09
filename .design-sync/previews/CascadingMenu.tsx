import React from "react";
import { CascadingMenu, Button } from "qcet-eoffice";
import { FileText, Download, Share2, Trash2, FolderPlus, Clock } from "lucide-react";

const items = [
  {
    id: "share",
    label: "Chia sẻ...",
    icon: <Share2 />,
    items: [
      { id: "share-unit", label: "Với toàn bộ Khoa/Phòng" },
      { id: "share-bgh", label: "Với Ban Giám hiệu" },
      { id: "share-link", label: "Sao chép liên kết nội bộ", shortcut: "⌘C" },
    ],
  },
  {
    id: "export",
    label: "Xuất dữ liệu",
    icon: <Download />,
    items: [
      { id: "export-pdf", label: "Tệp PDF (.pdf)", shortcut: "⇧⌘P" },
      { id: "export-docx", label: "Văn bản Word (.docx)" },
      { id: "export-xlsx", label: "Bảng tính Excel (.xlsx)" },
    ],
  },
  {
    id: "move",
    label: "Chuyển vào thư mục",
    icon: <FolderPlus />,
    items: [
      { id: "folder-hk1", label: "Hồ sơ Học kỳ I 2026-2027" },
      { id: "folder-vanban", label: "Sổ văn bản chỉ đạo" },
      { id: "folder-tuyensinh", label: "Hồ sơ Tuyển sinh 2026" },
    ],
  },
  { id: "history", label: "Lịch sử chỉnh sửa", icon: <Clock /> },
  { id: "sep", label: "-", separator: true },
  { id: "delete", label: "Xóa tài liệu", icon: <Trash2 />, destructive: true },
];

export function Default() {
  return (
    <div style={{ padding: 24, width: 420 }}>
      <CascadingMenu
        trigger={<Button variant="secondary">Thao tác tài liệu ▾</Button>}
        items={items}
      />
    </div>
  );
}
