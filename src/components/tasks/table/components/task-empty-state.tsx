"use client";

import * as React from "react";
import {
  Inbox,
  Plus,
  RotateCcw,
  SearchX,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
  // Determine contextual heading and description
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

  if (!displayTitle) {
    if (activeFiltersCount > 1) {
      displayTitle = "Không có nhiệm vụ phù hợp";
      displayDescription = "Thử thay đổi hoặc xóa bộ lọc hiện tại";
    } else if (isSearchEmpty) {
      displayTitle = `Không tìm thấy nhiệm vụ với từ khóa "${searchQuery}"`;
      displayDescription =
        "Vui lòng thử tìm kiếm với từ khóa khác, hoặc kiểm tra lại bộ lọc danh mục và trạng thái.";
    } else if (activeTab === "overdue" || attention === "overdue") {
      displayTitle = "Không có nhiệm vụ nào quá hạn";
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
      displayTitle = "Chưa có nhiệm vụ nào trong danh sách";
      displayDescription =
        "Hệ thống chưa ghi nhận nhiệm vụ nào phù hợp với phạm vi hiển thị hiện thời.";
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center py-14 px-6 text-center select-none",
        className
      )}
    >
      {/* Icon Container with subtle layered circle styling */}
      <div className="relative mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted/60 border border-border/80 shadow-2xs">
        {isSearchEmpty ? (
          <SearchX className="size-6 text-muted-foreground" strokeWidth={1.5} />
        ) : (
          <Inbox className="size-6 text-muted-foreground" strokeWidth={1.5} />
        )}
      </div>

      {/* Title */}
      <h3 className="text-base font-semibold text-foreground tracking-tight max-w-md">
        {displayTitle}
      </h3>

      {/* Description */}
      <p className="mt-1.5 text-xs sm:text-[13px] text-muted-foreground max-w-md leading-relaxed">
        {displayDescription}
      </p>

      {/* Action Buttons */}
      <div className="mt-5 flex items-center justify-center gap-3 flex-wrap">
        {hasFilterActive && onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            title="Đặt lại bộ lọc"
            aria-label="Xóa bộ lọc"
            className="inline-flex items-center gap-1.5 h-8.5 px-3.5 rounded-lg border border-border bg-card text-xs font-semibold text-foreground shadow-2xs hover:bg-muted hover:text-foreground cursor-pointer active:scale-95 transition-all"
          >
            <RotateCcw className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
            <span>Xóa bộ lọc</span>
          </button>
        )}

        {canAddTask && onAddTask && (
          <button
            type="button"
            onClick={onAddTask}
            className="inline-flex items-center gap-1.5 h-8.5 px-3.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold shadow-xs hover:bg-primary/90 cursor-pointer active:scale-95 transition-all"
          >
            <Plus className="size-3.5" strokeWidth={1.5} />
            <span>Tạo nhiệm vụ mới</span>
          </button>
        )}
      </div>
    </div>
  );
});
