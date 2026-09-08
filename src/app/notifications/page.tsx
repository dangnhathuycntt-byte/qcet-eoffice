"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock,
  Activity,
  FileText,
  AlertTriangle,
  Plus,
  BarChart2,
  Wifi,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { QCET_PERSONNEL, Personnel } from "@/lib/mock-dashboard-data";
import {
  QCETNotification,
  INITIAL_NOTIFICATIONS,
} from "@/components/notifications/notification-popover";

function getActorPersonnel(name: string): Personnel | undefined {
  return QCET_PERSONNEL.find((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase());
}

function getActorInitials(name: string): string {
  if (!name || !name.trim()) return "QC";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getPersonnelAvatarStyle(name: string): { bg: string; text: string; ring: string } {
  if (name.includes("Hùng")) {
    return {
      bg: "bg-emerald-500/15",
      text: "text-emerald-700",
      ring: "ring-emerald-500/30",
    };
  }
  if (name.includes("Vinh")) {
    return {
      bg: "bg-blue-500/15",
      text: "text-blue-700",
      ring: "ring-blue-500/30",
    };
  }
  if (name.includes("Xuân")) {
    return {
      bg: "bg-purple-500/15",
      text: "text-purple-700",
      ring: "ring-purple-500/30",
    };
  }
  if (name.includes("Nam")) {
    return {
      bg: "bg-amber-500/15",
      text: "text-amber-800",
      ring: "ring-amber-500/30",
    };
  }
  if (name.includes("Thu")) {
    return {
      bg: "bg-teal-500/15",
      text: "text-teal-700",
      ring: "ring-teal-500/30",
    };
  }
  if (name.includes("Trí")) {
    return {
      bg: "bg-rose-500/15",
      text: "text-rose-700",
      ring: "ring-rose-500/30",
    };
  }
  if (name.includes("Hậu")) {
    return {
      bg: "bg-indigo-500/15",
      text: "text-indigo-700",
      ring: "ring-indigo-500/30",
    };
  }
  return {
    bg: "bg-primary/10",
    text: "text-primary",
    ring: "ring-primary/20",
  };
}

function getTypeBadge(type: QCETNotification["type"]) {
  switch (type) {
    case "completed":
      return {
        bg: "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30",
        icon: CheckCircle2,
      };
    case "progress":
      return {
        bg: "bg-blue-500/15 text-blue-600 border border-blue-500/30",
        icon: Activity,
      };
    case "upload":
      return {
        bg: "bg-purple-500/15 text-purple-600 border border-purple-500/30",
        icon: FileText,
      };
    case "network":
      return {
        bg: "bg-cyan-500/15 text-cyan-600 border border-cyan-500/30",
        icon: Wifi,
      };
    case "review":
      return {
        bg: "bg-amber-500/15 text-amber-700 border border-amber-500/30",
        icon: AlertTriangle,
      };
    case "created":
      return {
        bg: "bg-indigo-500/15 text-indigo-600 border border-indigo-500/30",
        icon: Plus,
      };
    case "report":
      return {
        bg: "bg-sky-500/15 text-sky-600 border border-sky-500/30",
        icon: BarChart2,
      };
    default:
      return {
        bg: "bg-primary/15 text-primary border border-primary/30",
        icon: Bell,
      };
  }
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = React.useState<QCETNotification[]>(INITIAL_NOTIFICATIONS);
  const [filter, setFilter] = React.useState<"all" | "unread">("all");

  const unreadCount = React.useMemo(() => {
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isRead: true } : item))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
  };

  const filteredNotifications = React.useMemo(() => {
    if (filter === "unread") {
      return notifications.filter((n) => !n.isRead);
    }
    return notifications;
  }, [notifications, filter]);

  const newItems = React.useMemo(() => {
    return filteredNotifications.filter((n) => n.timeGroup === "new");
  }, [filteredNotifications]);

  const earlierItems = React.useMemo(() => {
    return filteredNotifications.filter((n) => n.timeGroup === "earlier");
  }, [filteredNotifications]);

  return (
    <div className="max-w-2xl mx-auto py-4 px-2 sm:px-0 space-y-4">
      {/* Top back action */}
      <div className="flex items-center justify-between">
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft size={14} strokeWidth={1.5} />
            <span>Quay lại Bảng điều hành</span>
          </Button>
        </Link>
      </div>

      {/* Card Container */}
      <div className="rounded-2xl border border-border/80 bg-card shadow-card overflow-hidden select-none">
        {/* Header */}
        <div className="p-4 sm:p-5 pb-3 border-b border-border/50 bg-muted/20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground font-heading">
                Trung tâm thông báo điều hành
              </h1>
              {unreadCount > 0 ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-primary/10 text-primary border border-primary/20 tabular-nums">
                  {unreadCount} mới
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <Check size={13} strokeWidth={1.5} className="text-emerald-500" />
                  <span>Đã cập nhật toàn bộ</span>
                </span>
              )}
            </div>

            {/* Direct Action */}
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer border border-border/50 bg-card shadow-2xs"
                title="Đánh dấu tất cả là đã đọc"
              >
                <CheckCheck size={14} strokeWidth={1.5} className="text-primary" />
                <span>Đã đọc tất cả</span>
              </button>
            )}
          </div>

          {/* Theme-Synchronized Segmented Filter Control */}
          <div className="flex items-center justify-between gap-2 mt-4 pt-2 border-t border-border/40">
            <div className="inline-flex items-center p-0.5 rounded-xl bg-muted/70 border border-border/50 text-xs">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                  filter === "all"
                    ? "bg-card text-foreground shadow-xs border border-border/60"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/40"
                )}
              >
                Tất cả ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter("unread")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                  filter === "unread"
                    ? "bg-card text-foreground shadow-xs border border-border/60"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/40"
                )}
              >
                <span>Chưa đọc</span>
                {unreadCount > 0 ? (
                  <span className="px-1.5 py-0.2 rounded font-mono text-xs font-bold bg-destructive/15 text-destructive border border-destructive/20 tabular-nums">
                    {unreadCount}
                  </span>
                ) : (
                  <span className="px-1.5 py-0.2 rounded font-mono text-xs font-medium text-muted-foreground bg-muted tabular-nums">
                    0
                  </span>
                )}
              </button>
            </div>

            <span className="text-xs font-mono tabular-nums text-muted-foreground">
              {filteredNotifications.length} mục hiển thị
            </span>
          </div>
        </div>

        {/* List Content */}
        <div className="p-2 divide-y divide-border/30">
          {filteredNotifications.length === 0 ? (
            <div className="py-16 text-center">
              <div className="size-12 rounded-full bg-secondary/80 text-muted-foreground flex items-center justify-center mx-auto mb-3">
                <Check size={20} strokeWidth={1.5} />
              </div>
              <p className="text-sm font-semibold text-foreground">Không có thông báo chưa đọc nào</p>
              <p className="text-xs text-muted-foreground mt-1">
                Bạn đã xử lý và cập nhật toàn bộ hoạt động điều hành
              </p>
            </div>
          ) : (
            <>
              {/* Section: Mới */}
              {newItems.length > 0 && (
                <div className="pb-2">
                  <div className="flex items-center justify-between px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground/80 bg-muted/20 rounded-lg mb-1">
                    <span>Mới cập nhật</span>
                  </div>
                  <div className="space-y-1">
                    {newItems.map((item) => (
                      <PageNotificationRow
                        key={item.id}
                        item={item}
                        onRead={() => markAsRead(item.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Section: Trước đó */}
              {earlierItems.length > 0 && (
                <div className="pt-2 pb-1">
                  <div className="flex items-center justify-between px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground/80 bg-muted/20 rounded-lg mb-1">
                    <span>Trước đó</span>
                  </div>
                  <div className="space-y-1">
                    {earlierItems.map((item) => (
                      <PageNotificationRow
                        key={item.id}
                        item={item}
                        onRead={() => markAsRead(item.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PageNotificationRow({
  item,
  onRead,
}: {
  item: QCETNotification;
  onRead: () => void;
}) {
  const personnel = getActorPersonnel(item.actorName);
  const badge = getTypeBadge(item.type);
  const BadgeIcon = badge.icon;
  const avatarStyle = getPersonnelAvatarStyle(item.actorName);

  return (
    <Link
      href={item.linkHref}
      onClick={onRead}
      className={cn(
        "group relative flex items-start gap-3.5 p-3 rounded-xl transition-all cursor-pointer border border-transparent",
        item.isRead
          ? "hover:bg-muted/50 opacity-85 hover:opacity-100"
          : "bg-primary/[0.04] hover:bg-muted/70 font-medium border-l-primary"
      )}
    >
      {/* Avatar with Micro Badge */}
      <div className="relative shrink-0 mt-0.5">
        <div
          className={cn(
            "size-11 rounded-full flex items-center justify-center font-bold font-mono text-xs select-none shadow-2xs ring-1",
            avatarStyle.bg,
            avatarStyle.text,
            avatarStyle.ring
          )}
          title={`${item.actorName} (${personnel?.dept || "QCET"})`}
        >
          {getActorInitials(item.actorName)}
        </div>

        {/* Micro overlay icon badge */}
        <div
          className={cn(
            "absolute -bottom-1 -right-1 size-5 rounded-full ring-2 ring-card flex items-center justify-center shadow-2xs",
            badge.bg
          )}
        >
          <BadgeIcon size={11} strokeWidth={1.5} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-1">
        <p className="text-xs sm:text-sm text-foreground leading-snug line-clamp-2">
          <span className="font-bold text-foreground">{item.actorName}</span>{" "}
          <span className="text-muted-foreground">{item.action}</span>{" "}
          <span className="font-semibold text-foreground">&ldquo;{item.targetTitle}&rdquo;</span>
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="px-1.5 py-0.2 rounded text-xs font-mono font-semibold bg-muted text-muted-foreground border border-border/50">
            {item.category}
          </span>
          <span className="text-xs text-muted-foreground font-mono tabular-nums flex items-center gap-1">
            <Clock size={11} strokeWidth={1.5} className="text-muted-foreground/80 shrink-0" />
            <span>{item.timestamp}</span>
          </span>
        </div>
      </div>

      {/* Unread dot or Quick Mark Read Button */}
      {!item.isRead ? (
        <div className="self-center shrink-0 flex items-center gap-1.5 pr-2">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRead();
            }}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-card hover:shadow-xs text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            title="Đánh dấu đã đọc"
            aria-label="Đánh dấu đã đọc"
          >
            <Check size={13} strokeWidth={1.5} />
          </button>
          <span
            className="block size-2.5 rounded-full bg-primary ring-2 ring-primary/20"
            title="Chưa đọc"
          />
        </div>
      ) : null}
    </Link>
  );
}
