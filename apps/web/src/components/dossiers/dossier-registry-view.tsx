"use client";

import * as React from "react";
import Link from "next/link";
import {
  FolderOpen,
  Archive,
  Search,
  Plus,
  RefreshCw,
  ChevronRight,
  Building2,
  User,
  Calendar,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { Pressable } from "@/components/ui/pressable";
import { Button } from "@/components/ui/button";
import { MobileTopbarActions } from "@/components/layout/app-topbar";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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

const STATUS_STYLES: Record<DossierStatus, string> = {
  OPEN: "bg-muted/80 text-muted-foreground border-border/60",
  ACTIVE: "bg-blue-500/8 text-blue-700 border-blue-500/15",
  CLOSED: "bg-muted/60 text-muted-foreground border-border/40",
  READY_FOR_ARCHIVE: "bg-warning/8 text-warning border-warning/15",
  SUBMITTED_TO_ARCHIVE: "bg-warning/12 text-warning border-warning/20",
  ACCEPTED: "bg-emerald-500/8 text-emerald-700 border-emerald-500/15",
  ARCHIVED: "bg-emerald-500/12 text-emerald-700 border-emerald-500/20",
};

const CLASSIFICATION_MAP: Record<
  DossierClassification,
  { label: string; style: string }
> = {
  PUBLIC: {
    label: "Công khai",
    style: "bg-muted/50 text-muted-foreground border-border/40",
  },
  INTERNAL: {
    label: "Nội bộ",
    style: "bg-muted/50 text-muted-foreground border-border/40",
  },
  RESTRICTED: {
    label: "Hạn chế",
    style: "bg-warning/8 text-warning border-warning/15",
  },
  PERSONAL_DATA: {
    label: "DLCN",
    style: "bg-red-500/8 text-red-700 border-red-500/15",
  },
};

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DossierRegistryView() {

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
      className="mx-auto w-full max-w-[1440px] space-y-5 pb-6 md:pb-10"
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
          <Input
            compact
            placeholder="Tìm kiếm mã, tiêu đề..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-3"
          />
        </div>

        {/* Status filter */}
        <Select
          compact
          aria-label="Lọc theo trạng thái"
          value={statusFilter || null}
          onValueChange={(v) => {
            setStatusFilter(v ?? "");
            setPage(0);
          }}
          placeholder="Tất cả trạng thái"
          className="sm:w-48"
          options={[
            { value: "", label: "Tất cả trạng thái" },
            { value: "OPEN", label: "Đang mở" },
            { value: "ACTIVE", label: "Hoạt động" },
            { value: "CLOSED", label: "Đã đóng" },
            { value: "READY_FOR_ARCHIVE", label: "Sẵn sàng lưu trữ" },
            { value: "SUBMITTED_TO_ARCHIVE", label: "Đã nộp lưu trữ" },
            { value: "ACCEPTED", label: "Đã chấp nhận" },
            { value: "ARCHIVED", label: "Đã lưu trữ" },
          ]}
        />

        {/* Classification filter */}
        <Select
          compact
          aria-label="Lọc theo phân loại"
          value={classificationFilter || null}
          onValueChange={(v) => {
            setClassificationFilter(v ?? "");
            setPage(0);
          }}
          placeholder="Tất cả phân loại"
          className="sm:w-48"
          options={[
            { value: "", label: "Tất cả phân loại" },
            { value: "PUBLIC", label: "Công khai" },
            { value: "INTERNAL", label: "Nội bộ" },
            { value: "RESTRICTED", label: "Hạn chế" },
            { value: "PERSONAL_DATA", label: "Dữ liệu cá nhân" },
          ]}
        />
      </div>
      )}

      {/* Error State */}
      {fetchError && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-6 py-8 text-center">
          <p className="text-sm text-red-700">{fetchError}</p>
          <Pressable
            onClick={handleRefresh}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted/60 active:scale-[0.98]"
          >
            <RefreshCw className="size-3" />
            Thử lại
          </Pressable>
        </div>
      )}

      {/* Table */}
      {!fetchError && (
        <div className="overflow-x-auto rounded-xl border border-border/50 bg-card shadow-2xs">
          <table className="w-full text-sm">
            <thead className={cn(isColdStartEmpty && "hidden")}>
              <tr className="border-b border-border/40 text-left text-xs font-medium text-muted-foreground">
                <th className="whitespace-nowrap px-4 py-2.5">Mã hồ sơ</th>
                <th className="px-4 py-2.5">Tiêu đề</th>
                <th className="hidden whitespace-nowrap px-4 py-2.5 md:table-cell">
                  Đơn vị
                </th>
                <th className="hidden whitespace-nowrap px-4 py-2.5 lg:table-cell">
                  Người phụ trách
                </th>
                <th className="whitespace-nowrap px-4 py-2.5">Trạng thái</th>
                <th className="hidden whitespace-nowrap px-4 py-2.5 md:table-cell">
                  Phân loại
                </th>
                <th className="hidden whitespace-nowrap px-4 py-2.5 text-center lg:table-cell">
                  Tài liệu
                </th>
                <th className="hidden whitespace-nowrap px-4 py-2.5 md:table-cell">
                  Ngày mở
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr
                      key={`skeleton-${i}`}
                      className="border-b border-border/20"
                    >
                      {Array.from({ length: 8 }).map((__, j) => (
                        <td
                          key={j}
                          className={cn(
                            "px-4 py-3",
                            j >= 2 && j <= 3 && "hidden md:table-cell",
                            j === 3 && "hidden lg:table-cell",
                            j >= 5 && "hidden md:table-cell",
                            j === 6 && "hidden lg:table-cell",
                          )}
                        >
                          <div className="h-4 animate-pulse rounded bg-muted/60" />
                        </td>
                      ))}
                    </tr>
                  ))
                : items.map((item) => (
                    <tr
                      key={item.id}
                      className="group border-b border-border/20 transition-colors hover:bg-muted/30"
                    >
                      {/* Code */}
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <Link
                          href={`/dossiers/${item.id}`}
                          className="font-mono text-xs font-medium text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          {item.code}
                        </Link>
                      </td>

                      {/* Title */}
                      <td className="max-w-[200px] truncate px-4 py-2.5 lg:max-w-[320px]">
                        <span
                          className="text-sm text-foreground"
                          title={item.title}
                        >
                          {item.title}
                        </span>
                      </td>

                      {/* Owning unit */}
                      <td className="hidden whitespace-nowrap px-4 py-2.5 md:table-cell">
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Building2 className="size-3" />
                          {item.owningUnit.name}
                        </span>
                      </td>

                      {/* Responsible person */}
                      <td className="hidden whitespace-nowrap px-4 py-2.5 lg:table-cell">
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="size-3" />
                          {item.responsiblePerson.name}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                            STATUS_STYLES[item.status],
                          )}
                        >
                          {STATUS_LABELS[item.status]}
                        </span>
                      </td>

                      {/* Classification */}
                      <td className="hidden whitespace-nowrap px-4 py-2.5 md:table-cell">
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                            CLASSIFICATION_MAP[item.classification].style,
                          )}
                        >
                          {CLASSIFICATION_MAP[item.classification].label}
                        </span>
                      </td>

                      {/* Item count */}
                      <td className="hidden whitespace-nowrap px-4 py-2.5 text-center lg:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {item._count?.items ?? 0}
                        </span>
                      </td>

                      {/* Opened date */}
                      <td className="hidden whitespace-nowrap px-4 py-2.5 md:table-cell">
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="size-3" />
                          {formatDate(item.openedAt)}
                        </span>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>

          {/* Empty state */}
          {!isLoading && items.length === 0 && (
            searchQuery || statusFilter || classificationFilter ? (
              <EmptyState
                role="status"
                density="page"
                className="min-h-[48vh]"
                icon={<FolderOpen />}
                title="Không tìm thấy hồ sơ nào"
                description="Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm."
              />
            ) : (
              <EmptyState
                role="status"
                density="page"
                className="min-h-[48vh]"
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
            <Pressable
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="inline-flex h-8 min-h-[44px] sm:min-h-0 items-center rounded-lg border border-border/60 bg-background px-3 text-xs font-medium transition-colors hover:bg-muted/60 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Trước
            </Pressable>
            <span className="text-xs text-muted-foreground">
              Trang {page + 1} / {totalPages}
            </span>
            <Pressable
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex h-8 min-h-[44px] sm:min-h-0 items-center rounded-lg border border-border/60 bg-background px-3 text-xs font-medium transition-colors hover:bg-muted/60 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Sau
            </Pressable>
          </div>
        </div>
      )}
    </div>
  );
}
