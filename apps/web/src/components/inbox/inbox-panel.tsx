"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { ArrowUpRight, CheckCheck, ListFilter, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { MenuActionItem, MenuContent, MenuOptionItem, MenuRoot, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Pressable } from "@/components/ui/pressable";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { IconSidebarMail } from "@/components/layout/sidebar-rounded-icons";
import { useSidebar } from "@/components/layout/sidebar-context";
import { getInboxEmptyCopy, InboxRow, readNotificationEnvelope, useNow } from "@/components/inbox/inbox-row";
import { popoverVariants } from "@/lib/motion/variants";
import { cn } from "@/lib/utils";
import { mapDbNotification, type NotificationTriageTab, type QCETNotification } from "@qcet/shared/lib/notification-triage";
import {
  formatUnreadBadge,
  getNotificationHref,
  getNotificationSnippet,
  getNotificationTimeBucket,
  NOTIFICATION_TIME_BUCKET_LABELS,
  resolveNotificationTarget,
  type NotificationGroup,
  type NotificationTimeBucket,
} from "@/lib/notification-inbox";

/** Mở khung Hộp thư từ nơi khác (phím tắt số 1 của sidebar). */
export const OPEN_INBOX_EVENT = "qcet:open-inbox";

const PAGE_SIZE = 30;
const UNREAD_POLL_MS = 60_000;
const FILTER_STORAGE_KEY = "qcet.inbox.panelFilter";

type ReadFilter = "all" | "unread";

const CATEGORY_OPTIONS: { id: NotificationTriageTab; label: string }[] = [
  { id: "all", label: "Mọi loại" },
  { id: "action_required", label: "Việc cần làm" },
  { id: "reminders", label: "Nhắc hạn" },
];

interface PanelFilter {
  read: ReadFilter;
  category: NotificationTriageTab;
}

const DEFAULT_FILTER: PanelFilter = { read: "all", category: "all" };

/** Menu của khung nằm trên khung (khung z-40, menu mặc định z-30). */
const PANEL_MENU_LAYER = "z-50";

function readStoredFilter(): PanelFilter {
  try {
    const raw = JSON.parse(window.localStorage.getItem(FILTER_STORAGE_KEY) ?? "null");
    return {
      read: raw?.read === "unread" ? "unread" : "all",
      category: CATEGORY_OPTIONS.some((opt) => opt.id === raw?.category) ? raw.category : "all",
    };
  } catch {
    return DEFAULT_FILTER;
  }
}

function storeFilter(filter: PanelFilter) {
  try {
    window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filter));
  } catch {
    // Trình duyệt chặn lưu trữ: bộ lọc chỉ giữ trong phiên
  }
}

/** Mỗi thông báo một hàng (không gộp theo đối tượng như trang /inbox) để bấm vào là tới đúng chỗ của thông báo đó. */
function singleGroup(n: QCETNotification): NotificationGroup {
  return { key: n.id, latest: n, items: [n], unreadIds: n.isRead ? [] : [n.id], target: resolveNotificationTarget(n.linkHref) };
}

/**
 * Hộp thư kiểu Notion: nút khay thư có số chưa đọc ở đầu sidebar desktop, bấm mở khung nổi cạnh sidebar liệt kê thông báo
 * theo thời gian. Bấm một thông báo thì đánh dấu đã đọc, đóng khung và mở đúng trang đích; trang nhiệm vụ cuộn tới và tô
 * sáng khối liên quan (`?focus=`, xem `useNotificationFocus`). Trang /inbox vẫn giữ cho điện thoại và xem đầy đủ.
 */
export function SidebarInbox({ isCollapsed }: { isCollapsed: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const { badgeCounts, setBadgeCounts, sidebarWidth } = useSidebar();
  const unreadCount = Number(badgeCounts?.notifications) || 0;
  const badge = formatUnreadBadge(unreadCount);

  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  const syncUnread = React.useCallback(
    (count: number) => setBadgeCounts((prev) => (prev.notifications === count ? prev : { ...prev, notifications: count })),
    [setBadgeCounts]
  );

  // Số chưa đọc của nút: tải khi vào trang, khi chuyển trang, khi quay lại cửa sổ và mỗi phút lúc tab đang hiện
  const refreshUnread = React.useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=1", { credentials: "include", cache: "no-store" });
      if (res.status === 401) return;
      const json = await readNotificationEnvelope(res);
      if (typeof json.unreadCount === "number") syncUnread(json.unreadCount);
    } catch {
      // Giữ số cũ; lần sau đồng bộ lại
    }
  }, [syncUnread]);

  React.useEffect(() => {
    void refreshUnread();
  }, [pathname, refreshUnread]);

  React.useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshUnread();
    };
    const timer = window.setInterval(onVisible, UNREAD_POLL_MS);
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshUnread]);

  const close = React.useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  // Phím tắt hoặc nơi khác yêu cầu mở Hộp thư: điện thoại không có sidebar nên sang trang /inbox
  React.useEffect(() => {
    const onOpen = () => {
      if (window.matchMedia("(min-width: 768px)").matches) setOpen(true);
      else router.push("/inbox");
    };
    window.addEventListener(OPEN_INBOX_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_INBOX_EVENT, onOpen);
  }, [router]);

  // Khung không chặn trang (như Notion): Esc hoặc bấm ra ngoài thì đóng. Menu của khung nằm ở portal riêng nên không tính là ngoài.
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target || panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      if (target.closest('[role="menu"], [data-slot="menu-backdrop"]')) return;
      close(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.activeElement?.closest('[role="menu"]')) return;
      close(true);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  // Chuyển trang bằng đường khác (sidebar, phím tắt) thì đóng khung
  const lastPathRef = React.useRef(pathname);
  React.useEffect(() => {
    if (lastPathRef.current === pathname) return;
    lastPathRef.current = pathname;
    setOpen(false);
  }, [pathname]);

  const label = unreadCount > 0 ? `Hộp thư, ${unreadCount} thông báo chưa đọc` : "Hộp thư";

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            ref={triggerRef}
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls={open ? "sidebar-inbox-panel" : undefined}
            onClick={() => setOpen((prev) => !prev)}
            className={cn(
              "relative shrink-0 text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              open && "bg-sidebar-accent text-foreground"
            )}
          >
            <IconSidebarMail />
            {badge ? (
              <span
                aria-hidden
                className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-xs font-medium leading-none tabular-nums text-primary-foreground ring-2 ring-sidebar"
              >
                {badge}
              </span>
            ) : null}
          </Button>
        </TooltipTrigger>
        <TooltipContent side={isCollapsed ? "right" : "bottom"} hidden={open}>
          Hộp thư
        </TooltipContent>
      </Tooltip>

      {/* Portal ra body: sidebar là lớp fixed z-40 riêng nên khung đặt bên trong sẽ bị thanh công cụ dính của trang đè */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {open ? (
              <m.div
                key="inbox-panel"
                ref={panelRef}
                id="sidebar-inbox-panel"
                role="dialog"
                aria-label="Hộp thư"
                variants={popoverVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                style={{ left: sidebarWidth + 8 }}
                className="fixed bottom-2 top-2 z-40 hidden w-96 flex-col overflow-hidden rounded-xl border border-border/70 bg-popover text-foreground shadow-dialog outline-none md:flex"
              >
                <InboxPanelBody
                  onUnreadCount={syncUnread}
                  onNavigate={(href) => {
                    close(false);
                    router.push(href);
                  }}
                />
              </m.div>
            ) : null}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}

function InboxPanelBody({
  onUnreadCount,
  onNavigate,
}: {
  onUnreadCount: (count: number) => void;
  onNavigate: (href: string) => void;
}) {
  const now = useNow(60_000);
  const [filter, setFilter] = React.useState<PanelFilter>(readStoredFilter);
  const [items, setItems] = React.useState<QCETNotification[]>([]);
  const [unread, setUnread] = React.useState<number | null>(null);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [loadMoreError, setLoadMoreError] = React.useState(false);
  const [markingAll, setMarkingAll] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const seqRef = React.useRef(0);
  const listRef = React.useRef<HTMLDivElement>(null);

  const changeFilter = (patch: Partial<PanelFilter>) => {
    setFilter((prev) => {
      const next = { ...prev, ...patch };
      storeFilter(next);
      return next;
    });
  };

  const query = React.useCallback(
    (cursor?: string | null) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (filter.read === "unread") params.set("unreadOnly", "true");
      if (filter.category !== "all") params.set("triage", filter.category);
      if (cursor) params.set("cursor", cursor);
      return params.toString();
    },
    [filter]
  );

  const applyUnread = React.useCallback(
    (count: number) => {
      setUnread(count);
      onUnreadCount(count);
    },
    [onUnreadCount]
  );

  const load = React.useCallback(async () => {
    const seq = ++seqRef.current;
    setStatus("loading");
    setLoadMoreError(false);
    try {
      const res = await fetch(`/api/notifications?${query()}`, { credentials: "include", cache: "no-store" });
      const json = await readNotificationEnvelope(res);
      if (seq !== seqRef.current) return;
      if (!Array.isArray(json.notifications)) throw new Error("Dữ liệu thông báo không hợp lệ");
      setItems(json.notifications.map(mapDbNotification));
      setNextCursor(json.hasMore ? (json.nextCursor ?? null) : null);
      if (typeof json.unreadCount === "number") applyUnread(json.unreadCount);
      setActiveIndex(0);
      setStatus("ready");
    } catch {
      if (seq === seqRef.current) setStatus("error");
    }
  }, [query, applyUnread]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    const seq = seqRef.current;
    setLoadingMore(true);
    setLoadMoreError(false);
    try {
      const res = await fetch(`/api/notifications?${query(nextCursor)}`, { credentials: "include", cache: "no-store" });
      const json = await readNotificationEnvelope(res);
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
      setLoadingMore(false);
    }
  };

  const markRead = async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    if (unread !== null) applyUnread(Math.max(0, unread - 1));
    try {
      await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isRead: true }),
      }).then(readNotificationEnvelope);
    } catch {
      // Đánh dấu không thành: lần tải số chưa đọc kế tiếp (chuyển trang) tự đồng bộ lại
    }
  };

  const markAllRead = async () => {
    if (markingAll) return;
    setMarkingAll(true);
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await fetch("/api/notifications/read-all", { method: "POST", credentials: "include" }).then(readNotificationEnvelope);
      applyUnread(0);
    } catch {
      void load();
    } finally {
      setMarkingAll(false);
    }
  };

  const openNotification = (n: QCETNotification) => {
    if (!n.isRead) void markRead(n.id);
    // Thông báo không có trang đích (lời chào, thông báo hệ thống) mở chi tiết ở trang Hộp thư
    onNavigate(getNotificationHref(n) ?? `/inbox?id=${encodeURIComponent(n.id)}`);
  };

  const sections = React.useMemo(() => {
    const result: { bucket: NotificationTimeBucket; items: QCETNotification[] }[] = [];
    for (const n of items) {
      const bucket = getNotificationTimeBucket(n.createdAt, now);
      const last = result[result.length - 1];
      if (last?.bucket === bucket) last.items.push(n);
      else result.push({ bucket, items: [n] });
    }
    return result;
  }, [items, now]);

  const focusRow = (index: number) => {
    const next = Math.max(0, Math.min(items.length - 1, index));
    setActiveIndex(next);
    listRef.current?.querySelectorAll<HTMLElement>('[role="option"]')[next]?.focus();
  };

  const onRowKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, index: number, n: QCETNotification) => {
    if (event.key === "ArrowDown" || event.key === "j") {
      event.preventDefault();
      focusRow(index + 1);
    } else if (event.key === "ArrowUp" || event.key === "k") {
      event.preventDefault();
      focusRow(index - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openNotification(n);
    }
  };

  const filtered = filter.read === "unread" || filter.category !== "all";
  const empty = getInboxEmptyCopy({ failed: false, hasCondition: filter.category !== "all", unreadOnly: filter.read === "unread" });
  let rowIndex = -1;

  return (
    <>
      <div className="flex h-11 shrink-0 items-center gap-1 pl-4 pr-2">
        <h2 className="min-w-0 flex-1 truncate text-compact font-semibold">Hộp thư</h2>
        <MenuRoot>
          <MenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={filtered ? "Lọc thông báo (đang lọc)" : "Lọc thông báo"}
                className={cn(filtered && "bg-accent text-foreground")}
              />
            }
          >
            <ListFilter />
          </MenuTrigger>
          <MenuContent align="end" className="w-56" positionerClassName={PANEL_MENU_LAYER}>
            <MenuOptionItem selected={filter.read === "all"} onClick={() => changeFilter({ read: "all" })}>
              Tất cả
            </MenuOptionItem>
            <MenuOptionItem
              selected={filter.read === "unread"}
              hint={unread ? unread : undefined}
              onClick={() => changeFilter({ read: "unread" })}
            >
              Chưa đọc
            </MenuOptionItem>
            <MenuSeparator className="my-1 border-t border-border/40" />
            {CATEGORY_OPTIONS.map((opt) => (
              <MenuOptionItem key={opt.id} selected={filter.category === opt.id} onClick={() => changeFilter({ category: opt.id })}>
                {opt.label}
              </MenuOptionItem>
            ))}
          </MenuContent>
        </MenuRoot>
        <MenuRoot>
          <MenuTrigger render={<Button variant="ghost" size="icon-xs" aria-label="Tùy chọn hộp thư" />}>
            <MoreHorizontal />
          </MenuTrigger>
          <MenuContent align="end" className="w-56" positionerClassName={PANEL_MENU_LAYER}>
            <MenuActionItem disabled={!unread || markingAll} leading={<CheckCheck />} onClick={() => void markAllRead()}>
              Đánh dấu đã đọc tất cả
            </MenuActionItem>
            <MenuActionItem leading={<ArrowUpRight />} onClick={() => onNavigate("/inbox")}>
              Mở trang Hộp thư
            </MenuActionItem>
          </MenuContent>
        </MenuRoot>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2 thin-scrollbar" aria-busy={status === "loading"}>
        {status === "loading" ? (
          <div className="space-y-1 px-1.5 pt-1" aria-hidden>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 py-3 pl-1.5">
                <Skeleton className="size-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : status === "error" ? (
          <InlineAlert className="px-3 pt-2" actionLabel="Thử lại" onAction={() => void load()}>
            Không tải được hộp thư.
          </InlineAlert>
        ) : items.length === 0 ? (
          <EmptyState
            density="compact"
            illustration={empty.illustration}
            title={empty.title}
            description={empty.description}
            className="py-12"
            action={
              filtered ? (
                <Button variant="outline" size="xs" onClick={() => changeFilter(DEFAULT_FILTER)}>
                  Xem tất cả
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div role="listbox" aria-label="Thông báo">
            {sections.map((section) => (
              <div key={section.bucket} role="group" aria-label={NOTIFICATION_TIME_BUCKET_LABELS[section.bucket]}>
                <p aria-hidden className="px-3 pb-1 pt-3 text-xs font-medium text-muted-foreground">
                  {NOTIFICATION_TIME_BUCKET_LABELS[section.bucket]}
                </p>
                {section.items.map((n) => {
                  rowIndex += 1;
                  const index = rowIndex;
                  return (
                    <InboxRow
                      key={n.id}
                      group={singleGroup(n)}
                      now={now}
                      selected={false}
                      tabIndex={index === activeIndex ? 0 : -1}
                      snippet={getNotificationSnippet(n)}
                      onOpen={() => openNotification(n)}
                      onFocus={() => setActiveIndex(index)}
                      onKeyDown={(event) => onRowKeyDown(event, index, n)}
                    />
                  );
                })}
              </div>
            ))}
            {nextCursor ? (
              <div className="px-3 pt-2">
                {loadMoreError ? (
                  <InlineAlert actionLabel="Thử lại" onAction={() => void loadMore()}>
                    Không tải thêm được.
                  </InlineAlert>
                ) : (
                  <Pressable
                    onClick={() => void loadMore()}
                    disabled={loadingMore}
                    className="h-7 w-full rounded-md text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    {loadingMore ? "Đang tải…" : "Xem thêm thông báo"}
                  </Pressable>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}
