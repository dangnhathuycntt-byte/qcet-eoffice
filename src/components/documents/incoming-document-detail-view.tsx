"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Check, Loader2, Paperclip } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DocumentAuditTimeline } from "@/components/documents/document-audit-timeline";
import { cn } from "@/lib/utils";
import { getLedgerDueNote, getLedgerUrgencyTag, todayInVietnam } from "@/lib/documents/document-ledger-format";

const DocumentPdfViewer = dynamic(
  () => import("./document-pdf-viewer").then((mod) => mod.DocumentPdfViewer),
  {
    ssr: false,
    loading: () => <div role="status" className="p-8 text-center text-xs text-muted-foreground animate-pulse">Đang tải trình xem tệp…</div>,
  }
);

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

/** "25/09 15:20" theo giờ Việt Nam. */
function formatShortDateTime(raw: string | null | undefined): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Ho_Chi_Minh",
  }).formatToParts(d);
  const get = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  return `${get("day")}/${get("month")} ${get("hour")}:${get("minute")}`;
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

  const isConfidential =
    doc.securityLevel && doc.securityLevel !== "THUONG" && doc.securityLevel !== "PUBLIC";
  const urgencyTag = getLedgerUrgencyTag((doc.urgency ?? "THUONG") as any);
  const isDone = ["RESOLVED", "FILED", "ARCHIVED"].includes(status);
  const deadline = detail.deadline ?? doc.dueDate ?? null;
  const dueNote = getLedgerDueNote(deadline?.slice(0, 10), isDone, todayInVietnam());

  const [attachmentId, setAttachmentId] = React.useState<string | null>(doc.attachments[0]?.id ?? null);
  const attachment = doc.attachments.find((a) => a.id === attachmentId) ?? doc.attachments[0] ?? null;

  const regLabel =
    doc.registrationNumber != null ? String(doc.registrationNumber).padStart(4, "0") : null;

  // Luân chuyển: chỉ dựng từ mốc thời gian thật của workflow.
  const leadName = detail.leadUnit?.name;
  const steps: { id: string; label: string; at?: string | null }[] = [
    { id: "registered", label: `Văn thư vào sổ${regLabel ? `, số đến ${regLabel}` : ""}`, at: detail.createdAt },
    { id: "presented", label: "Trình lãnh đạo", at: detail.presentedAt },
    { id: "directed", label: leadName ? `Bút phê, giao ${leadName}` : "Bút phê", at: detail.directedAt },
    {
      id: "processing",
      label: leadName ? `Đang xử lý tại ${leadName}` : "Đang xử lý",
      at: detail.unitAssignments[0]?.createdAt ?? null,
    },
    { id: "resolved", label: "Đã giải quyết", at: detail.resolvedAt },
    { id: "filed", label: "Lập hồ sơ, lưu", at: detail.filedAt },
  ];
  const currentIdx = steps.findIndex((st) => !st.at);

  const sentence = isDone
    ? STATUS_LABEL[status] ?? status
    : status === "UNIT_ASSIGNED_PERSON" && leadName
    ? `${leadName} đang xử lý`
    : STATUS_LABEL[status] ?? status;

  const kv: { label: string; value: React.ReactNode; mono?: boolean }[] = [
    { label: "Số, ký hiệu", value: doc.originalNumber, mono: true },
    { label: "Ngày văn bản", value: formatDate(doc.issuedDate), mono: true },
    { label: "Cơ quan ban hành", value: doc.issuingAuthority },
    { label: "Loại văn bản", value: doc.category },
    { label: "Ngày đến", value: formatDate(doc.receivedDate), mono: true },
    { label: "Chủ trì", value: leadName },
    { label: "Người phụ trách", value: detail.unitAssignments.map((a) => a.driUser.name).join(", ") },
    {
      label: "Nhiệm vụ liên kết",
      value: doc.linkedTaskId ? (
        <Link href={`/tasks/${doc.linkedTaskId}`} className="underline decoration-border underline-offset-3 hover:decoration-foreground">
          Xem nhiệm vụ
        </Link>
      ) : null,
    },
    { label: "Kết quả giải quyết", value: detail.resolutionSummary },
    { label: "Hồ sơ lưu", value: detail.dossierId, mono: true },
  ];

  const quotes = detail.directives.length
    ? detail.directives.map((d) => ({ id: d.id, text: d.content, who: d.leader.name, at: d.issuedAt }))
    : detail.leadershipInstruction
    ? [{ id: "instruction", text: detail.leadershipInstruction, who: detail.leader?.name ?? "Lãnh đạo", at: detail.directedAt }]
    : [];

  return (
    <div className="w-full" data-slot="incoming-document-detail">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 h-8 text-xs text-muted-foreground">
        <Link href="/documents?type=inbox" className="hover:text-foreground transition-colors">Văn bản đến</Link>
        <span aria-hidden>›</span>
        <span className="font-medium text-foreground font-mono">
          {regLabel ? `Số đến ${regLabel}${doc.issuedDate ? `/${doc.issuedDate.slice(0, 4)}` : ""}` : doc.originalNumber ?? "Chi tiết"}
        </span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] rounded-xl overflow-hidden bg-card shadow-xs lg:h-[calc(100vh-7rem)]">
        {/* Trình xem tệp */}
        <div className="bg-muted/50 flex flex-col min-w-0 min-h-[320px]">
          <div className="h-10 shrink-0 flex items-center gap-2 px-3 bg-card text-compact text-muted-foreground border-b border-border/50">
            <Paperclip className="size-3.5 shrink-0" strokeWidth={1.5} />
            {doc.attachments.length > 1 ? (
              <select
                aria-label="Chọn tệp đính kèm"
                value={attachment?.id ?? ""}
                onChange={(e) => setAttachmentId(e.target.value)}
                className="h-7 max-w-[60%] rounded-md bg-transparent text-compact text-foreground font-medium outline-none hover:bg-muted/60 px-1"
              >
                {doc.attachments.map((a) => (
                  <option key={a.id} value={a.id}>{a.fileName}</option>
                ))}
              </select>
            ) : (
              <span className="truncate text-foreground font-medium">{attachment?.fileName ?? "Chưa có tệp đính kèm"}</span>
            )}
            {attachment?.fileSize ? (
              <span className="text-xs text-muted-foreground/80 shrink-0">· {Math.max(1, Math.round(attachment.fileSize / 1024))} KB</span>
            ) : null}
          </div>
          <div className="flex-1 min-h-0 p-3">
            {attachment ? (
              <DocumentPdfViewer
                fileUrl={attachment.fileUrl}
                fileName={attachment.fileName}
                mimeType={attachment.mimeType ?? undefined}
                className="h-full w-full"
              />
            ) : (
              <div className="h-full grid place-items-center text-compact text-muted-foreground">Văn bản chưa có tệp đính kèm</div>
            )}
          </div>
        </div>

        {/* Sổ + luân chuyển */}
        <aside className="min-w-0 overflow-y-auto px-5 pt-5 pb-6 space-y-5 border-t lg:border-t-0 lg:border-l border-border/50">
          <header className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              {urgencyTag ? (
                <>
                  <b className={cn("font-bold tracking-wide", urgencyTag.tone === "danger" ? "text-rose-600" : "text-amber-600")}>{urgencyTag.label}</b>
                  <span aria-hidden>·</span>
                </>
              ) : null}
              <span>Văn bản đến</span>
              {isConfidential ? (
                <>
                  <span aria-hidden>·</span>
                  <span>Độ mật: {SECURITY_LABEL[doc.securityLevel!] ?? doc.securityLevel}</span>
                </>
              ) : null}
            </div>
            <h1 className="text-sm font-semibold leading-snug tracking-tight text-foreground">{doc.summary || "Văn bản đến"}</h1>
          </header>

          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/60 pl-3 pr-1.5 py-1.5">
            <span className="text-compact text-foreground/90">
              {sentence}
              {deadline && !isDone ? (
                <>
                  {" · hạn "}
                  <b className={cn("font-mono font-semibold", dueNote?.tone === "danger" ? "text-rose-600" : dueNote?.tone === "warning" ? "text-amber-600" : "")}>
                    {formatDate(deadline).slice(0, 5)}
                  </b>
                  {dueNote ? <span className={cn("ml-1 font-medium", dueNote.tone === "danger" ? "text-rose-600" : dueNote.tone === "warning" ? "text-amber-600" : "text-muted-foreground")}>{dueNote.text.charAt(0).toLowerCase() + dueNote.text.slice(1)}</span> : null}
                </>
              ) : null}
            </span>
            <span className="flex-1" />
            {actions.map((action, i) => (
              <button
                key={action.key}
                type="button"
                disabled={pendingAction !== null}
                onClick={() => executeAction(action.key, action.body ?? {}, action.confirmMsg)}
                className={cn(
                  "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-compact font-medium transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 disabled:cursor-not-allowed",
                  action.variant === "destructive"
                    ? "text-rose-600 hover:bg-rose-500/10"
                    : i === actions.findIndex((a) => a.variant !== "destructive")
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-card text-foreground border border-border/70 hover:bg-muted/60"
                )}
              >
                {pendingAction === action.key ? <Loader2 className="size-3 animate-spin" strokeWidth={1.5} /> : null}
                {action.label}
              </button>
            ))}
          </div>

          {quotes.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold text-muted-foreground">Ý kiến chỉ đạo</h2>
              {quotes.map((q) => (
                <figure key={q.id} className="rounded-lg bg-muted/40 px-3 py-2.5">
                  {q.text ? <blockquote className="text-compact leading-relaxed text-foreground">“{q.text}”</blockquote> : null}
                  <figcaption className="mt-1.5 text-xs text-muted-foreground">
                    {q.who}
                    {q.at ? <> · <span className="font-mono">{formatShortDateTime(q.at)}</span></> : null}
                  </figcaption>
                </figure>
              ))}
            </section>
          ) : null}

          <dl className="grid grid-cols-[112px_minmax(0,1fr)] gap-x-3 gap-y-2 text-compact">
            {kv.filter((row) => row.value).map((row) => (
              <React.Fragment key={row.label}>
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className={cn("min-w-0 break-words text-foreground", row.mono && "font-mono text-xs leading-[18px]")}>{row.value}</dd>
              </React.Fragment>
            ))}
          </dl>

          <section className="space-y-2.5">
            <h2 className="text-xs font-semibold text-muted-foreground">Luân chuyển</h2>
            <ol className="space-y-2">
              {steps.map((st, i) => {
                const done = Boolean(st.at);
                const current = i === currentIdx;
                return (
                  <li key={st.id} className={cn("flex items-center gap-2.5 text-compact", !done && !current && "text-muted-foreground/70")}>
                    <span
                      className={cn(
                        "grid size-4 shrink-0 place-items-center rounded-full border",
                        done ? "border-foreground bg-foreground text-background" : current ? "border-foreground" : "border-border"
                      )}
                      aria-hidden
                    >
                      {done ? <Check className="size-2.5" strokeWidth={1.5} /> : current ? <span className="size-1.5 rounded-full bg-foreground" /> : null}
                    </span>
                    <span className={cn("flex-1 min-w-0 truncate", current && "font-medium text-foreground")}>{st.label}</span>
                    {st.at ? <span className="shrink-0 font-mono text-xs text-muted-foreground/80">{formatShortDateTime(st.at)}</span> : null}
                  </li>
                );
              })}
            </ol>
          </section>

          <details className="group text-compact">
            <summary className="cursor-pointer text-xs font-semibold text-muted-foreground hover:text-foreground list-none">
              Nhật ký hệ thống
            </summary>
            <div className="mt-2"><DocumentAuditTimeline documentId={doc.id} /></div>
          </details>
        </aside>
      </div>
    </div>
  );
}
