import type { CSSProperties } from "react";
import { cva } from "class-variance-authority";
import { motionDuration, motionEase } from "@/lib/motion/tokens";
import { focusRingClass } from "@/components/ui/focus-ring";

export const propertyTriggerVariants = cva(
  `inline-flex h-7 max-w-full items-center gap-1.5 rounded-md px-1.5 text-xs font-normal whitespace-nowrap select-none cursor-pointer outline-none transition-[background-color,color] duration-[var(--property-press-duration)] ease-[var(--property-ease)] hover:bg-accent data-[popup-open]:bg-accent data-[state=open]:bg-accent ${focusRingClass} disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none motion-reduce:transform-none`,
  {
    variants: {
      variant: {
        default: "border-0 bg-transparent shadow-none text-foreground",
        muted: "border-0 bg-transparent shadow-none text-muted-foreground",
        date: "border-0 bg-secondary px-2 text-xs text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export const propertyPopupClassName = "origin-[var(--transform-origin)] rounded-[var(--radius-menu)] border-0 bg-popover p-1 text-popover-foreground shadow-menu outline-none transition-[opacity,transform] duration-[var(--property-enter-duration)] ease-[var(--property-ease)] data-[starting-style]:opacity-0 data-[starting-style]:-translate-y-1 data-[ending-style]:opacity-0 data-[ending-style]:-translate-y-1 data-[ending-style]:duration-[var(--property-exit-duration)] motion-reduce:transition-none motion-reduce:transform-none";

export const propertyMotionStyle = {
  "--property-press-duration": `${motionDuration.micro * 1000}ms`,
  "--property-enter-duration": `${motionDuration.dropdownEnter * 1000}ms`,
  "--property-exit-duration": `${motionDuration.dropdownExit * 1000}ms`,
  "--property-ease": `cubic-bezier(${motionEase.enter.join(",")})`,
} as CSSProperties;
