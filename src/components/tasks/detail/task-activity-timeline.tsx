"use client";

import * as React from "react";
import {
  Activity,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDetailDate } from "@/lib/task-detail-helpers";

export interface ActivityEvent {
  id: string;
  action: string;
  timestamp: string;
  actorName?: string;
  description?: string;
}

export interface TaskActivityTimelineProps {
  events: ActivityEvent[];
  className?: string;
}

/**
 * Format exact ICT datetime DD/MM/YYYY HH:mm
 */
function formatICTDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;

    // Convert to ICT (UTC+7)
    return d.toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return dateStr;
  }
}

/**
 * Get relative time in Vietnamese (Vừa xong, X phút trước, X giờ trước, X ngày trước)
 */
function getRelativeTimeVN(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return "Vừa xong";
    if (diffMin < 60) return `${diffMin} phút trước`;
    if (diffHour < 24) return `${diffHour} giờ trước`;
    if (diffDay < 30) return `${diffDay} ngày trước`;
    return formatDetailDate(dateStr);
  } catch {
    return dateStr;
  }
}

export function TaskActivityTimeline({
  events = [],
  className,
}: TaskActivityTimelineProps) {
  if (events.length === 0) {
    return (
      <div className={cn("p-4 rounded-xl border border-dashed border-border/80 bg-muted/20 text-center space-y-1.5", className)}>
        <p className="text-xs text-muted-foreground">Chưa có nhật ký hoạt động nào được ghi nhận.</p>
      </div>
    );
  }

  return (
    <section data-slot="task-activity-timeline" className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <Activity className="size-4 text-primary shrink-0" strokeWidth={1.5} />
        <h2 className="text-xs font-semibold text-foreground">
          Lịch sử điều hành & Hoạt động ({events.length})
        </h2>
      </div>

      <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-border/80">
        {events.map((ev, index) => {
          const isLatest = index === 0;

          return (
            <div key={ev.id || index} className="relative group/event">
              {/* Event bullet point */}
              <div
                className={cn(
                  "absolute -left-6 top-1.5 size-2 rounded-full ring-4 ring-background transition-transform group-hover/event:scale-125",
                  isLatest ? "bg-primary" : "bg-muted-foreground/40"
                )}
                aria-hidden="true"
              />

              <div className="rounded-xl border border-border/60 bg-card p-3 space-y-1.5 shadow-2xs hover:border-border transition-colors">
                <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <div className="size-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold">
                      {(ev.actorName || "U").charAt(0).toUpperCase()}
                    </div>
                    <span>{ev.actorName || "Người điều hành"}</span>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground" title={formatICTDateTime(ev.timestamp)}>
                    <Clock className="size-3" strokeWidth={1.5} />
                    <span>{getRelativeTimeVN(ev.timestamp)}</span>
                  </div>
                </div>

                {ev.description ? (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {ev.description}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground font-mono">
                    {ev.action}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
