"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ReadOnlyFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string;
  /** Cho phép nút sao chép nhanh (mặc định: true). */
  copyable?: boolean;
  hint?: string;
  mono?: boolean;
}

/**
 * Ô hiển thị dữ liệu chỉ đọc (mã định danh, số văn bản, ký hiệu...), có nút sao chép nhanh.
 * Chuẩn QCET: Artboard Components5 (Ô chỉ đọc · Nhãn trên, nền xám nhạt không viền).
 */
export function ReadOnlyField({
  label,
  value,
  copyable = true,
  hint,
  mono = false,
  className,
  ...props
}: ReadOnlyFieldProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)} {...props}>
      <span className="text-xs font-medium text-foreground">{label}</span>
      <div
        className={cn(
          "group relative flex min-h-9 sm:min-h-9 h-9 w-full items-center justify-between gap-2 rounded-xl bg-secondary px-3 py-1.5 text-sm text-foreground select-all",
          mono && "font-mono text-xs tracking-tight"
        )}
      >
        <span className="truncate">{value}</span>

        {copyable && (
          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? "Đã sao chép" : `Sao chép ${label}`}
            className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-1 cursor-pointer"
          >
            {copied ? (
              <Check className="size-3.5 text-foreground" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </button>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
