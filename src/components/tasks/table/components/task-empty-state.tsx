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
  department?: string;
  category?: string;
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
  department,
  category,
  userName,
  onResetFilters,
  onAddTask,
  canAddTask = false,
  className,
}: TaskEmptyStateProps) {
  // Determine contextual heading and description
  let displayTitle = title;
  let displayDescription = description;
  let isSearchEmpty = Boolean(searchQuery && searchQuery.trim().length > 0);

  if (!displayTitle) {
    if (isSearchEmpty) {
      displayTitle = `Không tìm thấy nhiệm vụ với từ khóa "${searchQuery}"`;
      displayDescription =
        "Vui lòng thử tìm kiếm với từ khóa khác, hoặc kiểm tra lại bộ lọc danh mục và trạng thái.";
    } else if (activeTab === "my_tasks") {
      displayTitle = "Hòm việc cá nhân chưa có nhiệm vụ";
      displayDescription = userName
        ? `Tài khoản cán bộ ${userName} hiện không có nhiệm vụ trực tiếp nào cần xử lý.`
        : "Hiện tại bạn chưa được phân công nhiệm vụ nào trong kỳ đánh giá này.";
    } else if (activeTab === "overdue") {
      displayTitle = "Không có nhiệm vụ nào quá hạn";
      displayDescription =
        "Tuyệt vời! Tất cả các nhiệm vụ đều đang đúng tiến độ hoặc đã được giải quyết.";
    } else if (activeTab === "due_this_month") {
      displayTitle = "Không có nhiệm vụ nào đến hạn trong tháng này";
      displayDescription =
        "Kỳ tháng này không ghi nhận công việc cần bàn giao hoàn thành.";
    } else if (department && department !== "ALL") {
      displayTitle = `Đơn vị "${department}" chưa có nhiệm vụ`;
      displayDescription =
        "Không có nhiệm vụ nào được phân công hoặc đăng ký cho đơn vị này theo các tiêu chí hiện tại.";
    } else {
      displayTitle = "Chưa có nhiệm vụ nào trong danh sách";
      displayDescription =
        "Hệ thống chưa ghi nhận nhiệm vụ nào phù hợp với bộ lọc và điều kiện hiển thị hiện thời.";
    }
  }

  const hasFilterActive = Boolean(
    isSearchEmpty ||
    (department && department !== "ALL") ||
    (category && category !== "ALL") ||
    (activeTab && activeTab !== "all")
  );

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
      <div className="relative mb-4 flex size-14 items-center justify-center rounded-2xl bg-slate-100/90 border border-slate-200/80 shadow-2xs">
        {isSearchEmpty ? (
          <SearchX className="size-6 text-slate-500" strokeWidth={1.5} />
        ) : (
          <Inbox className="size-6 text-slate-500" strokeWidth={1.5} />
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
            className="inline-flex items-center gap-1.5 h-8.5 px-3.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-foreground cursor-pointer active:scale-95 transition-all"
          >
            <RotateCcw className="size-3.5 text-slate-500" strokeWidth={1.5} />
            <span>Đặt lại bộ lọc</span>
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
