import type { DocumentItem, DocumentType } from "@/types/document";

/**
 * Returns Appendix IV (Nghị định 30/2020/NĐ-CP) official registry column headers.
 */
export function getAppendixIVHeaders(type: DocumentType): string[] {
  if (type === "VAN_BAN_DEN" || type === "inbox") {
    return [
      "Ngày đến",
      "Số đến",
      "Tác giả",
      "Số và ký hiệu văn bản đến",
      "Ngày tháng văn bản",
      "Tên loại và trích yếu nội dung văn bản",
      "Đơn vị hoặc người nhận",
      "Ký nhận",
      "Ghi chú",
    ];
  }

  // VAN_BAN_DI or outbox or other official dispatches
  return [
    "Số và ký hiệu",
    "Ngày tháng văn bản",
    "Tên loại và trích yếu nội dung văn bản",
    "Người ký",
    "Đơn vị soạn thảo",
    "Nơi nhận",
    "Số lượng bản",
    "Đơn vị hoặc người nhận bản lưu",
    "Ký nhận",
    "Ghi chú",
  ];
}

/**
 * Formats an ISO date string or Date object to DD/MM/YYYY.
 */
export function formatDate(isoStr?: string | Date | null): string {
  if (!isoStr) return "";

  if (typeof isoStr === "string") {
    const match = isoStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
  }

  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "";

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Formats a single DocumentItem into Appendix IV row cells.
 */
export function formatDocumentRowForAppendixIV(doc: DocumentItem): (string | number)[] {
  if (doc.type === "VAN_BAN_DEN" || doc.type === "inbox") {
    return [
      formatDate(doc.registeredDate),
      doc.registrationNumber,
      doc.issuingAuthority || "",
      doc.originalNumber || "",
      formatDate(doc.issuedDate),
      doc.category ? `${doc.category}: ${doc.summary}` : doc.summary,
      doc.leadUnitName || "",
      "", // Ký nhận
      doc.notes || (doc.dueDate ? `Hạn: ${formatDate(doc.dueDate)}` : ""),
    ];
  }

  return [
    doc.originalNumber || `${doc.registrationNumber}/CĐKTCN`,
    formatDate(doc.issuedDate),
    doc.category ? `${doc.category}: ${doc.summary}` : doc.summary,
    doc.signerName || "",
    doc.leadUnitName || "",
    doc.recipientList || "",
    doc.distributedCopies ?? 1,
    "Văn thư trường",
    "", // Ký nhận
    doc.notes || "",
  ];
}

/**
 * Escapes a cell value for CSV format according to RFC 4180.
 * Double quotes are escaped as `""` and fields with commas, quotes, or newlines are enclosed in quotes.
 */
export function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates an Appendix IV CSV file content string with UTF-8 BOM.
 * Excel requires UTF-8 BOM (﻿) to properly display Vietnamese diacritics.
 */
export function generateAppendixIVCsv(
  type: DocumentType,
  _year: number,
  documents: DocumentItem[]
): string {
  const headers = getAppendixIVHeaders(type);
  const headerRow = headers.map(escapeCsvCell).join(",");
  const rows = documents.map((doc) => {
    const rowData = formatDocumentRowForAppendixIV(doc);
    return rowData.map(escapeCsvCell).join(",");
  });

  // Prepend UTF-8 BOM (﻿) for Excel Vietnamese character recognition
  return "﻿" + [headerRow, ...rows].join("\r\n");
}

/**
 * Generates a Buffer of the Appendix IV workbook for download or streaming.
 */
export function generateAppendixIVWorkbook(
  type: DocumentType,
  year: number,
  documents: DocumentItem[]
): Buffer {
  const csv = generateAppendixIVCsv(type, year, documents);
  return Buffer.from(csv, "utf-8");
}
