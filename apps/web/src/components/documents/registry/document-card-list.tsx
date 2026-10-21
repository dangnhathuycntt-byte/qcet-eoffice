"use client";

import * as React from "react";
import { FileText } from "lucide-react";
import { OfficialDocument, DocumentType } from "@qcet/contracts/types/document";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState, type IllustrationName } from "@/components/ui/empty-state";
import { DocumentLoadError } from "@/components/documents/document-load-error";
import { cn } from "@/lib/utils";
import { formatLedgerDate, getLedgerStepLabel } from "@qcet/shared/lib/documents/document-ledger-format";
import { TaskStatusCircle } from "@/components/tasks/task-status-circle";
import { TaskIconLink } from "@qcet/shared/lib/icons/task-icons";
import { useLongPress } from "@/hooks/use-long-press";
import {
  getUrgencyBadgeConfig,
} from "../document-badges";

export interface DocumentCardListProps {
  documents: OfficialDocument[];
  selectedDocument?: OfficialDocument | null;
  selectedIds?: Set<string>;
  onSelectDocument?: (doc: OfficialDocument) => void;
  onToggleSelect?: (docId: string, isShift?: boolean) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Tranh khi sổ chưa có dữ liệu (không truyền khi đang lọc). */
  emptyIllustration?: IllustrationName;
  emptyAction?: React.ReactNode;
  className?: string;
  selectable?: boolean;
}

function getDocTypeLabel(type: DocumentType): string {
  switch (type) {
    case "VAN_BAN_DEN":
    case "inbox":
      return "Văn bản đến";
    case "VAN_BAN_DI":
    case "outbox":
      return "Văn bản đi";
    case "TO_TRINH_NOI_BO":
    case "submission":
      return "Tờ trình nội bộ";
    default:
      return "Văn bản";
  }
}

export function DocumentCardList({
  documents,
  selectedDocument,
  selectedIds = new Set<string>(),
  onSelectDocument,
  onToggleSelect,
  isLoading = false,
  error = null,
  onRetry,
  emptyTitle = "Chưa có văn bản nào",
  emptyDescription = "Vào sổ văn bản mới để bắt đầu.",
  emptyIllustration,
  emptyAction,
  className,
  selectable = false,
}: DocumentCardListProps) {
  // Loading Skeleton State: cùng nhịp với hàng thật (trích yếu + ngày, dòng phụ)
  if (isLoading) {
    return (
      <div className={cn("select-none motion-safe:animate-pulse", className)} data-slot="document-card-list">
        {Array.from({ length: 8 }).map((_, idx) => (
          <div key={`mob-skel-${idx}`} className="mx-2 flex min-h-[52px] items-start gap-3 px-2 py-2">
            <div className="mt-0.5 size-4 shrink-0 rounded-full bg-muted" />
            <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
              <div className="flex justify-between gap-3">
                <div className="h-3.5 w-3/4 rounded bg-muted" />
                <div className="h-3 w-10 rounded bg-muted/60" />
              </div>
              <div className="h-3 w-1/2 rounded bg-muted/60" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className={cn("empty-fill", className)} data-slot="document-card-list">
        <DocumentLoadError density="page" title="Không thể tải dữ liệu văn bản" message={error} onRetry={onRetry} />
      </div>
    );
  }

  // Empty State
  if (documents.length === 0) {
    return (
      <div className={cn("empty-fill select-none", className)} data-slot="document-card-list">
        <EmptyState
          role="status"
          density="page"
          icon={<FileText />}
          illustration={emptyIllustration}
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      </div>
    );
  }

  // Đang chọn ít nhất một văn bản: chạm hàng là chọn/bỏ chọn (như chế độ chọn của iOS), ô tích mới hiện
  const selectionMode = selectable && selectedIds.size > 0;
  const currentYearSuffix = `/${new Date().getFullYear()}`;

  // Hàng kiểu Linear: không viền, không đường kẻ; trích yếu đứng đầu, ngày bên phải, dòng phụ nhạt
  return (
    <div className={className} data-slot="document-card-list">
      {documents.map((doc) => (
        <DocumentMobileRow
          key={doc.id}
          doc={doc}
          selected={selectedIds.has(doc.id)}
          active={selectedDocument?.id === doc.id}
          selectionMode={selectionMode}
          currentYearSuffix={currentYearSuffix}
          onOpen={onSelectDocument}
          onToggleSelect={selectable ? onToggleSelect : undefined}
        />
      ))}
    </div>
  );
}

function DocumentMobileRow({
  doc,
  selected,
  active,
  selectionMode,
  currentYearSuffix,
  onOpen,
  onToggleSelect,
}: {
  doc: OfficialDocument;
  selected: boolean;
  active: boolean;
  selectionMode: boolean;
  currentYearSuffix: string;
  onOpen?: (doc: OfficialDocument) => void;
  onToggleSelect?: (docId: string, isShift?: boolean) => void;
}) {
  const urgencyConfig = getUrgencyBadgeConfig(doc.urgency);
  const isUrgent = Boolean(doc.urgency) && doc.urgency !== "normal" && doc.urgency !== "THUONG";
  const step = getLedgerStepLabel(doc.status, doc.workflowStatus, doc.type);
  const stepStatus = { new: "NOT_STARTED", progress: "IN_PROGRESS", review: "WAITING_APPROVAL", done: "COMPLETED" }[step.kind];
  const typeLabel = getDocTypeLabel(doc.type);
  const code = doc.documentNumber || "";
  const fullDate = formatLedgerDate(doc.issuedDate);
  // Năm nay thì bỏ năm cho gọn (như Linear), năm khác giữ đủ để không nhầm
  const shortDate = fullDate && fullDate.endsWith(currentYearSuffix) ? fullDate.slice(0, -currentYearSuffix.length) : fullDate;
  const meta = [code, doc.issuingAuthority].filter(Boolean).join(" · ");

  // Nhấn giữ: chọn văn bản (mở chế độ chọn), không mở chi tiết
  const toggle = React.useCallback(() => onToggleSelect?.(doc.id), [onToggleSelect, doc.id]);
  const { handlers: longPressHandlers, consumeClick } = useLongPress<HTMLDivElement>(onToggleSelect ? toggle : undefined);

  const activate = () => {
    if (selectionMode) toggle();
    else onOpen?.(doc);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      data-doc-id={doc.id}
      data-slot="mobile-document-card"
      aria-pressed={selectionMode ? selected : undefined}
      aria-label={`${typeLabel} ${code || ""}: ${doc.summary}. ${step.label}${isUrgent ? `. ${urgencyConfig.label}` : ""}`}
      onClick={() => {
        if (consumeClick()) return;
        activate();
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      }}
      {...longPressHandlers}
      className={cn(
        // Lùi 8px hai bên, bo góc: nền khi chạm/chọn không tràn mép (như Linear)
        "mx-2 flex min-h-[52px] items-start gap-3 rounded-lg px-2 py-2 cursor-pointer select-none touch-manipulation [-webkit-touch-callout:none]",
        "transition-colors duration-100 active:bg-muted/50 outline-none focus-visible:bg-accent",
        (selected || active) && "bg-selected"
      )}
    >
      {selectionMode ? (
        // Chỉ hiển thị trạng thái; cả hàng là vùng bấm
        <Checkbox checked={selected} readOnly tabIndex={-1} aria-hidden="true" className="pointer-events-none mt-0.5" />
      ) : (
        <TaskStatusCircle status={stepStatus} className="mt-0.5" />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-3">
          <p className="min-w-0 flex-1 truncate text-compact text-foreground">{doc.summary}</p>
          {doc.linkedTaskId ? (
            <TaskIconLink className="size-3.5 shrink-0 text-muted-foreground" aria-label="Có nhiệm vụ liên kết" />
          ) : null}
          {shortDate ? <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{shortDate}</span> : null}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {isUrgent ? (
            <span className={cn("font-medium", urgencyConfig.className.includes("destructive") ? "text-destructive" : "text-warning")}>
              {urgencyConfig.label}
              {meta ? " · " : ""}
            </span>
          ) : null}
          {meta || typeLabel}
        </p>
      </div>
    </div>
  );
}
