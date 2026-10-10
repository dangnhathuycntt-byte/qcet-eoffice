"use client";

import * as React from "react";
import * as m from "motion/react-m";
import { fadeVariants } from "@/lib/motion/variants";
import { motionTransition } from "@/lib/motion/tokens";
import {
  BarChart3,
  FileText,
  ArrowDownToLine,
  ArrowUpFromLine,
  Building2,
  Hourglass,
  Clock,
  CheckCircle2,
  AlertCircle,
  Flame,
  Link2,
  RefreshCw,
  Loader2,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
}

interface StatCardDef {
  key: keyof DocumentStats;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  valueClassName?: string;
  cardClassName?: string;
}

// ---------------------------------------------------------------------------
// Card definitions — 3 rows
// ---------------------------------------------------------------------------

const ROW_1: StatCardDef[] = [
  { key: "total", label: "Tổng văn bản", icon: FileText },
  { key: "incoming", label: "Văn bản đến", icon: ArrowDownToLine },
  { key: "outgoing", label: "Văn bản đi", icon: ArrowUpFromLine },
  { key: "internal", label: "Nội bộ", icon: Building2 },
];

const ROW_2: StatCardDef[] = [
  { key: "pending", label: "Chờ phân công", icon: Hourglass },
  { key: "processing", label: "Đang xử lý", icon: Clock },
  { key: "completed", label: "Đã hoàn thành", icon: CheckCircle2 },
  {
    key: "overdue",
    label: "Trễ hạn",
    icon: AlertCircle,
    valueClassName: "text-red-600",
    cardClassName: "border-red-500/20 bg-red-500/5",
  },
];

const ROW_3: StatCardDef[] = [
  {
    key: "urgent",
    label: "Khẩn/Hỏa tốc",
    icon: Flame,
    valueClassName: "text-warning",
    cardClassName: "border-warning/20 bg-warning/5",
  },
  { key: "linkedTasks", label: "Đã gắn nhiệm vụ", icon: Link2 },
];

const ALL_ROWS = [ROW_1, ROW_2, ROW_3];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReportsOverviewView() {
  const [stats, setStats] = React.useState<DocumentStats | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [isExporting, setIsExporting] = React.useState(false);

  const fetchStats = React.useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/documents/stats", { signal });
      if (!res.ok) {
        setFetchError("Không thể tải dữ liệu thống kê từ máy chủ");
        return;
      }
      const json = await res.json();

      // Handle both nesting levels:
      //   apiSuccess wraps → { success, data: { total, ... } }
      //   double-wrapped  → { data: { data: { total, ... } } }
      const payload: DocumentStats | undefined =
        json?.data?.data ?? json?.data ?? json;

      if (typeof payload?.total !== "number") {
        setFetchError("Phản hồi không hợp lệ từ máy chủ");
        return;
      }
      setStats(payload);
    } catch (err: unknown) {
      if ((err as { name?: string })?.name !== "AbortError") {
        setFetchError("Lỗi kết nối máy chủ khi tải dữ liệu thống kê");
      }
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const ctrl = new AbortController();
    fetchStats(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchStats]);

  const handleRefresh = () => fetchStats();

  const handleExport = React.useCallback(async () => {
    if (!stats) return;
    setIsExporting(true);
    try {
      // Build CSV content
      const headers = ["Chỉ tiêu", "Giá trị"];
      const rows = ALL_ROWS.flat().map((card) => [
        card.label,
        String(stats[card.key]),
      ]);
      const csv = [headers, ...rows]
        .map((r) => r.map((c) => `"${c}"`).join(","))
        .join("\n");

      const blob = new Blob(["﻿" + csv], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bao-cao-thong-ke-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }, [stats]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <m.div
      className="mx-auto w-full max-w-[1440px] space-y-5 pb-6 md:pb-10"
      data-slot="reports-overview-view"
      variants={fadeVariants}
      initial="initial"
      animate="animate"
    >
      {/* Header */}
      <div>
        <div className="flex flex-col gap-3 border-b border-border/40 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/40 px-2.5 py-0.5 text-xs font-semibold text-foreground">
                <BarChart3 className="size-3" strokeWidth={1.5} /> Thống kê
              </span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Báo cáo thống kê
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
              Tổng quan tình hình xử lý văn bản và công việc
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting || isLoading || !stats}
              className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl border border-border/70 bg-background px-3 text-xs font-medium shadow-2xs transition-colors hover:bg-muted/60 active:scale-[0.98] disabled:opacity-50 sm:min-h-9 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {isExporting ? (
                <Loader2 className="size-3.5 animate-spin" strokeWidth={1.5} />
              ) : (
                <Download className="size-3.5" strokeWidth={1.5} />
              )}
              Xuất CSV
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isLoading}
              className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl border border-border/70 bg-background px-3 text-xs font-medium shadow-2xs transition-colors hover:bg-muted/60 active:scale-[0.98] disabled:opacity-50 sm:min-h-9 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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

      {/* Error state */}
      {fetchError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-700">
          <div className="flex items-center justify-between gap-3">
            <span>{fetchError}</span>
            <button
              type="button"
              onClick={handleRefresh}
              className="shrink-0 cursor-pointer rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-500/15 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Thử lại
            </button>
          </div>
        </div>
      )}

      {/* Stats Rows */}
      {ALL_ROWS.map((row, rowIdx) => (
        <div
          key={rowIdx}
          className={cn(
            "grid gap-3",
            row.length === 4
              ? "grid-cols-2 sm:grid-cols-4"
              : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
          )}
        >
          {isLoading
            ? row.map((card) => (
                <div
                  key={card.key}
                  className="animate-pulse rounded-xl border border-border/50 bg-card px-4 py-3 shadow-2xs"
                >
                  <div className="flex items-center gap-2">
                    <div className="h-3.5 w-3.5 rounded bg-muted/60" />
                    <div className="h-3 w-20 rounded bg-muted/50" />
                  </div>
                  <div className="mt-2 h-7 w-12 rounded bg-muted/60" />
                </div>
              ))
            : stats
              ? row.map((card, cardIdx) => {
                  const Icon = card.icon;
                  const value = stats[card.key];
                  const hasAccent = card.cardClassName && value > 0;
                  return (
                    <m.div
                      key={card.key}
                      className={cn(
                        "rounded-xl border px-4 py-3 shadow-2xs",
                        hasAccent
                          ? card.cardClassName
                          : "border-border/50 bg-card"
                      )}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        ...motionTransition.enter,
                        delay: (rowIdx * 4 + cardIdx) * 0.03,
                      }}
                    >
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Icon className="size-3.5" strokeWidth={1.5} />
                        {card.label}
                      </div>
                      <div
                        className={cn(
                          "mt-1 text-xl font-bold tracking-tight tabular-nums",
                          hasAccent && card.valueClassName
                            ? card.valueClassName
                            : card.valueClassName && value > 0
                              ? card.valueClassName
                              : "text-foreground"
                        )}
                      >
                        {value.toLocaleString("vi-VN")}
                      </div>
                    </m.div>
                  );
                })
              : !fetchError && (
                  <div className="col-span-full rounded-xl border border-border/50 bg-card px-6 py-10 text-center shadow-2xs">
                    <BarChart3
                      className="mx-auto size-8 text-muted-foreground/40"
                      strokeWidth={1.5}
                    />
                    <p className="mt-3 text-sm text-muted-foreground">
                      Chưa có dữ liệu thống kê
                    </p>
                  </div>
                )}
        </div>
      ))}
    </m.div>
  );
}
