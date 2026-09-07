"use client";

import * as React from "react";
import {
  Inbox,
  Send,
  FileText,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  User,
  ShieldCheck,
  Paperclip,
  Download,
  Edit,
  PenTool,
  Share2,
} from "lucide-react";
import type {
  DocumentItem,
  DocumentType,
  DocumentUrgency,
  DocumentSecurityLevel,
  DocumentStatus,
} from "@/types/document";
import { Button } from "@/components/ui/button";
import { DocumentPdfViewer } from "./document-pdf-viewer";

export interface DocumentSplitViewProps {
  document: DocumentItem;
  className?: string;
  onDirectiveClick?: () => void;
  onAssignClick?: () => void;
  onEditClick?: () => void;
  onClose?: () => void;
  actions?: React.ReactNode;
}

export function getDocumentTypeInfo(type: DocumentType): {
  label: string;
  numberPrefix: string;
  icon: typeof Inbox;
  badgeClass: string;
} {
  switch (type) {
    case "VAN_BAN_DEN":
    case "inbox":
      return {
        label: "Văn bản đến",
        numberPrefix: "Số đến",
        icon: Inbox,
        badgeClass: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20",
      };
    case "VAN_BAN_DI":
    case "outbox":
      return {
        label: "Văn bản đi",
        numberPrefix: "Số đi",
        icon: Send,
        badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
      };
    case "TO_TRINH_NOI_BO":
    case "submission":
    default:
      return {
        label: "Tờ trình nội bộ",
        numberPrefix: "Số tờ trình",
        icon: FileText,
        badgeClass: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
      };
  }
}

export function getUrgencyBadge(urgency: DocumentUrgency): {
  label: string;
  className: string;
} {
  switch (urgency) {
    case "HOA_TOC":
    case "flash":
      return {
        label: "Hỏa tốc",
        className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30 font-bold",
      };
    case "THUONG_KHAN":
    case "top_urgent":
      return {
        label: "Thượng khẩn",
        className: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 font-semibold",
      };
    case "KHAN":
    case "urgent":
      return {
        label: "Khẩn",
        className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 font-medium",
      };
    case "THUONG":
    case "normal":
    default:
      return {
        label: "Thường",
        className: "bg-muted text-muted-foreground border-border/60",
      };
  }
}

export function getSecurityBadge(security: DocumentSecurityLevel): {
  label: string;
  className: string;
} {
  switch (security) {
    case "TUYET_MAT":
      return {
        label: "Tuyệt mật",
        className: "bg-red-950/40 text-red-400 border-red-800 font-bold",
      };
    case "TOI_MAT":
      return {
        label: "Tối mật",
        className: "bg-rose-900/30 text-rose-400 border-rose-700 font-semibold",
      };
    case "MAT":
      return {
        label: "Mật",
        className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 font-medium",
      };
    case "THUONG":
    default:
      return {
        label: "Thường",
        className: "bg-muted text-muted-foreground border-border/60",
      };
  }
}

export function getStatusBadge(status: DocumentStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case "CHO_PHAN_CONG":
    case "pending_assignment":
      return {
        label: "Chờ phân công",
        className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 font-medium",
      };
    case "DANG_XU_LY":
    case "processing":
      return {
        label: "Đang xử lý",
        className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 font-medium",
      };
    case "CHO_PHE_DUYET":
      return {
        label: "Chờ phê duyệt",
        className: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20 font-medium",
      };
    case "DA_HOAN_THANH":
    case "completed":
    case "approved":
      return {
        label: "Đã hoàn thành",
        className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 font-medium",
      };
    case "LUU_THEO_DOI":
    case "delegated":
    default:
      return {
        label: "Lưu theo dõi",
        className: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-400 border-zinc-500/20",
      };
  }
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "---";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

export function DocumentSplitView({
  document: doc,
  className = "",
  onDirectiveClick,
  onAssignClick,
  onEditClick,
  actions,
}: DocumentSplitViewProps) {
  const attachments = doc.attachments || [];
  const [selectedAttachmentId, setSelectedAttachmentId] = React.useState<string>(
    attachments[0]?.id || ""
  );

  const activeAttachment =
    attachments.find((a) => a.id === selectedAttachmentId) || attachments[0] || null;

  const typeInfo = getDocumentTypeInfo(doc.type);
  const urgencyInfo = getUrgencyBadge(doc.urgency);
  const securityInfo = getSecurityBadge(doc.securityLevel);
  const statusInfo = getStatusBadge(doc.status);
  const TypeIcon = typeInfo.icon;

  const isIncoming = doc.type === "VAN_BAN_DEN" || doc.type === "inbox";
  const isOutgoing = doc.type === "VAN_BAN_DI" || doc.type === "outbox";

  return (
    <div
      className={`grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 w-full ${className}`}
    >
      {/* LEFT PANE: PDF SCAN VIEWER & ATTACHMENT SELECTOR */}
      <div className="flex flex-col gap-3 min-h-[500px]">
        {/* Attachment Tabs (when multiple attachments exist) */}
        {attachments.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border/50">
            <span className="text-xs font-medium text-muted-foreground mr-1 flex items-center gap-1 shrink-0">
              <Paperclip className="size-3.5" strokeWidth={1.5} />
              <span>Tệp đính kèm ({attachments.length}):</span>
            </span>
            {attachments.map((att) => {
              const isSelected = att.id === (activeAttachment?.id || "");
              return (
                <button
                  key={att.id}
                  type="button"
                  onClick={() => setSelectedAttachmentId(att.id)}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary font-medium shadow-xs"
                      : "bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/80 hover:text-foreground"
                  }`}
                >
                  <span className="truncate max-w-[140px]">{att.fileName}</span>
                  {att.isOriginal && (
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                        isSelected
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-red-500/10 text-red-600 dark:text-red-400"
                      }`}
                    >
                      Gốc
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* PDF Viewer Component */}
        <div className="flex-1 flex flex-col">
          <DocumentPdfViewer
            fileUrl={activeAttachment?.fileUrl || null}
            fileName={activeAttachment?.fileName || `${doc.originalNumber || "van-ban"}.pdf`}
            fileSize={activeAttachment?.fileSize}
            mimeType={activeAttachment?.mimeType || "application/pdf"}
            className="h-full"
          />
        </div>
      </div>

      {/* RIGHT PANE: ND 30/2020 LEGAL METADATA & DIRECTIVES */}
      <div className="flex flex-col gap-4 overflow-y-auto">
        {/* Top Header Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/70 shadow-xs space-y-3.5">
          {/* Badge Strip */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs border font-semibold ${typeInfo.badgeClass}`}
              >
                <TypeIcon className="size-3.5" strokeWidth={1.5} />
                {typeInfo.label}
              </span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs border ${urgencyInfo.className}`}
              >
                {urgencyInfo.label}
              </span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs border ${securityInfo.className}`}
              >
                {securityInfo.label}
              </span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs border ${statusInfo.className}`}
              >
                {statusInfo.label}
              </span>
            </div>

            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-muted/60 text-foreground border border-border/40 tabular-nums">
              {typeInfo.numberPrefix} #{doc.registrationNumber} / Năm {doc.documentYear}
            </span>
          </div>

          {/* Original Document Number & Category */}
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {doc.category}
              </span>
              <span className="text-sm sm:text-base font-mono font-bold text-foreground">
                Số: {doc.originalNumber}
              </span>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Building2 className="size-3.5 shrink-0" strokeWidth={1.5} />
              <span>Cơ quan ban hành:</span>
              <span className="font-semibold text-foreground">{doc.issuingAuthority}</span>
            </p>
          </div>

          {/* Summary / Trích yếu nội dung */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
              Trích yếu nội dung văn bản
            </span>
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 text-sm font-medium text-foreground leading-relaxed">
              {doc.summary}
            </div>
          </div>

          {/* Dates & Department Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs pt-1">
            <div className="p-2.5 rounded-xl bg-muted/20 border border-border/40 space-y-1">
              <span className="text-muted-foreground font-medium flex items-center gap-1">
                <Calendar className="size-3.5" strokeWidth={1.5} />
                Ngày văn bản ký:
              </span>
              <p className="font-mono font-semibold text-foreground pl-4.5 tabular-nums">
                {formatDate(doc.issuedDate)}
              </p>
            </div>

            <div className="p-2.5 rounded-xl bg-muted/20 border border-border/40 space-y-1">
              <span className="text-muted-foreground font-medium flex items-center gap-1">
                <Clock className="size-3.5" strokeWidth={1.5} />
                Ngày vào sổ hệ thống:
              </span>
              <p className="font-mono font-semibold text-foreground pl-4.5 tabular-nums">
                {formatDate(doc.registeredDate)}
              </p>
            </div>

            {/* Department Handling info */}
            {isIncoming && (
              <div className="p-2.5 rounded-xl bg-muted/20 border border-border/40 space-y-1 sm:col-span-2">
                <span className="text-muted-foreground font-medium flex items-center gap-1">
                  <Building2 className="size-3.5" strokeWidth={1.5} />
                  Đơn vị chủ trì giải quyết:
                </span>
                <p className="font-semibold text-foreground pl-4.5">
                  {doc.leadDepartmentName || "Chưa phân công"}
                </p>
              </div>
            )}

            {/* Outgoing specific info */}
            {isOutgoing && (
              <>
                <div className="p-2.5 rounded-xl bg-muted/20 border border-border/40 space-y-1">
                  <span className="text-muted-foreground font-medium flex items-center gap-1">
                    <User className="size-3.5" strokeWidth={1.5} />
                    Người ký ban hành:
                  </span>
                  <p className="font-semibold text-foreground pl-4.5">
                    {doc.signerName || "---"}{" "}
                    {doc.signerTitle && (
                      <span className="text-muted-foreground font-normal">
                        ({doc.signerTitle})
                      </span>
                    )}
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-muted/20 border border-border/40 space-y-1">
                  <span className="text-muted-foreground font-medium flex items-center gap-1">
                    <Building2 className="size-3.5" strokeWidth={1.5} />
                    Đơn vị soạn thảo:
                  </span>
                  <p className="font-semibold text-foreground pl-4.5">
                    {doc.draftingDeptName || "---"}
                  </p>
                </div>

                {doc.recipientList && (
                  <div className="p-2.5 rounded-xl bg-muted/20 border border-border/40 space-y-1 sm:col-span-2">
                    <span className="text-muted-foreground font-medium flex items-center gap-1">
                      <Share2 className="size-3.5" strokeWidth={1.5} />
                      Nơi nhận văn bản:
                    </span>
                    <p className="font-medium text-foreground pl-4.5">
                      {doc.recipientList}
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Due date countdown */}
            {doc.dueDate && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <span className="text-amber-700 dark:text-amber-400 font-bold flex items-center gap-1">
                    <AlertTriangle className="size-3.5" strokeWidth={1.5} />
                    Hạn xử lý theo quy định:
                  </span>
                  <span className="font-mono text-amber-700 dark:text-amber-400 font-semibold tabular-nums">
                    {formatDate(doc.dueDate)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Leadership Directives & Tasks History (Bút phê BGH) */}
        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/70 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-primary" strokeWidth={1.5} />
              Ý kiến Bút phê & Chỉ đạo của Ban Giám Hiệu
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              Điều 23 NĐ 30/2020
            </span>
          </div>

          {doc.directives && doc.directives.length > 0 ? (
            <div className="space-y-3">
              {doc.directives.map((dir) => (
                <div
                  key={dir.id}
                  className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-primary flex items-center gap-1">
                      <User className="size-3.5" strokeWidth={1.5} />
                      {dir.leaderName || "Lãnh đạo BGH"}
                    </span>
                    {dir.createdAt && (
                      <span className="text-muted-foreground font-mono text-xs tabular-nums">
                        {formatDate(dir.createdAt)}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-foreground font-medium italic pl-4 border-l-2 border-primary/40 leading-relaxed">
                    &ldquo;{dir.instruction}&rdquo;
                  </p>

                  <div className="flex items-center justify-between text-xs pt-1 flex-wrap gap-2">
                    <span className="text-muted-foreground">
                      Đơn vị xử lý:{" "}
                      <strong className="text-foreground">
                        {dir.assignedDeptName || dir.assignedDeptId}
                      </strong>
                    </span>

                    {dir.isTaskGenerated ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                        <CheckCircle2 className="size-3" strokeWidth={1.5} />
                        Đã tạo Nhiệm vụ trường
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Chưa sinh nhiệm vụ</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-dashed border-border/70 bg-muted/10 text-center space-y-1.5">
              <p className="text-xs text-muted-foreground">
                Văn bản này chưa có ý kiến bút phê chỉ đạo từ Ban Giám Hiệu.
              </p>
              {onDirectiveClick && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDirectiveClick}
                  className="h-7 text-xs rounded-lg gap-1.5 text-primary border-primary/30 hover:bg-primary/5"
                >
                  <PenTool className="size-3.5" strokeWidth={1.5} />
                  <span>Ghi bút phê chỉ đạo ngay</span>
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between gap-2 p-3 bg-muted/30 rounded-2xl border border-border/60 flex-wrap">
          {actions ? (
            actions
          ) : (
            <>
              <div className="flex items-center gap-2">
                {(onDirectiveClick || onAssignClick) && (
                  <Button
                    size="sm"
                    onClick={onDirectiveClick || onAssignClick}
                    className="h-8 px-3 text-xs rounded-xl gap-1.5 font-semibold"
                  >
                    <PenTool className="size-3.5" strokeWidth={1.5} />
                    <span>Giao xử lý / Bút phê</span>
                  </Button>
                )}
                {onEditClick && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onEditClick}
                    className="h-8 px-3 text-xs rounded-xl gap-1.5"
                  >
                    <Edit className="size-3.5" strokeWidth={1.5} />
                    <span>Chỉnh sửa</span>
                  </Button>
                )}
              </div>

              {activeAttachment?.fileUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="h-8 px-3 text-xs rounded-xl gap-1.5"
                >
                  <a
                    href={activeAttachment.fileUrl}
                    download={activeAttachment.fileName}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="size-3.5" strokeWidth={1.5} />
                    <span>Tải văn bản scan</span>
                  </a>
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
