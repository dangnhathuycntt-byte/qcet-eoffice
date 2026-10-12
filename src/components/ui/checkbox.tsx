"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { focusRingClass } from "@/components/ui/focus-ring";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  indeterminate?: boolean;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, indeterminate = false, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(ref, () => inputRef.current!);
    React.useEffect(() => {
      if (inputRef.current) inputRef.current.indeterminate = indeterminate;
    }, [indeterminate]);
    return (
      <input
        {...props}
        ref={inputRef}
        type="checkbox"
        data-slot="checkbox"
        className={cn(
          `size-4 shrink-0 cursor-pointer appearance-none rounded-xs border-2 border-control-edge bg-card bg-center bg-no-repeat outline-none checked:border-primary checked:bg-primary checked:bg-[url(data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2016%2016%27%20fill=%27none%27%20stroke=%27white%27%20stroke-width=%272.5%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%3E%3Cpath%20d=%27M3.5%208.5l3%203%206-7%27/%3E%3C/svg%3E)] indeterminate:border-primary indeterminate:bg-primary indeterminate:bg-[url(data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2016%2016%27%20stroke=%27white%27%20stroke-width=%272.5%27%20stroke-linecap=%27round%27%3E%3Cpath%20d=%27M4%208h8%27/%3E%3C/svg%3E)] ${focusRingClass} disabled:cursor-not-allowed disabled:opacity-50`,
          className,
        )}
      />
    );
  },
);
Checkbox.displayName = "Checkbox";
