"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

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

/** Báo cáo thời gian duyệt tờ trình theo đơn vị và người, xuất CSV mở bằng Excel (V-06). */
export function ApprovalReportView({ className }: { className?: string }) {
  const [report, setReport] = React.useState<Report | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");

  const query = React.useMemo(() => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return p.toString();
  }, [from, to]);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/approval-report${query ? `?${query}` : ""}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error((json && (json.detail || json.error || json.title)) || "Không tải được báo cáo");
      setReport(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được báo cáo");
    }
  }, [query]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-muted-foreground">
          Từ ngày
          <Input compact type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-40" />
        </label>
        <label className="text-xs text-muted-foreground">
          Đến ngày
          <Input compact type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-40" />
        </label>
        <Button size="sm" variant="ghost" asChild>
          <a href={`/api/documents/approval-report?${new URLSearchParams([...new URLSearchParams(query), ["format", "xlsx"]]).toString()}`}>Xuất Excel</a>
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <a href={`/api/documents/approval-report?${new URLSearchParams([...new URLSearchParams(query), ["format", "csv"]]).toString()}`}>Xuất CSV</a>
        </Button>
      </div>
      {error && <InlineAlert variant="error">{error}</InlineAlert>}
      {report && (
        <>
          <p className="text-xs text-muted-foreground">
            {day(report.from)} đến {day(report.to)} · {report.total.decided} quyết định · trung bình {report.total.avgHours} giờ · đúng hạn (≤{report.targetHours} giờ) {report.total.onTimePercent}%
          </p>
          <ReportTable title="Theo đơn vị" rows={report.byUnit} />
          <ReportTable title="Theo người" rows={report.byApprover} />
        </>
      )}
    </section>
  );
}
