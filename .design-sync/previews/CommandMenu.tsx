import React from "react";
import { CommandMenu, Button, type CommandItem } from "qcet-eoffice";

const mockItems: CommandItem[] = [
  {
    id: "task-1",
    title: "Tổng hợp báo cáo tháng 9",
    group: "Nhiệm vụ",
    badge: "NV-2026-09-129",
  },
  {
    id: "task-2",
    title: "Báo cáo tuyển sinh 2026",
    group: "Nhiệm vụ",
    badge: "NV-2026-08-071",
  },
  {
    id: "doc-1",
    title: "Báo cáo tình hình tuyển sinh các trường CĐ, TC",
    group: "Văn bản",
    badge: "Đến 0412",
  },
  {
    id: "doc-2",
    title: "Kế hoạch tổ chức hội nghị viên chức năm 2026",
    group: "Văn bản",
    badge: "Đi 124/KH-CĐKTCNQN",
  },
  {
    id: "act-create",
    title: "Tạo nhiệm vụ mới",
    group: "Thao tác",
    shortcut: "C",
  },
  {
    id: "act-doc",
    title: "Tiếp nhận văn bản đến",
    group: "Thao tác",
    shortcut: "N",
  },
];

export function Default() {
  const [open, setOpen] = React.useState(true);

  return (
    <div style={{ height: 420, padding: 20 }}>
      <Button onClick={() => setOpen(true)}>Mở tìm nhanh (⌘K)</Button>
      <CommandMenu
        open={open}
        onOpenChange={setOpen}
        items={mockItems}
      />
    </div>
  );
}
