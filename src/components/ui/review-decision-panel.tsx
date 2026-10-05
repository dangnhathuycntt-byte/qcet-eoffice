"use client";

import * as React from "react";
import { CheckCircle2, AlertTriangle, XCircle, FileText, Send, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export type ReviewDecisionType = "approve" | "request_changes" | "reject";

export interface ReviewDecisionPanelProps
  extends Omit<React.FormHTMLAttributes<HTMLFormElement>, "onSubmit"> {
  documentTitle: string;
  documentNumber?: string;
  requireCommentOnReject?: boolean;
  allowDigitalSignature?: boolean;
  onSubmit: (decision: {
    type: ReviewDecisionType;
    comment: string;
    signWithDigitalCertificate?: boolean;
  }) => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

/**
 * Khung xử lý quyết định thẩm định & phê duyệt văn bản / tờ trình / nhiệm vụ.
 * Cung cấp 3 lựa chọn rõ ràng: Phê duyệt, Yêu cầu chỉnh sửa, hoặc Từ chối kèm lý do.
 */
export function ReviewDecisionPanel({
  documentTitle,
  documentNumber,
  requireCommentOnReject = true,
  allowDigitalSignature = true,
  onSubmit,
  onCancel,
  isLoading = false,
  className,
  ...props
}: ReviewDecisionPanelProps) {
  const [selectedDecision, setSelectedDecision] = React.useState<ReviewDecisionType>("approve");
  const [comment, setComment] = React.useState("");
  const [signWithDigitalCertificate, setSignWithDigitalCertificate] = React.useState(true);

  const isCommentRequired =
    requireCommentOnReject && (selectedDecision === "request_changes" || selectedDecision === "reject");
  const isSubmitDisabled = isLoading || (isCommentRequired && !comment.trim());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitDisabled) return;
    onSubmit({
      type: selectedDecision,
      comment: comment.trim(),
      signWithDigitalCertificate: selectedDecision === "approve" ? signWithDigitalCertificate : false,
    });
  };

  const decisionConfigs: Record<
    ReviewDecisionType,
    {
      label: string;
      desc: string;
      icon: React.ReactNode;
      activeClass: string;
      btnClass: string;
    }
  > = {
    approve: {
      label: "Phê duyệt / Thông qua",
      desc: "Đồng ý ban hành văn bản và chuyển bước tiếp theo",
      icon: <CheckCircle2 className="size-4 text-foreground" />,
      activeClass: "bg-selected text-foreground font-semibold",
      btnClass: "bg-primary hover:opacity-90 text-primary-foreground",
    },
    request_changes: {
      label: "Yêu cầu chỉnh sửa",
      desc: "Chuyển lại chuyên viên để bổ sung hoặc sửa đổi",
      icon: <AlertTriangle className="size-4 text-foreground" />,
      activeClass: "bg-selected text-foreground font-semibold",
      btnClass: "bg-primary hover:opacity-90 text-primary-foreground",
    },
    reject: {
      label: "Không phê duyệt",
      desc: "Yêu cầu chỉnh sửa đề xuất và kết thúc quy trình xử lý",
      icon: <XCircle className="size-4 text-destructive" />,
      activeClass: "bg-danger-soft text-destructive font-semibold",
      btnClass: "bg-destructive hover:opacity-90 text-destructive-foreground",
    },
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("flex flex-col gap-4 rounded-2xl border-0 bg-card p-5 shadow-none", className)}
      {...props}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 pb-1">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Ý kiến người duyệt</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Văn bản: <span className="font-medium text-foreground">{documentTitle}</span>{" "}
            {documentNumber ? `(${documentNumber})` : ""}
          </p>
        </div>
        <FileText className="size-4 text-muted-foreground shrink-0" />
      </div>

      {/* 3 Lựa chọn quyết định */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {(Object.keys(decisionConfigs) as ReviewDecisionType[]).map((type) => {
          const config = decisionConfigs[type];
          const isSelected = selectedDecision === type;

          return (
            <button
              key={type}
              type="button"
              onClick={() => setSelectedDecision(type)}
              className={cn(
                "flex flex-col items-start gap-1.5 rounded-xl border-0 p-3 text-left transition-colors duration-100 outline-none focus-visible:outline-2 focus-visible:outline-primary",
                isSelected
                  ? config.activeClass
                  : "bg-secondary text-foreground hover:bg-accent"
              )}
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                {config.icon}
                <span>{config.label}</span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 leading-snug">
                {config.desc}
              </p>
            </button>
          );
        })}
      </div>

      {/* Tùy chọn ký số khi phê duyệt */}
      {selectedDecision === "approve" && allowDigitalSignature ? (
        <label className="flex items-center gap-2 rounded-xl bg-secondary p-3 text-xs text-foreground cursor-pointer border-0">
          <input
            type="checkbox"
            checked={signWithDigitalCertificate}
            onChange={(e) => setSignWithDigitalCertificate(e.target.checked)}
            className="rounded-sm text-primary size-4 border-0"
          />
          <ShieldCheck className="size-4 text-primary shrink-0" />
          <span>Kèm chữ ký số cá nhân (VGCA / SmartCA) khi phê duyệt</span>
        </label>
      ) : null}

      {/* Nhập ý kiến / lý do */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground flex items-center justify-between">
          <span>
            {selectedDecision === "approve" ? "Ý kiến chỉ đạo / Ghi chú:" : "Lý do / Yêu cầu cụ thể:"}
          </span>
          {isCommentRequired ? (
            <span className="text-xs text-destructive font-normal">* Bắt buộc nhập</span>
          ) : (
            <span className="text-xs text-muted-foreground font-normal">Không bắt buộc</span>
          )}
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder={
            selectedDecision === "approve"
              ? "Nhập ý kiến chỉ đạo bổ sung hoặc lưu ý khi triển khai..."
              : selectedDecision === "request_changes"
                ? "Nêu rõ các nội dung cần bổ sung, chỉnh sửa và thời hạn nộp lại..."
                : "Nêu rõ lý do không phê duyệt văn bản/tờ trình..."
          }
          className="w-full rounded-xl border-0 bg-secondary p-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:bg-selected"
        />
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-end gap-2 pt-2">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-xl border-0 bg-secondary px-3.5 py-2 text-xs font-medium text-foreground hover:bg-accent transition-colors duration-100 disabled:opacity-50"
          >
            Hủy bỏ
          </button>
        ) : null}
        <button
          type="submit"
          disabled={isSubmitDisabled}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-xl border-0 px-4 py-2 text-xs font-medium transition-colors duration-100 disabled:opacity-50",
            decisionConfigs[selectedDecision].btnClass
          )}
        >
          <Send className="size-3.5" />
          <span>{isLoading ? "Đang gửi quyết định..." : "Xác nhận quyết định"}</span>
        </button>
      </div>
    </form>
  );
}
