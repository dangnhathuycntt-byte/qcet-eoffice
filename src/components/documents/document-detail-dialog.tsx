"use client";

import * as React from "react";
import Link from "next/link";
import {
  X,
  FileText,
  Calendar,
  Building2,
  User,
  ExternalLink,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Send,
  Inbox,
  ArrowRight,
  Printer,
  ShieldCheck,
} from "lucide-react";
import { OfficialDocument, DocumentUrgency, DocumentStatus } from "@/types/document";
import { Button } from "@/components/ui/button";

interface DocumentDetailDialogProps {
  document: OfficialDocument | null;
  isOpen: boolean;
  onClose: () => void;
  onViewPdf?: (doc: OfficialDocument) => void;
}

export function getUrgencyBadgeConfig(urgency: DocumentUrgency): {
  label: string;
  className: string;
} {
  switch (urgency) {
    case "flash":
      return {
        label: "Hỏa tốc",
        className: "bg-red-500/15 text-red-700 border-red-500/30 font-bold animate-pulse",
      };
    case "top_urgent":
      return {
        label: "Thượng khẩn",
        className: "bg-rose-500/15 text-rose-700 border-rose-500/30 font-semibold",
      };
    case "urgent":
      return {
        label: "Khẩn",
        className: "bg-amber-500/15 text-amber-700 border-amber-500/30 font-medium",
      };
    case "normal":
    default:
      return {
        label: "Thường",
        className: "bg-muted text-muted-foreground border-border/60",
      };
  }
}

export function getStatusBadgeConfig(status: DocumentStatus): {
  label: string;
  className: string;
  icon: typeof Clock;
} {
  switch (status) {
    case "pending_assignment":
      return {
        label: "Chờ bút phê",
        className: "bg-amber-500/10 text-amber-700 border-amber-500/20",
        icon: Clock,
      };
    case "processing":
      return {
        label: "Đang xử lý",
        className: "bg-blue-500/10 text-blue-700 border-blue-500/20",
        icon: Clock,
      };
    case "delegated":
      return {
        label: "Đã liên thông giao việc",
        className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 font-medium",
        icon: CheckCircle2,
      };
    case "approved":
      return {
        label: "Đã ký duyệt",
        className: "bg-indigo-500/10 text-indigo-700 border-indigo-500/20",
        icon: ShieldCheck,
      };
    case "completed":
    default:
      return {
        label: "Hoàn tất & Lưu trữ",
        className: "bg-zinc-500/10 text-zinc-700 border-zinc-500/20",
        icon: CheckCircle2,
      };
  }
}

export function DocumentDetailDialog({
  document: doc,
  isOpen,
  onClose,
  onViewPdf,
}: DocumentDetailDialogProps) {
  // ESC key handler
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !doc) return null;

  const urgencyConfig = getUrgencyBadgeConfig(doc.urgency);
  const statusConfig = getStatusBadgeConfig(doc.status);
  const StatusIcon = statusConfig.icon;

  const typeLabels: Record<string, { label: string; icon: any; color: string }> = {
    inbox: { label: "Văn bản đến", icon: Inbox, color: "text-sky-600 bg-sky-500/10" },
    outbox: { label: "Văn bản đi", icon: Send, color: "text-emerald-600 bg-emerald-500/10" },
    submission: { label: "Tờ trình", icon: FileText, color: "text-purple-600 bg-purple-500/10" },
    VAN_BAN_DEN: { label: "Văn bản đến", icon: Inbox, color: "text-sky-600 bg-sky-500/10" },
    VAN_BAN_DI: { label: "Văn bản đi", icon: Send, color: "text-emerald-600 bg-emerald-500/10" },
    TO_TRINH_NOI_BO: { label: "Tờ trình", icon: FileText, color: "text-purple-600 bg-purple-500/10" },
  };
  const currentType = typeLabels[doc.type] || typeLabels.inbox;
  const TypeIcon = currentType.icon;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-detail-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-2xl bg-card border-0 sm:border border-border/70 rounded-none sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between p-4 sm:p-5 border-b border-border/60 bg-muted/20">
          <div className="flex items-start gap-3 min-w-0 pr-2">
            <div
              className={`p-2.5 rounded-xl border border-border/40 shrink-0 ${currentType.color}`}
            >
              <TypeIcon className="size-5" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {currentType.label}
                </span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs border ${urgencyConfig.className}`}
                >
                  {urgencyConfig.label}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border ${statusConfig.className}`}
                >
                  <StatusIcon className="size-3" strokeWidth={1.5} />
                  <span>{statusConfig.label}</span>
                </span>
              </div>
              <h2
                id="doc-detail-title"
                className="text-base sm:text-lg font-bold font-mono text-foreground tracking-tight tabular-nums"
              >
                {doc.documentNumber}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors shrink-0 cursor-pointer"
          >
            <X className="size-5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Summary */}
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
              Trích yếu nội dung văn bản
            </span>
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 text-sm font-medium text-foreground leading-relaxed">
              {doc.summary}
            </div>
          </div>

          {/* Legal Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl border border-border/50 bg-card space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Building2 className="size-3.5" strokeWidth={1.5} />
                <span className="font-medium">Cơ quan ban hành:</span>
              </div>
              <p className="font-semibold text-foreground pl-5">{doc.issuingAuthority}</p>
            </div>

            <div className="p-3 rounded-xl border border-border/50 bg-card space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <User className="size-3.5" strokeWidth={1.5} />
                <span className="font-medium">Người ký:</span>
              </div>
              <p className="font-semibold text-foreground pl-5">{doc.signatory}</p>
            </div>

            <div className="p-3 rounded-xl border border-border/50 bg-card space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="size-3.5" strokeWidth={1.5} />
                <span className="font-medium">Ngày ban hành:</span>
              </div>
              <p className="font-mono font-medium text-foreground pl-5">{doc.issuedDate}</p>
            </div>

            <div className="p-3 rounded-xl border border-border/50 bg-card space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="size-3.5" strokeWidth={1.5} />
                <span className="font-medium">
                  {doc.type === "inbox" ? "Ngày vào sổ đến:" : "Đơn vị chủ trì:"}
                </span>
              </div>
              <p className="font-medium text-foreground pl-5">
                {doc.type === "inbox" ? doc.receivedDate || doc.issuedDate : doc.leadDepartment}
              </p>
            </div>
          </div>

          {/* Leadership Directives (Bút phê chỉ đạo) */}
          <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="size-3.5" strokeWidth={1.5} />
                Bút phê & Chỉ đạo của Ban Giám Hiệu
              </span>
              <span className="text-xs text-muted-foreground font-mono">Nghị định 30/2020</span>
            </div>
            <p className="text-xs text-foreground/90 italic pl-5 leading-relaxed">
              &ldquo;Chuyển {doc.leadDepartment} chủ trì, phối hợp các đơn vị liên quan triển khai đúng tiến độ và báo cáo Ban Giám Hiệu kết quả thực hiện.&rdquo;
            </p>
          </div>

          {/* Linked QCET Task Integration */}
          {doc.linkedTaskId ? (
            <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5" strokeWidth={1.5} />
                  Nhiệm vụ liên thông QCET Unified Task Hub
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 font-semibold">
                  {doc.linkedTaskId}
                </span>
              </div>
              <p className="text-xs font-medium text-foreground">
                {doc.linkedTaskTitle || "Nhiệm vụ trực tiếp giao từ văn bản"}
              </p>
              <div className="pt-1 flex items-center justify-end">
                <Link
                  href={`/?taskId=${doc.linkedTaskId}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline"
                >
                  <span>Chuyển tới Bàn làm việc</span>
                  <ArrowRight className="size-3.5" strokeWidth={1.5} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl border border-dashed border-border/70 bg-muted/10 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Văn bản này chưa gán nhiệm vụ phái sinh trong Kho việc.
              </span>
              <Link
                href="/tasks"
                className="inline-flex items-center gap-1 font-semibold text-primary hover:underline text-xs"
              >
                <span>Tạo nhiệm vụ liên kết</span>
                <ExternalLink className="size-3" strokeWidth={1.5} />
              </Link>
            </div>
          )}

          {/* File Attachment */}
          {doc.fileAttachment && (
            <div className="p-3 rounded-xl border border-border/60 bg-muted/20 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-lg bg-red-500/10 text-red-600 shrink-0">
                  <FileText className="size-4" strokeWidth={1.5} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {doc.fileAttachment.name}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">
                    PDF • {doc.fileAttachment.size} • Đã ký số cơ quan
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {onViewPdf && (
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="min-h-[44px] px-3 gap-1.5 text-xs rounded-xl font-semibold cursor-pointer"
                    onClick={() => {
                      onClose();
                      onViewPdf(doc);
                    }}
                  >
                    <FileText className="size-4" strokeWidth={1.5} />
                    <span>Xem PDF</span>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-[44px] px-3 gap-1.5 text-xs rounded-xl font-medium cursor-pointer"
                  onClick={() => {
                    alert(`Đang mở tải tệp đính kèm: ${doc.fileAttachment?.name}`);
                  }}
                >
                  <Download className="size-4" strokeWidth={1.5} />
                  <span className="hidden sm:inline">Tải về</span>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-t border-border/60 bg-muted/20">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.print()}
            className="min-h-[44px] px-3 gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <Printer className="size-4" strokeWidth={1.5} />
            <span>In phiếu văn bản</span>
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="min-h-[44px] px-5 text-xs font-semibold rounded-xl cursor-pointer"
            >
              Đóng
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
