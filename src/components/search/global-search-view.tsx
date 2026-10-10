"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import {
  Search,
  ListChecks,
  FileText,
  Users,
  Loader2,
  AlertTriangle,
  Inbox,
  Clock,
  ArrowRight,
  ChevronRight,
  RefreshCw,
  Building2,
  Mail,
  Phone,
  CalendarDays,
  Flag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  fadeVariants,
  listItemVariants,
  staggerContainerVariants,
} from "@/lib/motion/variants";
import { motionTransition } from "@/lib/motion/tokens";

// ---------------------------------------------------------------------------
// Types (mirrors API response)
// ---------------------------------------------------------------------------

interface SearchTaskResult {
  id: string;
  code: string;
  title: string;
  scope: string;
  status: string;
  priority: string;
  progressPercent: number;
  dueDate: string;
  academicMonth: number;
  academicYear: string;
  department?: {
    id: string;
    name: string;
    shortName: string | null;
    color: string | null;
  } | null;
  assignees: Array<{
    roleInTask: string;
    user: { id: string; name: string; avatarUrl: string | null };
  }>;
  // compat: API may return leadUnit instead of department
  leadUnit?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

interface SearchDocumentResult {
  id: string;
  documentNumber?: string;
  originalNumber?: string | null;
  registrationNumber?: number | null;
  title: string;
  summary: string;
  type?: string;
  category?: string | null;
  issuingAuthority?: string | null;
  issuedDate?: string;
  status?: string;
  urgency?: string;
  leadDepartment?: {
    id: string;
    name: string;
    shortName: string | null;
  } | null;
}

interface SearchUserResult {
  id: string;
  name: string;
  email: string;
  role: string;
  title: string | null;
  phone: string | null;
  avatarUrl: string | null;
  department?: {
    id: string;
    name: string;
    shortName: string | null;
    color: string | null;
  } | null;
}

interface SearchResponse {
  success: boolean;
  query: string;
  results: {
    tasks: SearchTaskResult[];
    documents: SearchDocumentResult[];
    users: SearchUserResult[];
  };
  count: {
    tasks: number;
    documents: number;
    users: number;
  };
}

type TabKey = "tasks" | "documents" | "users";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(raw: string | null | undefined): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

const PRIORITY_STYLES: Record<string, string> = {
  CRITICAL: "bg-red-500/8 text-red-700 border-red-500/15",
  HIGH: "bg-warning/8 text-warning border-warning/15",
  MEDIUM: "bg-muted/60 text-muted-foreground border-border/40",
  LOW: "bg-muted/40 text-muted-foreground/70 border-border/30",
};

const PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: "Khẩn cấp",
  HIGH: "Cao",
  MEDIUM: "Bình thường",
  LOW: "Thấp",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Nháp",
  PENDING: "Chờ duyệt",
  IN_PROGRESS: "Đang thực hiện",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
  OVERDUE: "Trễ hạn",
  RECEIVED: "Đã tiếp nhận",
  PROCESSED: "Đã xử lý",
  ARCHIVED: "Đã lưu trữ",
};

const TAB_CONFIG: { key: TabKey; label: string; icon: typeof ListChecks }[] = [
  { key: "tasks", label: "Nhiệm vụ", icon: ListChecks },
  { key: "documents", label: "Văn bản", icon: FileText },
  { key: "users", label: "Nhân sự", icon: Users },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GlobalSearchView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q") ?? "";

  const [inputValue, setInputValue] = React.useState(initialQuery);
  const [query, setQuery] = React.useState(initialQuery);
  const [activeTab, setActiveTab] = React.useState<TabKey>("tasks");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<SearchResponse | null>(null);

  const inputRef = React.useRef<HTMLInputElement>(null);

  // Debounce input → query
  React.useEffect(() => {
    const t = setTimeout(() => {
      setQuery(inputValue.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [inputValue]);

  // Fetch results when query changes
  React.useEffect(() => {
    if (!query) {
      setData(null);
      setError(null);
      return;
    }

    const ctrl = new AbortController();
    let cancelled = false;

    async function doSearch() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(query)}`,
          { signal: ctrl.signal },
        );
        if (cancelled) return;
        if (!res.ok) {
          throw new Error(`Yêu cầu thất bại (${res.status})`);
        }
        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error?.message || "Tìm kiếm thất bại");
        }
        setData(json as SearchResponse);
      } catch (err: unknown) {
        if ((err as { name?: string })?.name === "AbortError") return;
        setError(
          err instanceof Error
            ? err.message
            : "Không thể kết nối tới máy chủ.",
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    doSearch();
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [query]);

  // Update URL param (shallow)
  React.useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (query) {
      params.set("q", query);
    } else {
      params.delete("q");
    }
    const newUrl = `/search${params.toString() ? `?${params.toString()}` : ""}`;
    router.replace(newUrl, { scroll: false });
  }, [query, router, searchParams]);

  // Auto-select first tab with results
  React.useEffect(() => {
    if (!data) return;
    const { count } = data;
    if (count.tasks > 0) {
      setActiveTab("tasks");
    } else if (count.documents > 0) {
      setActiveTab("documents");
    } else if (count.users > 0) {
      setActiveTab("users");
    }
  }, [data]);

  // Focus input on mount
  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const totalCount = data
    ? data.count.tasks + data.count.documents + data.count.users
    : 0;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <m.div
      className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6 pb-10 sm:px-6 lg:px-8"
      data-slot="global-search-view"
      variants={fadeVariants}
      initial="initial"
      animate="animate"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-muted/60">
          <Search size={20} strokeWidth={1.5} className="text-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground tracking-tight">
            Tìm kiếm toàn hệ thống
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tra cứu nhiệm vụ, văn bản, và nhân sự
          </p>
        </div>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search
          size={16}
          strokeWidth={1.5}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 pointer-events-none"
        />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Nhập từ khóa tìm kiếm..."
          className="w-full rounded-xl border border-border/60 bg-card pl-10 pr-10 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-border shadow-2xs transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
        />
        {isLoading && (
          <Loader2
            size={16}
            strokeWidth={1.5}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground/60"
          />
        )}
        {!isLoading && inputValue && (
          <button
            type="button"
            onClick={() => {
              setInputValue("");
              inputRef.current?.focus();
            }}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="sr-only">Xóa</span>
            <svg
              width={14}
              height={14}
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
            >
              <line x1="3" y1="3" x2="11" y2="11" />
              <line x1="11" y1="3" x2="3" y2="11" />
            </svg>
          </button>
        )}
      </div>

      {/* Results area */}
      <AnimatePresence mode="wait">
        {error ? (
          <m.div
            key="error"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="rounded-xl border border-red-500/15 bg-red-500/5 px-5 py-8 text-center"
          >
            <AlertTriangle
              size={28}
              strokeWidth={1.5}
              className="mx-auto mb-3 text-red-600/70"
            />
            <p className="text-sm font-medium text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => setQuery(inputValue.trim())}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[44px] sm:min-h-0"
            >
              <RefreshCw size={13} strokeWidth={1.5} />
              Thử lại
            </button>
          </m.div>
        ) : !query ? (
          <m.div
            key="idle"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="rounded-xl border border-border/40 bg-card px-5 py-14 text-center shadow-2xs"
          >
            <Search
              size={32}
              strokeWidth={1.5}
              className="mx-auto mb-3 text-muted-foreground/30"
            />
            <p className="text-sm text-muted-foreground">
              Nhập từ khóa để bắt đầu tìm kiếm
            </p>
          </m.div>
        ) : isLoading && !data ? (
          <m.div
            key="loading"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="space-y-3"
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-border/40 bg-card px-4 py-3.5 shadow-2xs"
              >
                <div className="flex items-start gap-3 animate-pulse">
                  <div className="size-8 rounded-lg bg-muted/60 shrink-0" />
                  <div className="flex-1 space-y-2 pt-0.5">
                    <div className="h-3.5 bg-muted/50 rounded w-3/4" />
                    <div className="h-3 bg-muted/40 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </m.div>
        ) : data && totalCount === 0 ? (
          <m.div
            key="empty"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="rounded-xl border border-border/40 bg-card px-5 py-14 text-center shadow-2xs"
          >
            <Inbox
              size={32}
              strokeWidth={1.5}
              className="mx-auto mb-3 text-muted-foreground/30"
            />
            <p className="text-sm font-medium text-foreground/80">
              Không tìm thấy kết quả
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Thử điều chỉnh từ khóa hoặc kiểm tra chính tả
            </p>
          </m.div>
        ) : data ? (
          <m.div
            key="results"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="space-y-4"
          >
            {/* Summary */}
            <p className="text-xs text-muted-foreground">
              Tìm thấy{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {totalCount}
              </span>{" "}
              kết quả cho{" "}
              <span className="font-medium text-foreground">
                &ldquo;{data.query}&rdquo;
              </span>
            </p>

            {/* Tabs */}
            <div className="flex items-center gap-1 rounded-lg border border-border/40 bg-muted/30 p-1">
              {TAB_CONFIG.map((tab) => {
                const count =
                  data.count[tab.key as keyof typeof data.count] ?? 0;
                const isActive = activeTab === tab.key;
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring min-h-[44px] sm:min-h-0",
                      isActive
                        ? "bg-card text-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                    )}
                  >
                    <TabIcon size={13} strokeWidth={1.5} />
                    <span>{tab.label}</span>
                    <span
                      className={cn(
                        "ml-0.5 rounded-full px-1.5 py-px text-xs font-semibold tabular-nums",
                        isActive
                          ? "bg-muted text-muted-foreground"
                          : "bg-muted/60 text-muted-foreground/70",
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <AnimatePresence mode="wait">
              {activeTab === "tasks" && (
                <TaskResults
                  key="tasks"
                  items={data.results.tasks}
                  query={data.query}
                />
              )}
              {activeTab === "documents" && (
                <DocumentResults
                  key="documents"
                  items={data.results.documents}
                  query={data.query}
                />
              )}
              {activeTab === "users" && (
                <UserResults
                  key="users"
                  items={data.results.users}
                  query={data.query}
                />
              )}
            </AnimatePresence>
          </m.div>
        ) : null}
      </AnimatePresence>
    </m.div>
  );
}

// ---------------------------------------------------------------------------
// Task Results
// ---------------------------------------------------------------------------

function TaskResults({
  items,
  query,
}: {
  items: SearchTaskResult[];
  query: string;
}) {
  if (items.length === 0) {
    return <EmptyTabState label="nhiệm vụ" />;
  }

  return (
    <m.div
      variants={staggerContainerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-2xs divide-y divide-border/30"
    >
      {items.map((task) => {
        const unitName =
          task.department?.name ?? task.leadUnit?.name ?? null;
        const priorityStyle =
          PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.MEDIUM;
        const priorityLabel =
          PRIORITY_LABELS[task.priority] ?? task.priority;
        const statusLabel =
          STATUS_LABELS[task.status] ?? task.status;

        return (
          <m.div key={task.id} variants={listItemVariants}>
            <Link
              href={`/tasks?taskId=${task.id}`}
              className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40 cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
              {/* Icon */}
              <div className="mt-0.5 shrink-0 p-1.5 rounded-lg bg-muted/50">
                <ListChecks
                  size={14}
                  strokeWidth={1.5}
                  className="text-muted-foreground"
                />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-mono font-semibold text-muted-foreground/70 bg-muted/50 px-1.5 py-0.5 rounded border border-border/30">
                    {task.code}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-medium px-1.5 py-0.5 rounded border",
                      priorityStyle,
                    )}
                  >
                    {priorityLabel}
                  </span>
                </div>
                <p className="text-sm font-medium text-foreground leading-snug line-clamp-1 group-hover:text-foreground/90">
                  {task.title}
                </p>
                <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
                  <span className="text-xs text-muted-foreground/70 bg-muted/40 px-1.5 py-0.5 rounded">
                    {statusLabel}
                  </span>
                  {unitName && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Building2 size={10} strokeWidth={1.5} />
                      {unitName}
                    </span>
                  )}
                  {task.dueDate && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                      <CalendarDays size={10} strokeWidth={1.5} />
                      {formatDate(task.dueDate)}
                    </span>
                  )}
                </div>
              </div>

              {/* Arrow */}
              <ChevronRight
                size={14}
                strokeWidth={1.5}
                className="mt-2 shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors"
              />
            </Link>
          </m.div>
        );
      })}
    </m.div>
  );
}

// ---------------------------------------------------------------------------
// Document Results
// ---------------------------------------------------------------------------

function DocumentResults({
  items,
  query,
}: {
  items: SearchDocumentResult[];
  query: string;
}) {
  if (items.length === 0) {
    return <EmptyTabState label="văn bản" />;
  }

  return (
    <m.div
      variants={staggerContainerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-2xs divide-y divide-border/30"
    >
      {items.map((doc) => {
        const number =
          doc.originalNumber ?? doc.documentNumber ?? null;
        const statusLabel =
          STATUS_LABELS[doc.status ?? ""] ?? doc.status ?? "";

        return (
          <m.div key={doc.id} variants={listItemVariants}>
            <Link
              href={`/documents/incoming/${doc.id}`}
              className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40 cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
              {/* Icon */}
              <div className="mt-0.5 shrink-0 p-1.5 rounded-lg bg-muted/50">
                <FileText
                  size={14}
                  strokeWidth={1.5}
                  className="text-muted-foreground"
                />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {number && (
                  <span className="inline-block text-xs font-mono font-semibold text-muted-foreground/70 bg-muted/50 px-1.5 py-0.5 rounded border border-border/30 mb-0.5">
                    {number}
                  </span>
                )}
                <p className="text-sm font-medium text-foreground leading-snug line-clamp-2 group-hover:text-foreground/90">
                  {doc.summary || doc.title}
                </p>
                <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
                  {doc.type && (
                    <span className="text-xs text-muted-foreground/70 bg-muted/40 px-1.5 py-0.5 rounded">
                      {doc.type}
                    </span>
                  )}
                  {statusLabel && (
                    <span className="text-xs text-muted-foreground/70 bg-muted/40 px-1.5 py-0.5 rounded">
                      {statusLabel}
                    </span>
                  )}
                  {doc.issuingAuthority && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Building2 size={10} strokeWidth={1.5} />
                      {doc.issuingAuthority}
                    </span>
                  )}
                  {doc.issuedDate && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                      <CalendarDays size={10} strokeWidth={1.5} />
                      {formatDate(doc.issuedDate)}
                    </span>
                  )}
                </div>
              </div>

              {/* Arrow */}
              <ChevronRight
                size={14}
                strokeWidth={1.5}
                className="mt-2 shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors"
              />
            </Link>
          </m.div>
        );
      })}
    </m.div>
  );
}

// ---------------------------------------------------------------------------
// User Results
// ---------------------------------------------------------------------------

function UserResults({
  items,
  query,
}: {
  items: SearchUserResult[];
  query: string;
}) {
  if (items.length === 0) {
    return <EmptyTabState label="nhân sự" />;
  }

  return (
    <m.div
      variants={staggerContainerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-2xs divide-y divide-border/30"
    >
      {items.map((user) => {
        return (
          <m.div key={user.id} variants={listItemVariants}>
            <div className="flex items-center gap-3 px-4 py-3">
              {/* Avatar */}
              <div className="shrink-0">
                <UserAvatar
                  name={user.name}
                  avatarUrl={user.avatarUrl}
                  size="lg"
                  className="ring-1 ring-border/40"
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground leading-snug">
                  {user.name}
                </p>
                <div className="flex items-center gap-2.5 mt-1 flex-wrap">
                  {user.title && (
                    <span className="text-xs text-muted-foreground/70 bg-muted/40 px-1.5 py-0.5 rounded">
                      {user.title}
                    </span>
                  )}
                  {user.department?.name && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Building2 size={10} strokeWidth={1.5} />
                      {user.department.shortName ?? user.department.name}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  {user.email && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Mail size={10} strokeWidth={1.5} />
                      {user.email}
                    </span>
                  )}
                  {user.phone && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                      <Phone size={10} strokeWidth={1.5} />
                      {user.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </m.div>
        );
      })}
    </m.div>
  );
}

// ---------------------------------------------------------------------------
// Empty state for a specific tab
// ---------------------------------------------------------------------------

function EmptyTabState({ label }: { label: string }) {
  return (
    <m.div
      variants={fadeVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="rounded-xl border border-border/40 bg-card px-5 py-10 text-center shadow-2xs"
    >
      <Inbox
        size={24}
        strokeWidth={1.5}
        className="mx-auto mb-2 text-muted-foreground/30"
      />
      <p className="text-xs text-muted-foreground">
        Không có {label} nào khớp với từ khóa tìm kiếm
      </p>
    </m.div>
  );
}
