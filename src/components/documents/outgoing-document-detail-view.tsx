"use client";

import * as React from "react";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import {
  FileText,
  Calendar,
  Hash,
  Tag,
  Shield,
  Zap,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { fadeVariants } from "@/lib/motion/variants";
import { OutgoingWorkflowStepper } from "./outgoing-workflow-stepper";
import { OutgoingActionPanel } from "./outgoing-action-panel";
import { OutgoingRecipientList } from "./outgoing-recipient-list";
import { DocumentPdfViewer } from "./document-pdf-viewer";
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

  // Pick primary attachment for PDF viewer (prefer isOriginal)
  const primaryAttachment =
    doc.attachments.find((a) => a.isOriginal) ?? doc.attachments[0] ?? null;

  const fileSize = primaryAttachment?.fileSize
    ? typeof primaryAttachment.fileSize === "bigint"
      ? Number(primaryAttachment.fileSize)
      : primaryAttachment.fileSize
    : undefined;

  return (
    <AnimatePresence mode="wait">
      <m.div
        key={workflow.id}
        variants={fadeVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-4 pb-24 md:pb-10 space-y-4"
      >
        {/* Back navigation */}
        <div className="flex items-center gap-2">
          <Link
            href="/documents"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" strokeWidth={1.5} />
            Văn bản &amp; Hồ sơ
          </Link>
        </div>

        {/* Document header */}
        <div className="rounded-xl border border-border/70 bg-card p-5 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
              <FileText className="size-5" strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-semibold text-foreground font-heading leading-snug">
                {doc.summary || "Văn bản đi"}
              </h1>
              {doc.summary && (
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  {doc.summary}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                {workflow.outgoingNumberStr && (
                  <span className="inline-flex items-center gap-1 text-xs text-foreground">
                    <Hash className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                    <span className="font-mono font-medium">{workflow.outgoingNumberStr}</span>
                  </span>
                )}
                {doc.category && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Tag className="size-3.5" strokeWidth={1.5} />
                    {doc.category}
                  </span>
                )}
                {doc.urgency && doc.urgency !== "NORMAL" && (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                    <Zap className="size-3.5" strokeWidth={1.5} />
                    {URGENCY_LABEL[doc.urgency] ?? doc.urgency}
                  </span>
                )}
                {doc.securityLevel && doc.securityLevel !== "PUBLIC" && (
                  <span className="inline-flex items-center gap-1 text-xs text-rose-600">
                    <Shield className="size-3.5" strokeWidth={1.5} />
                    {SECURITY_LABEL[doc.securityLevel] ?? doc.securityLevel}
                  </span>
                )}
                {(doc.issuedDate || workflow.issuedAt) && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="size-3.5" strokeWidth={1.5} />
                    {formatDate(doc.issuedDate ?? workflow.issuedAt)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main 2-col layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
          {/* Left: PDF viewer */}
          <div className="min-w-0">
            <DocumentPdfViewer
              fileUrl={primaryAttachment?.fileUrl}
              fileName={primaryAttachment?.fileName}
              fileSize={fileSize}
              mimeType={primaryAttachment?.mimeType ?? undefined}
              className="h-full min-h-[500px]"
            />
          </div>

          {/* Right: sticky sidebar */}
          <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
            <OutgoingWorkflowStepper workflow={workflow} />

            {currentUser && (
              <OutgoingActionPanel
                documentId={workflow.documentId}
                status={workflow.status}
                currentUserId={currentUser.id}
              />
            )}

            <OutgoingRecipientList
              recipientList={workflow.recipientList}
              status={workflow.status}
              issuedAt={workflow.issuedAt}
            />
          </div>
        </div>
      </m.div>
    </AnimatePresence>
  );
}
