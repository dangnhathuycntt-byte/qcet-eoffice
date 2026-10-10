"use client";

import * as React from "react";
import {
  FileText,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Search,
  RefreshCw,
} from "lucide-react";
import { readAuditLogResponse } from "@/lib/admin/api-response";
import { Pressable } from "@/components/ui/pressable";

interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  requestId?: string | null;
  createdAt: string;
}

interface Filters {
  action: string;
  entityType: string;
  actorId: string;
  from: string;
  to: string;
}

const PAGE_SIZE = 20;

const formatDate = (iso: string): string => {
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const emptyFilters: Filters = {
  action: "",
  entityType: "",
  actorId: "",
  from: "",
  to: "",
};

export function AuditLogView() {
  const [entries, setEntries] = React.useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [filters, setFilters] = React.useState<Filters>(emptyFilters);
  const [draftFilters, setDraftFilters] = React.useState<Filters>(emptyFilters);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchEntries = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    if (filters.action) params.set("action", filters.action);
    if (filters.entityType) params.set("entityType", filters.entityType);
    if (filters.actorId) params.set("actorId", filters.actorId);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);

    try {
      const res = await fetch(`/api/audit-logs?${params.toString()}`);

      if (res.status === 403) {
        setError("Bạn không có quyền truy cập nhật ký kiểm toán");
        setEntries([]);
        setTotal(0);
        return;
      }

      if (res.status === 401) {
        setError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        setEntries([]);
        setTotal(0);
        return;
      }

      if (!res.ok) {
        throw new Error(`Lỗi ${res.status}`);
      }

      const response = readAuditLogResponse<AuditLogEntry>(await res.json());
      setEntries(response.entries);
      setTotal(response.total);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không thể tải nhật ký kiểm toán"
      );
      setEntries([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  React.useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const applyFilters = () => {
    setFilters({ ...draftFilters });
    setPage(1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") applyFilters();
  };

  // --- Loading state ---
  if (loading && entries.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-background overflow-hidden">
        <div className="p-4 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-10 rounded-lg bg-muted animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  // --- Error state ---
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium text-red-800">{error}</p>
            <Pressable
              type="button"
              onClick={fetchEntries}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-red-700 hover:text-red-900 min-h-[44px] sm:min-h-0 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Thử lại
            </Pressable>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="rounded-xl border border-border bg-background p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Người thực hiện
            </label>
            <input
              type="text"
              value={draftFilters.actorId}
              onChange={(e) =>
                setDraftFilters((f) => ({ ...f, actorId: e.target.value }))
              }
              onKeyDown={handleKeyDown}
              placeholder="ID người thực hiện"
              className="block w-40 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 min-h-[44px] sm:min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-shadow"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Hành động
            </label>
            <input
              type="text"
              value={draftFilters.action}
              onChange={(e) =>
                setDraftFilters((f) => ({ ...f, action: e.target.value }))
              }
              onKeyDown={handleKeyDown}
              placeholder="VD: CREATE, UPDATE"
              className="block w-40 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 min-h-[44px] sm:min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-shadow"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Loại đối tượng
            </label>
            <input
              type="text"
              value={draftFilters.entityType}
              onChange={(e) =>
                setDraftFilters((f) => ({ ...f, entityType: e.target.value }))
              }
              onKeyDown={handleKeyDown}
              placeholder="VD: TASK, DOCUMENT"
              className="block w-40 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 min-h-[44px] sm:min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-shadow"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Từ ngày</label>
            <input
              type="date"
              value={draftFilters.from}
              onChange={(e) =>
                setDraftFilters((f) => ({ ...f, from: e.target.value }))
              }
              className="block rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground min-h-[44px] sm:min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-shadow"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Đến ngày
            </label>
            <input
              type="date"
              value={draftFilters.to}
              onChange={(e) =>
                setDraftFilters((f) => ({ ...f, to: e.target.value }))
              }
              className="block rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground min-h-[44px] sm:min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-shadow"
            />
          </div>

          <button
            onClick={applyFilters}
            className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-white min-h-[44px] sm:min-h-0 hover:bg-foreground/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all"
          >
            <Search className="h-3.5 w-3.5" />
            Lọc
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="relative rounded-xl border border-border bg-background overflow-hidden">
        {loading && (
          <div className="absolute inset-0 bg-background/60 z-10" />
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Thời gian
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Người thực hiện
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Hành động
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Loại đối tượng
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  ID đối tượng
                </th>
                <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Request ID
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {entries.length === 0 && !loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <FileText className="h-10 w-10 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">
                        Chưa có nhật ký kiểm toán nào
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDate(entry.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-foreground font-medium">
                      {entry.actorId}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {entry.entityType}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {entry.entityId}
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-muted-foreground/60 font-mono text-xs truncate max-w-[200px]">
                      {entry.requestId ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Trang {page} / {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground min-h-[44px] sm:min-h-0 hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
              Trước
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground min-h-[44px] sm:min-h-0 hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all"
            >
              Sau
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
