/** Tệp CSV mở được bằng Excel (có BOM để giữ tiếng Việt), dùng cho nút "Xuất Excel" của các trang danh sách. */

/** Ô CSV: bọc ngoặc kép, nhân đôi ngoặc kép bên trong; chặn công thức Excel ở đầu ô (=, @, +/- không theo sau là số). */
export function csvCell(value: string): string {
  const safe = /^[=@\t\r]/.test(value) || /^[+-](?!\d)/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsv(rows: ReadonlyArray<ReadonlyArray<string>>): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

/** Tải `csv` về máy với tên `fileName`. */
export function downloadCsv(fileName: string, csv: string): void {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
