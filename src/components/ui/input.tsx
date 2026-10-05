import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 sm:h-9 w-full rounded-control border-0 bg-secondary px-3.5 py-2 text-base sm:text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-1 focus-visible:bg-selected read-only:bg-transparent read-only:hover:bg-transparent read-only:text-foreground read-only:focus-visible:bg-transparent read-only:cursor-default read-only:select-text disabled:cursor-not-allowed disabled:text-disabled disabled:opacity-50 aria-invalid:bg-danger-soft aria-invalid:text-destructive transition-colors duration-100",
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
