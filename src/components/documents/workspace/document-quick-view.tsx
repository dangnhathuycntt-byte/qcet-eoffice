"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Printer, Stamp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DocumentItem, OfficialDocument } from "@/types/document";
import { useDocumentDetail } from "@/hooks/use-document-detail";
import { fromDocumentItem, fromOfficialDocument, getFullPageHref, type DocumentViewModel } from "@/lib/documents/document-view-model";
import { resolveActiveFileId } from "@/lib/documents/file-viewer-state";
import { DocumentFileViewer } from "../document-file-viewer";
import { hasOpenDetailsPopover } from "../popover-escape-guard";
import { AttachedFilesSection, DocumentInfoSections, DocumentSummaryBlock } from "./document-workspace-parts";

export interface DocumentQuickViewProps {
  docId: string;
  /** Tệp đang xem (từ `?file=`). */
  fileId: string | null;
  /** Dòng danh sách đã tải: dựng tiêu đề ngay khi chi tiết còn đang tải. */
  seed?: OfficialDocument | null;
  mode: "pane" | "overlay";
  onClose: () => void;
  onFileChange: (fileId: string) => void;
  /** Sau thao tác workflow: danh sách cần tải lại. */
  onWorkflowUpdate?: () => void;
  /** Mở hộp thoại xem chữ ký số (văn bản đã ký). */
  onViewSignature?: (item: DocumentItem | null) => void;
  /** Tăng để đưa focus về nút Đóng (mở bằng chuột/Enter). */
  focusToken?: number;
}

/**
 * Quick View: chi tiết văn bản dùng chung cho pane không modal (desktop) và overlay (hẹp).
 * Dữ liệu lấy một lần từ `GET /api/documents/[id]` (server quyết định quyền), mọi loại văn bản dùng chung bộ khung.
 */
export function DocumentQuickView({ docId, fileId, seed, mode, onClose, onFileChange, onWorkflowUpdate, onViewSignature, focusToken = 0 }: DocumentQuickViewProps) {
  const { state, refresh } = useDocumentDetail(docId);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const rootRef = React.useRef<HTMLElement>(null);

  const item = state.docId === docId && (state.status === "ready" || state.status === "loading") ? state.item : null;
  const vm: DocumentViewModel | null = item ? fromDocumentItem(item) : seed && seed.id === docId ? fromOfficialDocument(seed) : null;
  const error = state.docId === docId && state.status === "error" ? state : null;

  React.useEffect(() => {
    if (focusToken > 0) closeRef.current?.focus();
  }, [focusToken]);

  // Overlay: khóa cuộn nền; trả focus được xử lý bởi nơi mở (registry)
  React.useEffect(() => {
    if (mode !== "overlay") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mode]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    // Popover đang mở đóng trước, pane đóng ở lần Escape sau
    if (hasOpenDetailsPopover()) return;
    event.preventDefault();
    onClose();
  };

  const activeFileId = vm ? resolveActiveFileId(vm.files, fileId) : "";
  const label = vm ? `Chi tiết văn bản ${vm.numberLabel ?? vm.title}` : "Chi tiết văn bản";
  const typeLine = vm ? (
    <>
      {vm.typeLabel}
      {vm.numberLabel ? <span className="font-mono"> · {vm.numberLabel}</span> : null}
    </>
  ) : (
    "Chi tiết văn bản"
  );

  const header = (
    <header className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border/50 px-4">
      <p className="min-w-0 truncate text-xs text-muted-foreground">{typeLine}</p>
      <div className="flex shrink-0 items-center gap-0.5">
        {vm ? (
          <Button asChild variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground">
            <Link href={getFullPageHref(vm.kind, vm.id, activeFileId || null)} aria-label="Mở trang đầy đủ" title="Mở trang đầy đủ">
              <ArrowUpRight className="size-4" strokeWidth={1.5} />
            </Link>
          </Button>
        ) : null}
        {vm?.hasSignature && onViewSignature ? (
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => onViewSignature(item)} aria-label="Xem chữ ký số" title="Xem chữ ký số" className="text-muted-foreground hover:text-foreground">
            <Stamp className="size-4" strokeWidth={1.5} />
          </Button>
        ) : null}
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => window.print()} aria-label="In phiếu văn bản" title="In phiếu văn bản" className="text-muted-foreground hover:text-foreground">
          <Printer className="size-4" strokeWidth={1.5} />
        </Button>
        <Button ref={closeRef} type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Đóng" title="Đóng" className="text-muted-foreground hover:text-foreground">
          <X className="size-4" strokeWidth={1.5} />
        </Button>
      </div>
    </header>
  );

  const body = error ? (
    <div role="alert" className="space-y-3 px-4 py-6 @lg/doc:px-6">
      <p className="text-compact text-destructive">{error.message}</p>
      {error.kind === "network" || error.kind === "unknown" ? (
        <Button variant="outline" size="sm" onClick={refresh}>
          Thử lại
        </Button>
      ) : null}
    </div>
  ) : !vm ? (
    <p role="status" className="px-4 py-6 text-compact text-muted-foreground @lg/doc:px-6">
      Đang tải chi tiết văn bản…
    </p>
  ) : (
    <>
      <div className="space-y-4 px-4 pb-4 pt-5 @lg/doc:px-6">
        <DocumentSummaryBlock vm={vm} />
        <DocumentInfoSections
          vm={vm}
          item={item}
          onWorkflowUpdate={() => {
            refresh();
            onWorkflowUpdate?.();
          }}
        />
        <AttachedFilesSection files={vm.files} activeId={activeFileId} onSelect={onFileChange} />
      </div>

      {vm.files.length > 0 ? (
        <DocumentFileViewer
          key={vm.id}
          files={vm.files}
          activeFileId={fileId}
          onActiveFileChange={onFileChange}
        />
      ) : (
        <p className="border-t border-border/50 px-4 py-4 text-compact text-muted-foreground @lg/doc:px-6">Chưa có tệp đính kèm</p>
      )}
    </>
  );

  const content = (
    <>
      {header}
      <div data-slot="document-quick-body" className="@container/doc min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {body}
      </div>
    </>
  );

  if (mode === "overlay") {
    return (
      <section
        ref={rootRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        data-slot="document-quick-view"
        data-mode="overlay"
        onKeyDown={handleKeyDown}
        className="fixed inset-0 z-50 flex flex-col bg-card"
      >
        {content}
      </section>
    );
  }

  return (
    <aside
      ref={rootRef}
      role="region"
      aria-label={label}
      data-slot="document-quick-view"
      data-mode="pane"
      onKeyDown={handleKeyDown}
      className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-card"
    >
      {content}
    </aside>
  );
}
