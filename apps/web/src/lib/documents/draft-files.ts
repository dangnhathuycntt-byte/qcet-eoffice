/**
 * Tệp dự thảo của hộp "Soạn văn bản đi": PDF hoặc Word, tối đa 10MB mỗi tệp. Máy chủ nhận rộng hơn (`ALLOWED_MIME_TYPES`
 * ở `apps/api/src/storage/private-files.ts`, ngưỡng 10MB ở `/api/upload`) nên hạn chế ở đây là quy ước của dự thảo,
 * không phải ràng buộc của máy chủ. Thuần túy: thuộc tính `accept` của ô chọn tệp không áp cho tệp kéo thả vào.
 */
export const DRAFT_FILE_MAX_BYTES = 10 * 1024 * 1024;
export const DRAFT_FILE_ACCEPT = ".pdf,.doc,.docx,application/pdf";

const DRAFT_FILE_EXTENSIONS = [".pdf", ".doc", ".docx"];

export interface DraftFileRejection {
  file: File;
  reason: "type" | "size";
}

const sameFile = (a: File, b: File) => a.name === b.name && a.size === b.size;

/**
 * Tách tệp mới chọn thành nhận được và bị từ chối. Tệp trùng tên và cỡ với tệp đã có (hoặc đã nhận trong cùng lượt)
 * bị bỏ qua, không tính là lỗi: chọn lại cùng tệp không thêm lần nữa.
 */
export function partitionDraftFiles(incoming: File[], existing: File[] = []): { accepted: File[]; rejected: DraftFileRejection[] } {
  const accepted: File[] = [];
  const rejected: DraftFileRejection[] = [];
  for (const file of incoming) {
    const name = file.name.toLowerCase();
    if (!DRAFT_FILE_EXTENSIONS.some((ext) => name.endsWith(ext))) rejected.push({ file, reason: "type" });
    else if (file.size > DRAFT_FILE_MAX_BYTES) rejected.push({ file, reason: "size" });
    else if (![...existing, ...accepted].some((f) => sameFile(f, file))) accepted.push(file);
  }
  return { accepted, rejected };
}

/** Câu báo lỗi cho các tệp bị từ chối (nêu tối đa hai tên, còn lại gộp số lượng); `undefined` khi không có tệp nào bị từ chối. */
export function describeDraftRejections(rejected: DraftFileRejection[]): string | undefined {
  if (rejected.length === 0) return undefined;
  const sentence = (list: DraftFileRejection[], tail: string) => {
    if (list.length === 0) return null;
    const shown = list.slice(0, 2).map((r) => `"${r.file.name}"`).join(", ");
    return `${shown}${list.length > 2 ? ` và ${list.length - 2} tệp khác` : ""} ${tail}`;
  };
  return [
    sentence(rejected.filter((r) => r.reason === "type"), "không phải PDF hoặc Word."),
    sentence(rejected.filter((r) => r.reason === "size"), "vượt quá 10MB."),
  ]
    .filter(Boolean)
    .join(" ");
}
