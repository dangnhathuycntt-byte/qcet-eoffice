"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bell,
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
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/layout/sidebar-context";

export interface QCETNotification {
  id: string;
  actorName: string;
  action: string;
  targetTitle: string;
  timestamp: string;
  category: string;
  isRead: boolean;
  timeGroup: "new" | "earlier";
  type: "completed" | "progress" | "upload" | "review" | "created" | "report" | "network" | "assigned" | "directive" | "test";
  linkHref: string;
}

export function formatRelativeTime(dateInput: string | Date): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (isNaN(diffSec) || diffSec < 60) return "Vừa xong";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return date.toLocaleDateString("vi-VN");
}

export function getTimeGroup(dateInput: string | Date): "new" | "earlier" {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  return isNaN(diffHours) || diffHours < 2 ? "new" : "earlier";
}

export function mapDbNotification(raw: any): QCETNotification {
  const dateVal = raw.createdAt || new Date();
  return {
    id: raw.id,
    actorName: raw.actorName || "Hệ thống QCET",
    action: raw.body || raw.action || "",
    targetTitle: raw.title || raw.targetTitle || "",
    timestamp: raw.timestamp || formatRelativeTime(dateVal),
    category: (raw.category || "QCET").toUpperCase(),
    isRead: Boolean(raw.isRead),
    timeGroup: raw.timeGroup || getTimeGroup(dateVal),
    type: raw.type || "completed",
    linkHref: raw.linkHref || "/",
  };
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
        icon: Clock,
      };
    case "upload":
      return {
        bg: "bg-purple-500/15 text-purple-600 border border-purple-500/30",
        icon: FileText,
      };
    case "review":
      return {
        bg: "bg-amber-500/15 text-amber-600 border border-amber-500/30",
        icon: AlertTriangle,
      };
    case "created":
      return {
        bg: "bg-teal-500/15 text-teal-600 border border-teal-500/30",
        icon: Plus,
      };
    case "report":
      return {
        bg: "bg-indigo-500/15 text-indigo-600 border border-indigo-500/30",
        icon: Activity,
      };
    case "network":
      return {
        bg: "bg-sky-500/15 text-sky-600 border border-sky-500/30",
        icon: Wifi,
      };
    case "assigned":
    case "directive":
      return {
        bg: "bg-amber-500/15 text-amber-700 border border-amber-500/30",
        icon: FileText,
      };
    case "test":
      return {
        bg: "bg-purple-500/15 text-purple-700 border border-purple-500/30",
        icon: Activity,
      };
    default:
      return {
        bg: "bg-primary/15 text-primary border border-primary/30",
        icon: Bell,
      };
  }
}

interface NotificationPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  containerRef?: React.RefObject<HTMLElement | null>;
}

export function NotificationPopover({ isOpen, onClose, containerRef }: NotificationPopoverProps) {
  const [notifications, setNotifications] = React.useState<QCETNotification[]>([]);
  const [filter, setFilter] = React.useState<"all" | "unread">("all");
  const [, setIsLoading] = React.useState(false);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const { setBadgeCounts } = useSidebar();

  const fetchNotifications = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.notifications)) {
          setNotifications(data.notifications.map(mapDbNotification));
        }
      }
    } catch {
      // Best effort fallback
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  React.useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  const unreadCount = React.useMemo(() => {
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);

  // Sync unread count to sidebar badge
  React.useEffect(() => {
    setBadgeCounts((prev) => ({
      ...prev,
      notifications: unreadCount,
    }));
  }, [unreadCount, setBadgeCounts]);

  // Close on outside click
  React.useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef?.current && containerRef.current.contains(e.target as Node)) {
        return;
      }
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose, containerRef]);

  // Close on Escape key
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const markAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isRead: true } : item))
    );
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    } catch {
      // Best effort
    }
  };

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    try {
      await fetch("/api/notifications", { method: "PATCH" });
    } catch {
      // Best effort
    }
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

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Trung tâm thông báo"
      className="fixed inset-x-2 top-14 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-[420px] max-h-[85vh] sm:max-h-[580px] bg-card rounded-2xl border border-border/80 shadow-2xl z-50 flex flex-col overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150 select-none"
    >
      {/* Header Container */}
      <div className="p-3.5 pb-2.5 border-b border-border/50 bg-muted/20 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-sm font-bold text-foreground tracking-tight font-heading">
              Thông báo điều hành
            </h2>
            {unreadCount > 0 ? (
              <span className="inline-flex items-center px-1.5 py-0.2 rounded font-mono text-xs font-bold bg-primary/10 text-primary border border-primary/20 tabular-nums">
                {unreadCount} mới
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium">
                <Check size={11} strokeWidth={1.5} className="text-emerald-500" />
                <span>Đã cập nhật</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
                title="Đánh dấu tất cả là đã đọc"
              >
                <CheckCheck size={13} strokeWidth={1.5} className="text-primary" />
                <span>Đã đọc</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Segmented Control */}
        <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border/40">
          <div className="inline-flex items-center p-0.5 rounded-lg bg-muted/80 border border-border/40 text-xs">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer",
                filter === "all"
                  ? "bg-card text-foreground shadow-2xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Tất cả ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer",
                filter === "unread"
                  ? "bg-card text-foreground shadow-2xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
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
            {filteredNotifications.length} mục
          </span>
        </div>
      </div>

      {/* Scrollable Notification List */}
      <div className="flex-1 overflow-y-auto overscroll-contain py-1 divide-y divide-border/30 thin-scrollbar">
        {filteredNotifications.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <div className="size-10 rounded-full bg-secondary/80 text-muted-foreground flex items-center justify-center mx-auto mb-2.5">
              <Check size={18} strokeWidth={1.5} />
            </div>
            <p className="text-xs font-semibold text-foreground">
              {filter === "unread"
                ? "Không có thông báo chưa đọc nào"
                : "Hiện tại Đồng chí không có thông báo mới nào"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {filter === "unread"
                ? "Bạn đã xử lý và cập nhật toàn bộ hoạt động điều hành"
                : "Bạn đã nắm bắt hết mọi thông tin điều hành"}
            </p>
          </div>
        ) : (
          <>
            {/* Section: Mới */}
            {newItems.length > 0 && (
              <div className="pb-1">
                <div className="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground/80 bg-muted/20">
                  Mới cập nhật
                </div>
                <div className="space-y-0.5 px-1 pt-1">
                  {newItems.map((item) => (
                    <NotificationRow
                      key={item.id}
                      item={item}
                      onRead={() => markAsRead(item.id)}
                      onClose={onClose}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Section: Trước đó */}
            {earlierItems.length > 0 && (
              <div className="pt-1 pb-1">
                <div className="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground/80 bg-muted/20">
                  Trước đó
                </div>
                <div className="space-y-0.5 px-1 pt-1">
                  {earlierItems.map((item) => (
                    <NotificationRow
                      key={item.id}
                      item={item}
                      onRead={() => markAsRead(item.id)}
                      onClose={onClose}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-border/50 bg-muted/20 text-center shrink-0">
        <Link
          href="/notifications"
          onClick={onClose}
          className="inline-flex items-center justify-center gap-1.5 w-full py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
        >
          <span>Xem tất cả thông báo điều hành</span>
          <ExternalLink size={12} strokeWidth={1.5} />
        </Link>
      </div>
    </div>
  );
}

interface NotificationRowProps {
  item: QCETNotification;
  onRead: () => void;
  onClose: () => void;
}

function NotificationRow({ item, onRead, onClose }: NotificationRowProps) {
  const badge = getTypeBadge(item.type);
  const BadgeIcon = badge.icon;
  const avatarStyle = getPersonnelAvatarStyle(item.actorName);

  const handleClick = () => {
    onRead();
    onClose();
  };

  return (
    <Link
      href={item.linkHref}
      onClick={handleClick}
      className={cn(
        "group relative flex items-start gap-3 p-2.5 rounded-xl transition-all cursor-pointer border border-transparent",
        item.isRead
          ? "hover:bg-muted/50 opacity-85 hover:opacity-100"
          : "bg-primary/[0.04] hover:bg-muted/70 font-medium border-l-primary"
      )}
    >
      {/* Avatar Container with Theme-Harmonized Initials Monogram Badge */}
      <div className="relative shrink-0 mt-0.5">
        <div
          className={cn(
            "size-10 rounded-full flex items-center justify-center font-bold font-mono text-xs select-none shadow-2xs ring-1",
            avatarStyle.bg,
            avatarStyle.text,
            avatarStyle.ring
          )}
          title={`${item.actorName} (QCET)`}
        >
          {getActorInitials(item.actorName)}
        </div>

        {/* Micro overlay icon badge */}
        <div
          className={cn(
            "absolute -bottom-1 -right-1 size-4.5 rounded-full ring-2 ring-card flex items-center justify-center shadow-2xs",
            badge.bg
          )}
        >
          <BadgeIcon size={10} strokeWidth={1.5} />
        </div>
      </div>

      {/* Content text */}
      <div className="flex-1 min-w-0 pr-1">
        <p className="text-xs text-foreground leading-snug line-clamp-2">
          <span className="font-bold text-foreground">{item.actorName}</span>{" "}
          <span className="text-muted-foreground">{item.action}</span>{" "}
          <span className="font-semibold text-foreground">&ldquo;{item.targetTitle}&rdquo;</span>
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="px-1 py-0.2 rounded text-xs font-mono font-semibold bg-muted text-muted-foreground border border-border/50">
            {item.category}
          </span>
          <span className="text-xs text-muted-foreground font-mono tabular-nums flex items-center gap-1">
            <Clock size={10} strokeWidth={1.5} className="text-muted-foreground/80 shrink-0" />
            <span>{item.timestamp}</span>
          </span>
        </div>
      </div>

      {/* Unread Indicator or Quick Mark Read Button on hover */}
      {!item.isRead ? (
        <div className="self-center shrink-0 flex items-center gap-1 pr-1">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRead();
            }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-card hover:shadow-xs text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            title="Đánh dấu là đã đọc"
          >
            <Check size={14} strokeWidth={1.5} />
          </button>
          <span className="size-2 rounded-full bg-primary ring-2 ring-primary/20 group-hover:hidden" />
        </div>
      ) : null}
    </Link>
  );
}
export { NotificationRow };
