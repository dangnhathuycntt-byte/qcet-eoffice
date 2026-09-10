"use client";

import * as React from "react";
import {
  FileText,
  Download,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  FileQuestion,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface DocumentPdfViewerProps {
  fileUrl?: string | null;
  fileName?: string;
  fileSize?: number | string;
  mimeType?: string;
  className?: string;
  onDownload?: () => void;
}

function formatFileSize(bytes?: number | string): string {
  if (bytes === undefined || bytes === null || bytes === "") return "";
  if (typeof bytes === "string") {
    if (isNaN(Number(bytes))) return bytes;
    bytes = Number(bytes);
  }
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function DocumentPdfViewer({
  fileUrl,
  fileName = "document.pdf",
  fileSize,
  mimeType = "application/pdf",
  className = "",
  onDownload,
}: DocumentPdfViewerProps) {
  const [zoomLevel, setZoomLevel] = React.useState<number>(100);

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 15, 200));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 15, 50));
  };

  const handleZoomReset = () => {
    setZoomLevel(100);
  };

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

  const formattedSize = formatFileSize(fileSize);

  if (!fileUrl) {
    return (
      <div
        className={`flex flex-col items-center justify-center p-8 text-center bg-muted/20 rounded-2xl border border-dashed border-border/80 min-h-[420px] ${className}`}
      >
        <div className="p-4 rounded-2xl bg-muted/60 text-muted-foreground mb-3">
          <FileQuestion className="size-8" strokeWidth={1.5} />
        </div>
        <h4 className="text-sm font-semibold text-foreground mb-1">
          Chưa có bản scan PDF
        </h4>
        <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
          Văn bản này hiện chưa được số hóa hoặc chưa tải lên tệp PDF scan có dấu đỏ lưu trữ.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col bg-card rounded-2xl border border-border/70 overflow-hidden shadow-xs h-full min-h-[500px] ${className}`}
    >
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-muted/30 border-b border-border/60 gap-2 flex-wrap sm:flex-nowrap">
        {/* Document Title & File Info */}
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <div className="p-1.5 rounded-lg bg-red-500/10 text-red-600 shrink-0">
            <FileText className="size-4" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <p
              className="text-xs font-semibold text-foreground truncate max-w-[180px] sm:max-w-[240px]"
              title={fileName}
            >
              {fileName}
            </p>
            {formattedSize && (
              <span className="text-xs font-mono text-muted-foreground tabular-nums">
                {formattedSize}
              </span>
            )}
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-1 shrink-0 ml-auto">
          {/* Zoom Controls */}
          <div className="flex items-center bg-background rounded-lg border border-border/60 p-0.5">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 50}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/80 disabled:opacity-40 transition-colors cursor-pointer"
              title="Thu nhỏ"
              aria-label="Thu nhỏ"
            >
              <ZoomOut className="size-3.5" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={handleZoomReset}
              className="px-1.5 py-0.5 text-xs font-mono font-medium text-foreground hover:bg-muted/80 rounded transition-colors tabular-nums"
              title="Đặt lại 100%"
            >
              {zoomLevel}%
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 200}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/80 disabled:opacity-40 transition-colors cursor-pointer"
              title="Phóng to"
              aria-label="Phóng to"
            >
              <ZoomIn className="size-3.5" strokeWidth={1.5} />
            </button>
          </div>

          {/* Open in New Tab */}
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer inline-flex items-center"
            title="Mở trong tab mới"
            aria-label="Mở trong tab mới"
          >
            <ExternalLink className="size-3.5" strokeWidth={1.5} />
          </a>

          {/* Download Action */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDefaultDownload}
            className="h-7 px-2.5 text-xs rounded-lg gap-1 font-medium"
            title="Tải về tệp PDF"
          >
            <Download className="size-3.5" strokeWidth={1.5} />
            <span className="hidden sm:inline">Tải về</span>
          </Button>
        </div>
      </div>

      {/* PDF Viewport */}
      <div className="relative flex-1 bg-zinc-100 overflow-auto flex items-center justify-center p-2 min-h-[440px]">
        <div
          className="w-full h-full flex flex-col transition-transform duration-150 origin-top"
          style={{ transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : undefined }}
        >
          <iframe
            src={`${fileUrl}#toolbar=0&navpanes=0`}
            title={fileName}
            className="w-full h-full min-h-[440px] flex-1 rounded-lg border border-border/40 bg-background shadow-xs"
          >
            <object
              data={fileUrl}
              type={mimeType}
              className="w-full h-full min-h-[440px]"
            >
              <div className="flex flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground h-full space-y-2">
                <p>Trình duyệt không hỗ trợ xem trước trực tiếp.</p>
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary font-semibold hover:underline inline-flex items-center gap-1"
                >
                  <ExternalLink className="size-3.5" strokeWidth={1.5} />
                  <span>Mở xem trong tab mới</span>
                </a>
              </div>
            </object>
          </iframe>
        </div>
      </div>
    </div>
  );
}
