"use client";

import * as React from "react";
import Link from "next/link";
import { Calendar, Clock, AlertTriangle, Building2, Layers, CheckCircle, ChevronDown, ChevronUp, ChevronRight } from "lucide-react";
import type { UpcomingItem } from "@/types/dashboard";
export type { UpcomingItem };
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDisplayDate } from "@/lib/format";

export interface UpcomingDeadlinesWidgetProps {
  items?: UpcomingItem[];
  onSelectTask?: (item: UpcomingItem) => void;
  className?: string;
  initialLimit?: number;
  viewAllHref?: string;
  /**
   * Size of the full deadline window. Defaults to `items.length`. Carried
   * explicitly so a caller can never mistake the preview slice for the total
   * (plan T07.4).
   */
  total?: number;
}

export function parseDateOnly(input: string | Date): { year: number; month: number; day: number } {
  if (input instanceof Date) {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
    const parts = formatter.formatToParts(input);
    const y = parseInt(parts.find((p) => p.type === "year")?.value || "0", 10);
    const m = parseInt(parts.find((p) => p.type === "month")?.value || "1", 10) - 1;
    const d = parseInt(parts.find((p) => p.type === "day")?.value || "1", 10);
    return { year: y, month: m, day: d };
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
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "numeric",
        day: "numeric",
      });
      const parts = formatter.formatToParts(d);
      const y = parseInt(parts.find((p) => p.type === "year")?.value || "0", 10);
      const m = parseInt(parts.find((p) => p.type === "month")?.value || "1", 10) - 1;
      const dayVal = parseInt(parts.find((p) => p.type === "day")?.value || "1", 10);
      return { year: y, month: m, day: dayVal };
    }
  }
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = formatter.formatToParts(now);
  const y = parseInt(parts.find((p) => p.type === "year")?.value || "0", 10);
  const m = parseInt(parts.find((p) => p.type === "month")?.value || "1", 10) - 1;
  const d = parseInt(parts.find((p) => p.type === "day")?.value || "1", 10);
  return { year: y, month: m, day: d };
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

export const formatRelativeDueDate = formatDeadlineDistance;

export function getInitials(name: string): string {
  if (!name || !name.trim()) return "QC";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0].charAt(0);
  const last = parts[parts.length - 1].charAt(0);
  return (first + last).toUpperCase();
}

export function UpcomingDeadlinesWidget({
  items = [],
  onSelectTask,
  className,
  initialLimit = 5,
  // `view=table` is a value the /tasks query parser really consumes; `filter` was
  // silently ignored and led to a dead drill-down (plan T07.7 / T08.1).
  viewAllHref = "/tasks?view=table",
  total,
}: UpcomingDeadlinesWidgetProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const windowTotal = total ?? items.length;
  const displayedItems = initialLimit && !isExpanded ? items.slice(0, initialLimit) : items;

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card p-3.5 sm:p-4 text-card-foreground transition-colors",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-muted-foreground" strokeWidth={1.5} />
          <div>
            <h3 className="font-sans text-sm font-bold text-foreground tracking-tight">
              Hạn chót 7 ngày tới
            </h3>
            <p className="text-xs text-muted-foreground">
              {windowTotal > initialLimit && !isExpanded
                ? `Hiển thị ${displayedItems.length} nhiệm vụ sát hạn nhất trong ${windowTotal}`
                : "Nhiệm vụ cần ưu tiên hoàn tất theo tiến độ"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={viewAllHref}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            data-slot="upcoming-view-all"
            title="Xem tất cả nhiệm vụ hạn chót"
          >
            <span>Xem tất cả</span>
            <ChevronRight className="size-3" strokeWidth={1.5} />
          </Link>
          <Badge variant="secondary" className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full">
            {windowTotal}
          </Badge>
        </div>
      </div>

      {/* List content */}
      <div className="flex flex-col divide-y divide-border/50 pt-1">
        {displayedItems.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Không có nhiệm vụ nào có hạn chót trong 7 ngày tới
          </div>
        ) : (
          displayedItems.map((item) => {
            const overdue = item.isOverdue || isDateOverdue(item.dueDate);
            const relativeDistance = formatDeadlineDistance(item.dueDate);
            const displayDate = formatDisplayDate(item.dueDate);
            const isRelativeClear = relativeDistance === "Hôm nay" || relativeDistance === "Ngày mai";
            const isSchool = item.level === "Trường";
            const levelBg = isSchool
              ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
              : "bg-violet-500/10 text-violet-600 border-violet-500/20";

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
                  "group flex flex-col justify-center gap-1 py-2 sm:py-2.5 transition-colors first:pt-2 last:pb-1 focus-visible:outline-hidden focus-visible:bg-muted/50 min-h-[44px]",
                  onSelectTask && "cursor-pointer hover:bg-muted/40 -mx-2 px-2 rounded-lg"
                )}
                role={onSelectTask ? "button" : undefined}
                aria-label={onSelectTask ? `Chi tiết hạn chót: ${item.title}` : undefined}
              >
                {/* Top row: Badges & metadata */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Level Badge with soft colored icon background */}
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs px-2 py-0.5 font-semibold h-5 rounded-md border gap-1",
                        levelBg
                      )}
                    >
                      {isSchool ? (
                        <Building2 className="size-3" strokeWidth={1.5} />
                      ) : (
                        <Layers className="size-3" strokeWidth={1.5} />
                      )}
                      {item.level}
                    </Badge>

                    {/* Overdue Alert or Relative Due Date Badge */}
                    {overdue ? (
                      <Badge
                        variant="rose"
                        className="text-xs px-1.5 py-0.5 font-semibold h-5 rounded-md gap-1"
                      >
                        <AlertTriangle className="size-3" strokeWidth={1.5} />
                        {relativeDistance.startsWith("Quá hạn")
                          ? relativeDistance
                          : `Quá hạn · ${relativeDistance}`}
                      </Badge>
                    ) : (
                      <Badge
                        variant={isRelativeClear ? "amber" : "outline"}
                        className="text-xs px-1.5 py-0.5 font-medium h-5 rounded-md gap-1"
                      >
                        <Clock className="size-3 opacity-75" strokeWidth={1.5} />
                        {relativeDistance}
                      </Badge>
                    )}
                  </div>

                  {/* Absolute date moved to title tooltip; shown only in badge title attr */}
                  {!isRelativeClear && (
                    <span className="sr-only">{displayDate}</span>
                  )}
                </div>

                {/* Title and Assignee compact row */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <h4
                    className="text-xs font-semibold text-foreground leading-snug line-clamp-1 group-hover:text-primary transition-colors flex-1"
                    title={`${item.title} (Hạn: ${displayDate})`}
                  >
                    {item.title}
                  </h4>

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                    {item.assigneeAvatar ? (
                      <img
                        src={item.assigneeAvatar}
                        alt=""
                        aria-hidden="true"
                        width={16}
                        height={16}
                        loading="lazy"
                        className="size-4 rounded-full object-cover shrink-0 ring-1 ring-border/50"
                      />
                    ) : (
                      <div
                        aria-hidden="true"
                        className="flex size-4 shrink-0 items-center justify-center rounded-full bg-secondary font-sans text-xs font-semibold text-secondary-foreground ring-1 ring-border/50"
                      >
                        {getInitials(item.assigneeName)}
                      </div>
                    )}
                    <span className="truncate max-w-[140px] text-foreground/80 font-medium">
                      {item.assigneeName}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Expand / Collapse Footer */}
      {windowTotal > initialLimit && (
        <div className="pt-2 mt-1 border-t border-border/40 flex items-center justify-center">
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <>
                <span>Thu gọn (hiển thị {initialLimit} mục)</span>
                <ChevronUp className="size-3.5" strokeWidth={1.5} />
              </>
            ) : (
              <>
                <span>Xem tất cả {windowTotal} nhiệm vụ hạn chót</span>
                <ChevronDown className="size-3.5" strokeWidth={1.5} />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
