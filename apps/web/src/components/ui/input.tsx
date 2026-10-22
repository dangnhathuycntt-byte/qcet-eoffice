import * as React from "react";
import { cn } from "@/lib/utils";
import { fieldFocusRingClass } from "@/components/ui/focus-ring";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** compact: 28px trên desktop (32px trên điện thoại), chữ 13px. Mặc định giữ nguyên. */
  compact?: boolean;
  /** menu: ô tìm ở đầu popover/menu kiểu Linear — không nền, không viền focus, cao 32px; đặt đường kẻ bên dưới.
   *  title: tên trong hộp tạo (cuộc họp…) như tên ở hộp Tạo nhiệm vụ — không nền, không viền, chữ 24px/36px đậm (điện thoại 20px). */
  variant?: "field" | "menu" | "title";
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, compact = false, variant = "field", ...props }, ref) => {
    return (
      <input
        type={type}
        data-density={compact ? "compact" : undefined}
        className={cn(
          `flex w-full rounded-control border-0 bg-secondary file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-faint hover:bg-accent ${fieldFocusRingClass} focus-visible:bg-selected read-only:bg-transparent read-only:hover:bg-transparent read-only:text-foreground read-only:focus-visible:bg-transparent read-only:cursor-default read-only:select-text disabled:cursor-not-allowed disabled:text-disabled disabled:opacity-50 aria-invalid:bg-danger-soft aria-invalid:text-destructive transition-colors duration-100`,
          compact ? "h-8 px-2 py-0 text-compact sm:h-7" : "h-10 sm:h-9 px-3.5 py-2 text-base sm:text-sm",
          variant === "menu" &&
            "h-8 sm:h-8 rounded-none bg-transparent px-2 py-0 text-xs sm:text-xs hover:bg-transparent focus-visible:bg-transparent focus-visible:outline-none",
          variant === "title" &&
            "h-9 sm:h-9 rounded-none bg-transparent px-0 py-0 text-2xl sm:text-2xl leading-normal font-semibold max-md:text-xl placeholder:text-faint hover:bg-transparent focus-visible:bg-transparent focus-visible:outline-none aria-invalid:bg-transparent aria-invalid:placeholder:text-destructive/60",
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
