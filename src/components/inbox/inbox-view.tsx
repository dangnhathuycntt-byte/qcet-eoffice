"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Inbox as InboxIcon,
  ArrowLeft,
  ArrowUpRight,
  Calendar,
  Check,
  CheckCheck,
  ListFilter,
  Mail,
  MailOpen,
  MoreHorizontal,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskStatusIcon } from "@/components/ui/task-status-icon";
import { PriorityIndicator } from "@/components/ui/priority-indicator";
import { UserAvatar } from "@/components/ui/user-avatar";
import { MenuRoot, MenuTrigger, MenuContent, MenuItem } from "@/components/ui/menu";
import { getStatusLabel } from "@/domain/tasks/state-machine";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/layout/sidebar-context";
import {
  getTypeBadge,
  mapDbNotification,
  parseTriageTab,
  type NotificationTriageTab,
  type QCETNotification,
} from "@/lib/notification-triage";
import {
  formatNotificationAbsoluteTime,
  formatNotificationTime,
  getNotificationDisplayTitle,
  getNotificationEventLabel,
  groupNotificationsByTarget,
  type NotificationGroup,
} from "@/lib/notification-inbox";

/** Phần nhiệm vụ lấy từ GET /api/tasks/{id} mà hộp thư cần hiển thị. */
interface InboxTask {
  id: string;
  code?: string;
  title: string;
  status: string;
  priority?: string;
  dueDate?: string | null;
  leadAssignee?: { name?: string | null } | null;
  department?: { name?: string | null } | null;
}

type ReadFilter = "all" | "unread";

const PAGE_SIZE = 30;
const WIDE_MIN_WIDTH = 920;

/** "Chờ phê duyệt" chưa có nguồn tạo thông báo nên không đưa lên UI. */
const CATEGORY_OPTIONS: { id: NotificationTriageTab; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "action_required", label: "Việc cần làm" },
  { id: "reminders", label: "Nhắc hạn" },
];

const MENU_ITEM_CLASS =
  "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs outline-none data-[highlighted]:bg-accent data-[disabled]:cursor-default data-[disabled]:opacity-50";

function parseCategory(value: string | null): NotificationTriageTab {
  const tab = parseTriageTab(value);
  return CATEGORY_OPTIONS.some((opt) => opt.id === tab) ? tab : "all";
}

/** Đọc envelope API; lỗi HTTP hoặc `success: false` đều ném lỗi. */
async function readEnvelope(res: Response): Promise<any> {
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.success === false) {
    const message = typeof json?.error === "string" ? json.error : json?.error?.message;
    throw new Error(message || `HTTP ${res.status}`);
  }
  return json;
}

function useNow(intervalMs: number): Date {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function toIso(value: string | Date | undefined): string | undefined {
  if (!value) return undefined;
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function relativeLabel(value: string | Date | undefined, now: Date): string {
  const short = formatNotificationTime(value, now);
  return /(phút|giờ|ngày)$/.test(short) ? `${short} trước` : short;
}

export function InboxView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setBadgeCounts } = useSidebar();
  const now = useNow(60_000);

  // URL là nguồn trạng thái cho lựa chọn, bộ lọc và từ khóa.
  const readFilter: ReadFilter = searchParams?.get("filter") === "unread" ? "unread" : "all";
  const category = parseCategory(searchParams?.get("category") ?? null);
  const urlQuery = (searchParams?.get("q") ?? "").trim().slice(0, 100);
  const selectedId = searchParams?.get("id") || null;
  const hasCondition = Boolean(urlQuery) || category !== "all";

  const [items, setItems] = React.useState<QCETNotification[]>([]);
  const [unreadCount, setUnreadCount] = React.useState<number | null>(null);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [refreshError, setRefreshError] = React.useState(false);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [loadMoreError, setLoadMoreError] = React.useState(false);
  const [announcement, setAnnouncement] = React.useState("");
  const [pendingIds, setPendingIds] = React.useState<ReadonlySet<string>>(new Set());
  const [isMarkingAll, setIsMarkingAll] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(Boolean(urlQuery));
  const [queryInput, setQueryInput] = React.useState(urlQuery);
  const [isWide, setIsWide] = React.useState(true);
  const [focusKey, setFocusKey] = React.useState<string | null>(null);
  const [remote, setRemote] = React.useState<{
    id: string;
    state: "loading" | "ready" | "missing" | "error";
    notification?: QCETNotification;
  } | null>(null);
  const [remoteAttempt, setRemoteAttempt] = React.useState(0);
  const [taskCtx, setTaskCtx] = React.useState<{
    id: string;
    state: "loading" | "ready" | "denied" | "error";
    task?: InboxTask;
  } | null>(null);

  const rootRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const seqRef = React.useRef(0);
  const pendingRef = React.useRef(new Set<string>());
  const markingAllRef = React.useRef(false);
  const autoReadRef = React.useRef(new Set<string>());
  const pushedRef = React.useRef(false);
  const restoreFocusRef = React.useRef<string | null>(null);
  const committedQueryRef = React.useRef(urlQuery);

  const navigate = React.useCallback(
    (
      patch: { id?: string | null; filter?: ReadFilter; category?: NotificationTriageTab; q?: string },
      mode: "push" | "replace" = "replace"
    ) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      const set = (key: string, value: string | null | undefined) =>
        value ? params.set(key, value) : params.delete(key);
      if ("id" in patch) set("id", patch.id);
      if ("filter" in patch) set("filter", patch.filter === "unread" ? "unread" : null);
      if ("category" in patch) set("category", patch.category !== "all" ? patch.category : null);
      if ("q" in patch) set("q", patch.q?.trim());
      const qs = params.toString();
      router[mode](qs ? `/inbox?${qs}` : "/inbox", { scroll: false });
    },
    [router, searchParams]
  );

  const syncUnread = React.useCallback(
    (count: number) => {
      setUnreadCount(count);
      setBadgeCounts((prev) => ({ ...prev, notifications: count }));
    },
    [setBadgeCounts]
  );

  const listQuery = React.useCallback(
    (cursor?: string | null) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (readFilter === "unread") params.set("unreadOnly", "true");
      if (category !== "all") params.set("triage", category);
      if (urlQuery) params.set("q", urlQuery);
      if (cursor) params.set("cursor", cursor);
      return params.toString();
    },
    [readFilter, category, urlQuery]
  );

  const loadList = React.useCallback(
    async (mode: "reset" | "refresh") => {
      const seq = ++seqRef.current;
      if (mode === "reset") {
        setStatus("loading");
        setItems([]);
        setNextCursor(null);
      }
      setRefreshError(false);
      setLoadMoreError(false);
      try {
        const res = await fetch(`/api/notifications?${listQuery()}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (res.status === 401) {
          window.location.href = `/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`;
          return;
        }
        const json = await readEnvelope(res);
        if (seq !== seqRef.current) return;
        if (!Array.isArray(json.notifications)) throw new Error("Dữ liệu thông báo không hợp lệ");
        setItems(json.notifications.map(mapDbNotification));
        setNextCursor(json.hasMore ? (json.nextCursor ?? null) : null);
        if (typeof json.unreadCount === "number") syncUnread(json.unreadCount);
        setStatus("ready");
      } catch {
        if (seq !== seqRef.current) return;
        if (mode === "reset") setStatus("error");
        else setRefreshError(true);
      }
    },
    [listQuery, syncUnread]
  );

  React.useEffect(() => {
    void loadList("reset");
  }, [loadList]);

  const loadMore = async () => {
    if (!nextCursor || isLoadingMore) return;
    const seq = seqRef.current;
    setIsLoadingMore(true);
    setLoadMoreError(false);
    try {
      const res = await fetch(`/api/notifications?${listQuery(nextCursor)}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = await readEnvelope(res);
      if (seq !== seqRef.current) return;
      const more: QCETNotification[] = (json.notifications ?? []).map(mapDbNotification);
      setItems((prev) => {
        const ids = new Set(prev.map((n) => n.id));
        return [...prev, ...more.filter((n) => !ids.has(n.id))];
      });
      setNextCursor(json.hasMore ? (json.nextCursor ?? null) : null);
    } catch {
      if (seq === seqRef.current) setLoadMoreError(true);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const refreshUnreadCount = React.useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=1", { credentials: "include", cache: "no-store" });
      const json = await readEnvelope(res);
      if (typeof json.unreadCount === "number") syncUnread(json.unreadCount);
    } catch {
      // Giữ số hiện tại; lần tải sau sẽ đồng bộ lại.
    }
  }, [syncUnread]);

  // Đồng bộ ô tìm kiếm với URL (Back/Forward) và ghi URL sau khi gõ 250ms.
  React.useEffect(() => {
    if (urlQuery !== committedQueryRef.current) {
      committedQueryRef.current = urlQuery;
      setQueryInput(urlQuery);
      if (urlQuery) setSearchOpen(true);
    }
  }, [urlQuery]);

  React.useEffect(() => {
    const q = queryInput.trim();
    if (q === committedQueryRef.current) return;
    const timer = window.setTimeout(() => {
      committedQueryRef.current = q;
      navigate({ q });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [queryInput, navigate]);

  // Hai pane khi vùng Inbox đủ rộng, ngược lại một pane.
  React.useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setIsWide(entry.contentRect.width >= WIDE_MIN_WIDTH));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const groups = React.useMemo(() => groupNotificationsByTarget(items), [items]);
  const groupFromList = React.useMemo(
    () => (selectedId ? (groups.find((g) => g.items.some((n) => n.id === selectedId)) ?? null) : null),
    [groups, selectedId]
  );
  const inList = Boolean(groupFromList);

  // Deep link ngoài các trang đã tải: resolve theo ID, độc lập với danh sách.
  React.useEffect(() => {
    if (!selectedId || inList) return;
    let active = true;
    setRemote({ id: selectedId, state: "loading" });
    fetch(`/api/notifications/${encodeURIComponent(selectedId)}`, { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        if (res.status === 404) {
          if (active) setRemote({ id: selectedId, state: "missing" });
          return;
        }
        const json = await readEnvelope(res);
        if (active) setRemote({ id: selectedId, state: "ready", notification: mapDbNotification(json.notification) });
      })
      .catch(() => {
        if (active) setRemote({ id: selectedId, state: "error" });
      });
    return () => {
      active = false;
    };
  }, [selectedId, inList, remoteAttempt]);

  const remoteGroup = React.useMemo(
    () =>
      remote?.id === selectedId && remote.notification
        ? groupNotificationsByTarget([remote.notification])[0]
        : null,
    [remote, selectedId]
  );
  const selectedGroup = groupFromList ?? remoteGroup;
  const detailState: "none" | "ready" | "loading" | "missing" | "error" = !selectedId
    ? "none"
    : selectedGroup
      ? "ready"
      : remote?.id === selectedId && remote.state !== "ready"
        ? remote.state
        : "loading";

  // Tab Chưa đọc: giữ lại nhóm đang mở cho tới khi chuyển lựa chọn.
  const visibleGroups = React.useMemo(
    () =>
      readFilter === "unread"
        ? groups.filter((g) => g.unreadIds.length > 0 || g.key === groupFromList?.key)
        : groups,
    [groups, readFilter, groupFromList]
  );

  const setReadLocal = React.useCallback((ids: string[], isRead: boolean) => {
    const set = new Set(ids);
    setItems((prev) => prev.map((n) => (set.has(n.id) ? { ...n, isRead } : n)));
    setRemote((prev) =>
      prev?.notification && set.has(prev.notification.id)
        ? { ...prev, notification: { ...prev.notification, isRead } }
        : prev
    );
  }, []);

  const markRead = React.useCallback(
    async (ids: string[], isRead: boolean) => {
      const targets = ids.filter((id) => !pendingRef.current.has(id));
      if (!targets.length || markingAllRef.current) return;
      targets.forEach((id) => pendingRef.current.add(id));
      setPendingIds(new Set(pendingRef.current));
      setReadLocal(targets, isRead);

      const results = await Promise.allSettled(
        targets.map((id) =>
          fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ isRead }),
          }).then(readEnvelope)
        )
      );
      const failed = targets.filter((_, i) => results[i].status === "rejected");
      if (failed.length) {
        setReadLocal(failed, !isRead);
        setAnnouncement("Không thể cập nhật trạng thái đã đọc. Vui lòng thử lại.");
      }
      targets.forEach((id) => pendingRef.current.delete(id));
      setPendingIds(new Set(pendingRef.current));
      void refreshUnreadCount();
    },
    [refreshUnreadCount, setReadLocal]
  );

  const markAllRead = async () => {
    if (markingAllRef.current || pendingRef.current.size > 0) return;
    markingAllRef.current = true;
    setIsMarkingAll(true);
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await fetch("/api/notifications/read-all", { method: "POST", credentials: "include" }).then(readEnvelope);
      setAnnouncement("Đã đánh dấu tất cả thông báo là đã đọc.");
    } catch {
      setAnnouncement("Không thể đánh dấu tất cả đã đọc. Vui lòng thử lại.");
    } finally {
      markingAllRef.current = false;
      setIsMarkingAll(false);
      void loadList("refresh");
    }
  };

  // Mở một nhóm là đã đọc mọi thông báo chưa đọc của nhóm (mỗi ID chỉ tự đánh dấu một lần).
  React.useEffect(() => {
    if (!selectedGroup) return;
    const ids = selectedGroup.unreadIds.filter((id) => !autoReadRef.current.has(id));
    if (!ids.length) return;
    ids.forEach((id) => autoReadRef.current.add(id));
    void markRead(ids, true);
  }, [selectedGroup, markRead]);

  // Thuộc tính hiện tại của nhiệm vụ liên quan; reset theo task ID.
  const taskId =
    selectedGroup?.target?.kind === "task" ? selectedGroup.target.taskId : undefined;
  React.useEffect(() => {
    if (!taskId) return;
    let active = true;
    setTaskCtx({ id: taskId, state: "loading" });
    fetch(`/api/tasks/${encodeURIComponent(taskId)}`, { credentials: "include" })
      .then(async (res) => {
        if (res.status === 403 || res.status === 404) {
          if (active) setTaskCtx({ id: taskId, state: "denied" });
          return;
        }
        const json = await readEnvelope(res);
        if (active) setTaskCtx({ id: taskId, state: "ready", task: (json.task ?? json.data ?? undefined) as InboxTask });
      })
      .catch(() => {
        if (active) setTaskCtx({ id: taskId, state: "error" });
      });
    return () => {
      active = false;
    };
  }, [taskId]);
  const ctx = taskId ? (taskCtx?.id === taskId ? taskCtx : { id: taskId, state: "loading" as const }) : null;

  const focusRow = (key: string | undefined) => {
    if (!key) return;
    listRef.current?.querySelector<HTMLElement>(`[data-group-key="${CSS.escape(key)}"]`)?.focus();
  };

  const openGroup = (group: NotificationGroup) => {
    if (group.items.some((n) => n.id === selectedId)) return;
    if (!selectedId) {
      pushedRef.current = true;
      navigate({ id: group.latest.id }, "push");
    } else {
      navigate({ id: group.latest.id });
    }
  };

  const closeDetail = () => {
    restoreFocusRef.current = selectedGroup?.key ?? null;
    if (pushedRef.current) {
      pushedRef.current = false;
      router.back();
    } else {
      navigate({ id: null });
    }
  };

  // Trả focus về hàng vừa xem khi quay lại danh sách (chế độ một pane).
  React.useEffect(() => {
    if (selectedId || !restoreFocusRef.current) return;
    const key = restoreFocusRef.current;
    restoreFocusRef.current = null;
    requestAnimationFrame(() => focusRow(key));
  }, [selectedId]);

  const activeKey =
    (focusKey && visibleGroups.some((g) => g.key === focusKey) && focusKey) ||
    (groupFromList && visibleGroups.some((g) => g.key === groupFromList.key) && groupFromList.key) ||
    visibleGroups[0]?.key;

  const handleRowKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, index: number) => {
    const group = visibleGroups[index];
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openGroup(group);
      return;
    }
    let nextIndex: number | null = null;
    if (event.key === "ArrowDown" || event.key === "j") nextIndex = Math.min(index + 1, visibleGroups.length - 1);
    if (event.key === "ArrowUp" || event.key === "k") nextIndex = Math.max(index - 1, 0);
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = visibleGroups.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    focusRow(visibleGroups[nextIndex]?.key);
  };

  const handleRootKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
      event.preventDefault();
      setSearchOpen(true);
      requestAnimationFrame(() => searchInputRef.current?.focus());
      return;
    }
    if (event.key === "Escape" && !event.defaultPrevented && !isWide && selectedId) {
      event.preventDefault();
      closeDetail();
    }
  };

  const clearConditions = () => {
    committedQueryRef.current = "";
    setQueryInput("");
    setSearchOpen(false);
    navigate({ q: "", category: "all" });
  };

  const showList = isWide || !selectedId;
  const showDetail = isWide || Boolean(selectedId);
  const activeCategoryLabel = CATEGORY_OPTIONS.find((opt) => opt.id === category)?.label;

  return (
    <div
      ref={rootRef}
      data-slot="inbox-workspace"
      onKeyDown={handleRootKeyDown}
      className="flex min-h-0 flex-1 overflow-hidden"
    >
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {showList && (
        <aside
          data-slot="inbox-list-pane"
          className={cn(
            "flex min-h-0 flex-col",
            isWide ? "w-[440px] shrink-0 border-r border-border/60" : "w-full"
          )}
        >
          <div className="flex h-10 shrink-0 items-center gap-1 px-3">
            <h1 className="text-compact font-medium text-foreground">Hộp thư</h1>
            <MenuRoot>
              <MenuTrigger
                render={<Button variant="ghost" size="icon-xs" aria-label="Tùy chọn hộp thư" title="Tùy chọn" />}
              >
                <MoreHorizontal strokeWidth={1.5} />
              </MenuTrigger>
              <MenuContent align="start" className="w-60">
                <MenuItem
                  disabled={!unreadCount || isMarkingAll || pendingIds.size > 0}
                  onClick={() => void markAllRead()}
                  className={MENU_ITEM_CLASS}
                >
                  <CheckCheck size={14} strokeWidth={1.5} className="shrink-0 text-muted-foreground" />
                  <span className="flex-1">Đánh dấu tất cả đã đọc</span>
                </MenuItem>
                <p className="px-2 pb-1 pl-8 text-xs text-muted-foreground">Áp dụng cho toàn bộ hộp thư</p>
                <MenuItem onClick={() => void loadList("refresh")} className={MENU_ITEM_CLASS}>
                  <RotateCcw size={14} strokeWidth={1.5} className="shrink-0 text-muted-foreground" />
                  <span className="flex-1">Làm mới</span>
                </MenuItem>
              </MenuContent>
            </MenuRoot>

            <div className="ml-auto flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Tìm kiếm thông báo"
                title="Tìm kiếm (Ctrl/⌘ F)"
                aria-pressed={searchOpen}
                onClick={() => {
                  setSearchOpen((open) => !open);
                  requestAnimationFrame(() => searchInputRef.current?.focus());
                }}
              >
                <Search strokeWidth={1.5} />
              </Button>
              <MenuRoot>
                <MenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Lọc thông báo"
                      title="Lọc"
                      className={cn((readFilter === "unread" || category !== "all") && "bg-accent text-foreground")}
                    />
                  }
                >
                  <ListFilter strokeWidth={1.5} />
                </MenuTrigger>
                <MenuContent align="end" className="w-56">
                  <MenuItem
                    onClick={() => navigate({ filter: readFilter === "unread" ? "all" : "unread" })}
                    className={MENU_ITEM_CLASS}
                  >
                    <MailOpen size={14} strokeWidth={1.5} className="shrink-0 text-muted-foreground" />
                    <span className="flex-1">Chỉ chưa đọc</span>
                    {unreadCount !== null && (
                      <span className="tabular-nums text-muted-foreground">{unreadCount}</span>
                    )}
                    {readFilter === "unread" && <Check size={14} strokeWidth={1.5} className="shrink-0" />}
                  </MenuItem>
                  <div role="separator" className="-mx-1 my-1 h-px bg-border" />
                  {CATEGORY_OPTIONS.map((opt) => (
                    <MenuItem key={opt.id} onClick={() => navigate({ category: opt.id })} className={MENU_ITEM_CLASS}>
                      <span className="flex-1 pl-[22px]">{opt.label}</span>
                      {category === opt.id && <Check size={14} strokeWidth={1.5} className="shrink-0" />}
                    </MenuItem>
                  ))}
                </MenuContent>
              </MenuRoot>
            </div>
          </div>

          {searchOpen && (
            <div className="relative shrink-0 px-3 pb-2">
              <Search
                className="pointer-events-none absolute left-5 top-3.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                strokeWidth={1.5}
              />
              <input
                ref={searchInputRef}
                type="text"
                value={queryInput}
                maxLength={100}
                onChange={(e) => setQueryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Escape") return;
                  e.preventDefault();
                  e.stopPropagation();
                  if (queryInput) setQueryInput("");
                  else setSearchOpen(false);
                }}
                placeholder="Tìm trong hộp thư"
                aria-label="Tìm kiếm thông báo"
                className="h-7 w-full rounded-md bg-secondary pl-7 pr-7 text-xs text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
              {queryInput && (
                <button
                  type="button"
                  onClick={() => setQueryInput("")}
                  aria-label="Xóa từ khóa"
                  className="absolute right-3 top-0 flex size-7 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" strokeWidth={1.5} />
                </button>
              )}
            </div>
          )}

          {(readFilter === "unread" || category !== "all") && (
            <div className="flex shrink-0 flex-wrap items-center gap-1 px-3 pb-2">
              {readFilter === "unread" && (
                <FilterChip label="Chưa đọc" onRemove={() => navigate({ filter: "all" })} />
              )}
              {category !== "all" && activeCategoryLabel && (
                <FilterChip label={activeCategoryLabel} onRemove={() => navigate({ category: "all" })} />
              )}
            </div>
          )}

          {refreshError && (
            <div className="flex shrink-0 items-center gap-2 px-3 pb-2 text-xs text-muted-foreground">
              <span className="flex-1">Chưa cập nhật được hộp thư.</span>
              <Button variant="ghost" size="xs" onClick={() => void loadList("refresh")}>
                Thử lại
              </Button>
            </div>
          )}

          <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
            {status === "loading" ? (
              <div aria-hidden className="space-y-0.5">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex animate-pulse items-center gap-2.5 py-1.5 pl-3 pr-2.5">
                    <div className="size-5 rounded-full bg-muted" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-2/3 rounded bg-muted" />
                      <div className="h-2.5 w-1/3 rounded bg-muted/60" />
                    </div>
                  </div>
                ))}
              </div>
            ) : status === "error" ? (
              <QuietState
                title="Không tải được hộp thư"
                action={{ label: "Thử lại", onClick: () => void loadList("reset") }}
              />
            ) : visibleGroups.length === 0 ? (
              hasCondition ? (
                <QuietState title="Không có kết quả" action={{ label: "Xóa bộ lọc", onClick: clearConditions }} />
              ) : readFilter === "unread" ? (
                <QuietState title="Đã đọc hết" action={{ label: "Xem tất cả", onClick: () => navigate({ filter: "all" }) }} />
              ) : (
                <QuietState title="Không có thông báo" />
              )
            ) : (
              <>
                <div ref={listRef} role="listbox" aria-label="Danh sách thông báo" className="space-y-0.5">
                  {visibleGroups.map((group, index) => (
                    <InboxRow
                      key={group.key}
                      group={group}
                      now={now}
                      selected={group.key === selectedGroup?.key}
                      tabIndex={group.key === activeKey ? 0 : -1}
                      onOpen={() => openGroup(group)}
                      onFocus={() => setFocusKey(group.key)}
                      onKeyDown={(e) => handleRowKeyDown(e, index)}
                    />
                  ))}
                </div>
                {(nextCursor || loadMoreError) && (
                  <div className="flex items-center justify-center gap-2 pt-2 text-xs text-muted-foreground">
                    {loadMoreError && <span>Không tải thêm được.</span>}
                    <Button variant="ghost" size="xs" disabled={isLoadingMore} onClick={() => void loadMore()}>
                      {isLoadingMore ? "Đang tải…" : loadMoreError ? "Thử lại" : "Tải thêm"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </aside>
      )}

      {showDetail && (
        <section data-slot="inbox-detail-pane" className="flex min-h-0 min-w-0 flex-1 flex-col bg-card">
          {detailState === "none" ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
              <InboxIcon className="size-6 text-muted-foreground/50" strokeWidth={1.5} />
              <p className="text-xs text-muted-foreground">Chọn một thông báo để xem</p>
            </div>
          ) : (
            <>
              <header className="flex h-10 shrink-0 items-center gap-1.5 border-b border-border/60 px-3">
                {!isWide && (
                  <Button variant="ghost" size="icon-xs" onClick={closeDetail} aria-label="Quay lại hộp thư">
                    <ArrowLeft strokeWidth={1.5} />
                  </Button>
                )}
                <span className="truncate text-xs text-muted-foreground">
                  {selectedGroup?.target?.kindLabel ?? "Thông báo"}
                  {ctx?.state === "ready" && ctx.task?.code ? ` · ${ctx.task.code}` : ""}
                </span>
                {selectedGroup && (
                  <div className="ml-auto flex shrink-0 items-center gap-1">
                    <ReadToggle
                      group={selectedGroup}
                      disabled={selectedGroup.items.some((n) => pendingIds.has(n.id)) || isMarkingAll}
                      onToggle={(ids, isRead) => void markRead(ids, isRead)}
                    />
                    {selectedGroup.target && (
                      <Button variant="ghost" size="sm" onClick={() => router.push(selectedGroup.target!.href)}>
                        {selectedGroup.target.ctaLabel}
                        <ArrowUpRight strokeWidth={1.5} />
                      </Button>
                    )}
                  </div>
                )}
              </header>

              <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto">
                {detailState === "ready" && selectedGroup ? (
                  <InboxDetail group={selectedGroup} now={now} ctx={ctx} />
                ) : detailState === "loading" ? (
                  <div aria-hidden className="mx-auto w-full max-w-3xl animate-pulse space-y-3 px-6 py-6">
                    <div className="h-6 w-2/3 rounded bg-muted" />
                    <div className="h-3 w-1/3 rounded bg-muted/60" />
                  </div>
                ) : (
                  <QuietState
                    title={detailState === "missing" ? "Không thể mở thông báo này" : "Không tải được thông báo"}
                    action={
                      detailState === "missing"
                        ? { label: "Quay lại hộp thư", onClick: () => navigate({ id: null }) }
                        : { label: "Thử lại", onClick: () => setRemoteAttempt((n) => n + 1) }
                    }
                  />
                )}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}

function InboxRow({
  group,
  now,
  selected,
  tabIndex,
  onOpen,
  onFocus,
  onKeyDown,
}: {
  group: NotificationGroup;
  now: Date;
  selected: boolean;
  tabIndex: number;
  onOpen: () => void;
  onFocus: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
}) {
  const n = group.latest;
  const unread = group.unreadIds.length > 0;
  const title = getNotificationDisplayTitle(n);
  const event = getNotificationEventLabel(n.type);
  const secondary = [event, n.hasActor ? n.actorName : null, group.items.length > 1 ? `${group.items.length} cập nhật` : null]
    .filter(Boolean)
    .join(" · ");
  const absolute = formatNotificationAbsoluteTime(n.createdAt);
  const TypeIcon = getTypeBadge(n.type).icon;

  return (
    <div
      role="option"
      aria-selected={selected}
      aria-label={[unread ? "Chưa đọc" : null, title, secondary, absolute].filter(Boolean).join(". ")}
      tabIndex={tabIndex}
      data-group-key={group.key}
      onClick={onOpen}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      className={cn(
        "relative flex cursor-pointer items-center gap-2.5 rounded-md py-1.5 pl-3 pr-2.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "bg-selected" : "hover:bg-accent"
      )}
    >
      {unread && (
        <span aria-hidden className="absolute left-1 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-primary" />
      )}
      {n.hasActor ? (
        <UserAvatar name={n.actorName} size="sm" />
      ) : (
        <span
          aria-hidden
          className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground"
        >
          <TypeIcon size={12} strokeWidth={1.5} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-compact", unread ? "font-medium text-foreground" : "text-foreground/80")}>
          {title}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="min-w-0 flex-1 truncate">{secondary}</span>
          <time dateTime={toIso(n.createdAt)} title={absolute} className="shrink-0 tabular-nums">
            {formatNotificationTime(n.createdAt, now)}
          </time>
        </div>
      </div>
    </div>
  );
}

function ReadToggle({
  group,
  disabled,
  onToggle,
}: {
  group: NotificationGroup;
  disabled: boolean;
  onToggle: (ids: string[], isRead: boolean) => void;
}) {
  const unread = group.unreadIds.length > 0;
  const label = unread ? "Đánh dấu đã đọc" : "Đánh dấu chưa đọc";
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      disabled={disabled}
      title={label}
      aria-label={label}
      onClick={() => (unread ? onToggle(group.unreadIds, true) : onToggle([group.latest.id], false))}
    >
      {unread ? <MailOpen strokeWidth={1.5} /> : <Mail strokeWidth={1.5} />}
    </Button>
  );
}

function InboxDetail({
  group,
  now,
  ctx,
}: {
  group: NotificationGroup;
  now: Date;
  ctx: { state: "loading" | "ready" | "denied" | "error"; task?: InboxTask } | null;
}) {
  const n = group.latest;
  const title = getNotificationDisplayTitle(n);
  const body = (n.body ?? "").trim();
  const task = ctx?.state === "ready" ? ctx.task : undefined;

  return (
    <article className="mx-auto w-full max-w-3xl px-6 pb-10 pt-6">
      <h2 className="break-words text-xl font-semibold leading-snug tracking-tight text-foreground">{title}</h2>
      <EventMeta notification={n} now={now} className="mt-2" />

      {ctx?.state === "loading" && <div aria-hidden className="mt-4 h-7 w-1/2 animate-pulse rounded bg-muted" />}
      {ctx?.state === "denied" && (
        <p className="mt-4 text-xs text-muted-foreground">Không thể xem nhiệm vụ liên quan.</p>
      )}
      {ctx?.state === "error" && (
        <p className="mt-4 text-xs text-muted-foreground">Không tải được thông tin nhiệm vụ.</p>
      )}
      {task && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs text-foreground">
          <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border/70 px-2">
            <TaskStatusIcon status={task.status} size={14} />
            {getStatusLabel(task.status)}
          </span>
          {task.priority && (
            <span className="inline-flex h-7 items-center rounded-md border border-border/70 px-2">
              <PriorityIndicator priority={task.priority} showLabel />
            </span>
          )}
          {task.dueDate && (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border/70 px-2 tabular-nums">
              <Calendar size={14} strokeWidth={1.5} className="text-muted-foreground" />
              {new Date(task.dueDate).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
            </span>
          )}
          {task.leadAssignee?.name && (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border/70 px-2">
              <UserAvatar name={task.leadAssignee.name} size="sm" />
              {task.leadAssignee.name}
            </span>
          )}
          {task.department?.name && (
            <span className="inline-flex h-7 items-center rounded-md border border-border/70 px-2 text-muted-foreground">
              {task.department.name}
            </span>
          )}
        </div>
      )}

      {body && body !== title && (
        <p className="mt-5 whitespace-pre-wrap text-compact leading-relaxed text-foreground/90">{body}</p>
      )}

      {group.items.length > 1 && (
        <section className="mt-8 border-t border-border/60 pt-4">
          <h3 className="mb-2 text-xs font-medium text-muted-foreground">Cập nhật trước đó</h3>
          <ul className="space-y-2">
            {group.items.slice(1).map((item) => (
              <li key={item.id}>
                <EventMeta notification={item} now={now} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function EventMeta({
  notification,
  now,
  className,
}: {
  notification: QCETNotification;
  now: Date;
  className?: string;
}) {
  const absolute = formatNotificationAbsoluteTime(notification.createdAt);
  const relative = relativeLabel(notification.createdAt, now);
  return (
    <p className={cn("flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground", className)}>
      {notification.hasActor && (
        <>
          <UserAvatar name={notification.actorName} size="sm" />
          <span className="font-medium text-foreground">{notification.actorName}</span>
          <span aria-hidden>·</span>
        </>
      )}
      <span>{getNotificationEventLabel(notification.type)}</span>
      {absolute && (
        <>
          <span aria-hidden>·</span>
          <time dateTime={toIso(notification.createdAt)}>
            {absolute}
            {relative && !relative.includes("/") ? ` · ${relative}` : ""}
          </time>
        </>
      )}
    </p>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-md border border-border/70 pl-2 text-xs text-foreground">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Bỏ lọc ${label}`}
        className="flex size-6 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground"
      >
        <X className="size-3" strokeWidth={1.5} />
      </button>
    </span>
  );
}

function QuietState({ title, action }: { title: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <p className="text-xs text-muted-foreground">{title}</p>
      {action && (
        <Button variant="ghost" size="xs" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
