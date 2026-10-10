"use client";

import * as React from "react";
import Link from "next/link";
import {
  FileText,
  ChevronRight,
  CheckCircle2,
  ArrowRight,
  Building2,
  Calendar,
  User,
} from "lucide-react";
import { OfficialDocument, DocumentType } from "@/types/document";
import { Button } from "@/components/ui/button";
import { EmptyState, type IllustrationName } from "@/components/ui/empty-state";
import { DocumentLoadError } from "@/components/documents/document-load-error";
import { cn } from "@/lib/utils";
import { formatLedgerDate, getLedgerStepLabel } from "@/lib/documents/document-ledger-format";
import { TaskStatusCircle } from "@/components/tasks/task-status-circle";
import {
  getUrgencyBadgeConfig,
} from "../document-badges";

export interface DocumentCardListProps {
  documents: OfficialDocument[];
  selectedDocument?: OfficialDocument | null;
  selectedIds?: Set<string>;
  onSelectDocument?: (doc: OfficialDocument) => void;
  onToggleSelect?: (docId: string, isShift?: boolean) => void;
  onViewPdf?: (doc: OfficialDocument) => void;
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
  onViewPdf,
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
  // Loading Skeleton State
  if (isLoading) {
    return (
      <div
        className={cn("p-3 space-y-3 select-none", className)}
        data-slot="document-card-list"
      >
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={`mob-skel-${idx}`}
            className="p-3 rounded-lg border border-border/60 bg-card/60 motion-safe:animate-pulse space-y-2.5"
          >
            <div className="flex justify-between items-center">
              <div className="h-4 w-28 bg-muted rounded" />
              <div className="h-4 w-16 bg-muted/70 rounded" />
            </div>
            <div className="h-4 w-5/6 bg-muted rounded" />
            <div className="h-3 w-1/2 bg-muted/60 rounded" />
            <div className="flex justify-end gap-2 pt-1 border-t border-border/40">
              <div className="h-11 w-20 bg-muted/60 rounded-lg" />
              <div className="h-11 w-20 bg-muted/70 rounded-lg" />
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
          icon={<FileText strokeWidth={1.5} />}
          illustration={emptyIllustration}
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      </div>
    );
  }

  return (
    <div
      className={cn("p-3 space-y-3", className)}
      data-slot="document-card-list"
    >
      {documents.map((doc) => {
        const urgencyConfig = getUrgencyBadgeConfig(doc.urgency);
        const step = getLedgerStepLabel(doc.status, doc.workflowStatus, doc.type);
        const stepStatus = { new: "NOT_STARTED", progress: "IN_PROGRESS", review: "WAITING_APPROVAL", done: "COMPLETED" }[step.kind];
        const typeLabel = getDocTypeLabel(doc.type);
        const displayCode = doc.documentNumber || "";
        const labelCode = displayCode || doc.summary;
        const isSelectedRow = selectedIds.has(doc.id);
        const isCurrentActive = selectedDocument?.id === doc.id;

        return (
          <div
            key={doc.id}
            role="button"
            tabIndex={0}
            data-doc-id={doc.id}
            onClick={() => onSelectDocument?.(doc)}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectDocument?.(doc);
              }
            }}
            className={cn(
              "p-3 rounded-lg border border-border/70 bg-card space-y-2.5 transition-colors cursor-pointer select-none",
              "active:bg-muted/40 outline-none focus-visible:ring-2 focus-visible:ring-primary",
              isSelectedRow && "border-primary/40 bg-primary/5",
              isCurrentActive && "ring-1 ring-primary/40"
            )}
            data-slot="mobile-document-card"
          >
            {/* Header Row: Checkbox (optional) + Code & Badges */}
            <div className="flex flex-col gap-1.5">
              <div className="flex w-full items-center gap-2 min-w-0">
                {selectable && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="min-h-[44px] min-w-[32px] flex items-center justify-center"
                  >
                    <input
                      type="checkbox"
                      checked={isSelectedRow}
                      onChange={(e) => {
                        onToggleSelect?.(doc.id, (e.nativeEvent as MouseEvent)?.shiftKey);
                      }}
                      aria-label={`Chọn văn bản ${labelCode}`}
                      className="size-4 rounded border-border/80 text-primary focus:ring-primary/20 accent-primary cursor-pointer"
                    />
                  </div>
                )}
                <span className="min-w-0 break-words font-mono tabular-nums font-medium text-compact text-foreground">
                  {displayCode}
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {doc.urgency &&
                  doc.urgency !== "normal" &&
                  doc.urgency !== "THUONG" && (
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border",
                        urgencyConfig.className
                      )}
                    >
                      {urgencyConfig.label}
                    </span>
                  )}
                <span
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <TaskStatusCircle status={stepStatus} />
                  <span>{step.label}</span>
                </span>
              </div>
            </div>

            {/* Document Title / Summary */}
            <p className="text-compact font-medium text-foreground line-clamp-2 leading-relaxed">
              {doc.summary}
            </p>

            {/* Metadata Row: Loại văn bản · Ngày ban hành */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5 truncate">
                <span className="font-medium text-foreground">{typeLabel}</span>
                <span>•</span>
                <span className="font-mono tabular-nums">
                  {formatLedgerDate(doc.issuedDate) || "—"}
                </span>
              </div>
              {doc.issuingAuthority && (
                <span className="truncate max-w-[140px] text-right font-medium">
                  {doc.issuingAuthority}
                </span>
              )}
            </div>

            {/* Linked task notice (if linked) */}
            {doc.linkedTaskId && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="pt-0.5"
              >
                <Link
                  href={`/?taskId=${doc.linkedTaskId}`}
                  className="inline-flex max-w-full items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 border border-emerald-500/20 text-xs font-semibold transition-colors"
                >
                  <CheckCircle2 className="size-3" strokeWidth={1.5} />
                  <span>Nhiệm vụ:</span>
                  <span className="min-w-0 truncate">{doc.linkedTaskTitle || "Xem nhiệm vụ"}</span>
                  <ArrowRight className="size-2.5" strokeWidth={1.5} />
                </Link>
              </div>
            )}

            {/* Nút hành động: 44px trên điện thoại, 28px trên desktop (Button sm) */}
            <div
              className="flex items-center justify-end gap-2 pt-1"
              onClick={(e) => e.stopPropagation()}
            >
              {doc.fileAttachment && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewPdf?.(doc)}
                  className="text-primary"
                  aria-label={`Xem PDF văn bản ${labelCode}`}
                >
                  <FileText strokeWidth={1.5} />
                  <span>Xem PDF</span>
                </Button>
              )}

              <Button
                variant="secondary"
                size="sm"
                onClick={() => onSelectDocument?.(doc)}
                aria-label={`Chi tiết văn bản ${labelCode}`}
              >
                <span>Chi tiết</span>
                <ChevronRight strokeWidth={1.5} />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
