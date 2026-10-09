"use client";

import * as React from "react";
import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { DocumentAuditTimeline } from "@/components/documents/document-audit-timeline";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getLedgerDueNote, getLedgerUrgencyTag, todayInVietnam } from "@/lib/documents/document-ledger-format";
import {
  CollapsibleSection,
  DocumentTitleBlock,
  InspectorCard,
  InspectorRow,
  LinkedTaskRow,
  MetaInline,
  type LinkedTaskSummary,
} from "./document-detail-parts";
import { DocumentFullPage } from "./workspace/document-full-page";
import type { DocumentFile } from "./document-file-viewer";
import { sortDocumentFiles } from "@/lib/documents/file-viewer-state";

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
    linkedTask?: LinkedTaskSummary | null;
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
  const doneCount = steps.filter((st) => st.at).length;

  const sentence = isDone
    ? STATUS_LABEL[status] ?? status
    : status === "UNIT_ASSIGNED_PERSON" && leadName
    ? `${leadName} đang xử lý`
    : STATUS_LABEL[status] ?? status;

  const assignees = detail.unitAssignments.map((a) => a.driUser.name).join(", ");

  const quotes = detail.directives.length
    ? detail.directives.map((d) => ({ id: d.id, text: d.content, who: d.leader.name, at: d.issuedAt }))
    : detail.leadershipInstruction
    ? [{ id: "instruction", text: detail.leadershipInstruction, who: detail.leader?.name ?? "Lãnh đạo", at: detail.directedAt }]
    : [];

  const primaryActionIdx = actions.findIndex((a) => a.variant !== "destructive");
  const linkedTask = doc.linkedTask ?? (doc.linkedTaskId ? { id: doc.linkedTaskId } : null);

  const files: DocumentFile[] = sortDocumentFiles(doc.attachments).map((a) => ({
    id: a.id,
    name: a.fileName,
    url: a.fileUrl,
    sizeBytes: a.fileSize ?? null,
    mimeType: a.mimeType ?? null,
  }));

  return (
    <DocumentFullPage
      docId={doc.id}
      breadcrumb={{
        href: "/documents?type=inbox",
        label: "Văn bản đến",
        current: regLabel ? `Số đến ${regLabel}${doc.issuedDate ? `/${doc.issuedDate.slice(0, 4)}` : ""}` : doc.originalNumber ?? "Chi tiết",
      }}
      header={
        <DocumentTitleBlock
          title={doc.summary || "Văn bản đến"}
          eyebrow={
            <MetaInline
              items={[
                urgencyTag ? (
                  <span className={cn("font-medium", urgencyTag.tone === "danger" ? "text-destructive" : "text-foreground")}>
                    {URGENCY_LABEL[doc.urgency!] ?? urgencyTag.label}
                  </span>
                ) : null,
                isConfidential ? `Độ mật: ${SECURITY_LABEL[doc.securityLevel!] ?? doc.securityLevel}` : null,
              ]}
            />
          }
          meta={
            <MetaInline
              items={[
                doc.originalNumber ? <span className="font-mono">{doc.originalNumber}</span> : null,
                doc.issuingAuthority,
                doc.issuedDate ? `Ngày ${formatDate(doc.issuedDate)}` : null,
              ]}
            />
          }
        />
      }
      actions={
        // Trạng thái + thao tác: chỉ thao tác chính dùng màu nhấn
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="min-w-0 flex-1 text-compact text-foreground">
            {sentence}
            {deadline && !isDone ? (
              <span className="text-muted-foreground">
                {" · hạn "}
                <span className="tabular-nums text-foreground">{formatDate(deadline).slice(0, 5)}</span>
                {dueNote ? (
                  <span className={cn("ml-1", dueNote.tone === "danger" ? "text-destructive" : "text-muted-foreground")}>
                    {dueNote.text.charAt(0).toLowerCase() + dueNote.text.slice(1)}
                  </span>
                ) : null}
              </span>
            ) : null}
          </p>
          {actions.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {actions.map((action, i) => (
                <Button
                  key={action.key}
                  size="sm"
                  variant={i === primaryActionIdx ? "default" : "ghost"}
                  className={cn(action.variant === "destructive" && "text-destructive hover:text-destructive")}
                  disabled={pendingAction !== null}
                  onClick={() => executeAction(action.key, action.body ?? {}, action.confirmMsg)}
                >
                  {pendingAction === action.key ? <Loader2 className="size-3 animate-spin" strokeWidth={1.5} /> : null}
                  {action.label}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      }
      files={files}
      panel={
        <>
          <InspectorCard title="Thuộc tính">
            {regLabel ? <InspectorRow label="Số đến" mono>{regLabel}</InspectorRow> : null}
            {doc.receivedDate ? <InspectorRow label="Ngày đến" mono>{formatDate(doc.receivedDate)}</InspectorRow> : null}
            {doc.category ? <InspectorRow label="Loại văn bản">{doc.category}</InspectorRow> : null}
            {deadline ? <InspectorRow label="Hạn xử lý" mono>{formatDate(deadline)}</InspectorRow> : null}
            {leadName ? <InspectorRow label="Chủ trì">{leadName}</InspectorRow> : null}
            {assignees ? <InspectorRow label="Phụ trách">{assignees}</InspectorRow> : null}
            {detail.resolutionSummary ? <InspectorRow label="Kết quả">{detail.resolutionSummary}</InspectorRow> : null}
            {detail.dossierId ? <InspectorRow label="Hồ sơ lưu" mono>{detail.dossierId}</InspectorRow> : null}
          </InspectorCard>

          <InspectorCard title="Nhiệm vụ liên kết" count={linkedTask ? 1 : 0}>
            {linkedTask ? (
              <LinkedTaskRow task={linkedTask} />
            ) : (
              <p className="py-1 text-xs text-muted-foreground">Chưa gán nhiệm vụ trong Kho việc.</p>
            )}
          </InspectorCard>

          {quotes.length > 0 ? (
            <InspectorCard title="Ý kiến chỉ đạo" count={quotes.length}>
              <div className="space-y-3 pt-1">
                {quotes.map((q) => (
                  <figure key={q.id} className="border-l-2 border-border pl-3">
                    {q.text ? <blockquote className="text-compact leading-relaxed text-foreground">{q.text}</blockquote> : null}
                    <figcaption className="mt-1 text-xs text-muted-foreground">
                      {q.who}
                      {q.at ? <> · <span className="tabular-nums">{formatShortDateTime(q.at)}</span></> : null}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </InspectorCard>
          ) : null}

          <div className="space-y-1">
            <CollapsibleSection title="Luân chuyển" summary={`${doneCount}/${steps.length} bước`}>
              <ol className="space-y-2 pb-2">
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
                      <span className={cn("min-w-0 flex-1 truncate", current && "font-medium text-foreground")}>{st.label}</span>
                      {st.at ? <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatShortDateTime(st.at)}</span> : null}
                    </li>
                  );
                })}
              </ol>
            </CollapsibleSection>

            <CollapsibleSection title="Nhật ký hệ thống">
              <DocumentAuditTimeline documentId={doc.id} bare />
            </CollapsibleSection>
          </div>
        </>
      }
    />
  );
}
