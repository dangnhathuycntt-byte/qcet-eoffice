"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, Keyboard, Loader2, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { getRouteByPath } from "@/lib/navigation/canonical-navigation-registry";
import { useRuntimeFeature } from "@/lib/runtime-features";
import {
  IconSidebarAssistant,
  IconSidebarCalendar,
  IconSidebarCompose,
  IconSidebarDocLines,
  IconSidebarHistory,
  IconSidebarInboxIn,
  IconSidebarMail,
  IconSidebarPeople,
  IconSidebarSend,
  IconSidebarTasks,
} from "@/components/layout/sidebar-rounded-icons";
import { SIDEBAR_MORE_ITEMS, SIDEBAR_NAV_GROUPS } from "@/components/layout/sidebar-nav-list";
import { TaskIconStatusReview } from "@qcet/shared/lib/icons/task-icons";
import { askAssistantInDock } from "@/components/assistant/assistant-model";
import { Kbd } from "@/components/ui/kbd";
import { highlightMatchSegments, scoreVietnameseSearch } from "@qcet/shared/lib/search/vietnamese-search";
import type { SearchTaskResult, SearchUserResult, SearchDocumentResult } from "@qcet/contracts/search";
import { StandardDialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { UserAvatar } from "@/components/ui/user-avatar";
import { TaskStatusCircle } from "@/components/tasks/task-status-circle";
import { DUE_SOON_DAYS } from "@/components/tasks/table/utils/table-date-helpers";
import { daysUntil, formatRelativeDate } from "@/lib/format/relative-date";
import { getDocumentHref } from "@qcet/shared/lib/documents/document-view-model";
import { formatDisplayDate } from "@qcet/shared/lib/format/date";

export interface QuickAction {
  id: string;
  title: string;
  category: "navigation" | "action";
  icon: React.ElementType;
  keywords?: string[];
  /** Phím tắt thật của lệnh (chạy ngoài hộp), hiện bên phải dòng để người dùng học dần */
  shortcut?: string[];
  /** Chỉ hiện khi gõ chữ (trang con của sidebar), ô rỗng không liệt kê để danh sách ngắn */
  searchOnly?: boolean;
  action: (inNewTab?: boolean) => void;
}

export interface RecentSearchItem {
  id: string;
  type: "task" | "document" | "user" | "action";
  title: string;
  subtitle?: string;
  timestamp: number;
  data?: any;
}

export interface CommandSearchModalProps {
  className?: string;
}

/**
 * C5 / T38: explicit classification of everything the palette can surface.
 * The Command Palette composes distinct intents that must never be conflated
 * with the current-view search or filters that live inside /tasks:
 * - "navigation" -> Đi tới (move to a canonical destination)
 * - "command"    -> Hành động (run an operational command)
 * - "task" | "document" | "user" -> global search result intents
 * - "recent"     -> account-scoped recently viewed entities
 */
export type CommandPaletteItemKind = "navigation" | "command" | "task" | "document" | "user" | "recent";

// T39: one label per intent group, rendered as visually separated sections.
export const COMMAND_INTENT_LABELS: Record<CommandPaletteItemKind, string> = {
  navigation: "Đi tới",
  task: "Nhiệm vụ",
  document: "Văn bản",
  user: "Cán bộ",
  command: "Hành động",
  recent: "Gần đây",
};

const RECENT_SEARCHES_STORAGE_KEY = "qcet_recent_searches";
const MAX_RECENT_ITEMS = 5;
/** Mỗi nhóm kết quả hiện tối đa 5 dòng; muốn xem hết thì mở trang Tìm kiếm ở dòng cuối */
const GROUP_LIMIT = 5;
const LISTBOX_ID = "command-palette-listbox";

/**
 * T41: Account-safe recents. The storage namespace is derived from the
 * authenticated user id so entities saved by a previous account can never be
 * read back after an account switch on a shared device.
 */
export function scopedRecentSearchesKey(userId?: string | null): string {
  return `${RECENT_SEARCHES_STORAGE_KEY}:${userId || "anonymous"}`;
}

/**
 * T41 / Server Truth: the in-memory result cache is namespaced by the
 * authenticated account so a client-side account switch (without a full reload)
 * can never surface the previous account's cached tasks/documents/users.
 */
export function scopedSearchCacheKey(userId: string | null | undefined, query: string): string {
  return `${userId || "anonymous"}::${query.trim()}`;
}

/**
 * T88: command palette navigation labels are sourced from the canonical
 * registry so sidebar / mobile / command surfaces share one naming system.
 */
export function canonicalNavLabel(href: string, fallback: string): string {
  return getRouteByPath(href)?.label || fallback;
}

/** Icon cùng bộ với sidebar (`sidebar-rounded-icons`, nét 1,25px) và Lucide (cùng nét qua LucideProvider) */
const DOCUMENT_TYPE_ICON: Record<string, React.ElementType> = {
  VAN_BAN_DEN: IconSidebarInboxIn,
  VAN_BAN_DI: IconSidebarSend,
  TO_TRINH_NOI_BO: IconSidebarDocLines,
};

const ICON_CLASS = "size-4 shrink-0 text-muted-foreground";

/** Phần khớp in đậm (như Linear), không tô màu nền */
function HighlightedText({ text, query }: { text: string; query: string }) {
  const segments = React.useMemo(() => highlightMatchSegments(text, query), [text, query]);
  return (
    <>
      {segments.map((segment, idx) =>
        segment.match ? (
          <span key={idx} className="font-semibold">
            {segment.text}
          </span>
        ) : (
          <React.Fragment key={idx}>{segment.text}</React.Fragment>
        )
      )}
    </>
  );
}

type FlatItem =
  | { kind: "recent"; item: RecentSearchItem }
  | { kind: "navigation" | "command"; item: QuickAction }
  | { kind: "task"; item: SearchTaskResult }
  | { kind: "document"; item: SearchDocumentResult }
  | { kind: "user"; item: SearchUserResult }
  | { kind: "all-results"; query: string };

function flatItemKey(item: FlatItem): string {
  if (item.kind === "all-results") return "all-results";
  return `${item.kind}-${item.item.id}`;
}

export function CommandSearchModal({ className }: CommandSearchModalProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const assistantEnabled = useRuntimeFeature("assistant");
  const recentStorageKey = React.useMemo(() => scopedRecentSearchesKey(user?.id), [user?.id]);
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [searchFailed, setSearchFailed] = React.useState(false);
  const [tasks, setTasks] = React.useState<SearchTaskResult[]>([]);
  const [documents, setDocuments] = React.useState<SearchDocumentResult[]>([]);
  const [users, setUsers] = React.useState<SearchUserResult[]>([]);
  const [recentSearches, setRecentSearches] = React.useState<RecentSearchItem[]>([]);
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const searchCacheRef = React.useRef<
    Map<string, { tasks: SearchTaskResult[]; documents: SearchDocumentResult[]; users: SearchUserResult[] }>
  >(new Map());

  // Load account-scoped recent searches whenever the modal opens or the
  // authenticated account changes. Switching accounts swaps the namespace so a
  // previous user's entities can never resurface (T41).
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(recentStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as RecentSearchItem[];
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed.slice(0, MAX_RECENT_ITEMS));
          return;
        }
      }
      setRecentSearches([]);
    } catch {
      setRecentSearches([]);
    }
  }, [isOpen, recentStorageKey]);

  const saveRecentItem = React.useCallback(
    (item: RecentSearchItem) => {
      setRecentSearches((prev) => {
        const updated = [item, ...prev.filter((i) => i.id !== item.id)].slice(0, MAX_RECENT_ITEMS);
        try {
          localStorage.setItem(recentStorageKey, JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      });
    },
    [recentStorageKey]
  );

  const clearRecentSearches = React.useCallback(() => {
    try {
      localStorage.removeItem(recentStorageKey);
    } catch {
      // ignore
    }
    setRecentSearches([]);
    setSelectedIndex(0);
    inputRef.current?.focus();
  }, [recentStorageKey]);

  const handleClose = React.useCallback(() => {
    setIsOpen(false);
    setQuery("");
  }, []);

  const go = React.useCallback(
    (href: string, inNewTab = false) => {
      handleClose();
      if (inNewTab) window.open(href, "_blank");
      else router.push(href);
    },
    [handleClose, router]
  );

  const handleSelectTask = React.useCallback(
    (task: SearchTaskResult, inNewTab = false) => {
      saveRecentItem({
        id: `task-${task.id}`,
        type: "task",
        title: `${task.code}: ${task.title}`,
        subtitle: task.leadUnit?.name || "Nhiệm vụ trường",
        timestamp: Date.now(),
        data: task,
      });

      handleClose();

      if (inNewTab) {
        window.open(`/tasks?taskId=${task.id}`, "_blank");
        return;
      }

      window.dispatchEvent(new CustomEvent("qcet:open-task-detail", { detail: { taskId: task.id } }));

      const params = new URLSearchParams(window.location.search);
      params.set("taskId", task.id);
      params.delete("zone");
      router.push(`/tasks?${params.toString()}`);
    },
    [handleClose, router, saveRecentItem]
  );

  const handleSelectDocument = React.useCallback(
    (doc: SearchDocumentResult, inNewTab = false) => {
      saveRecentItem({
        id: `doc-${doc.id}`,
        type: "document",
        title: `${doc.originalNumber}: ${doc.summary}`,
        subtitle: doc.issuingAuthority || doc.category || "Văn bản",
        timestamp: Date.now(),
        data: doc,
      });
      go(getDocumentHref(doc.id), inNewTab);
    },
    [go, saveRecentItem]
  );

  // Hàng không hiện email nên Enter mở danh bạ lọc theo tên người đó, không bật ứng dụng thư
  const handleSelectUser = React.useCallback(
    (person: SearchUserResult, inNewTab = false) => {
      saveRecentItem({
        id: `user-${person.id}`,
        type: "user",
        title: person.name,
        subtitle: person.title || "Cán bộ",
        timestamp: Date.now(),
        data: person,
      });
      go(`/org?q=${encodeURIComponent(person.name)}`, inNewTab);
    },
    [go, saveRecentItem]
  );

  // Trang con lấy từ chính danh mục sidebar (một nguồn), chỉ hiện khi gõ; bỏ trang trùng với mục Đi tới chính, mục "Thêm",
  // trang quản trị và báo cáo cần quyền riêng
  const sidebarDestinations = React.useMemo<QuickAction[]>(() => {
    const primary = new Set(["/tasks", "/documents", "/meetings", "/inbox", "/org", "/assistant"]);
    const entries: QuickAction[] = [];
    const add = (id: string, title: string, href: string, icon: React.ElementType) => {
      if (primary.has(href) || entries.some((entry) => entry.id === id)) return;
      entries.push({ id: `nav-sidebar-${id}`, title, category: "navigation", icon, searchOnly: true, action: (newTab) => go(href, newTab) });
    };
    for (const group of SIDEBAR_NAV_GROUPS) {
      for (const item of group.items) {
        if (item.more || (item.feature === "assistant" && !assistantEnabled)) continue;
        add(item.id, item.label, item.href, item.icon);
        for (const child of item.children ?? []) {
          if (child.requiresApprovalReport) continue;
          add(child.id, child.href.includes("?") ? `${item.label} · ${child.label}` : child.label, child.href, item.icon);
        }
      }
    }
    for (const item of SIDEBAR_MORE_ITEMS) {
      if (item.section !== "admin") add(item.id, item.label, item.href, item.icon);
    }
    return entries;
  }, [assistantEnabled, go]);

  const quickActions = React.useMemo<QuickAction[]>(() => {
    return [
      {
        id: "create-task",
        // "…" như Linear: lệnh mở hộp nhập tiếp
        title: "Tạo nhiệm vụ…",
        category: "action",
        icon: IconSidebarCompose,
        keywords: ["tao nhiem vu", "tao cong viec", "them nhiem vu", "new task", "create task"],
        // Phím C chỉ chạy ở khu Nhiệm vụ (useTaskShortcuts)
        ...(pathname?.startsWith("/tasks") ? { shortcut: ["C"] } : {}),
        action: () => {
          handleClose();
          window.dispatchEvent(new CustomEvent("qcet:open-create-task"));
        },
      },
      {
        id: "action-review-tasks",
        title: "Xem việc chờ duyệt",
        category: "action",
        icon: TaskIconStatusReview,
        keywords: ["xem viec cho duyet", "cho duyet", "phe duyet", "nghiem thu", "kiem tra", "pending", "review"],
        action: (newTab) => {
          window.dispatchEvent(new CustomEvent("qcet:set-smart-tab", { detail: { tab: "review" } }));
          go("/tasks?tab=review", newTab);
        },
      },
      {
        id: "action-my-tasks",
        title: "Đổi sang Của tôi",
        category: "action",
        icon: UserRound,
        keywords: ["doi sang cua toi", "cua toi", "ca nhan", "my tasks", "my", "toi"],
        action: (newTab) => {
          window.dispatchEvent(new CustomEvent("qcet:set-task-scope", { detail: { scope: "my" } }));
          window.dispatchEvent(new CustomEvent("qcet:set-smart-tab", { detail: { tab: "my_tasks" } }));
          go("/tasks?scope=my", newTab);
        },
      },
      {
        id: "action-shortcuts",
        title: "Xem phím tắt",
        category: "action",
        icon: Keyboard,
        keywords: ["phim tat", "ban phim", "shortcuts", "keyboard", "tro giup"],
        shortcut: ["?"],
        action: () => {
          handleClose();
          window.dispatchEvent(new CustomEvent("qcet:open-shortcuts"));
        },
      },
      {
        id: "nav-tasks",
        title: canonicalNavLabel("/tasks", "Nhiệm vụ"),
        category: "navigation",
        icon: IconSidebarTasks,
        keywords: ["danh sach cong viec", "nhiem vu", "tasks"],
        action: (newTab) => go("/tasks", newTab),
      },
      {
        id: "nav-documents",
        title: canonicalNavLabel("/documents", "Văn bản"),
        category: "navigation",
        icon: IconSidebarInboxIn,
        keywords: ["di toi van ban", "van ban", "vb", "so van ban", "cong van", "tai lieu", "documents"],
        action: (newTab) => go("/documents", newTab),
      },
      {
        id: "nav-meetings",
        title: canonicalNavLabel("/meetings", "Cuộc họp"),
        category: "navigation",
        icon: IconSidebarCalendar,
        keywords: ["di toi cuoc hop", "cuoc hop", "hop", "meetings", "lich hop", "bien ban", "lich cong tac"],
        action: (newTab) => go("/meetings", newTab),
      },
      {
        id: "nav-inbox",
        title: canonicalNavLabel("/inbox", "Hộp thư"),
        category: "navigation",
        icon: IconSidebarMail,
        keywords: ["hop thu", "inbox", "thong bao", "notifications", "canh bao", "nhat ky"],
        action: (newTab) => go("/inbox", newTab),
      },
      {
        id: "nav-org",
        title: canonicalNavLabel("/org", "Tổ chức"),
        category: "navigation",
        icon: IconSidebarPeople,
        keywords: ["co cau to chuc", "nhan su", "phong ban", "khoa", "to chuc", "danh ba"],
        action: (newTab) => go("/org", newTab),
      },
      ...sidebarDestinations,
      // Trợ lý chỉ hiện khi cờ bật
      ...(assistantEnabled
        ? [
            {
              id: "nav-assistant",
              title: "Trợ lý",
              category: "navigation" as const,
              icon: IconSidebarAssistant,
              keywords: ["tro ly", "tro ly ai", "hoi dap", "assistant", "agent", "hoi"],
              action: (newTab?: boolean) => go("/assistant", newTab),
            },
          ]
        : []),
    ];
  }, [handleClose, go, assistantEnabled, pathname, sidebarDestinations]);

  // Ctrl/Cmd+K bật/tắt, sự kiện mở từ sidebar/topbar, Esc đóng
  React.useEffect(() => {
    const handleOpenEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ open?: boolean } | undefined>;
      setIsOpen(customEvent?.detail?.open ?? true);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const isKeyK = e.key === "k" || e.key === "K" || e.code === "KeyK";
      if ((e.metaKey || e.ctrlKey) && !e.altKey && isKeyK) {
        if (isOpen) {
          e.preventDefault();
          handleClose();
          return;
        }
        if (!e.defaultPrevented) {
          e.preventDefault();
          setIsOpen(true);
        }
        return;
      }
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener("qcet:open-command-search", handleOpenEvent);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("qcet:open-command-search", handleOpenEvent);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleClose]);

  // Ô rỗng không gọi máy chủ: chỉ hiện Gần đây, Hành động, Đi tới. Gõ chữ thì chờ 150ms rồi tìm, có cache theo tài khoản.
  React.useEffect(() => {
    if (!isOpen) return;

    const trimmed = query.trim();
    setSearchFailed(false);
    if (!trimmed) {
      setIsLoading(false);
      return;
    }

    // T41 / Server Truth: key the cache by the authenticated account id so a
    // no-reload account switch can never read back the previous account's
    // cached results.
    const cacheKey = scopedSearchCacheKey(user?.id, trimmed);
    const cached = searchCacheRef.current.get(cacheKey);
    if (cached) {
      setTasks(cached.tasks);
      setDocuments(cached.documents);
      setUsers(cached.users);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    // C10: cancellation / staleness — abort the in-flight request when the
    // query changes so fast typing can never render an out-of-order response.
    const controller = new AbortController();
    setIsLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        if (!res.ok) throw new Error("Search failed");
        const json = await res.json();
        if (!json.success) throw new Error("Search failed");
        const t: SearchTaskResult[] = json.results?.tasks || [];
        const d: SearchDocumentResult[] = json.results?.documents || [];
        const u: SearchUserResult[] = json.results?.users || [];
        searchCacheRef.current.set(cacheKey, { tasks: t, documents: d, users: u });
        if (isMounted) {
          setTasks(t);
          setDocuments(d);
          setUsers(u);
          setSelectedIndex(0);
        }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        if (isMounted) {
          setTasks([]);
          setDocuments([]);
          setUsers([]);
          setSearchFailed(true);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [isOpen, query, user?.id]);

  const trimmedQuery = query.trim();

  const filteredActions = React.useMemo(() => {
    if (!trimmedQuery) return quickActions.filter((action) => !action.searchOnly);
    return quickActions
      .map((action) => ({
        action,
        score: scoreVietnameseSearch(action.title, trimmedQuery, action.keywords),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.action);
  }, [trimmedQuery, quickActions]);

  // T39: thứ tự nhóm Gần đây → Hành động → Đi tới → Nhiệm vụ → Văn bản → Cán bộ; dòng "Xem tất cả" ở cuối khi đang gõ
  const groups = React.useMemo(() => {
    const result: Array<{ key: string; label?: string; items: FlatItem[] }> = [];
    const push = (key: string, label: string | undefined, items: FlatItem[]) => {
      if (items.length > 0) result.push({ key, label, items });
    };
    if (!trimmedQuery) {
      push("recent", COMMAND_INTENT_LABELS.recent, recentSearches.map((item) => ({ kind: "recent", item })));
    }
    push(
      "command",
      COMMAND_INTENT_LABELS.command,
      filteredActions.filter((a) => a.category === "action").map((item) => ({ kind: "command", item }))
    );
    push(
      "navigation",
      COMMAND_INTENT_LABELS.navigation,
      filteredActions.filter((a) => a.category === "navigation").map((item) => ({ kind: "navigation", item }))
    );
    if (trimmedQuery) {
      push("task", COMMAND_INTENT_LABELS.task, tasks.slice(0, GROUP_LIMIT).map((item) => ({ kind: "task", item })));
      push("document", COMMAND_INTENT_LABELS.document, documents.slice(0, GROUP_LIMIT).map((item) => ({ kind: "document", item })));
      push("user", COMMAND_INTENT_LABELS.user, users.slice(0, GROUP_LIMIT).map((item) => ({ kind: "user", item })));
      if (tasks.length + documents.length + users.length > 0) {
        push("all-results", undefined, [{ kind: "all-results", query: trimmedQuery }]);
      }
    }
    return result;
  }, [trimmedQuery, recentSearches, filteredActions, tasks, documents, users]);

  const flatItems = React.useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const activeIndex = flatItems.length === 0 ? -1 : Math.min(selectedIndex, flatItems.length - 1);

  const executeItem = React.useCallback(
    (item: FlatItem, inNewTab = false) => {
      switch (item.kind) {
        case "navigation":
        case "command":
          item.item.action(inNewTab);
          return;
        case "task":
          handleSelectTask(item.item, inNewTab);
          return;
        case "document":
          handleSelectDocument(item.item, inNewTab);
          return;
        case "user":
          handleSelectUser(item.item, inNewTab);
          return;
        case "all-results":
          go(`/search?q=${encodeURIComponent(item.query)}`, inNewTab);
          return;
        case "recent": {
          const { type, data } = item.item;
          if (!data) return;
          if (type === "task") handleSelectTask(data, inNewTab);
          else if (type === "document") handleSelectDocument(data, inNewTab);
          else if (type === "user") handleSelectUser(data, inNewTab);
        }
      }
    },
    [go, handleSelectTask, handleSelectDocument, handleSelectUser]
  );

  // Tab chuyển câu đang gõ sang khung Trợ lý (như "Ask Linear"); không có khung (điện thoại, trang Trợ lý) thì mở trang Trợ lý
  const askAssistant = () => {
    const prompt = query.trim();
    handleClose();
    if (!askAssistantInDock(null, prompt ? { prompt } : undefined)) router.push("/assistant");
  };

  // T42: Lên/Xuống chuyển dòng đang chọn (focus vẫn ở ô nhập), Enter mở, Cmd/Ctrl+Enter mở tab mới. Esc và giữ focus
  // trong hộp do Dialog lo. Đang gõ bộ gõ (IME) thì bỏ qua.
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Tab" && !e.shiftKey && assistantEnabled) {
      e.preventDefault();
      askAssistant();
      return;
    }
    if (flatItems.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((activeIndex + 1) % flatItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((activeIndex - 1 + flatItems.length) % flatItems.length);
    } else if (e.key === "Home" && e.ctrlKey) {
      e.preventDefault();
      setSelectedIndex(0);
    } else if (e.key === "End" && e.ctrlKey) {
      e.preventDefault();
      setSelectedIndex(flatItems.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = flatItems[activeIndex];
      if (target) executeItem(target, e.metaKey || e.ctrlKey);
    }
  };

  React.useEffect(() => {
    if (activeIndex < 0) return;
    document.getElementById(`${LISTBOX_ID}-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const showEmpty = Boolean(trimmedQuery) && !isLoading && flatItems.length === 0;
  let runningIndex = 0;

  return (
    <StandardDialog
      open={isOpen}
      onOpenChange={(open) => (open ? setIsOpen(true) : handleClose())}
      title="Tìm kiếm nhanh"
      description="Tìm nhiệm vụ, văn bản, cán bộ hoặc chạy lệnh. Lên/Xuống để chọn, Enter để mở, Ctrl+Enter mở tab mới."
      size="lg"
      showHeader={false}
      initialFocus={inputRef}
      className={cn("gap-0 overflow-hidden p-0 sm:p-0", className)}
    >
      <div data-slot="command-palette" className="flex min-h-0 flex-1 flex-col">
        {/* Theo hộp lệnh của Linear (ảnh người dùng gửi 21/10/2026): ô nhập không icon, không kẻ ngăn với danh sách, chữ thẳng
            mép icon các dòng (18px), bên phải "Hỏi Trợ lý · Tab" */}
        <div className="flex h-13 shrink-0 items-center gap-2 pl-4.5 pr-3">
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-label="Tìm kiếm nhanh"
            aria-expanded={flatItems.length > 0}
            aria-controls={LISTBOX_ID}
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 ? `${LISTBOX_ID}-${activeIndex}` : undefined}
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Gõ lệnh hoặc tìm nhiệm vụ, văn bản, cán bộ…"
            className="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground max-md:text-base"
          />
          {isLoading ? <Loader2 aria-label="Đang tìm" className={cn(ICON_CLASS, "animate-spin")} /> : null}
          {query ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Xóa nội dung tìm kiếm"
              onClick={() => {
                setQuery("");
                setSelectedIndex(0);
                inputRef.current?.focus();
              }}
            >
              <X />
            </Button>
          ) : null}
          {assistantEnabled ? (
            <Pressable
              onMouseDown={(e) => e.preventDefault()}
              onClick={askAssistant}
              className="flex h-7 shrink-0 items-center gap-1.5 rounded-sm px-1.5 text-xs text-muted-foreground hover:text-foreground max-md:hidden"
            >
              Hỏi Trợ lý
              <Kbd>Tab</Kbd>
            </Pressable>
          ) : null}
        </div>

        <div
          ref={listRef}
          id={LISTBOX_ID}
          role="listbox"
          aria-label="Kết quả"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 pb-1.5 empty:hidden md:max-h-[min(480px,60dvh)]"
        >
          {groups.map((group) => (
            <div key={group.key} role={group.label ? "group" : undefined} aria-label={group.label} className="not-first:mt-1">
              {group.label ? (
                <div className="flex h-8 items-center justify-between px-3 text-xs text-muted-foreground">
                  <span aria-hidden>{group.label}</span>
                  {group.key === "recent" ? (
                    <Pressable
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={clearRecentSearches}
                      className="rounded-sm px-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Xóa
                    </Pressable>
                  ) : null}
                </div>
              ) : null}
              {group.items.map((item) => {
                const index = runningIndex++;
                return (
                  <div
                    key={flatItemKey(item)}
                    id={`${LISTBOX_ID}-${index}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseMove={() => index !== activeIndex && setSelectedIndex(index)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => executeItem(item, e.metaKey || e.ctrlKey)}
                    className={cn(
                      "flex h-10 cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 text-compact text-foreground",
                      index === activeIndex && "bg-accent"
                    )}
                  >
                    <PaletteRow item={item} query={trimmedQuery} />
                  </div>
                );
              })}
            </div>
          ))}
          {showEmpty ? (
            <p className="px-2 py-6 text-center text-compact text-muted-foreground">
              {searchFailed ? (
                <span className="text-destructive">Chưa tìm được, thử lại sau.</span>
              ) : (
                <>Không có kết quả cho “{trimmedQuery}”. Thử mã nhiệm vụ, số văn bản hoặc tên cán bộ.</>
              )}
            </p>
          ) : null}
        </div>

        <p aria-live="polite" className="sr-only">
          {trimmedQuery && !isLoading ? `${flatItems.length} kết quả` : ""}
        </p>
      </div>
    </StandardDialog>
  );
}

/** Một dòng 40px như Linear: icon 16px · tên cắt cuối · thông tin phụ hoặc phím tắt bên phải (text-xs) */
function PaletteRow({ item, query }: { item: FlatItem; query: string }) {
  switch (item.kind) {
    case "navigation":
    case "command": {
      const Icon = item.item.icon;
      return (
        <>
          <Icon aria-hidden className={ICON_CLASS} />
          <span className="min-w-0 flex-1 truncate">
            <HighlightedText text={item.item.title} query={query} />
          </span>
          {item.item.shortcut ? (
            <span className="flex shrink-0 gap-1 max-md:hidden" aria-label={`Phím tắt ${item.item.shortcut.join(" ")}`}>
              {item.item.shortcut.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </span>
          ) : null}
        </>
      );
    }
    case "task":
      return <TaskRowContent task={item.item} query={query} />;
    case "document": {
      const doc = item.item;
      const DocIcon = DOCUMENT_TYPE_ICON[doc.type ?? ""] ?? IconSidebarDocLines;
      const number = doc.originalNumber || (doc.registrationNumber ? `Số đến ${doc.registrationNumber}` : "");
      return (
        <>
          <DocIcon aria-hidden className={ICON_CLASS} />
          <span className="min-w-0 flex-1 truncate" title={doc.summary}>
            <HighlightedText text={doc.summary || "(Chưa có trích yếu)"} query={query} />
          </span>
          {number ? (
            <span className="max-w-[140px] shrink-0 truncate text-xs text-muted-foreground max-md:hidden">
              <HighlightedText text={number} query={query} />
            </span>
          ) : null}
          {doc.issuedDate ? (
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatDisplayDate(doc.issuedDate)}</span>
          ) : null}
        </>
      );
    }
    case "user": {
      const person = item.item;
      return (
        <>
          <UserAvatar name={person.name} avatarUrl={person.avatarUrl} size="xs" />
          <span className="min-w-0 flex-1 truncate">
            <HighlightedText text={person.name} query={query} />
          </span>
          {person.title ? (
            <span className="max-w-[45%] shrink-0 truncate text-xs text-muted-foreground">{person.title}</span>
          ) : null}
        </>
      );
    }
    case "all-results":
      return (
        <>
          <ArrowRight aria-hidden className={ICON_CLASS} />
          <span className="min-w-0 flex-1 truncate text-muted-foreground">
            Xem tất cả kết quả cho “<span className="text-foreground">{item.query}</span>”
          </span>
        </>
      );
    case "recent":
      return (
        <>
          <IconSidebarHistory className={ICON_CLASS} />
          <span className="min-w-0 flex-1 truncate">{item.item.title}</span>
          {item.item.subtitle ? (
            <span className="max-w-[40%] shrink-0 truncate text-xs text-muted-foreground">{item.item.subtitle}</span>
          ) : null}
        </>
      );
  }
}

function TaskRowContent({ task, query }: { task: SearchTaskResult; query: string }) {
  // Việc đã xong/hủy không hiện hạn (tránh "Trễ hạn" cho việc đã hoàn thành)
  const done = task.status === "COMPLETED" || task.status === "CANCELLED";
  const days = task.dueDate && !done ? daysUntil(task.dueDate) : null;
  const dueTone = days === null ? "" : days < 0 ? "text-destructive" : days <= DUE_SOON_DAYS ? "text-warning" : "text-muted-foreground";
  const lead = task.actors?.find((actor) => actor.isPrimaryDRI)?.user;
  return (
    <>
      <TaskStatusCircle status={task.status} />
      <span className="min-w-0 flex-1 truncate" title={task.title}>
        <HighlightedText text={task.title} query={query} />
      </span>
      {/* Mã dài cỡ 110px (NV-2026-10-029) nên đứng sau tên, không chiếm đầu dòng; điện thoại ẩn mã */}
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground max-md:hidden">
        <HighlightedText text={task.code} query={query} />
      </span>
      {/* Cột hạn và avatar rộng cố định (kể cả khi trống) để mã các dòng thẳng cột */}
      <span className={cn("w-24 shrink-0 truncate text-right text-xs tabular-nums", dueTone)}>
        {days !== null ? formatRelativeDate(task.dueDate) : null}
      </span>
      <span className="flex size-4 shrink-0 items-center justify-center">
        {lead ? <UserAvatar name={lead.name} avatarUrl={lead.avatarUrl} size="xs" /> : null}
      </span>
    </>
  );
}

export default CommandSearchModal;
