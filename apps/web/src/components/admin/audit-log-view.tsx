"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { readAuditLogResponse } from "@/lib/admin/api-response";
import { WorkspacePageCard } from "@/components/workspace/page-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { VietnameseDatePicker } from "@/components/ui/vietnamese-date-picker";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

const EMPTY_FILTERS: Filters = { action: "", entityType: "", actorId: "", from: "", to: "" };

const DATE_TIME = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Ho_Chi_Minh",
});

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : DATE_TIME.format(d);
}

/**
 * Nhật ký hệ thống (`/admin/audit`, nhóm "Quản trị" trong menu "Thêm"): sự kiện ghi trong `AuditEvent`, mới nhất trước
 * (`GET /api/audit-logs`, quyền `system.audit.view`). Dựng lại 15/10/2026 theo khung một thẻ: hàng lọc gọn, bảng một dòng 40px.
 * API chỉ trả mã người thực hiện, chưa kèm tên.
 */
export function AuditLogView() {
  const [entries, setEntries] = React.useState<AuditLogEntry[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<{ message: string; retry: boolean } | null>(null);
  const [page, setPage] = React.useState(1);
  const [filters, setFilters] = React.useState<Filters>(EMPTY_FILTERS);
  const [draft, setDraft] = React.useState<Filters>(EMPTY_FILTERS);
  const [retryKey, setRetryKey] = React.useState(0);

  React.useEffect(() => {
    const ctrl = new AbortController();
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    for (const [key, value] of Object.entries(filters)) if (value.trim()) params.set(key, value.trim());
    setLoading(true);
    setError(null);
    fetch(`/api/audit-logs?${params.toString()}`, { signal: ctrl.signal })
      .then(async (res) => {
        if (res.status === 403) {
          setError({ message: "Thầy/Cô không có quyền xem nhật ký hệ thống. Chỉ tài khoản quản trị hệ thống xem được trang này.", retry: false });
          return;
        }
        if (res.status === 401) {
          setError({ message: "Phiên đăng nhập đã hết hạn. Thầy/Cô đăng nhập lại để xem nhật ký.", retry: false });
          return;
        }
        if (res.status === 400) {
          setError({ message: "Điều kiện lọc chưa hợp lệ. Thầy/Cô kiểm tra lại khoảng ngày và các ô lọc.", retry: false });
          return;
        }
        if (!res.ok) throw new Error();
        const response = readAuditLogResponse<AuditLogEntry>(await res.json());
        setEntries(response.entries);
        setTotal(response.total);
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === "AbortError") return;
        setError({ message: "Chưa tải được nhật ký hệ thống.", retry: true });
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [page, filters, retryKey]);

  const apply = (next: Filters) => {
    setDraft(next);
    setFilters(next);
    setPage(1);
  };
  const hasFilters = Object.values(filters).some((v) => v.trim());
  const dirty = JSON.stringify(draft) !== JSON.stringify(filters);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Không có quyền hoặc hết phiên: lọc hay tải lại cũng không đổi được kết quả
  const forbidden = error !== null && !error.retry && !hasFilters;

  const textFilter = (key: "actorId" | "action" | "entityType", label: string, placeholder: string) => (
    <Input
      compact
      value={draft[key]}
      onChange={(e) => setDraft((f) => ({ ...f, [key]: e.target.value }))}
      onKeyDown={(e) => {
        if (e.key === "Enter") apply(draft);
      }}
      placeholder={placeholder}
      aria-label={label}
      className="w-full font-mono placeholder:font-sans sm:w-36"
    />
  );

  return (
    <WorkspacePageCard
      title="Nhật ký hệ thống"
      description="Thao tác ghi vào hệ thống, mới nhất trước"
      hideTitleOnMobile
      className="max-w-5xl"
      actions={
        forbidden ? null : (
          <Button variant="ghost" size="icon-xs" aria-label="Tải lại nhật ký" onClick={() => setRetryKey((k) => k + 1)} disabled={loading}>
            <RefreshCw className={cn(loading && "motion-safe:animate-spin")} />
          </Button>
        )
      }
    >
      <div className="empty-fill flex flex-col gap-4 pb-6">
        {forbidden ? null : (
          <div role="group" aria-label="Lọc nhật ký" className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            {textFilter("action", "Hành động", "Hành động")}
            {textFilter("entityType", "Loại đối tượng", "Loại đối tượng")}
            {textFilter("actorId", "Mã người thực hiện", "Mã người dùng")}
            <VietnameseDatePicker
              value={draft.from}
              onChange={(from) => apply({ ...draft, from })}
              placeholder="Từ ngày"
              maxDate={draft.to || undefined}
              showPresets={false}
              triggerClassName="h-7"
            />
            <VietnameseDatePicker
              value={draft.to}
              onChange={(to) => apply({ ...draft, to })}
              placeholder="Đến ngày"
              minDate={draft.from || undefined}
              showPresets={false}
              triggerClassName="h-7"
            />
            <div className="col-span-2 flex items-center gap-1">
              <Button variant="toolbar" size="sm" onClick={() => apply(draft)} disabled={!dirty}>
                Lọc
              </Button>
              {hasFilters || dirty ? (
                <Button variant="ghost" size="sm" onClick={() => apply(EMPTY_FILTERS)}>
                  Xóa lọc
                </Button>
              ) : null}
            </div>
          </div>
        )}

        {error ? (
          <InlineAlert actionLabel={error.retry ? "Thử lại" : undefined} onAction={error.retry ? () => setRetryKey((k) => k + 1) : undefined}>
            {error.message}
          </InlineAlert>
        ) : loading && entries.length === 0 ? (
          <div aria-busy className="flex flex-col gap-3">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            role="status"
            density="page"
            glyph={hasFilters ? "no-results" : "archive"}
            title={hasFilters ? "Không có sự kiện phù hợp" : "Chưa có sự kiện nào được ghi"}
            description={hasFilters ? "Thử bỏ bớt điều kiện lọc hoặc mở rộng khoảng ngày." : undefined}
          />
        ) : (
          <>
            <Table aria-busy={loading || undefined} className="min-w-[760px] table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[17%]">Thời gian</TableHead>
                  <TableHead className="w-[22%]">Hành động</TableHead>
                  <TableHead className="w-[27%]">Đối tượng</TableHead>
                  <TableHead className="w-[17%]">Người thực hiện</TableHead>
                  <TableHead className="w-[17%]">Mã yêu cầu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className={loading ? "opacity-60" : undefined}>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">{formatDateTime(entry.createdAt)}</TableCell>
                    <TableCell className="truncate font-mono text-xs" title={entry.action}>
                      {entry.action}
                    </TableCell>
                    <TableCell className="truncate text-xs" title={`${entry.entityType} ${entry.entityId}`}>
                      <span className="font-medium">{entry.entityType}</span>{" "}
                      <span className="font-mono text-muted-foreground">{entry.entityId}</span>
                    </TableCell>
                    <TableCell className="truncate font-mono text-xs text-muted-foreground" title={entry.actorId ?? "Hệ thống"}>
                      {entry.actorId ?? "Hệ thống"}
                    </TableCell>
                    <TableCell className="truncate font-mono text-xs text-muted-foreground" title={entry.requestId ?? undefined}>
                      {entry.requestId ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs tabular-nums text-muted-foreground">
                {total} sự kiện · Trang {page}/{totalPages}
              </p>
              {totalPages > 1 ? (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    <ChevronLeft />
                    Trước
                  </Button>
                  <Button variant="ghost" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                    Sau
                    <ChevronRight />
                  </Button>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </WorkspacePageCard>
  );
}
