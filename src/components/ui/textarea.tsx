"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      data-slot="textarea"
      className={cn(
        "min-h-24 w-full resize-y rounded-lg border-0 bg-secondary px-3.5 py-3 text-base sm:text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors duration-[var(--motion-duration-micro)] focus-visible:bg-selected focus-visible:ring-2 focus-visible:ring-ring/50 aria-invalid:bg-danger-soft aria-invalid:ring-destructive read-only:bg-transparent disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
