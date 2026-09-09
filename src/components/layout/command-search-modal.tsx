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
  Smartphone,
  HelpCircle,
  PlusCircle,
  ArrowRight,
  Loader2,
  Mail,
  Phone,
  CornerDownLeft,
  ChevronRight,
  ShieldCheck,
  Clock,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  highlightMatchSegments,
  scoreVietnameseSearch,
} from "@/lib/search/vietnamese-search";
import type { SearchTaskResult, SearchUserResult } from "@/app/api/search/route";

interface QuickAction {
  id: string;
  title: string;
  description: string;
  category: "navigation" | "action";
  icon: React.ElementType;
  shortcut?: string;
  action: (inNewTab?: boolean) => void;
}

interface RecentSearchItem {
  id: string;
  type: "task" | "user" | "action";
  title: string;
  subtitle?: string;
  timestamp: number;
  data?: any;
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

export function CommandSearchModal() {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<"all" | "tasks" | "users" | "actions">("all");
  const [isLoading, setIsLoading] = React.useState(false);
  const [tasks, setTasks] = React.useState<SearchTaskResult[]>([]);
  const [users, setUsers] = React.useState<SearchUserResult[]>([]);
  const [recentSearches, setRecentSearches] = React.useState<RecentSearchItem[]>([]);
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const searchCacheRef = React.useRef<
    Map<string, { tasks: SearchTaskResult[]; users: SearchUserResult[] }>
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
      router.push(`/?zone=tasks&taskId=${task.id}`);
    },
    [handleClose, router, saveRecentItem]
  );

  // User select handler
  const handleSelectUser = React.useCallback(
    (user: SearchUserResult) => {
      saveRecentItem({
        id: `user-${user.id}`,
        type: "user",
        title: user.name,
        subtitle: user.title || user.department?.name || user.email,
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
        title: "Tạo công việc / nhiệm vụ mới",
        description: "Khởi tạo công việc cấp trường hoặc cấp đơn vị trực thuộc",
        category: "action",
        icon: PlusCircle,
        shortcut: "N",
        action: () => {
          handleClose();
          window.dispatchEvent(new CustomEvent("qcet:open-create-task"));
        },
      },
      {
        id: "nav-dashboard",
        title: "Bàn làm việc (Tổng quan)",
        description: "Bảng điều hành số liệu, chỉ số KPI và tiến độ trọng tâm",
        category: "navigation",
        icon: LayoutDashboard,
        shortcut: "D",
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
        action: (newTab) => {
          handleClose();
          if (newTab) window.open("/?zone=tasks", "_blank");
          else router.push("/?zone=tasks");
        },
      },
      {
        id: "nav-calendar",
        title: "Lịch công tác trường",
        description: "Theo dõi kế hoạch làm việc tuần và tháng của Nhà trường",
        category: "navigation",
        icon: Calendar,
        shortcut: "C",
        action: (newTab) => {
          handleClose();
          if (newTab) window.open("/?zone=calendar", "_blank");
          else router.push("/?zone=calendar");
        },
      },
      {
        id: "nav-month-9",
        title: "Kỳ công tác Tháng 9/2026",
        description: "Chuyển nhanh sang dữ liệu tháng 9 năm học 2026 - 2027",
        category: "action",
        icon: Calendar,
        shortcut: "M",
        action: () => {
          handleClose();
          window.dispatchEvent(
            new CustomEvent("qcet:set-academic-month", {
              detail: { month: 9, year: "2026-2027" },
            })
          );
          router.push("/?zone=tasks&month=9");
        },
      },
      {
        id: "nav-documents",
        title: "Văn bản & Chỉ đạo",
        description: "Sổ văn bản điện tử, văn bản đến, đi và chỉ đạo điều hành",
        category: "navigation",
        icon: FileText,
        action: (newTab) => {
          handleClose();
          if (newTab) window.open("/?zone=documents", "_blank");
          else router.push("/?zone=documents");
        },
      },
      {
        id: "nav-portal",
        title: "Cổng chỉ đạo Ban Giám hiệu",
        description: "Trung tâm điều hành và giải quyết điểm nghẽn toàn trường",
        category: "navigation",
        icon: ShieldCheck,
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
        action: (newTab) => {
          handleClose();
          if (newTab) window.open("/notifications", "_blank");
          else router.push("/notifications");
        },
      },
      {
        id: "action-push",
        title: "Cài đặt Thông báo đẩy (Push)",
        description: "Bật nhận thông báo trực tiếp trên thiết bị cá nhân",
        category: "action",
        icon: Smartphone,
        action: () => {
          handleClose();
          window.dispatchEvent(new CustomEvent("qcet:open-push-onboarding"));
        },
      },
      {
        id: "action-tour",
        title: "Hướng dẫn sử dụng hệ thống",
        description: "Khởi động lại tour hướng dẫn các tính năng chính của QCET",
        category: "action",
        icon: HelpCircle,
        action: () => {
          handleClose();
          window.dispatchEvent(new CustomEvent("qcet:restart-onboarding"));
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
        const target = e.target as HTMLElement | null;
        const isEditable =
          target?.tagName === "INPUT" ||
          target?.tagName === "TEXTAREA" ||
          target?.isContentEditable;

        if (isEditable && target !== inputRef.current) {
          return;
        }

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
          const t = json.results?.tasks || [];
          const u = json.results?.users || [];
          searchCacheRef.current.set(trimmed, { tasks: t, users: u });
          setTasks(t);
          setUsers(u);
          setSelectedIndex(0);
        }
      } catch {
        if (isMounted) {
          setTasks([]);
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
        const score = Math.max(
          scoreVietnameseSearch(a.title, q, [a.description]),
          a.shortcut && a.shortcut.toLowerCase() === q.toLowerCase() ? 90 : 0
        );
        return { action: a, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.action);
  }, [query, quickActions]);

  // Filtered lists according to active tab
  const displayTasks = activeTab === "all" || activeTab === "tasks" ? tasks : [];
  const displayUsers = activeTab === "all" || activeTab === "users" ? users : [];
  const displayActions = activeTab === "all" || activeTab === "actions" ? filteredActions : [];

  // Build flat items list for keyboard navigation
  type FlatItem =
    | { type: "recent"; item: RecentSearchItem }
    | { type: "action"; item: QuickAction }
    | { type: "task"; item: SearchTaskResult }
    | { type: "user"; item: SearchUserResult };

  const flatItems = React.useMemo<FlatItem[]>(() => {
    const items: FlatItem[] = [];
    if (!query.trim() && recentSearches.length > 0 && activeTab === "all") {
      recentSearches.forEach((r) => items.push({ type: "recent", item: r }));
    }
    displayActions.forEach((a) => items.push({ type: "action", item: a }));
    displayTasks.forEach((t) => items.push({ type: "task", item: t }));
    displayUsers.forEach((u) => items.push({ type: "user", item: u }));
    return items;
  }, [activeTab, displayActions, displayTasks, displayUsers, query, recentSearches]);

  // Execute selected item
  const executeItem = React.useCallback(
    (item: FlatItem, inNewTab = false) => {
      if (item.type === "action") {
        item.item.action(inNewTab);
      } else if (item.type === "task") {
        handleSelectTask(item.item, inNewTab);
      } else if (item.type === "user") {
        handleSelectUser(item.item);
      } else if (item.type === "recent") {
        if (item.item.type === "task" && item.item.data) {
          handleSelectTask(item.item.data, inNewTab);
        } else if (item.item.type === "user" && item.item.data) {
          handleSelectUser(item.item.data);
        }
      }
    },
    [handleSelectTask, handleSelectUser]
  );

  // Keyboard navigation
  const handleKeyDownInList = (e: React.KeyboardEvent) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const tabs: Array<"all" | "tasks" | "users" | "actions"> = [
        "all",
        "tasks",
        "users",
        "actions",
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
      const current = flatItems[selectedIndex];
      if (!current) return;
      executeItem(current, e.metaKey || e.ctrlKey);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return { label: "Hoàn thành", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
      case "IN_PROGRESS":
        return { label: "Đang làm", color: "bg-blue-50 text-blue-700 border-blue-200" };
      case "WAITING_APPROVAL":
        return { label: "Chờ duyệt", color: "bg-amber-50 text-amber-700 border-amber-200" };
      case "REJECTED":
        return { label: "Từ chối", color: "bg-rose-50 text-rose-700 border-rose-200" };
      default:
        return { label: "Chưa bắt đầu", color: "bg-neutral-50 text-neutral-600 border-neutral-200" };
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tìm kiếm nhanh hệ thống"
      className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-4 md:p-6 pt-[10vh] sm:pt-[12vh] animate-in fade-in duration-150"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-neutral-900/40 backdrop-blur-xs transition-opacity"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-neutral-200/80 overflow-hidden flex flex-col max-h-[80vh] z-10"
        onKeyDown={handleKeyDownInList}
      >
        {/* Search Header Bar */}
        <div className="flex items-center px-4 py-3 border-b border-neutral-100 gap-3 bg-white">
          <Search className="w-5 h-5 text-neutral-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={isOpen}
            aria-autocomplete="list"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Tìm theo tên việc, mã số, viết tắt khoa (cntt, dbcl)..."
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
            className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-xs font-medium text-neutral-400 bg-neutral-100 hover:bg-neutral-200 rounded border border-neutral-200 transition-colors"
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
          <button
            type="button"
            onClick={() => {
              setActiveTab("actions");
              setSelectedIndex(0);
            }}
            className={cn(
              "px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap",
              activeTab === "actions"
                ? "bg-white text-neutral-900 shadow-2xs border border-neutral-200"
                : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100/80"
            )}
          >
            Thao tác nhanh
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
                Thử tìm theo mã công việc (ví dụ: NV-2026), viết tắt khoa (cntt, dbcl) hoặc họ tên cán bộ.
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
                          <kbd className="px-1.5 py-0.5 text-xs font-mono text-neutral-400 bg-white rounded border border-neutral-200">
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
                <span className="text-xs text-neutral-400 lowercase">phím ↵ để mở chi tiết</span>
              </div>
              <div className="space-y-1">
                {displayTasks.map((task) => {
                  const currentFlatIndex = flatItems.findIndex(
                    (f) => f.type === "task" && f.item.id === task.id
                  );
                  const isSelected = selectedIndex === currentFlatIndex;
                  const statusInfo = getStatusBadge(task.status);

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
                            {task.dueDate && (
                              <span className="flex items-center gap-1 text-neutral-500">
                                <Calendar className="w-3 h-3 text-neutral-400" />
                                Hạn: {new Date(task.dueDate).toLocaleDateString("vi-VN")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span
                          className={cn(
                            "px-2 py-0.5 text-xs font-medium rounded border whitespace-nowrap",
                            statusInfo.color
                          )}
                        >
                          {statusInfo.label}
                        </span>
                        <CornerDownLeft className="w-3.5 h-3.5 text-neutral-300 group-hover:text-neutral-600" />
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
              <div className="px-2.5 py-1 text-xs font-semibold tracking-wider text-neutral-400 uppercase">
                Cán bộ & Nhân sự ({displayUsers.length})
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
                        "w-full flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer group",
                        isSelected
                          ? "bg-neutral-50/90 border-neutral-300 shadow-2xs"
                          : "border-transparent hover:bg-neutral-50/60 hover:border-neutral-200"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-xs flex items-center justify-center shrink-0 border border-emerald-200">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-neutral-900">
                            <HighlightedText text={user.name} query={query} />
                            {user.title && (
                              <span className="text-xs font-normal text-neutral-500 ml-1.5">
                                • <HighlightedText text={user.title} query={query} />
                              </span>
                            )}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-neutral-500">
                            {user.department && (
                              <span className="truncate">
                                <HighlightedText
                                  text={user.department.name}
                                  query={query}
                                />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {user.phone && (
                          <a
                            href={`tel:${user.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded transition-colors"
                            title={`Gọi: ${user.phone}`}
                            aria-label={`Gọi điện thoại cho ${user.name}`}
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <a
                          href={`mailto:${user.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded transition-colors"
                          title={`Email: ${user.email}`}
                          aria-label={`Gửi email cho ${user.name}`}
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Action Bar (Raycast / Linear Standard) */}
        <div className="flex items-center justify-between border-t border-neutral-100 px-4 py-2 text-xs text-neutral-500 bg-neutral-50/80 select-none">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-xs font-mono rounded bg-white border border-neutral-200 text-neutral-700 shadow-2xs">
                ↵
              </kbd>
              <span>Mở</span>
            </span>
            <span className="hidden sm:flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-xs font-mono rounded bg-white border border-neutral-200 text-neutral-700 shadow-2xs">
                ⌘↵
              </kbd>
              <span>Mở tab mới</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden md:flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-xs font-mono rounded bg-white border border-neutral-200 text-neutral-700 shadow-2xs">
                Tab
              </kbd>
              <span>Chuyển nhóm</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-xs font-mono rounded bg-white border border-neutral-200 text-neutral-700 shadow-2xs">
                ↑↓
              </kbd>
              <span>Di chuyển</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-xs font-mono rounded bg-white border border-neutral-200 text-neutral-700 shadow-2xs">
                Esc
              </kbd>
              <span>Đóng</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
