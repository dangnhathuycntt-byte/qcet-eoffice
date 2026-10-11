import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { focusRingClass } from "@/components/ui/focus-ring";

const badgeVariants = cva(
  `group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-sm border-0 px-2 py-0.5 text-xs font-medium tabular-nums whitespace-nowrap transition-colors duration-[var(--motion-duration-micro)] motion-reduce:transition-none outline-none ${focusRingClass} has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:bg-danger-soft aria-invalid:text-destructive [&>svg]:pointer-events-none [&>svg]:size-3.5`,
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:opacity-90",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-accent",
        destructive:
          "bg-danger-soft text-destructive [a]:hover:opacity-90",
        outline:
          "bg-secondary text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground border-transparent",
        link: "text-primary underline-offset-4 hover:underline",
        // QCET task status variants — semantic bg-secondary/text-foreground for dark-mode parity
        sapphire:
          "bg-secondary text-foreground",
        emerald:
          "bg-secondary text-foreground",
        amber:
          "bg-secondary text-foreground",
        rose:
          "bg-secondary text-foreground",
        violet:
          "bg-secondary text-foreground",
        // Backward-compatible aliases
        success:
          "bg-secondary text-foreground",
        progress:
          "bg-secondary text-foreground",
        warning:
          "bg-secondary text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
