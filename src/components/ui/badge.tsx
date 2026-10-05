import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-sm border-0 px-2 py-0.5 text-xs font-medium tabular-nums whitespace-nowrap transition-colors duration-[var(--motion-duration-micro)] motion-reduce:transition-none outline-none focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-1 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:bg-danger-soft aria-invalid:text-destructive [&>svg]:pointer-events-none [&>svg]:size-3.5",
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
        // QCET task status variants (10% tint pastel, accessible text)
        sapphire:
          "bg-blue-500/10 text-blue-600",
        emerald:
          "bg-emerald-500/10 text-emerald-700",
        amber:
          "bg-amber-500/10 text-amber-700",
        rose:
          "bg-rose-500/10 text-rose-600",
        violet:
          "bg-violet-500/10 text-violet-600",
        // Backward-compatible aliases
        success:
          "bg-emerald-500/10 text-emerald-700",
        progress:
          "bg-blue-500/10 text-blue-600",
        warning:
          "bg-amber-500/10 text-amber-700",
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
