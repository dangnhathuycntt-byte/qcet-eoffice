"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  CheckSquare,
  Users,
  LayoutDashboard,
  Calendar,
  FileText,
  Building2,
  Bell,
  PlusCircle,
  ArrowRight,
  Loader2,
  Mail,
  Phone,
  ChevronRight,
  ShieldCheck,
  Clock,
  ExternalLink,
  Trash2,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  highlightMatchSegments,
  scoreVietnameseSearch,
} from "@/lib/search/vietnamese-search";
import type {
  SearchTaskResult,
  SearchUserResult,
  SearchDocumentResult,
} from "@/app/api/search/route";

export interface QuickAction {
  id: string;
  title: string;
  description: string;
  category: "navigation" | "action";
  icon: React.ElementType;
  shortcut?: string;
  keywords?: string[];
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

const RECENT_SEARCHES_STORAGE_KEY = "qcet_recent_searches";
const MAX_RECENT_ITEMS = 5;

function HighlightedText({
  text,
  query,
  className,
}: {
  text: string;
  query: string;
  className?: string;
}) {
  const segments = React.useMemo(
    () => highlightMatchSegments(text, query),
    [text, query]
  );

  return (
    <span className={className}>
      {segments.map((segment, idx) =>
        segment.match ? (
          <mark
            key={idx}
            className="bg-amber-100 text-amber-950 font-medium rounded-xs px-0.5"
          >
            {segment.text}
          </mark>
        ) : (
          <span key={idx}>{segment.text}</span>
        )
      )}
    </span>
  );
}

export function CommandSearchModal({ className }: CommandSearchModalProps = {}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<
    "all" | "tasks" | "documents" | "actions" | "users"
  >("all");
  const [isLoading, setIsLoading] = React.useState(false);
  const [tasks, setTasks] = React.useState<SearchTaskResult[]>([]);
  const [documents, setDocuments] = React.useState<SearchDocumentResult[]>([]);
  const [users, setUsers] = React.useState<SearchUserResult[]>([]);
  const [recentSearches, setRecentSearches] = React.useState<RecentSearchItem[]>([]);
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const searchCacheRef = React.useRef<
    Map<
      string,
      {
        tasks: SearchTaskResult[];
        documents: SearchDocumentResult[];
        users: SearchUserResult[];
      }
    >
  >(new Map());

  // Load recent searches from localStorage on mount
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as RecentSearchItem[];
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed.slice(0, MAX_RECENT_ITEMS));
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [isOpen]);

  const saveRecentItem = React.useCallback((item: RecentSearchItem) => {
    try {
      setRecentSearches((prev) => {
        const filtered = prev.filter((i) => i.id !== item.id);
        const updated = [item, ...filtered].slice(0, MAX_RECENT_ITEMS);
        try {
          localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      });
    } catch {
      // ignore
    }
  }, []);

  const clearRecentSearches = React.useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      localStorage.removeItem(RECENT_SEARCHES_STORAGE_KEY);
      setRecentSearches([]);
    } catch {
      // ignore
    }
  }, []);

  // Close modal helper
  const handleClose = React.useCallback(() => {
    setIsOpen(false);
    setQuery("");
  }, []);

  // Task click / select handler
  const handleSelectTask = React.useCallback(
    (task: SearchTaskResult, inNewTab = false) => {
      saveRecentItem({
        id: `task-${task.id}`,
        type: "task",
        title: `${task.code}: ${task.title}`,
        subtitle: task.department?.name || "Nhiệm vụ trường",
        timestamp: Date.now(),
        data: task,
      });

      handleClose();

      if (inNewTab) {
        window.open(`/?zone=tasks&taskId=${task.id}`, "_blank");
        return;
      }

      window.dispatchEvent(
        new CustomEvent("qcet:open-task-detail", {
          detail: { taskId: task.id },
        })
      );

      const params = new URLSearchParams(window.location.search);
      params.set("taskId", task.id);
      params.set("zone", "tasks");
      router.push(`/?${params.toString()}`);
    },
    [handleClose, router, saveRecentItem]
  );

  // Document click / select handler
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

      handleClose();

      const targetUrl = `/documents/${doc.id}`;
      if (inNewTab) {
        window.open(targetUrl, "_blank");
      } else {
        router.push(targetUrl);
      }
    },
    [handleClose, router, saveRecentItem]
  );

  // User contact handler
  const handleSelectUser = React.useCallback(
    (user: SearchUserResult) => {
      saveRecentItem({
        id: `user-${user.id}`,
        type: "user",
        title: user.name,
        subtitle: `${user.title || "Cán bộ"} · ${user.department?.name || "QCET"}`,
        timestamp: Date.now(),
        data: user,
      });

      handleClose();
      if (user.email) {
        window.location.href = `mailto:${user.email}`;
      }
    },
    [handleClose, saveRecentItem]
  );

  // Define Quick Actions
  const quickActions = React.useMemo<QuickAction[]>(() => {
    return [
      {
        id: "create-task",
        title: "Tạo nhiệm vụ",
        description: "Khởi tạo công việc / nhiệm vụ mới cấp trường hoặc cấp đơn vị",
        category: "action",
        icon: PlusCircle,
        shortcut: "N",
        keywords: ["tao nhiem vu", "tao cong viec", "them nhiem vu", "new task", "create task"],
        action: () => {
          handleClose();
          window.dispatchEvent(new CustomEvent("qcet:open-create-task"));
        },
      },
      {
        id: "action-review-tasks",
        title: "Xem việc chờ duyệt",
        description: "Lọc các nhiệm vụ đang chờ phê duyệt hoặc nghiệm thu kết quả",
        category: "action",
        icon: ShieldCheck,
        shortcut: "P",
        keywords: ["xem viec cho duyet", "cho duyet", "phe duyet", "nghiem thu", "kiem tra", "pending", "review"],
        action: (newTab) => {
          handleClose();
          window.dispatchEvent(
            new CustomEvent("qcet:set-smart-tab", { detail: { tab: "review" } })
          );
          if (newTab) window.open("/?zone=tasks&tab=review", "_blank");
          else router.push("/?zone=tasks&tab=review");
        },
      },
      {
        id: "action-my-tasks",
        title: "Đổi sang Của tôi",
        description: "Chuyển phạm vi xem sang công việc cá nhân được giao",
        category: "action",
        icon: CheckSquare,
        shortcut: "M",
        keywords: ["doi sang cua toi", "cua toi", "ca nhan", "my tasks", "my", "toi"],
        action: (newTab) => {
          handleClose();
          window.dispatchEvent(
            new CustomEvent("qcet:set-task-scope", { detail: { scope: "my" } })
          );
          window.dispatchEvent(
            new CustomEvent("qcet:set-smart-tab", { detail: { tab: "my_tasks" } })
          );
          if (newTab) window.open("/?zone=tasks&scope=my", "_blank");
          else router.push("/?zone=tasks&scope=my");
        },
      },
      {
        id: "nav-documents",
        title: "Đi tới Văn bản",
        description: "Sổ văn bản điện tử, văn bản đến, đi và chỉ đạo điều hành",
        category: "navigation",
        icon: FileText,
        shortcut: "V",
        keywords: ["di toi van ban", "van ban", "vb", "so van ban", "cong van", "tai lieu", "documents"],
        action: (newTab) => {
          handleClose();
          if (newTab) window.open("/documents", "_blank");
          else router.push("/documents");
        },
      },
      {
        id: "nav-calendar",
        title: "Đi tới Lịch",
        description: "Lịch công tác trường và kế hoạch làm việc tuần/tháng",
        category: "navigation",
        icon: Calendar,
        shortcut: "C",
        keywords: ["di toi lich", "lich", "calendar", "ke hoach tuan", "lich cong tac"],
        action: (newTab) => {
          handleClose();
          if (newTab) window.open("/?zone=calendar", "_blank");
          else router.push("/?zone=calendar");
        },
      },
      {
        id: "nav-dashboard",
        title: "Bàn làm việc (Tổng quan)",
        description: "Bảng điều hành số liệu, chỉ số KPI và tiến độ trọng tâm",
        category: "navigation",
        icon: LayoutDashboard,
        shortcut: "D",
        keywords: ["ban lam viec", "tong quan", "dashboard", "kpi", "tien do"],
        action: (newTab) => {
          handleClose();
          if (newTab) window.open("/?zone=dashboard", "_blank");
          else router.push("/?zone=dashboard");
        },
      },
      {
        id: "nav-tasks",
        title: "Danh sách công việc",
        description: "Xem và quản lý bảng nhiệm vụ, tiến độ phân công DACUM",
        category: "navigation",
        icon: CheckSquare,
        shortcut: "T",
        keywords: ["danh sach cong viec", "nhiem vu", "tasks", "dacum"],
        action: (newTab) => {
          handleClose();
          if (newTab) window.open("/?zone=tasks", "_blank");
          else router.push("/?zone=tasks");
        },
      },
      {
        id: "nav-portal",
        title: "Cổng chỉ đạo Ban Giám hiệu",
        description: "Trung tâm điều hành và giải quyết điểm nghẽn toàn trường",
        category: "navigation",
        icon: ShieldCheck,
        keywords: ["cong chi dao", "ban giam hieu", "portal", "diem nghen"],
        action: (newTab) => {
          handleClose();
          if (newTab) window.open("/?zone=portal", "_blank");
          else router.push("/?zone=portal");
        },
      },
      {
        id: "nav-org",
        title: "Cơ cấu tổ chức & Nhân sự",
        description: "Sơ đồ phòng ban, khoa và thông tin cán bộ giảng viên",
        category: "navigation",
        icon: Building2,
        keywords: ["co cau to chuc", "nhan su", "phong ban", "khoa", "to chuc"],
        action: (newTab) => {
          handleClose();
          if (newTab) window.open("/?zone=org", "_blank");
          else router.push("/?zone=org");
        },
      },
      {
        id: "nav-notifications",
        title: "Trung tâm Thông báo",
        description: "Nhật ký chỉ đạo, cảnh báo hạn chót và thông báo giao việc",
        category: "navigation",
        icon: Bell,
        keywords: ["thong bao", "notifications", "canh bao", "nhat ky"],
        action: (newTab) => {
          handleClose();
          if (newTab) window.open("/notifications", "_blank");
          else router.push("/notifications");
        },
      },
    ];
  }, [handleClose, router]);

  // Global event listeners
  React.useEffect(() => {
    const handleOpenEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ open?: boolean } | undefined>;
      if (customEvent?.detail?.open !== undefined) {
        setIsOpen(customEvent.detail.open);
      } else {
        setIsOpen(true);
      }
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

  // Auto focus input when opened
  React.useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen]);

  // Debounced search with client in-memory cache
  React.useEffect(() => {
    if (!isOpen) return;

    const trimmed = query.trim();
    if (searchCacheRef.current.has(trimmed)) {
      const cached = searchCacheRef.current.get(trimmed)!;
      setTasks(cached.tasks);
      setDocuments(cached.documents);
      setUsers(cached.users);
      setIsLoading(false);
      setSelectedIndex(0);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    const timer = setTimeout(async () => {
      try {
        const url = trimmed
          ? `/api/search?q=${encodeURIComponent(trimmed)}`
          : "/api/search";
        const res = await fetch(url);
        if (!res.ok) throw new Error("Search failed");
        const json = await res.json();
        if (isMounted && json.success) {
          const t: SearchTaskResult[] = json.results?.tasks || [];
          const d: SearchDocumentResult[] = json.results?.documents || [];
          const u: SearchUserResult[] = json.results?.users || [];
          searchCacheRef.current.set(trimmed, { tasks: t, documents: d, users: u });
          setTasks(t);
          setDocuments(d);
          setUsers(u);
          setSelectedIndex(0);
        }
      } catch {
        if (isMounted) {
          setTasks([]);
          setDocuments([]);
          setUsers([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isOpen, query]);

  // Filter actions based on query and score
  const filteredActions = React.useMemo(() => {
    const q = query.trim();
    if (!q) return quickActions;
    return quickActions
      .map((a) => {
        const keywords = [a.description, ...(a.keywords || [])];
        const score = Math.max(
          scoreVietnameseSearch(a.title, q, keywords),
          a.shortcut && a.shortcut.toLowerCase() === q.toLowerCase() ? 95 : 0
        );
        return { action: a, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.action);
  }, [query, quickActions]);

  // Filtered lists according to active tab
  const displayTasks = activeTab === "all" || activeTab === "tasks" ? tasks : [];
  const displayDocuments = activeTab === "all" || activeTab === "documents" ? documents : [];
  const displayActions = activeTab === "all" || activeTab === "actions" ? filteredActions : [];
  const displayUsers = activeTab === "all" || activeTab === "users" ? users : [];

  // Build flat items list for keyboard navigation
  type FlatItem =
    | { type: "recent"; item: RecentSearchItem }
    | { type: "action"; item: QuickAction }
    | { type: "task"; item: SearchTaskResult }
    | { type: "document"; item: SearchDocumentResult }
    | { type: "user"; item: SearchUserResult };

  const flatItems = React.useMemo<FlatItem[]>(() => {
    const items: FlatItem[] = [];
    if (!query.trim() && recentSearches.length > 0 && activeTab === "all") {
      recentSearches.forEach((r) => items.push({ type: "recent", item: r }));
    }
    displayActions.forEach((a) => items.push({ type: "action", item: a }));
    displayTasks.forEach((t) => items.push({ type: "task", item: t }));
    displayDocuments.forEach((d) => items.push({ type: "document", item: d }));
    displayUsers.forEach((u) => items.push({ type: "user", item: u }));
    return items;
  }, [activeTab, displayActions, displayTasks, displayDocuments, displayUsers, query, recentSearches]);

  // Execute selected item
  const executeItem = React.useCallback(
    (item: FlatItem, inNewTab = false) => {
      if (item.type === "action") {
        item.item.action(inNewTab);
      } else if (item.type === "task") {
        handleSelectTask(item.item, inNewTab);
      } else if (item.type === "document") {
        handleSelectDocument(item.item, inNewTab);
      } else if (item.type === "user") {
        handleSelectUser(item.item);
      } else if (item.type === "recent") {
        if (item.item.type === "task" && item.item.data) {
          handleSelectTask(item.item.data, inNewTab);
        } else if (item.item.type === "document" && item.item.data) {
          handleSelectDocument(item.item.data, inNewTab);
        } else if (item.item.type === "user" && item.item.data) {
          handleSelectUser(item.item.data);
        }
      }
    },
    [handleSelectTask, handleSelectDocument, handleSelectUser]
  );

  // Keyboard navigation inside modal
  const handleKeyDownInList = (e: React.KeyboardEvent) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const tabs: Array<"all" | "tasks" | "documents" | "actions" | "users"> = [
        "all",
        "tasks",
        "documents",
        "actions",
        "users",
      ];
      const currentIdx = tabs.indexOf(activeTab);
      const nextIdx = e.shiftKey
        ? (currentIdx - 1 + tabs.length) % tabs.length
        : (currentIdx + 1) % tabs.length;
      setActiveTab(tabs[nextIdx]);
      setSelectedIndex(0);
      return;
    }

    if (flatItems.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % flatItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + flatItems.length) % flatItems.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = flatItems[selectedIndex];
      if (target) {
        const inNewTab = e.metaKey || e.ctrlKey;
        executeItem(target, inNewTab);
      }
    }
  };

  // Auto scroll active option into view
  React.useEffect(() => {
    if (!listRef.current) return;
    const selectedEl = listRef.current.querySelector(
      '[aria-selected="true"]'
    ) as HTMLElement | null;
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tìm kiếm nhanh hệ thống (Command Palette)"
      data-slot="command-palette"
      className={cn(
        "fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-4 md:p-6 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150",
        className
      )}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-98 duration-150"
        onKeyDown={handleKeyDownInList}
      >
        {/* Search Header Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-200 bg-white">
          <Search className="w-5 h-5 text-neutral-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={flatItems.length > 0}
            aria-autocomplete="list"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Tìm theo tên việc, mã số, văn bản, viết tắt khoa (cntt, vb)..."
            className="flex-1 bg-transparent text-sm sm:text-base font-normal text-neutral-900 placeholder:text-neutral-400 focus:outline-hidden"
          />
          {isLoading && <Loader2 className="w-4 h-4 text-neutral-400 animate-spin shrink-0" />}
          {query && !isLoading && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="p-1 rounded-md text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
              aria-label="Xóa nội dung tìm kiếm"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-xs font-mono text-neutral-500 bg-neutral-100 hover:bg-neutral-200 rounded border border-neutral-200 transition-colors"
          >
            ESC
          </button>
        </div>

        {/* Tab Filters Bar */}
        <div className="flex items-center gap-1.5 px-4 py-2 bg-neutral-50/70 border-b border-neutral-100 text-xs overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setActiveTab("all");
              setSelectedIndex(0);
            }}
            className={cn(
              "px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap",
              activeTab === "all"
                ? "bg-white text-neutral-900 shadow-2xs border border-neutral-200"
                : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100/80"
            )}
          >
            Tất cả
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("tasks");
              setSelectedIndex(0);
            }}
            className={cn(
              "px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap flex items-center gap-1",
              activeTab === "tasks"
                ? "bg-white text-neutral-900 shadow-2xs border border-neutral-200"
                : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100/80"
            )}
          >
            <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
            Công việc {tasks.length > 0 && `(${tasks.length})`}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("documents");
              setSelectedIndex(0);
            }}
            className={cn(
              "px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap flex items-center gap-1",
              activeTab === "documents"
                ? "bg-white text-neutral-900 shadow-2xs border border-neutral-200"
                : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100/80"
            )}
          >
            <FileText className="w-3.5 h-3.5 text-amber-600" />
            Văn bản {documents.length > 0 && `(${documents.length})`}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("actions");
              setSelectedIndex(0);
            }}
            className={cn(
              "px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap flex items-center gap-1",
              activeTab === "actions"
                ? "bg-white text-neutral-900 shadow-2xs border border-neutral-200"
                : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100/80"
            )}
          >
            <Zap className="w-3.5 h-3.5 text-violet-600" />
            Thao tác nhanh
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("users");
              setSelectedIndex(0);
            }}
            className={cn(
              "px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap flex items-center gap-1",
              activeTab === "users"
                ? "bg-white text-neutral-900 shadow-2xs border border-neutral-200"
                : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100/80"
            )}
          >
            <Users className="w-3.5 h-3.5 text-emerald-600" />
            Nhân sự {users.length > 0 && `(${users.length})`}
          </button>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          role="listbox"
          className="flex-1 overflow-y-auto p-2 space-y-4 max-h-[52vh] focus:outline-hidden"
        >
          {/* Empty State */}
          {!isLoading && flatItems.length === 0 && (
            <div className="py-12 px-4 text-center">
              <Search className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-neutral-700">
                Không tìm thấy kết quả phù hợp cho &ldquo;{query}&rdquo;
              </p>
              <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                Thử tìm theo mã công việc (ví dụ: NV-2026), số văn bản (ví dụ: 125/QĐ), viết tắt khoa (cntt, dbcl) hoặc họ tên cán bộ.
              </p>
            </div>
          )}

          {/* Section: Recent Searches */}
          {!query.trim() && recentSearches.length > 0 && activeTab === "all" && (
            <div>
              <div className="flex items-center justify-between px-2.5 py-1 mb-1">
                <span className="text-xs font-semibold tracking-wider text-neutral-400 uppercase flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-neutral-400" />
                  Đã xem gần đây
                </span>
                <button
                  type="button"
                  onClick={clearRecentSearches}
                  className="text-xs text-neutral-400 hover:text-neutral-600 flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Xóa lịch sử
                </button>
              </div>
              <div className="space-y-0.5">
                {recentSearches.map((item, idx) => {
                  const isSelected = selectedIndex === idx;
                  return (
                    <div
                      key={item.id}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => executeItem({ type: "recent", item })}
                      className={cn(
                        "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer group",
                        isSelected
                          ? "bg-neutral-100 text-neutral-900 font-medium"
                          : "text-neutral-700 hover:bg-neutral-50"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <Clock className="w-4 h-4 text-neutral-400 shrink-0" />
                        <div className="min-w-0 flex-1 truncate">
                          <span className="text-sm text-neutral-800">{item.title}</span>
                          {item.subtitle && (
                            <span className="text-xs text-neutral-400 ml-2">
                              {item.subtitle}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-neutral-500 shrink-0" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section: Quick Actions */}
          {displayActions.length > 0 && (
            <div>
              <div className="px-2.5 py-1 text-xs font-semibold tracking-wider text-neutral-400 uppercase">
                Thao tác & Điều hướng nhanh
              </div>
              <div className="space-y-0.5">
                {displayActions.map((action) => {
                  const currentFlatIndex = flatItems.findIndex(
                    (f) => f.type === "action" && f.item.id === action.id
                  );
                  const isSelected = selectedIndex === currentFlatIndex;
                  const Icon = action.icon;

                  return (
                    <div
                      key={action.id}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => action.action()}
                      className={cn(
                        "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer group",
                        isSelected
                          ? "bg-neutral-100 text-neutral-900 font-medium"
                          : "text-neutral-700 hover:bg-neutral-50"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={cn(
                            "w-7 h-7 rounded-md flex items-center justify-center shrink-0",
                            action.category === "action"
                              ? "bg-blue-50 text-blue-600"
                              : "bg-neutral-100 text-neutral-600"
                          )}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-neutral-800">
                            <HighlightedText text={action.title} query={query} />
                          </p>
                          <p className="text-xs text-neutral-400 truncate">
                            <HighlightedText text={action.description} query={query} />
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {action.shortcut && (
                          <kbd className="px-1.5 py-0.5 text-xs font-mono text-neutral-500 bg-white rounded border border-neutral-200">
                            {action.shortcut}
                          </kbd>
                        )}
                        <ArrowRight className="w-3.5 h-3.5 text-neutral-300 group-hover:text-neutral-500" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section: Tasks */}
          {displayTasks.length > 0 && (
            <div>
              <div className="px-2.5 py-1 text-xs font-semibold tracking-wider text-neutral-400 uppercase flex items-center justify-between">
                <span>Nhiệm vụ & Kế hoạch ({displayTasks.length})</span>
                <span className="text-xs text-neutral-400 lowercase">phím ↵ để mở</span>
              </div>
              <div className="space-y-1">
                {displayTasks.map((task) => {
                  const currentFlatIndex = flatItems.findIndex(
                    (f) => f.type === "task" && f.item.id === task.id
                  );
                  const isSelected = selectedIndex === currentFlatIndex;

                  return (
                    <div
                      key={task.id}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelectTask(task)}
                      className={cn(
                        "w-full flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer group",
                        isSelected
                          ? "bg-neutral-50/90 border-neutral-300 shadow-2xs"
                          : "border-transparent hover:bg-neutral-50/60 hover:border-neutral-200"
                      )}
                    >
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <CheckSquare className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono font-medium text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-200">
                              <HighlightedText text={task.code} query={query} />
                            </span>
                            <span className="text-sm font-medium text-neutral-900 truncate">
                              <HighlightedText text={task.title} query={query} />
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500 flex-wrap">
                            {task.department && (
                              <span className="flex items-center gap-1 text-neutral-600">
                                <Building2 className="w-3 h-3 text-neutral-400" />
                                <HighlightedText
                                  text={task.department.shortName || task.department.name}
                                  query={query}
                                />
                              </span>
                            )}
                            <span>Tiến độ: {task.progressPercent}%</span>
                            {task.dueDate && (
                              <span>
                                Hạn: {new Date(task.dueDate).toLocaleDateString("vi-VN")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                        <span>Chi tiết</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section: Documents */}
          {displayDocuments.length > 0 && (
            <div>
              <div className="px-2.5 py-1 text-xs font-semibold tracking-wider text-neutral-400 uppercase flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-600" />
                  Văn bản & Chỉ đạo ({displayDocuments.length})
                </span>
                <span className="text-xs text-neutral-400 lowercase">phím ↵ để mở</span>
              </div>
              <div className="space-y-1">
                {displayDocuments.map((doc) => {
                  const currentFlatIndex = flatItems.findIndex(
                    (f) => f.type === "document" && f.item.id === doc.id
                  );
                  const isSelected = selectedIndex === currentFlatIndex;

                  return (
                    <div
                      key={doc.id}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelectDocument(doc)}
                      className={cn(
                        "w-full flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer group",
                        isSelected
                          ? "bg-neutral-50/90 border-neutral-300 shadow-2xs"
                          : "border-transparent hover:bg-neutral-50/60 hover:border-neutral-200"
                      )}
                    >
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <FileText className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono font-bold text-amber-900 bg-amber-100/70 px-1.5 py-0.5 rounded border border-amber-200/60">
                              <HighlightedText text={doc.originalNumber || "VB-QCET"} query={query} />
                            </span>
                            <span className="text-xs font-semibold text-neutral-600 bg-neutral-100 px-1.5 py-0.5 rounded">
                              {doc.category || "Văn bản"}
                            </span>
                            <span className="text-sm font-medium text-neutral-900 truncate">
                              <HighlightedText text={doc.summary} query={query} />
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500 flex-wrap">
                            {doc.issuingAuthority && (
                              <span className="text-neutral-600">
                                {doc.issuingAuthority}
                              </span>
                            )}
                            {doc.issuedDate && (
                              <span className="text-neutral-400">
                                Ngày: {new Date(doc.issuedDate).toLocaleDateString("vi-VN")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                        <span>Xem</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section: Users */}
          {displayUsers.length > 0 && (
            <div>
              <div className="px-2.5 py-1 text-xs font-semibold tracking-wider text-neutral-400 uppercase flex items-center justify-between">
                <span>Cán bộ & Giảng viên ({displayUsers.length})</span>
                <span className="text-xs text-neutral-400 lowercase">phím ↵ để liên hệ</span>
              </div>
              <div className="space-y-1">
                {displayUsers.map((user) => {
                  const currentFlatIndex = flatItems.findIndex(
                    (f) => f.type === "user" && f.item.id === user.id
                  );
                  const isSelected = selectedIndex === currentFlatIndex;

                  return (
                    <div
                      key={user.id}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelectUser(user)}
                      className={cn(
                        "w-full flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer group",
                        isSelected
                          ? "bg-neutral-50/90 border-neutral-300 shadow-2xs"
                          : "border-transparent hover:bg-neutral-50/60 hover:border-neutral-200"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-semibold text-xs flex items-center justify-center shrink-0 border border-blue-200">
                          {user.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-neutral-900">
                              <HighlightedText text={user.name} query={query} />
                            </span>
                            {user.title && (
                              <span className="text-xs text-neutral-500">
                                {user.title}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-neutral-500 flex-wrap">
                            {user.department && (
                              <span className="flex items-center gap-1 text-neutral-600">
                                <Building2 className="w-3 h-3 text-neutral-400" />
                                {user.department.name}
                              </span>
                            )}
                            {user.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3 text-neutral-400" />
                                <HighlightedText text={user.email} query={query} />
                              </span>
                            )}
                            {user.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-neutral-400" />
                                {user.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                        <span>Email</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer shortcuts hint bar */}
        <div className="px-4 py-2.5 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between text-xs text-neutral-500">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 font-mono text-xs bg-white rounded border border-neutral-200 text-neutral-600">
                ↵
              </kbd>
              <span>Mở</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 font-mono text-xs bg-white rounded border border-neutral-200 text-neutral-600">
                ⌘↵
              </kbd>
              <span>Mở tab mới</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 font-mono text-xs bg-white rounded border border-neutral-200 text-neutral-600">
                Tab
              </kbd>
              <span>Chuyển nhóm</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 font-mono text-xs bg-white rounded border border-neutral-200 text-neutral-600">
                ↑↓
              </kbd>
              <span>Di chuyển</span>
            </span>
          </div>
          <div className="flex items-center gap-1 text-neutral-400">
            <kbd className="px-1.5 py-0.5 font-mono text-xs bg-white rounded border border-neutral-200 text-neutral-600">
              Esc
            </kbd>
            <span>Đóng</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CommandSearchModal;
