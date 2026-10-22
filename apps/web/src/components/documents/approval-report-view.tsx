"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { VietnameseDatePicker } from "@/components/ui/vietnamese-date-picker";
import { WorkspacePageCard } from "@/components/workspace/page-card";
import { formatLedgerDate } from "@qcet/shared/lib/documents/document-ledger-format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Row { key: string; label: string; stage: string; decided: number; avgHours: number; onTimePercent: number }
interface Report { from: string; to: string; targetHours: number; total: { decided: number; avgHours: number; onTimePercent: number }; byUnit: Row[]; byApprover: Row[] }

const day = (iso: string) => iso.slice(0, 10);

/** Bảng số liệu theo đơn vị/người bằng bảng dùng chung: cột tên lấy phần còn lại, cột số rộng cố định căn phải. */
function ReportTable({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <section className="space-y-1">
      <h2 className="text-compact font-semibold text-foreground">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Chưa có quyết định nào trong khoảng này.</p>
      ) : (
        // Kéo khung ra bằng đệm cột đầu/cuối (16px, 20px từ sm) để chữ thẳng mép với tiêu đề phần
        <Table className="min-w-[560px] table-fixed" containerClassName="-mx-4 w-[calc(100%+2rem)] sm:-mx-5 sm:w-[calc(100%+2.5rem)]">
          <TableHeader>
            <TableRow>
              <TableHead>Tên</TableHead>
              <TableHead className="w-[128px] text-right">Số quyết định</TableHead>
              <TableHead className="w-[128px] text-right">Giờ trung bình</TableHead>
              <TableHead className="w-[112px] text-right">Đúng hạn</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.key}>
                <TableCell className="truncate" title={r.label}>
                  {r.label}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">{r.decided}</TableCell>
                <TableCell className="text-right text-xs tabular-nums">{r.avgHours}</TableCell>
                <TableCell className="text-right text-xs tabular-nums">{r.onTimePercent}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

/** "2026-07-24…" → "24/07/2026" (ngày nghiệp vụ hiển thị theo dd/MM/yyyy như mọi bảng khác). */
const displayDay = (iso: string) => formatLedgerDate(day(iso)) || day(iso);

const exportHref = (query: string, format: "xlsx" | "csv") =>
  `/api/documents/approval-report?${new URLSearchParams([...new URLSearchParams(query), ["format", format]]).toString()}`;

/**
 * Báo cáo thời gian duyệt tờ trình theo đơn vị và người, xuất CSV mở bằng Excel (V-06). Khung một thẻ như các trang trong nhóm
 * Văn bản; chọn ngày bằng `VietnameseDatePicker` (dd/MM/yyyy) thay ô ngày của trình duyệt, đang tải hiện khung giữ chỗ.
 */
export function ApprovalReportView() {
  const [report, setReport] = React.useState<Report | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");

  const query = React.useMemo(() => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return p.toString();
  }, [from, to]);

  const load = React.useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/documents/approval-report${query ? `?${query}` : ""}`, { cache: "no-store", signal });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error((json && (json.detail || json.error || json.title)) || "Không tải được báo cáo");
        setReport(json);
        setError(null);
      } catch (e) {
        // Hủy do đổi ngày hoặc rời trang: lần tải mới nhất sẽ ghi kết quả, không báo lỗi
        if ((e as { name?: string })?.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Không tải được báo cáo");
      }
      if (!signal?.aborted) setIsLoading(false);
    },
    [query],
  );

  React.useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  return (
    <WorkspacePageCard
      title="Báo cáo thời gian duyệt tờ trình"
      description="Lãnh đạo xem toàn bộ, trưởng đơn vị xem bước của đơn vị mình phụ trách"
      hideTitleOnMobile
      hideDescriptionOnMobile
      className="max-w-3xl"
      actions={
        <>
          <Button size="sm" variant="ghost" asChild>
            <a href={exportHref(query, "xlsx")}>Xuất Excel</a>
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <a href={exportHref(query, "csv")}>Xuất CSV</a>
          </Button>
        </>
      }
    >
      <section className="space-y-4" data-slot="approval-report">
        <div className="flex flex-wrap items-center gap-2">
          <VietnameseDatePicker value={from} onChange={setFrom} variant="chip" label="Từ ngày:" placeholder="dd/mm/yyyy" maxDate={to || undefined} periodPicker={false} />
          <VietnameseDatePicker value={to} onChange={setTo} variant="chip" label="Đến ngày:" placeholder="dd/mm/yyyy" minDate={from || undefined} periodPicker={false} />
        </div>
        {error && <InlineAlert variant="error">{error}</InlineAlert>}
        {isLoading && !report ? (
          <div aria-busy="true" aria-label="Đang tải báo cáo" className="space-y-4">
            <Skeleton className="h-3 w-80 rounded" />
            {[0, 1].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3.5 w-24 rounded" />
                {[0, 1, 2].map((j) => (
                  <div key={j} className="flex h-10 items-center gap-3">
                    <Skeleton className="h-3 flex-1 rounded" />
                    <Skeleton className="h-3 w-16 rounded" />
                    <Skeleton className="h-3 w-16 rounded" />
                    <Skeleton className="h-3 w-12 rounded" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : report ? (
          <div aria-busy={isLoading || undefined} className="space-y-4">
            <p className="text-xs text-muted-foreground tabular-nums">
              {displayDay(report.from)} – {displayDay(report.to)} · {report.total.decided} quyết định · trung bình {report.total.avgHours} giờ · đúng hạn (≤ {report.targetHours} giờ) {report.total.onTimePercent}%
            </p>
            <ReportTable title="Theo đơn vị" rows={report.byUnit} />
            <ReportTable title="Theo người" rows={report.byApprover} />
          </div>
        ) : null}
      </section>
    </WorkspacePageCard>
  );
}
