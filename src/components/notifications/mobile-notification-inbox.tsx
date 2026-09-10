"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  Filter,
  CheckCircle2,
  FileText,
  AlertTriangle,
  Clock,
  ExternalLink,
  RefreshCw,
  Search,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  QCETNotification,
  formatNotificationContent,
  getDeterministicAvatarStyle,
  getActorInitials,
  getTypeBadge,
  extractNotificationEntity,
  resolveActionableDeepLink,
  groupNotificationsByDay,
  filterNotificationsMobile,
  type MobileNotificationFilter,
} from "@/lib/notification-triage";

export interface MobileNotificationInboxProps {
  notifications: QCETNotification[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onMarkAsRead: (id: string) => Promise<void> | void;
  onMarkAllAsRead?: () => Promise<void> | void;
  className?: string;
}

export function MobileNotificationInbox({
  notifications,
  isLoading = false,
  onRefresh,
  onMarkAsRead,
  onMarkAllAsRead,
  className,
}: MobileNotificationInboxProps) {
  const router = useRouter();
  const [filterTab, setFilterTab] = React.useState<MobileNotificationFilter>("all");
  const [searchQuery, setSearchQuery] = React.useState("");

  // Filtered by tab
  const tabFiltered = React.useMemo(() => {
    return filterNotificationsMobile(notifications, filterTab);
  }, [notifications, filterTab]);

  // Secondary text search
  const filteredList = React.useMemo(() => {
    if (!searchQuery.trim()) return tabFiltered;
    const q = searchQuery.toLowerCase().trim();
    return tabFiltered.filter((n) => {
      const title = (n.targetTitle || n.title || "").toLowerCase();
      const body = (n.action || n.body || "").toLowerCase();
      const actor = (n.actorName || "").toLowerCase();
      const entity = extractNotificationEntity(n);
      const code = (entity?.code || "").toLowerCase();
      return title.includes(q) || body.includes(q) || actor.includes(q) || code.includes(q);
    });
  }, [tabFiltered, searchQuery]);

  // Grouped by day: "HÔM NAY" and "TRƯỚC ĐÓ"
  const { today, earlier } = React.useMemo(() => {
    return groupNotificationsByDay(filteredList);
  }, [filteredList]);

  // Count metrics
  const totalCount = notifications.length;
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const actionRequiredCount = filterNotificationsMobile(notifications, "action_required").length;

  const handleCardClick = (item: QCETNotification, deepLink: string) => {
    if (!item.isRead) {
      onMarkAsRead(item.id);
    }
    router.push(deepLink);
  };

  return (
    <div
      className={cn("w-full space-y-3 select-none pb-6", className)}
      data-slot="mobile-notification-inbox"
    >
      {/* =================================================================== */}
      {/* 1. Header Toolbar: Action Title & Mark All Read                     */}
      {/* =================================================================== */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Hộp thư thông báo điều hành
          </span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[11px] font-mono tabular-nums font-bold bg-primary text-primary-foreground">
              {unreadCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="size-9 rounded-lg border border-border/80 bg-card flex items-center justify-center text-muted-foreground hover:text-foreground touch-manipulation cursor-pointer disabled:opacity-50 shadow-2xs"
              title="Làm mới"
              aria-label="Làm mới"
            >
              <RefreshCw size={14} strokeWidth={1.5} className={isLoading ? "animate-spin" : ""} />
            </button>
          )}

          {unreadCount > 0 && onMarkAllAsRead && (
            <button
              type="button"
              onClick={() => onMarkAllAsRead()}
              className="inline-flex items-center gap-1 min-h-[36px] px-2.5 rounded-lg border border-border/80 bg-card text-xs font-medium text-muted-foreground hover:text-foreground touch-manipulation cursor-pointer shadow-2xs"
              title="Đã đọc tất cả"
            >
              <CheckCheck size={14} strokeWidth={1.5} className="text-primary" />
              <span>Đã đọc hết</span>
            </button>
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* 2. Filter Tabs: [Tất cả] [Chưa đọc] [Cần xử lý]                     */}
      {/* =================================================================== */}
      <div
        className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-muted/60 border border-border/70 shadow-2xs"
        role="tablist"
        aria-label="Bộ lọc thông báo"
      >
        <button
          type="button"
          role="tab"
          aria-selected={filterTab === "all"}
          onClick={() => setFilterTab("all")}
          className={cn(
            "flex items-center justify-center gap-1.5 min-h-[44px] px-2 rounded-lg text-xs font-semibold transition-all touch-manipulation cursor-pointer",
            filterTab === "all"
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          )}
          data-testid="filter-tab-all"
        >
          <span>Tất cả</span>
          <span className="font-mono tabular-nums text-[11px] opacity-80">
            ({totalCount})
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={filterTab === "unread"}
          onClick={() => setFilterTab("unread")}
          className={cn(
            "flex items-center justify-center gap-1.5 min-h-[44px] px-2 rounded-lg text-xs font-semibold transition-all touch-manipulation cursor-pointer",
            filterTab === "unread"
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          )}
          data-testid="filter-tab-unread"
        >
          <span>Chưa đọc</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono tabular-nums font-bold bg-primary/15 text-primary">
              {unreadCount}
            </span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={filterTab === "action_required"}
          onClick={() => setFilterTab("action_required")}
          className={cn(
            "flex items-center justify-center gap-1.5 min-h-[44px] px-2 rounded-lg text-xs font-semibold transition-all touch-manipulation cursor-pointer",
            filterTab === "action_required"
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          )}
          data-testid="filter-tab-action_required"
        >
          <span>Cần xử lý</span>
          {actionRequiredCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono tabular-nums font-bold bg-amber-500/15 text-amber-800">
              {actionRequiredCount}
            </span>
          )}
        </button>
      </div>

      {/* =================================================================== */}
      {/* 3. Notification Groups List (HÔM NAY & TRƯỚC ĐÓ)                     */}
      {/* =================================================================== */}
      {filteredList.length === 0 ? (
        <div className="py-12 px-4 text-center rounded-2xl border border-dashed border-border/80 bg-card">
          <Bell size={24} strokeWidth={1.5} className="mx-auto text-muted-foreground/60 mb-2" />
          <p className="text-xs font-bold text-foreground">Không có thông báo nào</p>
          <p className="text-xs text-muted-foreground mt-1">
            {filterTab === "unread"
              ? "Tất cả thông báo đã được đánh dấu đã đọc"
              : filterTab === "action_required"
              ? "Không có công việc hoặc văn bản nào cần xử lý lúc này"
              : "Hộp thư thông báo của bạn đang trống"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Section: HÔM NAY */}
          {today.length > 0 && (
            <div className="space-y-2" data-testid="notification-group-today">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  HÔM NAY
                </span>
                <span className="text-xs font-mono tabular-nums text-muted-foreground">
                  {today.length}
                </span>
              </div>
              <div className="space-y-2">
                {today.map((item) => (
                  <MobileNotificationCard
                    key={item.id}
                    item={item}
                    onCardClick={handleCardClick}
                    onMarkAsRead={() => onMarkAsRead(item.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Section: TRƯỚC ĐÓ */}
          {earlier.length > 0 && (
            <div className="space-y-2" data-testid="notification-group-earlier">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  TRƯỚC ĐÓ
                </span>
                <span className="text-xs font-mono tabular-nums text-muted-foreground">
                  {earlier.length}
                </span>
              </div>
              <div className="space-y-2">
                {earlier.map((item) => (
                  <MobileNotificationCard
                    key={item.id}
                    item={item}
                    onCardClick={handleCardClick}
                    onMarkAsRead={() => onMarkAsRead(item.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface MobileNotificationCardProps {
  item: QCETNotification;
  onCardClick: (item: QCETNotification, deepLink: string) => void;
  onMarkAsRead: () => void;
}

function MobileNotificationCard({
  item,
  onCardClick,
  onMarkAsRead,
}: MobileNotificationCardProps) {
  const entity = extractNotificationEntity(item);
  const deepLink = resolveActionableDeepLink(item);
  const formatted = formatNotificationContent(item);
  const avatarStyle = getDeterministicAvatarStyle(item.actorName);
  const badge = getTypeBadge(item.type);
  const BadgeIcon = badge.icon;

  return (
    <div
      onClick={() => onCardClick(item, deepLink)}
      className={cn(
        "relative flex items-start gap-3 p-3 min-h-[48px] rounded-xl border transition-all touch-manipulation cursor-pointer shadow-2xs group",
        item.isRead
          ? "bg-card border-border/70 hover:bg-muted/30 opacity-90 hover:opacity-100"
          : "bg-primary/[0.04] border-primary/30 hover:bg-primary/[0.07] font-medium"
      )}
      data-testid={`notification-card-${item.id}`}
    >
      {/* Unread Indicator Dot */}
      {!item.isRead && (
        <span
          className="absolute top-3.5 right-3.5 size-2 rounded-full bg-primary ring-2 ring-primary/20 shrink-0"
          aria-label="Chưa đọc"
          data-testid="unread-indicator"
        />
      )}

      {/* Avatar Container */}
      <div className="relative shrink-0 mt-0.5">
        <div
          className={cn(
            "size-10 rounded-full flex items-center justify-center font-bold font-mono text-xs select-none shadow-2xs ring-1",
            avatarStyle.bg,
            avatarStyle.text,
            avatarStyle.ring
          )}
        >
          {getActorInitials(formatted.actorName)}
        </div>
        <div
          className={cn(
            "absolute -bottom-1 -right-1 size-4.5 rounded-full ring-2 ring-card flex items-center justify-center shadow-2xs",
            badge.bg
          )}
        >
          <BadgeIcon size={10} strokeWidth={1.5} />
        </div>
      </div>

      {/* Notification Body Content */}
      <div className="flex-1 min-w-0 pr-4">
        {/* Title / Action text: Who did what */}
        <div className="text-xs sm:text-sm text-foreground leading-snug">
          <span className="font-bold text-foreground">{formatted.actorName}</span>{" "}
          <span className="text-muted-foreground">{formatted.actionText}</span>
        </div>

        {/* Target Subject / Title */}
        {formatted.targetTitle && (
          <div className="text-xs font-semibold text-foreground line-clamp-2 mt-0.5">
            &ldquo;{formatted.targetTitle}&rdquo;
          </div>
        )}

        {/* Executive Directive Quotation */}
        {formatted.directiveNote && (
          <div className="text-xs italic text-foreground/90 border-l-2 border-primary/50 pl-2 mt-1 py-0.5 bg-muted/40 rounded-r">
            &ldquo;{formatted.directiveNote}&rdquo;
          </div>
        )}

        {/* Metadata Footer: Entity Badge & Relative Timestamp */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {/* Entity Badge: Task Code e.g. NV-092 or Document Number e.g. 142/QĐ */}
          {entity && (
            <span
              className={cn(
                "inline-flex items-center px-1.5 py-0.2 rounded text-[11px] font-mono tabular-nums font-semibold",
                entity.type === "task"
                  ? "bg-primary/10 text-primary border border-primary/25"
                  : "bg-amber-500/10 text-amber-800 border border-amber-500/25"
              )}
              data-testid={`entity-badge-${entity.code}`}
            >
              {entity.code}
            </span>
          )}

          {/* Category Tag */}
          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-muted text-muted-foreground border border-border/50">
            {item.category}
          </span>

          {/* Relative Timestamp */}
          <span className="text-[11px] text-muted-foreground font-mono tabular-nums ml-auto flex items-center gap-1">
            <Clock size={11} strokeWidth={1.5} />
            <span>{item.timestamp}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
