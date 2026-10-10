/** Trạng thái đọc từng tệp trong trình xem nhiều tệp (thuần, có test). */

export interface FileViewState {
  zoom: number;
  /** Trang đang đọc (1-based). */
  page: number;
  /** Phần của trang đã cuộn qua (0..1). */
  ratio: number;
  /** Số trang, biết sau khi tệp được mở lần đầu. */
  pageCount?: number;
}

export const ZOOM_MIN = 50;
export const ZOOM_MAX = 200;
export const ZOOM_STEP = 15;
export const ZOOM_DEFAULT = 100;
/** Số tệp tối đa hiển thị dạng vạch trên rail; nhiều hơn chỉ còn nút "Tệp N". */
export const MAX_FILES_AS_TICKS = 8;

export const DEFAULT_FILE_STATE: FileViewState = { zoom: ZOOM_DEFAULT, page: 1, ratio: 0 };

export const clampZoom = (zoom: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(zoom)));

export type FileStates = Record<string, FileViewState>;

export function getFileState(states: FileStates, id: string): FileViewState {
  return states[id] ?? DEFAULT_FILE_STATE;
}

export function patchFileState(states: FileStates, id: string, patch: Partial<FileViewState>): FileStates {
  const current = getFileState(states, id);
  const next = { ...current, ...patch };
  if (
    next.zoom === current.zoom &&
    next.page === current.page &&
    next.ratio === current.ratio &&
    next.pageCount === current.pageCount &&
    states[id]
  ) {
    return states;
  }
  return { ...states, [id]: next };
}

export type FilePreviewKind = "pdf" | "image" | "docx" | "other";

/** Loại xem trước trong trình duyệt, theo MIME rồi tới đuôi tệp. */
export function getPreviewKind(mimeType: string | null | undefined, fileName: string): FilePreviewKind {
  const mime = (mimeType || "").toLowerCase();
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) return "image";
  // Chỉ Word mới (.docx, Office Open XML); .doc nhị phân cũ không dựng được trong trình duyệt
  if (ext === "docx" || mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  return "other";
}

const FORMAT_NAMES: Record<string, string> = {
  doc: "Word",
  docx: "Word",
  xls: "Excel",
  xlsx: "Excel",
  ppt: "PowerPoint",
  pptx: "PowerPoint",
};

/** Tên định dạng cho thông báo không xem trước được: "Tệp Word (.docx)", "Tệp .zip", "Tệp". */
export function describeFileFormat(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  const ext = dot > 0 ? fileName.slice(dot + 1).toLowerCase() : "";
  if (!ext) return "Tệp";
  return FORMAT_NAMES[ext] ? `Tệp ${FORMAT_NAMES[ext]} (.${ext})` : `Tệp .${ext}`;
}

export type FileFamily = "pdf" | "word" | "excel" | "slide" | "image" | "archive" | "other";

const FAMILY_BY_EXT: Record<string, FileFamily> = {
  pdf: "pdf",
  doc: "word",
  docx: "word",
  odt: "word",
  rtf: "word",
  xls: "excel",
  xlsx: "excel",
  ods: "excel",
  csv: "excel",
  ppt: "slide",
  pptx: "slide",
  odp: "slide",
  zip: "archive",
  rar: "archive",
  "7z": "archive",
};

/** Nhóm định dạng cho icon loại tệp: theo đuôi tệp, thiếu đuôi thì theo MIME. */
export function getFileFamily(fileName: string, mimeType?: string | null): FileFamily {
  const dot = fileName.lastIndexOf(".");
  const ext = dot > 0 ? fileName.slice(dot + 1).toLowerCase() : "";
  if (FAMILY_BY_EXT[ext]) return FAMILY_BY_EXT[ext];
  const kind = getPreviewKind(mimeType, fileName);
  if (kind === "pdf") return "pdf";
  if (kind === "image") return "image";
  const mime = (mimeType || "").toLowerCase();
  if (mime.includes("word")) return "word";
  if (mime.includes("spreadsheet") || mime.includes("excel")) return "excel";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "slide";
  if (mime.includes("zip") || mime.includes("compressed")) return "archive";
  return "other";
}

type PreviewableFile = { id: string; name?: string | null; mimeType?: string | null };

const isPreviewable = (file: PreviewableFile) => getPreviewKind(file.mimeType, file.name ?? "") !== "other";

/**
 * Tệp đang xem: id được yêu cầu nếu tồn tại. Không yêu cầu (hoặc id sai) thì mở tệp đầu tiên,
 * trừ khi tệp đầu không xem trước được mà còn tệp PDF/ảnh: khi đó mở tệp xem được đầu tiên. Rỗng khi không có tệp.
 */
export function resolveActiveFileId(files: PreviewableFile[], requestedId?: string | null): string {
  if (requestedId && files.some((file) => file.id === requestedId)) return requestedId;
  const first = files[0];
  if (!first) return "";
  if (isPreviewable(first)) return first.id;
  return files.find(isPreviewable)?.id ?? first.id;
}

/** Tệp xem trước được đầu tiên, khác tệp đang xem (gợi ý khi tệp đang xem không xem trước được). */
export function findPreviewableAlternative<T extends PreviewableFile>(files: T[], activeId: string): T | undefined {
  return files.find((file) => file.id !== activeId && isPreviewable(file));
}

/** Bản gốc đứng đầu, giữ nguyên thứ tự còn lại (sắp ổn định). */
export function sortDocumentFiles<T extends { isOriginal?: boolean | null }>(files: T[]): T[] {
  return files
    .map((file, index) => ({ file, index }))
    .sort((a, b) => Number(Boolean(b.file.isOriginal)) - Number(Boolean(a.file.isOriginal)) || a.index - b.index)
    .map(({ file }) => file);
}

export const formatPageDetail = (pageCount?: number | null, size?: string) =>
  [pageCount ? `${pageCount} trang` : null, size || null].filter(Boolean).join(" · ");
