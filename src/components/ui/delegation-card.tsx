"use client";

import * as React from "react";
import { ArrowRight, Calendar, FileText, ShieldAlert, CheckCircle, Clock } from "lucide-react";
import { UserAvatar } from "./user-avatar";
import { cn } from "@/lib/utils";

export type DelegationStatusType = "active" | "scheduled" | "expired" | "revoked";

export interface DelegationCardProps extends React.HTMLAttributes<HTMLDivElement> {
  grantor: { name: string; title: string; avatarUrl?: string };
  delegate: { name: string; title: string; avatarUrl?: string };
  decisionNumber: string;
  scope: string[];
  startDate: string | Date;
  endDate: string | Date;
  status?: DelegationStatusType;
  onRevoke?: () => void;
}

/**
 * Thẻ ủy quyền thẩm quyền giải quyết nhiệm vụ / văn bản trong trường học.
 */
export function DelegationCard({
  grantor,
  delegate,
  decisionNumber,
  scope,
  startDate,
  endDate,
  status = "active",
  onRevoke,
  className,
  ...props
}: DelegationCardProps) {
  const formatDate = (val: string | Date) => {
    if (typeof val === "string") return val;
    return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" }).format(val);
  };

  const statusConfigs: Record<
    DelegationStatusType,
    { label: string; bg: string; text: string; icon: React.ReactNode }
  > = {
    active: {
      label: "Đang hiệu lực",
      bg: "bg-secondary",
      text: "text-foreground font-semibold",
      icon: <CheckCircle className="size-3.5 text-foreground" />,
    },
    scheduled: {
      label: "Chưa đến hạn",
      bg: "bg-secondary",
      text: "text-muted-foreground",
      icon: <Clock className="size-3.5 text-muted-foreground" />,
    },
    expired: {
      label: "Hết hiệu lực",
      bg: "bg-secondary",
      text: "text-muted-foreground",
      icon: <Clock className="size-3.5 text-muted-foreground" />,
    },
    revoked: {
      label: "Đã thu hồi",
      bg: "bg-danger-soft",
      text: "text-destructive font-semibold",
      icon: <ShieldAlert className="size-3.5 text-destructive" />,
    },
  };

  const currentStatus = statusConfigs[status];

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-2xl border-0 bg-card p-4 shadow-none",
        className
      )}
      {...props}
    >
      {/* Header: Số quyết định & Trạng thái */}
      <div className="flex items-center justify-between gap-2 pb-1">
        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <FileText className="size-4 text-muted-foreground" />
          <span>QĐ số: <strong className="font-semibold">{decisionNumber}</strong></span>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-lg border-0 px-2 py-0.5 text-xs font-medium",
            currentStatus.bg,
            currentStatus.text
          )}
        >
          {currentStatus.icon}
          {currentStatus.label}
        </span>
      </div>

      {/* Sơ đồ ủy quyền: Người ủy quyền -> Người được ủy quyền */}
      <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-3">
        {/* Người ủy quyền */}
        <div className="flex items-center gap-2.5">
          <UserAvatar name={grantor.name} avatarUrl={grantor.avatarUrl} size="sm" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{grantor.name}</p>
            <p className="text-xs text-muted-foreground truncate">{grantor.title}</p>
          </div>
        </div>

        {/* Mũi tên chuyển giao */}
        <div className="flex flex-col items-center px-1 text-muted-foreground">
          <span className="text-xs font-medium mb-0.5">Ủy quyền</span>
          <ArrowRight className="size-4 text-primary" />
        </div>

        {/* Người được ủy quyền */}
        <div className="flex items-center gap-2.5">
          <UserAvatar name={delegate.name} avatarUrl={delegate.avatarUrl} size="sm" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{delegate.name}</p>
            <p className="text-xs text-muted-foreground truncate">{delegate.title}</p>
          </div>
        </div>
      </div>

      {/* Phạm vi ủy quyền */}
      <div className="rounded-xl bg-secondary p-3 text-xs">
        <span className="font-medium text-muted-foreground">Phạm vi: </span>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {scope.map((item, idx) => (
            <span
              key={idx}
              className="inline-flex rounded-lg bg-card px-2 py-0.5 text-xs font-medium text-foreground border-0"
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* Footer: Thời hạn & Hành động */}
      <div className="flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 text-xs">
          <Calendar className="size-3.5" />
          <span>
            {formatDate(startDate)} – {formatDate(endDate)}
          </span>
        </div>

        {onRevoke && status === "active" ? (
          <button
            type="button"
            onClick={onRevoke}
            aria-label="Thu hồi quyền ủy quyền"
            className="rounded-lg px-2 py-1 text-xs font-medium text-destructive hover:bg-danger-soft transition-colors cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-destructive focus-visible:outline-offset-1 relative before:absolute before:-inset-2 before:content-[''] touch-manipulation"
          >
            Thu hồi quyền
          </button>
        ) : null}
      </div>
    </div>
  );
}
