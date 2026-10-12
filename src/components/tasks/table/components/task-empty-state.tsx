"use client";

import * as React from "react";
import { Plus, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { ArrowHint, InkIllustration } from "@/components/ui/empty-state";
import type { SmartFilterTab } from "../types";
import { Pressable } from "@/components/ui/pressable";
import type { TaskTab } from "@/domain/tasks/task-tabs";

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
  /** View đang chọn của trang (Đang thực hiện, Trễ hạn, Hoàn thành); view không phải bộ lọc nên không đếm vào bộ lọc */
  taskTab?: TaskTab;
  userName?: string;
  onResetFilters?: () => void;
  onAddTask?: () => void;
  canAddTask?: boolean;
  className?: string;
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
  taskTab,
  userName,
  onResetFilters,
  onAddTask,
  canAddTask = false,
  className,
}: TaskEmptyStateProps) {
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
    } else if (taskTab === "active" && activeFiltersCount === 0) {
      displayTitle = "Không có nhiệm vụ nào đang thực hiện";
      displayDescription = "Mọi nhiệm vụ đã hoàn thành, hoặc chưa có việc nào được giao. Chọn \"Tất cả\" để xem toàn bộ.";
    } else if (taskTab === "overdue" && activeFiltersCount === 0) {
      displayTitle = "Không có nhiệm vụ nào trễ hạn";
      displayDescription = "Tuyệt vời! Tất cả nhiệm vụ đều đúng tiến độ hoặc đã được giải quyết.";
    } else if (taskTab === "done" && activeFiltersCount === 0) {
      displayTitle = "Chưa có nhiệm vụ nào hoàn thành";
      displayDescription = "Nhiệm vụ hoàn thành sẽ hiện ở đây.";
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

  // Chưa có gì và được phép tạo việc: mũi tên chỉ lên nút "Tạo việc" ở thanh công cụ (chỉ từ md trở lên, nơi nút ở góc phải); nút giữa trang luôn hiện kèm phím tắt C.
  const pointsToCreate = !hasFilterActive && !(taskTab && taskTab !== "all") && canAddTask && Boolean(onAddTask);

  return (
    <div className="relative w-full">
    {pointsToCreate ? (
      <ArrowHint variant="loop" className="top-1 right-10" />
    ) : null}
    <div
      data-slot="workspace-empty-state"
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center min-h-[66vh] py-8 px-4 sm:px-6 text-center select-none max-w-4xl mx-auto w-full",
        className
      )}
    >
      {/* Tranh nét mực: kính lúp khi bộ lọc loại hết kết quả; bảng nhiệm vụ khi chưa có việc (không dựng dữ liệu giả) */}
      <InkIllustration name={hasFilterActive ? "no-results" : "tasks"} className="mb-4" />

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
          <Pressable
            onClick={onResetFilters}
            title="Đặt lại bộ lọc"
            aria-label="Xóa bộ lọc"
            className="inline-flex h-7 items-center gap-1.5 rounded-md bg-foreground px-3 text-xs font-medium text-background hover:bg-foreground/90 active:scale-[0.98] transition-colors"
          >
            <RotateCcw className="size-3.5" />
            <span>Xóa bộ lọc</span>
          </Pressable>
        )}

        {canAddTask && onAddTask && (
          <Pressable
            onClick={onAddTask}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium active:scale-[0.98] transition-colors",
              hasFilterActive && onResetFilters
                ? "text-muted-foreground hover:bg-muted hover:text-foreground"
                : "border border-border bg-card text-foreground hover:bg-muted"
            )}
          >
            <Plus className="size-3.5" />
            <span>Tạo nhiệm vụ mới</span>
            {pointsToCreate ? <kbd className="ml-1 font-sans text-xs text-muted-foreground/80">C</kbd> : null}
          </Pressable>
        )}
      </div>
    </div>
    </div>
  );
});
