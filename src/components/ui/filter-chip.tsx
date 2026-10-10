import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { focusRingClass } from "@/components/ui/focus-ring";

export interface FilterChipProps {
  /** Tên bộ lọc, ví dụ "Trạng thái". */
  label: string;
  /** Giá trị đang áp dụng, ví dụ "Đang thực hiện". */
  value: string;
  onRemove?: () => void;
  className?: string;
}

/** Bộ lọc đang áp dụng, gỡ được bằng nút ×. */
export function FilterChip({ label, value, onRemove, className }: FilterChipProps) {
  return (
    <span
      className={cn(
        "inline-flex h-7 max-w-full items-center gap-1 rounded-full bg-secondary pl-2.5 pr-1 text-xs",
        className,
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium text-foreground">{value}</span>
      {onRemove ? (
        <button
          type="button"
          aria-label={`Gỡ bộ lọc ${label}: ${value}`}
          onClick={onRemove}
          className={`flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-accent hover:text-foreground ${focusRingClass} relative before:absolute before:-inset-2 before:content-[''] touch-manipulation`}
        >
          <X className="size-3" />
        </button>
      ) : (
        <span className="w-1.5" />
      )}
    </span>
  );
}
