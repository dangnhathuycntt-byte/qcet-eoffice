"use client";

import * as React from "react";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  Clock,
  MinusCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type AttentionLevel =
  | "urgent"
  | "warning"
  | "info"
  | "success"
  | "neutral";

export interface AttentionBadgeProps
  extends React.HTMLAttributes<HTMLElement> {
  level: AttentionLevel;
  label: string;
  count?: number;
  icon?: LucideIcon;
  size?: "sm" | "default" | "lg";
  pulse?: boolean;
  asButton?: boolean;
  onClick?: React.MouseEventHandler<HTMLElement>;
}

const levelConfigs: Record<
  AttentionLevel,
  {
    icon: LucideIcon;
    classes: string;
    iconColor: string;
  }
> = {
  urgent: {
    icon: AlertCircle,
    classes:
      "bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100/80",
    iconColor: "text-rose-700",
  },
  warning: {
    icon: AlertTriangle,
    classes:
      "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100/80",
    iconColor: "text-amber-700",
  },
  info: {
    icon: Info,
    classes:
      "bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100/80",
    iconColor: "text-blue-700",
  },
  success: {
    icon: CheckCircle2,
    classes:
      "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100/80",
    iconColor: "text-emerald-700",
  },
  neutral: {
    icon: Clock,
    classes:
      "bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200/80",
    iconColor: "text-slate-600",
  },
};

const sizeStyles: Record<
  "sm" | "default" | "lg",
  {
    container: string;
    icon: string;
    text: string;
    count: string;
  }
> = {
  sm: {
    container: "px-2 py-0.5 text-xs gap-1.5 min-h-[28px]",
    icon: "w-3.5 h-3.5",
    text: "text-xs font-semibold",
    count: "text-xs px-1.5 py-0.2 min-w-[18px]",
  },
  default: {
    container: "px-3 py-1.5 text-xs sm:text-sm gap-2 min-h-[36px]",
    icon: "w-4 h-4",
    text: "text-xs sm:text-sm font-semibold",
    count: "text-xs px-1.5 py-0.5 min-w-[20px]",
  },
  lg: {
    container: "px-3.5 py-2 text-sm gap-2.5 min-h-[44px]",
    icon: "w-4.5 h-4.5",
    text: "text-sm font-bold",
    count: "text-xs px-2 py-0.5 min-w-[22px]",
  },
};

/**
 * AttentionBadge - Semantic badge combining color, icon, and text label.
 * Complies with WCAG 2.2 AA (1.4.1 Use of Color: never conveys status by color alone).
 * Light-only styling without dark: variants.
 */
export const AttentionBadge = React.forwardRef<HTMLElement, AttentionBadgeProps>(
  (
    {
      level,
      label,
      count,
      icon,
      size = "default",
      pulse = false,
      asButton = false,
      onClick,
      className,
      ...props
    },
    ref
  ) => {
    const config = levelConfigs[level] || levelConfigs.neutral;
    const IconComponent = icon || config.icon;
    const sizeConfig = sizeStyles[size] || sizeStyles.default;

    const baseClasses = cn(
      "inline-flex items-center justify-center rounded-lg border font-medium transition-colors select-none",
      sizeConfig.container,
      config.classes,
      asButton &&
        "cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 min-h-[44px]",
      className
    );

    const content = (
      <>
        <span className="relative inline-flex items-center shrink-0">
          <IconComponent
            className={cn(sizeConfig.icon, config.iconColor)}
            strokeWidth={1.5}
            aria-hidden="true"
          />
          {pulse && level === "urgent" && (
            <span
              className="absolute -top-0.5 -right-0.5 flex h-2 w-2"
              aria-hidden="true"
            >
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600" />
            </span>
          )}
        </span>
        <span className={sizeConfig.text}>{label}</span>
        {typeof count === "number" && (
          <span
            className={cn(
              "inline-flex items-center justify-center rounded-full font-mono font-bold bg-white/90 border border-current shadow-xs",
              sizeConfig.count
            )}
            aria-label={`${count} mục`}
          >
            {count}
          </span>
        )}
      </>
    );

    if (asButton || onClick) {
      return (
        <button
          ref={ref as React.ForwardedRef<HTMLButtonElement>}
          type="button"
          onClick={onClick}
          className={baseClasses}
          {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
        >
          {content}
        </button>
      );
    }

    return (
      <span
        ref={ref as React.ForwardedRef<HTMLSpanElement>}
        role="status"
        className={baseClasses}
        {...props}
      >
        {content}
      </span>
    );
  }
);

AttentionBadge.displayName = "AttentionBadge";
