"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FolderOpen,
  Archive,
  Search,
  Plus,
  RefreshCw,
  ChevronRight,
  Calendar,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableEmptyValue, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Pressable } from "@/components/ui/pressable";
import { Button } from "@/components/ui/button";
import { MobileTopbarActions } from "@/components/layout/app-topbar";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DossierStatus =
  | "OPEN"
  | "ACTIVE"
  | "CLOSED"
  | "READY_FOR_ARCHIVE"
  | "SUBMITTED_TO_ARCHIVE"
  | "ACCEPTED"
  | "ARCHIVED";

type DossierClassification =
  | "PUBLIC"
  | "INTERNAL"
  | "RESTRICTED"
  | "PERSONAL_DATA";

interface DossierItem {
  id: string;
  code: string;
  title: string;
  status: DossierStatus;
  classification: DossierClassification;
  storageLocation: string | null;
  notes: string | null;
  openedAt: string;
  closedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  owningUnit: { id: string; name: string; code: string };
  responsiblePerson: { id: string; name: string; email: string };
  retentionRule: {
    id: string;
    code: string;
    name: string;
    retentionYears: number;
  } | null;
  _count?: { items: number };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(raw: string | null | undefined): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

const STATUS_LABELS: Record<DossierStatus, string> = {
  OPEN: "Đang mở",
  ACTIVE: "Hoạt động",
  CLOSED: "Đã đóng",
  READY_FOR_ARCHIVE: "Sẵn sàng lưu trữ",
  SUBMITTED_TO_ARCHIVE: "Đã nộp lưu trữ",
  ACCEPTED: "Đã chấp nhận",
  ARCHIVED: "Đã lưu trữ",
};

/** Màu chữ trạng thái (bảng chỉ tô chữ như bảng Nhiệm vụ): việc còn phải làm để lưu trữ là màu cảnh báo, còn lại chữ mờ. */
const STATUS_TONE: Partial<Record<DossierStatus, string>> = {
  READY_FOR_ARCHIVE: "text-warning",
  SUBMITTED_TO_ARCHIVE: "text-warning",
};

/** Bề rộng cột như `TASK_COLUMN_CLASS` của bảng Nhiệm vụ; khung bảng hẹp thì bớt cột (container query). */
const DOSSIER_COLUMN_CLASS = {
  unit: "w-[176px] @max-[900px]:hidden",
  owner: "w-[168px] @max-[760px]:hidden",
  classification: "w-[96px] @max-[1040px]:hidden",
  items: "w-[80px] @max-[1040px]:hidden",
  opened: "w-[104px] @max-[560px]:hidden",
  status: "w-[136px]",
} as const;

const CLASSIFICATION_MAP: Record<DossierClassification, { label: string; tone: string }> = {
  PUBLIC: { label: "Công khai", tone: "text-muted-foreground" },
  INTERNAL: { label: "Nội bộ", tone: "text-muted-foreground" },
  RESTRICTED: { label: "Hạn chế", tone: "text-warning" },
  PERSONAL_DATA: { label: "DLCN", tone: "text-destructive" },
};

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DossierRegistryView() {
  const router = useRouter();

  // Data
  const [items, setItems] = React.useState<DossierItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);

  // Filters
  const [searchInput, setSearchInput] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [classificationFilter, setClassificationFilter] = React.useState("");
  const [page, setPage] = React.useState(0);
  // Chưa có hồ sơ nào và không lọc: chỉ giữ tiêu đề, nút và trạng thái trống
  const isColdStartEmpty =
    !isLoading && !fetchError && items.length === 0 && !searchInput && !searchQuery && !statusFilter && !classificationFilter;

  // Debounced search
  React.useEffect(() => {
    const t = setTimeout(() => {
      setSearchQuery(searchInput);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Fetch data
  const fetchDossiers = React.useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const p = new URLSearchParams();
        if (searchQuery.trim()) p.set("search", searchQuery.trim());
        if (statusFilter) p.set("status", statusFilter);
        if (classificationFilter)
          p.set("classification", classificationFilter);
        p.set("limit", String(PAGE_SIZE));
        p.set("offset", String(page * PAGE_SIZE));

        const res = await fetch(`/api/dossiers?${p.toString()}`, { signal });
        if (!res.ok) {
          setFetchError("Không thể tải danh sách hồ sơ từ máy chủ");
          return;
        }
        const json = await res.json();
        // API trả thẳng { items, total } (apiSuccess không bọc success/data)
        if (Array.isArray(json?.items)) {
          setItems(json.items);
          setTotal(json.total ?? 0);
        } else {
          setFetchError("Phản hồi không hợp lệ từ máy chủ");
        }
      } catch (err: unknown) {
        if ((err as { name?: string })?.name !== "AbortError") {
          console.error("Fetch dossiers error:", err);
          setFetchError("Lỗi kết nối máy chủ khi tải danh sách hồ sơ");
        }
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [searchQuery, statusFilter, classificationFilter, page],
  );

  React.useEffect(() => {
    const ctrl = new AbortController();
    fetchDossiers(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchDossiers]);

  // Stats derived from total fetch (simple approach: count from current page items
  // plus use total for the overall count)
  const stats = React.useMemo(() => {
    // Count from loaded items for quick stats — for accuracy across pages,
    // a dedicated stats endpoint would be needed. This is a pragmatic approximation.
    const active = items.filter(
      (i) => i.status === "OPEN" || i.status === "ACTIVE",
    ).length;
    const pending = items.filter(
      (i) =>
        i.status === "READY_FOR_ARCHIVE" ||
        i.status === "SUBMITTED_TO_ARCHIVE",
    ).length;
    const archived = items.filter(
      (i) => i.status === "ACCEPTED" || i.status === "ARCHIVED",
    ).length;
    return { total, active, pending, archived };
  }, [items, total]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleRefresh = () => fetchDossiers();
  const handleCreateDossier = () => alert("Chức năng tạo hồ sơ mới đang phát triển");

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      className="empty-fill mx-auto w-full max-w-[1440px] space-y-5 pb-6 md:pb-10"
      data-slot="dossier-registry-view"
    >
      {/* Header */}
      <div>
        <nav
          aria-label="Breadcrumb"
          className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground max-md:hidden"
        >
          <Link
            href="/tasks"
            className="transition-colors hover:text-foreground hover:underline underline-offset-4 rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Nhiệm vụ
          </Link>
          <ChevronRight
            className="size-3 text-muted-foreground/60"
          />
          <span className="font-medium text-foreground">
            Hồ sơ công việc
          </span>
        </nav>
        <div className="flex flex-col gap-3 border-b border-border/40 pb-4 max-md:border-b-0 max-md:pb-0 sm:flex-row sm:items-center sm:justify-between">
          {/* Điện thoại: tên trang đã nằm trên thanh trên cùng, chỉ giữ cho trình đọc màn hình */}
          <div className="max-md:sr-only">
            <div className="mb-1 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-0.5 text-xs font-semibold text-sky-700">
                <Archive className="size-3" /> Nghị định
                30/2020/NĐ-CP
              </span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Hồ sơ công việc
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
              Quản lý hồ sơ công việc theo Nghị định 30/2020/NĐ-CP
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <Pressable
              onClick={handleRefresh}
              disabled={isLoading}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border/70 bg-background px-3 text-xs font-medium shadow-2xs transition-colors hover:bg-muted/60 active:scale-[0.98] disabled:opacity-50 sm:min-h-9"
            >
              <RefreshCw
                className={cn("size-3.5", isLoading && "animate-spin")}
              />
              Làm mới
            </Pressable>
            {/* Điện thoại: nút "+" trên thanh trên cùng */}
            <Pressable
              onClick={handleCreateDossier}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-primary px-3.5 text-xs font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 active:scale-[0.98] max-md:hidden sm:min-h-9"
            >
              <Plus className="size-3.5" />
              Tạo hồ sơ mới
            </Pressable>
            <MobileTopbarActions>
              <Button variant="ghost" size="icon-xs" onClick={handleCreateDossier} aria-label="Tạo hồ sơ mới" title="Tạo hồ sơ mới">
                <Plus />
              </Button>
            </MobileTopbarActions>
          </div>
        </div>
      </div>

      {/* Stats Summary — ẩn khi chưa có hồ sơ nào (toàn số 0, không có gì để lọc) */}
      {!isColdStartEmpty && (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([
          {
            label: "Tổng hồ sơ",
            value: stats.total,
            icon: FolderOpen,
            color: "text-muted-foreground",
          },
          {
            label: "Đang hoạt động",
            value: stats.active,
            icon: FileText,
            color: "text-blue-600",
          },
          {
            label: "Chờ lưu trữ",
            value: stats.pending,
            icon: Calendar,
            color: "text-warning",
          },
          {
            label: "Đã lưu trữ",
            value: stats.archived,
            icon: Archive,
            color: "text-emerald-600",
          },
        ] as const).map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-border/50 bg-card px-4 py-3 shadow-2xs"
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <s.icon className={cn("size-3.5", s.color)} />
              {s.label}
            </div>
            <p className="mt-1 text-xl font-bold tracking-tight text-foreground">
              {isLoading ? "—" : s.value}
            </p>
          </div>
        ))}
      </div>
      )}

      {/* Filter Bar */}
      {!isColdStartEmpty && (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60"
          />
          <input
            type="text"
            placeholder="Tìm kiếm mã, tiêu đề..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-9 min-h-[44px] sm:min-h-0 w-full rounded-lg border border-border/60 bg-background pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-border focus:ring-1 focus:ring-ring/30"
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(0);
          }}
          className="h-9 min-h-[44px] sm:min-h-0 cursor-pointer appearance-none rounded-lg border border-border/60 bg-background px-3 pr-8 text-sm text-foreground outline-none focus:border-border focus:ring-1 focus:ring-ring/30"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="OPEN">Đang mở</option>
          <option value="ACTIVE">Hoạt động</option>
          <option value="CLOSED">Đã đóng</option>
          <option value="READY_FOR_ARCHIVE">Sẵn sàng lưu trữ</option>
          <option value="SUBMITTED_TO_ARCHIVE">Đã nộp lưu trữ</option>
          <option value="ACCEPTED">Đã chấp nhận</option>
          <option value="ARCHIVED">Đã lưu trữ</option>
        </select>

        {/* Classification filter */}
        <select
          value={classificationFilter}
          onChange={(e) => {
            setClassificationFilter(e.target.value);
            setPage(0);
          }}
          className="h-9 min-h-[44px] sm:min-h-0 cursor-pointer appearance-none rounded-lg border border-border/60 bg-background px-3 pr-8 text-sm text-foreground outline-none focus:border-border focus:ring-1 focus:ring-ring/30"
        >
          <option value="">Tất cả phân loại</option>
          <option value="PUBLIC">Công khai</option>
          <option value="INTERNAL">Nội bộ</option>
          <option value="RESTRICTED">Hạn chế</option>
          <option value="PERSONAL_DATA">Dữ liệu cá nhân</option>
        </select>
      </div>
      )}

      {/* Error State */}
      {fetchError && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-6 py-8 text-center">
          <p className="text-sm text-red-700">{fetchError}</p>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border/60 bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted/60 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <RefreshCw className="size-3" />
            Thử lại
          </button>
        </div>
      )}

      {/* Table */}
      {!fetchError && (
        <div className="empty-fill rounded-xl border border-border/50 bg-card shadow-2xs">
          {/* Bảng dùng chung như bảng Nhiệm vụ: cột tên lấy phần còn lại, cột thuộc tính rộng cố định, bớt cột theo bề rộng khung */}
          <Table density="two-line" className="table-fixed" containerClassName="@container">
            <TableHeader className={cn(isColdStartEmpty && "hidden")}>
              <TableRow>
                <TableHead>Hồ sơ</TableHead>
                <TableHead className={DOSSIER_COLUMN_CLASS.unit}>Đơn vị</TableHead>
                <TableHead className={DOSSIER_COLUMN_CLASS.owner}>Phụ trách</TableHead>
                <TableHead className={DOSSIER_COLUMN_CLASS.classification}>Phân loại</TableHead>
                <TableHead className={cn("text-right", DOSSIER_COLUMN_CLASS.items)}>Tài liệu</TableHead>
                <TableHead className={DOSSIER_COLUMN_CLASS.opened}>Ngày mở</TableHead>
                <TableHead className={DOSSIER_COLUMN_CLASS.status}>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={`skeleton-${i}`}>
                      {[undefined, ...Object.values(DOSSIER_COLUMN_CLASS)].map((columnClass, j) => (
                        <TableCell key={j} className={columnClass}>
                          <div className="h-3.5 animate-pulse rounded bg-muted/60" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : items.map((item) => {
                    const href = `/dossiers/${item.id}`;
                    const classification = CLASSIFICATION_MAP[item.classification];
                    return (
                      <TableRow
                        key={item.id}
                        interactive
                        tabIndex={0}
                        onClick={() => router.push(href)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && event.target === event.currentTarget) {
                            event.preventDefault();
                            router.push(href);
                          }
                        }}
                      >
                        <TableCell>
                          <div className="flex min-w-0 items-center gap-2">
                            <Link
                              href={href}
                              tabIndex={-1}
                              onClick={(event) => event.stopPropagation()}
                              className="min-w-0 truncate font-medium text-foreground outline-none transition-colors group-hover:text-primary"
                              title={item.title}
                            >
                              {item.title}
                            </Link>
                            <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground/60">{item.code}</span>
                          </div>
                        </TableCell>
                        <TableCell className={DOSSIER_COLUMN_CLASS.unit}>
                          <span className="line-clamp-2 break-words text-xs leading-snug text-muted-foreground" title={item.owningUnit.name}>
                            {item.owningUnit.name}
                          </span>
                        </TableCell>
                        <TableCell className={DOSSIER_COLUMN_CLASS.owner}>
                          <span className="flex min-w-0 items-center gap-2" title={item.responsiblePerson.name}>
                            <UserAvatar name={item.responsiblePerson.name} size="xs" />
                            <span className="min-w-0 truncate text-xs">{item.responsiblePerson.name}</span>
                          </span>
                        </TableCell>
                        <TableCell className={cn("whitespace-nowrap text-xs", classification.tone, DOSSIER_COLUMN_CLASS.classification)}>
                          {classification.label}
                        </TableCell>
                        <TableCell className={cn("whitespace-nowrap text-right text-xs tabular-nums text-muted-foreground", DOSSIER_COLUMN_CLASS.items)}>
                          {item._count?.items ?? 0}
                        </TableCell>
                        <TableCell className={cn("whitespace-nowrap text-xs tabular-nums text-muted-foreground", DOSSIER_COLUMN_CLASS.opened)}>
                          {formatDate(item.openedAt) || <TableEmptyValue />}
                        </TableCell>
                        <TableCell className={cn("whitespace-nowrap text-xs", STATUS_TONE[item.status] ?? "text-muted-foreground", DOSSIER_COLUMN_CLASS.status)}>
                          <span className="block truncate">{STATUS_LABELS[item.status]}</span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
            </TableBody>
          </Table>

          {/* Empty state */}
          {!isLoading && items.length === 0 && (
            searchQuery || statusFilter || classificationFilter ? (
              <EmptyState
                role="status"
                density="page"
                icon={<FolderOpen />}
                title="Không tìm thấy hồ sơ nào"
                description="Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm."
              />
            ) : (
              <EmptyState
                role="status"
                density="page"
                illustration="dossier"
                title="Chưa có hồ sơ công việc"
                description="Hồ sơ công việc đã lập sẽ hiện ở đây."
              />
            )
          )}
        </div>
      )}

      {/* Pagination */}
      {!fetchError && total > PAGE_SIZE && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-muted-foreground">
            Hiển thị {page * PAGE_SIZE + 1}–
            {Math.min((page + 1) * PAGE_SIZE, total)} / {total} hồ sơ
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="inline-flex h-8 min-h-[44px] sm:min-h-0 cursor-pointer items-center rounded-lg border border-border/60 bg-background px-3 text-xs font-medium transition-colors hover:bg-muted/60 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Trước
            </button>
            <span className="text-xs text-muted-foreground">
              Trang {page + 1} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex h-8 min-h-[44px] sm:min-h-0 cursor-pointer items-center rounded-lg border border-border/60 bg-background px-3 text-xs font-medium transition-colors hover:bg-muted/60 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Sau
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
