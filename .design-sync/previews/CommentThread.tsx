import React from "react";
import { CommentThread } from "qcet-eoffice";

const comments = [
  {
    id: "1",
    author: {
      name: "PGS. TS. Nguyễn Văn Nam",
      title: "Hiệu trưởng",
      isLeader: true,
    },
    content: "Đề nghị Phòng Đào tạo rà soát lại chỉ tiêu tuyển sinh ngành CNTT và An to��n thông tin trước ngày 10/10.",
    createdAt: "2026-10-02T15:30:00",
    attachments: [
      { id: "att-1", name: "Ket-luan-cuoc-hop-BGH-so-28.pdf", size: "1,2 MB" },
    ],
  },
  {
    id: "2",
    author: {
      name: "Trần Thị Lan",
      title: "Trưởng phòng QLĐT",
    },
    content: "Phòng Đào tạo đã làm việc với Khoa CNTT và thống nhất tăng chỉ tiêu thêm 50 sinh viên. Bản điều chỉnh chi tiết đính kèm.",
    createdAt: "2026-10-03T08:45:00",
    attachments: [
      { id: "att-2", name: "Phu-luc-chi-tieu-bo-sung-CNTT.xlsx", size: "640 KB" },
    ],
  },
];

export function YKienChiDao() {
  return (
    <div style={{ width: 480, padding: 20 }}>
      <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Ý KIẾN CHỈ ĐẠO & TRAO ĐỔI NỘI BỘ</p>
      <CommentThread
        comments={comments}
        onAddComment={(text) => console.log("New comment:", text)}
        currentUser={{ name: "PGS. TS. Nguyễn Văn Nam" }}
      />
    </div>
  );
}
