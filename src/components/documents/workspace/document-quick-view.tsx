"use client";

import { EmptyState } from "@/components/ui/empty-state";
import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Ellipsis, Loader2, Paperclip, Pencil, Printer, Stamp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MenuContent, MenuItem, MenuRoot, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import type { DocumentItem, OfficialDocument } from "@/types/document";
import { useDocumentDetail } from "@/hooks/use-document-detail";
import { fromDocumentItem, fromOfficialDocument, getFullPageHref, type DocumentViewModel } from "@/lib/documents/document-view-model";
import { resolveActiveFileId } from "@/lib/documents/file-viewer-state";
import { DocumentFileViewer } from "../document-file-viewer";
import { hasOpenDetailsPopover, useTrackOpenPopover } from "../popover-escape-guard";
import { DocumentInfoSections, DocumentSummaryBlock } from "./document-workspace-parts";
import { AddDocumentFileButton, DocumentEditDialog, useAddDocumentFiles } from "./document-edit";

/** Chỉ in khối chi tiết (`document-quick-body`); phần còn lại của trang bị ẩn khi in. */
const PRINT_DETAIL_CSS = `@media print {
  body * { visibility: hidden !important; }
  [data-slot="document-quick-body"], [data-slot="document-quick-body"] * { visibility: visible !important; }
  [data-slot="document-quick-body"] { position: absolute; inset: 0; overflow: visible !important; }
}`;

const MENU_ITEM =
  "flex h-8 cursor-pointer select-none items-center gap-2 rounded-md px-2 text-compact text-foreground outline-none data-[highlighted]:bg-muted/60 [&_svg]:size-4 [&_svg]:text-muted-foreground";

/**
 * "Thao tác khác": sửa thông tin và bổ sung tệp (khi server cho phép), in phiếu thông tin văn bản
 * (không phải in tệp PDF đang xem), xem chữ ký số khi có. Header chỉ giữ Mở rộng, menu này và Đóng.
 */
function MoreActionsMenu({
  onPrint,
  onViewSignature,
  onEdit,
  onAddFiles,
}: {
  onPrint: () => void;
  onViewSignature?: () => void;
  onEdit?: () => void;
  onAddFiles?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  useTrackOpenPopover(open);
  return (
    <MenuRoot open={open} onOpenChange={setOpen} modal={false}>
      <MenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Thao tác khác" title="Thao tác khác" className="text-muted-foreground hover:text-foreground data-[popup-open]:bg-muted">
          <Ellipsis className="size-4" strokeWidth={1.5} />
        </Button>
      </MenuTrigger>
      <MenuContent align="end" positionerClassName="z-[60]" className="z-[60] w-56 min-w-0">
        {onEdit ? (
          <MenuItem className={MENU_ITEM} onClick={onEdit}>
            <Pencil strokeWidth={1.5} />
            Sửa thông tin
          </MenuItem>
        ) : null}
        {onAddFiles ? (
          <MenuItem className={MENU_ITEM} onClick={onAddFiles}>
            <Paperclip strokeWidth={1.5} />
            Thêm tệp
          </MenuItem>
        ) : null}
        {onEdit || onAddFiles ? <MenuSeparator className="my-1 h-px bg-border/60" /> : null}
        <MenuItem className={MENU_ITEM} onClick={onPrint}>
          <Printer strokeWidth={1.5} />
          In phiếu văn bản
        </MenuItem>
        {onViewSignature ? (
          <MenuItem className={MENU_ITEM} onClick={onViewSignature}>
            <Stamp strokeWidth={1.5} />
            Xem chữ ký số
          </MenuItem>
        ) : null}
      </MenuContent>
    </MenuRoot>
  );
}

/**
 * Overlay là hộp thoại modal: mọi nhánh DOM ngoài overlay (danh sách, sidebar, header…) bị `inert`
 * để Tab và trình đọc màn hình không ra nền. Popover/hộp thoại mở sau đó gắn vào body nên vẫn dùng được.
 */
function inertOutside(el: HTMLElement): () => void {
  const changed: HTMLElement[] = [];
  for (let node: HTMLElement | null = el; node && node.parentElement && node !== document.body; node = node.parentElement) {
    for (const sibling of Array.from(node.parentElement.children)) {
      if (sibling === node || !(sibling instanceof HTMLElement) || sibling.inert) continue;
      if (sibling.tagName === "SCRIPT" || sibling.tagName === "STYLE") continue;
      sibling.inert = true;
      changed.push(sibling);
    }
  }
  return () => changed.forEach((node) => (node.inert = false));
}

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
  const canEdit = Boolean(item?.canEdit);
  const [editing, setEditing] = React.useState(false);
  const afterChange = () => {
    refresh();
    onWorkflowUpdate?.();
  };
  const upload = useAddDocumentFiles(docId, afterChange);

  // Pane không modal: focus ở lại dòng danh sách để tiếp tục duyệt bằng ↑/↓ hoặc j/k.
  // Overlay là hộp thoại: chuyển focus vào nút Đóng khi mở, kể cả khi pane vừa chuyển sang overlay do thu hẹp.
  React.useEffect(() => {
    if (mode !== "overlay") return;
    if (!rootRef.current?.contains(document.activeElement)) closeRef.current?.focus();
  }, [focusToken, mode]);

  // Overlay: khóa cuộn nền và làm nền trơ; trả focus được xử lý bởi nơi mở (registry)
  React.useEffect(() => {
    if (mode !== "overlay" || !rootRef.current) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const restoreInert = inertOutside(rootRef.current);
    return () => {
      document.body.style.overflow = previous;
      restoreInert();
    };
  }, [mode]);

  const closeOnEscape = (event: { key: string; defaultPrevented: boolean; preventDefault: () => void }) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    // Popover đang mở đóng trước, pane đóng ở lần Escape sau
    if (hasOpenDetailsPopover()) return;
    event.preventDefault();
    onClose();
  };
  const onCloseRef = React.useRef(closeOnEscape);
  onCloseRef.current = closeOnEscape;

  // Overlay modal: Escape đóng kể cả khi focus đã rời hộp thoại (ví dụ Tab ra thanh địa chỉ rồi quay lại)
  React.useEffect(() => {
    if (mode !== "overlay") return;
    const handler = (event: KeyboardEvent) => onCloseRef.current(event);
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [mode]);

  // Pane không modal: chỉ Escape khi focus nằm trong pane
  const handleKeyDown = mode === "pane" ? (event: React.KeyboardEvent) => closeOnEscape(event) : undefined;

  const activeFileId = vm ? resolveActiveFileId(vm.files, fileId) : "";
  const label = vm ? `Chi tiết văn bản ${vm.numberLabel ?? vm.title}` : "Chi tiết văn bản";
  const typeLine = vm ? (
    <>
      {vm.typeLabel}
      {vm.numberLabel ? <span className="tabular-nums"> · {vm.numberLabel}</span> : null}
    </>
  ) : (
    "Chi tiết văn bản"
  );

  const header = (
    <header className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-border/60 pl-4 pr-2 select-none">
      <p className="min-w-0 truncate text-xs text-muted-foreground">{typeLine}</p>
      <div className="flex shrink-0 items-center gap-0.5">
        {vm ? (
          <Button asChild variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground">
            <Link href={getFullPageHref(vm.kind, vm.id, activeFileId || null)} aria-label="Mở trang đầy đủ" title="Mở trang đầy đủ">
              <ArrowUpRight className="size-4" strokeWidth={1.5} />
            </Link>
          </Button>
        ) : null}
        <MoreActionsMenu
          onPrint={() => window.print()}
          onViewSignature={vm?.hasSignature && onViewSignature ? () => onViewSignature(item) : undefined}
          onEdit={canEdit ? () => setEditing(true) : undefined}
          onAddFiles={canEdit && !upload.busy ? upload.open : undefined}
        />
        <Button ref={closeRef} type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Đóng" title="Đóng" className="text-muted-foreground hover:text-foreground">
          <X className="size-4" strokeWidth={1.5} />
        </Button>
      </div>
    </header>
  );

  const body = error ? (
    <div role="alert" className="space-y-3 px-4 py-4">
      <p className="text-compact text-destructive">{error.message}</p>
      {error.kind === "network" || error.kind === "unknown" ? (
        <Button variant="outline" size="sm" onClick={refresh}>
          Thử lại
        </Button>
      ) : null}
    </div>
  ) : !vm ? (
    <p role="status" className="px-4 py-4 text-compact text-muted-foreground">
      Đang tải chi tiết văn bản…
    </p>
  ) : (
    <>
      {/* In chỉ phần chi tiết văn bản, không in danh sách, sidebar hay thanh công cụ. */}
      <style>{PRINT_DETAIL_CSS}</style>
      <div className="flex flex-col gap-3 px-4 pb-3 pt-3">
        <DocumentSummaryBlock vm={vm} variant="quick" />
        {item ? (
          <DocumentInfoSections
            vm={vm}
            item={item}
            variant="quick"
            onWorkflowUpdate={afterChange}
          />
        ) : (
          // Chi tiết và quyền còn đang tải: chưa dựng thao tác nào từ dữ liệu của dòng danh sách
          <div role="status" aria-label="Đang tải thông tin xử lý" className="space-y-2 py-1">
            <div className="h-7 w-40 animate-pulse rounded-md bg-muted/60" />
            <div className="h-4 w-56 animate-pulse rounded bg-muted/50" />
          </div>
        )}
        {upload.busy ? (
          <p role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" strokeWidth={1.5} aria-hidden />
            Đang tải tệp lên…
          </p>
        ) : upload.error ? (
          <p role="alert" className="text-xs text-destructive">{upload.error}</p>
        ) : null}
      </div>
      {upload.input}
      {item && canEdit ? <DocumentEditDialog item={item} open={editing} onOpenChange={setEditing} onSaved={afterChange} /> : null}

      {vm.files.length > 0 ? (
        <DocumentFileViewer
          key={`files-${vm.id}`}
          files={vm.files}
          gutterClassName="px-4"
          stickyHeader
          activeFileId={fileId}
          onActiveFileChange={onFileChange}
        />
      ) : (
        <div className="flex min-h-0 flex-1 items-start justify-center border-t border-border/50 px-4 pt-10">
          <EmptyState
            density="compact"
            illustration={vm.kind === "outgoing" ? "doc-out" : vm.kind === "submission" ? "submission" : "doc-in"}
            title="Chưa có tệp đính kèm"
            description={item?.canEdit ? "Thêm tệp để xem nội dung văn bản tại đây." : "Văn bản này chưa có tệp để xem."}
            action={item?.canEdit ? <AddDocumentFileButton documentId={vm.id} onAdded={afterChange}>Thêm tệp</AddDocumentFileButton> : undefined}
          />
        </div>
      )}
    </>
  );

  const content = (
    <>
      {header}
      <div data-slot="document-quick-body" className="@container/doc flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        {body}
      </div>
    </>
  );

  if (mode === "overlay") {
    // Hẹp hơn ngưỡng hai thẻ: lớp nền + thẻ phủ toàn màn hình, cùng kiểu Task Detail trên mobile
    return (
      <>
        <div
          onClick={onClose}
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-2xs motion-reduce:animate-none"
        />
        <section
          ref={rootRef}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          data-slot="document-quick-view"
          data-mode="overlay"
          className="fixed inset-0 z-50 flex flex-col overflow-hidden rounded-(--radius-xl) border border-border bg-card text-foreground"
        >
          {content}
        </section>
      </>
    );
  }

  // Pane: thẻ do khung cha cung cấp (cùng `split-workspace`), nên ở đây không vẽ nền/viền
  return (
    <section
      ref={rootRef}
      role="region"
      aria-label={label}
      data-slot="document-quick-view"
      data-mode="pane"
      onKeyDown={handleKeyDown}
      className="flex h-full min-h-0 min-w-0 flex-1 flex-col"
    >
      {content}
    </section>
  );
}
