"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { WorkspacePageCard } from "@/components/workspace/page-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/ui/user-avatar";
import { focusRingClass } from "@/components/ui/focus-ring";
import { TaskStatusCircle } from "@/components/tasks/task-status-circle";
import { getStatusBadgeConfig } from "@/components/tasks/table/constants";
import { DUE_SOON_DAYS } from "@/components/tasks/table/utils/table-date-helpers";
import { IconSidebarDocLines, IconSidebarInboxIn, IconSidebarSend } from "@/components/layout/sidebar-rounded-icons";
import { getDocumentHref } from "@qcet/shared/lib/documents/document-view-model";
import { daysUntil, formatRelativeDate } from "@/lib/format/relative-date";
import { cn } from "@/lib/utils";
import type { GlobalSearchPayload, SearchDocumentResult, SearchTaskResult, SearchUserResult } from "@qcet/contracts/search";

type SearchResults = GlobalSearchPayload["results"];

type TabKey = keyof SearchResults;

const TABS: { key: TabKey; label: string }[] = [
  { key: "tasks", label: "Nhiệm vụ" },
  { key: "documents", label: "Văn bản" },
  { key: "users", label: "Nhân sự" },
];

const DOC_TYPE: Record<string, { label: string; icon: typeof IconSidebarInboxIn }> = {
  VAN_BAN_DEN: { label: "Văn bản đến", icon: IconSidebarInboxIn },
  VAN_BAN_DI: { label: "Văn bản đi", icon: IconSidebarSend },
  TO_TRINH_NOI_BO: { label: "Tờ trình nội bộ", icon: IconSidebarDocLines },
};

const DOC_STATUS: Record<string, string> = {
  CHO_PHAN_CONG: "Chờ phân công",
  DANG_XU_LY: "Đang xử lý",
  CHO_PHE_DUYET: "Chờ phê duyệt",
  DA_HOAN_THANH: "Đã hoàn thành",
  LUU_THEO_DOI: "Lưu theo dõi",
};

const DOC_URGENCY: Record<string, string> = {
  KHAN: "Khẩn",
  THUONG_KHAN: "Thượng khẩn",
  HOA_TOC: "Hỏa tốc",
};

const DATE = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" });

function formatDate(raw: string | null | undefined) {
  if (!raw) return "";
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? "" : DATE.format(d);
}

const ROW_CLASS = cn("flex h-12 items-center gap-3 rounded-md px-2 transition-colors hover:bg-accent", focusRingClass);

/**
 * Tìm kiếm (`/search`, mục "Thêm" ở sidebar): nhiệm vụ, văn bản và nhân sự trong phạm vi người dùng được xem (`GET /api/search`).
 * Dựng lại 15/10/2026 theo khung một thẻ: ô tìm lớn, tab theo nhóm kèm số kết quả, mỗi kết quả một hàng 48px.
 */
export function GlobalSearchView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q") ?? "";

  const [inputValue, setInputValue] = React.useState(initialQuery);
  const [query, setQuery] = React.useState(initialQuery.trim());
  const [activeTab, setActiveTab] = React.useState<TabKey>("tasks");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<SearchResults | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setQuery(inputValue.trim()), 300);
    return () => clearTimeout(t);
  }, [inputValue]);

  React.useEffect(() => {
    if (!query) {
      setResults(null);
      setError(null);
      setIsLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setIsLoading(true);
    setError(null);
    fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("Chưa tìm được, máy chủ đang gặp sự cố.");
        const json = await res.json();
        const payload: { results?: SearchResults } | undefined = json?.results ? json : json?.data;
        if (!payload?.results) throw new Error("Chưa đọc được kết quả tìm kiếm.");
        const next = payload.results;
        setResults(next);
        // Mở nhóm đầu tiên có kết quả
        const first = TABS.find((tab) => next[tab.key]?.length > 0);
        if (first) setActiveTab(first.key);
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === "AbortError") return;
        setError(err instanceof Error && err.message.startsWith("Chưa") ? err.message : "Mất kết nối khi tìm kiếm.");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setIsLoading(false);
      });
    return () => ctrl.abort();
  }, [query, reloadKey]);

  // Giữ từ khóa trên URL để chia sẻ hoặc quay lại
  React.useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (query) params.set("q", query);
    else params.delete("q");
    const next = params.toString();
    if (next !== searchParams.toString()) router.replace(`/search${next ? `?${next}` : ""}`, { scroll: false });
  }, [query, router, searchParams]);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const total = results ? results.tasks.length + results.documents.length + results.users.length : 0;

  return (
    <WorkspacePageCard
      title="Tìm kiếm"
      description="Nhiệm vụ, văn bản và nhân sự trong phạm vi Thầy/Cô được xem"
      hideTitleOnMobile
      className="max-w-4xl"
    >
      <div className="empty-fill flex flex-col gap-4 pb-6">
        <div role="search" className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && inputValue) {
                e.preventDefault();
                setInputValue("");
              }
            }}
            placeholder="Tên nhiệm vụ, số ký hiệu, trích yếu, tên người…"
            aria-label="Từ khóa tìm kiếm"
            className="pl-9 pr-10"
          />
          <span className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center">
            {isLoading ? (
              <Loader2 aria-label="Đang tìm" className="mr-1.5 size-4 text-muted-foreground motion-safe:animate-spin" />
            ) : inputValue ? (
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Xóa từ khóa"
                onClick={() => {
                  setInputValue("");
                  inputRef.current?.focus();
                }}
              >
                <X />
              </Button>
            ) : null}
          </span>
        </div>

        {error ? (
          <InlineAlert actionLabel="Thử lại" onAction={() => setReloadKey((k) => k + 1)}>
            {error}
          </InlineAlert>
        ) : !query ? (
          <p className="py-2 text-compact text-muted-foreground">
            Gõ ít nhất một từ: mã hoặc tên nhiệm vụ, số ký hiệu hoặc trích yếu văn bản, tên hoặc email của đồng nghiệp. Không cần gõ dấu.
          </p>
        ) : !results ? (
          <div aria-busy className="flex flex-col gap-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : total === 0 ? (
          <EmptyState
            role="status"
            density="page"
            glyph="no-results"
            title={`Không tìm thấy kết quả cho “${query}”`}
            description="Thử từ khóa ngắn hơn, mã nhiệm vụ hoặc số ký hiệu văn bản. Chỉ hiện những gì Thầy/Cô có quyền xem."
          />
        ) : (
          <>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)} className="max-w-full overflow-x-auto">
              <TabsList variant="pill" size="sm" aria-label="Nhóm kết quả">
                {TABS.map((tab) => (
                  <TabsTrigger key={tab.key} value={tab.key} disabled={results[tab.key].length === 0}>
                    {tab.label} <span className="tabular-nums text-muted-foreground">{results[tab.key].length}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <ul aria-busy={isLoading || undefined} className={cn("-mx-2 flex flex-col", isLoading && "opacity-60")}>
              {activeTab === "tasks"
                ? results.tasks.map((task) => (
                    <li key={task.id}>
                      <TaskRow task={task} />
                    </li>
                  ))
                : activeTab === "documents"
                  ? results.documents.map((doc) => (
                      <li key={doc.id}>
                        <DocumentRow doc={doc} />
                      </li>
                    ))
                  : results.users.map((user) => (
                      <li key={user.id}>
                        <UserRow user={user} />
                      </li>
                    ))}
            </ul>
          </>
        )}
      </div>
    </WorkspacePageCard>
  );
}

function TaskRow({ task }: { task: SearchTaskResult }) {
  const days = task.dueDate ? daysUntil(task.dueDate) : null;
  const done = task.status === "COMPLETED" || task.status === "CANCELLED";
  const dueTone =
    done || days === null ? "text-muted-foreground" : days < 0 ? "text-destructive" : days <= DUE_SOON_DAYS ? "text-warning" : "text-muted-foreground";
  return (
    <Link href={`/tasks/${task.id}`} className={ROW_CLASS}>
      <TaskStatusCircle status={task.status} className="shrink-0" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-compact font-medium text-foreground" title={task.title}>
          {task.title}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {[task.code, getStatusBadgeConfig(task.status).label, task.leadUnit?.name].filter(Boolean).join(" · ")}
        </span>
      </span>
      {task.dueDate ? <span className={cn("shrink-0 text-xs tabular-nums", dueTone)}>{formatRelativeDate(task.dueDate)}</span> : null}
    </Link>
  );
}

function DocumentRow({ doc }: { doc: SearchDocumentResult }) {
  const type = doc.type ? DOC_TYPE[doc.type] : undefined;
  const Icon = type?.icon ?? IconSidebarDocLines;
  const number = doc.originalNumber || (doc.registrationNumber ? `Số đến ${doc.registrationNumber}` : null);
  const urgency = doc.urgency ? DOC_URGENCY[doc.urgency] : undefined;
  return (
    <Link href={getDocumentHref(doc.id)} className={ROW_CLASS}>
      <Icon aria-label={type?.label} className="size-4 shrink-0 text-muted-foreground" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-compact font-medium text-foreground" title={doc.summary}>
          {doc.summary || "(Chưa có trích yếu)"}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {urgency ? <span className="text-warning">{urgency} · </span> : null}
          {[number, doc.issuingAuthority, doc.status ? DOC_STATUS[doc.status] : null].filter(Boolean).join(" · ")}
        </span>
      </span>
      {doc.issuedDate ? <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatDate(doc.issuedDate)}</span> : null}
    </Link>
  );
}

function UserRow({ user }: { user: SearchUserResult }) {
  return (
    <div className="flex h-12 items-center gap-3 px-2">
      <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size="sm" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-compact font-medium text-foreground">{user.name}</span>
        <span className="truncate text-xs text-muted-foreground">{user.title || "Chưa ghi chức danh"}</span>
      </span>
      <a
        href={`mailto:${user.email}`}
        className={cn("hidden shrink-0 truncate rounded-sm text-xs text-muted-foreground hover:text-foreground hover:underline sm:block", focusRingClass)}
      >
        {user.email}
      </a>
    </div>
  );
}
