"use client";

import * as React from "react";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import {
  FileText,
  Calendar,
  Building2,
  User,
  Clock,
  ArrowLeft,
  Shield,
  AlertTriangle,
  Hash,
  Tag,
  Zap,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Paperclip,
  Download,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fadeVariants } from "@/lib/motion/variants";
import { motionTransition } from "@/lib/motion/tokens";
import { DocumentAuditTimeline } from "@/components/documents/document-audit-timeline";
import { cn } from "@/lib/utils";

// Serializable shape passed from server component
export interface IncomingDocumentDetail {
  id: string;
  documentId: string;
  status: string;
  createdAt: string;
  updatedAt?: string | null;

  // Workflow timestamps
  presentedAt?: string | null;
  presenterNotes?: string | null;
  directedAt?: string | null;
  leadershipInstruction?: string | null;
  deadline?: string | null;
  resolvedAt?: string | null;
  resolutionSummary?: string | null;
  resolutionDocUrl?: string | null;
  filedAt?: string | null;
  dossierId?: string | null;
  filingNotes?: string | null;

  // Relations
  leadUnit?: { id: string; name: string; code: string } | null;
  leader?: { id: string; name: string; email: string } | null;

  unitAssignments: {
    id: string;
    status: string;
    instruction?: string | null;
    deadline?: string | null;
    createdAt?: string | null;
    driUser: { id: string; name: string; email: string };
    assignedBy: { id: string; name: string; email: string };
  }[];

  directives: {
    id: string;
    content?: string | null;
    issuedAt?: string | null;
    leader: { id: string; name: string; email: string };
  }[];

  document: {
    id: string;
    summary?: string | null;
    category?: string | null;
    securityLevel?: string | null;
    urgency?: string | null;
    originalNumber?: string | null;
    issuedDate?: string | null;
    issuingAuthority?: string | null;
    registrationNumber?: number | null;
    receivedDate?: string | null;
    dueDate?: string | null;
    linkedTaskId?: string | null;
    attachments: {
      id: string;
      fileName: string;
      fileUrl: string;
      fileSize?: number | null;
      mimeType?: string | null;
      isOriginal?: boolean;
    }[];
  };
}

export interface IncomingDocumentDetailViewProps {
  detail: IncomingDocumentDetail;
  currentUser: { id: string; name: string; role: string } | null;
}

const SECURITY_LABEL: Record<string, string> = {
  THUONG: "Thường",
  PUBLIC: "Thường",
  INTERNAL: "Nội bộ",
  MAT: "Mật",
  CONFIDENTIAL: "Mật",
  TUYET_MAT: "Tuyệt mật",
  SECRET: "Tuyệt mật",
};

const URGENCY_LABEL: Record<string, string> = {
  THUONG: "Thường",
  NORMAL: "Thường",
  KHAN: "Khẩn",
  URGENT: "Khẩn",
  THUONG_KHAN: "Thượng khẩn",
  IMMEDIATE: "Thượng khẩn",
  HOA_TOC: "Hỏa tốc",
  EXPRESS: "Hỏa tốc",
};

const STATUS_LABEL: Record<string, string> = {
  REGISTERED: "Đã vào sổ",
  PRESENTED: "Đã trình lãnh đạo",
  DIRECTED: "Đã có bút phê",
  UNIT_ASSIGNED_PERSON: "Đã phân công",
  RESOLVED: "Đã giải quyết",
  FILED: "Đã lập hồ sơ",
  ARCHIVED: "Đã lưu trữ",
};

function formatDate(raw: string | null | undefined): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

function formatDateTime(raw: string | null | undefined): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

function MetaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-xs">
      <Icon className="size-3.5 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.5} />
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  );
}

export function IncomingDocumentDetailView({
  detail,
  currentUser,
}: IncomingDocumentDetailViewProps) {
  const doc = detail.document;
  const router = useRouter();
  const [pendingAction, setPendingAction] = React.useState<string | null>(null);

  async function executeAction(
    actionPath: string,
    body: Record<string, unknown>,
    confirmMsg: string
  ) {
    if (!window.confirm(confirmMsg)) return;
    setPendingAction(actionPath);
    try {
      const res = await fetch(
        `/api/documents/${detail.document.id}/actions/${actionPath}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Lỗi không xác định" }));
        window.alert(err.error ?? "Thao tác thất bại");
        return;
      }
      router.refresh();
    } catch {
      window.alert("Lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setPendingAction(null);
    }
  }

  type ActionDef = {
    key: string;
    label: string;
    confirmMsg: string;
    body?: Record<string, unknown>;
    variant?: "destructive";
  };

  const actions: ActionDef[] = [];
  const role = currentUser?.role;
  const status = detail.status;

  // FSM: REGISTERED → PRESENTED → DIRECTED → UNIT_ASSIGNED_PERSON → RESOLVED → FILED → ARCHIVED
  if (status === "REGISTERED" && role === "VAN_THU") {
    actions.push({
      key: "present",
      label: "Trình lãnh đạo",
      confirmMsg: "Trình văn bản này lên lãnh đạo?",
      body: {},
    });
  }
  if (status === "PRESENTED" && role === "BAN_GIAM_HIEU") {
    actions.push({
      key: "direct",
      label: "Bút phê",
      confirmMsg: "Xác nhận bút phê cho văn bản này?",
      body: { instruction: "" },
    });
  }
  if (status === "DIRECTED" && role === "TRUONG_PHONG") {
    actions.push({
      key: "assign-unit",
      label: "Phân công",
      confirmMsg: "Phân công xử lý văn bản này?",
      body: {},
    });
  }
  if (status === "UNIT_ASSIGNED_PERSON" && role === "CHUYEN_VIEN") {
    actions.push({
      key: "resolve",
      label: "Báo cáo kết quả",
      confirmMsg: "Xác nhận đã giải quyết văn bản này?",
      body: { summary: "" },
    });
  }
  if (status === "RESOLVED" && role === "VAN_THU") {
    actions.push({
      key: "file",
      label: "Lập hồ sơ",
      confirmMsg: "Lập hồ sơ cho văn bản này?",
      body: {},
    });
  }
  // Cross-status content approval (BGH)
  if (role === "BAN_GIAM_HIEU" && ["DIRECTED", "UNIT_ASSIGNED_PERSON"].includes(status)) {
    actions.push({
      key: "approve-content",
      label: "Duyệt nội dung",
      confirmMsg: "Phê duyệt nội dung văn bản này?",
      body: {},
    });
    actions.push({
      key: "reject-content",
      label: "Từ chối nội dung",
      confirmMsg: "Từ chối nội dung văn bản này?",
      body: { reason: "" },
      variant: "destructive",
    });
  }

  const isUrgent = doc.urgency && doc.urgency !== "THUONG" && doc.urgency !== "NORMAL";
  const isConfidential =
    doc.securityLevel && doc.securityLevel !== "THUONG" && doc.securityLevel !== "PUBLIC";

  return (
    <AnimatePresence mode="wait">
      <m.div
        key={detail.id}
        variants={fadeVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={motionTransition}
        className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-4 pb-24 md:pb-10 space-y-4"
      >
        {/* Back navigation */}
        <div className="flex items-center gap-2">
          <Link
            href="/documents"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
          >
            <ArrowLeft className="size-3.5" strokeWidth={1.5} />
            Văn bản &amp; Hồ sơ
          </Link>
        </div>

        {/* Document header card */}
        <div className="rounded-xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card,0_1px_3px_rgba(0,0,0,0.06))]">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-muted text-foreground shrink-0 mt-0.5">
              <FileText className="size-5" strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  Văn bản đến
                </span>
                {isUrgent && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 border border-amber-500/20">
                    <Zap className="size-3" strokeWidth={1.5} />
                    {URGENCY_LABEL[doc.urgency!] ?? doc.urgency}
                  </span>
                )}
                {isConfidential && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-700 border border-rose-500/20">
                    <Shield className="size-3" strokeWidth={1.5} />
                    {SECURITY_LABEL[doc.securityLevel!] ?? doc.securityLevel}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/60">
                  <CheckCircle2 className="size-3" strokeWidth={1.5} />
                  {STATUS_LABEL[detail.status] ?? detail.status}
                </span>
              </div>

              <h1 className="text-base font-semibold text-foreground font-heading leading-snug">
                {doc.summary || "Văn bản đến"}
              </h1>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                {doc.originalNumber && (
                  <span className="inline-flex items-center gap-1 text-xs text-foreground">
                    <Hash className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                    <span className="font-mono font-medium">{doc.originalNumber}</span>
                  </span>
                )}
                {doc.category && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Tag className="size-3.5" strokeWidth={1.5} />
                    {doc.category}
                  </span>
                )}
                {doc.issuedDate && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="size-3.5" strokeWidth={1.5} />
                    {formatDate(doc.issuedDate)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main 2-col layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
          {/* Left: metadata + timeline */}
          <div className="space-y-4 min-w-0">
            {/* Document metadata */}
            <section className="rounded-xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card,0_1px_3px_rgba(0,0,0,0.06))]">
              <h2 className="text-xs font-semibold text-foreground mb-3">
                Thông tin văn bản
              </h2>
              <div className="space-y-2.5">
                <MetaRow
                  icon={Hash}
                  label="Số văn bản"
                  value={doc.originalNumber}
                />
                {doc.registrationNumber != null && (
                  <MetaRow
                    icon={Hash}
                    label="Số vào sổ"
                    value={`${doc.registrationNumber}`}
                  />
                )}
                <MetaRow
                  icon={Building2}
                  label="Cơ quan ban hành"
                  value={doc.issuingAuthority}
                />
                <MetaRow
                  icon={Calendar}
                  label="Ngày ban hành"
                  value={formatDate(doc.issuedDate)}
                />
                <MetaRow
                  icon={Calendar}
                  label="Ngày đến"
                  value={formatDate(doc.receivedDate)}
                />
                <MetaRow
                  icon={Tag}
                  label="Loại văn bản"
                  value={doc.category}
                />
                {isUrgent && (
                  <MetaRow
                    icon={AlertTriangle}
                    label="Mức độ khẩn"
                    value={URGENCY_LABEL[doc.urgency!] ?? doc.urgency}
                  />
                )}
                {isConfidential && (
                  <MetaRow
                    icon={Shield}
                    label="Mức bảo mật"
                    value={SECURITY_LABEL[doc.securityLevel!] ?? doc.securityLevel}
                  />
                )}
                {doc.dueDate && (
                  <MetaRow
                    icon={Clock}
                    label="Hạn xử lý"
                    value={
                      <span className="text-amber-700 font-medium">{formatDate(doc.dueDate)}</span>
                    }
                  />
                )}
                {doc.linkedTaskId && (
                  <div className="flex items-start gap-2 text-xs">
                    <ExternalLink
                      className="size-3.5 text-muted-foreground shrink-0 mt-0.5"
                      strokeWidth={1.5}
                    />
                    <span className="text-muted-foreground shrink-0">Nhiệm vụ liên kết:</span>
                    <Link
                      href={`/tasks/${doc.linkedTaskId}`}
                      className="text-foreground font-medium hover:underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                    >
                      Xem nhiệm vụ
                    </Link>
                  </div>
                )}
              </div>
            </section>

            {/* Audit timeline */}
            <section className="rounded-xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card,0_1px_3px_rgba(0,0,0,0.06))]">
              <h2 className="text-xs font-semibold text-foreground mb-3">
                Tiến trình luân chuyển
              </h2>
              <DocumentAuditTimeline documentId={doc.id} />
            </section>
          </div>

          {/* Right: sticky sidebar */}
          <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
            {/* Leadership directive (bút phê) */}
            {detail.directives.length > 0 && (
              <section className="rounded-xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card,0_1px_3px_rgba(0,0,0,0.06))]">
                <h2 className="text-xs font-semibold text-foreground mb-3">
                  Bút phê BGH
                </h2>
                <div className="space-y-3">
                  {detail.directives.map((directive) => (
                    <div
                      key={directive.id}
                      className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-1.5"
                    >
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <User className="size-3.5" strokeWidth={1.5} />
                        <span className="font-medium text-foreground">
                          {directive.leader.name}
                        </span>
                        {directive.issuedAt && (
                          <span className="ml-auto font-mono text-[11px]">
                            {formatDateTime(directive.issuedAt)}
                          </span>
                        )}
                      </div>
                      {directive.content && (
                        <p className="text-xs text-foreground leading-relaxed italic border-l-2 border-border pl-2.5">
                          {directive.content}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {detail.directives.length === 0 && ["PRESENTED"].includes(detail.status) && (
              <section className="rounded-xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card,0_1px_3px_rgba(0,0,0,0.06))]">
                <p className="text-xs text-muted-foreground text-center py-2">Chưa có bút phê</p>
              </section>
            )}

            {/* Attachments */}
            {doc.attachments.length > 0 && (
              <section className="rounded-xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card,0_1px_3px_rgba(0,0,0,0.06))]">
                <h2 className="text-xs font-semibold text-foreground mb-3">
                  Tệp đính kèm ({doc.attachments.length})
                </h2>
                <div className="space-y-2">
                  {doc.attachments.map((att) => (
                    <a
                      key={att.id}
                      href={att.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 rounded-lg bg-muted/20 border border-border/50 hover:bg-muted/30 transition-colors group focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <Paperclip className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{att.fileName}</p>
                        {att.fileSize && (
                          <p className="text-[11px] text-muted-foreground">
                            {(att.fileSize / 1024).toFixed(0)} KB
                          </p>
                        )}
                      </div>
                      <Download className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* Lead unit */}
            {(detail.leadUnit || detail.leader) && (
              <section className="rounded-xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card,0_1px_3px_rgba(0,0,0,0.06))]">
                <h2 className="text-xs font-semibold text-foreground mb-3">
                  Đơn vị chủ trì
                </h2>
                <div className="space-y-2">
                  {detail.leadUnit && (
                    <div className="flex items-center gap-2 text-xs">
                      <Building2 className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
                      <span className="font-medium text-foreground">{detail.leadUnit.name}</span>
                      <span className="text-muted-foreground font-mono text-[11px]">
                        ({detail.leadUnit.code})
                      </span>
                    </div>
                  )}
                  {detail.leader && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="size-3.5 shrink-0" strokeWidth={1.5} />
                      <span className="text-foreground">{detail.leader.name}</span>
                    </div>
                  )}
                  {detail.directedAt && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="size-3.5 shrink-0" strokeWidth={1.5} />
                      <span>{formatDateTime(detail.directedAt)}</span>
                    </div>
                  )}
                  {detail.leadershipInstruction && (
                    <div className="mt-2 p-2.5 rounded-lg bg-muted/40 border border-border/50 text-xs text-foreground leading-relaxed italic">
                      {detail.leadershipInstruction}
                    </div>
                  )}
                  {detail.deadline && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-md font-mono">
                      <Clock className="size-3.5 shrink-0" strokeWidth={1.5} />
                      Hạn: {formatDate(detail.deadline)}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Unit assignments */}
            {detail.unitAssignments.length > 0 && (
              <section className="rounded-xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card,0_1px_3px_rgba(0,0,0,0.06))]">
                <h2 className="text-xs font-semibold text-foreground mb-3">
                  Phân công ({detail.unitAssignments.length})
                </h2>
                <div className="space-y-3">
                  {detail.unitAssignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="p-3 rounded-lg bg-muted/20 border border-border/50 space-y-1.5"
                    >
                      <div className="flex items-center gap-1.5 text-xs">
                        <User className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
                        <span className="font-medium text-foreground">{assignment.driUser.name}</span>
                        <span
                          className={cn(
                            "ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded border",
                            assignment.status === "COMPLETED"
                              ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                              : assignment.status === "IN_PROGRESS"
                              ? "bg-blue-500/10 text-blue-700 border-blue-500/20"
                              : "bg-muted text-muted-foreground border-border/60"
                          )}
                        >
                          {assignment.status}
                        </span>
                      </div>
                      {assignment.instruction && (
                        <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-border pl-2.5">
                          {assignment.instruction}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        <span>Bởi: {assignment.assignedBy.name}</span>
                        {assignment.deadline && (
                          <span className="text-amber-700">Hạn: {formatDate(assignment.deadline)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {detail.unitAssignments.length === 0 && ["DIRECTED"].includes(detail.status) && (
              <section className="rounded-xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card,0_1px_3px_rgba(0,0,0,0.06))]">
                <p className="text-xs text-muted-foreground text-center py-2">Chưa phân công xử lý</p>
              </section>
            )}

            {/* Resolution */}
            {detail.resolvedAt && (
              <section className="rounded-xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card,0_1px_3px_rgba(0,0,0,0.06))]">
                <h2 className="text-xs font-semibold text-foreground mb-3">
                  Kết quả giải quyết
                </h2>
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="size-3.5 shrink-0" strokeWidth={1.5} />
                    <span>{formatDateTime(detail.resolvedAt)}</span>
                  </div>
                  {detail.resolutionSummary && (
                    <p className="text-xs text-foreground leading-relaxed">{detail.resolutionSummary}</p>
                  )}
                  {detail.resolutionDocUrl && (
                    <a
                      href={detail.resolutionDocUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-foreground hover:underline underline-offset-2 rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <ExternalLink className="size-3.5" strokeWidth={1.5} />
                      Văn bản kết quả
                    </a>
                  )}
                </div>
              </section>
            )}

            {/* Filing info */}
            {detail.filedAt && (
              <section className="rounded-xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card,0_1px_3px_rgba(0,0,0,0.06))]">
                <h2 className="text-xs font-semibold text-foreground mb-3">
                  Lưu trữ hồ sơ
                </h2>
                <div className="space-y-2 text-xs">
                  {detail.dossierId && (
                    <div className="flex items-center gap-2">
                      <Hash className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
                      <span className="text-muted-foreground">Hồ sơ:</span>
                      <span className="font-mono font-medium text-foreground">{detail.dossierId}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="size-3.5 shrink-0" strokeWidth={1.5} />
                    <span>{formatDateTime(detail.filedAt)}</span>
                  </div>
                  {detail.filingNotes && (
                    <p className="text-muted-foreground leading-relaxed italic">{detail.filingNotes}</p>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>

        {/* Action buttons */}
        {actions.length > 0 && (
          <section className="rounded-xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card,0_1px_3px_rgba(0,0,0,0.06))]">
            <h2 className="text-xs font-semibold text-foreground mb-3">
              Thao tác
            </h2>
            <div className="flex flex-wrap gap-2">
              {actions.map((action) => (
                <button
                  key={action.key}
                  disabled={pendingAction !== null}
                  onClick={() =>
                    executeAction(action.key, action.body ?? {}, action.confirmMsg)
                  }
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 rounded-lg text-xs font-medium transition-colors active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    action.variant === "destructive"
                      ? "bg-red-500/10 text-red-700 hover:bg-red-500/20 border border-red-500/20"
                      : "bg-foreground/5 text-foreground hover:bg-foreground/10 border border-border/60",
                    pendingAction !== null && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {pendingAction === action.key && (
                    <Loader2 className="size-3 animate-spin" strokeWidth={1.5} />
                  )}
                  {action.label}
                </button>
              ))}
            </div>
          </section>
        )}
      </m.div>
    </AnimatePresence>
  );
}
