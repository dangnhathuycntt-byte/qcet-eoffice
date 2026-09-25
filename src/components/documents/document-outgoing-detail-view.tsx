"use client";

import * as React from "react";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { sideSheetVariants, fadeVariants } from "@/lib/motion/variants";
import type { DocumentItem } from "@/types/document";
import { OutgoingWorkflowStepper } from "./outgoing-workflow-stepper";
import { OutgoingActionPanel } from "./outgoing-action-panel";

import {
  X,
  FileText,
  Send,
  Building2,
  Calendar,
  User,
  ShieldCheck,
  Hash,
} from "lucide-react";

export interface DocumentOutgoingDetailViewProps {
  document: DocumentItem | null;
  isOpen: boolean;
  currentUser?: { id: string; name: string; role: string };
  onClose: () => void;
  onWorkflowUpdate?: (updatedDoc: DocumentItem) => void;
}

export function DocumentOutgoingDetailView({
  document: doc,
  isOpen,
  currentUser,
  onClose,
  onWorkflowUpdate,
}: DocumentOutgoingDetailViewProps) {
  // ESC dismiss
  React.useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const workflowStatus = (doc as any)?.outgoingWorkflow?.status ?? "DRAFT";
  const outgoingNumber = (doc as any)?.outgoingWorkflow?.outgoingNumber;
  const codeNotation = (doc as any)?.outgoingWorkflow?.codeNotation;

  return (
    <AnimatePresence>
      {isOpen && doc && (
        <m.div
          key="outgoing-detail-overlay"
          variants={fadeVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <m.div
            variants={sideSheetVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="relative w-full sm:max-w-2xl h-[90vh] sm:h-full bg-card border-l border-border/70 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
            data-slot="document-outgoing-detail-view"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 bg-muted/10 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 shrink-0">
                  <Send className="size-4" strokeWidth={1.5} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">
                    {doc.summary}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    {outgoingNumber && codeNotation
                      ? `${outgoingNumber}/${codeNotation}`
                      : "Chưa cấp số"}{" "}
                    — Văn bản đi
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng"
                className="ml-2 p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="size-4" strokeWidth={1.5} />
              </button>
            </div>

            {/* Body — 2 columns on sm+ */}
            <div className="flex-1 overflow-y-auto flex flex-col sm:flex-row">
              {/* LEFT: Stepper */}
              <aside className="sm:w-56 shrink-0 border-b sm:border-b-0 sm:border-r border-border/50 p-4 bg-muted/5">
                <p className="text-xs font-bold text-muted-foreground mb-3">
                  Quy trình xử lý
                </p>
                <OutgoingWorkflowStepper workflow={{ status: workflowStatus, createdAt: (doc as any)?.createdAt ?? new Date().toISOString() }} />
              </aside>

              {/* RIGHT: Info + Actions */}
              <main className="flex-1 min-w-0 p-4 flex flex-col gap-4 overflow-y-auto">
                {/* Document metadata */}
                <section className="rounded-xl border border-border/60 bg-muted/10 p-4 flex flex-col gap-2.5">
                  <p className="text-xs font-bold text-muted-foreground">
                    Thông tin văn bản đi
                  </p>
                  <MetaRow icon={FileText} label="Trích yếu" value={doc.summary} />
                  <MetaRow
                    icon={Building2}
                    label="Đơn vị soạn thảo"
                    value={
                      (doc as any).outgoingWorkflow?.draftingDeptName ||
                      doc.leadUnitName ||
                      "-"
                    }
                  />
                  <MetaRow
                    icon={Calendar}
                    label="Ngày ban hành"
                    value={
                      (doc as any).outgoingWorkflow?.issuedDate ||
                      doc.issuedDate ||
                      "-"
                    }
                  />
                  <MetaRow
                    icon={User}
                    label="Người ký"
                    value={
                      (doc as any).outgoingWorkflow?.authorizedSigner?.name ||
                      doc.signerName ||
                      "-"
                    }
                  />
                  <MetaRow
                    icon={Hash}
                    label="Số ký hiệu"
                    value={
                      outgoingNumber
                        ? `${outgoingNumber}${codeNotation ? `/${codeNotation}` : ""}`
                        : "Chưa cấp"
                    }
                  />
                  <MetaRow
                    icon={ShieldCheck}
                    label="Độ mật"
                    value={doc.securityLevel || "THUONG"}
                  />
                </section>

                {/* Action panel */}
                <section>
                  <p className="text-xs font-bold text-muted-foreground mb-3">
                    Hành động xử lý
                  </p>
                  <OutgoingActionPanel
                    documentId={doc.id}
                    status={workflowStatus}
                    currentUserId={currentUser?.id ?? ""}
                    onActionSuccess={() => {
                      onWorkflowUpdate?.(doc);
                    }}
                  />
                </section>
              </main>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}

function MetaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | undefined | null;
}) {
  return (
    <div className="flex items-start gap-2.5 text-xs">
      <Icon
        className="size-3.5 text-muted-foreground mt-0.5 shrink-0"
        strokeWidth={1.5}
      />
      <span className="text-muted-foreground w-28 shrink-0">{label}</span>
      <span className="text-foreground font-medium truncate">{value || "-"}</span>
    </div>
  );
}
