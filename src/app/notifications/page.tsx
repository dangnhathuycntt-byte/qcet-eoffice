"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock,
  FileText,
  AlertTriangle,
  Bell,
  RefreshCw,
  ShieldCheck,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  QCETNotification,
  NotificationTriageTab,
  filterNotificationsByTab,
  formatNotificationContent,
  getDeterministicAvatarStyle,
  getActorInitials,
  getTypeBadge,
  mapDbNotification,
  resolveActionableDeepLink,
  extractNotificationEntity,
} from "@/lib/notification-triage";
import { MobileNotificationInbox } from "@/components/notifications/mobile-notification-inbox";

interface CategoryOption {
  id: NotificationTriageTab;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  { id: "all", label: "Tất cả danh mục", icon: Bell },
  { id: "action_required", label: "Việc cần làm", icon: FileText },
  { id: "approvals", label: "Chờ phê duyệt", icon: ShieldCheck },
  { id: "reminders", label: "Nhắc hạn", icon: AlertTriangle },
];

export default function NotificationsPage() {
  const [notifications, setNotifications] = React.useState<QCETNotification[]>([]);
  const [categoryFilter, setCategoryFilter] = React.useState<NotificationTriageTab>("all");
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const filterDropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    if (isFilterOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isFilterOpen]);

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
      // Best-effort
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const unreadCount = React.useMemo(() => {
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);

  // Mark a single notification as read
  const markAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isRead: true } : item))
    );
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    } catch {
      // Best-effort
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    try {
      await fetch("/api/notifications", { method: "PATCH" });
    } catch {
      // Best-effort
    }
  };

  // Filter by active triage tab and optional unreadOnly flag
  const displayedNotifications = React.useMemo(() => {
    const tabItems = filterNotificationsByTab(notifications, categoryFilter);
    if (unreadOnly) {
      return tabItems.filter((n) => !n.isRead);
    }
    return tabItems;
  }, [notifications, categoryFilter, unreadOnly]);

  const newItems = React.useMemo(() => {
    return displayedNotifications.filter((n) => n.timeGroup === "new");
  }, [displayedNotifications]);

  const earlierItems = React.useMemo(() => {
    return displayedNotifications.filter((n) => n.timeGroup === "earlier");
  }, [displayedNotifications]);

  // Informative empty state configuration per tab
  const getEmptyStateContent = () => {
    if (unreadOnly) {
      return {
        title: "Không có thông báo chưa đọc nào",
        description: "Tất cả các thông báo liên quan đã được nắm bắt và đánh dấu đã đọc.",
      };
    }
    switch (categoryFilter) {
      case "action_required":
        return {
          title: "Không có việc cần làm",
          description: "Tất cả nhiệm vụ phân công và chỉ đạo điều hành trực tiếp đã được xử lý hoàn tất.",
        };
      case "approvals":
        return {
          title: "Không có sản phẩm chờ phê duyệt",
          description: "Hiện không có báo cáo tiến độ, minh chứng hoặc hồ sơ DACUM nào cần bạn thẩm định.",
        };
      case "reminders":
        return {
          title: "Không có thông báo nhắc hạn",
          description: "Không có công việc nào cận hạn trong 24 giờ tới hoặc cần gửi cảnh báo nhắc nhở.",
        };
      case "all":
      default:
        return {
          title: "Hiện tại Đồng chí không có thông báo nào",
          description: "Bạn đã nắm bắt toàn bộ hoạt động điều hành và văn bản nghiệp vụ của Nhà trường.",
        };
    }
  };

  const emptyState = getEmptyStateContent();

  return (
    <div className="max-w-3xl mx-auto py-4 px-2 sm:px-0 space-y-4">
      {/* Mobile Actionable Notification Inbox (< 640px / sm:hidden) */}
      <div className="block sm:hidden">
        <MobileNotificationInbox
          notifications={notifications}
          isLoading={isLoading}
          onRefresh={fetchNotifications}
          onMarkAsRead={markAsRead}
          onMarkAllAsRead={markAllAsRead}
        />
      </div>

      {/* Desktop Notification Center (sm:block / >= 640px) */}
      <div className="hidden sm:block">
        {/* Card Container */}
        <div className="rounded-2xl border border-border/80 bg-card shadow-card overflow-hidden select-none">
        {/* Header */}
        <div className="p-4 sm:p-5 pb-3 border-b border-border/50 bg-muted/20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground font-heading">
                Thông báo
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

            {/* Actions: Refresh & Mark All Read */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchNotifications}
                disabled={isLoading}
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground h-8 cursor-pointer rounded-lg"
              >
                <RefreshCw size={13} strokeWidth={1.5} className={isLoading ? "animate-spin" : ""} />
                <span>Làm mới</span>
              </Button>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer border border-border/50 bg-card shadow-2xs h-8"
                  title="Đánh dấu tất cả là đã đọc"
                >
                  <CheckCheck size={14} strokeWidth={1.5} className="text-primary" />
                  <span>Đã đọc tất cả</span>
                </button>
              )}
            </div>
          </div>

          {/* Clean Top Filters: [ Tất cả ] [ Chưa đọc ]        [ Bộ lọc ] */}
          <div className="flex items-center justify-between gap-2 mt-4 pt-2 border-t border-border/40">
            <div className="inline-flex items-center p-0.5 rounded-xl bg-muted/70 border border-border/50 text-xs">
              <button
                type="button"
                onClick={() => setUnreadOnly(false)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                  !unreadOnly
                    ? "bg-card text-foreground shadow-xs border border-border/60"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/40"
                )}
              >
                <span>Tất cả</span>
                <span className="px-1.5 py-0.2 rounded font-mono text-xs tabular-nums bg-muted text-muted-foreground">
                  {notifications.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setUnreadOnly(true)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                  unreadOnly
                    ? "bg-card text-foreground shadow-xs border border-border/60"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/40"
                )}
              >
                <span>Chưa đọc</span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded font-mono text-xs font-bold bg-primary/15 text-primary border border-primary/20 tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>

            {/* Category Filter Dropdown */}
            <div className="relative" ref={filterDropdownRef}>
              <button
                type="button"
                onClick={() => setIsFilterOpen((prev) => !prev)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border",
                  categoryFilter !== "all"
                    ? "bg-primary/10 text-primary border-primary/30 font-semibold"
                    : "bg-muted/40 text-muted-foreground border-border/40 hover:text-foreground hover:bg-muted/70"
                )}
              >
                <Filter size={12} strokeWidth={1.5} />
                <span>
                  {categoryFilter === "all" ? "Bộ lọc" : CATEGORY_OPTIONS.find((c) => c.id === categoryFilter)?.label}
                </span>
                {categoryFilter !== "all" && (
                  <span className="size-1.5 rounded-full bg-primary" />
                )}
              </button>

              {isFilterOpen && (
                <div className="absolute right-0 mt-1 w-48 rounded-xl border border-border/80 bg-card p-1 shadow-lg z-20 space-y-0.5 text-xs">
                  {CATEGORY_OPTIONS.map((opt) => {
                    const OptIcon = opt.icon;
                    const isSelected = categoryFilter === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setCategoryFilter(opt.id);
                          setIsFilterOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer",
                          isSelected
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <OptIcon size={13} strokeWidth={1.5} className={isSelected ? "text-primary" : "text-muted-foreground"} />
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* List Content */}
        <div className="p-2 divide-y divide-border/30">
          {isLoading && notifications.length === 0 ? (
            <div className="py-12 space-y-3 px-4 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-start gap-3.5 p-3 rounded-xl bg-muted/20">
                  <div className="size-11 rounded-full bg-muted/60 shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-3/4 rounded bg-muted/60" />
                    <div className="h-3 w-1/3 rounded bg-muted/40" />
                  </div>
                </div>
              ))}
            </div>
          ) : displayedNotifications.length === 0 ? (
            <div className="py-16 px-4 text-center">
              <div className="size-12 rounded-full bg-secondary/80 text-muted-foreground flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={22} strokeWidth={1.5} className="text-emerald-600" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                {emptyState.title}
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {emptyState.description}
              </p>
            </div>
          ) : (
            <>
              {/* Section: Mới cập nhật (< 2h) */}
              {newItems.length > 0 && (
                <div className="pb-2">
                  <div className="flex items-center justify-between px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground/80 bg-muted/20 rounded-lg mb-1">
                    <span>Mới cập nhật</span>
                    <span className="font-mono text-xs">{newItems.length}</span>
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
                    <span className="font-mono text-xs">{earlierItems.length}</span>
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
  const badge = getTypeBadge(item.type);
  const BadgeIcon = badge.icon;
  const avatarStyle = getDeterministicAvatarStyle(item.actorName);
  const formatted = formatNotificationContent(item);

  const destinationHref = resolveActionableDeepLink(item);

  return (
    <Link
      href={destinationHref}
      onClick={() => {
        if (!item.isRead) {
          onRead();
        }
      }}
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
          title={`${formatted.actorName} (QCET)`}
        >
          {getActorInitials(formatted.actorName)}
        </div>

        <div
          className={cn(
            "absolute -bottom-1 -right-1 size-5 rounded-full ring-2 ring-card flex items-center justify-center shadow-2xs",
            badge.bg
          )}
        >
          <BadgeIcon size={11} strokeWidth={1.5} />
        </div>
      </div>

      {/* Main Content Area - Formatted without string duplication glitch */}
      <div className="flex-1 min-w-0 pr-2">
        <p className="text-xs sm:text-sm text-foreground leading-snug line-clamp-2">
          <span className="font-bold text-foreground">{formatted.actorName}</span>{" "}
          <span className="text-muted-foreground">{formatted.actionText}</span>{" "}
          {formatted.targetTitle && (
            <span className="font-semibold text-foreground">&ldquo;{formatted.targetTitle}&rdquo;</span>
          )}
          {formatted.directiveNote && (
            <span className="italic text-foreground/90 font-medium"> &ldquo;{formatted.directiveNote}&rdquo;</span>
          )}
        </p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="px-1.5 py-0.5 rounded text-xs font-mono font-semibold bg-muted text-muted-foreground border border-border/50">
            {item.category}
          </span>
          {formatted.extraBadge && (
            <span className="px-1.5 py-0.5 rounded text-xs font-mono font-medium bg-amber-500/10 text-amber-800 border border-amber-500/20">
              {formatted.extraBadge}
            </span>
          )}
          <span className="text-xs text-muted-foreground font-mono tabular-nums flex items-center gap-1">
            <Clock size={11} strokeWidth={1.5} className="text-muted-foreground/80 shrink-0" />
            <span>{item.timestamp}</span>
          </span>
        </div>
      </div>

      {/* Unread Indicator or Quick Mark Read Button on hover */}
      {!item.isRead ? (
        <div className="self-center shrink-0 flex items-center gap-1.5 pr-1">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRead();
            }}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-card hover:shadow-xs text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            title="Đánh dấu là đã đọc"
          >
            <Check size={16} strokeWidth={1.5} />
          </button>
          <span className="size-2.5 rounded-full bg-primary ring-2 ring-primary/20 group-hover:hidden" />
        </div>
      ) : null}
    </Link>
  );
}
