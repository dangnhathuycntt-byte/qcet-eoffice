"use client";

import * as React from "react";
import { Popover } from "@base-ui/react/popover";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  CheckCheck,
  Clock,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/layout/sidebar-context";
import {
  QCETNotification,
  formatNotificationContent,
  getDeterministicAvatarStyle,
  getActorInitials,
  getTypeBadge,
  mapDbNotification,
  formatRelativeTime,
  getTimeGroup,
  resolveActionableDeepLink,
  deriveNotificationsViewState,
  getNotificationEmptyCopy,
  beginOptimisticRead,
  settleOptimisticRead,
} from "@/lib/notification-triage";

// Re-export for backward compatibility
export type { QCETNotification };
export { mapDbNotification, formatRelativeTime, getTimeGroup };

interface NotificationPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  containerRef?: React.RefObject<HTMLElement | null>;
}

export function NotificationPopover({ isOpen, onClose, containerRef }: NotificationPopoverProps) {
  const [notifications, setNotifications] = React.useState<QCETNotification[]>([]);
  const [filter, setFilter] = React.useState<"all" | "unread">("all");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const { setBadgeCounts } = useSidebar();

  const fetchNotifications = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) {
        throw new Error(`Yêu cầu thất bại (${res.status})`);
      }
      const data = await res.json();
      if (!data.success || !Array.isArray(data.notifications)) {
        throw new Error("Dữ liệu thông báo không hợp lệ");
      }
      setNotifications(data.notifications.map(mapDbNotification));
    } catch (err) {
      // A failed fetch is an ERROR state, never an apparent empty inbox (T44).
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Không thể kết nối tới máy chủ thông báo."
      );
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

  // Sync unread count to sidebar badge in real-time
  React.useEffect(() => {
    setBadgeCounts((prev) => {
      if (prev.notifications === unreadCount) return prev;
      return {
        ...prev,
        notifications: unreadCount,
      };
    });
  }, [unreadCount, setBadgeCounts]);

  // ponytail: click-outside handled by Base UI Popover

  // ponytail: Escape handled by Base UI Popover

  // Optimistic mark-read with rollback to server truth on failure (T46).
  const markAsRead = async (id: string) => {
    const session = beginOptimisticRead(notifications, id);
    setNotifications(session.optimistic);
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
      setNotifications((prev) =>
        settleOptimisticRead(session, { ok: res.ok, serverNotifications: prev })
      );
    } catch {
      setNotifications(settleOptimisticRead(session, { ok: false }));
    }
  };

  const markAllAsRead = async () => {
    const session = beginOptimisticRead(notifications, "all");
    setNotifications(session.optimistic);
    try {
      const res = await fetch("/api/notifications", { method: "PATCH" });
      setNotifications((prev) =>
        settleOptimisticRead(session, { ok: res.ok, serverNotifications: prev })
      );
    } catch {
      setNotifications(settleOptimisticRead(session, { ok: false }));
    }
  };

  const filteredNotifications = React.useMemo(() => {
    if (filter === "unread") {
      return notifications.filter((n) => !n.isRead);
    }
    return notifications;
  }, [notifications, filter]);

  // Explicit loading/data/empty/error parity with the full page (T44/T47).
  const viewState = deriveNotificationsViewState({
    isLoading,
    hasError: error !== null,
    count: notifications.length,
  });
  const emptyCopy = getNotificationEmptyCopy("all", filter === "unread");

  const newItems = React.useMemo(() => {
    return filteredNotifications.filter((n) => n.timeGroup === "new");
  }, [filteredNotifications]);

  const earlierItems = React.useMemo(() => {
    return filteredNotifications.filter((n) => n.timeGroup === "earlier");
  }, [filteredNotifications]);

  return (
    <Popover.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Popover.Portal>
        <Popover.Positioner className="z-50" anchor={containerRef} align="end" sideOffset={8} collisionPadding={8}>
        <Popover.Popup
          ref={popoverRef}
          aria-label="Trung tâm thông báo"
          finalFocus={() => containerRef?.current?.querySelector<HTMLElement>("button") ?? true}
          style={{ maxWidth: "var(--available-width)", maxHeight: "min(580px, 85vh, var(--available-height))" }}
          className="w-[calc(100vw-16px)] sm:w-[420px] bg-card rounded-2xl border border-border/80 shadow-2xl flex flex-col overflow-hidden select-none motion-safe:animate-in fade-in-0 zoom-in-95"
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
                <span>Không có thông báo chưa đọc</span>
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
        {viewState === "error" ? (
          <div className="py-12 px-4 text-center" role="alert" data-testid="notification-error-state">
            <div className="size-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-2.5">
              <AlertTriangle size={18} strokeWidth={1.5} />
            </div>
            <p className="text-xs font-semibold text-foreground">Không thể tải thông báo</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {error ?? "Không thể kết nối tới máy chủ thông báo."}
            </p>
            <button
              type="button"
              onClick={fetchNotifications}
              disabled={isLoading}
              className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/80 bg-card text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={12} strokeWidth={1.5} className={isLoading ? "motion-safe:animate-spin" : ""} />
              <span>Thử lại</span>
            </button>
          </div>
        ) : viewState === "loading" ? (
          <div className="py-3 px-3 space-y-2" data-testid="notification-loading-state" aria-label="Đang tải thông báo...">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3 p-2.5 motion-safe:animate-pulse">
                <div className="size-10 rounded-full bg-muted/60 shrink-0" />
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="h-3.5 w-3/4 rounded bg-muted/60" />
                  <div className="h-3 w-1/3 rounded bg-muted/40" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="py-12 px-4 text-center" data-testid="notification-empty-state">
            <div className="size-10 rounded-full bg-secondary/80 text-muted-foreground flex items-center justify-center mx-auto mb-2.5">
              <Check size={18} strokeWidth={1.5} />
            </div>
            <p className="text-xs font-semibold text-foreground">{emptyCopy.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{emptyCopy.description}</p>
          </div>
        ) : (
          <>
            {/* Section: Mới */}
            {newItems.length > 0 && (
              <div className="pb-1">
                <div className="px-3.5 py-1.5 text-xs font-bold text-muted-foreground/80 bg-muted/20">
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
                <div className="px-3.5 py-1.5 text-xs font-bold text-muted-foreground/80 bg-muted/20">
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
          className="inline-flex items-center justify-center gap-1.5 w-full py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors cursor-pointer"
        >
          <span>Xem tất cả thông báo điều hành</span>
          <ExternalLink size={12} strokeWidth={1.5} />
        </Link>
      </div>
        </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
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
  const avatarStyle = getDeterministicAvatarStyle(item.actorName);
  const formatted = formatNotificationContent(item);

  const destinationHref = resolveActionableDeepLink(item);

  const handleClick = () => {
    if (!item.isRead) {
      onRead();
    }
    onClose();
  };

  return (
    <Link
      href={destinationHref}
      onClick={handleClick}
      className={cn(
        "group relative flex items-start gap-3 p-2.5 min-h-[48px] touch-manipulation rounded-xl transition-all cursor-pointer border border-transparent",
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
          title={`${formatted.actorName} (QCET)`}
        >
          {getActorInitials(formatted.actorName)}
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

      {/* Content text - Formatted cleanly without string duplication glitch */}
      <div className="flex-1 min-w-0 pr-1">
        <p className="text-xs text-foreground leading-snug line-clamp-2">
          <span className="font-bold text-foreground">{formatted.actorName}</span>{" "}
          <span className="text-muted-foreground">{formatted.actionText}</span>{" "}
          {formatted.targetTitle && (
            <span className="font-semibold text-foreground">&ldquo;{formatted.targetTitle}&rdquo;</span>
          )}
          {formatted.directiveNote && (
            <span className="italic text-foreground/90 font-medium"> &ldquo;{formatted.directiveNote}&rdquo;</span>
          )}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="px-1 py-0.2 rounded text-xs font-mono font-semibold bg-muted text-muted-foreground border border-border/50">
            {item.category}
          </span>
          {formatted.extraBadge && (
            <span className="px-1 py-0.2 rounded text-xs font-mono font-medium bg-amber-500/10 text-amber-800 border border-amber-500/20">
              {formatted.extraBadge}
            </span>
          )}
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
