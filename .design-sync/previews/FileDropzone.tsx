import React from "react";
import { FileDropzone, FileTile, FileList } from "qcet-eoffice";

const sampleFiles = [
  { id: "1", name: "Bao-cao-giang-day-HK1.pdf", size: "2,4 MB" },
  { id: "2", name: "Ke-hoach-tuyen-sinh-2026.docx", size: "1,1 MB" },
  { id: "3", name: "Danh-sach-sinh-vien-khoa-CNTT.xlsx", size: "860 KB" },
];

export function Dropzone() {
  return (
    <div style={{ width: 420, padding: 20 }}>
      <FileDropzone onFiles={() => {}} hint="PDF, DOCX hoặc XLSX, tối đa 10 MB mỗi tệp" />
    </div>
  );
}

export function DanhSachTep() {
  return (
    <div style={{ width: 420, padding: 20 }}>
      <p style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)", marginBottom: 8 }}>
        TỆP ĐÍNH KÈM (HOVER GẠCH CHÂN, KHÔNG BO THẺ)
      </p>
      <FileList
        files={sampleFiles}
        onDownload={(id) => console.log("Download", id)}
        onRemove={(id) => console.log("Remove", id)}
      />
    </div>
  );
}
