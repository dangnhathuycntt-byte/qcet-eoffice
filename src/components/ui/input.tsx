import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** compact: 28px trên desktop (44px trên điện thoại), chữ 13px. Mặc định giữ nguyên. */
  compact?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, compact = false, ...props }, ref) => {
    return (
      <input
        type={type}
        data-density={compact ? "compact" : undefined}
        className={cn(
          "flex w-full rounded-control border-0 bg-secondary file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-1 focus-visible:bg-selected read-only:bg-transparent read-only:hover:bg-transparent read-only:text-foreground read-only:focus-visible:bg-transparent read-only:cursor-default read-only:select-text disabled:cursor-not-allowed disabled:text-disabled disabled:opacity-50 aria-invalid:bg-danger-soft aria-invalid:text-destructive transition-colors duration-100",
          compact ? "h-11 px-2 py-0 text-compact sm:h-7" : "h-12 sm:h-9 px-3.5 py-2 text-base sm:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
