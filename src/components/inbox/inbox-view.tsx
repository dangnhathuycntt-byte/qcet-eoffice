"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Inbox as InboxIcon,
  CheckCheck,
  Check,
  Mail,
  MailOpen,
  RotateCcw,
  Filter,
  ArrowLeft,
  ExternalLink,
  Clock,
  AlertTriangle,
  FileText,
  ShieldCheck,
  ChevronRight,
  MoreHorizontal,
  CheckCircle2,
  Building2,
  User,
  Calendar,
  Layers,
  ArrowUpRight,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/layout/sidebar-context";
import { useAuth } from "@/lib/auth-context";
import {
  QCETNotification,
  NotificationTriageTab,
  filterNotificationsByTab,
  formatNotificationContent,
  getDeterministicAvatarStyle,
  getActorInitials,
  getTypeBadge,
  mapDbNotification,
  formatRelativeTime,
} from "@/lib/notification-triage";
import type { SchoolTask } from "@/types/dashboard";

interface CategoryOption {
  id: NotificationTriageTab;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  { id: "all", label: "Tất cả danh mục", icon: InboxIcon },
  { id: "action_required", label: "Việc cần làm", icon: FileText },
  { id: "approvals", label: "Chờ phê duyệt", icon: ShieldCheck },
  { id: "reminders", label: "Nhắc hạn", icon: AlertTriangle },
];

export function InboxView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setBadgeCounts } = useSidebar();
  const { user } = useAuth();

  const [notifications, setNotifications] = React.useState<QCETNotification[]>([]);
  const [activeTab, setActiveTab] = React.useState<"all" | "unread">(() => {
    const filter = searchParams?.get("filter");
    return filter === "unread" ? "unread" : "all";
  });
  const [categoryFilter, setCategoryFilter] = React.useState<NotificationTriageTab>("all");
  const [selectedId, setSelectedId] = React.useState<string | null>(() => {
    return searchParams?.get("id") || null;
  });
  const [searchQuery, setSearchQuery] = React.useState("");

  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = React.useState(false);
  const filterMenuRef = React.useRef<HTMLDivElement>(null);

  // Task context cache when viewing an item
  const [taskContext, setTaskContext] = React.useState<SchoolTask | null>(null);
  const [isLoadingTaskContext, setIsLoadingTaskContext] = React.useState(false);

  // Keep track of item that was read during the current unread-tab session so it doesn't suddenly disappear
  const readDuringSessionIdsRef = React.useRef<Set<string>>(new Set());

  // Close filter menu when clicked outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
        setIsFilterMenuOpen(false);
      }
    };
    if (isFilterMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isFilterMenuOpen]);

  // Fetch notifications list
  const fetchNotifications = React.useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) {
        throw new Error(`Không thể tải thông báo (${res.status})`);
      }
      const data = await res.json();
      if (!data.success || !Array.isArray(data.notifications)) {
        throw new Error("Dữ liệu thông báo từ máy chủ không hợp lệ");
      }
      const mapped = data.notifications.map(mapDbNotification);
      setNotifications(mapped);

      // Update global sidebar badge count
      const unreadCount = mapped.filter((n: QCETNotification) => !n.isRead).length;
      setBadgeCounts((prev) => ({ ...prev, notifications: unreadCount }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi kết nối máy chủ");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [setBadgeCounts]);

  React.useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Sync selectedId with URL
  React.useEffect(() => {
    const idFromUrl = searchParams?.get("id");
    if (idFromUrl && idFromUrl !== selectedId) {
      setSelectedId(idFromUrl);
    }
  }, [searchParams, selectedId]);

  // Update URL helper
  const updateUrlParams = React.useCallback(
    (newId: string | null, newFilter?: "all" | "unread") => {
      const params = new URLSearchParams(searchParams?.toString() || "");
      if (newId) {
        params.set("id", newId);
      } else {
        params.delete("id");
      }
      const targetFilter = newFilter !== undefined ? newFilter : activeTab;
      if (targetFilter === "unread") {
        params.set("filter", "unread");
      } else {
        params.delete("filter");
      }
      const queryString = params.toString();
      const newPath = queryString ? `/inbox?${queryString}` : "/inbox";
      router.replace(newPath, { scroll: false });
    },
    [router, searchParams, activeTab]
  );

  // Selected notification object
  const selectedNotification = React.useMemo(() => {
    if (!selectedId) return null;
    return notifications.find((n) => n.id === selectedId) || null;
  }, [notifications, selectedId]);

  // Total unread count
  const unreadCount = React.useMemo(() => {
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);

  // Mark single item as read
  const markAsRead = React.useCallback(
    async (id: string, isReadTarget = true) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: isReadTarget } : n))
      );

      if (isReadTarget) {
        readDuringSessionIdsRef.current.add(id);
      } else {
        readDuringSessionIdsRef.current.delete(id);
      }

      // Update badge count
      setBadgeCounts((prev) => {
        const currentUnread = Number(prev.notifications) || 0;
        const delta = isReadTarget ? -1 : 1;
        return {
          ...prev,
          notifications: Math.max(0, currentUnread + delta),
        };
      });

      try {
        await fetch(`/api/notifications/${id}/read`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isRead: isReadTarget }),
        });
      } catch (err) {
        // Rollback on failure
        fetchNotifications(false);
      }
    },
    [fetchNotifications, setBadgeCounts]
  );

  // Mark all as read
  const markAllAsRead = React.useCallback(async () => {
    setNotifications((prev) =>
      prev.map((n) => {
        readDuringSessionIdsRef.current.add(n.id);
        return { ...n, isRead: true };
      })
    );
    setBadgeCounts((prev) => ({ ...prev, notifications: 0 }));

    try {
      await fetch("/api/notifications/read-all", { method: "PATCH" });
    } catch {
      fetchNotifications(false);
    }
  }, [fetchNotifications, setBadgeCounts]);

  // Handle click on a notification item
  const handleSelectItem = React.useCallback(
    (item: QCETNotification) => {
      setSelectedId(item.id);
      updateUrlParams(item.id);

      // Auto mark as read on selection
      if (!item.isRead) {
        markAsRead(item.id, true);
      }
    },
    [updateUrlParams, markAsRead]
  );

  // Fetch linked task details when a notification has task linkage
  React.useEffect(() => {
    if (!selectedNotification) {
      setTaskContext(null);
      return;
    }

    const link = selectedNotification.linkHref || "";
    const taskIdMatch = link.match(/[?&]taskId=([^&]+)/) || link.match(/\/tasks\/([^?&]+)/);
    const targetTaskId = taskIdMatch ? taskIdMatch[1] : null;

    if (!targetTaskId) {
      setTaskContext(null);
      return;
    }

    let isMounted = true;
    setIsLoadingTaskContext(true);

    fetch(`/api/tasks?id=${encodeURIComponent(targetTaskId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted) return;
        if (data?.success && data?.task) {
          setTaskContext(data.task);
        } else if (data?.tasks && data.tasks.length > 0) {
          const matched = data.tasks.find((t: SchoolTask) => t.id === targetTaskId);
          setTaskContext(matched || null);
        } else {
          setTaskContext(null);
        }
      })
      .catch(() => {
        if (isMounted) setTaskContext(null);
      })
      .finally(() => {
        if (isMounted) setIsLoadingTaskContext(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedNotification]);

  // Filtered notifications list
  const filteredNotifications = React.useMemo(() => {
    let list = filterNotificationsByTab(notifications, categoryFilter);

    if (activeTab === "unread") {
      list = list.filter((n) => !n.isRead || readDuringSessionIdsRef.current.has(n.id));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (n) =>
          n.actorName.toLowerCase().includes(q) ||
          (n.targetTitle || "").toLowerCase().includes(q) ||
          (n.action || "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [notifications, categoryFilter, activeTab, searchQuery]);

  return (
    <div
      data-slot="inbox-workspace"
      className="flex flex-col h-[calc(100vh-56px)] md:h-[calc(100vh-24px)] rounded-2xl border border-border/70 bg-card overflow-hidden shadow-xs select-none"
    >
      {/* ========================================================= */}
      {/* MAIN TWO-PANE BODY */}
      {/* ========================================================= */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* ------------------------------------------------------- */}
        {/* LEFT PANE: NOTIFICATIONS LIST (340px - 380px)           */}
        {/* ------------------------------------------------------- */}
        <aside
          data-slot="inbox-list-pane"
          className={cn(
            "w-full md:w-[340px] lg:w-[380px] shrink-0 flex flex-col h-full border-r border-border/70 bg-background transition-all",
            selectedId ? "hidden md:flex" : "flex"
          )}
        >
          {/* Top Header of Left Pane */}
          <div className="p-3 border-b border-border/60 bg-muted/20 space-y-2.5 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-foreground font-heading">
                  Hộp thư
                </h1>
                {unreadCount > 0 && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-primary/10 text-primary border border-primary/20 tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => fetchNotifications(true)}
                  disabled={isRefreshing}
                  title="Làm mới hộp thư"
                  aria-label="Làm mới"
                  className="size-7 text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw
                    size={14}
                    strokeWidth={1.5}
                    className={cn(isRefreshing && "animate-spin text-primary")}
                  />
                </Button>

                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={markAllAsRead}
                    title="Đánh dấu tất cả là đã đọc"
                    aria-label="Đánh dấu tất cả đã đọc"
                    className="size-7 text-muted-foreground hover:text-foreground"
                  >
                    <CheckCheck size={14} strokeWidth={1.5} />
                  </Button>
                )}

                {/* Filter categories dropdown */}
                <div className="relative" ref={filterMenuRef}>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setIsFilterMenuOpen((prev) => !prev)}
                    title="Lọc theo loại thông báo"
                    aria-label="Lọc theo loại"
                    className={cn(
                      "size-7 text-muted-foreground hover:text-foreground",
                      categoryFilter !== "all" && "text-primary bg-primary/10"
                    )}
                  >
                    <Filter size={14} strokeWidth={1.5} />
                  </Button>

                  {isFilterMenuOpen && (
                    <div className="absolute right-0 mt-1 w-48 rounded-xl border border-border/80 bg-card p-1 shadow-dropdown z-50 animate-in fade-in zoom-in-95">
                      <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground/80">
                        Loại thông báo
                      </div>
                      {CATEGORY_OPTIONS.map((opt) => {
                        const Icon = opt.icon;
                        const isSelected = categoryFilter === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setCategoryFilter(opt.id);
                              setIsFilterMenuOpen(false);
                            }}
                            className={cn(
                              "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer",
                              isSelected
                                ? "bg-primary/10 text-primary font-semibold"
                                : "text-foreground hover:bg-muted/60"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <Icon size={14} strokeWidth={1.5} className="shrink-0" />
                              <span>{opt.label}</span>
                            </div>
                            {isSelected && <Check size={12} strokeWidth={1.5} />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Pill Tabs: Tất cả / Chưa đọc */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("all");
                  updateUrlParams(selectedId, "all");
                }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 h-7 rounded-md text-xs font-medium transition-colors cursor-pointer select-none",
                  activeTab === "all"
                    ? "bg-muted text-foreground font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
              >
                <span>Tất cả</span>
                <span className="text-[11px] font-mono tabular-nums opacity-70">
                  {notifications.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("unread");
                  updateUrlParams(selectedId, "unread");
                }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 h-7 rounded-md text-xs font-medium transition-colors cursor-pointer select-none",
                  activeTab === "unread"
                    ? "bg-muted text-foreground font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
              >
                <span>Chưa đọc</span>
                {unreadCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-mono font-bold bg-primary text-primary-foreground tabular-nums leading-none">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>

            {/* Quick search input */}
            <div className="relative">
              <Search
                size={13}
                strokeWidth={1.5}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm người gửi, nội dung..."
                className="w-full h-7.5 pl-8 pr-2.5 rounded-lg border border-border/60 bg-muted/30 focus:bg-background text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-colors"
              />
            </div>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/40 thin-scrollbar">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="animate-pulse space-y-2 p-2">
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-full bg-muted" />
                      <div className="h-3 w-28 bg-muted rounded" />
                    </div>
                    <div className="h-3 w-full bg-muted/60 rounded" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="p-6 text-center space-y-2.5">
                <AlertTriangle className="size-6 text-rose-500 mx-auto" strokeWidth={1.5} />
                <p className="text-xs text-rose-600 font-medium">{error}</p>
                <Button variant="outline" size="sm" onClick={() => fetchNotifications(false)} className="text-xs h-7">
                  Thử lại
                </Button>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <InboxIcon className="size-8 text-muted-foreground/40 mx-auto" strokeWidth={1.5} />
                <p className="text-xs font-semibold text-foreground">
                  {activeTab === "unread" ? "Không có thông báo chưa đọc" : "Hộp thư trống"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {activeTab === "unread"
                    ? "Bạn đã xem hết tất cả thông báo mới."
                    : "Mọi thông báo và nhắc việc giao dịch sẽ xuất hiện ở đây."}
                </p>
              </div>
            ) : (
              filteredNotifications.map((notif) => {
                const formatted = formatNotificationContent(notif);
                const avatar = getDeterministicAvatarStyle(notif.actorName);
                const initials = getActorInitials(notif.actorName);
                const isSelected = selectedId === notif.id;

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleSelectItem(notif)}
                    className={cn(
                      "p-3 flex items-start gap-2.5 cursor-pointer transition-colors text-left relative group select-none",
                      isSelected
                        ? "bg-primary/[0.08] border-l-[3px] border-primary font-medium"
                        : notif.isRead
                        ? "hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                        : "hover:bg-muted/60 text-foreground bg-background"
                    )}
                  >
                    {/* Unread dot indicator */}
                    {!notif.isRead ? (
                      <span className="absolute left-1.5 top-4 size-1.5 rounded-full bg-primary ring-2 ring-primary/20" />
                    ) : (
                      <span className="w-1.5 shrink-0" />
                    )}

                    {/* Sender Avatar */}
                    <div
                      className={cn(
                        "size-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ring-1",
                        avatar.bg,
                        avatar.text,
                        avatar.ring
                      )}
                    >
                      {initials}
                    </div>

                    {/* Content preview */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-foreground truncate">
                          {notif.actorName}
                        </span>
                        <span className="text-[10px] text-muted-foreground/70 shrink-0 font-mono">
                          {formatRelativeTime(notif.createdAt || notif.timestamp)}
                        </span>
                      </div>

                      <p className="text-xs text-foreground/90 line-clamp-1 leading-snug">
                        <span className="text-muted-foreground">{formatted.actionText} </span>
                        <span className="font-medium text-foreground">{formatted.targetTitle}</span>
                      </p>

                      {formatted.extraBadge && (
                        <span className="inline-block text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border/50">
                          {formatted.extraBadge}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* ------------------------------------------------------- */}
        {/* RIGHT PANE: DETAIL VIEW (FLEX-1)                        */}
        {/* ------------------------------------------------------- */}
        <section
          data-slot="inbox-detail-pane"
          className={cn(
            "flex-1 flex flex-col h-full bg-card/20 overflow-y-auto thin-scrollbar",
            !selectedId ? "hidden md:flex" : "flex"
          )}
        >
          {!selectedNotification ? (
            /* Empty Selection State */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none">
              <div className="size-16 rounded-2xl bg-muted/40 border border-border/60 flex items-center justify-center text-muted-foreground/50 mb-3 shadow-2xs">
                <InboxIcon size={32} strokeWidth={1.5} />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Chưa chọn thông báo nào</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                Chọn một thông báo từ danh sách bên trái để xem nội dung chi tiết, ý kiến chỉ đạo và ngữ cảnh xử lý nhiệm vụ.
              </p>
            </div>
          ) : (
            /* Active Notification Detail Surface */
            <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto w-full">
              {/* Mobile Back Button */}
              <div className="flex md:hidden items-center justify-between pb-3 border-b border-border/50">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedId(null);
                    updateUrlParams(null);
                  }}
                  className="gap-1.5 text-xs text-muted-foreground hover:text-foreground -ml-2"
                >
                  <ArrowLeft size={14} strokeWidth={1.5} />
                  <span>Danh sách hộp thư</span>
                </Button>

                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => markAsRead(selectedNotification.id, !selectedNotification.isRead)}
                  title={selectedNotification.isRead ? "Đánh dấu chưa đọc" : "Đánh dấu đã đọc"}
                  className="size-8 text-muted-foreground hover:text-foreground"
                >
                  {selectedNotification.isRead ? <Mail size={16} /> : <MailOpen size={16} />}
                </Button>
              </div>

              {/* Header Details */}
              <div className="space-y-3 pb-4 border-b border-border/60">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs font-medium">
                        {selectedNotification.category || "Hệ thống"}
                      </Badge>
                      {selectedNotification.type && (
                        <Badge variant="sapphire" className="text-xs font-mono">
                          {selectedNotification.type.toUpperCase()}
                        </Badge>
                      )}
                    </div>
                    <h2 className="text-base sm:text-lg lg:text-xl font-bold tracking-tight text-foreground font-heading">
                      {selectedNotification.targetTitle || selectedNotification.title || "Thông báo hệ thống"}
                    </h2>
                  </div>

                  {/* Desktop Action Controls */}
                  <div className="hidden md:flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => markAsRead(selectedNotification.id, !selectedNotification.isRead)}
                      className="gap-1.5 text-xs h-8"
                    >
                      {selectedNotification.isRead ? (
                        <>
                          <Mail size={14} strokeWidth={1.5} />
                          <span>Đánh dấu chưa đọc</span>
                        </>
                      ) : (
                        <>
                          <MailOpen size={14} strokeWidth={1.5} />
                          <span>Đã đọc</span>
                        </>
                      )}
                    </Button>

                    {selectedNotification.linkHref && (
                      <Button
                        size="sm"
                        onClick={() => router.push(selectedNotification.linkHref || "/tasks")}
                        className="gap-1.5 text-xs h-8 bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        <span>Mở nhiệm vụ</span>
                        <ArrowUpRight size={14} strokeWidth={1.5} />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Sender Identity & Metadata */}
                <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
                  <div
                    className={cn(
                      "size-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ring-1",
                      getDeterministicAvatarStyle(selectedNotification.actorName).bg,
                      getDeterministicAvatarStyle(selectedNotification.actorName).text,
                      getDeterministicAvatarStyle(selectedNotification.actorName).ring
                    )}
                  >
                    {getActorInitials(selectedNotification.actorName)}
                  </div>

                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">
                      {selectedNotification.actorName}
                    </span>
                    <span className="text-[11px] text-muted-foreground/80">
                      {selectedNotification.timestamp || "Gần đây"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Body Content */}
              <div className="space-y-4 text-xs sm:text-sm text-foreground/90 leading-relaxed bg-muted/20 p-4 rounded-xl border border-border/40">
                <div className="font-medium text-foreground whitespace-pre-wrap">
                  {selectedNotification.action || selectedNotification.body || "Không có nội dung mô tả chi tiết."}
                </div>

                {formatNotificationContent(selectedNotification).directiveNote && (
                  <div className="p-3.5 rounded-lg bg-amber-50/80 border border-amber-300 text-amber-950 space-y-1">
                    <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <ShieldCheck size={14} />
                      <span>Ý kiến chỉ đạo / Ghi chú điều hành:</span>
                    </div>
                    <p className="text-xs italic">
                      "{formatNotificationContent(selectedNotification).directiveNote}"
                    </p>
                  </div>
                )}
              </div>

              {/* Context Card: Linked Task Summary (if exists) */}
              {taskContext && (
                <div className="rounded-xl border border-border/80 bg-background p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers size={15} className="text-primary" />
                      <span className="text-xs font-bold text-muted-foreground">
                        Nhiệm vụ liên quan
                      </span>
                    </div>
                    <Badge variant={taskContext.status === "COMPLETED" ? "emerald" : "sapphire"}>
                      {taskContext.status === "COMPLETED" ? "Đã hoàn thành" : "Đang thực hiện"}
                    </Badge>
                  </div>

                  <div className="space-y-1.5">
                    <h4 className="text-sm font-semibold text-foreground">
                      {taskContext.title}
                    </h4>
                    {taskContext.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {taskContext.description}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-border/40 text-xs">
                    {taskContext.dueDate && (
                      <div>
                        <span className="text-muted-foreground text-[11px] block">Hạn chót:</span>
                        <span className="font-mono font-medium text-foreground">
                          {new Date(taskContext.dueDate).toLocaleDateString("vi-VN")}
                        </span>
                      </div>
                    )}
                    {taskContext.leadAssigneeName && (
                      <div>
                        <span className="text-muted-foreground text-[11px] block">Người chịu trách nhiệm:</span>
                        <span className="font-medium text-foreground truncate block">
                          {taskContext.leadAssigneeName}
                        </span>
                      </div>
                    )}
                    {taskContext.progressPercent !== undefined && (
                      <div>
                        <span className="text-muted-foreground text-[11px] block">Tiến độ:</span>
                        <span className="font-mono font-semibold text-primary">
                          {taskContext.progressPercent}%
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => router.push(`/tasks?taskId=${taskContext.id}`)}
                      className="text-xs h-7 gap-1"
                    >
                      <span>Xem toàn bộ nhiệm vụ</span>
                      <ChevronRight size={14} />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
