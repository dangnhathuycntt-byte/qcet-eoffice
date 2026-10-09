"use client";

import * as React from "react";
import { DocumentPdfViewer } from "./document-detail-parts";
import { DocumentFilesRail, FilesMenu, type RailFile } from "./document-viewer-rail";
import {
  MAX_FILES_AS_TICKS,
  clampZoom,
  formatPageDetail,
  getFileState,
  patchFileState,
  resolveActiveFileId,
  type FileStates,
} from "@/lib/documents/file-viewer-state";

function formatSize(size?: number | string | null): string {
  if (size === undefined || size === null || size === "") return "";
  const bytes = Number(size);
  if (Number.isNaN(bytes)) return String(size);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export interface DocumentFile {
  id: string;
  name: string;
  url?: string | null;
  /** Dung lượng tính bằng byte. */
  sizeBytes?: number | null;
  /** Dung lượng đã định dạng sẵn, dùng khi không có số byte. */
  sizeLabel?: string | null;
  mimeType?: string | null;
}

export interface DocumentFileViewerProps {
  files: DocumentFile[];
  /** Tệp đang xem do cha giữ (ví dụ theo `?file=`). Bỏ trống thì viewer tự quản. */
  activeFileId?: string | null;
  onActiveFileChange?: (id: string) => void;
  /** Dự phòng khi thiết bị không có Fullscreen API: thường là mở Full Page. */
  onFullscreen?: (file: DocumentFile) => void;
  /** Nhóm bổ sung cuối rail (Full Page: mở panel thông tin). */
  railExtra?: React.ReactNode;
  /**
   * Khóa lưu thu phóng/trang đã đọc của từng tệp vào `sessionStorage` (Full Page nhớ qua lần tải lại).
   * Bỏ trống thì chỉ nhớ trong lần mở này.
   */
  persistKey?: string;
  className?: string;
}

const STORAGE_PREFIX = "qcet_doc_view:";

function loadStates(key?: string): FileStates {
  if (!key) return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
    const parsed = raw ? (JSON.parse(raw) as FileStates) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveStates(key: string | undefined, states: FileStates) {
  if (!key) return;
  try {
    sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(states));
  } catch {
    // Không có sessionStorage (chế độ riêng tư, bị chặn): bỏ qua, viewer vẫn hoạt động
  }
}

/**
 * Xem các tệp đính kèm của một văn bản. Mỗi tệp độc lập (không giả định tệp chính/phụ lục).
 * - Công cụ PDF, điều hướng trang và chuyển tệp nằm ở rail dọc bên phải khung xem.
 * - Nhiều tệp: 2–8 tệp có thêm vạch; nút "Tệp N" luôn mở danh sách đầy đủ.
 * Chỉ dựng đúng một PDF đang chọn; tệp khác chỉ được tải khi chọn.
 * Thu phóng và trang đang đọc được nhớ riêng cho từng tệp.
 */
export function DocumentFileViewer({
  files,
  activeFileId,
  onActiveFileChange,
  onFullscreen,
  railExtra,
  persistKey,
  className,
}: DocumentFileViewerProps) {
  const controlled = activeFileId !== undefined;
  const [internalId, setInternalId] = React.useState(() => resolveActiveFileId(files, activeFileId));
  const activeId = resolveActiveFileId(files, controlled ? activeFileId : internalId);
  const active = files.find((file) => file.id === activeId);

  const [states, setStates] = React.useState<FileStates>(() => loadStates(persistKey));
  const statesRef = React.useRef(states);
  statesRef.current = states;
  const update = React.useCallback(
    (id: string, patch: Parameters<typeof patchFileState>[2]) => {
      setStates((prev) => {
        const next = patchFileState(prev, id, patch);
        if (next !== prev) saveStates(persistKey, next);
        return next;
      });
    },
    [persistKey],
  );

  const select = React.useCallback(
    (id: string) => {
      if (id === activeId || !files.some((file) => file.id === id)) return;
      if (!controlled) setInternalId(id);
      onActiveFileChange?.(id);
    },
    [activeId, controlled, files, onActiveFileChange],
  );

  const activeState = getFileState(states, activeId);
  // Vị trí khôi phục chỉ lấy một lần lúc chuyển tới tệp (không đổi khi đang đọc, để khỏi cuộn lại)
  const initialPosition = React.useMemo(() => {
    const saved = getFileState(statesRef.current, activeId);
    return { page: saved.page, ratio: saved.ratio };
  }, [activeId]);

  if (!active) return null;

  const multiple = files.length > 1;
  const detailOf = (file: DocumentFile) =>
    formatPageDetail(getFileState(states, file.id).pageCount, formatSize(file.sizeBytes ?? file.sizeLabel));
  const railFiles: RailFile[] = files.map((file) => ({ id: file.id, name: file.name, url: file.url, detail: detailOf(file) }));

  return (
    <>
      {/* Tên tệp đang xem: một chỗ duy nhất; công cụ và chuyển tệp nằm ở rail bên phải */}
      <p className="flex min-w-0 items-baseline gap-1.5 px-4 pb-2 text-xs text-muted-foreground @lg/doc:px-6" aria-live="polite">
        <span className="min-w-0 truncate text-compact text-foreground" title={active.name} data-slot="active-file-name">
          {active.name}
        </span>
        <span className="shrink-0 tabular-nums">{detailOf(active)}</span>
      </p>
      <div data-slot="document-file-viewer-root" data-active-file-id={active.id}>
        <DocumentPdfViewer
          fileUrl={active.url}
          fileName={active.name}
          mimeType={active.mimeType ?? undefined}
          className={className ?? "w-full"}
          zoom={activeState.zoom}
          onZoomChange={(value) => update(active.id, { zoom: clampZoom(value) })}
          onPageCount={(count) => update(active.id, { pageCount: count })}
          initialPosition={initialPosition}
          onPositionChange={(position) => update(active.id, position)}
          onFullscreen={onFullscreen ? () => onFullscreen(active) : undefined}
          railExtra={railExtra}
          railFiles={
            multiple ? (
              <>
                {files.length <= MAX_FILES_AS_TICKS ? <DocumentFilesRail files={railFiles} activeId={active.id} onSelect={select} /> : null}
                <FilesMenu files={railFiles} activeId={active.id} onSelect={select} />
              </>
            ) : undefined
          }
          viewportProps={multiple ? { role: "region", "aria-label": `Xem tệp ${active.name}` } : undefined}
        />
      </div>
    </>
  );
}
