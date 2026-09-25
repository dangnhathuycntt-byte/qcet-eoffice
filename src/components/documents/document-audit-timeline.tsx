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
import { cn } from "@/lib/utils";

export interface DocumentTimelineStep {
  id: string;
  stepNumber: number;
  key: string;
  title: string;
  subtitle: string;
  status: "completed" | "current" | "pending" | "rejected";
  actorName?: string | null;
  actorRole?: string | null;
  actorTitle?: string | null;
  actorAvatar?: string | null;
  timestamp?: string | null;
  notes?: string | null;
  departmentName?: string | null;
  assignedToName?: string | null;
  deadline?: string | null;
}

export interface DocumentAuditLogItem {
  id: string;
  action: string;
  actionLabel: string;
  actorName: string;
  actorRole?: string | null;
  actorTitle?: string | null;
  actorAvatar?: string | null;
  timestamp: string;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface DocumentAuditApiResponse {
  success?: boolean;
  documentId: string;
  documentNumber: string;
  type: string;
  progressPercent: number;
  completedCount: number;
  totalSteps: number;
  currentStep?: DocumentTimelineStep;
  steps: DocumentTimelineStep[];
  auditLogs: DocumentAuditLogItem[];
}

export interface DocumentAuditTimelineProps {
  documentId: string;
  initialDoc?: OfficialDocument | null;
  className?: string;
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
  initialDoc,
  className,
}: DocumentAuditTimelineProps) {
  const [timelineData, setTimelineData] = React.useState<DocumentAuditApiResponse | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showDetailedLogs, setShowDetailedLogs] = React.useState<boolean>(false);

  const fetchTimeline = React.useCallback(async () => {
    if (!documentId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}/audit-logs`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      if (!res.ok) {
        // Build graceful fallback if endpoint returns 404/synthetic
        if (res.status === 404 && initialDoc) {
          const fallbackData = buildFallbackTimeline(initialDoc);
          setTimelineData(fallbackData);
          return;
        }
        throw new Error(`Không thể tải dữ liệu lịch sử luân chuyển (HTTP ${res.status})`);
      }

      const json = await res.json();
      const payload = json.data || json;
      setTimelineData(payload);
    } catch (err: unknown) {
      if (initialDoc) {
        setTimelineData(buildFallbackTimeline(initialDoc));
      } else {
        setError(err instanceof Error ? err.message : "Lỗi khi tải lịch sử luân chuyển.");
      }
    } finally {
      setLoading(false);
    }
  }, [documentId, initialDoc]);

  React.useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  // Fallback builder for offline or mock documents
  function buildFallbackTimeline(doc: OfficialDocument): DocumentAuditApiResponse {
    const isCompleted = doc.status === "completed" || doc.status === "DA_HOAN_THANH";
    const isDelegated = doc.status === "delegated" || Boolean(doc.linkedTaskId);
    const isProcessing = doc.status === "processing" || isDelegated || isCompleted;
    const isPresented = isProcessing || isCompleted;

    const steps: DocumentTimelineStep[] = [
      {
        id: "step-1",
        stepNumber: 1,
        key: "RECEIVED",
        title: "Tiếp nhận & Vào sổ",
        subtitle: "Văn thư tiếp nhận và cấp số đến",
        status: "completed",
        actorName: "Văn thư Trường",
        actorRole: "VAN_THU",
        actorTitle: "Văn thư cơ quan",
        timestamp: doc.receivedDate ? `${doc.receivedDate}T08:00:00Z` : new Date().toISOString(),
        notes: `Số vào sổ: ${doc.documentNumber} • Cơ quan ban hành: ${doc.issuingAuthority}`,
      },
      {
        id: "step-2",
        stepNumber: 2,
        key: "PRESENTED",
        title: "Trình Ban Giám Hiệu",
        subtitle: "Lập phiếu trình Ban Giám Hiệu xem xét",
        status: isPresented ? "completed" : "current",
        actorName: "Văn thư Trường",
        actorRole: "VAN_THU",
        timestamp: doc.receivedDate ? `${doc.receivedDate}T09:30:00Z` : null,
        notes: "Đã lập phiếu trình và chuyển văn bản tới Ban Giám Hiệu",
      },
      {
        id: "step-3",
        stepNumber: 3,
        key: "DIRECTED",
        title: "Chỉ đạo & Bút phê BGH",
        subtitle: "Lãnh đạo Trường phê duyệt và phân công",
        status: isProcessing || isCompleted ? "completed" : isPresented ? "current" : "pending",
        actorName: doc.signatory || "Ban Giám Hiệu",
        actorRole: "BAN_GIAM_HIEU",
        actorTitle: "Lãnh đạo Ban Giám Hiệu",
        departmentName: doc.leadDepartment,
        timestamp: isProcessing ? `${doc.issuedDate}T14:00:00Z` : null,
        notes: `Giao ${doc.leadDepartment} chủ trì thực hiện theo đúng thẩm quyền và thời hạn quy định.`,
      },
      {
        id: "step-4",
        stepNumber: 4,
        key: "UNIT_ASSIGNED",
        title: "Giao đơn vị & Phân công DRI",
        subtitle: "Trưởng đơn vị giao chuyên viên chủ trì",
        status: isDelegated || isCompleted ? "completed" : isProcessing ? "current" : "pending",
        actorName: "Trưởng đơn vị",
        actorRole: "TRUONG_PHONG",
        departmentName: doc.leadDepartment,
        timestamp: isDelegated ? `${doc.issuedDate}T16:30:00Z` : null,
        notes: doc.linkedTaskId
          ? `Đã liên thông nhiệm vụ: ${doc.linkedTaskId} (${doc.linkedTaskTitle || "Nhiệm vụ trực tiếp giao từ văn bản"})`
          : `Phân công chuyên viên phòng/khoa thụ lý triển khai`,
      },
      {
        id: "step-5",
        stepNumber: 5,
        key: "COMPLETED",
        title: "Giải quyết & Lưu trữ hồ sơ",
        subtitle: "Báo cáo kết quả và lập hồ sơ công việc",
        status: isCompleted ? "completed" : isDelegated ? "current" : "pending",
        actorName: isCompleted ? "Chuyên viên thụ lý & Văn thư" : null,
        timestamp: isCompleted ? new Date().toISOString() : null,
        notes: isCompleted
          ? "Đã hoàn thành xử lý nội dung văn bản và lưu trữ hồ sơ theo Nghị định 30/2020."
          : "Đang tiến hành thực hiện nhiệm vụ",
      },
    ];

    const completedCount = steps.filter((s) => s.status === "completed").length;

    return {
      documentId: doc.id,
      documentNumber: doc.documentNumber,
      type: doc.type,
      progressPercent: Math.round((completedCount / steps.length) * 100),
      completedCount,
      totalSteps: steps.length,
      currentStep: steps.find((s) => s.status === "current") || steps[steps.length - 1],
      steps,
      auditLogs: [
        {
          id: "log-1",
          action: "DOCUMENT_CREATED",
          actionLabel: "Tiếp nhận & Vào sổ văn bản",
          actorName: "Văn thư Trường",
          actorRole: "VAN_THU",
          timestamp: doc.receivedDate ? `${doc.receivedDate}T08:00:00Z` : new Date().toISOString(),
          notes: `Đăng ký văn bản số ${doc.documentNumber} từ ${doc.issuingAuthority}`,
        },
        ...(isPresented
          ? [
              {
                id: "log-2",
                action: "DOCUMENT_PRESENTED",
                actionLabel: "Trình Ban Giám Hiệu xem xét",
                actorName: "Văn thư Trường",
                actorRole: "VAN_THU",
                timestamp: `${doc.issuedDate}T09:30:00Z`,
                notes: "Chuyển văn bản tới BGH để xin ý kiến chỉ đạo",
              },
            ]
          : []),
        ...(isProcessing
          ? [
              {
                id: "log-3",
                action: "DOCUMENT_DIRECTED",
                actionLabel: "Lãnh đạo BGH cho ý kiến chỉ đạo / Bút phê",
                actorName: doc.signatory || "Ban Giám Hiệu",
                actorRole: "BAN_GIAM_HIEU",
                timestamp: `${doc.issuedDate}T14:00:00Z`,
                notes: `Chuyển ${doc.leadDepartment} chủ trì triển khai`,
              },
            ]
          : []),
        ...(isDelegated
          ? [
              {
                id: "log-4",
                action: "DOCUMENT_UNIT_ASSIGNED",
                actionLabel: "Phân công tác nghiệp cho đơn vị & chuyên viên",
                actorName: "Trưởng đơn vị",
                actorRole: "TRUONG_PHONG",
                timestamp: `${doc.issuedDate}T16:30:00Z`,
                notes: doc.linkedTaskId ? `Tạo nhiệm vụ ${doc.linkedTaskId}` : "Giao chuyên viên",
              },
            ]
          : []),
      ],
    };
  }

  const steps = timelineData?.steps || [];
  const auditLogs = timelineData?.auditLogs || [];

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/70 bg-card p-4 sm:p-5 shadow-xs space-y-4",
        className
      )}
      data-slot="document-audit-timeline"
    >
      {/* Header & Progress Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0 border border-primary/20">
            <History className="size-4" strokeWidth={1.5} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground">
                Tiến trình Phê duyệt & Lịch sử Luân chuyển
              </h3>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-mono font-medium">
                Nghị định 30/2020
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Quy trình luân chuyển tác nghiệp 2 cấp: BGH chỉ đạo & Đơn vị thực thi
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {timelineData && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/60 border border-border/60 text-xs font-semibold text-foreground">
              <span className="text-muted-foreground">Tiến độ:</span>
              <span className="font-mono text-primary font-bold">
                {timelineData.progressPercent}%
              </span>
              <span className="text-muted-foreground text-[11px]">
                ({timelineData.completedCount}/{timelineData.totalSteps} bước)
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={fetchTimeline}
            disabled={loading}
            aria-label="Làm mới tiến trình"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-border/60 bg-background hover:bg-muted active:scale-[0.98] text-muted-foreground hover:text-foreground transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin text-primary")} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && !timelineData && (
        <div className="py-6 space-y-4 animate-pulse">
          {[1, 2, 3, 4, 5].map((idx) => (
            <div key={idx} className="flex items-start gap-3.5">
              <div className="size-8 rounded-full bg-muted shrink-0" />
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
        <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 text-destructive text-xs flex items-start gap-2.5">
          <AlertCircle className="size-4 shrink-0 mt-0.5" strokeWidth={1.5} />
          <div className="flex-1">
            <p className="font-semibold">Lỗi tải dữ liệu</p>
            <p className="text-muted-foreground mt-0.5">{error}</p>
            <button
              type="button"
              onClick={fetchTimeline}
              className="min-h-[44px] mt-2 px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground font-semibold hover:opacity-90 active:scale-[0.98] cursor-pointer"
            >
              Thử lại
            </button>
          </div>
        </div>
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
                className="relative flex items-start gap-3.5 group pb-4 last:pb-0"
              >
                {/* Connecting Line */}
                {!isLast && (
                  <div
                    className={cn(
                      "absolute left-4 top-8 -bottom-1 w-0.5 -translate-x-1/2 transition-colors",
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
                      "size-8 rounded-full flex items-center justify-center transition-all border",
                      isCompleted
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : isCurrent
                          ? "bg-primary/10 text-primary border-primary ring-4 ring-primary/15 animate-pulse"
                          : "bg-muted text-muted-foreground border-border/70"
                    )}
                  >
                    <StepIcon className="size-4" strokeWidth={1.5} />
                  </div>
                </div>

                {/* Step Card Content */}
                <div
                  className={cn(
                    "flex-1 min-w-0 p-3.5 rounded-xl border transition-all text-xs",
                    isCurrent
                      ? "bg-primary/5 border-primary/30 shadow-xs ring-1 ring-primary/10"
                      : isCompleted
                        ? "bg-card border-border/60 hover:border-border"
                        : "bg-muted/20 border-border/40 opacity-70"
                  )}
                >
                  {/* Step Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-foreground">
                        {step.stepNumber}. {step.title}
                      </span>
                      {isCurrent && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-primary text-primary-foreground animate-pulse">
                          Đang thực hiện
                        </span>
                      )}
                      {isCompleted && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                          <CheckCircle2 className="size-3" strokeWidth={1.5} />
                          Đã hoàn thành
                        </span>
                      )}
                    </div>

                    {step.timestamp && (
                      <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
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
                        <div className="flex items-center gap-1.5 font-medium text-foreground bg-muted/50 px-2 py-1 rounded-md">
                          <Avatar.Root className="size-5 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">
                            <Avatar.Fallback>
                              {step.actorName.charAt(0).toUpperCase()}
                            </Avatar.Fallback>
                          </Avatar.Root>
                          <span className="truncate">{step.actorName}</span>
                          {step.actorTitle && (
                            <span className="text-muted-foreground text-[11px] font-normal">
                              ({step.actorTitle})
                            </span>
                          )}
                        </div>
                      )}

                      {step.departmentName && (
                        <div className="flex items-center gap-1 text-muted-foreground bg-muted/40 px-2 py-1 rounded-md">
                          <Building2 className="size-3.5 text-primary/70 shrink-0" strokeWidth={1.5} />
                          <span>{step.departmentName}</span>
                        </div>
                      )}

                      {step.assignedToName && (
                        <div className="flex items-center gap-1 text-emerald-700 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-md font-medium">
                          <User className="size-3.5 shrink-0" strokeWidth={1.5} />
                          <span>Chuyên viên chủ trì (DRI): {step.assignedToName}</span>
                        </div>
                      )}

                      {step.deadline && (
                        <div className="flex items-center gap-1 text-amber-700 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-md font-mono">
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
        <div className="pt-2 border-t border-border/60">
          <Collapsible.Root
            open={showDetailedLogs}
            onOpenChange={setShowDetailedLogs}
            className="w-full space-y-2"
          >
            <Collapsible.Trigger
              type="button"
              className="min-h-[44px] w-full flex items-center justify-between p-2.5 rounded-xl bg-muted/30 hover:bg-muted/60 border border-border/60 text-xs font-semibold text-foreground transition-all cursor-pointer active:scale-[0.99]"
            >
              <div className="flex items-center gap-2">
                <History className="size-3.5 text-primary" strokeWidth={1.5} />
                <span>Nhật ký luân chuyển & thao tác chi tiết ({auditLogs.length} bản ghi)</span>
              </div>
              <ChevronDown
                className={cn(
                  "size-4 text-muted-foreground transition-transform duration-200",
                  showDetailedLogs && "rotate-180"
                )}
                strokeWidth={1.5}
              />
            </Collapsible.Trigger>

            <Collapsible.Panel className="space-y-2 pt-2 animate-in fade-in duration-200">
              <div className="rounded-xl border border-border/60 bg-muted/10 divide-y divide-border/40 overflow-hidden">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-3 text-xs flex items-start gap-2.5 hover:bg-muted/20 transition-colors">
                    <div className="p-1.5 rounded-lg bg-muted text-foreground shrink-0 mt-0.5">
                      <FileBadge2 className="size-3.5 text-primary" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-0.5">
                        <span className="font-semibold text-foreground">
                          {log.actionLabel}
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {formatVietnameseDateTime(log.timestamp)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                        <User className="size-3" strokeWidth={1.5} />
                        <span className="font-medium text-foreground">{log.actorName}</span>
                        {log.actorTitle && <span>({log.actorTitle})</span>}
                      </div>

                      {log.notes && (
                        <p className="mt-1 text-muted-foreground italic text-[11px] bg-background/60 p-1.5 rounded border border-border/40">
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
