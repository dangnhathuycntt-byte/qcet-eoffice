"use client";

import * as React from "react";
import Link from "next/link";
import { History, Activity, CheckCircle2, Upload, RefreshCw, PlusCircle, AlertCircle, Clock, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import type { ActivityEvent } from "@/types/dashboard";
export type { ActivityEvent };
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format/date";

export interface ActivityFeedWidgetProps {
  activities?: ActivityEvent[];
  className?: string;
  initialLimit?: number;
  /**
   * Optional audit-log destination. There is NO audit route under `src/app`, and
   * `view=audit` is not a valid view mode, so this is intentionally unset by
   * default — the link is hidden rather than navigating to a dead query (plan T07.7).
   */
  auditLogHref?: string;
}

export interface ActivityActionConfig {
  type: "completed" | "assigned" | "upload" | "updated" | "created" | "review" | "default";
  badgeVariant: "default" | "secondary" | "destructive" | "outline" | "ghost" | "success" | "progress" | "warning";
  iconName: "CheckCircle2" | "History" | "Upload" | "RefreshCw" | "PlusCircle" | "AlertCircle" | "Activity";
}

export function getActorInitials(name: string): string {
  if (!name || !name.trim()) return "QC";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0].charAt(0);
  const last = parts[parts.length - 1].charAt(0);
  return (first + last).toUpperCase();
}

export function getActivityActionConfig(action: string): ActivityActionConfig {
  const act = (action || "").toLowerCase();

  if (act.includes("hoàn thành") || act.includes("xong")) {
    return {
      type: "completed",
      badgeVariant: "success",
      iconName: "CheckCircle2",
    };
  }
  if (act.includes("phân công") || act.includes("giao việc")) {
    return {
      type: "assigned",
      badgeVariant: "secondary",
      iconName: "History",
    };
  }
  if (act.includes("tải lên") || act.includes("upload") || act.includes("đính kèm")) {
    return {
      type: "upload",
      badgeVariant: "progress",
      iconName: "Upload",
    };
  }
  if (act.includes("tạo mới") || act.includes("thêm mới")) {
    return {
      type: "created",
      badgeVariant: "default",
      iconName: "PlusCircle",
    };
  }
  if (act.includes("cần chỉnh sửa") || act.includes("nhắc nhở") || act.includes("tồn đọng")) {
    return {
      type: "review",
      badgeVariant: "warning",
      iconName: "AlertCircle",
    };
  }
  if (act.includes("cập nhật") || act.includes("chuyển trạng thái") || act.includes("kiểm tra")) {
    return {
      type: "updated",
      badgeVariant: "secondary",
      iconName: "RefreshCw",
    };
  }

  return {
    type: "default",
    badgeVariant: "outline",
    iconName: "Activity",
  };
}

const actionIcons = {
  CheckCircle2,
  History,
  Upload,
  RefreshCw,
  PlusCircle,
  AlertCircle,
  Activity,
};

export function ActivityFeedWidget({
  activities = [],
  className,
  initialLimit = 5,
  auditLogHref,
}: ActivityFeedWidgetProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  // Deduplicate consecutive identical activities (same actor + action + target within close timeframe)
  const uniqueActivities = React.useMemo(() => {
    const list: ActivityEvent[] = [];
    const seen = new Set<string>();

    for (const act of activities) {
      // Key consists of actor, action, target and minute timestamp to prevent spammy identical events
      const timeKey = act.timestamp ? act.timestamp.slice(0, 16) : "";
      const key = `${act.actorName}|${act.action}|${act.targetTitle}|${timeKey}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push(act);
      }
    }
    return list;
  }, [activities]);

  const displayedActivities = initialLimit && !isExpanded ? uniqueActivities.slice(0, initialLimit) : uniqueActivities;

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
          <History className="size-4 text-muted-foreground" strokeWidth={1.5} />
          <div>
            <h3 className="font-sans text-sm font-bold text-foreground tracking-tight">
              Hoạt động vừa cập nhật
            </h3>
            <p className="text-xs text-muted-foreground">
              Ghi nhận theo thời gian thực
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* No audit destination exists; the link is hidden until one is built. */}
          {auditLogHref && (
            <Link
              href={auditLogHref}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              data-slot="activity-audit-link"
              title="Xem nhật ký hệ thống"
            >
              <span className="hidden sm:inline">Nhật ký</span>
              <ExternalLink className="size-3" strokeWidth={1.5} />
            </Link>
          )}
        </div>
      </div>

      {/* Activity Timeline List */}
      <div className="flex flex-col divide-y divide-border/50 pt-1">
        {displayedActivities.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Chưa có hoạt động mới nào được ghi nhận
          </div>
        ) : (
          displayedActivities.map((item) => {
            const config = getActivityActionConfig(item.action);
            const ActionIcon = actionIcons[config.iconName] || Activity;
            const initials = getActorInitials(item.actorName);

            return (
              <div
                key={item.id}
                className="group flex items-start gap-2.5 py-2 sm:py-2.5 transition-colors first:pt-2 last:pb-1 min-h-[44px]"
              >
                {/* Actor Avatar / Initials with action micro-badge */}
                <div className="relative shrink-0 mt-0.5">
                  <div className="flex size-7 sm:size-8 items-center justify-center rounded-full bg-secondary font-sans text-xs font-bold text-secondary-foreground ring-1 ring-border/50">
                    {initials}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-card ring-1 ring-border/60 shadow-xs">
                    <ActionIcon className="size-2.5 text-foreground/80" strokeWidth={1.5} />
                  </div>
                </div>

                {/* Event details */}
                <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs leading-snug">
                      <span className="font-semibold text-foreground">{item.actorName}</span>{" "}
                      <span className="text-muted-foreground font-normal">{item.action}</span>
                    </div>
                    {item.category && item.category !== "KHAC" && (
                      <span className="shrink-0 inline-flex items-center rounded-md bg-secondary/80 px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
                        {item.category}
                      </span>
                    )}
                  </div>

                {/* Target title */}
                <div
                  className="text-xs font-medium text-foreground/90 line-clamp-1 group-hover:text-primary transition-colors"
                  title={item.targetTitle}
                >
                  {item.targetTitle}
                </div>

                {/* Timestamp */}
                <div className="flex items-center gap-1 pt-0.5 text-xs text-muted-foreground font-mono">
                  <Clock className="size-2.5 opacity-70" strokeWidth={1.5} />
                  <span>{formatDateTime(item.timestamp)}</span>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>

      {/* Expand / Collapse Footer */}
      {uniqueActivities.length > initialLimit && (
        <div className="pt-3 mt-1 border-t border-border/40 text-center">
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <>
                <span>Thu gọn</span>
                <ChevronUp className="size-3.5" strokeWidth={1.5} />
              </>
            ) : (
              <>
                <span>Xem thêm {uniqueActivities.length - initialLimit} hoạt động</span>
                <ChevronDown className="size-3.5" strokeWidth={1.5} />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
