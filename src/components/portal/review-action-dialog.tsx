"use client";

import * as React from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MessageSquare,
  Loader2,
  ExternalLink,
  FileText,
} from "lucide-react";
import type {
  ApprovalDecision,
  ApprovalActionPayload,
} from "@/types/workspace";
import type { UserRole } from "@/types/auth";
import type { SchoolTask, StaffTask } from "@/types/dashboard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StandardDialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { scrollActiveInputIntoView } from "@/hooks/use-virtual-keyboard";

// ============================================================================
// 1. Constants & Validation Helpers
// ============================================================================

export const QUICK_COMMENT_TEMPLATES = [
  "Cần bổ sung số liệu minh chứng",
  "Nội dung đạt chuẩn theo quy định",
  "Vui lòng đính kèm quyết định ban hành",
  "Bố cục chưa đúng mẫu biểu theo hướng dẫn",
  "Đã nghiệm thu kết quả, chuyển giai đoạn tiếp theo",
] as const;

export interface DecisionOptionConfig {
  id: ApprovalDecision;
  title: string;
  subtitle: string;
  badgeLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: "emerald" | "amber" | "rose";
  confirmButtonLabel: string;
}

export const DECISION_OPTIONS: DecisionOptionConfig[] = [
  {
    id: "approved",
    title: "Phê duyệt đạt yêu cầu",
    subtitle: "Nghiệm thu hồ sơ và hoàn tất bàn giao minh chứng",
    badgeLabel: "Đạt chuẩn",
    icon: CheckCircle2,
    accentColor: "emerald",
    confirmButtonLabel: "Xác nhận phê duyệt",
  },
  {
    id: "revision_requested",
    title: "Yêu cầu chỉnh sửa",
    subtitle: "Chuyển trả về cho người thực hiện bổ sung, hoàn thiện",
    badgeLabel: "Cần bổ sung",
    icon: AlertTriangle,
    accentColor: "amber",
    confirmButtonLabel: "Gửi yêu cầu chỉnh sửa",
  },
  {
    id: "rejected",
    title: "Không phê duyệt / Từ chối",
    subtitle: "Không chấp nhận kết quả nộp do không đạt tiêu chuẩn",
    badgeLabel: "Từ chối",
    icon: XCircle,
    accentColor: "rose",
    confirmButtonLabel: "Xác nhận từ chối",
  },
];

/**
 * Validates whether a decision and its accompanying comment satisfy submission rules.
 * revision_requested and rejected require at least 5 characters.
 * approved makes comment optional.
 */
export function canSubmitDecision(decision: ApprovalDecision, comment: string): boolean {
  if (decision === "revision_requested" || decision === "rejected") {
    return comment.trim().length >= 5;
  }
  return true;
}

/**
 * Returns structured validation result with human-readable Vietnamese error message.
 */
export function validateReviewDecision(
  decision: ApprovalDecision,
  comment: string
): { isValid: boolean; error?: string } {
  const trimmed = (comment || "").trim();

  if (decision === "revision_requested") {
    if (!trimmed) {
      return {
        isValid: false,
        error: "Vui lòng nhập lý do yêu cầu chỉnh sửa để người thực hiện nắm rõ thông tin.",
      };
    }
    if (trimmed.length < 5) {
      return {
        isValid: false,
        error: "Lý do yêu cầu chỉnh sửa phải có ít nhất 5 ký tự.",
      };
    }
  }

  if (decision === "rejected") {
    if (!trimmed) {
      return {
        isValid: false,
        error: "Vui lòng nêu rõ lý do không phê duyệt hồ sơ minh chứng.",
      };
    }
    if (trimmed.length < 5) {
      return {
        isValid: false,
        error: "Lý do không phê duyệt phải có ít nhất 5 ký tự.",
      };
    }
  }

  return { isValid: true };
}

// ============================================================================
// 2. Component Interface
// ============================================================================

export interface ReviewActionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  taskId?: string;
  taskTitle?: string;
  deliverableSummary?: string;
  deliverableUrl?: string;
  task?: StaffTask | SchoolTask | null;
  onReview?: (payload: ApprovalActionPayload) => Promise<void> | void;
  onAction?: (payload: ApprovalActionPayload) => Promise<void> | void;
  reviewerRole?: UserRole;
  reviewerName?: string;
  isSubmitting?: boolean;
}

// ============================================================================
// 3. Main Component Implementation
// ============================================================================

export function ReviewActionDialog({
  isOpen,
  onClose,
  taskId,
  taskTitle,
  deliverableSummary,
  deliverableUrl,
  task,
  onReview,
  onAction,
  reviewerRole = "MANAGER",
  reviewerName = "Người thẩm định",
  isSubmitting = false,
}: ReviewActionDialogProps) {
  const [decision, setDecision] = React.useState<ApprovalDecision>("approved");
  const [comment, setComment] = React.useState("");
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [localSubmitting, setLocalSubmitting] = React.useState(false);

  // Derive task data from either explicit props or task object
  const effectiveTaskId = taskId || task?.id || "";
  const effectiveTaskTitle = taskTitle || task?.title || "Nhiệm vụ chưa có tiêu đề";

  const effectiveDeliverableSummary =
    deliverableSummary ||
    (task && "deliverableSummary" in task
      ? String((task as Record<string, unknown>).deliverableSummary || "")
      : "") ||
    "";

  const effectiveDeliverableUrl =
    deliverableUrl ||
    (task && "deliverableUrl" in task
      ? String((task as Record<string, unknown>).deliverableUrl || "")
      : (task && "url" in task
      ? String((task as Record<string, unknown>).url || "")
      : "")) ||
    "";

  // Reset dialog state on open
  React.useEffect(() => {
    if (isOpen) {
      setDecision("approved");
      setComment("");
      setValidationError(null);
      setLocalSubmitting(false);
    }
  }, [isOpen]);

  const activeDecisionConfig =
    DECISION_OPTIONS.find((opt) => opt.id === decision) || DECISION_OPTIONS[0];

  const isCommentRequired = decision === "revision_requested" || decision === "rejected";
  const commentCharCount = comment.trim().length;

  const handleDecisionChange = (newDecision: ApprovalDecision) => {
    setDecision(newDecision);
    // Clear validation error when switching decisions
    setValidationError(null);
  };

  const handleQuickTemplateSelect = (tmpl: string) => {
    setComment((prev) => {
      const cleanPrev = prev.trim();
      if (!cleanPrev) return tmpl;
      return `${cleanPrev}. ${tmpl}`;
    });
    setValidationError(null);
  };

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setComment(e.target.value);
    if (validationError) {
      setValidationError(null);
    }
  };

  const handleSubmit = async () => {
    const validation = validateReviewDecision(decision, comment);
    if (!validation.isValid) {
      setValidationError(validation.error || "Vui lòng nhập lý do đánh giá.");
      return;
    }

    const payload: ApprovalActionPayload = {
      taskId: effectiveTaskId,
      decision,
      comment: comment.trim() || undefined,
      reviewedByRole: reviewerRole,
      reviewedByName: reviewerName,
    };

    try {
      setLocalSubmitting(true);
      if (onReview) {
        await onReview(payload);
      } else if (onAction) {
        await onAction(payload);
      }
      onClose();
    } catch (err) {
      setValidationError(
        err instanceof Error
          ? err.message
          : "Có lỗi xảy ra khi gửi kết quả thẩm định. Vui lòng thử lại."
      );
    } finally {
      setLocalSubmitting(false);
    }
  };

  const isProcessing = isSubmitting || localSubmitting;

  return (
    <StandardDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Thẩm định & Phê duyệt Nhiệm vụ"
      description={`Người thẩm định: ${reviewerName} (${reviewerRole})`}
      size="md"
      className="p-0 sm:max-w-lg max-h-[90dvh] flex flex-col overflow-hidden"
    >
      <div className="flex flex-col flex-1 min-h-0">
        {/* Body Content */}
        <div className="overflow-y-auto px-6 py-5 space-y-5 flex-1">
          {/* Task Info Summary */}
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground">
                Nhiệm vụ thẩm định
              </span>
              {effectiveTaskId && (
                <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
                  ID: {effectiveTaskId}
                </Badge>
              )}
            </div>
            <h3 className="text-sm font-semibold text-foreground leading-snug">
              {effectiveTaskTitle}
            </h3>

            {/* Deliverable Info if available */}
            {(effectiveDeliverableSummary || effectiveDeliverableUrl) && (
              <div className="pt-2 border-t border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                {effectiveDeliverableSummary ? (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <FileText className="h-4 w-4 shrink-0 text-primary/70" />
                    <span className="line-clamp-1">{effectiveDeliverableSummary}</span>
                  </div>
                ) : (
                  <div className="text-muted-foreground italic">
                    Có tệp minh chứng đính kèm
                  </div>
                )}
                {effectiveDeliverableUrl && (
                  <a
                    href={effectiveDeliverableUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline shrink-0"
                  >
                    <span>Xem minh chứng</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* 3 Decision States Selector */}
          <div className="space-y-2.5">
            <label
              id="decision-group-label"
              className="text-xs font-semibold text-muted-foreground"
            >
              Quyết định thẩm định <span className="text-rose-500">*</span>
            </label>
            <div
              role="radiogroup"
              aria-labelledby="decision-group-label"
              className="grid grid-cols-1 sm:grid-cols-3 gap-3"
            >
              {DECISION_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = decision === opt.id;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => handleDecisionChange(opt.id)}
                    disabled={isProcessing}
                    className={cn(
                      "relative flex flex-col items-start p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer select-none min-h-[56px] active:scale-[0.99]",
                      "hover:border-primary/50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40",
                      isSelected
                        ? opt.accentColor === "emerald"
                          ? "border-emerald-600 bg-emerald-500/10 text-emerald-950 shadow-xs"
                          : opt.accentColor === "amber"
                          ? "border-amber-600 bg-amber-500/10 text-amber-950 shadow-xs"
                          : "border-rose-600 bg-rose-500/10 text-rose-950 shadow-xs"
                        : "border-border/80 bg-background hover:bg-muted/40 text-foreground"
                    )}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <div
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-lg",
                          isSelected
                            ? opt.accentColor === "emerald"
                              ? "bg-emerald-600 text-white"
                              : opt.accentColor === "amber"
                              ? "bg-amber-600 text-white"
                              : "bg-rose-600 text-white"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <span
                        className={cn(
                          "text-xs font-semibold px-1.5 py-0.5 rounded-md",
                          isSelected
                            ? opt.accentColor === "emerald"
                              ? "bg-emerald-600/20 text-emerald-800"
                              : opt.accentColor === "amber"
                              ? "bg-amber-600/20 text-amber-800"
                              : "bg-rose-600/20 text-rose-800"
                            : "bg-muted/80 text-muted-foreground"
                        )}
                      >
                        {opt.badgeLabel}
                      </span>
                    </div>
                    <span className="text-sm font-semibold leading-tight">
                      {opt.title}
                    </span>
                    <span className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {opt.subtitle}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Comment & Feedback Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="review-approval-comment"
                className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Ý kiến thẩm định & Hướng dẫn</span>
                {isCommentRequired ? (
                  <span className="text-rose-500 font-bold">* (Bắt buộc)</span>
                ) : (
                  <span className="text-muted-foreground/80 font-normal">
                    (Không bắt buộc)
                  </span>
                )}
              </label>
              <span
                className={cn(
                  "text-xs",
                  isCommentRequired && commentCharCount < 5
                    ? "text-amber-600 font-medium"
                    : "text-muted-foreground"
                )}
              >
                <span className="font-mono tabular-nums font-medium">{commentCharCount}</span> ký tự {isCommentRequired && "(Tối thiểu 5)"}
              </span>
            </div>

            <textarea
              id="review-approval-comment"
              rows={4}
              value={comment}
              onChange={handleCommentChange}
              onFocus={() => scrollActiveInputIntoView()}
              disabled={isProcessing}
              placeholder={
                decision === "approved"
                  ? "Nhập nhận xét hoặc ghi chú nghiệm thu bổ sung (nếu có)..."
                  : decision === "revision_requested"
                  ? "Nêu rõ các nội dung, số liệu, minh chứng cụ thể cần sửa đổi hoặc bổ sung..."
                  : "Nêu rõ lý do không nghiệm thu, căn cứ từ chối hồ sơ này..."
              }
              className={cn(
                "w-full min-h-[96px] rounded-xl border bg-background px-3.5 py-2.5 text-base sm:text-sm transition-colors",
                "placeholder:text-muted-foreground/60 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 leading-relaxed",
                validationError
                  ? "border-rose-500 focus:border-rose-500"
                  : isCommentRequired && commentCharCount === 0
                  ? "border-amber-500/70 focus:border-amber-500"
                  : "border-border/80 focus:border-primary"
              )}
            />

            {/* Validation Error Message */}
            {validationError && (
              <div
                role="alert"
                aria-live="polite"
                className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-600 flex items-start gap-2 animate-in fade-in duration-150"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Quick Comment Templates */}
            <div className="pt-1.5 space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground block">
                Mẫu nhận xét nhanh:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_COMMENT_TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleQuickTemplateSelect(tmpl)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border/80 bg-muted/40 px-2.5 py-1.5 sm:py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-left min-h-[36px] sm:min-h-0 cursor-pointer active:scale-[0.98]"
                  >
                    <span>{tmpl}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="shrink-0 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between border-t border-border/80 px-4 py-3 sm:px-6 sm:py-4 bg-muted/20 gap-2.5">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isProcessing}
            className="w-full sm:w-auto min-h-[44px] text-muted-foreground hover:text-foreground cursor-pointer rounded-xl font-medium text-xs sm:text-sm"
          >
            Đóng
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isProcessing}
              className={cn(
                "w-full sm:w-auto min-h-[44px] min-w-36 font-semibold text-white shadow-xs transition-all cursor-pointer rounded-xl text-xs sm:text-sm",
                activeDecisionConfig.accentColor === "emerald" &&
                  "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800",
                activeDecisionConfig.accentColor === "amber" &&
                  "bg-amber-600 hover:bg-amber-700 active:bg-amber-800",
                activeDecisionConfig.accentColor === "rose" &&
                  "bg-rose-600 hover:bg-rose-700 active:bg-rose-800"
              )}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <>
                  <activeDecisionConfig.icon className="h-4 w-4 mr-2" />
                  <span>{activeDecisionConfig.confirmButtonLabel}</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </StandardDialog>
  );
}

export default ReviewActionDialog;
