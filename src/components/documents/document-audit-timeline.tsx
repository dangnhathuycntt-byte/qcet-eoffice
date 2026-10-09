"use client";

import * as React from "react";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import {
  CheckCircle2,
  Clock,
  User,
  Building2,
  ShieldCheck,
  FileText,
  AlertCircle,
  Calendar,
  ChevronDown,
  RefreshCw,
  History,
  FileCheck2,
  Send,
  UserCheck,
  FileBadge2,
  Archive,
} from "lucide-react";
import { Avatar } from "@base-ui/react/avatar";
import { Collapsible } from "@base-ui/react/collapsible";
import { staggerContainerVariants, listItemVariants } from "@/lib/motion/variants";
import { motionTransition } from "@/lib/motion/tokens";
import { OfficialDocument } from "@/types/document";
import type { DocumentAuditApiResponse, DocumentTimelineStep } from "@/types/document-audit";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { fetchDocumentAuditTimeline, isEmptyTimeline } from "@/lib/documents/audit-timeline-client";

export type {
  DocumentTimelineStep,
  DocumentAuditLogItem,
  DocumentAuditApiResponse,
} from "@/types/document-audit";

export interface DocumentAuditTimelineProps {
  documentId: string;
  /** Giữ để tương thích; không dùng để dựng lịch sử. Lịch sử chỉ lấy từ API. */
  initialDoc?: OfficialDocument | null;
  className?: string;
  /** Ẩn tiêu đề lớn khi timeline nằm trong một phân mục đã có tiêu đề riêng. */
  bare?: boolean;
}

/**
 * Format timestamp into standard Vietnamese Administrative Date-Time (DD/MM/YYYY HH:mm)
 */
function formatVietnameseDateTime(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return dateStr;
  }
}

function getStepIcon(stepNumber: number, key: string, status: DocumentTimelineStep["status"]) {
  if (status === "completed") {
    return CheckCircle2;
  }
  switch (key) {
    case "RECEIVED":
    case "DRAFT":
      return FileText;
    case "PRESENTED":
    case "FORMAT_REVIEW":
      return FileCheck2;
    case "DIRECTED":
    case "CONTENT_REVIEW":
      return ShieldCheck;
    case "UNIT_ASSIGNED":
    case "SIGN_AND_NUMBER":
      return UserCheck;
    case "COMPLETED":
    case "ISSUE_AND_DELIVER":
      return Archive;
    default:
      return Clock;
  }
}

export function DocumentAuditTimeline({
  documentId,
  className,
  bare = false,
}: DocumentAuditTimelineProps) {
  const [timelineData, setTimelineData] = React.useState<DocumentAuditApiResponse | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showDetailedLogs, setShowDetailedLogs] = React.useState<boolean>(false);

  const abortRef = React.useRef<AbortController | null>(null);

  const fetchTimeline = React.useCallback(async () => {
    if (!documentId) return;
    // Hủy yêu cầu trước để kết quả cũ không ghi đè lịch sử của văn bản/lần thử mới.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    setTimelineData(null);
    const result = await fetchDocumentAuditTimeline(documentId, fetch, controller.signal);
    if (controller.signal.aborted) return;
    if (result.ok) {
      setTimelineData(result.data);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, [documentId]);

  React.useEffect(() => {
    fetchTimeline();
    return () => abortRef.current?.abort();
  }, [fetchTimeline]);

  const steps = timelineData?.steps || [];
  const auditLogs = timelineData?.auditLogs || [];

  return (
    <div
      className={cn(
        "space-y-3",
        className
      )}
      data-slot="document-audit-timeline"
    >
      {/* Header & Progress Bar */}
      <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-3", bare ? "" : "pb-3 border-b border-border/50")}>
        {bare ? null : <div className="flex items-start gap-2.5">
          <History className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-compact font-semibold text-foreground">
                Tiến trình Phê duyệt & Lịch sử Luân chuyển
              </h3>
              <span className="font-mono text-xs text-muted-foreground">
                Nghị định 30/2020
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Quy trình luân chuyển tác nghiệp 2 cấp: BGH chỉ đạo & Đơn vị thực thi
            </p>
          </div>
        </div>}

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {timelineData && !isEmptyTimeline(timelineData) && (
            <div className="flex items-center gap-1.5 text-xs text-foreground">
              <span className="text-muted-foreground">Tiến độ:</span>
              <span className="font-mono font-semibold text-foreground">
                {timelineData.progressPercent}%
              </span>
              <span className="text-muted-foreground text-xs">
                ({timelineData.completedCount}/{timelineData.totalSteps} bước)
              </span>
            </div>
          )}

          <Button
            type="button"
            variant={bare ? "ghost" : "outline"}
            size="icon-sm"
            onClick={fetchTimeline}
            disabled={loading}
            aria-label="Làm mới tiến trình"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin motion-reduce:animate-none text-primary")} strokeWidth={1.5} />
          </Button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && !timelineData && (
        <div className="py-4 space-y-3 motion-safe:animate-pulse">
          {[1, 2, 3, 4, 5].map((idx) => (
            <div key={idx} className="flex items-start gap-3">
              <div className="size-6 rounded-full bg-muted shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-4 bg-muted rounded-md w-1/3" />
                <div className="h-3 bg-muted/60 rounded-md w-2/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && !timelineData && (
        <div className="flex items-start gap-2 text-xs">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" strokeWidth={1.5} />
          <div className="flex-1">
            <p className="font-medium text-destructive">Lỗi tải dữ liệu</p>
            <p className="mt-0.5 text-muted-foreground">{error}</p>
            <Button type="button" variant="ghost" size="sm" onClick={fetchTimeline} className="mt-1.5 -ml-2">
              Thử lại
            </Button>
          </div>
        </div>
      )}

      {timelineData && isEmptyTimeline(timelineData) && (
        <p className="py-4 text-center text-compact text-muted-foreground">Chưa có lịch sử luân chuyển.</p>
      )}

      {/* Timeline Steps (5 Canonical Stages) */}
      {timelineData && (
        <m.div
          className="relative space-y-0"
          variants={staggerContainerVariants}
          initial="initial"
          animate="animate"
        >
          {steps.map((step, index) => {
            const isLast = index === steps.length - 1;
            const isCompleted = step.status === "completed";
            const isCurrent = step.status === "current";
            const StepIcon = getStepIcon(step.stepNumber, step.key, step.status);

            return (
              <m.div
                key={step.id || step.key}
                variants={listItemVariants}
                className="relative flex items-start gap-3 group pb-3 last:pb-0"
              >
                {/* Connecting Line */}
                {!isLast && (
                  <div
                    className={cn(
                      "absolute left-3 top-6 -bottom-1 w-px -translate-x-1/2 transition-colors",
                      isCompleted
                        ? "bg-primary/40"
                        : isCurrent
                          ? "bg-gradient-to-b from-primary/40 to-border/40 border-l border-dashed border-border"
                          : "bg-border/40"
                    )}
                    aria-hidden="true"
                  />
                )}

                {/* Step Circle Node */}
                <div className="relative z-10 shrink-0">
                  <div
                    className={cn(
                      "size-6 rounded-full flex items-center justify-center transition-colors border",
                      isCompleted
                        ? "bg-primary text-primary-foreground border-primary"
                        : isCurrent
                          ? "bg-primary/10 text-primary border-primary ring-2 ring-primary/15 motion-safe:animate-pulse"
                          : "bg-muted text-muted-foreground border-border/70"
                    )}
                  >
                    <StepIcon className="size-3.5" strokeWidth={1.5} />
                  </div>
                </div>

                {/* Step Card Content */}
                <div
                  className={cn(
                    "flex-1 min-w-0 py-2.5 text-xs",
                    !isCurrent && !isCompleted && "opacity-60"
                  )}
                >
                  {/* Step Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-compact text-foreground">
                        {step.stepNumber}. {step.title}
                      </span>
                      {isCurrent && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary motion-safe:animate-pulse">
                          Đang thực hiện
                        </span>
                      )}
                      {isCompleted && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <CheckCircle2 className="size-3" strokeWidth={1.5} />
                          Đã hoàn thành
                        </span>
                      )}
                    </div>

                    {step.timestamp && (
                      <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                        <Clock className="size-3 text-muted-foreground/80" strokeWidth={1.5} />
                        {formatVietnameseDateTime(step.timestamp)}
                      </span>
                    )}
                  </div>

                  {/* Subtitle / Description */}
                  <p className="text-muted-foreground text-xs leading-relaxed mb-2">
                    {step.subtitle}
                  </p>

                  {/* Actor / Performer Info */}
                  {(step.actorName || step.departmentName || step.assignedToName) && (
                    <div className="flex items-center gap-2 flex-wrap text-xs pt-1.5 border-t border-border/40">
                      {step.actorName && (
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <Avatar.Root className="size-5 rounded-full bg-primary/20 text-primary flex items-center justify-center font-semibold text-xs shrink-0">
                            <Avatar.Fallback>
                              {step.actorName.charAt(0).toUpperCase()}
                            </Avatar.Fallback>
                          </Avatar.Root>
                          <span className="truncate">{step.actorName}</span>
                          {step.actorTitle && (
                            <span className="text-muted-foreground text-xs font-normal">
                              ({step.actorTitle})
                            </span>
                          )}
                        </div>
                      )}

                      {step.departmentName && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Building2 className="size-3.5 text-primary/70 shrink-0" strokeWidth={1.5} />
                          <span>{step.departmentName}</span>
                        </div>
                      )}

                      {step.assignedToName && (
                        <div className="flex items-center gap-1 font-medium text-foreground">
                          <User className="size-3.5 shrink-0" strokeWidth={1.5} />
                          <span>Chuyên viên chủ trì (DRI): {step.assignedToName}</span>
                        </div>
                      )}

                      {step.deadline && (
                        <div className="flex items-center gap-1 font-mono text-amber-700">
                          <Calendar className="size-3.5 shrink-0" strokeWidth={1.5} />
                          <span>Hạn xử lý: {formatVietnameseDateTime(step.deadline)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Notes / Directive Instruction Box */}
                  {step.notes && (
                    <div
                      className={cn(
                        "mt-2.5 p-2.5 rounded-lg text-xs leading-relaxed border font-normal",
                        isCurrent
                          ? "bg-background border-primary/20 text-foreground"
                          : "bg-muted/40 border-border/50 text-muted-foreground"
                      )}
                    >
                      <span className="font-semibold text-foreground/80 block mb-0.5">
                        Nội dung / Ghi chú:
                      </span>
                      <p className="italic">{step.notes}</p>
                    </div>
                  )}
                </div>
              </m.div>
            );
          })}
        </m.div>
      )}

      {/* Collapsible Detailed Audit Trail Section */}
      {auditLogs.length > 0 && (
        <div className="pt-3 border-t border-border/50">
          <Collapsible.Root
            open={showDetailedLogs}
            onOpenChange={setShowDetailedLogs}
            className="w-full space-y-2"
          >
            <Collapsible.Trigger
              type="button"
              className="min-h-11 sm:min-h-7 w-full flex items-center justify-between rounded-md px-1 py-1 hover:bg-muted/50 text-xs font-medium text-foreground transition-colors motion-reduce:transition-none cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-1"
            >
              <div className="flex items-center gap-2">
                <History className="size-3.5 text-primary" strokeWidth={1.5} />
                <span>Nhật ký luân chuyển & thao tác chi tiết ({auditLogs.length} bản ghi)</span>
              </div>
              <ChevronDown
                className={cn(
                  "size-3.5 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
                  showDetailedLogs && "rotate-180"
                )}
                strokeWidth={1.5}
              />
            </Collapsible.Trigger>

            <Collapsible.Panel className="space-y-2 pt-2 animate-in fade-in duration-200">
              <div className="divide-y divide-border/40">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-3 text-xs flex items-start gap-2.5 hover:bg-muted/20 transition-colors">
                    <FileBadge2 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-0.5">
                        <span className="font-semibold text-foreground">
                          {log.actionLabel}
                        </span>
                        <span className="text-xs font-mono text-muted-foreground">
                          {formatVietnameseDateTime(log.timestamp)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                        <User className="size-3" strokeWidth={1.5} />
                        <span className="font-medium text-foreground">{log.actorName}</span>
                        {log.actorTitle && <span>({log.actorTitle})</span>}
                      </div>

                      {log.notes && (
                        <p className="mt-1 border-l-2 border-border pl-2 text-xs italic text-muted-foreground">
                          {log.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Collapsible.Panel>
          </Collapsible.Root>
        </div>
      )}
    </div>
  );
}
