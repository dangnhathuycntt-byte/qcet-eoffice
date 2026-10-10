"use client";

import * as React from "react";
import Link from "next/link";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  Inbox,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type QCETNotification,
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
  groupNotificationsByDay,
} from "@/lib/notification-triage";
import {
  fadeVariants,
  listItemVariants,
  staggerContainerVariants,
} from "@/lib/motion/variants";
import { motionTransition } from "@/lib/motion/tokens";
import { Pressable } from "@/components/ui/pressable";

const PAGE_SIZE = 20;

export function NotificationCenter() {
  const [notifications, setNotifications] = React.useState<QCETNotification[]>([]);
  const [filter, setFilter] = React.useState<"all" | "unread">("all");
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);

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

  const unreadCount = React.useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

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

  const paginatedNotifications = React.useMemo(
    () => filteredNotifications.slice(0, visibleCount),
    [filteredNotifications, visibleCount]
  );

  const hasMore = visibleCount < filteredNotifications.length;

  const viewState = deriveNotificationsViewState({
    isLoading,
    hasError: error !== null,
    count: notifications.length,
  });
  const emptyCopy = getNotificationEmptyCopy("all", filter === "unread");

  const { today, earlier } = React.useMemo(
    () => groupNotificationsByDay(paginatedNotifications),
    [paginatedNotifications]
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-muted/60">
            <Bell size={20} strokeWidth={1.5} className="text-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">
              Trung tâm thông báo
            </h1>
            {unreadCount > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {unreadCount} thông báo chưa đọc
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[44px] sm:min-h-0"
            >
              <CheckCheck size={14} strokeWidth={1.5} />
              <span>Đánh dấu tất cả đã đọc</span>
            </button>
          )}
          <button
            type="button"
            onClick={fetchNotifications}
            disabled={isLoading}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer disabled:opacity-50 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[44px] sm:min-h-0"
            title="Làm mới"
          >
            <RefreshCw
              size={16}
              strokeWidth={1.5}
              className={cn(isLoading && "animate-spin")}
            />
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-5 p-1 bg-muted/40 rounded-xl w-fit">
        {(
          [
            { key: "all", label: "Tất cả" },
            { key: "unread", label: "Chưa đọc" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setFilter(tab.key);
              setVisibleCount(PAGE_SIZE);
            }}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring min-h-[44px] sm:min-h-0",
              filter === tab.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {tab.key === "unread" && unreadCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary tabular-nums">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content area */}
      <AnimatePresence mode="wait">
        {viewState === "loading" && (
          <m.div
            key="loading"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex flex-col items-center justify-center py-20 text-muted-foreground"
          >
            <Loader2 size={24} className="animate-spin mb-3" />
            <p className="text-sm">Đang tải thông báo...</p>
          </m.div>
        )}

        {viewState === "error" && (
          <m.div
            key="error"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="p-3 rounded-full bg-destructive/10 mb-4">
              <AlertTriangle size={24} className="text-destructive" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">Lỗi kết nối</p>
            <p className="text-xs text-muted-foreground mb-4 max-w-xs">{error}</p>
            <Pressable
              type="button"
              onClick={fetchNotifications}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-muted/60 text-foreground hover:bg-muted transition-colors cursor-pointer active:scale-[0.98]"
            >
              <RefreshCw size={14} strokeWidth={1.5} />
              Thử lại
            </Pressable>
          </m.div>
        )}

        {viewState === "empty" && (
          <m.div
            key="empty"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="p-3 rounded-full bg-muted/60 mb-4">
              <Inbox size={24} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">{emptyCopy.title}</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              {emptyCopy.description}
            </p>
          </m.div>
        )}

        {viewState === "data" && (
          <m.div
            key="data"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            {filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-3 rounded-full bg-muted/60 mb-4">
                  <Inbox size={24} className="text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">
                  {emptyCopy.title}
                </p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  {emptyCopy.description}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Today group */}
                {today.length > 0 && (
                  <NotificationGroup label="Hôm nay" items={today} onRead={markAsRead} />
                )}

                {/* Earlier group */}
                {earlier.length > 0 && (
                  <NotificationGroup
                    label="Trước đó"
                    items={earlier}
                    onRead={markAsRead}
                  />
                )}

                {/* Load more */}
                {hasMore && (
                  <div className="flex justify-center pt-2 pb-4">
                    <button
                      type="button"
                      onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                      className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted/60 transition-colors cursor-pointer active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[44px] sm:min-h-0"
                    >
                      Xem thêm ({filteredNotifications.length - visibleCount} thông báo
                      còn lại)
                    </button>
                  </div>
                )}
              </div>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

interface NotificationGroupProps {
  label: string;
  items: QCETNotification[];
  onRead: (id: string) => void;
}

function NotificationGroup({ label, items, onRead }: NotificationGroupProps) {
  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <div className="px-4 py-2 bg-muted/30 border-b border-border/40">
        <span className="text-xs font-semibold text-muted-foreground/80">
          {label}
        </span>
        <span className="ml-2 text-xs text-muted-foreground/60 tabular-nums">
          {items.length}
        </span>
      </div>
      <m.div
        variants={staggerContainerVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="divide-y divide-border/30"
      >
        {items.map((item) => (
          <m.div key={item.id} variants={listItemVariants}>
            <NotificationCenterRow item={item} onRead={() => onRead(item.id)} />
          </m.div>
        ))}
      </m.div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

interface NotificationCenterRowProps {
  item: QCETNotification;
  onRead: () => void;
}

function NotificationCenterRow({ item, onRead }: NotificationCenterRowProps) {
  const badge = getTypeBadge(item.type);
  const BadgeIcon = badge.icon;
  const avatarStyle = getDeterministicAvatarStyle(item.actorName);
  const formatted = formatNotificationContent(item);
  const destinationHref = resolveActionableDeepLink(item);

  const handleClick = () => {
    if (!item.isRead) {
      onRead();
    }
  };

  return (
    <Link
      href={destinationHref}
      onClick={handleClick}
      className={cn(
        "group relative flex items-start gap-3.5 px-4 py-3 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        item.isRead
          ? "hover:bg-muted/40 opacity-85 hover:opacity-100"
          : "bg-primary/[0.03] hover:bg-muted/50"
      )}
    >
      {/* Unread left accent */}
      {!item.isRead && (
        <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-primary/60" />
      )}

      {/* Avatar */}
      <div className="relative shrink-0 mt-0.5">
        <div
          className={cn(
            "size-10 rounded-full flex items-center justify-center font-bold font-mono text-xs select-none ring-1",
            avatarStyle.bg,
            avatarStyle.text,
            avatarStyle.ring
          )}
          title={`${formatted.actorName} (QCET)`}
        >
          {getActorInitials(formatted.actorName)}
        </div>
        <div
          className={cn(
            "absolute -bottom-1 -right-1 size-4.5 rounded-full ring-2 ring-card flex items-center justify-center",
            badge.bg
          )}
        >
          <BadgeIcon size={10} strokeWidth={1.5} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground leading-snug">
          <span className="font-bold text-foreground">{formatted.actorName}</span>{" "}
          <span className="text-muted-foreground">{formatted.actionText}</span>{" "}
          {formatted.targetTitle && (
            <span className="font-semibold text-foreground">
              &ldquo;{formatted.targetTitle}&rdquo;
            </span>
          )}
          {formatted.directiveNote && (
            <span className="italic text-foreground/90 font-medium">
              {" "}
              &ldquo;{formatted.directiveNote}&rdquo;
            </span>
          )}
        </p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="px-1.5 py-0.5 rounded text-xs font-mono font-semibold bg-muted text-muted-foreground border border-border/50">
            {item.category}
          </span>
          {formatted.extraBadge && (
            <span className="px-1.5 py-0.5 rounded text-xs font-mono font-medium bg-warning/10 text-warning border border-warning/20">
              {formatted.extraBadge}
            </span>
          )}
          <span className="text-xs text-muted-foreground font-mono tabular-nums flex items-center gap-1">
            <Clock
              size={11}
              strokeWidth={1.5}
              className="text-muted-foreground/80 shrink-0"
            />
            <span>{item.timestamp}</span>
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="self-center shrink-0 flex items-center gap-1.5">
        {!item.isRead && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRead();
              }}
              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-muted hover:shadow-xs text-muted-foreground hover:text-foreground transition-all cursor-pointer active:scale-[0.98] focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              title="Đánh dấu là đã đọc"
            >
              <Check size={14} strokeWidth={1.5} />
            </button>
            <span className="size-2 rounded-full bg-primary ring-2 ring-primary/20 group-hover:hidden" />
          </>
        )}
        <ExternalLink
          size={14}
          strokeWidth={1.5}
          className="text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors"
        />
      </div>
    </Link>
  );
}

export { NotificationCenterRow };
