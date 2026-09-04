"use client";

import * as React from "react";
import { Calendar, Clock, AlertTriangle, Building2, Layers, CheckCircle } from "lucide-react";
import type { UpcomingItem } from "@/types/dashboard";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface UpcomingDeadlinesWidgetProps {
  items?: UpcomingItem[];
  onSelectTask?: (item: UpcomingItem) => void;
  className?: string;
}

export function parseDateOnly(input: string | Date): { year: number; month: number; day: number } {
  if (input instanceof Date) {
    return {
      year: input.getFullYear(),
      month: input.getMonth(),
      day: input.getDate(),
    };
  }
  if (typeof input === "string") {
    const match = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return {
        year: parseInt(match[1], 10),
        month: parseInt(match[2], 10) - 1,
        day: parseInt(match[3], 10),
      };
    }
    const d = new Date(input);
    if (!isNaN(d.getTime())) {
      return {
        year: d.getFullYear(),
        month: d.getMonth(),
        day: d.getDate(),
      };
    }
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
}

export function isDateOverdue(dateStr: string, referenceDate?: Date | string): boolean {
  if (!dateStr) return false;
  const target = parseDateOnly(dateStr);
  const ref = referenceDate
    ? parseDateOnly(referenceDate)
    : parseDateOnly(new Date().toISOString().split("T")[0]);
  const targetUtc = Date.UTC(target.year, target.month, target.day);
  const refUtc = Date.UTC(ref.year, ref.month, ref.day);
  return targetUtc < refUtc;
}

export function formatDeadlineDistance(dateStr: string, referenceDate?: Date | string): string {
  if (!dateStr) return "";
  const target = parseDateOnly(dateStr);
  const ref = referenceDate
    ? parseDateOnly(referenceDate)
    : parseDateOnly(new Date().toISOString().split("T")[0]);
  const targetUtc = Date.UTC(target.year, target.month, target.day);
  const refUtc = Date.UTC(ref.year, ref.month, ref.day);
  const diffDays = Math.round((targetUtc - refUtc) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Hôm nay";
  if (diffDays === 1) return "Ngày mai";
  if (diffDays === 2) return "Còn 2 ngày";
  if (diffDays > 2 && diffDays <= 7) return `Còn ${diffDays} ngày`;
  if (diffDays > 7) return `Còn ${diffDays} ngày`;
  if (diffDays === -1) return "Quá hạn 1 ngày";
  if (diffDays < -1) return `Quá hạn ${Math.abs(diffDays)} ngày`;
  return dateStr;
}

export function getInitials(name: string): string {
  if (!name || !name.trim()) return "QC";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0].charAt(0);
  const last = parts[parts.length - 1].charAt(0);
  return (first + last).toUpperCase();
}

export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const parts = parseDateOnly(dateStr);
    const day = String(parts.day).padStart(2, "0");
    const month = String(parts.month + 1).padStart(2, "0");
    return `${day}/${month}`;
  } catch {
    return dateStr;
  }
}

export function UpcomingDeadlinesWidget({
  items = [],
  onSelectTask,
  className,
}: UpcomingDeadlinesWidgetProps) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-border/75 bg-card p-4.5 text-card-foreground shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] hover:border-border transition-all duration-200",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground border border-border/50">
            <Calendar className="size-4 text-foreground/80" />
          </div>
          <div>
            <h3 className="font-sans text-sm font-semibold text-foreground tracking-tight">
              Hạn chót 7 ngày tới
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Nhiệm vụ cần ưu tiên hoàn tất theo tiến độ
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="font-mono text-xs font-semibold px-2 py-0.5">
          {items.length}
        </Badge>
      </div>

      {/* List content */}
      <div className="flex flex-col divide-y divide-border/50 pt-1">
        {items.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Không có nhiệm vụ nào có hạn chót trong 7 ngày tới
          </div>
        ) : (
          items.map((item) => {
            const overdue = item.isOverdue || isDateOverdue(item.dueDate);
            const relativeDistance = formatDeadlineDistance(item.dueDate);
            const displayDate = formatDisplayDate(item.dueDate);

            return (
              <div
                key={item.id}
                tabIndex={onSelectTask ? 0 : undefined}
                onClick={() => onSelectTask?.(item)}
                onKeyDown={(e) => {
                  if (onSelectTask && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    onSelectTask(item);
                  }
                }}
                className={cn(
                  "group flex flex-col gap-1.5 py-3 transition-colors first:pt-2.5 last:pb-1 focus-visible:outline-hidden focus-visible:bg-muted/50",
                  onSelectTask && "cursor-pointer hover:bg-muted/40 -mx-2 px-2 rounded-md"
                )}
                role={onSelectTask ? "button" : undefined}
                aria-label={onSelectTask ? `Chi tiết hạn chót: ${item.title}` : undefined}
              >
                {/* Top row: Badges & metadata */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Level Badge */}
                    <Badge
                      variant={item.level === "Trường" ? "default" : "secondary"}
                      className={cn(
                        "text-[10px] px-1.5 py-0 font-medium h-4.5 rounded",
                        item.level === "Trường"
                          ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
                          : "border-border/80 bg-zinc-100 text-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300"
                      )}
                    >
                      {item.level === "Trường" ? (
                        <Building2 className="size-2.5 mr-0.5" />
                      ) : (
                        <Layers className="size-2.5 mr-0.5" />
                      )}
                      {item.level}
                    </Badge>

                    {/* Overdue Alert or Date Distance Badge */}
                    {overdue ? (
                      <Badge
                        variant="destructive"
                        className="text-[10px] px-1.5 py-0 font-medium h-4.5 rounded gap-1"
                      >
                        <AlertTriangle className="size-2.5" />
                        {relativeDistance.startsWith("Quá hạn")
                          ? relativeDistance
                          : `Quá hạn · ${relativeDistance}`}
                      </Badge>
                    ) : (
                      <Badge
                        variant={
                          relativeDistance === "Hôm nay"
                            ? "warning"
                            : relativeDistance === "Ngày mai"
                            ? "progress"
                            : "outline"
                        }
                        className="text-[10px] px-1.5 py-0 font-medium h-4.5 rounded"
                      >
                        <Clock className="size-2.5 mr-0.5 opacity-70" />
                        {relativeDistance}
                      </Badge>
                    )}
                  </div>

                  {/* Absolute date */}
                  <span className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                    {displayDate}
                  </span>
                </div>

                {/* Title */}
                <h4
                  className="text-xs font-medium text-foreground leading-snug line-clamp-2 group-hover:text-foreground/90 transition-colors"
                  title={item.title}
                >
                  {item.title}
                </h4>

                {/* Assignee row */}
                <div className="flex items-center gap-2 pt-0.5 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {item.assigneeAvatar ? (
                      <img
                        src={item.assigneeAvatar}
                        alt={item.assigneeName}
                        width={16}
                        height={16}
                        loading="lazy"
                        className="size-4 rounded-full object-cover shrink-0 ring-1 ring-border/50"
                      />
                    ) : (
                      <div className="flex size-4 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[9px] font-medium text-foreground ring-1 ring-border/50">
                        {getInitials(item.assigneeName)}
                      </div>
                    )}
                    <span className="truncate text-foreground/80 font-normal">
                      {item.assigneeName}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
