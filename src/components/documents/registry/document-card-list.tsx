"use client";

import * as React from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { OfficialDocument, DocumentType } from "@/types/document";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState, type IllustrationName } from "@/components/ui/empty-state";
import { DocumentLoadError } from "@/components/documents/document-load-error";
import { cn } from "@/lib/utils";
import { formatLedgerDate, getLedgerStepLabel } from "@/lib/documents/document-ledger-format";
import { TaskStatusCircle } from "@/components/tasks/task-status-circle";
import { TaskIconLink } from "@/lib/icons/task-icons";
import { getTaskDetailHref } from "@/lib/tasks/task-detail-navigation";
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
  // Loading Skeleton State: cùng nhịp với hàng thật (mã + ngày, trích yếu, dòng phụ)
  if (isLoading) {
    return (
      <div
        className={cn("divide-y divide-border/60 select-none motion-safe:animate-pulse", className)}
        data-slot="document-card-list"
      >
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={`mob-skel-${idx}`} className="flex gap-3 px-4 py-2.5">
            <div className="mt-0.5 size-4 shrink-0 rounded-full bg-muted" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex justify-between">
                <div className="h-3 w-24 rounded bg-muted/70" />
                <div className="h-3 w-12 rounded bg-muted/60" />
              </div>
              <div className="h-3.5 w-5/6 rounded bg-muted" />
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
      <div className={className} data-slot="document-card-list">
        <DocumentLoadError title="Không thể tải dữ liệu văn bản" message={error} onRetry={onRetry} />
      </div>
    );
  }

  // Empty State
  if (documents.length === 0) {
    return (
      <div
        className={cn(
          "border border-dashed border-border/70 rounded-xl bg-muted/10 m-3 select-none",
          className
        )}
        data-slot="document-card-list"
      >
        <EmptyState
          density="compact"
          icon={<FileText />}
          illustration={emptyIllustration}
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      </div>
    );
  }

  // Hàng gọn kiểu Linear: không viền thẻ, chia bằng đường kẻ; bấm cả hàng để mở văn bản (tệp xem trong chi tiết)
  return (
    <div
      className={cn("divide-y divide-border/60", className)}
      data-slot="document-card-list"
    >
      {documents.map((doc) => {
        const urgencyConfig = getUrgencyBadgeConfig(doc.urgency);
        const isUrgent = Boolean(doc.urgency) && doc.urgency !== "normal" && doc.urgency !== "THUONG";
        const step = getLedgerStepLabel(doc.status, doc.workflowStatus, doc.type);
        const stepStatus = { new: "NOT_STARTED", progress: "IN_PROGRESS", review: "WAITING_APPROVAL", done: "COMPLETED" }[step.kind];
        const typeLabel = getDocTypeLabel(doc.type);
        const displayCode = doc.documentNumber || "";
        const labelCode = displayCode || doc.summary;
        const isSelectedRow = selectedIds.has(doc.id);
        const isCurrentActive = selectedDocument?.id === doc.id;
        const issuedDate = formatLedgerDate(doc.issuedDate);

        return (
          <div
            key={doc.id}
            role="button"
            tabIndex={0}
            data-doc-id={doc.id}
            aria-label={`${typeLabel} ${labelCode}: ${doc.summary}`}
            onClick={() => onSelectDocument?.(doc)}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectDocument?.(doc);
              }
            }}
            className={cn(
              "flex gap-3 px-4 py-2.5 transition-colors cursor-pointer select-none touch-manipulation",
              "active:bg-muted/50 outline-none focus-visible:bg-accent",
              (isSelectedRow || isCurrentActive) && "bg-accent/60"
            )}
            data-slot="mobile-document-card"
          >
            {selectable ? (
              // Vùng bấm 32px quanh ô tích; không mở văn bản khi tích
              <div
                onClick={(e) => e.stopPropagation()}
                className="-m-2 flex size-8 shrink-0 items-center justify-center self-start"
              >
                <Checkbox
                  checked={isSelectedRow}
                  onChange={(e) => onToggleSelect?.(doc.id, (e.nativeEvent as MouseEvent)?.shiftKey)}
                  aria-label={`Chọn văn bản ${labelCode}`}
                />
              </div>
            ) : null}
            <TaskStatusCircle status={stepStatus} className="mt-0.5" />

            <div className="min-w-0 flex-1 space-y-0.5">
              {/* Số ký hiệu · mức khẩn ........ ngày ban hành */}
              <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                <span className="min-w-0 truncate font-mono tabular-nums">{displayCode || typeLabel}</span>
                {isUrgent ? (
                  <span className={cn("shrink-0 font-medium", urgencyConfig.className.includes("destructive") ? "text-destructive" : "text-warning")}>
                    {urgencyConfig.label}
                  </span>
                ) : null}
                {issuedDate ? <span className="ml-auto shrink-0 tabular-nums">{issuedDate}</span> : null}
              </div>

              <p className="line-clamp-2 text-compact text-foreground">{doc.summary}</p>

              {/* Bước xử lý · cơ quan ban hành */}
              <p className="truncate text-xs text-muted-foreground">
                {step.label}
                {doc.issuingAuthority ? ` · ${doc.issuingAuthority}` : ""}
              </p>

              {doc.linkedTaskId ? (
                <Link
                  href={getTaskDetailHref(doc.linkedTaskId)}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex max-w-full items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <TaskIconLink className="size-3.5 shrink-0" />
                  <span className="min-w-0 truncate">{doc.linkedTaskTitle || "Nhiệm vụ liên kết"}</span>
                </Link>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
