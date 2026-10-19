"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, RefreshCw } from "lucide-react";
import { WorkspacePageCard } from "@/components/workspace/page-card";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { focusRingClass } from "@/components/ui/focus-ring";
import { cn } from "@/lib/utils";

interface DocumentStats {
  total: number;
  incoming: number;
  outgoing: number;
  internal: number;
  pending: number;
  processing: number;
  completed: number;
  urgent: number;
  overdue: number;
  linkedTasks: number;
  buckets?: {
    incomingPending: number;
    incomingDone: number;
    outgoingPending: number;
    outgoingDone: number;
    outgoingIssued: number;
  };
  canViewApprovalReport?: boolean;
}

interface UnitHealth {
  departmentId: string;
  departmentName: string;
  totalTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  overdueTasks: number;
}

type Section<T> = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: T };

/** Thanh xếp chồng theo tình trạng: khác nhau về độ sáng (bảng DataViz), không dùng màu tín hiệu. */
const STATUS_SEGMENTS = [
  { key: "completed", label: "Đã hoàn thành", className: "bg-foreground/80" },
  { key: "processing", label: "Đang xử lý", className: "bg-foreground/50" },
  { key: "pending", label: "Chờ phân công", className: "bg-foreground/25" },
] as const;

/** Thanh xếp chồng theo đơn vị: trễ hạn tô màu cảnh báo (nhóm cần chú ý), hoàn thành và còn hạn hai nấc xám (bảng DataViz). */
const UNIT_SEGMENTS = [
  { key: "overdue", label: "Trễ hạn", className: "bg-destructive" },
  { key: "completed", label: "Hoàn thành", className: "bg-foreground/40" },
  { key: "open", label: "Còn hạn", className: "bg-foreground/12" },
] as const;

async function loadSection<T>(url: string, signal: AbortSignal, pick: (json: unknown) => T | null, subject: string): Promise<Section<T>> {
  try {
    const res = await fetch(url, { signal });
    const data = res.ok ? pick(await res.json()) : null;
    return data ? { status: "ready", data } : { status: "error", message: `Chưa tải được số liệu ${subject}.` };
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    return { status: "error", message: `Mất kết nối khi tải số liệu ${subject}.` };
  }
}

/**
 * Chỉ dùng `departmentHealth` của `/api/dashboard/overview` (cấp ngoài do legacyCompat; vẫn đọc được nếu bọc trong `data`). Không dùng
 * `stats` của API này: route luôn lọc `stats` theo việc chính người xem tham gia (kể cả Ban Giám hiệu), nên là số cá nhân, không khớp tổng đơn vị.
 */
function pickUnits(json: unknown): UnitHealth[] | null {
  type Body = { departmentHealth?: UnitHealth[] };
  const body = json as (Body & { data?: Body }) | null;
  const units = body?.departmentHealth ?? body?.data?.departmentHealth;
  return Array.isArray(units) ? units : null;
}

function pickDocumentStats(json: unknown): DocumentStats | null {
  const body = json as { data?: { data?: DocumentStats } & DocumentStats } & DocumentStats;
  const payload = body?.data?.data ?? body?.data ?? body;
  return typeof payload?.total === "number" ? payload : null;
}

/** Đơn vị có nhiệm vụ, nhiều việc trễ hạn lên đầu rồi tới nhiều việc nhất. */
function unitsWithTasks(units: UnitHealth[]) {
  return units.filter((u) => u.totalTasks > 0).sort((a, b) => b.overdueTasks - a.overdueTasks || b.totalTasks - a.totalTasks);
}

/**
 * Số chính của mục Nhiệm vụ là tổng các dòng đơn vị bên dưới (mỗi việc có một đơn vị chủ trì nên không đếm trùng giữa đơn vị).
 * Trễ hạn, còn hạn, hoàn thành không chồng nhau (cùng cách chia của thanh); "Đang thực hiện" chồng với trễ hạn nên chỉ có trong CSV.
 */
function taskTotals(units: UnitHealth[]) {
  const sum = (key: "totalTasks" | "inProgressTasks" | "completedTasks" | "overdueTasks") => units.reduce((acc, u) => acc + (u[key] ?? 0), 0);
  const total = sum("totalTasks");
  const completed = sum("completedTasks");
  const overdue = sum("overdueTasks");
  return {
    total,
    inProgress: sum("inProgressTasks"),
    completed,
    overdue,
    open: Math.max(0, total - overdue - completed),
    rate: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

function csvRows(units: UnitHealth[] | null, docs: DocumentStats | null): string[][] {
  const rows: [string, string, number][] = [];
  if (units && units.length > 0) {
    const t = taskTotals(units);
    rows.push(
      ["Nhiệm vụ", "Tổng nhiệm vụ", t.total],
      ["Nhiệm vụ", "Trễ hạn", t.overdue],
      ["Nhiệm vụ", "Còn hạn", t.open],
      ["Nhiệm vụ", "Hoàn thành", t.completed],
      ["Nhiệm vụ", "Đang thực hiện", t.inProgress],
      ["Nhiệm vụ", "Tỷ lệ hoàn thành (%)", t.rate],
    );
    for (const u of unitsWithTasks(units)) {
      const group = `Đơn vị chủ trì: ${u.departmentName}`;
      rows.push([group, "Tổng nhiệm vụ", u.totalTasks], [group, "Trễ hạn", u.overdueTasks], [group, "Hoàn thành", u.completedTasks]);
    }
  }
  if (docs) {
    rows.push(
      ["Văn bản", "Tổng văn bản", docs.total],
      ["Văn bản", "Văn bản đến", docs.incoming],
      ["Văn bản", "Văn bản đi", docs.outgoing],
      ["Văn bản", "Tờ trình nội bộ", docs.internal],
      ["Văn bản", "Chờ phân công", docs.pending],
      ["Văn bản", "Đang xử lý", docs.processing],
      ["Văn bản", "Đã hoàn thành", docs.completed],
      ["Văn bản", "Trễ hạn", docs.overdue],
      ["Văn bản", "Khẩn, thượng khẩn, hỏa tốc", docs.urgent],
      ["Văn bản", "Đã gắn nhiệm vụ", docs.linkedTasks],
    );
    if (docs.buckets) {
      rows.push(
        ["Văn bản", "Văn bản đến chờ xử lý", docs.buckets.incomingPending],
        ["Văn bản", "Văn bản đến đã xử lý", docs.buckets.incomingDone],
        ["Văn bản", "Văn bản đi chờ xử lý", docs.buckets.outgoingPending],
        ["Văn bản", "Văn bản đi đã xử lý", docs.buckets.outgoingDone],
        ["Văn bản", "Văn bản đi đã phát hành", docs.buckets.outgoingIssued],
      );
    }
  }
  return [["Nhóm", "Chỉ tiêu", "Giá trị"], ...rows.map(([group, label, value]) => [group, label, String(value)])];
}

/**
 * Báo cáo thống kê (`/reports`, mục "Báo cáo" ở sidebar): số liệu tổng hợp trong phạm vi người dùng được xem (chốt 15/10/2026;
 * trang Tổng quan từng giữ việc của riêng người dùng đã bỏ 19/10/2026).
 * - Nhiệm vụ: `departmentHealth` của `/api/dashboard/overview`, mọi việc do đơn vị chủ trì kể cả việc con;
 *   Ban Giám hiệu xem mọi đơn vị, người thuộc đơn vị chỉ thấy đơn vị mình, tài khoản chưa thuộc đơn vị không có số liệu.
 * - Văn bản: `/api/documents/stats`, văn bản chưa lưu trữ mà người dùng được xem; mỗi loại văn bản mở đúng sổ ở sidebar.
 * Con số chính không khung, so sánh nhóm bằng thanh ngang, tỷ lệ bằng thanh xếp chồng (bảng DataViz).
 */
export function ReportsOverviewView() {
  const [tasks, setTasks] = React.useState<Section<UnitHealth[]>>({ status: "loading" });
  const [docs, setDocs] = React.useState<Section<DocumentStats>>({ status: "loading" });
  const [refreshing, setRefreshing] = React.useState(true);
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    const ctrl = new AbortController();
    setRefreshing(true);
    // Làm mới không đưa về trạng thái chờ: số cũ giữ nguyên tới khi có kết quả mới, không nháy khung chờ
    Promise.all([
      loadSection("/api/dashboard/overview", ctrl.signal, pickUnits, "nhiệm vụ").then(setTasks),
      loadSection("/api/documents/stats", ctrl.signal, pickDocumentStats, "văn bản").then(setDocs),
    ])
      .then(() => setRefreshing(false))
      .catch(() => {
        // Huỷ khi rời trang: bỏ qua
      });
    return () => ctrl.abort();
  }, [reloadKey]);

  const retry = () => setReloadKey((key) => key + 1);
  const taskData = tasks.status === "ready" ? tasks.data : null;
  const totals = taskData ? taskTotals(taskData) : null;
  const docData = docs.status === "ready" ? docs.data : null;

  const handleExport = () => {
    if (!taskData && !docData) return;
    const csv = csvRows(taskData, docData)
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bao-cao-thong-ke-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <WorkspacePageCard
      title="Báo cáo thống kê"
      description="Nhiệm vụ và văn bản trong phạm vi Thầy/Cô được xem"
      hideTitleOnMobile
      className="max-w-4xl"
      actions={
        <>
          <Button variant="ghost" size="icon-xs" aria-label="Làm mới số liệu" onClick={retry} disabled={refreshing}>
            <RefreshCw className={cn(refreshing && "motion-safe:animate-spin")} />
          </Button>
          <Button variant="toolbar" size="pill" onClick={handleExport} disabled={!taskData && !docData}>
            Xuất CSV
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-12 pb-6 pt-2">
        <ReportGroup id="reports-tasks" title="Nhiệm vụ">
          {tasks.status === "error" ? (
            <InlineAlert actionLabel="Thử lại" onAction={retry}>
              {tasks.message}
            </InlineAlert>
          ) : !taskData || !totals ? (
            <GroupSkeleton />
          ) : taskData.length === 0 ? (
            <p className="text-compact text-muted-foreground">Tài khoản chưa thuộc đơn vị nào nên chưa có số liệu nhiệm vụ theo đơn vị chủ trì.</p>
          ) : (
            <>
              <KeyNumbers
                numbers={[
                  { label: "Tổng nhiệm vụ", value: totals.total },
                  { label: "Trễ hạn", value: totals.overdue, tone: totals.overdue > 0 ? "text-destructive" : "" },
                  { label: "Còn hạn", value: totals.open },
                  { label: "Tỷ lệ hoàn thành", value: `${totals.rate}%` },
                ]}
              />
              <UnitTasks units={taskData} />
            </>
          )}
        </ReportGroup>

        <ReportGroup
          id="reports-documents"
          title="Văn bản"
          action={
            docData?.canViewApprovalReport ? (
              <Button asChild variant="ghost" size="sm">
                <Link href="/documents/approval-report">
                  Thời gian duyệt tờ trình
                  <ChevronRight data-icon="inline-end" />
                </Link>
              </Button>
            ) : null
          }
        >
          {docs.status === "error" ? (
            <InlineAlert actionLabel="Thử lại" onAction={retry}>
              {docs.message}
            </InlineAlert>
          ) : !docData ? (
            <GroupSkeleton />
          ) : (
            <>
              <KeyNumbers
                numbers={[
                  { label: "Tổng văn bản", value: docData.total },
                  { label: "Trễ hạn", value: docData.overdue, tone: docData.overdue > 0 ? "text-destructive" : "" },
                  { label: "Khẩn, hỏa tốc", value: docData.urgent, tone: docData.urgent > 0 ? "text-warning" : "" },
                  { label: "Đã gắn nhiệm vụ", value: docData.linkedTasks },
                ]}
              />
              <div className="grid gap-10 md:grid-cols-2">
                <ByType stats={docData} />
                <ByStatus stats={docData} />
              </div>
            </>
          )}
        </ReportGroup>
      </div>
    </WorkspacePageCard>
  );
}

function ReportGroup({ id, title, action, children }: { id: string; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-6">
      <div className="flex min-h-8 items-center justify-between gap-2 border-b border-border pb-2">
        <h2 id={id} className="text-compact font-semibold text-foreground">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Subsection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3">
      <h3 id={id} className="text-xs font-medium text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function GroupSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <Skeleton className="h-14 w-2/3" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

function KeyNumbers({ numbers }: { numbers: { label: string; value: number | string; tone?: string }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-4 sm:flex sm:gap-x-12">
      {numbers.map((n) => (
        <div key={n.label} className="flex flex-col">
          <dt className="text-xs text-muted-foreground">{n.label}</dt>
          <dd className={cn("mt-1 text-2xl font-semibold tabular-nums text-foreground", n.tone)}>{n.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Nhiệm vụ theo đơn vị chủ trì: độ dài thanh theo số việc, mỗi thanh chia trễ hạn / hoàn thành / còn hạn. Không bấm sang Nhiệm vụ vì
 * danh sách ở đó lọc theo phạm vi và đơn vị khác cách đếm ở đây. Không đơn vị nào có việc thì ẩn mục (số chính đã là 0).
 */
function UnitTasks({ units }: { units: UnitHealth[] }) {
  const list = unitsWithTasks(units);
  if (list.length === 0) return null;
  const max = Math.max(1, ...list.map((u) => u.totalTasks));
  return (
    <Subsection id="reports-units" title="Theo đơn vị chủ trì">
      <ul className="flex flex-col gap-3">
        {list.map((unit) => {
          const parts = {
            overdue: unit.overdueTasks,
            completed: unit.completedTasks,
            open: Math.max(0, unit.totalTasks - unit.overdueTasks - unit.completedTasks),
          };
          const summary = `${parts.overdue} trễ hạn, ${parts.completed} hoàn thành, ${parts.open} còn hạn`;
          return (
            // Màn hẹp: tên và số việc một dòng, thanh xuống dòng dưới; từ sm: tên | thanh | số trên một dòng. Tên đơn vị không cắt "…", tối đa 2 dòng.
            <li key={unit.departmentId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 text-xs sm:grid-cols-[12rem_minmax(0,1fr)_2.5rem]">
              <span className="col-start-1 row-start-1 line-clamp-2 text-foreground">{unit.departmentName}</span>
              <span className="col-start-2 row-start-1 text-right tabular-nums text-muted-foreground sm:col-start-3">{unit.totalTasks}</span>
              <div
                role="img"
                aria-label={`${unit.departmentName}: ${unit.totalTasks} nhiệm vụ, ${summary}`}
                title={summary}
                className="col-span-2 row-start-2 flex h-2 overflow-hidden rounded-full bg-secondary sm:col-span-1 sm:col-start-2 sm:row-start-1"
                style={{ width: `${Math.max(8, (unit.totalTasks / max) * 100)}%` }}
              >
                {UNIT_SEGMENTS.map((seg) =>
                  parts[seg.key] > 0 ? (
                    <span key={seg.key} className={seg.className} style={{ width: `${(parts[seg.key] / unit.totalTasks) * 100}%` }} />
                  ) : null
                )}
              </div>
              {list.length === 1 ? <p className="col-span-full tabular-nums text-muted-foreground">{summary}</p> : null}
            </li>
          );
        })}
      </ul>
      <ul aria-hidden className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {UNIT_SEGMENTS.map((seg) => (
          <li key={seg.key} className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", seg.className)} />
            {seg.label}
          </li>
        ))}
      </ul>
    </Subsection>
  );
}

/** So sánh ba loại văn bản: thanh ngang xếp giảm dần, nhãn bên trái, số bên phải; bấm một dòng mở sổ tương ứng ở sidebar. */
function ByType({ stats }: { stats: DocumentStats }) {
  const rows = [
    { label: "Văn bản đến", value: stats.incoming, href: "/documents?type=inbox" },
    { label: "Văn bản đi", value: stats.outgoing, href: "/documents?type=outbox" },
    { label: "Tờ trình nội bộ", value: stats.internal, href: "/documents?tab=submission" },
  ].sort((a, b) => b.value - a.value);
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <Subsection id="reports-by-type" title="Theo loại văn bản">
      <ul className="-mx-2 flex flex-col">
        {rows.map((row) => (
          <li key={row.label}>
            <Link
              href={row.href}
              className={cn(
                "grid h-8 grid-cols-[7.5rem_minmax(0,1fr)_2rem_0.875rem] items-center gap-3 rounded-md px-2 text-xs transition-colors hover:bg-accent",
                focusRingClass
              )}
            >
              <span className="truncate text-foreground">{row.label}</span>
              <span className="h-2 overflow-hidden rounded-full bg-secondary">
                <span className="block h-full rounded-full bg-foreground/40" style={{ width: `${(row.value / max) * 100}%` }} />
              </span>
              <span className="text-right tabular-nums text-muted-foreground">{row.value}</span>
              <ChevronRight aria-hidden className="size-3.5 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </Subsection>
  );
}

/** Tỷ lệ theo tình trạng xử lý: một thanh xếp chồng; phần không thuộc ba nhóm (vd. mới nhận) ghi là "Khác". */
function ByStatus({ stats }: { stats: DocumentStats }) {
  const known = stats.pending + stats.processing + stats.completed;
  const other = Math.max(0, stats.total - known);
  const parts = [
    ...STATUS_SEGMENTS.map((seg) => ({ ...seg, value: stats[seg.key] })),
    ...(other > 0 ? [{ key: "other", label: "Khác", className: "bg-secondary", value: other }] : []),
  ];
  const total = Math.max(1, stats.total);
  return (
    <Subsection id="reports-by-status" title="Theo tình trạng xử lý">
      <div
        role="img"
        aria-label={parts.map((p) => `${p.label} ${p.value}`).join(", ")}
        className="flex h-3 gap-px overflow-hidden rounded-full bg-secondary"
      >
        {parts.map((p) =>
          p.value > 0 ? (
            <span key={p.key} className={cn("h-full", p.className)} style={{ width: `${(p.value / total) * 100}%` }} />
          ) : null
        )}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-1.5">
            <span aria-hidden className={cn("size-2 rounded-full", p.className)} />
            {p.label}
            <span className="tabular-nums text-foreground">{p.value}</span>
          </li>
        ))}
      </ul>
    </Subsection>
  );
}
