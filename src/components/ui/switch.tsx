"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type SwitchProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "role">;

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, ...props }, ref) => (
    <span className="relative inline-flex min-h-11 items-center sm:min-h-6">
      <input
        {...props}
        ref={ref}
        type="checkbox"
        role="switch"
        data-slot="switch"
        className={cn(
          "peer h-6 w-10 cursor-pointer appearance-none rounded-full bg-mark outline-none transition-colors duration-[var(--motion-duration-micro)] checked:bg-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
          className,
        )}
      />
      <span aria-hidden="true" className="pointer-events-none absolute left-1 size-4 rounded-full bg-card transition-transform duration-[var(--motion-duration-fast)] peer-checked:translate-x-4 peer-disabled:opacity-50 motion-reduce:transition-none" />
    </span>
  ),
);
Switch.displayName = "Switch";
