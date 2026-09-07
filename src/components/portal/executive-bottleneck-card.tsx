"use client";

import * as React from "react";
import { User, Calendar, Bell, Sparkles, AlertCircle } from "lucide-react";
import type { SchoolBottleneckItem } from "@/types/workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ExecutiveBottleneckCardProps {
  item: SchoolBottleneckItem;
  onResolve: (item: SchoolBottleneckItem) => void;
  onRemind: (departmentCode: string, taskTitle: string) => void;
}

/**
 * Format ISO or YYYY-MM-DD string to DD/MM/YYYY.
 */
function formatDueDate(dateStr?: string): string {
  if (!dateStr) return "Chưa đặt";
  try {
    const clean = dateStr.split("T")[0];
    const parts = clean.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

/**
 * ExecutiveBottleneckCard - Optimized ~90px card for executive overview.
 *
 * Invariants:
 * - Height: ~90px - 96px (`min-h-[90px]`)
 * - Absolutely NO technical IDs (`staff-task-xxx`) on card face.
 * - Line 1: Status dot with QUÁ HẠN {N} NGÀY (or ĐANG BỊ TẮC NGHẼN) on left; Department on right.
 * - Line 2: Task title (`text-sm font-semibold text-foreground line-clamp-2`).
 * - Line 3: Left: `{assigneeName} · Hạn {dueDate}`. Right: `[Đôn đốc]` + `[Tháo gỡ]`.
 */
export function ExecutiveBottleneckCard({
  item,
  onResolve,
  onRemind,
}: ExecutiveBottleneckCardProps): React.JSX.Element {
  // Determine badge status
  const badgeLabel = React.useMemo(() => {
    if (typeof item.daysOverdue === "number" && item.daysOverdue > 0) {
      return `QUÁ HẠN ${item.daysOverdue} NGÀY`;
    }
    if (item.isBlocked) {
      return "ĐANG BỊ TẮC NGHẼN";
    }
    if (item.isOverdue) {
      return "ĐÃ QUÁ HẠN";
    }
    return "ĐIỂM NGHẼN CẤP THIẾT";
  }, [item.daysOverdue, item.isBlocked, item.isOverdue]);

  const formattedDueDate = React.useMemo(
    () => formatDueDate(item.dueDate),
    [item.dueDate]
  );

  const deptDisplay = item.departmentCode || item.departmentName || "QCET";

  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between gap-2.5 rounded-xl",
        "border border-rose-500/30 bg-card p-3.5 min-h-[90px]",
        "transition-all duration-200 shadow-2xs hover:border-rose-500/50 hover:shadow-sm"
      )}
      data-testid="executive-bottleneck-card"
    >
      {/* Line 1: Status badge & Department */}
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:text-rose-400 border border-rose-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
          <span className="tabular-nums uppercase tracking-wide">{badgeLabel}</span>
        </span>

        <Badge
          variant="outline"
          className="text-xs font-medium text-muted-foreground border-border/70 bg-muted/40 px-2 py-0.5 shrink-0"
        >
          {deptDisplay}
        </Badge>
      </div>

      {/* Line 2: Task Title (NO technical IDs) */}
      <div className="min-w-0">
        <h4
          className="text-sm font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors"
          title={item.title}
        >
          {item.title}
        </h4>
        {item.blockedReason && (
          <p className="mt-1 text-xs text-rose-600/90 dark:text-rose-400/90 line-clamp-1 italic flex items-center gap-1">
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span>Vướng mắc: {item.blockedReason}</span>
          </p>
        )}
      </div>

      {/* Line 3: Assignee + Due Date on left; [Đôn đốc] + [Tháo gỡ] on right */}
      <div className="flex items-center justify-between gap-3 pt-0.5 border-t border-border/40">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0 truncate">
          <User className="w-3.5 h-3.5 shrink-0 text-muted-foreground/70" />
          <span className="truncate font-medium text-foreground/80">
            {item.assigneeName || "Chưa phân công"}
          </span>
          <span className="text-muted-foreground/40 shrink-0">·</span>
          <span className="shrink-0 flex items-center gap-1">
            <Calendar className="w-3 h-3 text-muted-foreground/60" />
            <span>Hạn {formattedDueDate}</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onRemind(item.departmentCode, item.title);
            }}
            className="h-7.5 px-2.5 text-xs font-medium hover:bg-muted border-border/70"
            title="Gửi thông báo đôn đốc tức thì tới đơn vị"
          >
            <Bell className="w-3 h-3 mr-1 text-muted-foreground" />
            Đôn đốc
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onResolve(item);
            }}
            className="h-7.5 px-3 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
            title="Mở bảng điều hành tháo gỡ điểm nghẽn"
          >
            <Sparkles className="w-3 h-3 mr-1" />
            Tháo gỡ
          </Button>
        </div>
      </div>
    </div>
  );
}
