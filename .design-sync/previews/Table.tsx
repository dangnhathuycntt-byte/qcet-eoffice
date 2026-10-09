import React from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge } from "qcet-eoffice";

const rows = [
  ["Báo cáo giảng dạy học kỳ I", "Khoa CNTT", "15/10/2026", "Đang thực hiện"],
  ["Rà soát chương trình đào tạo", "Phòng Đào tạo", "30/10/2026", "Chờ duyệt"],
  ["Kiểm kê tài sản phòng thí nghiệm", "Khoa ĐTVT", "05/11/2026", "Mới giao"],
];

export function Default() {
  return (
    <div style={{ width: 640, padding: 20 }}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead sortable sort="asc">Nhiệm vụ</TableHead>
            <TableHead>Đơn vị</TableHead>
            <TableHead sortable sort={null}>Hạn</TableHead>
            <TableHead>Trạng thái</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r[0]}>
              <TableCell className="font-medium">{r[0]}</TableCell>
              <TableCell>{r[1]}</TableCell>
              <TableCell>{r[2]}</TableCell>
              <TableCell><Badge variant="secondary">{r[3]}</Badge></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
