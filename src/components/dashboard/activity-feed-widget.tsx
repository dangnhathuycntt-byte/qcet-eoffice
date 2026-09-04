"use client";

import * as React from "react";
import { Zap, Activity, CheckCircle2, Upload, RefreshCw, PlusCircle, AlertCircle, Clock } from "lucide-react";
import type { ActivityEvent } from "@/types/dashboard";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface ActivityFeedWidgetProps {
  activities?: ActivityEvent[];
  className?: string;
}

export interface ActivityActionConfig {
  type: "completed" | "assigned" | "upload" | "updated" | "created" | "review" | "default";
  badgeVariant: "default" | "secondary" | "destructive" | "outline" | "ghost" | "success" | "progress" | "warning";
  iconName: "CheckCircle2" | "Zap" | "Upload" | "RefreshCw" | "PlusCircle" | "AlertCircle" | "Activity";
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
      iconName: "Zap",
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
  Zap,
  Upload,
  RefreshCw,
  PlusCircle,
  AlertCircle,
  Activity,
};

export function ActivityFeedWidget({
  activities = [],
  className,
}: ActivityFeedWidgetProps) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border border-border/50 bg-card p-4 sm:p-5 text-card-foreground shadow-card hover:shadow-card-hover transition-all duration-300",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Zap className="size-4 fill-amber-500/20" />
          </div>
          <div>
            <h3 className="font-sans text-sm font-bold text-foreground tracking-tight">
              Hoạt động vừa cập nhật
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Dòng nhật ký tương tác và tiến độ thời gian thực
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
          </span>
          <span>Live</span>
        </div>
      </div>

      {/* Activity Timeline List */}
      <div className="flex flex-col divide-y divide-border/50 pt-1">
        {activities.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Chưa có hoạt động mới nào được ghi nhận
          </div>
        ) : (
          activities.map((item) => {
            const config = getActivityActionConfig(item.action);
            const ActionIcon = actionIcons[config.iconName] || Activity;
            const initials = getActorInitials(item.actorName);

            return (
              <div
                key={item.id}
                className="group flex items-start gap-3 py-3 transition-colors first:pt-2.5 last:pb-1"
              >
                {/* Actor Avatar / Initials with action micro-badge */}
                <div className="relative shrink-0 mt-0.5">
                  <div className="flex size-8 items-center justify-center rounded-full bg-secondary font-sans text-xs font-bold text-secondary-foreground ring-1 ring-border/50">
                    {initials}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-card ring-1 ring-border/60 shadow-xs">
                    <ActionIcon className="size-2.5 text-foreground/80" />
                  </div>
                </div>

                {/* Event details */}
                <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs leading-snug">
                      <span className="font-semibold text-foreground">{item.actorName}</span>{" "}
                      <span className="text-muted-foreground font-normal">{item.action}</span>
                    </div>
                    {item.category && (
                      <span className="shrink-0 inline-flex items-center rounded-md bg-secondary/80 px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
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
                  <div className="flex items-center gap-1 pt-0.5 text-[10px] text-muted-foreground font-mono">
                    <Clock className="size-2.5 opacity-70" />
                    <span>{item.timestamp}</span>
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
