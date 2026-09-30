import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-xl border-0 bg-clip-padding text-sm font-medium whitespace-nowrap transition-colors duration-[var(--motion-duration-micro)] motion-reduce:transition-none outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.98] motion-reduce:transform-none disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary-hover focus-visible:bg-primary-hover",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-accent focus-visible:bg-selected aria-expanded:bg-selected",
        outline:
          "bg-secondary text-foreground hover:bg-accent focus-visible:bg-selected aria-expanded:bg-selected",
        ghost:
          "text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:bg-selected aria-expanded:bg-selected aria-expanded:text-foreground",
        destructive:
          "bg-danger-soft text-destructive hover:bg-destructive/15 focus-visible:bg-destructive/20 focus-visible:ring-destructive/30",
        link: "text-primary underline-offset-4 hover:underline",
        premium:
          "bg-primary text-primary-foreground hover:bg-primary-hover font-medium",
      },
      size: {
        default:
          "h-11 sm:h-8.5 gap-2 px-3.5 py-1.5 text-sm font-medium rounded-xl has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-11 sm:h-7 gap-1 px-2.5 text-xs rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-11 sm:h-7 gap-1.5 rounded-lg px-3 text-xs font-medium has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 px-6 text-base font-semibold rounded-xl has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-11 sm:size-8.5 rounded-xl",
        "icon-xs": "size-11 sm:size-7 rounded-lg [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-11 sm:size-7 rounded-lg",
        "icon-lg": "size-11 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, children, ...props }, ref) => {
    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<any>;
      return React.cloneElement(child, {
        ref,
        "data-slot": "button",
        className: cn(buttonVariants({ variant, size, className }), child.props.className),
        ...props,
      });
    }

    return (
      <button
        ref={ref}
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
