"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Info, PanelRightClose, PanelRightOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DocumentFileViewer, type DocumentFile } from "../document-file-viewer";
import { RailButton } from "../document-viewer-rail";

const PANEL_KEY = "qcet_document_info_panel";

export interface DocumentFullPageProps {
  docId: string;
  breadcrumb: { href: string; label: string; current: string };
  /** Tiêu đề và metadata (thường là `DocumentSummaryBlock` hoặc `DocumentTitleBlock`). */
  header: React.ReactNode;
  /** Thao tác chính của văn bản (trạng thái + nút), luôn hiển thị phía trên trình xem. */
  actions?: React.ReactNode;
  files: DocumentFile[];
  /** Thuộc tính, nhiệm vụ liên kết, luân chuyển, lịch sử: nằm trong panel mở từ rail/nút Thông tin. */
  panel: React.ReactNode;
  className?: string;
}

/**
 * Full Page chung cho mọi loại văn bản: ưu tiên đọc tệp (PDF-first). Phần đầu gọn (tiêu đề, metadata, thao tác),
 * trình xem chiếm phần còn lại và tự cuộn, thông tin phụ ở panel 320px không modal (mặc định đóng, nhớ lựa chọn).
 * Tệp đang xem theo `?file=`; làm mới, Back/Forward và chia sẻ liên kết cho cùng kết quả.
 * Màn hẹp (<1024px): xếp dọc, panel nằm dưới trình xem.
 */
export function DocumentFullPage({ docId, breadcrumb, header, actions, files, panel, className }: DocumentFullPageProps) {
  const searchParams = useSearchParams();
  const fileParam = searchParams?.get("file") ?? null;
  const [panelOpen, setPanelOpen] = React.useState(files.length === 0);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(PANEL_KEY);
      if (stored === "open") setPanelOpen(true);
      else if (stored === "closed") setPanelOpen(false);
    } catch {
      // Không đọc được lựa chọn cũ: dùng mặc định
    }
  }, []);
  const togglePanel = React.useCallback(() => {
    setPanelOpen((open) => {
      try {
        localStorage.setItem(PANEL_KEY, open ? "closed" : "open");
      } catch {
        // Không lưu được: vẫn đổi trong phiên này
      }
      return !open;
    });
  }, []);

  const handleFileChange = React.useCallback((fileId: string) => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("file") === fileId) return;
    params.set("file", fileId);
    // Đổi tệp là replace: không làm đầy lịch sử; Next vá replaceState nên useSearchParams cập nhật
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }, []);

  const panelToggle = (
    <Button
      variant="ghost"
      size="sm"
      onClick={togglePanel}
      aria-pressed={panelOpen}
      aria-controls="document-info-panel"
      className="hidden text-muted-foreground hover:text-foreground lg:inline-flex"
    >
      {panelOpen ? <PanelRightClose strokeWidth={1.5} /> : <PanelRightOpen strokeWidth={1.5} />}
      Thông tin
    </Button>
  );

  return (
    <div className={cn("flex w-full flex-col", className)} data-slot="document-full-page" data-doc-id={docId}>
      <nav aria-label="Breadcrumb" className="flex h-8 shrink-0 items-center gap-1.5 px-4 text-xs text-muted-foreground sm:px-6">
        <Link href={breadcrumb.href} className="rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          {breadcrumb.label}
        </Link>
        <span aria-hidden>›</span>
        <span className="font-mono text-foreground">{breadcrumb.current}</span>
      </nav>

      <div className="flex min-h-[480px] min-w-0 flex-col lg:h-[calc(100dvh-7rem)]">
        <div className="shrink-0 space-y-3 px-4 pb-3 pt-1 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">{header}</div>
            {panelToggle}
          </div>
          {actions}
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div
            data-slot="document-full-page-viewer"
            className="@container/doc min-h-0 min-w-0 flex-1 border-t border-border/50 lg:overflow-y-auto"
          >
            {files.length > 0 ? (
              <DocumentFileViewer
                files={files}
                activeFileId={fileParam}
                onActiveFileChange={handleFileChange}
                persistKey={docId}
                railExtra={
                  <RailButton label={panelOpen ? "Ẩn thông tin văn bản" : "Thông tin văn bản"} onClick={togglePanel} aria-pressed={panelOpen} className="hidden lg:inline-flex">
                    <Info strokeWidth={1.5} />
                  </RailButton>
                }
              />
            ) : (
              <p className="px-4 py-6 text-compact text-muted-foreground sm:px-6">Văn bản chưa có tệp đính kèm</p>
            )}
          </div>

          <aside
            id="document-info-panel"
            aria-label="Thông tin văn bản"
            data-open={panelOpen}
            className={cn(
              "min-w-0 space-y-3 border-t border-border/50 p-3 lg:w-80 lg:shrink-0 lg:overflow-y-auto lg:border-l lg:border-t-0",
              panelOpen ? "lg:block" : "lg:hidden",
            )}
          >
            {panel}
          </aside>
        </div>
      </div>
    </div>
  );
}
