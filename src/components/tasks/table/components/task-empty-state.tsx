"use client";

import * as React from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState, type IllustrationName } from "@/components/ui/empty-state";
import { CreateButtonWithHint } from "@/components/ui/onboarding-hint";
import type { SmartFilterTab } from "../types";
import { Button } from "@/components/ui/button";
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
  /** View khác còn việc khi view đang chọn trống: nêu số việc và nút chuyển sang. */
  suggestedView?: { id: TaskTab; count: number; onSelect: () => void };
  onResetFilters?: () => void;
  onAddTask?: () => void;
  canAddTask?: boolean;
  className?: string;
}

/**
 * Câu và nút khi view đang chọn trống nhưng view khác còn việc. Đang thực hiện và Trễ hạn tách rời, và view được gợi ý là view
 * còn việc đầu tiên theo thứ tự Đang thực hiện → Trễ hạn → Hoàn thành: gợi ý Trễ hạn nghĩa là mọi việc chưa xong đều đã quá hạn,
 * gợi ý Hoàn thành nghĩa là không còn việc dang dở (việc đã hủy không thuộc view nào trong ba view này).
 */
const SUGGESTED_VIEW_COPY: Partial<Record<TaskTab, { describe: (count: number) => string; action: string }>> = {
  overdue: { describe: (n) => `Việc chưa xong đều đã quá hạn: ${n} nhiệm vụ đang ở Trễ hạn.`, action: "Xem việc trễ hạn" },
  active: { describe: (n) => `${n} nhiệm vụ đang thực hiện.`, action: "Xem việc đang thực hiện" },
  done: { describe: (n) => `Không còn việc dang dở: ${n} nhiệm vụ đã hoàn thành.`, action: "Xem việc đã hoàn thành" },
};

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
  suggestedView,
  onResetFilters,
  onAddTask,
  canAddTask = false,
  className,
}: TaskEmptyStateProps) {
  let displayTitle = title;
  let displayDescription = description;
  let isIntro = false;
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
      // Chưa từng có dữ liệu (không bộ lọc): câu chữ người dùng chốt 14/10/2026; người không được tạo việc chỉ nghe việc sẽ hiện ở đây.
      isIntro = true;
      displayTitle = "Chưa có nhiệm vụ nào";
      displayDescription = canAddTask
        ? "Tạo nhiệm vụ đầu tiên để phân công, theo dõi tiến độ và quản lý công việc tại một nơi."
        : "Nhiệm vụ được giao cho Thầy/Cô sẽ hiện ở đây để theo dõi tiến độ và cập nhật kết quả.";
    }
  }

  // View trống nhưng view khác còn việc: nói việc đang ở đâu thay cho câu chung chung.
  const suggestedCopy = suggestedView && !hasFilterActive && !title ? SUGGESTED_VIEW_COPY[suggestedView.id] : undefined;
  if (suggestedCopy && suggestedView) {
    displayDescription = suggestedCopy.describe(suggestedView.count);
  }

  // Tranh theo ngữ cảnh: lọc rỗng → kính lúp; việc chưa xong đều trễ → đồng hồ báo thức; không có việc trễ hoặc mọi việc đã xong → nằm võng
  const illustration: IllustrationName = hasFilterActive
    ? "no-results"
    : suggestedCopy && suggestedView?.id === "overdue"
      ? "overdue"
      : taskTab === "overdue" || (suggestedCopy && suggestedView?.id === "done")
        ? "all-done"
        : "tasks";

  // Chưa có gì và được phép tạo việc: nút "Tạo việc" kèm thẻ hướng dẫn bước đầu (mỗi tài khoản thấy một lần).
  const pointsToCreate = isIntro && canAddTask && Boolean(onAddTask);

  return (
    <>
    {/* Bố cục trang trống kiểu Linear (EmptyState density="page"); tranh chọn theo ngữ cảnh ở `illustration` */}
    <EmptyState
      data-slot="workspace-empty-state"
      role="status"
      aria-live="polite"
      density="page"
      illustration={illustration}
      // Từ md: cao gần hết vùng nội dung (chừa thanh lọc và đệm dưới để trang không cuộn), pt-24 kéo khối xuống gần giữa vùng như Linear
      className={cn("min-h-[66vh] select-none md:min-h-[calc(100dvh-8.5rem)] md:pt-24", className)}
      title={displayTitle}
      description={
        <>
          {displayDescription}
          {filterNote ? <span className="block">{filterNote}</span> : null}
        </>
      }
      action={
        pointsToCreate ? (
          // Nút Tạo việc (chỉ chữ, không icon hay phím tắt) kèm thẻ hướng dẫn bước đầu cạnh nút tạo mới trên thanh công cụ; nút phụ Hướng dẫn mở lại thẻ
          <CreateButtonWithHint
            hintId="tasks"
            label="Tạo việc"
            onClick={onAddTask!}
            title="Tạo nhiệm vụ đầu tiên"
            description="Bấm Tạo việc để giao việc, chọn người chủ trì và hạn hoàn thành."
            guideButton
          />
        ) : suggestedCopy || (hasFilterActive && onResetFilters) ? (
          <>
            {suggestedCopy && suggestedView && (
              <Button size="pill" onClick={suggestedView.onSelect}>
                {suggestedCopy.action}
              </Button>
            )}

            {hasFilterActive && onResetFilters && (
              <Button size="pill" onClick={onResetFilters} title="Đặt lại bộ lọc">
                <RotateCcw data-icon="inline-start" />
                Xóa bộ lọc
              </Button>
            )}
          </>
        ) : null
      }
    />
    </>
  );
});
