"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableEmptyValue, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ListToolbarFilterPopover, ListToolbarSearch } from "@/components/ui/list-toolbar";
import { ActiveFilterBar, FilterSegmentChip } from "@/components/workspace/components/active-filter-breadcrumb";
import { FilterIconStatus } from "@/components/dashboard/task-filter-icons";
import { WorkspacePageCard } from "@/components/workspace/page-card";
import { DocumentLoadError } from "@/components/documents/document-load-error";
import { TaskPaginationBar } from "@/components/tasks/table/components/task-pagination-bar";
import { TaskIconCategory, TaskIconStatus } from "@qcet/shared/lib/icons/task-icons";

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

const DEFAULT_PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  ...(Object.entries(STATUS_LABELS) as Array<[DossierStatus, string]>).map(([value, label]) => ({ value, label })),
];

const CLASSIFICATION_OPTIONS = [
  { value: "", label: "Tất cả phân loại" },
  { value: "PUBLIC", label: "Công khai" },
  { value: "INTERNAL", label: "Nội bộ" },
  { value: "RESTRICTED", label: "Hạn chế" },
  { value: "PERSONAL_DATA", label: "Dữ liệu cá nhân" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Hồ sơ công việc (`/dossiers`): khung một thẻ như các trang trong nhóm Văn bản, thanh công cụ tìm · lọc như Sổ văn bản, bảng dùng
 * chung `ui/table`. Không còn thẻ thống kê (chỉ đếm trên trang đang tải nên sai với tổng), nút "Làm mới" và nút tạo hồ sơ chưa làm.
 */
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
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);
  const isFiltered = Boolean(searchQuery.trim() || statusFilter || classificationFilter);
  // Chưa có hồ sơ nào và không lọc: chỉ giữ tiêu đề và trạng thái trống
  const isColdStartEmpty = !isLoading && !fetchError && items.length === 0 && !searchInput && !isFiltered;

  // Debounced search
  React.useEffect(() => {
    const t = setTimeout(() => {
      setSearchQuery(searchInput);
      setPage(1);
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
        if (classificationFilter) p.set("classification", classificationFilter);
        p.set("limit", String(pageSize));
        p.set("offset", String((page - 1) * pageSize));

        const res = await fetch(`/api/dossiers?${p.toString()}`, { signal });
        if (!res.ok) {
          setFetchError("Máy chủ chưa trả được danh sách. Thử lại sau ít phút.");
          return;
        }
        const json = await res.json();
        // API trả thẳng { items, total } (apiSuccess không bọc success/data)
        if (Array.isArray(json?.items)) {
          setItems(json.items);
          setTotal(json.total ?? 0);
        } else {
          setFetchError("Máy chủ trả dữ liệu không đúng dạng. Thử lại sau ít phút.");
        }
      } catch (err: unknown) {
        if ((err as { name?: string })?.name !== "AbortError") {
          console.error("Fetch dossiers error:", err);
          setFetchError("Mất kết nối tới máy chủ. Kiểm tra mạng rồi thử lại.");
        }
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [searchQuery, statusFilter, classificationFilter, page, pageSize],
  );

  React.useEffect(() => {
    const ctrl = new AbortController();
    fetchDossiers(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchDossiers]);

  const statusLabel = statusFilter ? STATUS_LABELS[statusFilter as DossierStatus] : undefined;
  const classificationLabel = CLASSIFICATION_OPTIONS.find((o) => o.value && o.value === classificationFilter)?.label;
  const clearFilters = () => {
    setStatusFilter("");
    setClassificationFilter("");
    setPage(1);
  };
  const clearAll = () => {
    clearFilters();
    setSearchInput("");
    setSearchQuery("");
  };
  const activeFilters = [
    ...(statusLabel ? [{ id: "status", label: "Trạng thái", value: statusLabel, Icon: FilterIconStatus, onClear: () => { setStatusFilter(""); setPage(1); } }] : []),
    ...(classificationLabel ? [{ id: "classification", label: "Phân loại", value: classificationLabel, Icon: undefined, onClear: () => { setClassificationFilter(""); setPage(1); } }] : []),
    ...(searchQuery.trim() ? [{ id: "search", label: "Từ khóa", value: `"${searchQuery.trim()}"`, Icon: undefined, onClear: () => { setSearchInput(""); setSearchQuery(""); } }] : []),
  ];
  // Số hồ sơ: ở mô tả khi xem cả danh sách; đang lọc thì hàng bộ lọc đã hiện số kết quả
  const countText = !isLoading && !fetchError && !isFiltered && total > 0 ? `${total} hồ sơ · ` : "";

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <WorkspacePageCard
      title="Hồ sơ công việc"
      description={`${countText}Lập và nộp lưu theo Nghị định 30/2020/NĐ-CP`}
      hideTitleOnMobile
      hideDescriptionOnMobile
      className="max-w-none"
      actions={
        isColdStartEmpty ? undefined : (
          <>
            <ListToolbarSearch
              value={searchInput}
              onChange={setSearchInput}
              placeholder="Tìm mã, tiêu đề…"
              aria-label="Tìm hồ sơ"
              title="Tìm theo mã hoặc tiêu đề hồ sơ"
            />
            <ListToolbarFilterPopover
              open={isFilterOpen}
              onOpenChange={setIsFilterOpen}
              ariaLabel="Bộ lọc hồ sơ"
              activeCount={(statusFilter ? 1 : 0) + (classificationFilter ? 1 : 0)}
              onClear={clearFilters}
              categories={[
                {
                  id: "status",
                  label: "Trạng thái",
                  Icon: TaskIconStatus,
                  options: STATUS_OPTIONS,
                  value: statusFilter,
                  valueLabel: statusLabel,
                  onSelect: (v) => {
                    setStatusFilter(v);
                    setPage(1);
                  },
                },
                {
                  id: "classification",
                  label: "Phân loại",
                  Icon: TaskIconCategory,
                  options: CLASSIFICATION_OPTIONS,
                  value: classificationFilter,
                  valueLabel: classificationLabel,
                  onSelect: (v) => {
                    setClassificationFilter(v);
                    setPage(1);
                  },
                },
              ]}
            />
          </>
        )
      }
    >
      <div className="empty-fill flex flex-col gap-4" data-slot="dossier-registry-view">
        {activeFilters.length > 0 ? (
          <ActiveFilterBar onClearAll={clearAll} filteredCount={isLoading || fetchError ? undefined : total}>
            {activeFilters.map((f) => (
              <FilterSegmentChip key={f.id} dataSlot={`filter-chip-${f.id}`} icon={f.Icon} label={f.label} value={f.value} onRemove={f.onClear} />
            ))}
          </ActiveFilterBar>
        ) : null}

        {fetchError ? (
          <div className="empty-fill">
            <DocumentLoadError density="page" title="Không thể tải danh sách hồ sơ" message={fetchError} onRetry={() => fetchDossiers()} />
          </div>
        ) : !isLoading && items.length === 0 ? (
          <div className="empty-fill">
            {isFiltered ? (
              <EmptyState
                role="status"
                density="page"
                icon={<FolderOpen />}
                title="Không tìm thấy hồ sơ nào"
                description="Thử bỏ bớt bộ lọc hoặc đổi từ khóa."
                action={
                  <Button size="pill" onClick={clearAll}>
                    Xóa bộ lọc
                  </Button>
                }
              />
            ) : (
              <EmptyState
                role="status"
                density="page"
                illustration="dossier"
                title="Chưa có hồ sơ công việc"
                description="Hồ sơ công việc đã lập sẽ hiện ở đây."
              />
            )}
          </div>
        ) : (
          <div aria-busy={isLoading || undefined}>
            {/* Bảng dùng chung như bảng Nhiệm vụ: cột tên lấy phần còn lại, cột thuộc tính rộng cố định, bớt cột theo bề rộng khung */}
            <Table density="two-line" className="table-fixed" containerClassName="@container">
              <TableHeader>
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
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={`skeleton-${i}`} aria-hidden="true">
                        <TableCell>
                          <div className="flex flex-col gap-1.5">
                            <Skeleton className="h-3 rounded" style={{ width: `${45 + ((i * 17) % 40)}%` }} />
                            <Skeleton className="h-2.5 w-32 rounded" />
                          </div>
                        </TableCell>
                        {Object.values(DOSSIER_COLUMN_CLASS).map((columnClass, j) => (
                          <TableCell key={j} className={columnClass}>
                            <Skeleton className={cn("h-3 rounded", j === 3 ? "ml-auto w-6" : "w-3/4")} />
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
                            {/* Mã hồ sơ ở dòng dưới tiêu đề (như số, ký hiệu ở Sổ văn bản): tiêu đề không bị mã dài chiếm chỗ đến chỉ còn "H…" */}
                            <div className="flex min-w-0 flex-col">
                              <Link
                                href={href}
                                tabIndex={-1}
                                onClick={(event) => event.stopPropagation()}
                                className="min-w-0 truncate text-compact font-medium text-foreground outline-none transition-colors group-hover:text-primary"
                                title={item.title}
                              >
                                {item.title}
                              </Link>
                              <span className="truncate text-xs tabular-nums text-muted-foreground" title={`Mã hồ sơ: ${item.code}`}>
                                {item.code}
                              </span>
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
                            {formatDate(item.openedAt) || <TableEmptyValue label="Chưa có ngày mở" />}
                          </TableCell>
                          <TableCell className={cn("whitespace-nowrap text-xs", STATUS_TONE[item.status] ?? "text-muted-foreground", DOSSIER_COLUMN_CLASS.status)}>
                            <span className="block truncate">{STATUS_LABELS[item.status]}</span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
              </TableBody>
            </Table>
            <TaskPaginationBar
              itemLabel="hồ sơ"
              currentPage={page}
              pageSize={pageSize}
              totalItems={total}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              disabled={isLoading}
            />
          </div>
        )}
      </div>
    </WorkspacePageCard>
  );
}
