"use client";

import * as React from "react";
import {
  Shield,
  Users,
  Calendar,
  RefreshCw,
  Search,
  UserCheck,
  Clock,
  XCircle,
} from "lucide-react";
import * as m from "motion/react-m";
import { cn } from "@/lib/utils";
import { fadeVariants } from "@/lib/motion/variants";
import { motionTransition } from "@/lib/motion/tokens";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DelegationStatus = "ACTIVE" | "EXPIRED" | "REVOKED";

interface DelegationAssignment {
  user: { name: string };
  unit: { name: string };
  positionDefinition: { title: string };
}

interface DelegationItem {
  id: string;
  status: DelegationStatus;
  grantorAssignment: DelegationAssignment;
  granteeAssignment: DelegationAssignment;
  action: string;
  resourceScope: string | null;
  validFrom: string;
  validUntil: string;
  sourceDocumentNumber: string | null;
  reason: string | null;
}

type StatusFilterKey = "ALL" | DelegationStatus;

const PAGE_SIZE = 20;

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

const STATUS_LABELS: Record<DelegationStatus, string> = {
  ACTIVE: "Có hiệu lực",
  EXPIRED: "Hết hiệu lực",
  REVOKED: "Đã thu hồi",
};

const STATUS_STYLES: Record<DelegationStatus, string> = {
  ACTIVE: "bg-emerald-500/8 text-emerald-700 border-emerald-500/15",
  EXPIRED: "bg-muted/60 text-muted-foreground border-border/40",
  REVOKED: "bg-red-500/8 text-red-700 border-red-500/15",
};

const STATUS_FILTER_TABS: { key: StatusFilterKey; label: string }[] = [
  { key: "ALL", label: "Tất cả" },
  { key: "ACTIVE", label: "Có hiệu lực" },
  { key: "EXPIRED", label: "Hết hiệu lực" },
  { key: "REVOKED", label: "Đã thu hồi" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DelegationRegistryView() {
  // Data
  const [items, setItems] = React.useState<DelegationItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] =
    React.useState<StatusFilterKey>("ALL");
  const [searchInput, setSearchInput] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);

  // Debounced search
  React.useEffect(() => {
    const t = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Fetch data
  const fetchDelegations = React.useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const p = new URLSearchParams();
        if (statusFilter !== "ALL") p.set("status", statusFilter);

        const res = await fetch(`/api/delegations?${p.toString()}`, {
          signal,
        });
        if (!res.ok) {
          setFetchError("Không thể tải danh sách ủy quyền từ máy chủ");
          return;
        }
        const json = await res.json();
        if (json.data) {
          setItems(Array.isArray(json.data) ? json.data : []);
        } else {
          setFetchError("Phản hồi không hợp lệ từ máy chủ");
        }
      } catch (err: unknown) {
        if ((err as { name?: string })?.name !== "AbortError") {
          console.error("Fetch delegations error:", err);
          setFetchError("Lỗi kết nối máy chủ khi tải danh sách ủy quyền");
        }
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [statusFilter],
  );

  React.useEffect(() => {
    const ctrl = new AbortController();
    fetchDelegations(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchDelegations]);

  // Client-side search filter
  const filteredItems = React.useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (d) =>
        d.grantorAssignment.user.name.toLowerCase().includes(q) ||
        d.granteeAssignment.user.name.toLowerCase().includes(q) ||
        d.action.toLowerCase().includes(q) ||
        (d.sourceDocumentNumber ?? "").toLowerCase().includes(q),
    );
  }, [items, searchQuery]);

  // Stats
  const stats = React.useMemo(() => {
    const active = items.filter((i) => i.status === "ACTIVE").length;
    const expired = items.filter((i) => i.status === "EXPIRED").length;
    const revoked = items.filter((i) => i.status === "REVOKED").length;
    return { total: items.length, active, expired, revoked };
  }, [items]);

  const handleRefresh = () => fetchDelegations();

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <m.div
      className="mx-auto w-full max-w-[1440px] space-y-5 pb-6 md:pb-10"
      data-slot="delegation-registry-view"
      variants={fadeVariants}
      initial="initial"
      animate="animate"
    >
      {/* Header */}
      <div>
        <div className="flex flex-col gap-3 border-b border-border/40 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-0.5 text-xs font-semibold text-sky-700">
                <Shield className="size-3" strokeWidth={1.5} /> Ủy quyền
              </span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Ủy quyền tác nghiệp
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
              Quản lý phân quyền thay mặt xử lý công việc
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isLoading}
              className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl border border-border/70 bg-background px-3 text-xs font-medium shadow-2xs transition-colors hover:bg-muted/60 active:scale-[0.98] disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:min-h-9"
            >
              <RefreshCw
                className={cn("size-3.5", isLoading && "animate-spin")}
                strokeWidth={1.5}
              />
              Làm mới
            </button>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            {
              label: "Tổng ủy quyền",
              value: stats.total,
              icon: Shield,
              color: "text-foreground",
            },
            {
              label: "Có hiệu lực",
              value: stats.active,
              icon: UserCheck,
              color: "text-emerald-600",
            },
            {
              label: "Hết hiệu lực",
              value: stats.expired,
              icon: Clock,
              color: "text-muted-foreground",
            },
            {
              label: "Đã thu hồi",
              value: stats.revoked,
              icon: XCircle,
              color: "text-red-600",
            },
          ] as const
        ).map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-border/50 bg-card px-4 py-3 shadow-2xs"
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <s.icon
                className={cn("size-3.5", s.color)}
                strokeWidth={1.5}
              />
              {s.label}
            </div>
            <div className="mt-1 text-xl font-bold tracking-tight text-foreground">
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Status filter tabs — flat breadcrumb style */}
        <div className="flex items-center gap-1 rounded-lg bg-muted/40 p-1">
          {STATUS_FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                "min-h-[44px] rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-ring sm:min-h-0",
                statusFilter === tab.key
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-xs w-full sm:w-auto">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.5}
          />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Tìm theo tên, phạm vi…"
            className="h-9 w-full rounded-xl border border-border/70 bg-background pl-9 pr-3 text-xs shadow-2xs outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-ring focus:ring-2 focus:ring-ring focus-visible:ring-2 focus-visible:ring-ring sm:w-64"
          />
        </div>
      </div>

      {/* Error state */}
      {fetchError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-700">
          {fetchError}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border/50 bg-card shadow-2xs">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40 text-left">
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Users className="size-3" strokeWidth={1.5} />
                  Người ủy quyền
                </div>
              </th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <UserCheck className="size-3" strokeWidth={1.5} />
                  Người nhận ủy quyền
                </div>
              </th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                Phạm vi
              </th>
              <th className="hidden px-4 py-3 text-xs font-medium text-muted-foreground md:table-cell">
                <div className="flex items-center gap-1.5">
                  <Calendar className="size-3" strokeWidth={1.5} />
                  Hiệu lực từ
                </div>
              </th>
              <th className="hidden px-4 py-3 text-xs font-medium text-muted-foreground md:table-cell">
                <div className="flex items-center gap-1.5">
                  <Calendar className="size-3" strokeWidth={1.5} />
                  Hiệu lực đến
                </div>
              </th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                Trạng thái
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              /* Loading skeleton */
              Array.from({ length: 5 }).map((_, i) => (
                <tr
                  key={`skel-${i}`}
                  className="border-b border-border/20 animate-pulse"
                >
                  <td className="px-4 py-3">
                    <div className="space-y-1.5">
                      <div className="h-3.5 w-28 rounded bg-muted/60" />
                      <div className="h-3 w-20 rounded bg-muted/40" />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1.5">
                      <div className="h-3.5 w-28 rounded bg-muted/60" />
                      <div className="h-3 w-20 rounded bg-muted/40" />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-3.5 w-24 rounded bg-muted/50" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-3.5 w-20 rounded bg-muted/50" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-3.5 w-20 rounded bg-muted/50" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-5 w-16 rounded-full bg-muted/50" />
                  </td>
                </tr>
              ))
            ) : filteredItems.length === 0 ? (
              /* Empty state */
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Shield
                      className="size-10 text-muted-foreground/30"
                      strokeWidth={1.5}
                    />
                    <p className="text-sm text-muted-foreground">
                      Không tìm thấy ủy quyền nào
                    </p>
                    {searchQuery && (
                      <p className="text-xs text-muted-foreground/60">
                        Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm
                      </p>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredItems.slice(0, visibleCount).map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-border/20 transition-colors hover:bg-muted/30"
                >
                  {/* Người ủy quyền */}
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground text-sm">
                      {d.grantorAssignment.user.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {d.grantorAssignment.positionDefinition.title}
                      {d.grantorAssignment.unit.name &&
                        ` — ${d.grantorAssignment.unit.name}`}
                    </div>
                  </td>

                  {/* Người nhận ủy quyền */}
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground text-sm">
                      {d.granteeAssignment.user.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {d.granteeAssignment.positionDefinition.title}
                      {d.granteeAssignment.unit.name &&
                        ` — ${d.granteeAssignment.unit.name}`}
                    </div>
                  </td>

                  {/* Phạm vi */}
                  <td className="px-4 py-3 text-sm text-foreground">
                    {d.action}
                    {d.resourceScope && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {d.resourceScope}
                      </div>
                    )}
                  </td>

                  {/* Hiệu lực từ */}
                  <td className="hidden px-4 py-3 text-sm text-foreground tabular-nums md:table-cell">
                    {formatDate(d.validFrom)}
                  </td>

                  {/* Hiệu lực đến */}
                  <td className="hidden px-4 py-3 text-sm text-foreground tabular-nums md:table-cell">
                    {formatDate(d.validUntil)}
                  </td>

                  {/* Trạng thái */}
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                        STATUS_STYLES[d.status],
                      )}
                    >
                      {STATUS_LABELS[d.status]}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Load more */}
      {filteredItems.length > visibleCount && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl border border-border/70 bg-background px-4 py-2 text-xs font-medium shadow-2xs transition-colors hover:bg-muted/60 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:min-h-0"
          >
            Xem thêm ({filteredItems.length - visibleCount} còn lại)
          </button>
        </div>
      )}
    </m.div>
  );
}
