"use client";

import * as React from "react";
import {
  FilePen,
  ClipboardCheck,
  FileCheck,
  PenLine,
  Hash,
  Stamp,
  Send,
  CheckCircle2,
  Clock,
  Circle,
} from "lucide-react";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { staggerContainerVariants, listItemVariants } from "@/lib/motion/variants";
import type { OutgoingDocumentStatus } from "@/contracts/documents";

const OUTGOING_STEPS = [
  { key: "DRAFT" as const, label: "Dự thảo", icon: FilePen },
  { key: "CONTENT_REVIEW" as const, label: "Phê duyệt nội dung", icon: ClipboardCheck },
  { key: "FORMAT_CHECK" as const, label: "Kiểm tra thể thức", icon: FileCheck },
  { key: "AUTHORIZED_SIGN" as const, label: "Ký chức danh", icon: PenLine },
  { key: "NUMBERED" as const, label: "Cấp số", icon: Hash },
  { key: "ORGANIZATION_SIGNED" as const, label: "Dấu cơ quan", icon: Stamp },
  { key: "ISSUED" as const, label: "Phát hành", icon: Send },
] as const;

const STATUS_ORDER: OutgoingDocumentStatus[] = [
  "DRAFT",
  "CONTENT_REVIEW",
  "FORMAT_CHECK",
  "AUTHORIZED_SIGN",
  "NUMBERED",
  "ORGANIZATION_SIGNED",
  "ISSUED",
];

type StepState = "completed" | "active" | "upcoming";

function getStepState(stepKey: string, currentStatus: OutgoingDocumentStatus): StepState {
  const stepIndex = STATUS_ORDER.indexOf(stepKey as OutgoingDocumentStatus);
  const currentIndex = STATUS_ORDER.indexOf(currentStatus);
  if (stepIndex < currentIndex) return "completed";
  if (stepIndex === currentIndex) return "active";
  return "upcoming";
}

function formatDateTime(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

export interface OutgoingWorkflowData {
  status: OutgoingDocumentStatus;
  contentReviewer?: { id: string; name: string } | null;
  contentReviewSubmittedAt?: Date | string | null;
  contentApprovedAt?: Date | string | null;
  formatReviewer?: { id: string; name: string } | null;
  formatReviewSubmittedAt?: Date | string | null;
  formatApprovedAt?: Date | string | null;
  authorizedSigner?: { id: string; name: string } | null;
  authorizedSignedAt?: Date | string | null;
  numberer?: { id: string; name: string } | null;
  numberedAt?: Date | string | null;
  outgoingNumberStr?: string | null;
  orgSigner?: { id: string; name: string } | null;
  orgSignedAt?: Date | string | null;
  issuer?: { id: string; name: string } | null;
  issuedAt?: Date | string | null;
  createdAt?: Date | string | null;
}

interface StepActorInfo {
  actor?: string | null;
  timestamp?: string | null;
}

function getStepActorInfo(stepKey: string, workflow: OutgoingWorkflowData): StepActorInfo {
  switch (stepKey) {
    case "DRAFT":
      return { timestamp: formatDateTime(workflow.createdAt) };
    case "CONTENT_REVIEW":
      return {
        actor: workflow.contentReviewer?.name,
        timestamp: formatDateTime(workflow.contentApprovedAt ?? workflow.contentReviewSubmittedAt),
      };
    case "FORMAT_CHECK":
      return {
        actor: workflow.formatReviewer?.name,
        timestamp: formatDateTime(workflow.formatApprovedAt ?? workflow.formatReviewSubmittedAt),
      };
    case "AUTHORIZED_SIGN":
      return {
        actor: workflow.authorizedSigner?.name,
        timestamp: formatDateTime(workflow.authorizedSignedAt),
      };
    case "NUMBERED":
      return {
        actor: workflow.numberer?.name,
        timestamp: formatDateTime(workflow.numberedAt),
      };
    case "ORGANIZATION_SIGNED":
      return {
        actor: workflow.orgSigner?.name,
        timestamp: formatDateTime(workflow.orgSignedAt),
      };
    case "ISSUED":
      return {
        actor: workflow.issuer?.name,
        timestamp: formatDateTime(workflow.issuedAt),
      };
    default:
      return {};
  }
}

export interface OutgoingWorkflowStepperProps {
  workflow: OutgoingWorkflowData;
  className?: string;
}

export function OutgoingWorkflowStepper({ workflow, className }: OutgoingWorkflowStepperProps) {
  return (
    <div className={cn("rounded-xl border border-border/70 bg-card p-4 shadow-xs", className)}>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
        Tiến trình xử lý
      </h3>
      <m.ol
        variants={staggerContainerVariants}
        initial="initial"
        animate="animate"
        className="relative space-y-0"
        aria-label="Các bước quy trình văn bản đi"
      >
        {OUTGOING_STEPS.map((step, index) => {
          const state = getStepState(step.key, workflow.status);
          const { actor, timestamp } = getStepActorInfo(step.key, workflow);
          const Icon = step.icon;
          const isLast = index === OUTGOING_STEPS.length - 1;

          return (
            <m.li key={step.key} variants={listItemVariants} className="relative flex gap-3">
              {/* Vertical connector line */}
              {!isLast && (
                <div
                  className={cn(
                    "absolute left-[14px] top-7 bottom-0 w-px",
                    state === "completed" ? "bg-emerald-500/40" : "bg-border/50"
                  )}
                  aria-hidden
                />
              )}

              {/* Step indicator */}
              <div className="relative z-10 mt-1 shrink-0">
                {state === "completed" ? (
                  <div className="size-[28px] rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                    <CheckCircle2 className="size-3.5 text-emerald-600" strokeWidth={2} />
                  </div>
                ) : state === "active" ? (
                  <div className="size-[28px] rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center">
                    <Clock className="size-3 text-primary animate-pulse" strokeWidth={2} />
                  </div>
                ) : (
                  <div className="size-[28px] rounded-full border border-border/60 bg-muted/40 flex items-center justify-center">
                    <Circle className="size-3 text-muted-foreground/40" strokeWidth={1.5} />
                  </div>
                )}
              </div>

              {/* Step content */}
              <div className="pb-5 min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Icon
                    className={cn(
                      "size-3.5 shrink-0",
                      state === "completed"
                        ? "text-emerald-600"
                        : state === "active"
                          ? "text-primary"
                          : "text-muted-foreground/50"
                    )}
                    strokeWidth={1.5}
                  />
                  <span
                    className={cn(
                      "text-xs font-medium",
                      state === "completed"
                        ? "text-foreground"
                        : state === "active"
                          ? "text-foreground font-semibold"
                          : "text-muted-foreground/60"
                    )}
                  >
                    {step.label}
                  </span>
                  {state === "active" && (
                    <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary leading-none">
                      Hiện tại
                    </span>
                  )}
                </div>

                {(actor || timestamp) && state !== "upcoming" && (
                  <div className="mt-0.5 text-[10px] text-muted-foreground space-x-1">
                    {actor && <span>{actor}</span>}
                    {actor && timestamp && <span>·</span>}
                    {timestamp && <span>{timestamp}</span>}
                  </div>
                )}
              </div>
            </m.li>
          );
        })}
      </m.ol>
    </div>
  );
}
