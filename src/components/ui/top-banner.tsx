"use client";

import * as React from "react";
import { X, Info, AlertTriangle, AlertCircle } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const topBannerVariants = cva(
  "relative z-30 flex w-full items-center justify-between gap-3 px-4 py-2 text-xs sm:text-sm transition-colors duration-150",
  {
    variants: {
      variant: {
        default: "bg-secondary text-foreground",
        warning: "bg-secondary text-foreground font-medium",
        destructive: "bg-danger-soft text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface TopBannerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof topBannerVariants> {
  onDismiss?: () => void;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

/**
 * Top announcement banner component matching Components4.dc.html:
 * "Một dòng, bấm × để ẩn, không chặn thao tác. Lỗi nghiêm trọng mới dùng hộp thoại."
 */
export function TopBanner({
  className,
  variant = "default",
  onDismiss,
  icon,
  action,
  children,
  ...props
}: TopBannerProps) {
  const [dismissed, setDismissed] = React.useState(false);

  if (dismissed) return null;

  const defaultIcon =
    variant === "destructive" ? (
      <AlertCircle className="size-4 shrink-0 text-destructive" />
    ) : variant === "warning" ? (
      <AlertTriangle className="size-4 shrink-0 text-foreground" />
    ) : (
      <Info className="size-4 shrink-0 text-muted-foreground" />
    );

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      role={variant === "destructive" ? "alert" : "status"}
      data-slot="top-banner"
      className={cn(topBannerVariants({ variant, className }))}
      {...props}
    >
      <div className="flex flex-1 items-center justify-center gap-2 text-center min-w-0">
        {icon ?? defaultIcon}
        <span className="truncate">{children}</span>
        {action && <div className="ml-2 shrink-0">{action}</div>}
      </div>

      {onDismiss !== undefined && (
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors duration-100 cursor-pointer shrink-0 outline-none focus-visible:outline-2 focus-visible:outline-primary"
          aria-label="Ẩn thông báo"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
