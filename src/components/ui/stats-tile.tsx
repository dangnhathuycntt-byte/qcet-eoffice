"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface StatsTileProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  subtext?: string;
  variant?: "default" | "destructive" | "success" | "warning";
}

/**
 * Con số chính · không khung, không thẻ.
 * Chuẩn QCET: Artboard DataViz (Con số chính · 32px/600, tabular-nums, nhãn xám).
 */
export function StatsTile({
  label,
  value,
  subtext,
  variant = "default",
  className,
  ...props
}: StatsTileProps) {
  const valueColor = {
    default: "text-foreground",
    destructive: "text-destructive",
    success: "text-foreground",
    warning: "text-foreground",
  }[variant];

  return (
    <div className={cn("flex flex-col select-none", className)} {...props}>
      <span className="text-compact font-medium text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-hero font-semibold tracking-tight tabular-nums leading-snug mt-1",
          valueColor
        )}
      >
        {value}
      </span>
      {subtext && (
        <span className="text-xs font-normal text-muted-foreground mt-0.5">
          {subtext}
        </span>
      )}
    </div>
  );
}

export interface StatsRowProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/** Hàng chứa các con số chính, cách nhau 48px–64px theo chuẩn thiết kế. */
export function StatsRow({ children, className, ...props }: StatsRowProps) {
  return (
    <div
      className={cn("flex flex-wrap items-start gap-8 sm:gap-14 py-2", className)}
      {...props}
    >
      {children}
    </div>
  );
}
