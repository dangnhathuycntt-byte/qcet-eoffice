"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle, XCircle, MessageSquare, Clock, ArrowRight } from "lucide-react";
import { UserAvatar } from "./user-avatar";
import { cn } from "@/lib/utils";

export type TimelineItemType =
  | "comment"
  | "approval"
  | "change_request"
  | "rejection"
  | "status_change"
  | "delegation"
  | "create"
  | "generic";

export interface TimelineItem {
  id: string;
  type?: TimelineItemType;
  actor: {
    name: string;
    avatarUrl?: string;
    roleTitle?: string;
  };
  action: string;
  timestamp: string;
  content?: React.ReactNode;
  decisionNote?: string;
  unread?: boolean;
}

export interface TimelineProps extends React.HTMLAttributes<HTMLDivElement> {
  items: TimelineItem[];
  emptyText?: string;
}

/**
 * Cột mốc lịch sử hoạt động và phê duyệt nhiệm vụ / văn bản.
 * Chuẩn QCET: Artboard Components3 & T3Activity (Cột mốc dọc, avatar người làm việc, thời gian tương đối).
 */
export function Timeline({
  items,
  emptyText = "Chưa có hoạt động nào",
  className,
  ...props
}: TimelineProps) {
  if (!items || items.length === 0) {
    return <div className="py-6 text-center text-xs text-muted-foreground">{emptyText}</div>;
  }

  const getTypeIcon = (type?: TimelineItemType) => {
    switch (type) {
      case "approval":
        return <CheckCircle2 className="size-3.5 text-foreground" />;
      case "change_request":
        return <AlertCircle className="size-3.5 text-foreground" />;
      case "rejection":
        return <XCircle className="size-3.5 text-destructive" />;
      case "comment":
        return <MessageSquare className="size-3.5 text-muted-foreground" />;
      case "status_change":
        return <ArrowRight className="size-3.5 text-primary" />;
      default:
        return <Clock className="size-3.5 text-muted-foreground" />;
    }
  };

  return (
    <div className={cn("relative flex flex-col gap-4 select-none", className)} {...props}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <div key={item.id} className="relative flex items-start gap-3 text-xs sm:text-sm">
            {/* Vertical connector line */}
            {!isLast && (
              <span
                className="absolute left-[11px] top-6 bottom-0 w-px bg-mark"
                aria-hidden="true"
              />
            )}

            {/* Avatar */}
            <div className="relative z-10 shrink-0">
              <UserAvatar
                name={item.actor.name}
                avatarUrl={item.actor.avatarUrl}
                size="sm"
                className="size-6"
              />
            </div>

            {/* Content area */}
            <div className="flex-1 min-w-0 pt-0.5 flex flex-col gap-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-semibold text-foreground truncate">{item.actor.name}</span>
                  <span className="text-muted-foreground truncate">{item.action}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {item.timestamp}
                  </span>
                  {item.unread && (
                    <span className="size-2 rounded-full bg-foreground shrink-0" title="Chưa đọc" />
                  )}
                </div>
              </div>

              {/* Note / Feedback */}
              {item.decisionNote && (
                <div className="mt-1 rounded-xl bg-secondary p-3 text-xs text-foreground leading-relaxed border-0">
                  <div className="flex items-center gap-1.5 font-medium text-foreground mb-1">
                    {getTypeIcon(item.type)}
                    <span>Ý kiến xử lý</span>
                  </div>
                  <p className="whitespace-pre-wrap">{item.decisionNote}</p>
                </div>
              )}

              {/* Custom content */}
              {item.content && (
                <div className="mt-1 text-xs text-muted-foreground">{item.content}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
