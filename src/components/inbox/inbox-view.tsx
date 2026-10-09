"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Inbox as InboxIcon,
  CheckCheck,
  Check,
  Mail,
  MailOpen,
  RotateCcw,
  ListFilter,
  ArrowLeft,
  AlertTriangle,
  FileText,
  ShieldCheck,
  ArrowUpRight,
  Search,
  Bell,
  Calendar,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TaskStatusIcon } from "@/components/ui/task-status-icon";
import { PriorityIndicator } from "@/components/ui/priority-indicator";
import { getStatusLabel } from "@/domain/tasks/state-machine";
import { UserAvatar } from "@/components/ui/user-avatar";
import { MenuRoot, MenuTrigger, MenuContent, MenuItem } from "@/components/ui/menu";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/layout/sidebar-context";
import {
  QCETNotification,
  NotificationTriageTab,
  filterNotificationsByTab,
  formatNotificationContent,
  mapDbNotification,
  getTypeBadge,
} from "@/lib/notification-triage";

/** Phần nhiệm vụ lấy từ GET /api/tasks/{id} mà hộp thư cần hiển thị. */
interface InboxTask {
  id: string;
  code?: string;
  title: string;
  description?: string | null;
  status: string;
  priority?: string;
  dueDate?: string | null;
  progress?: number | null;
  leadAssignee?: { name?: string | null } | null;
  department?: { name?: string | null } | null;
}

const SYSTEM_ACTOR = "Hệ thống QCET";

/** Thời gian rút gọn kiểu Linear: 36p, 3g, 3n, rồi ngày/tháng. */
function formatShortTime(input: string | Date | undefined): string {
  if (!input) return "";
  const date = typeof input === "string" ? new Date(input) : input;
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (Number.isNaN(sec)) return "";
  if (sec < 60) return "Vừa xong";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}p`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}g`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}n`;
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

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

  // Task context cache when viewing an item
  const [taskContext, setTaskContext] = React.useState<InboxTask | null>(null);
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [isLoadingTaskContext, setIsLoadingTaskContext] = React.useState(false);

  // Keep track of item that was read during the current unread-tab session so it doesn't suddenly disappear
  const readDuringSessionIdsRef = React.useRef<Set<string>>(new Set());

  // Fetch notifications list
  const fetchNotifications = React.useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/notifications", { credentials: "include" });
      if (res.status === 401 || res.status === 403) {
        window.location.href = `/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return;
      }
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
          credentials: "include",
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
      await fetch("/api/notifications/read-all", { method: "PATCH", credentials: "include" });
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

    fetch(`/api/tasks/${encodeURIComponent(targetTaskId)}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted) return;
        setTaskContext((data?.task ?? data?.data ?? null) as InboxTask | null);
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



  // Điều hướng bàn phím trong danh sách: ↑/↓ chuyển và chọn hàng kề, Enter/Space chọn hàng hiện tại.
  const handleRowKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, item: QCETNotification) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleSelectItem(item);
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const sibling = (
      e.key === "ArrowDown" ? e.currentTarget.nextElementSibling : e.currentTarget.previousElementSibling
    ) as HTMLElement | null;
    sibling?.focus();
  };

  const selectedContent = selectedNotification ? formatNotificationContent(selectedNotification) : null;
  const selectedTitle =
    taskContext?.title ||
    selectedNotification?.targetTitle ||
    selectedNotification?.title ||
    "Thông báo hệ thống";

  return (
    <div
      data-slot="inbox-workspace"
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* Khung danh sách */}
        <aside
          data-slot="inbox-list-pane"
          className={cn(
            "h-full w-full shrink-0 flex-col border-r border-border/60 md:w-[340px] lg:w-[380px]",
            selectedId ? "hidden md:flex" : "flex"
          )}
        >
          <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border/60 px-3">
            <h1 className="text-compact font-medium text-foreground">Hộp thư</h1>

            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setIsSearchOpen((open) => !open)}
                title="Tìm kiếm"
                aria-label="Tìm kiếm thông báo"
                aria-pressed={isSearchOpen}
              >
                <Search strokeWidth={1.5} />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => fetchNotifications(true)}
                disabled={isRefreshing}
                title="Làm mới hộp thư"
                aria-label="Làm mới"
              >
                <RotateCcw strokeWidth={1.5} className={cn(isRefreshing && "animate-spin")} />
              </Button>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={markAllAsRead}
                  title="Đánh dấu tất cả là đã đọc"
                  aria-label="Đánh dấu tất cả đã đọc"
                >
                  <CheckCheck strokeWidth={1.5} />
                </Button>
              )}
              <MenuRoot>
                <MenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      title="Lọc"
                      aria-label="Lọc thông báo"
                      className={cn(
                        (categoryFilter !== "all" || activeTab === "unread") && "bg-accent text-foreground"
                      )}
                    />
                  }
                >
                  <ListFilter strokeWidth={1.5} />
                </MenuTrigger>
                <MenuContent align="end" className="w-56">
                  <MenuItem
                    onClick={() => {
                      const next = activeTab === "unread" ? "all" : "unread";
                      setActiveTab(next);
                      updateUrlParams(selectedId, next);
                    }}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs outline-none data-[highlighted]:bg-accent"
                  >
                    <MailOpen size={14} strokeWidth={1.5} className="shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">Chỉ chưa đọc</span>
                    <span className="tabular-nums text-muted-foreground">{unreadCount}</span>
                    {activeTab === "unread" && <Check size={14} strokeWidth={1.5} className="shrink-0" />}
                  </MenuItem>
                  <div role="separator" className="-mx-1 my-1 h-px bg-border" />
                  {CATEGORY_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <MenuItem
                        key={opt.id}
                        onClick={() => setCategoryFilter(opt.id)}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs outline-none data-[highlighted]:bg-accent"
                      >
                        <Icon size={14} strokeWidth={1.5} className="shrink-0 text-muted-foreground" />
                        <span className="flex-1 truncate">{opt.label}</span>
                        {categoryFilter === opt.id && <Check size={14} strokeWidth={1.5} className="shrink-0" />}
                      </MenuItem>
                    );
                  })}
                </MenuContent>
              </MenuRoot>
            </div>
          </div>

          {isSearchOpen && (
            <div className="relative shrink-0 px-3 py-2">
              <Search
                className="pointer-events-none absolute left-5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                strokeWidth={1.5}
              />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm trong hộp thư"
                aria-label="Tìm kiếm thông báo"
                className="h-7 w-full rounded-md bg-secondary pl-7 pr-7 text-xs text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Xóa từ khóa"
                  className="absolute right-5 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" strokeWidth={1.5} />
                </button>
              )}
            </div>
          )}

          <div
            role="listbox"
            aria-label="Danh sách thông báo"
            className="thin-scrollbar flex-1 space-y-0.5 overflow-y-auto p-1.5"
          >
            {isLoading ? (
              <div className="space-y-1 p-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex animate-pulse items-start gap-2.5 px-2 py-2">
                    <div className="size-6 rounded-full bg-muted" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-2/3 rounded bg-muted" />
                      <div className="h-3 w-full rounded bg-muted/60" />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="space-y-2 p-6 text-center">
                <AlertTriangle className="mx-auto size-5 text-destructive" strokeWidth={1.5} />
                <p className="text-xs text-destructive">{error}</p>
                <Button variant="outline" size="sm" onClick={() => fetchNotifications(false)}>
                  Thử lại
                </Button>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="space-y-1 p-8 text-center">
                <InboxIcon className="mx-auto mb-2 size-6 text-muted-foreground/50" strokeWidth={1.5} />
                <p className="text-compact font-medium text-foreground">
                  {activeTab === "unread" ? "Không có thông báo chưa đọc" : "Hộp thư trống"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {activeTab === "unread"
                    ? "Bạn đã xem hết tất cả thông báo mới."
                    : "Mọi thông báo và nhắc việc giao dịch sẽ xuất hiện ở đây."}
                </p>
              </div>
            ) : (
              filteredNotifications.map((notif) => {
                const formatted = formatNotificationContent(notif);
                const isSelected = selectedId === notif.id;
                const isSystem = notif.actorName === SYSTEM_ACTOR;
                const TypeIcon = getTypeBadge(notif.type).icon;
                const reason = isSystem
                  ? formatted.actionText
                  : `${notif.actorName} ${formatted.actionText}`.trim();

                return (
                  <div
                    key={notif.id}
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={0}
                    onClick={() => handleSelectItem(notif)}
                    onKeyDown={(e) => handleRowKeyDown(e, notif)}
                    className={cn(
                      "flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-left outline-none transition-colors focus-visible:bg-accent",
                      isSelected ? "bg-accent" : "hover:bg-accent/50"
                    )}
                  >
                    {isSystem ? (
                      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                        <TypeIcon size={14} strokeWidth={1.5} />
                      </span>
                    ) : (
                      <UserAvatar name={notif.actorName} size="md" className="mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {!notif.isRead && (
                          <span aria-label="Chưa đọc" className="size-1.5 shrink-0 rounded-full bg-primary" />
                        )}
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate text-compact",
                            notif.isRead ? "text-muted-foreground" : "font-medium text-foreground"
                          )}
                        >
                          {formatted.targetTitle || notif.actorName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{reason}</p>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {formatShortTime(notif.createdAt || notif.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Khung chi tiết */}
        <section
          data-slot="inbox-detail-pane"
          className={cn("h-full min-w-0 flex-1 flex-col bg-card", !selectedId ? "hidden md:flex" : "flex")}
        >
          {!selectedNotification || !selectedContent ? (
            <>
              <div className="h-11 shrink-0 border-b border-border/60" aria-hidden />
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                <InboxIcon className="size-12 text-muted-foreground/60" strokeWidth={1.5} />
                <p className="text-compact text-muted-foreground">Chưa chọn thông báo nào</p>
              </div>
            </>
          ) : (
            <>
              <header className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border/60 px-3">
                <div className="flex min-w-0 items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="md:hidden"
                    onClick={() => {
                      setSelectedId(null);
                      updateUrlParams(null);
                    }}
                    aria-label="Quay lại danh sách hộp thư"
                  >
                    <ArrowLeft strokeWidth={1.5} />
                  </Button>
                  {taskContext?.code && (
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{taskContext.code}</span>
                  )}
                  <span className="truncate text-xs text-foreground">{selectedTitle}</span>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => markAsRead(selectedNotification.id, !selectedNotification.isRead)}
                    title={selectedNotification.isRead ? "Đánh dấu chưa đọc" : "Đánh dấu đã đọc"}
                    aria-label={selectedNotification.isRead ? "Đánh dấu chưa đọc" : "Đánh dấu đã đọc"}
                  >
                    {selectedNotification.isRead ? <Mail strokeWidth={1.5} /> : <MailOpen strokeWidth={1.5} />}
                  </Button>
                  {selectedNotification.linkHref && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => router.push(selectedNotification.linkHref || "/tasks")}
                    >
                      Mở nhiệm vụ
                      <ArrowUpRight strokeWidth={1.5} />
                    </Button>
                  )}
                </div>
              </header>

              <div className="thin-scrollbar flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-3xl px-6 pb-10 pt-6">
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">{selectedTitle}</h2>

                  {/* Thuộc tính nhiệm vụ: dạng chip một hàng như Linear */}
                  {isLoadingTaskContext && !taskContext ? (
                    <div className="mt-3 h-7 w-2/3 animate-pulse rounded bg-muted" />
                  ) : taskContext ? (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-foreground">
                      <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border/70 px-2">
                        <TaskStatusIcon status={taskContext.status} size={14} />
                        {getStatusLabel(taskContext.status)}
                      </span>
                      {taskContext.priority && (
                        <span className="inline-flex h-7 items-center rounded-md border border-border/70 px-2">
                          <PriorityIndicator priority={taskContext.priority} showLabel />
                        </span>
                      )}
                      {taskContext.dueDate && (
                        <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border/70 px-2 tabular-nums">
                          <Calendar size={14} strokeWidth={1.5} className="text-muted-foreground" />
                          {new Date(taskContext.dueDate).toLocaleDateString("vi-VN")}
                        </span>
                      )}
                      {taskContext.leadAssignee?.name && (
                        <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border/70 px-2">
                          <UserAvatar name={taskContext.leadAssignee.name} size="sm" />
                          {taskContext.leadAssignee.name}
                        </span>
                      )}
                      {taskContext.department?.name && (
                        <span className="inline-flex h-7 items-center rounded-md border border-border/70 px-2 text-muted-foreground">
                          {taskContext.department.name}
                        </span>
                      )}
                    </div>
                  ) : null}

                  {taskContext?.description ? (
                    <p className="mt-5 whitespace-pre-wrap text-compact leading-relaxed text-foreground/90">
                      {taskContext.description}
                    </p>
                  ) : (
                    selectedNotification.body &&
                    selectedNotification.body !== selectedContent.actionText && (
                      <p className="mt-5 whitespace-pre-wrap text-compact leading-relaxed text-foreground/90">
                        {selectedNotification.body}
                      </p>
                    )
                  )}

                  {selectedContent.directiveNote && (
                    <div className="mt-5 space-y-1 rounded-md border border-amber-300 bg-amber-50/80 p-3 text-amber-950">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-amber-900">
                        <ShieldCheck size={14} strokeWidth={1.5} />
                        <span>Ý kiến chỉ đạo / Ghi chú điều hành</span>
                      </div>
                      <p className="text-xs italic">&quot;{selectedContent.directiveNote}&quot;</p>
                    </div>
                  )}

                  {/* Hoạt động: chính thông báo này */}
                  <div className="mt-8 border-t border-border/60 pt-4">
                    <div className="mb-3 text-compact font-medium text-foreground">Hoạt động</div>
                    <div className="flex items-start gap-2.5">
                      {selectedNotification.actorName === SYSTEM_ACTOR ? (
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                          <Bell size={14} strokeWidth={1.5} />
                        </span>
                      ) : (
                        <UserAvatar name={selectedNotification.actorName} size="md" />
                      )}
                      <p className="min-w-0 pt-0.5 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{selectedNotification.actorName}</span>{" "}
                        {selectedContent.actionText} · {selectedNotification.timestamp || "Gần đây"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
