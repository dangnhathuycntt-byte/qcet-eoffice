import React from "react";
import { DirectoryTree, type TreeNode } from "qcet-eoffice";

const orgStructureNodes: TreeNode[] = [
  {
    id: "pdt",
    label: "Phòng Quản lý Đào tạo",
    count: 14,
    children: [
      { id: "pdt-ts", label: "Tổ Tuyển sinh", count: 6 },
      { id: "pdt-gv", label: "Tổ Giáo vụ", count: 8 },
    ],
  },
  {
    id: "ttstt",
    label: "Trung tâm Số và Truyền thông",
    count: 9,
    children: [
      { id: "ttstt-cntt", label: "Bộ phận Công nghệ thông tin", count: 5 },
      { id: "ttstt-tt", label: "Bộ phận Truyền thông", count: 4 },
    ],
  },
  {
    id: "ptchc",
    label: "Phòng Tổ chức – Hành chính",
    count: 12,
  },
  {
    id: "pkhtc",
    label: "Phòng Kế hoạch – Tài chính",
    count: 7,
  },
];

export function Default() {
  const [selectedId, setSelectedId] = React.useState("pdt-ts");

  return (
    <div style={{ width: 340, padding: 20, background: "var(--card)" }}>
      <DirectoryTree
        nodes={orgStructureNodes}
        selectedId={selectedId}
        defaultExpandedIds={["pdt", "ttstt"]}
        onSelect={(node) => setSelectedId(node.id)}
      />
    </div>
  );
}
