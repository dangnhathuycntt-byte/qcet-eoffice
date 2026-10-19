"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { Archive, ArrowUpRight, CheckCheck, ListFilter, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useFeedback } from "@/components/ui/feedback-layer";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Kbd } from "@/components/ui/kbd";
import { MenuActionItem, MenuContent, MenuOptionItem, MenuRoot, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Pressable } from "@/components/ui/pressable";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { IconSidebarMail } from "@/components/layout/sidebar-rounded-icons";
import { useSidebar } from "@/components/layout/sidebar-context";
import {
  getInboxEmptyCopy,
  INBOX_ARCHIVE_KEY,
  INBOX_TOGGLE_READ_KEY,
  INBOX_UNDO_TOAST_MS as UNDO_TOAST_MS,
  InboxRow,
  InboxRowActions,
  readNotificationEnvelope,
  useNow,
} from "@/components/inbox/inbox-row";
import { archiveNotificationsRequest, setNotificationReadRequest } from "@/components/inbox/notification-actions";
import { edgePanelVariants } from "@/lib/motion/variants";
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

/** Ba chế độ xem như Notion: cả Hộp thư, chỉ chưa đọc, đã lưu trữ. */
type ReadFilter = "all" | "unread" | "archived";

const READ_TABS: { id: ReadFilter; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "unread", label: "Chưa đọc" },
  { id: "archived", label: "Đã lưu trữ" },
];

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

/** Hàng đang chọn trong danh sách của trang /inbox (nút Hộp thư ở đó đưa focus vào danh sách thay vì mở khung chồng lên). */
const PAGE_LIST_ROW = '[data-slot="inbox-list-pane"] [role="option"][tabindex="0"]';

interface PanelFrame {
  left: number;
  top: number;
  bottom: string;
}

/**
 * Khung trùng thẻ trang: mép trái và mép trên lấy từ `#main-content` (trang có thanh trên như Lịch thì thẻ bắt đầu thấp hơn),
 * đáy là lề 8px cộng phần chừa cho thanh dưới (`--app-statusbar` đặt ở vỏ app; khung portal ra body nên đọc qua thẻ trang).
 * Khung lùi vào đúng bề dày viền thẻ: viền 1px của `shadow-menu` (vẽ phía ngoài) đè lên viền thẻ, nên đường kẻ dưới tiêu đề
 * khung thẳng hàng với tiêu đề trang.
 */
function readPanelFrame(fallbackLeft: number): PanelFrame {
  const main = document.getElementById("main-content");
  if (!main) return { left: fallbackLeft, top: 8, bottom: "8px" };
  const rect = main.getBoundingClientRect();
  const style = getComputedStyle(main);
  const edge = (side: "Left" | "Top" | "Bottom") => parseFloat(style[`border${side}Width`]) || 0;
  const reserve = style.getPropertyValue("--app-statusbar").trim() || "0px";
  return {
    left: rect.left + edge("Left"),
    top: Math.min(Math.max(rect.top, 8), 120) + edge("Top"),
    bottom: `calc(${8 + edge("Bottom")}px + ${reserve})`,
  };
}

function readStoredFilter(): PanelFilter {
  try {
    const raw = JSON.parse(window.localStorage.getItem(FILTER_STORAGE_KEY) ?? "null");
    return {
      read: READ_TABS.some((tab) => tab.id === raw?.read) ? raw.read : "all",
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
  const [frame, setFrame] = React.useState<PanelFrame | null>(null);
  const [mounted, setMounted] = React.useState(false);
  const onInboxPage = pathname === "/inbox";
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

  // Đang ở trang Hộp thư thì không mở khung chồng lên danh sách của trang: đưa focus vào danh sách đó
  const openPanel = React.useCallback(() => {
    if (onInboxPage) {
      document.querySelector<HTMLElement>(PAGE_LIST_ROW)?.focus();
      return;
    }
    setFrame(readPanelFrame(sidebarWidth));
    setOpen(true);
  }, [onInboxPage, sidebarWidth]);

  // Phím tắt hoặc nơi khác yêu cầu mở Hộp thư: điện thoại không có sidebar nên sang trang /inbox
  React.useEffect(() => {
    const onOpen = () => {
      if (window.matchMedia("(min-width: 768px)").matches) openPanel();
      else router.push("/inbox");
    };
    window.addEventListener(OPEN_INBOX_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_INBOX_EVENT, onOpen);
  }, [router, openPanel]);

  // Khung không chặn trang (như Notion): Esc hoặc bấm ra ngoài thì đóng. Menu của khung nằm ở portal riêng nên không tính là ngoài.
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target || panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      // Toast "Hoàn tác" của thao tác trong khung cũng không tính là bấm ra ngoài
      if (target.closest('[role="menu"], [data-slot="menu-backdrop"], [data-sonner-toaster]')) return;
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
            aria-haspopup={onInboxPage ? undefined : "dialog"}
            aria-expanded={onInboxPage ? undefined : open}
            aria-controls={open ? "sidebar-inbox-panel" : undefined}
            aria-current={onInboxPage ? "page" : undefined}
            onClick={() => (open ? close(false) : openPanel())}
            className={cn(
              "relative shrink-0 text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              (open || onInboxPage) && "bg-sidebar-accent text-foreground"
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

      {/* Portal ra body: sidebar là lớp fixed z-40 riêng nên khung đặt bên trong sẽ bị thanh công cụ dính của trang đè.
          Khung trùng khít mép trái, mép trên và đáy thẻ trang, cùng bo 16px và nền thẻ, nên đọc như một tấm trượt ra từ thanh
          bên trên chính trang (như Inbox của Notion) chứ không phải một hộp nổi lệch khung; bóng `shadow-menu` (viền mảnh + bóng
          nhẹ) tách khung khỏi nội dung phía sau. */}
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
                variants={edgePanelVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                style={{ left: frame?.left ?? sidebarWidth, top: frame?.top ?? 8, bottom: frame?.bottom ?? "8px" }}
                className="fixed z-40 hidden w-96 flex-col overflow-hidden rounded-2xl bg-card text-foreground shadow-menu outline-none md:flex"
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
  const { showToast } = useFeedback();
  const [filter, setFilter] = React.useState<PanelFilter>(readStoredFilter);
  const [items, setItems] = React.useState<QCETNotification[]>([]);
  const [unread, setUnread] = React.useState<number | null>(null);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [loadMoreError, setLoadMoreError] = React.useState(false);
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const seqRef = React.useRef(0);
  const listRef = React.useRef<HTMLDivElement>(null);
  const archivedView = filter.read === "archived";

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
      if (filter.read === "archived") params.set("archived", "true");
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

  const load = React.useCallback(
    async (mode: "reset" | "refresh" = "reset") => {
      const seq = ++seqRef.current;
      if (mode === "reset") setStatus("loading");
      setLoadMoreError(false);
      try {
        const res = await fetch(`/api/notifications?${query()}`, { credentials: "include", cache: "no-store" });
        const json = await readNotificationEnvelope(res);
        if (seq !== seqRef.current) return;
        if (!Array.isArray(json.notifications)) throw new Error("Dữ liệu thông báo không hợp lệ");
        setItems(json.notifications.map(mapDbNotification));
        setNextCursor(json.hasMore ? (json.nextCursor ?? null) : null);
        if (typeof json.unreadCount === "number") applyUnread(json.unreadCount);
        if (mode === "reset") setActiveIndex(0);
        setStatus("ready");
      } catch {
        if (seq === seqRef.current && mode === "reset") setStatus("error");
      }
    },
    [query, applyUnread]
  );

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

  const setRead = async (n: QCETNotification, isRead: boolean) => {
    setItems((prev) => prev.map((item) => (item.id === n.id ? { ...item, isRead } : item)));
    if (unread !== null) applyUnread(Math.max(0, unread + (isRead ? -1 : 1)));
    try {
      await setNotificationReadRequest(n.id, isRead);
    } catch {
      setItems((prev) => prev.map((item) => (item.id === n.id ? { ...item, isRead: n.isRead } : item)));
      void load("refresh");
      showToast({ variant: "error", message: "Chưa cập nhật được trạng thái đã đọc. Thầy/Cô thử lại." });
    }
  };

  const markAllRead = async () => {
    if (bulkBusy) return;
    setBulkBusy(true);
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await fetch("/api/notifications/read-all", { method: "POST", credentials: "include" }).then(readNotificationEnvelope);
      applyUnread(0);
    } catch {
      void load("refresh");
      showToast({ variant: "error", message: "Chưa đánh dấu được. Thầy/Cô thử lại." });
    } finally {
      setBulkBusy(false);
    }
  };

  /** Lưu trữ (hoặc đưa về Hộp thư khi đang xem "Đã lưu trữ") một thông báo: bỏ khỏi danh sách ngay, có Hoàn tác. */
  const toggleArchive = async (n: QCETNotification, index: number) => {
    const archive = !n.isArchived;
    // Giữ vị trí chọn: hàng kế tiếp lên thế chỗ (hàng cuối thì lùi lên một). Tìm theo mã vì hàng vừa bỏ còn trong DOM lúc mờ dần.
    const next = items[index + 1] ?? items[index - 1];
    setItems((prev) => prev.filter((item) => item.id !== n.id));
    setActiveIndex(Math.max(0, Math.min(index, items.length - 2)));
    if (next) requestAnimationFrame(() => focusRowById(next.id));
    try {
      const result = await archiveNotificationsRequest({ ids: [n.id], archived: archive });
      applyUnread(result.unreadCount);
      showToast({
        variant: "success",
        message: archive ? "Đã lưu trữ thông báo." : "Đã đưa thông báo về Hộp thư.",
        // Đủ lâu để kịp bấm Hoàn tác (toast thường 4 giây)
        durationMs: UNDO_TOAST_MS,
        action: {
          label: "Hoàn tác",
          onClick: () => {
            void archiveNotificationsRequest({ ids: [n.id], archived: !archive })
              .then((undo) => {
                applyUnread(undo.unreadCount);
                void load("refresh");
              })
              .catch(() => showToast({ variant: "error", message: "Chưa hoàn tác được. Thầy/Cô thử lại." }));
          },
        },
      });
    } catch {
      void load("refresh");
      showToast({ variant: "error", message: archive ? "Chưa lưu trữ được thông báo. Thầy/Cô thử lại." : "Chưa đưa được thông báo về Hộp thư." });
    }
  };

  /** Lưu trữ hàng loạt như Notion ("Archive read" / "Archive all"); xem lại ở tab Đã lưu trữ. */
  const archiveBulk = async (scope: "read" | "all") => {
    if (bulkBusy) return;
    setBulkBusy(true);
    try {
      const result = await archiveNotificationsRequest({ scope });
      applyUnread(result.unreadCount);
      void load();
      showToast({
        variant: result.count ? "success" : "info",
        message: result.count
          ? `Đã lưu trữ ${result.count} thông báo. Xem lại ở mục Đã lưu trữ.`
          : scope === "read"
            ? "Không có thông báo đã đọc nào để lưu trữ."
            : "Hộp thư không còn thông báo nào để lưu trữ.",
      });
    } catch {
      showToast({ variant: "error", message: "Chưa lưu trữ được. Thầy/Cô thử lại." });
    } finally {
      setBulkBusy(false);
    }
  };

  const openNotification = (n: QCETNotification) => {
    if (!n.isRead) void setRead(n, true);
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

  function focusRowById(id: string) {
    listRef.current?.querySelector<HTMLElement>(`[data-group-key="${CSS.escape(id)}"]`)?.focus();
  }

  const focusRow = (index: number) => {
    const next = Math.max(0, Math.min(items.length - 1, index));
    setActiveIndex(next);
    const target = items[next];
    if (target) focusRowById(target.id);
  };

  const onRowKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, index: number, n: QCETNotification) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (event.key === "ArrowDown" || key === "j") {
      event.preventDefault();
      focusRow(index + 1);
    } else if (event.key === "ArrowUp" || key === "k") {
      event.preventDefault();
      focusRow(index - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openNotification(n);
    } else if (key === INBOX_ARCHIVE_KEY) {
      event.preventDefault();
      void toggleArchive(n, index);
    } else if (key === INBOX_TOGGLE_READ_KEY && !n.isArchived) {
      event.preventDefault();
      void setRead(n, !n.isRead);
    }
  };

  const categoryFiltered = filter.category !== "all";
  const empty = getInboxEmptyCopy({
    failed: false,
    hasCondition: categoryFiltered,
    unreadOnly: filter.read === "unread",
    archived: archivedView && !categoryFiltered,
  });
  let rowIndex = -1;

  return (
    <>
      {/* Tiêu đề như tiêu đề trang (cao 44px, đường kẻ dưới, chữ 13px đậm vừa) để khung cùng nhịp với trang phía sau */}
      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-border/60 pl-4 pr-2">
        <h2 className="min-w-0 flex-1 truncate text-compact font-medium text-foreground">Hộp thư</h2>
        <MenuRoot>
          <MenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={categoryFiltered ? "Lọc theo loại (đang lọc)" : "Lọc theo loại"}
                className={cn(categoryFiltered && "bg-accent text-foreground")}
              />
            }
          >
            <ListFilter />
          </MenuTrigger>
          <MenuContent align="end" className="w-56" positionerClassName={PANEL_MENU_LAYER}>
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
          <MenuContent align="end" className="w-60" positionerClassName={PANEL_MENU_LAYER}>
            <MenuActionItem disabled={!unread || bulkBusy} leading={<CheckCheck />} onClick={() => void markAllRead()}>
              Đánh dấu đã đọc tất cả
            </MenuActionItem>
            <MenuActionItem disabled={bulkBusy} leading={<Archive />} onClick={() => void archiveBulk("read")}>
              Lưu trữ thông báo đã đọc
            </MenuActionItem>
            <MenuActionItem disabled={bulkBusy} leading={<Archive />} onClick={() => void archiveBulk("all")}>
              Lưu trữ tất cả
            </MenuActionItem>
            <MenuSeparator className="my-1 border-t border-border/40" />
            <MenuActionItem leading={<ArrowUpRight />} onClick={() => onNavigate("/inbox")}>
              Mở trang Hộp thư
            </MenuActionItem>
          </MenuContent>
        </MenuRoot>
      </div>

      <Tabs value={filter.read} onValueChange={(value) => changeFilter({ read: value as ReadFilter })} className="shrink-0 px-4 py-2">
        <TabsList variant="pill" size="sm" aria-label="Chế độ xem hộp thư">
          {READ_TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="flex-none">
              {tab.label}
              {tab.id === "unread" && unread ? <span className="tabular-nums text-muted-foreground">{formatUnreadBadge(unread)}</span> : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 thin-scrollbar" aria-busy={status === "loading"}>
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
              categoryFiltered ? (
                <Button variant="outline" size="xs" onClick={() => changeFilter({ category: "all" })}>
                  Xem mọi loại
                </Button>
              ) : filter.read !== "all" ? (
                <Button variant="outline" size="xs" onClick={() => changeFilter({ read: "all" })}>
                  Về Hộp thư
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div role="listbox" aria-label={archivedView ? "Thông báo đã lưu trữ" : "Thông báo"}>
            {sections.map((section) => (
              <div key={section.bucket} role="group" aria-label={NOTIFICATION_TIME_BUCKET_LABELS[section.bucket]}>
                <p aria-hidden className="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground">
                  {NOTIFICATION_TIME_BUCKET_LABELS[section.bucket]}
                </p>
                <AnimatePresence initial={false}>
                  {section.items.map((n) => {
                    rowIndex += 1;
                    const index = rowIndex;
                    return (
                      <m.div
                        key={n.id}
                        role="presentation"
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.16, ease: "easeOut" }}
                        className="overflow-hidden"
                      >
                        <InboxRow
                          group={singleGroup(n)}
                          now={now}
                          selected={false}
                          tabIndex={index === activeIndex ? 0 : -1}
                          snippet={getNotificationSnippet(n)}
                          actions={
                            <InboxRowActions
                              unread={!n.isRead}
                              archived={Boolean(n.isArchived)}
                              onToggleRead={() => void setRead(n, !n.isRead)}
                              onArchive={() => void toggleArchive(n, index)}
                            />
                          }
                          onOpen={() => openNotification(n)}
                          onFocus={() => setActiveIndex(index)}
                          onKeyDown={(event) => onRowKeyDown(event, index, n)}
                        />
                      </m.div>
                    );
                  })}
                </AnimatePresence>
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

      {/* Gợi ý phím như bảng lệnh của Linear: chọn bằng phím rồi xử lý không cần chuột */}
      {status === "ready" && items.length > 0 ? (
        <div aria-hidden className="flex h-9 shrink-0 items-center gap-3 border-t border-border/60 px-4 text-xs text-muted-foreground">
          <KeyHint keys={["↑", "↓"]} label="chọn" />
          <KeyHint keys={["↵"]} label="mở" />
          <KeyHint keys={["E"]} label={archivedView ? "đưa về" : "lưu trữ"} />
          {archivedView ? null : <KeyHint keys={["U"]} label="đã đọc" />}
        </div>
      ) : null}
    </>
  );
}

function KeyHint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="flex items-center gap-1">
      {keys.map((key) => (
        <Kbd key={key}>{key}</Kbd>
      ))}
      {label}
    </span>
  );
}
