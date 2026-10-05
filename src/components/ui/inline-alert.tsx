import * as React from "react";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InlineAlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "error" | "warning" | "info";
  actionLabel?: string;
  onAction?: () => void;
  children?: React.ReactNode;
}

/**
 * Inline alert component matching Components2.dc.html:
 * "Một dòng chữ có icon, không nền màu, không khung, không đường kẻ. Đặt ngay chỗ lỗi.
 * Nói chuyện gì xảy ra, dữ liệu còn không, làm gì tiếp. Không mã lỗi kỹ thuật."
 */
export function InlineAlert({
  variant = "error",
  actionLabel,
  onAction,
  children,
  className,
  ...props
}: InlineAlertProps) {
  const Icon =
    variant === "error" ? AlertCircle : variant === "warning" ? AlertTriangle : Info;

  const colorStyles =
    variant === "error"
      ? "text-destructive"
      : variant === "warning"
        ? "text-foreground font-medium"
        : "text-muted-foreground";

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      data-slot="inline-alert"
      className={cn(
        "flex items-center gap-1.5 text-xs leading-normal font-normal",
        colorStyles,
        className,
      )}
      {...props}
    >
      <Icon className="size-3.5 shrink-0 stroke-[1.5]" />
      <span className="flex-1 min-w-0">{children}</span>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          aria-label={actionLabel}
          className="ml-1 shrink-0 font-medium underline underline-offset-2 hover:opacity-80 active:opacity-100 cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-1 rounded-xs relative before:absolute before:-inset-2 before:content-[''] touch-manipulation"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
