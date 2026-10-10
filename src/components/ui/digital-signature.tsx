"use client";

import * as React from "react";
import { CheckCircle2, Clock, AlertTriangle, ShieldCheck, KeyRound, FileCheck, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

export type SignatureStatus = "valid" | "pending" | "invalid" | "expired";

export interface DigitalSignatureBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: SignatureStatus;
  label?: string;
  showIcon?: boolean;
}

/**
 * Huy hiệu trạng thái chữ ký số điện tử.
 */
export function DigitalSignatureBadge({
  status,
  label,
  showIcon = true,
  className,
  ...props
}: DigitalSignatureBadgeProps) {
  const configs: Record<
    SignatureStatus,
    { text: string; bg: string; textCol: string; icon: React.ReactNode }
  > = {
    valid: {
      text: "Đã ký số hợp lệ",
      bg: "bg-secondary",
      textCol: "text-foreground font-medium",
      icon: <CheckCircle2 className="size-3.5 shrink-0 text-foreground" />,
    },
    pending: {
      text: "Chờ ký số",
      bg: "bg-secondary",
      textCol: "text-muted-foreground",
      icon: <Clock className="size-3.5 shrink-0 text-muted-foreground" />,
    },
    invalid: {
      text: "Chữ ký không hợp lệ",
      bg: "bg-danger-soft",
      textCol: "text-destructive font-medium",
      icon: <AlertTriangle className="size-3.5 shrink-0 text-destructive" />,
    },
    expired: {
      text: "Chứng thư hết hạn",
      bg: "bg-secondary",
      textCol: "text-muted-foreground",
      icon: <AlertTriangle className="size-3.5 shrink-0 text-muted-foreground" />,
    },
  };

  const config = configs[status];
  const displayText = label ?? config.text;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border-0 px-2 py-0.5 text-xs font-medium transition-colors",
        config.bg,
        config.textCol,
        className
      )}
      {...props}
    >
      {showIcon ? config.icon : null}
      {displayText}
    </span>
  );
}

export interface DigitalSignatureStampProps extends React.HTMLAttributes<HTMLDivElement> {
  signerName: string;
  signerPosition?: string;
  organization?: string;
  signedAt?: string | Date;
  certificateAuthority?: string;
  hashSha256?: string;
}

/**
 * Con dấu / Khối hiển thị chữ ký số điện tử trên tài liệu chuẩn e-Office.
 */
export function DigitalSignatureStamp({
  signerName,
  signerPosition = "Hiệu trưởng",
  organization = "Trường CĐ KT-KT Quảng Châu",
  signedAt = new Date(),
  certificateAuthority = "Ban Cơ yếu Chính phủ (VGCA)",
  hashSha256,
  className,
  ...props
}: DigitalSignatureStampProps) {
  const formattedTime = React.useMemo(() => {
    if (!signedAt) return "";
    if (typeof signedAt === "string") return signedAt;
    return new Intl.DateTimeFormat("vi-VN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(signedAt);
  }, [signedAt]);

  return (
    <div
      className={cn(
        "relative inline-flex flex-col rounded-xl border-0 bg-secondary p-3 text-left font-sans text-foreground",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <ShieldCheck className="size-4 shrink-0 text-primary" />
        <span>Ký bởi: {signerName}</span>
      </div>

      <div className="mt-1 flex flex-col gap-0.5 text-xs leading-tight text-muted-foreground">
        {signerPosition ? <p>Chức vụ: {signerPosition}</p> : null}
        {organization ? <p>Cơ quan: {organization}</p> : null}
        {formattedTime ? <p>Thời gian: {formattedTime}</p> : null}
        {certificateAuthority ? (
          <p className="text-xs text-muted-foreground">
            Cấp bởi: {certificateAuthority}
          </p>
        ) : null}
      </div>

      {hashSha256 ? (
        <div className="mt-2 pt-0.5 font-mono text-xs text-muted-foreground">
          SHA: {hashSha256.slice(0, 16)}...
        </div>
      ) : null}
    </div>
  );
}

export interface RemoteSigningFlowProps {
  documentTitle: string;
  documentNumber?: string;
  onSign: (provider: "smart_ca" | "usb_token") => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

/**
 * Khung xử lý ký số từ xa (Remote Signing / SmartCA / USB Token).
 */
export function RemoteSigningFlow({
  documentTitle,
  documentNumber,
  onSign,
  onCancel,
  isLoading = false,
}: RemoteSigningFlowProps) {
  const [selectedProvider, setSelectedProvider] = React.useState<"smart_ca" | "usb_token">("smart_ca");

  return (
    <div className="flex flex-col gap-4 rounded-2xl border-0 bg-card p-5 shadow-none">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Xác nhận ký số điện tử</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Văn bản: {documentTitle} {documentNumber ? `(${documentNumber})` : ""}
          </p>
        </div>
        <FileCheck className="size-5 shrink-0 text-primary" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setSelectedProvider("smart_ca")}
          className={cn(
            "flex flex-col items-start gap-2 rounded-xl border-0 p-3 text-left transition-colors duration-100 outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary",
            selectedProvider === "smart_ca"
              ? "bg-selected text-foreground font-semibold"
              : "bg-secondary text-foreground hover:bg-accent"
          )}
        >
          <Smartphone className="size-5 text-primary" />
          <div>
            <div className="text-xs font-semibold text-foreground">Ký từ xa SmartCA</div>
            <div className="text-xs text-muted-foreground">Xác thực qua ứng dụng di động</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedProvider("usb_token")}
          className={cn(
            "flex flex-col items-start gap-2 rounded-xl border-0 p-3 text-left transition-colors duration-100 outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary",
            selectedProvider === "usb_token"
              ? "bg-selected text-foreground font-semibold"
              : "bg-secondary text-foreground hover:bg-accent"
          )}
        >
          <KeyRound className="size-5 text-primary" />
          <div>
            <div className="text-xs font-semibold text-foreground">USB Token phần cứng</div>
            <div className="text-xs text-muted-foreground">Thiết bị cắm cổng USB</div>
          </div>
        </button>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-xl border-0 bg-secondary px-3.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            Hủy bỏ
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onSign(selectedProvider)}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 rounded-xl border-0 bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-50"
        >
          <ShieldCheck className="size-4" />
          {isLoading ? "Đang kết nối thiết bị..." : "Thực hiện ký số"}
        </button>
      </div>
    </div>
  );
}
