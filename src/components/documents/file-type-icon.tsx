import * as React from "react";
import { cn } from "@/lib/utils";
import { getFileFamily, type FileFamily } from "@/lib/documents/file-viewer-state";

const FILL: Record<FileFamily, string> = {
  pdf: "text-file-pdf",
  word: "text-file-word",
  excel: "text-file-excel",
  slide: "text-file-slide",
  image: "text-file-image",
  archive: "text-file-archive",
  other: "text-muted-foreground/60",
};

const LABEL: Partial<Record<FileFamily, { text: string; size: number }>> = {
  pdf: { text: "PDF", size: 5.6 },
  word: { text: "W", size: 7.5 },
  excel: { text: "X", size: 7.5 },
  slide: { text: "P", size: 7.5 },
};

/**
 * Icon loại tệp: tờ giấy gập góc tô màu nhận diện của định dạng (PDF, Word, Excel, PowerPoint, ảnh, tệp nén),
 * nhãn trắng. Chỉ để nhận ra loại tệp khi lướt danh sách; tên tệp bên cạnh đã có đuôi nên icon ẩn với trình đọc màn hình.
 * Không dùng màu icon để báo trạng thái (lỗi, chưa ký…).
 */
export function FileTypeIcon({ fileName, mimeType, className }: { fileName: string; mimeType?: string | null; className?: string }) {
  const family = getFileFamily(fileName, mimeType);
  const label = LABEL[family];
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
      data-file-family={family}
      className={cn("size-5 shrink-0", FILL[family], className)}
    >
      <path d="M5 1.5h7.25L17 6.25V17a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17V3A1.5 1.5 0 0 1 5 1.5Z" fill="currentColor" />
      <path d="M12.25 1.5v3.25a1.5 1.5 0 0 0 1.5 1.5H17Z" fill="#fff" fillOpacity={0.4} />
      {label ? (
        <text
          x="10.25"
          y="15"
          textAnchor="middle"
          fill="#fff"
          fontSize={label.size}
          fontWeight={700}
          letterSpacing={label.text.length > 1 ? -0.1 : 0}
        >
          {label.text}
        </text>
      ) : family === "image" ? (
        <>
          <path d="M6 15.5l3-3.75 2 2.25 1.5-1.75 2.5 3.25Z" fill="#fff" />
          <circle cx="8" cy="9" r="1.25" fill="#fff" />
        </>
      ) : family === "archive" ? (
        <path d="M9.5 3h1.5v1.5H9.5Zm1.5 1.5h1.5V6H11ZM9.5 6h1.5v1.5H9.5Zm1.5 1.5h1.5V9H11ZM9.5 9H12.5v3.5H9.5Z" fill="#fff" fillOpacity={0.9} />
      ) : (
        <path d="M6.5 10h7M6.5 12.5h7M6.5 15h4.5" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" />
      )}
    </svg>
  );
}
