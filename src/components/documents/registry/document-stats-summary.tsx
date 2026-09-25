"use client";

import * as React from "react";
import * as m from "motion/react-m";
import {
  FileText,
  Clock,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Inbox,
  Send,
  FileCheck,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motionDuration, motionEase, motionSpring } from "@/lib/motion/tokens";

export type DocumentKpiType = "all" | "pending" | "processing" | "urgent" | "completed";

export interface DocumentStatsData {
  /** Tổng số lượng văn bản */
  total?: number;
  /** Văn bản đến */
  totalInbox?: number;
  /** Văn bản đi */
  totalOutbox?: number;
  /** Tờ trình nội bộ */
  totalSubmissions?: number;
  /** Văn bản chờ phân công / chờ bút phê */
  pending?: number;
  /** Văn bản đang xử lý */
  processing?: number;
  /** Văn bản có độ khẩn cao (Hỏa tốc, Thượng khẩn, Khẩn) hoặc quá hạn */
  urgent?: number;
  /** Văn bản quá hạn */
  overdue?: number;
  /** Văn bản đã hoàn thành / ký duyệt / lưu sổ */
  completed?: number;
  /** Số văn bản đã liên thông sang Task Hub */
  linkedTasks?: number;
}

export interface DocumentStatsSummaryProps {
  /** Thống kê số lượng */
  stats: DocumentStatsData;
  /** KPI card đang được chọn */
  activeKpi?: DocumentKpiType | null;
  /** Callback khi người dùng click vào một thẻ KPI */
  onSelectKpi?: (kpi: DocumentKpiType) => void;
  /** Callback riêng khi filter theo trạng thái */
  onStatusFilter?: (status: string) => void;
  /** Callback riêng khi filter theo độ khẩn */
  onUrgencyFilter?: (urgency: string) => void;
  /** Callback khi chuyển tab */
  onTabChange?: (tab: string) => void;
  /** Trạng thái filter hiện tại của parent (để tự động highlight thẻ active) */
  currentStatus?: string;
  currentUrgency?: string;
  currentTab?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Custom class */
  className?: string;
}

interface KpiCardConfig {
  key: DocumentKpiType;
  label: string;
  count: number;
  subtext: string;
  icon: React.ElementType;
  colorScheme: {
    iconBg: string;
    iconColor: string;
    activeBorder: string;
    activeBg: string;
    textColor: string;
  };
  ariaLabel: string;
}

export function DocumentStatsSummary({
  stats,
  activeKpi: explicitActiveKpi,
  onSelectKpi,
  onStatusFilter,
  onUrgencyFilter,
  onTabChange,
  currentStatus,
  currentUrgency,
  currentTab,
  isLoading = false,
  className,
}: DocumentStatsSummaryProps) {
  // Determine active KPI either from explicit prop or derived from current filters
  const resolvedActiveKpi: DocumentKpiType | null = React.useMemo(() => {
    if (explicitActiveKpi !== undefined) return explicitActiveKpi;

    if (currentUrgency && ["flash", "top_urgent", "urgent", "KHAN", "THUONG_KHAN", "HOA_TOC"].includes(currentUrgency)) {
      return "urgent";
    }
    if (currentStatus && ["pending_assignment", "CHO_PHAN_CONG"].includes(currentStatus)) {
      return "pending";
    }
    if (currentStatus && ["processing", "DANG_XU_LY", "delegated"].includes(currentStatus)) {
      return "processing";
    }
    if (currentStatus && ["completed", "DA_HOAN_THANH", "approved", "CHO_PHE_DUYET"].includes(currentStatus)) {
      return "completed";
    }
    if (currentTab === "all" && (!currentStatus || currentStatus === "ALL") && (!currentUrgency || currentUrgency === "ALL")) {
      return "all";
    }
    return null;
  }, [explicitActiveKpi, currentUrgency, currentStatus, currentTab]);

  const totalCount =
    stats.total ??
    ((stats.totalInbox ?? 0) + (stats.totalOutbox ?? 0) + (stats.totalSubmissions ?? 0));

  const kpiCards: KpiCardConfig[] = [
    {
      key: "all",
      label: "TỔNG VĂN BẢN",
      count: totalCount,
      subtext: "Toàn bộ sổ công văn",
      icon: FileText,
      colorScheme: {
        iconBg: "bg-sky-500/10 dark:bg-sky-500/20",
        iconColor: "text-sky-600 dark:text-sky-400",
        activeBorder: "border-sky-500/60 ring-2 ring-sky-500/20",
        activeBg: "bg-sky-500/5",
        textColor: "text-foreground",
      },
      ariaLabel: `Tổng văn bản: ${totalCount}. Nhấn để xem toàn bộ danh sách.`,
    },
    {
      key: "pending",
      label: "CHỜ XỬ LÝ",
      count: stats.pending ?? stats.totalSubmissions ?? 0,
      subtext: "Chờ BGH / Đơn vị phê duyệt",
      icon: Clock,
      colorScheme: {
        iconBg: "bg-amber-500/10 dark:bg-amber-500/20",
        iconColor: "text-amber-600 dark:text-amber-400",
        activeBorder: "border-amber-500/60 ring-2 ring-amber-500/20",
        activeBg: "bg-amber-500/5",
        textColor: "text-foreground",
      },
      ariaLabel: `Văn bản chờ xử lý: ${stats.pending ?? stats.totalSubmissions ?? 0}. Nhấn để lọc văn bản chờ xử lý.`,
    },
    {
      key: "processing",
      label: "ĐANG XỬ LÝ",
      count: stats.processing ?? 0,
      subtext: "Đang phân bổ thực hiện",
      icon: RefreshCw,
      colorScheme: {
        iconBg: "bg-blue-500/10 dark:bg-blue-500/20",
        iconColor: "text-blue-600 dark:text-blue-400",
        activeBorder: "border-blue-500/60 ring-2 ring-blue-500/20",
        activeBg: "bg-blue-500/5",
        textColor: "text-foreground",
      },
      ariaLabel: `Văn bản đang xử lý: ${stats.processing ?? 0}. Nhấn để lọc văn bản đang xử lý.`,
    },
    {
      key: "urgent",
      label: "QUÁ HẠN / KHẨN",
      count: stats.urgent ?? stats.overdue ?? 0,
      subtext: "Cần xử lý ưu tiên gấp",
      icon: AlertTriangle,
      colorScheme: {
        iconBg: "bg-rose-500/10 dark:bg-rose-500/20",
        iconColor: "text-rose-600 dark:text-rose-400",
        activeBorder: "border-rose-500/60 ring-2 ring-rose-500/20",
        activeBg: "bg-rose-500/5",
        textColor: "text-rose-600 dark:text-rose-400",
      },
      ariaLabel: `Văn bản quá hạn hoặc khẩn: ${stats.urgent ?? stats.overdue ?? 0}. Nhấn để lọc văn bản khẩn.`,
    },
    {
      key: "completed",
      label: "ĐÃ HOÀN THÀNH",
      count: stats.completed ?? 0,
      subtext: "Đã lưu sổ & liên thông",
      icon: CheckCircle2,
      colorScheme: {
        iconBg: "bg-emerald-500/10 dark:bg-emerald-500/20",
        iconColor: "text-emerald-600 dark:text-emerald-400",
        activeBorder: "border-emerald-500/60 ring-2 ring-emerald-500/20",
        activeBg: "bg-emerald-500/5",
        textColor: "text-foreground",
      },
      ariaLabel: `Văn bản đã hoàn thành: ${stats.completed ?? 0}. Nhấn để lọc văn bản đã hoàn thành.`,
    },
  ];

  const handleCardClick = (card: KpiCardConfig) => {
    if (onSelectKpi) {
      onSelectKpi(card.key);
    }

    switch (card.key) {
      case "all":
        if (onStatusFilter) onStatusFilter("ALL");
        if (onUrgencyFilter) onUrgencyFilter("ALL");
        if (onTabChange) onTabChange("all");
        break;
      case "pending":
        if (onStatusFilter) onStatusFilter("pending_assignment");
        if (onUrgencyFilter) onUrgencyFilter("ALL");
        break;
      case "processing":
        if (onStatusFilter) onStatusFilter("processing");
        if (onUrgencyFilter) onUrgencyFilter("ALL");
        break;
      case "urgent":
        if (onUrgencyFilter) onUrgencyFilter("urgent");
        if (onStatusFilter) onStatusFilter("ALL");
        break;
      case "completed":
        if (onStatusFilter) onStatusFilter("completed");
        if (onUrgencyFilter) onUrgencyFilter("ALL");
        break;
    }
  };

  return (
    <div
      className={cn(
        "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3",
        className
      )}
      data-slot="document-stats-summary"
      role="region"
      aria-label="Thống kê tổng quan sổ văn bản"
    >
      {kpiCards.map((card) => {
        const Icon = card.icon;
        const isActive = resolvedActiveKpi === card.key;

        return (
          <m.div
            key={card.key}
            role="button"
            tabIndex={0}
            aria-pressed={isActive}
            aria-label={card.ariaLabel}
            onClick={() => handleCardClick(card)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleCardClick(card);
              }
            }}
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.98 }}
            transition={{
              duration: motionDuration.fast,
              ease: motionEase.enter,
            }}
            className={cn(
              "p-3.5 sm:p-4 rounded-2xl border bg-card transition-all cursor-pointer select-none group relative overflow-hidden flex flex-col justify-between",
              isActive
                ? cn(card.colorScheme.activeBorder, card.colorScheme.activeBg, "shadow-sm")
                : "border-border/70 hover:border-primary/40 hover:shadow-2xs"
            )}
          >
            {/* Header: Label & Icon */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] sm:text-xs font-semibold tracking-wider text-muted-foreground truncate uppercase">
                {card.label}
              </span>
              <div
                className={cn(
                  "p-2 rounded-xl transition-colors shrink-0",
                  card.colorScheme.iconBg,
                  card.colorScheme.iconColor
                )}
                aria-hidden="true"
              >
                <Icon className="size-4" strokeWidth={1.5} />
              </div>
            </div>

            {/* Value & Counter */}
            <div className="space-y-0.5">
              <div className="flex items-baseline gap-2">
                <span
                  className={cn(
                    "text-2xl sm:text-3xl font-bold font-mono tracking-tight tabular-nums",
                    isLoading ? "animate-pulse opacity-50" : card.colorScheme.textColor
                  )}
                >
                  {isLoading ? "..." : card.count.toLocaleString("vi-VN")}
                </span>
                {isActive && (
                  <span className="size-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
                )}
              </div>
              <p className="text-[11px] text-muted-foreground truncate" title={card.subtext}>
                {card.subtext}
              </p>
            </div>
          </m.div>
        );
      })}
    </div>
  );
}
