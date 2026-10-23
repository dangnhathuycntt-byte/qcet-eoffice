"use client";

import { EmptyState } from "@/components/ui/empty-state";
import * as React from "react";
import Link from "next/link";
import { ChevronLeft, Ellipsis, Link2, Loader2, Paperclip, Pencil, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback-layer";
import { cn } from "@/lib/utils";
import { MenuActionItem, MenuContent, MenuRoot, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import type { DocumentItem, OfficialDocument } from "@qcet/contracts/types/document";
import { useDocumentDetail } from "@/hooks/use-document-detail";
import { fromDocumentItem, fromOfficialDocument, getDocumentHref, type DocumentViewModel } from "@qcet/shared/lib/documents/document-view-model";
import { resolveActiveFileId } from "@qcet/shared/lib/documents/file-viewer-state";
import { DocumentFileRows, DocumentFileScreen, DocumentFileViewer } from "../document-file-viewer";
import { useIsPhone } from "@/hooks/use-is-phone";
import { hasOpenDetailsPopover, useTrackOpenPopover } from "../popover-escape-guard";
import { DocumentInfoSections, DocumentSummaryBlock } from "./document-workspace-parts";
import { AddDocumentFileButton, DocumentEditDialog, useAddDocumentFiles } from "./document-edit";
import { AgentIcon } from "@/components/icons/agent-icon";
import { useRuntimeFeature } from "@/lib/runtime-features";
import { isAssistantEligibleDocument } from "@qcet/shared/domain/assistant/assistant-document-eligibility";

import { Spinner } from "@/components/ui/spinner";
/** Chỉ in khối chi tiết (`document-quick-body`); phần còn lại của trang bị ẩn khi in. */
const PRINT_DETAIL_CSS = `@media print {
  body * { visibility: hidden !important; }
  [data-slot="document-quick-body"], [data-slot="document-quick-body"] * { visibility: visible !important; }
  [data-slot="document-quick-body"] { position: absolute; inset: 0; overflow: visible !important; }
}`;

/**
 * "Thao tác khác": sửa thông tin và bổ sung tệp (khi server cho phép), in phiếu thông tin văn bản
 * (không phải in tệp PDF đang xem). Header: Đóng bên trái; Sao chép liên kết rồi menu này bên phải.
 */
function MoreActionsMenu({
  onPrint,
  onEdit,
  onAddFiles,
  askAssistantHref,
}: {
  onPrint: () => void;
  onEdit?: () => void;
  onAddFiles?: () => void;
  /** Có khi cờ Trợ lý bật: đường dẫn mở Trợ lý với văn bản này làm ngữ cảnh. */
  askAssistantHref?: string;
}) {
  const [open, setOpen] = React.useState(false);
  useTrackOpenPopover(open);
  return (
    <MenuRoot open={open} onOpenChange={setOpen} modal={false}>
      <MenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Thao tác khác" title="Thao tác khác" className="text-muted-foreground hover:text-foreground data-[popup-open]:bg-selected">
          <Ellipsis className="size-4" />
        </Button>
      </MenuTrigger>
      <MenuContent align="end" positionerClassName="z-[60]" className="z-[60] w-56 min-w-0">
        {askAssistantHref ? (
          <>
            <MenuActionItem leading={<AgentIcon className="size-4" />} render={<Link href={askAssistantHref} />}>
              Hỏi Trợ lý
            </MenuActionItem>
            <MenuSeparator />
          </>
        ) : null}
        {onEdit ? (
          <MenuActionItem leading={<Pencil />} onClick={onEdit}>Sửa thông tin</MenuActionItem>
        ) : null}
        {onAddFiles ? (
          <MenuActionItem leading={<Paperclip />} onClick={onAddFiles}>Thêm tệp</MenuActionItem>
        ) : null}
        {onEdit || onAddFiles ? <MenuSeparator /> : null}
        <MenuActionItem leading={<Printer />} onClick={onPrint}>In phiếu văn bản</MenuActionItem>
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
  /** Tăng để đưa focus về nút Đóng (mở bằng chuột/Enter). */
  focusToken?: number;
}

/**
 * Quick View: chi tiết văn bản dùng chung cho pane không modal (desktop) và overlay (hẹp).
 * Dữ liệu lấy một lần từ `GET /api/documents/[id]` (server quyết định quyền), mọi loại văn bản dùng chung bộ khung.
 */
export function DocumentQuickView({ docId, fileId, seed, mode, onClose, onFileChange, onWorkflowUpdate, focusToken = 0 }: DocumentQuickViewProps) {
  const { state, refresh } = useDocumentDetail(docId);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const rootRef = React.useRef<HTMLElement>(null);
  const feedback = useFeedback();
  // Cờ Trợ lý: chỉ hiện "Hỏi Trợ lý" trong menu Thao tác khác khi bật
  const assistantOn = useRuntimeFeature("assistant");

  const item = state.docId === docId && (state.status === "ready" || state.status === "loading") ? state.item : null;
  const vm: DocumentViewModel | null = item ? fromDocumentItem(item) : seed && seed.id === docId ? fromOfficialDocument(seed) : null;
  const error = state.docId === docId && state.status === "error" ? state : null;
  const canEdit = Boolean(item?.canEdit);
  // Trợ lý chỉ đọc văn bản Thường không có ghi chú hạn chế: văn bản mật không hiện lối vào (chờ chi tiết tải xong mới biết độ mật và ghi chú)
  const canAskAssistant = assistantOn && item !== null && isAssistantEligibleDocument(item);
  const [editing, setEditing] = React.useState(false);
  const afterChange = () => {
    refresh();
    onWorkflowUpdate?.();
  };
  const upload = useAddDocumentFiles(docId, afterChange);
  // Điện thoại: tệp là danh sách dòng, chạm để xem toàn màn hình (không nhúng khung xem dài vào trang)
  const isPhone = useIsPhone();
  const [viewingFileId, setViewingFileId] = React.useState<string | null>(null);
  React.useEffect(() => setViewingFileId(null), [docId]);

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
    // Điện thoại: đang xem tệp toàn màn hình thì Escape chỉ quay về chi tiết
    if (viewingFileId) {
      event.preventDefault();
      setViewingFileId(null);
      return;
    }
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
      {vm.numberLabel ? <span className="font-medium tabular-nums text-foreground"> · {vm.numberLabel}</span> : null}
    </>
  ) : (
    "Chi tiết văn bản"
  );

  // Liên kết mở lại đúng văn bản này trên sổ (như "Sao chép liên kết" ở menu của dòng và thanh đầu chi tiết nhiệm vụ)
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${getDocumentHref(docId)}`);
      feedback.notifySuccess("Đã sao chép liên kết");
    } catch {
      feedback.notifyError("Không sao chép được liên kết");
    }
  };

  // Điện thoại: nút quay lại bên trái (như chi tiết nhiệm vụ / Linear) thay cho nút đóng bên phải; chừa safe area
  const backAsClose = isPhone && mode === "overlay";
  const header = (
    <header
      className={cn(
        "flex h-10 shrink-0 items-center justify-between gap-2 border-b border-border/60 pl-2 pr-2 select-none",
        backAsClose && "h-[calc(44px+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)]",
      )}
    >
      {/* Đóng (máy tính) / Quay lại (điện thoại) ở mép trái như khung xem nhanh của Notion; mép phải là thao tác, "⋯" luôn cuối
          cùng (người dùng yêu cầu 21/10/2026, DESIGN.md "Vị trí nút ⋯") */}
      <div className="flex min-w-0 items-center gap-1">
        {backAsClose ? (
          <Button ref={closeRef} variant="ghost" size="icon-sm" onClick={onClose} aria-label="Quay lại danh sách văn bản">
            <ChevronLeft />
          </Button>
        ) : (
          <Button ref={closeRef} variant="ghost" size="icon-sm" onClick={onClose} aria-label="Đóng" title="Đóng" className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </Button>
        )}
        <p className="min-w-0 truncate text-xs text-muted-foreground">{typeLine}</p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => void copyLink()}
          aria-label="Sao chép liên kết"
          title="Sao chép liên kết"
          className="text-muted-foreground hover:text-foreground"
        >
          <Link2 className="size-4" />
        </Button>
        <MoreActionsMenu
          askAssistantHref={canAskAssistant ? `/assistant?context=document:${encodeURIComponent(docId)}` : undefined}
          onPrint={() => window.print()}
          onEdit={canEdit ? () => setEditing(true) : undefined}
          onAddFiles={canEdit && !upload.busy ? upload.open : undefined}
        />
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
            <Spinner />
            Đang tải tệp lên…
          </p>
        ) : upload.error ? (
          <p role="alert" className="text-xs text-destructive">{upload.error}</p>
        ) : null}
      </div>
      {upload.input}
      {item && canEdit ? <DocumentEditDialog item={item} open={editing} onOpenChange={setEditing} onSaved={afterChange} /> : null}

      {vm.files.length > 0 && isPhone ? (
        <>
          <DocumentFileRows
            files={vm.files}
            onOpen={(id) => {
              onFileChange?.(id);
              setViewingFileId(id);
            }}
          />
          {viewingFileId ? (
            <DocumentFileScreen
              title={typeLine}
              files={vm.files}
              activeFileId={viewingFileId}
              onActiveFileChange={(id) => {
                onFileChange?.(id);
                setViewingFileId(id);
              }}
              onClose={() => setViewingFileId(null)}
            />
          ) : null}
        </>
      ) : vm.files.length > 0 ? (
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
          className="fixed inset-0 z-50 flex flex-col overflow-hidden rounded-(--radius-xl) border border-border bg-card text-foreground max-md:rounded-none max-md:border-0"
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
