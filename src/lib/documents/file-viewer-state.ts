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

/** Tệp đang xem: id được yêu cầu nếu tồn tại, ngược lại tệp đầu tiên; rỗng khi không có tệp. */
export function resolveActiveFileId(files: Array<{ id: string }>, requestedId?: string | null): string {
  if (requestedId && files.some((file) => file.id === requestedId)) return requestedId;
  return files[0]?.id ?? "";
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

/** Danh sách tệp ở Quick View: mở khi ≤ 5 tệp, thu gọn khi nhiều hơn; lựa chọn của người dùng được ưu tiên (D15). */
export const FILES_LIST_AUTO_OPEN_MAX = 5;
export type FilesListPreference = "open" | "closed";

export function resolveFilesListOpen(count: number, preference: FilesListPreference | null | undefined): boolean {
  if (preference === "open") return true;
  if (preference === "closed") return false;
  return count <= FILES_LIST_AUTO_OPEN_MAX;
}

export function parseFilesListPreference(raw: string | null | undefined): FilesListPreference | null {
  return raw === "open" || raw === "closed" ? raw : null;
}
