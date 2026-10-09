"use client";

import * as React from "react";
import { TaskStatusCircle } from "@/components/tasks/task-status-circle";
import { getLedgerStepLabel } from "@/lib/documents/document-ledger-format";
import { OutgoingWorkflowStepper } from "./outgoing-workflow-stepper";
import { OutgoingActionPanel } from "./outgoing-action-panel";
import { OutgoingRecipientList } from "./outgoing-recipient-list";
import {
  CollapsibleSection,
  DocumentTitleBlock,
  InspectorCard,
  InspectorRow,
  MetaInline,
} from "./document-detail-parts";
import { DocumentFullPage } from "./workspace/document-full-page";
import type { DocumentFile } from "./document-file-viewer";
import { sortDocumentFiles } from "@/lib/documents/file-viewer-state";
import type { OutgoingDocumentStatus } from "@/contracts/documents";

// Serializable subset of DocumentOutgoingWorkflow + relations
export interface OutgoingWorkflowDetail {
  id: string;
  documentId: string;
  status: OutgoingDocumentStatus;
  currentVersion?: number | null;
  outgoingNumberStr?: string | null;
  recipientList?: string | null;
  createdAt: string;
  updatedAt?: string | null;

  // Timestamps
  contentReviewSubmittedAt?: string | null;
  contentApprovedAt?: string | null;
  contentReviewNotes?: string | null;
  formatReviewSubmittedAt?: string | null;
  formatApprovedAt?: string | null;
  formatReviewNotes?: string | null;
  authorizedSignedAt?: string | null;
  signingNotes?: string | null;
  numberedAt?: string | null;
  orgSignedAt?: string | null;
  issuedAt?: string | null;

  // Relations (serialized)
  contentReviewer?: { id: string; name: string } | null;
  formatReviewer?: { id: string; name: string } | null;
  authorizedSigner?: { id: string; name: string } | null;
  numberer?: { id: string; name: string } | null;
  orgSigner?: { id: string; name: string } | null;
  issuer?: { id: string; name: string } | null;

  document: {
    id: string;
    summary?: string | null;
    category?: string | null;
    securityLevel?: string | null;
    urgency?: string | null;
    originalNumber?: string | null;
    issuedDate?: string | null;
    attachments: Array<{
      id: string;
      fileName: string;
      fileUrl: string;
      fileSize?: bigint | number | null;
      mimeType?: string | null;
      isOriginal?: boolean;
    }>;
  };
}

const SECURITY_LABEL: Record<string, string> = {
  PUBLIC: "Thường",
  INTERNAL: "Nội bộ",
  CONFIDENTIAL: "Mật",
  SECRET: "Tuyệt mật",
};

const URGENCY_LABEL: Record<string, string> = {
  NORMAL: "Thường",
  URGENT: "Khẩn",
  IMMEDIATE: "Thượng khẩn",
  EXPRESS: "Hỏa tốc",
};

const STEP_STATUS = { new: "NOT_STARTED", progress: "IN_PROGRESS", review: "WAITING_APPROVAL", done: "COMPLETED" } as const;

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

export interface OutgoingDocumentDetailViewProps {
  workflow: OutgoingWorkflowDetail;
  currentUser: { id: string; name: string; role: string } | null;
}

export function OutgoingDocumentDetailView({
  workflow,
  currentUser,
}: OutgoingDocumentDetailViewProps) {
  const doc = workflow.document;

  const toBytes = (size?: bigint | number | null) =>
    size ? (typeof size === "bigint" ? Number(size) : size) : undefined;
  // Bản gốc đứng đầu để mở đầu tiên
  const files: DocumentFile[] = sortDocumentFiles(doc.attachments).map((a) => ({
    id: a.id,
    name: a.fileName,
    url: a.fileUrl,
    sizeBytes: toBytes(a.fileSize) ?? null,
    mimeType: a.mimeType ?? null,
  }));

  const step = getLedgerStepLabel("DANG_XU_LY", workflow.status, "outbox");
  const issued = formatDate(doc.issuedDate ?? workflow.issuedAt);
  const isConfidential = doc.securityLevel && doc.securityLevel !== "PUBLIC";
  const isUrgent = doc.urgency && doc.urgency !== "NORMAL";

  return (
    <DocumentFullPage
      docId={doc.id}
      breadcrumb={{ href: "/documents?type=outbox", label: "Văn bản đi", current: workflow.outgoingNumberStr ?? "Chưa cấp số" }}
      header={
        <DocumentTitleBlock
          title={doc.summary || "Văn bản đi"}
          eyebrow={
            <MetaInline
              items={[
                isUrgent ? <span className="font-medium text-foreground">{URGENCY_LABEL[doc.urgency!] ?? doc.urgency}</span> : null,
                isConfidential ? `Độ mật: ${SECURITY_LABEL[doc.securityLevel!] ?? doc.securityLevel}` : null,
              ]}
            />
          }
          meta={
            <MetaInline
              items={[
                workflow.outgoingNumberStr ? <span className="font-mono">{workflow.outgoingNumberStr}</span> : "Chưa cấp số",
                doc.category,
                issued ? `Ban hành ${issued}` : null,
              ]}
            />
          }
        />
      }
      actions={
        currentUser ? (
          <OutgoingActionPanel
            documentId={workflow.documentId}
            status={workflow.status}
            currentUserId={currentUser.id}
            className="border-0 bg-transparent p-0 [&>h3]:sr-only"
          />
        ) : null
      }
      files={files}
      panel={
        <>
          <InspectorCard title="Thuộc tính">
            <InspectorRow label="Trạng thái">
              <span className="inline-flex items-center gap-1.5">
                <TaskStatusCircle status={STEP_STATUS[step.kind]} />
                {step.label}
              </span>
            </InspectorRow>
            {workflow.currentVersion ? <InspectorRow label="Phiên bản" mono>v{workflow.currentVersion}</InspectorRow> : null}
            {workflow.authorizedSigner ? <InspectorRow label="Người ký">{workflow.authorizedSigner.name}</InspectorRow> : null}
            {workflow.issuer ? <InspectorRow label="Phát hành">{workflow.issuer.name}</InspectorRow> : null}
            {workflow.issuedAt ? <InspectorRow label="Ngày phát hành" mono>{formatDate(workflow.issuedAt)}</InspectorRow> : null}
          </InspectorCard>

          <OutgoingRecipientList recipientList={workflow.recipientList} status={workflow.status} issuedAt={workflow.issuedAt} />

          <CollapsibleSection title="Quy trình xử lý" summary={step.label}>
            <OutgoingWorkflowStepper workflow={workflow} className="border-0 bg-transparent p-0 [&>h3]:sr-only" />
          </CollapsibleSection>
        </>
      }
    />
  );
}
