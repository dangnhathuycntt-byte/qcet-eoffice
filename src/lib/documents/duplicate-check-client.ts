/**
 * Phía client của cảnh báo trùng số ký hiệu (V-02): lấy danh sách văn bản trùng
 * khi server trả 409 DUPLICATE_SUSPECT và dựng câu cảnh báo.
 */

export const DUPLICATE_SUSPECT_CODE = "DUPLICATE_SUSPECT";

export interface DuplicateMatchView {
  id: string;
  registrationNumber: number;
  documentYear: number;
  originalNumber: string;
  issuingAuthority: string;
  registeredDate: string;
}

export async function fetchDuplicateMatches(
  originalNumber: string,
  issuingAuthority: string
): Promise<DuplicateMatchView[]> {
  const params = new URLSearchParams({ originalNumber, issuingAuthority });
  const res = await fetch(`/api/documents/duplicate-check?${params.toString()}`);
  if (!res.ok) return [];
  const json = await res.json().catch(() => null);
  return Array.isArray(json?.matches) ? json.matches : [];
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}

/** Câu cảnh báo nói văn bản nào đã có và làm gì tiếp. */
export function describeDuplicates(matches: DuplicateMatchView[]): string {
  const first = matches[0];
  const base = first
    ? `Đã có văn bản ${first.originalNumber} của ${first.issuingAuthority}, số đến ${first.registrationNumber}/${first.documentYear}, vào sổ ${formatDate(first.registeredDate)}.`
    : "Đã có văn bản đến cùng số ký hiệu và cơ quan ban hành.";
  const more = matches.length > 1 ? ` Còn ${matches.length - 1} văn bản trùng khác.` : "";
  return `${base}${more} Bấm lưu lần nữa nếu vẫn vào sổ.`;
}
