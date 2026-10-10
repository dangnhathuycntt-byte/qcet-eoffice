"use client";

import * as React from "react";
import * as m from "motion/react-m";
import { useReducedMotion } from "motion/react";
import { Plus, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { ArrowHint, InkIllustration } from "@/components/ui/empty-state";
import { motionSpring } from "@/lib/motion/tokens";
import type { SmartFilterTab } from "../types";

export interface TaskEmptyStateProps {
  title?: string;
  description?: string;
  searchQuery?: string;
  activeTab?: SmartFilterTab | string;
  /** attention/workbox filter (e.g. "requires_my_approval", "overdue") — used to determine hasFilterActive */
  attention?: string;
  status?: string;
  academicMonth?: number | "ALL";
  department?: string;
  category?: string;
  priority?: string;
  userName?: string;
  onResetFilters?: () => void;
  onAddTask?: () => void;
  canAddTask?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Filter Empty Illustration — SVG filter+X, used when filters yield 0 results
// ---------------------------------------------------------------------------

function FilterEmptyIllustration({
  reducedMotion,
}: {
  reducedMotion: boolean;
}) {
  const instant = { duration: 0 };

  return (
    <div className="flex items-center justify-center pb-5 pt-2">
      <m.div
        className="relative"
        initial={reducedMotion ? false : { opacity: 0, y: 6, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={reducedMotion ? instant : motionSpring.gentle}
      >
        <svg
          width="120"
          height="100"
          viewBox="0 0 120 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-muted-foreground"
          aria-hidden="true"
        >
          {/* Ground shadow */}
          <ellipse cx="60" cy="90" rx="40" ry="6" fill="currentColor" opacity="0.06" />

          {/* Paper sheet */}
          <g transform="translate(28, 12) rotate(-2, 32, 36)">
            <rect x="3" y="3" width="58" height="72" rx="5" fill="currentColor" opacity="0.06" />
            <rect x="0" y="0" width="58" height="72" rx="5" fill="white" stroke="currentColor" strokeWidth="1" strokeOpacity="0.15" />
            <rect x="8" y="10" width="30" height="3" rx="1.5" fill="currentColor" opacity="0.1" />
            <rect x="8" y="18" width="42" height="3" rx="1.5" fill="currentColor" opacity="0.07" />
            <rect x="8" y="26" width="36" height="3" rx="1.5" fill="currentColor" opacity="0.07" />
            <rect x="8" y="34" width="24" height="3" rx="1.5" fill="currentColor" opacity="0.05" />
            <rect x="8" y="46" width="38" height="2.5" rx="1.25" fill="currentColor" opacity="0.04" />
            <rect x="8" y="53" width="28" height="2.5" rx="1.25" fill="currentColor" opacity="0.03" />
            <rect x="8" y="60" width="32" height="2.5" rx="1.25" fill="currentColor" opacity="0.03" />
          </g>

          {/* Filter funnel */}
          <g transform="translate(66, 44)">
            <path d="M6 4 L34 4 L23 18 L23 30 L17 33 L17 18 Z" fill="currentColor" opacity="0.05" />
            <path d="M4 2 L32 2 L21 16 L21 28 L15 31 L15 16 Z" fill="white" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.25" strokeLinejoin="round" />
            <path d="M8 4 L28 4" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.08" strokeLinecap="round" />
          </g>
        </svg>

        {/* Animated X badge */}
        <m.div
          className="absolute top-1.5 right-0 flex items-center justify-center size-7 rounded-full bg-background border border-border/80 shadow-card"
          initial={reducedMotion ? false : { opacity: 0, scale: 0, rotate: -120 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={reducedMotion ? instant : { ...motionSpring.snappy, delay: 0.18 }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-muted-foreground/60" aria-hidden="true">
            <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </m.div>
      </m.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const TaskEmptyState = React.memo(function TaskEmptyState({
  title,
  description,
  searchQuery,
  activeTab,
  attention,
  status,
  academicMonth,
  department,
  category,
  priority,
  userName,
  onResetFilters,
  onAddTask,
  canAddTask = false,
  className,
}: TaskEmptyStateProps) {
  const reducedMotion = useReducedMotion() ?? false;

  let displayTitle = title;
  let displayDescription = description;
  const isSearchEmpty = Boolean(searchQuery && searchQuery.trim().length > 0);

  const activeFiltersCount = [
    Boolean(isSearchEmpty),
    Boolean(department && department !== "ALL"),
    Boolean(category && category !== "ALL"),
    Boolean(priority && priority !== "ALL"),
    Boolean(status && status !== "ALL" && status !== "all"),
    Boolean(attention && attention !== "ALL" && attention !== "all"),
    Boolean(academicMonth !== undefined && academicMonth !== "ALL"),
    Boolean(activeTab && activeTab !== "all" && activeTab !== "ALL"),
  ].filter(Boolean).length;

  const hasFilterActive = activeFiltersCount > 0;

  // Nêu rõ bộ lọc đang loại hết kết quả để người dùng không nghĩ dữ liệu đã mất.
  const filterSummary = [
    isSearchEmpty ? `từ khóa "${searchQuery!.trim()}"` : null,
    academicMonth !== undefined && academicMonth !== "ALL" ? `tháng ${academicMonth}` : null,
  ].filter(Boolean) as string[];
  const otherFilters = activeFiltersCount - filterSummary.length;
  const filterNote = hasFilterActive
    ? `Đang áp dụng ${[...filterSummary, otherFilters > 0 ? `${otherFilters} bộ lọc khác` : null].filter(Boolean).join(", ")}.`
    : null;

  if (!displayTitle) {
    if (activeFiltersCount > 1) {
      displayTitle = "Không có nhiệm vụ phù hợp";
      displayDescription = "Thử thay đổi hoặc xóa bộ lọc hiện tại";
    } else if (isSearchEmpty) {
      displayTitle = `Không tìm thấy nhiệm vụ với từ khóa "${searchQuery}"`;
      displayDescription =
        "Vui lòng thử tìm kiếm với từ khóa khác, hoặc kiểm tra lại bộ lọc danh mục và trạng thái.";
    } else if (activeTab === "overdue" || attention === "overdue") {
      displayTitle = "Không có nhiệm vụ nào trễ hạn";
      displayDescription =
        "Tuyệt vời! Tất cả các nhiệm vụ đều đang đúng tiến độ hoặc đã được giải quyết.";
    } else if (
      status === "WAITING_APPROVAL" ||
      status === "waiting_approval" ||
      activeTab === "waiting_approval" ||
      attention === "requires_my_approval"
    ) {
      displayTitle = "Không có nhiệm vụ nào chờ phê duyệt";
      displayDescription =
        "Hiện tại không có nhiệm vụ hoặc báo cáo nào đang chờ duyệt từ bạn.";
    } else if (department && department !== "ALL") {
      displayTitle = `Đơn vị "${department}" chưa có nhiệm vụ`;
      displayDescription =
        "Không có nhiệm vụ nào được phân công hoặc đăng ký cho đơn vị này theo các tiêu chí hiện tại.";
    } else if (academicMonth !== undefined && academicMonth !== "ALL") {
      displayTitle = `Không có nhiệm vụ trong Tháng ${academicMonth}`;
      displayDescription = "Thử thay đổi hoặc xóa bộ lọc hiện tại";
    } else if (activeFiltersCount > 0) {
      displayTitle = "Không có nhiệm vụ phù hợp";
      displayDescription = "Thử thay đổi hoặc xóa bộ lọc hiện tại";
    } else {
      // Chưa từng có dữ liệu (không bộ lọc): nói bảng này dùng để làm gì và bước tiếp theo, không dùng thuật ngữ kỹ thuật.
      displayTitle = "Chưa có nhiệm vụ nào";
      displayDescription = canAddTask
        ? "Nhiệm vụ Thầy/Cô giao hoặc được giao sẽ hiện ở đây."
        : "Nhiệm vụ được giao cho Thầy/Cô sẽ hiện ở đây khi có người giao việc.";
    }
  }

  // Chưa có gì và được phép tạo việc: mũi tên chỉ lên nút "Tạo việc" ở thanh công cụ (chỉ từ md trở lên, nơi nút ở góc phải).
  const pointsToCreate = !hasFilterActive && canAddTask && Boolean(onAddTask);

  return (
    <div className="relative w-full">
    {pointsToCreate ? (
      <ArrowHint variant="loop" className="-top-2 right-10" />
    ) : null}
    <div
      data-slot="workspace-empty-state"
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center min-h-[40vh] py-8 px-4 sm:px-6 text-center select-none max-w-4xl mx-auto w-full",
        className
      )}
    >
      {/* Minh họa: phễu lọc khi có bộ lọc; tranh nét mực khi chưa có nhiệm vụ (không dựng dữ liệu giả) */}
      {hasFilterActive ? (
        <FilterEmptyIllustration reducedMotion={reducedMotion} />
      ) : (
        <InkIllustration name="tasks" className="mb-4" />
      )}

      {/* Title */}
      <h3 className="text-compact font-semibold text-foreground tracking-tight max-w-md text-balance">
        {displayTitle}
      </h3>

      {/* Description */}
      <p className="mt-1 text-xs text-muted-foreground max-w-md leading-relaxed text-balance">
        {displayDescription}
      </p>
      {filterNote ? <p className="mt-1 text-xs text-muted-foreground max-w-md">{filterNote}</p> : null}

      {/* Action Buttons */}
      <div className="mt-4 flex items-center justify-center gap-3 flex-wrap">
        {hasFilterActive && onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            title="Đặt lại bộ lọc"
            aria-label="Xóa bộ lọc"
            className="inline-flex h-7 items-center gap-1.5 rounded-md bg-foreground px-3 text-xs font-medium text-background hover:bg-foreground/90 cursor-pointer active:scale-[0.98] transition-colors"
          >
            <RotateCcw className="size-3.5" strokeWidth={1.5} />
            <span>Xóa bộ lọc</span>
          </button>
        )}

        {canAddTask && onAddTask && (
          <button
            type="button"
            onClick={onAddTask}
            className={cn(
              pointsToCreate && "md:hidden",
              "inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium cursor-pointer active:scale-[0.98] transition-colors",
              hasFilterActive && onResetFilters
                ? "text-muted-foreground hover:bg-muted hover:text-foreground"
                : "border border-border bg-card text-foreground hover:bg-muted"
            )}
          >
            <Plus className="size-3.5" strokeWidth={1.5} />
            <span>Tạo nhiệm vụ mới</span>
          </button>
        )}
      </div>
    </div>
    </div>
  );
});
