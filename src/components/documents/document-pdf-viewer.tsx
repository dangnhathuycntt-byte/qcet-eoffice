"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Download, FileQuestion } from "lucide-react";
import { FileTypeIcon } from "./file-type-icon";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DocumentViewerRail } from "./document-viewer-rail";
import type { PdfCanvasController, PdfPosition } from "./pdf-document-canvas";
import { isSafeUrl, toServedFileUrl } from "@/lib/url-utils";
import { describeFileFormat, getPreviewKind } from "@/lib/documents/file-viewer-state";

// pdf.js cần API trình duyệt: chỉ nạp ở client, tách chunk riêng
const PdfDocumentCanvas = dynamic(() => import("./pdf-document-canvas"), {
  ssr: false,
  loading: () => <p role="status" className="py-10 text-center text-xs text-muted-foreground">Đang tải trình xem tệp…</p>,
});

// docx-preview (~1 MB kèm jszip) chỉ nạp khi mở tệp Word
const DocxDocumentCanvas = dynamic(() => import("./docx-document-canvas"), {
  ssr: false,
  loading: () => <p role="status" className="py-10 text-center text-xs text-muted-foreground">Đang tải trình xem tệp…</p>,
});

export interface DocumentPdfViewerProps {
  fileUrl?: string | null;
  fileName?: string;
  mimeType?: string;
  className?: string;
  onDownload?: () => void;
  /**
   * Layout `flow`: dự phòng khi thiết bị không hỗ trợ Fullscreen API (ví dụ iPhone Safari).
   * Có Fullscreen API thì viewer tự phóng to đúng phần tử của mình, không đổi tệp/zoom/trang.
   */
  onFullscreen?: () => void;
  /** Nhóm bổ sung cuối rail (ví dụ mở panel thông tin ở Full Page). */
  railExtra?: React.ReactNode;
  /** Vị trí đọc khôi phục khi mở tệp, và callback khi vị trí đổi. */
  initialPosition?: PdfPosition;
  onPositionChange?: (position: PdfPosition) => void;
  /** Nhóm tệp đặt cuối rail (xem `DocumentFilesRail`). */
  railFiles?: React.ReactNode;
  /** Thu phóng do cha giữ (để nhớ riêng từng tệp). Bỏ trống thì tự quản. */
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  /** Gọi khi biết số trang của tệp PDF đang xem. */
  onPageCount?: (count: number) => void;
  /** Thuộc tính cho vùng xem (ví dụ role="tabpanel" khi toolbar chứa thanh chuyển tệp). */
  viewportProps?: React.HTMLAttributes<HTMLDivElement>;
  /** Thao tác thêm khi tệp không xem trước được (ví dụ chuyển sang tệp PDF khác của văn bản). */
  unsupportedAction?: React.ReactNode;
}

export function DocumentPdfViewer({
  fileUrl: rawFileUrl,
  fileName = "document.pdf",
  mimeType = "application/pdf",
  className = "",
  onDownload,
  onFullscreen,
  railExtra,
  initialPosition,
  onPositionChange,
  railFiles,
  zoom,
  onZoomChange,
  onPageCount,
  viewportProps,
  unsupportedAction,
}: DocumentPdfViewerProps) {
  const fileUrl = toServedFileUrl(rawFileUrl);
  const [localZoom, setLocalZoom] = React.useState<number>(100);
  const zoomLevel = zoom ?? localZoom;
  const setZoomLevel = (value: number) => (onZoomChange ? onZoomChange(value) : setLocalZoom(value));

  const handleDefaultDownload = () => {
    if (onDownload) {
      onDownload();
      return;
    }
    if (fileUrl) {
      const link = document.createElement("a");
      link.href = fileUrl;
      link.download = fileName;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const isSafe = React.useMemo(() => isSafeUrl(fileUrl), [fileUrl]);
  const kind = getPreviewKind(mimeType, fileName);
  const [pageCount, setPageCount] = React.useState<number | null>(null);
  // Đổi tệp thì số trang cũ không còn đúng
  React.useEffect(() => setPageCount(null), [fileUrl]);
  const handlePageCount = React.useCallback(
    (count: number) => {
      setPageCount(count);
      onPageCount?.(count);
    },
    [onPageCount],
  );

  const rootRef = React.useRef<HTMLDivElement>(null);
  const controllerRef = React.useRef<PdfCanvasController | null>(null);
  const [position, setPosition] = React.useState<PdfPosition>({ page: initialPosition?.page ?? 1, ratio: 0 });
  React.useEffect(() => setPosition({ page: initialPosition?.page ?? 1, ratio: 0 }), [fileUrl]); // eslint-disable-line react-hooks/exhaustive-deps
  const handlePosition = React.useCallback(
    (next: PdfPosition) => {
      setPosition(next);
      onPositionChange?.(next);
    },
    [onPositionChange],
  );

  // Toàn màn hình bằng Fullscreen API trên chính phần tử viewer: không remount nên giữ nguyên tệp/zoom/trang
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  React.useEffect(() => {
    const sync = () => setIsFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const toggleFullscreen = React.useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen?.();
    } else if (document.fullscreenEnabled && root.requestFullscreen) {
      void root.requestFullscreen().catch(() => onFullscreen?.());
    } else {
      onFullscreen?.();
    }
  }, [onFullscreen]);
  const canFullscreen = Boolean(onFullscreen) || (typeof document !== "undefined" && document.fullscreenEnabled);

  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchTotal, setSearchTotal] = React.useState(0);
  const [searchNoText, setSearchNoText] = React.useState(false);
  const handleSearchTotal = React.useCallback((total: number, noText?: boolean) => {
    setSearchTotal(total);
    setSearchNoText(Boolean(noText));
  }, []);
  const [activeMatch, setActiveMatch] = React.useState(0);
  const handleSearchQuery = React.useCallback((value: string) => {
    setSearchQuery(value);
    setActiveMatch(0);
  }, []);
  // Đổi tệp thì từ khóa và kết quả của tệp cũ không còn đúng
  React.useEffect(() => {
    setSearchQuery("");
    setSearchTotal(0);
    setSearchNoText(false);
    setActiveMatch(0);
  }, [fileUrl]);

  if (!fileUrl || !isSafe) {
    return (
      <EmptyState
        density="compact"
        icon={<FileQuestion strokeWidth={1.5} />}
        title={!fileUrl ? "Chưa có bản scan PDF" : "Đường dẫn tệp không an toàn hoặc không hợp lệ"}
        description={
          !fileUrl
            ? "Văn bản này hiện chưa được số hóa hoặc chưa tải lên tệp PDF scan có dấu đỏ lưu trữ."
            : "Chỉ hỗ trợ giao thức HTTP, HTTPS hoặc Blob an toàn."
        }
        className={`justify-center bg-muted/20 rounded-lg border border-dashed border-border min-h-[420px] ${className}`}
      />
    );
  }

  const content =
    kind === "pdf" ? (
      <PdfDocumentCanvas
        key={fileUrl}
        fileUrl={fileUrl}
        zoom={zoomLevel / 100}
        onPageCount={handlePageCount}
        searchQuery={searchQuery}
        activeMatch={activeMatch}
        onSearchTotal={handleSearchTotal}
        initialPosition={initialPosition ?? { page: 1, ratio: 0 }}
        onPositionChange={handlePosition}
        controllerRef={controllerRef}
      />
    ) : kind === "docx" ? (
      <DocxDocumentCanvas key={fileUrl} fileUrl={fileUrl} zoom={zoomLevel / 100} />
    ) : kind === "image" ? (
      // eslint-disable-next-line @next/next/no-img-element -- tệp nội bộ có xác thực, không qua next/image
      <img
        src={fileUrl}
        alt={fileName}
        className="mx-auto rounded-sm bg-card shadow-xs"
        style={{ width: `${zoomLevel}%`, maxWidth: "none" }}
      />
    ) : (
      // Không xem trước được: nêu định dạng, lý do và cách khác; công cụ xem (thu phóng, trang, tìm) không áp dụng nên ẩn
      <div role="status" className="flex flex-col items-center gap-1 px-4 py-6 text-center" data-slot="file-unsupported">
        <FileTypeIcon fileName={fileName} mimeType={mimeType} className="size-6" />
        <p className="pt-1 text-compact text-foreground">{describeFileFormat(fileName)} chưa xem trước được trong trình duyệt</p>
        <p className="text-xs text-muted-foreground">Tải về để mở bằng ứng dụng trên máy.</p>
        <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
          <Button variant="outline" size="sm" onClick={handleDefaultDownload}>
            <Download strokeWidth={1.5} />
            Tải về
          </Button>
          {unsupportedAction}
        </div>
      </div>
    );

  return (
      <div
        ref={rootRef}
        className={`flex min-h-0 items-stretch bg-muted/50 [&:fullscreen]:h-full [&:fullscreen]:overflow-y-auto [&:fullscreen]:bg-background ${className}`}
        data-slot="document-file-viewer"
      >
        <div {...viewportProps} data-pdf-no-scroll="" className="min-w-0 flex-1 overflow-x-auto p-2 @lg/doc:p-3">
          {content}
        </div>
        <DocumentViewerRail
          fileUrl={fileUrl}
          fileName={fileName}
          kind={kind}
          zoom={zoomLevel}
          onZoomChange={setZoomLevel}
          search={{ query: searchQuery, onQueryChange: handleSearchQuery, total: searchTotal, active: activeMatch, onActiveChange: setActiveMatch, noText: searchNoText }}
          pages={pageCount ? { current: position.page, total: pageCount, onGoto: (page) => controllerRef.current?.scrollToPage(page, 0) } : undefined}
          fullscreen={isFullscreen}
          onFullscreen={canFullscreen ? toggleFullscreen : undefined}
          onDownload={handleDefaultDownload}
          files={railFiles}
          extra={railExtra}
        />
      </div>
    );
}
