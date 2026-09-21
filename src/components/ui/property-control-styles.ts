import type { CSSProperties } from "react";
import { cva } from "class-variance-authority";
import { motionDuration, motionEase } from "@/lib/motion/tokens";

export const propertyTriggerVariants = cva(
  "inline-flex h-7 max-w-full items-center gap-1.5 rounded-md px-1.5 text-xs font-normal whitespace-nowrap select-none cursor-pointer outline-none transition-[background-color,color,transform] duration-[var(--property-press-duration)] ease-[var(--property-ease)] hover:bg-muted/50 active:bg-muted active:scale-[0.98] data-[popup-open]:bg-muted/50 data-[state=open]:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none motion-reduce:transform-none",
  {
    variants: {
      variant: {
        default: "border-0 bg-transparent shadow-none text-foreground",
        muted: "border-0 bg-transparent shadow-none text-muted-foreground",
        date: "border border-border/60 bg-muted/30 px-2 text-[11px] text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export const propertyPopupClassName = "origin-[var(--transform-origin)] rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none transition-[opacity,transform] duration-[var(--property-enter-duration)] ease-[var(--property-ease)] data-[starting-style]:opacity-0 data-[starting-style]:-translate-y-1 data-[starting-style]:scale-[0.985] data-[ending-style]:opacity-0 data-[ending-style]:-translate-y-1 data-[ending-style]:scale-[0.985] data-[ending-style]:duration-[var(--property-exit-duration)] motion-reduce:transition-none motion-reduce:transform-none";

export const propertyMotionStyle = {
  "--property-press-duration": `${motionDuration.micro * 1000}ms`,
  "--property-enter-duration": `${motionDuration.dropdownEnter * 1000}ms`,
  "--property-exit-duration": `${motionDuration.dropdownExit * 1000}ms`,
  "--property-ease": `cubic-bezier(${motionEase.enter.join(",")})`,
} as CSSProperties;
