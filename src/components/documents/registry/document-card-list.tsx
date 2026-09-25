"use client";

import * as React from "react";
import Link from "next/link";
import {
  FileText,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
  CheckCircle2,
  ArrowRight,
  Building2,
  Calendar,
  User,
} from "lucide-react";
import { OfficialDocument, DocumentType } from "@/types/document";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getUrgencyBadgeConfig,
  getStatusBadgeConfig,
} from "../document-detail-dialog";

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
  emptyTitle = "Không tìm thấy văn bản phù hợp",
  emptyDescription = "Thử điều chỉnh bộ lọc hoặc từ khóa tìm kiếm.",
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
            className="p-3.5 rounded-2xl border border-border/60 bg-card/60 animate-pulse space-y-2.5"
          >
            <div className="flex justify-between items-center">
              <div className="h-4 w-28 bg-muted rounded" />
              <div className="h-4 w-16 bg-muted/70 rounded" />
            </div>
            <div className="h-4 w-5/6 bg-muted rounded" />
            <div className="h-3 w-1/2 bg-muted/60 rounded" />
            <div className="flex justify-end gap-2 pt-1 border-t border-border/40">
              <div className="h-9 w-20 bg-muted/60 rounded-xl" />
              <div className="h-9 w-20 bg-muted/70 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div
        className={cn(
          "py-8 px-4 text-center space-y-2 border border-dashed border-destructive/40 rounded-2xl bg-destructive/5 m-3",
          className
        )}
        data-slot="document-card-list"
      >
        <AlertTriangle
          className="size-7 mx-auto text-amber-500 opacity-80"
          strokeWidth={1.5}
        />
        <p className="text-xs font-semibold text-foreground">
          Không thể tải dữ liệu văn bản
        </p>
        <p className="text-xs text-muted-foreground">{error}</p>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="min-h-[44px] px-4 gap-1.5 text-xs rounded-xl mt-1 cursor-pointer active:scale-[0.98]"
          >
            <RefreshCw className="size-3.5" />
            <span>Thử lại</span>
          </Button>
        )}
      </div>
    );
  }

  // Empty State
  if (documents.length === 0) {
    return (
      <div
        className={cn(
          "py-10 px-4 text-center space-y-1.5 border border-dashed border-border/70 rounded-2xl bg-muted/10 m-3 select-none",
          className
        )}
        data-slot="document-card-list"
      >
        <FileText
          className="size-8 mx-auto mb-2 opacity-50 text-muted-foreground"
          strokeWidth={1.5}
        />
        <p className="text-xs font-semibold text-foreground">{emptyTitle}</p>
        <p className="text-xs text-muted-foreground">{emptyDescription}</p>
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
        const statusConfig = getStatusBadgeConfig(doc.status);
        const StatusIcon = statusConfig.icon;
        const typeLabel = getDocTypeLabel(doc.type);
        const displayCode = doc.documentNumber || doc.id;
        const isSelectedRow = selectedIds.has(doc.id);
        const isCurrentActive = selectedDocument?.id === doc.id;

        return (
          <div
            key={doc.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelectDocument?.(doc)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectDocument?.(doc);
              }
            }}
            className={cn(
              "p-3.5 rounded-2xl border border-border/70 bg-card shadow-2xs space-y-2.5 transition-all cursor-pointer select-none",
              "active:bg-muted/40 active:scale-[0.99]",
              isSelectedRow && "border-primary/40 bg-primary/5",
              isCurrentActive && "ring-1 ring-primary/40"
            )}
            data-slot="mobile-document-card"
          >
            {/* Header Row: Checkbox (optional) + Code & Badges */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
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
                      aria-label={`Chọn văn bản ${displayCode}`}
                      className="size-4 rounded border-border/80 text-primary focus:ring-primary/20 accent-primary cursor-pointer"
                    />
                  </div>
                )}
                <span className="font-mono tabular-nums font-bold text-sm text-primary tracking-tight break-all">
                  {displayCode}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                {doc.urgency &&
                  doc.urgency !== "normal" &&
                  doc.urgency !== "THUONG" && (
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border",
                        urgencyConfig.className
                      )}
                    >
                      {urgencyConfig.label}
                    </span>
                  )}
                <span
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border",
                    statusConfig.className
                  )}
                >
                  <StatusIcon className="size-3" strokeWidth={1.5} />
                  <span>{statusConfig.label}</span>
                </span>
              </div>
            </div>

            {/* Document Title / Summary */}
            <p className="text-xs font-semibold text-foreground line-clamp-2 leading-relaxed">
              {doc.summary}
            </p>

            {/* Metadata Row: Loại văn bản · Ngày ban hành */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5 truncate">
                <span className="font-medium text-foreground">{typeLabel}</span>
                <span>•</span>
                <span className="font-mono tabular-nums">
                  {doc.issuedDate || "---"}
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
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 border border-emerald-500/20 text-xs font-semibold transition-colors"
                >
                  <CheckCircle2 className="size-3" strokeWidth={1.5} />
                  <span>Nhiệm vụ:</span>
                  <span className="font-mono">{doc.linkedTaskId}</span>
                  <ArrowRight className="size-2.5" strokeWidth={1.5} />
                </Link>
              </div>
            )}

            {/* Action Buttons (Touch Target >= 44px) */}
            <div
              className="flex items-center justify-end gap-2 pt-1"
              onClick={(e) => e.stopPropagation()}
            >
              {doc.fileAttachment && (
                <button
                  type="button"
                  onClick={() => onViewPdf?.(doc)}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl border border-primary/30 bg-primary/10 text-primary text-xs font-semibold flex items-center gap-1.5 active:bg-primary/20 active:scale-[0.98] transition-all cursor-pointer"
                  aria-label={`Xem PDF văn bản ${displayCode}`}
                >
                  <FileText strokeWidth={1.5} className="size-4 shrink-0" />
                  <span>Xem PDF</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onSelectDocument?.(doc)}
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-border/70 bg-muted/40 text-foreground text-xs font-semibold flex items-center gap-1 hover:bg-muted/80 active:bg-muted active:scale-[0.98] transition-all cursor-pointer"
                aria-label={`Chi tiết văn bản ${displayCode}`}
              >
                <span>Chi tiết</span>
                <ChevronRight strokeWidth={1.5} className="size-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
