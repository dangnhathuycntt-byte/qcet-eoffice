import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const propertyRowVariants = cva(
  "group/row flex items-start justify-between gap-2 py-1 px-1.5 -mx-1.5 rounded-md transition-colors select-none min-h-[28px]",
  {
    variants: {
      interactive: {
        true: "cursor-pointer hover:bg-muted/40",
        false: "",
      },
    },
    defaultVariants: { interactive: false },
  },
);

export interface PropertyRowProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof propertyRowVariants> {
  /** Label displayed on the left side */
  label: string;
  /** Optional icon rendered before the label */
  icon?: React.ReactNode;
}

/**
 * Consistent property row layout for sidebars and detail panels.
 *
 * Replaces 7+ copy-paste className patterns in task-properties-sidebar.tsx
 * with a single cva-driven component.
 */
export function PropertyRow({
  label,
  icon,
  interactive,
  children,
  className,
  ...props
}: PropertyRowProps) {
  return (
    <div className={cn(propertyRowVariants({ interactive }), className)} {...props}>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 min-w-[80px] pt-0.5">
        {icon}
        {label}
      </span>
      <div className="flex-1 min-w-0 flex items-center justify-end">
        {children}
      </div>
    </div>
  );
}

export { propertyRowVariants };
