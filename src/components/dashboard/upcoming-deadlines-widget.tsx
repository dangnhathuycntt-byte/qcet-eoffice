"use client";

import * as React from "react";
import Link from "next/link";
import { Calendar, Clock, AlertTriangle, Building2, Layers, CheckCircle, ChevronDown, ChevronUp, ChevronRight, UserMinus } from "lucide-react";
import type { UpcomingItem } from "@/types/dashboard";
export type { UpcomingItem };
import { Badge } from "@/components/ui/badge";
import { cn, getInitials } from "@/lib/utils";
export { getInitials };
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
        "flex flex-col overflow-hidden rounded-2xl bg-card p-4 sm:p-5 text-card-foreground shadow-card border border-border/40",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 shrink-0">
            <Calendar className="size-3.5 text-primary" strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="font-heading text-sm font-bold text-foreground tracking-tight">
              Sắp đến hạn
            </h3>
            <p className="text-xs text-muted-foreground">
              {windowTotal > initialLimit && !isExpanded
                ? `Hiển thị ${displayedItems.length} nhiệm vụ sát hạn nhất`
                : "7 ngày tới · Ưu tiên xử lý"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={viewAllHref}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            data-slot="upcoming-view-all"
            title={`Xem tất cả ${windowTotal} nhiệm vụ hạn chót`}
          >
            <span className="hidden sm:inline">Xem tất cả {windowTotal} nhiệm vụ hạn chót</span>
            <span className="sm:hidden">Xem tất cả ({windowTotal})</span>
            <ChevronRight className="size-3" strokeWidth={1.5} />
          </Link>
        </div>
      </div>

      {/* List content */}
      <div className="flex flex-col divide-y divide-border/40 pt-1">
        {displayedItems.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <div className="flex size-8 items-center justify-center rounded-full bg-muted/60">
              <Calendar className="size-4 text-muted-foreground/60" strokeWidth={1.5} />
            </div>
            <p className="text-xs text-muted-foreground">Không có nhiệm vụ nào có hạn chót trong 7 ngày tới</p>
          </div>
        ) : (
          displayedItems.map((item) => {
            const overdue = item.isOverdue || isDateOverdue(item.dueDate);
            const relativeDistance = formatDeadlineDistance(item.dueDate);
            const displayDate = formatDisplayDate(item.dueDate);
            const isSchool = item.level === "Trường";

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
                  "group flex items-center justify-between gap-3 py-2.5 px-2 rounded-xl transition-colors min-h-[40px]",
                  onSelectTask
                    ? "cursor-pointer hover:bg-muted/40 active:bg-muted/60"
                    : "bg-muted/10"
                )}
                role={onSelectTask ? "button" : undefined}
                aria-label={onSelectTask ? `Chi tiết hạn chót: ${item.title}` : undefined}
              >
                {/* Left side: Title & metadata */}
                <div className="min-w-0 flex-1 space-y-0.5">
                  <h4
                    className="text-xs sm:text-sm font-medium text-foreground leading-snug line-clamp-1 group-hover:text-primary transition-colors"
                    title={`${item.title} (Hạn: ${displayDate})`}
                  >
                    {item.title}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    <span className={cn(
                      "font-semibold text-2xs px-1.5 py-0.2 rounded",
                      isSchool ? "bg-blue-500/10 text-blue-600" : "bg-violet-500/10 text-violet-600"
                    )}>
                      {item.level}
                    </span>
                    <span aria-hidden="true" className="text-border">·</span>
                    {overdue ? (
                      <span className="text-rose-600 font-semibold inline-flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-rose-500 shrink-0" />
                        {relativeDistance.startsWith("Quá hạn") ? relativeDistance : `Quá hạn · ${relativeDistance}`}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Clock className="size-2.5 opacity-70" strokeWidth={1.5} />
                        {relativeDistance}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right side: Assignee */}
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
                  ) : item.assigneeName === "Chưa phân công" ? (
                    <div
                      aria-hidden="true"
                      className="flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                      title="Chưa phân công"
                    >
                      <UserMinus className="size-2.5 opacity-70" strokeWidth={1.5} />
                    </div>
                  ) : (
                    <div
                      aria-hidden="true"
                      className="flex size-4 shrink-0 items-center justify-center rounded-full bg-secondary font-sans text-2xs font-semibold text-secondary-foreground ring-1 ring-border/50"
                    >
                      {getInitials(item.assigneeName)}
                    </div>
                  )}
                  <span className={cn(
                    "truncate max-w-[120px] font-medium hidden sm:inline",
                    item.assigneeName === "Chưa phân công" ? "text-muted-foreground/70 italic text-2xs" : "text-foreground/80"
                  )}>
                    {item.assigneeName}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Expand / Collapse & Calendar Link Footer */}
      <div className="pt-2 mt-1 border-t border-border/40 flex items-center justify-between text-xs">
        <Link
          href="/calendar"
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline transition-colors"
          data-slot="upcoming-calendar-cta"
        >
          <span>Mở lịch công tác</span>
          <ChevronRight className="size-3.5" strokeWidth={1.5} />
        </Link>
        {windowTotal > initialLimit && (
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <>
                <span>Thu gọn</span>
                <ChevronUp className="size-3.5" strokeWidth={1.5} />
              </>
            ) : (
              <>
                <span>Xem tất cả {windowTotal} nhiệm vụ hạn chót</span>
                <ChevronDown className="size-3.5" strokeWidth={1.5} />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
