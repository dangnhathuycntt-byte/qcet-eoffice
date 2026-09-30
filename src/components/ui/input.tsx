import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 sm:h-9 w-full rounded-lg border-0 bg-secondary px-3.5 py-2 text-base sm:text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:bg-selected read-only:bg-transparent read-only:focus-visible:bg-transparent disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:bg-danger-soft aria-invalid:text-destructive aria-invalid:ring-destructive transition-colors duration-[var(--motion-duration-micro)]",
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
