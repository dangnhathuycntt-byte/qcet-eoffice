"use client";

import * as React from "react";
import { AlertCircle, Flame, Lock, ShieldAlert, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export type UrgencyLevel = "normal" | "urgent" | "very_urgent" | "express";
export type ConfidentialityLevel = "normal" | "secret" | "top_secret" | "absolute_secret";

export interface UrgencyBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  level: UrgencyLevel;
  showIcon?: boolean;
}

/**
 * Huy hiệu hiển thị Độ khẩn của văn bản hành chính theo Nghị định 30/2020/NĐ-CP.
 * Các mức: Thường, Khẩn, Thượng khẩn, Hỏa tốc (kèm Hỏa tốc hẹn giờ).
 */
export function UrgencyBadge({ level, showIcon = true, className, ...props }: UrgencyBadgeProps) {
  const configs: Record<
    UrgencyLevel,
    { label: string; bg: string; text: string; icon: React.ReactNode }
  > = {
    normal: {
      label: "Bình thường",
      bg: "bg-secondary",
      text: "text-muted-foreground",
      icon: null,
    },
    urgent: {
      label: "Khẩn",
      bg: "bg-secondary",
      text: "text-foreground font-medium",
      icon: <Zap className="size-3 text-foreground" />,
    },
    very_urgent: {
      label: "Thượng khẩn",
      bg: "bg-secondary",
      text: "text-foreground font-semibold",
      icon: <AlertCircle className="size-3 text-foreground" />,
    },
    express: {
      label: "Hỏa tốc",
      bg: "bg-danger-soft",
      text: "text-destructive font-semibold",
      icon: <Flame className="size-3 text-destructive" />,
    },
  };

  const config = configs[level];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold border-0",
        config.bg,
        config.text,
        className
      )}
      {...props}
    >
      {showIcon && config.icon}
      <span>{config.label}</span>
    </span>
  );
}

export interface ConfidentialityBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  level: ConfidentialityLevel;
  showIcon?: boolean;
}

/**
 * Huy hiệu hiển thị Độ mật của văn bản theo Luật Bảo vệ bí mật nhà nước.
 * Các mức: Thường, Mật, Tối mật, Tuyệt mật.
 */
export function ConfidentialityBadge({
  level,
  showIcon = true,
  className,
  ...props
}: ConfidentialityBadgeProps) {
  const configs: Record<
    ConfidentialityLevel,
    { label: string; bg: string; text: string; icon: React.ReactNode }
  > = {
    normal: {
      label: "Công khai",
      bg: "bg-secondary",
      text: "text-muted-foreground",
      icon: null,
    },
    secret: {
      label: "Mật",
      bg: "bg-secondary",
      text: "text-foreground font-medium",
      icon: <Lock className="size-3 text-foreground" />,
    },
    top_secret: {
      label: "Tối mật",
      bg: "bg-secondary",
      text: "text-foreground font-semibold",
      icon: <ShieldAlert className="size-3 text-foreground" />,
    },
    absolute_secret: {
      label: "Tuyệt mật",
      bg: "bg-danger-soft",
      text: "text-destructive font-semibold",
      icon: <ShieldAlert className="size-3 text-destructive" />,
    },
  };

  const config = configs[level];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold border-0",
        config.bg,
        config.text,
        className
      )}
      {...props}
    >
      {showIcon && config.icon}
      <span>{config.label}</span>
    </span>
  );
}

export interface DocumentSecurityHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  urgency?: UrgencyLevel;
  confidentiality?: ConfidentialityLevel;
}

/**
 * Khối kết hợp hiển thị đồng thời Độ khẩn và Độ mật trên đầu văn bản/nhiệm vụ.
 */
export function DocumentSecurityHeader({
  urgency = "normal",
  confidentiality = "normal",
  className,
  ...props
}: DocumentSecurityHeaderProps) {
  if (urgency === "normal" && confidentiality === "normal") return null;

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)} {...props}>
      {urgency !== "normal" ? <UrgencyBadge level={urgency} /> : null}
      {confidentiality !== "normal" ? <ConfidentialityBadge level={confidentiality} /> : null}
    </div>
  );
}
