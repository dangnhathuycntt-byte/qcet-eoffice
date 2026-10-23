"use client";

import * as React from "react";
import {
  X,
  RotateCcw,
  AlertTriangle,
  Inbox,
  Search,
} from "lucide-react";
import {
  FilterIconStatus,
  FilterIconPriority,
  FilterIconCategory,
  FilterIconDept,
  FilterIconLead,
  FilterIconCollaborator,
  FilterIconDeadline,
  FilterIconMonth,
  FilterIconProgress,
  FilterIconOrigin,
} from "@/components/dashboard/task-filter-icons";
import { cn } from "@/lib/utils";
import {
  getTaskTimeFilterLabel,
  type TaskTimeFilter,
} from "@/lib/task-time-filter";
import { Pressable } from "@/components/ui/pressable";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MotionDiv } from "@/components/motion/motion-list";

export interface ActiveFilterSummaryParams {
  dept?: string;
  workbox?: string;
  search?: string;
  scope?: string;
  status?: string;
  overdue?: boolean;
}

export function getWorkboxDisplayLabel(workbox: string): string {
  switch (workbox) {
    case "my_pending_approval":
      return "Chờ tôi duyệt";
    case "my_pending_submission":
      return "Chờ nộp báo cáo";
    case "my_tasks":
      return "Việc của tôi";
    case "waiting_approval":
      return "Chờ duyệt";
    case "pending_submission":
      return "Chờ nộp BC";
    case "review":
      return "Cần duyệt/nộp";
    case "overdue":
      return "Trễ hạn";
    case "today":
      return "Hôm nay";
    case "this_week":
      return "Tuần này";
    default:
      return workbox;
  }
}

export function getSingleStatusDisplayLabel(status: string): string {
  switch (status.toUpperCase()) {
    case "WAITING_APPROVAL":
    case "PENDING_EXECUTIVE_APPROVAL":
      return "Chờ duyệt";
    case "NEEDS_REVIEW":
      return "Cần chỉnh sửa";
    case "IN_PROGRESS":
      return "Đang thực hiện";
    case "COMPLETED":
      return "Hoàn thành";
    case "CANCELLED":
    case "CANCELED":
      return "Đã hủy";
    case "TODO":
    case "NOT_STARTED":
    case "ASSIGNED":
    case "NEW":
      return "Mới";
    case "OVERDUE":
      return "Trễ hạn";
    default:
      return status;
  }
}

export function getStatusDisplayLabel(status: string): string {
  if (status.includes(",")) {
    return status
      .split(",")
      .map((s) => getSingleStatusDisplayLabel(s.trim()))
      .filter(Boolean)
      .join(", ");
  }
  return getSingleStatusDisplayLabel(status);
}

function getDeadlineDisplayLabel(deadline: string): string {
  switch (deadline) {
    case "today":
      return "Đến hạn hôm nay";
    case "this_week":
      return "Trong tuần này";
    case "overdue":
      return "Trễ hạn";
    case "no_deadline":
      return "Chưa có thời hạn";
    default:
      return deadline;
  }
}

function getSinglePriorityDisplayLabel(priority: string): string {
  switch (priority.toUpperCase()) {
    case "URGENT":
      return "Khẩn cấp";
    case "HIGH":
      return "Ưu tiên cao";
    case "NORMAL":
      return "Bình thường";
    case "LOW":
      return "Thấp";
    case "NONE":
      return "Không ưu tiên";
    default:
      return priority;
  }
}

export function getPriorityDisplayLabel(priority: string): string {
  if (priority.includes(",")) {
    return priority
      .split(",")
      .map((p) => getSinglePriorityDisplayLabel(p.trim()))
      .filter(Boolean)
      .join(", ");
  }
  return getSinglePriorityDisplayLabel(priority);
}

function getSingleCategoryDisplayLabel(category: string): string {
  switch (category) {
    case "CHUYEN_DOI_SO": return "Chuyển đổi số";
    case "TRUYEN_THONG": return "Truyền thông";
    case "CNTT": return "Công nghệ thông tin";
    case "ATTT": return "An toàn thông tin";
    case "THU_VIEN": return "Thư viện & Học liệu";
    case "BAO_CAO": return "Báo cáo & Tổng hợp";
    case "KHAC": return "Khác";
    default: return category;
  }
}

export function getCategoryDisplayLabel(category: string): string {
  if (category.includes(",")) {
    return category
      .split(",")
      .map((c) => getSingleCategoryDisplayLabel(c.trim()))
      .filter(Boolean)
      .join(", ");
  }
  return getSingleCategoryDisplayLabel(category);
}

function getSingleHealthDisplayLabel(health: string): string {
  switch (health) {
    case "on_track": return "Đúng tiến độ";
    case "at_risk": return "Nguy cơ trễ";
    case "overdue": return "Trễ hạn";
    case "completed": return "Đạt 100%";
    default: return health;
  }
}

export function getHealthDisplayLabel(health: string): string {
  if (health.includes(",")) {
    return health
      .split(",")
      .map((h) => getSingleHealthDisplayLabel(h.trim()))
      .filter(Boolean)
      .join(", ");
  }
  return getSingleHealthDisplayLabel(health);
}

function getSingleOriginDisplayLabel(origin: string): string {
  switch (origin) {
    case "KE_HOACH_NAM": return "Kế hoạch năm";
    case "NGHI_QUYET": return "Nghị quyết BGH";
    case "GIAO_BAN": return "Giao ban";
    case "DON_VI": return "Đơn vị đề xuất";
    default: return origin;
  }
}

export function getOriginDisplayLabel(origin: string): string {
  if (origin.includes(",")) {
    return origin
      .split(",")
      .map((o) => getSingleOriginDisplayLabel(o.trim()))
      .filter(Boolean)
      .join(", ");
  }
  return getSingleOriginDisplayLabel(origin);
}

/**
 * Chip bộ lọc chia đoạn kiểu Linear: [icon + thuộc tính] | [giá trị] | [✕], viền mảnh nền trắng cao 24px (người dùng gửi ảnh
 * hàng lọc và yêu cầu cải thiện 21/10/2026: chip cũ nền mờ không viền trông như chữ trơn, nút ✕ chỉ 14px khó bấm).
 */
export interface FilterSegmentChipProps {
  icon?: React.ComponentType<any>;
  label: string;
  value: React.ReactNode;
  onRemove?: () => void;
  removeAriaLabel?: string;
  dataSlot?: string;
}

export function FilterSegmentChip({
  icon: Icon,
  label,
  value,
  onRemove,
  removeAriaLabel,
  dataSlot,
}: FilterSegmentChipProps) {
  return (
    <span
      data-slot={dataSlot}
      className="inline-flex h-6 min-w-0 max-w-full shrink-0 items-stretch divide-x divide-border rounded-sm border border-border bg-background text-xs text-foreground select-none"
    >
      <span className="flex shrink-0 items-center gap-1 whitespace-nowrap px-1.5 text-muted-foreground">
        {Icon && <Icon className="size-3.5 shrink-0" />}
        {label}
      </span>
      <FilterChipValue value={value} />
      {onRemove && (
        <Pressable
          data-filter-remove=""
          onClick={(event) => keepFocusInFilterBar(event.currentTarget, onRemove)}
          aria-label={removeAriaLabel || `Xóa lọc ${label}`}
          className="flex w-6 shrink-0 items-center justify-center rounded-r-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="size-3.5" />
        </Pressable>
      )}
    </span>
  );
}

/**
 * Bỏ chip (hoặc xóa hết) bằng bàn phím: nút đang giữ tiêu điểm biến mất nên tiêu điểm rơi về `body`. Chuyển sang nút ✕ của
 * chip kế bên; không còn chip nào (hàng lọc ẩn đi) thì về nút Bộ lọc của thanh công cụ gần nhất.
 */
function keepFocusInFilterBar(button: HTMLElement, action: () => void) {
  const hadFocus = document.activeElement === button;
  const bar = button.closest<HTMLElement>("[data-filter-bar]");
  const removes = bar ? Array.from(bar.querySelectorAll<HTMLElement>("[data-filter-remove]")) : [];
  const index = removes.indexOf(button);
  const sibling = index < 0 ? undefined : removes[index + 1] ?? removes[index - 1];
  // Tìm trước khi xóa: hàng lọc ẩn đi thì không đi ngược lên từ nó được nữa
  let scope: HTMLElement | null = bar;
  while (scope && !scope.querySelector("[data-list-filter-button]")) scope = scope.parentElement;
  const filterButton = scope?.querySelector<HTMLElement>("[data-list-filter-button]");
  action();
  if (!hadFocus) return;
  requestAnimationFrame(() => {
    if (sibling?.isConnected) sibling.focus();
    else filterButton?.focus();
  });
}

/** Giá trị bị cắt (tên người, nhiều trạng thái) thì rê chuột hiện đủ trong tooltip; không bị cắt thì không có tooltip. */
function FilterChipValue({ value }: { value: React.ReactNode }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [open, setOpen] = React.useState(false);
  return (
    <Tooltip
      open={open}
      onOpenChange={(next) => setOpen(next && Boolean(ref.current && ref.current.scrollWidth > ref.current.clientWidth + 1))}
    >
      <TooltipTrigger asChild>
        <span className="flex min-w-0 max-w-80 items-center px-1.5 font-medium">
          <span ref={ref} className="truncate">{value}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">{value}</TooltipContent>
    </Tooltip>
  );
}

export interface ActiveFilterBreadcrumbProps {
  /** Nằm trong hàng toolbar: một dòng, chip cuộn ngang */
  inline?: boolean;
  scope?: string;
  department?: string;
  workbox?: string;
  status?: string;
  search?: string;
  overdue?: boolean;
  timeFilter?: TaskTimeFilter;
  deadline?: string;
  priority?: string;
  category?: string;
  health?: string | null;
  /** Nhãn đã tra tên người (workspace tính từ token bộ lọc) */
  lead?: string | null;
  origin?: string | null;
  /** Nhãn đã tra tên người phối hợp */
  collaborator?: string | null;
  totalFilteredCount?: number;
  totalCount?: number;
  onResetFilters?: () => void;
  onClearAll?: () => void;
  onRemoveScope?: () => void;
  onRemoveDepartment?: () => void;
  onRemoveWorkbox?: () => void;
  onRemoveStatus?: () => void;
  onRemoveSearch?: () => void;
  onRemoveOverdue?: () => void;
  onRemoveTimeFilter?: () => void;
  onRemoveDeadline?: () => void;
  onRemovePriority?: () => void;
  onRemoveCategory?: () => void;
  onRemoveHealth?: () => void;
  onRemoveLead?: () => void;
  onRemoveOrigin?: () => void;
  onRemoveCollaborator?: () => void;
  onRemoveFilter?: (filterType: string) => void;
  className?: string;
}

/** Giá trị bộ lọc quyết định chip nào hiện ở hàng bộ lọc. */
export type ActiveFilterValues = Pick<
  ActiveFilterBreadcrumbProps,
  "department" | "workbox" | "status" | "search" | "overdue" | "timeFilter" | "deadline" | "priority" | "category" | "health" | "lead" | "origin" | "collaborator"
>;

function getActiveFilterFlags({ department, workbox, status, search, overdue, timeFilter, deadline, priority, category, health, lead, origin, collaborator }: ActiveFilterValues) {
  const hasDeadlineOverdue = deadline === "overdue";
  return {
    hasDept: Boolean(department && department !== "ALL"),
    // Thời hạn "Trễ hạn" cũng ghi attention=overdue nên Hộp việc tự thành "overdue": chỉ hiện một chip (Thời hạn)
    hasWorkbox: Boolean(workbox && workbox !== "ALL" && !(workbox === "overdue" && hasDeadlineOverdue)),
    hasOverdue: Boolean(overdue && workbox !== "overdue" && !hasDeadlineOverdue),
    hasSearch: Boolean(search && search.trim().length > 0),
    hasStatus: Boolean(status && status !== "ALL" && status !== "all"),
    hasTimeFilter: Boolean(timeFilter && timeFilter.kind !== "none"),
    hasDeadline: Boolean(deadline && deadline !== "all" && deadline !== "ALL"),
    hasPriority: Boolean(priority && priority !== "ALL"),
    hasCategory: Boolean(category && category !== "ALL"),
    hasHealth: Boolean(health && health !== "all"),
    hasLead: Boolean(lead && lead !== "all"),
    hasOrigin: Boolean(origin && origin !== "all"),
    hasCollaborator: Boolean(collaborator && collaborator !== "all"),
  };
}

/** Số chip hàng bộ lọc sẽ hiện, cùng điều kiện với `ActiveFilterBreadcrumb` (khung trống dùng để nói đúng số bộ lọc). */
export function countActiveFilters(values: ActiveFilterValues): number {
  return Object.values(getActiveFilterFlags(values)).filter(Boolean).length;
}

export function ActiveFilterBreadcrumb({
  scope,
  department,
  workbox,
  status,
  search,
  overdue,
  timeFilter,
  deadline,
  priority,
  category,
  health,
  lead,
  origin,
  collaborator,
  totalFilteredCount,
  totalCount,
  onResetFilters,
  onClearAll,
  onRemoveScope,
  onRemoveDepartment,
  onRemoveWorkbox,
  onRemoveStatus,
  onRemoveSearch,
  onRemoveOverdue,
  onRemoveTimeFilter,
  onRemoveDeadline,
  onRemovePriority,
  onRemoveCategory,
  onRemoveHealth,
  onRemoveLead,
  onRemoveOrigin,
  onRemoveCollaborator,
  onRemoveFilter,
  inline,
  className = "",
}: ActiveFilterBreadcrumbProps) {
  const {
    hasDept, hasWorkbox, hasOverdue, hasSearch, hasStatus, hasTimeFilter, hasDeadline, hasPriority, hasCategory, hasHealth,
    hasLead, hasOrigin, hasCollaborator,
  } = getActiveFilterFlags({ department, workbox, status, search, overdue, timeFilter, deadline, priority, category, health, lead, origin, collaborator });
  const hasAnySecondaryFilter =
    hasDept || hasWorkbox || hasSearch || hasStatus || hasOverdue || hasTimeFilter || hasDeadline || hasPriority ||
    hasCategory || hasHealth || hasLead || hasOrigin || hasCollaborator;

  if (!hasAnySecondaryFilter) {
    return null;
  }

  const handleClearAll = () => {
    if (onResetFilters) onResetFilters();
    else if (onClearAll) onClearAll();
  };

  const handleRemove = (
    specific?: () => void,
    fallbackType?: string
  ) => {
    if (specific) specific();
    else if (onRemoveFilter && fallbackType) onRemoveFilter(fallbackType);
  };

  return (
    <ActiveFilterBar
      dataSlot="active-filter-breadcrumb"
      inline={inline}
      className={className}
      onClearAll={onResetFilters || onClearAll ? handleClearAll : undefined}
      filteredCount={totalFilteredCount}
      totalCount={totalCount}
    >
        {hasStatus && (
          <FilterSegmentChip
            dataSlot="filter-chip-status"
            icon={FilterIconStatus}
            label="Trạng thái"
            value={getStatusDisplayLabel(status!)}
            onRemove={(onRemoveStatus || onRemoveFilter) ? () => handleRemove(onRemoveStatus, "status") : undefined}
            removeAriaLabel={`Xóa lọc Trạng thái: ${status}`}
          />
        )}

        {hasDept && (
          <FilterSegmentChip
            dataSlot="filter-chip-department"
            icon={FilterIconDept}
            label="Đơn vị"
            value={department}
            onRemove={(onRemoveDepartment || onRemoveFilter) ? () => handleRemove(onRemoveDepartment, "department") : undefined}
            removeAriaLabel={`Xóa lọc Đơn vị: ${department}`}
          />
        )}

        {hasOverdue && (
          <FilterSegmentChip
            dataSlot="filter-chip-overdue"
            icon={AlertTriangle}
            label="Trạng thái"
            value="Trễ hạn"
            onRemove={(onRemoveOverdue || onRemoveFilter) ? () => handleRemove(onRemoveOverdue, "overdue") : undefined}
            removeAriaLabel="Xóa lọc Trễ hạn"
          />
        )}

        {hasWorkbox && (
          <FilterSegmentChip
            dataSlot="filter-chip-workbox"
            icon={Inbox}
            label="Hộp việc"
            value={getWorkboxDisplayLabel(workbox!)}
            onRemove={(onRemoveWorkbox || onRemoveFilter) ? () => handleRemove(onRemoveWorkbox, "workbox") : undefined}
            removeAriaLabel={`Xóa lọc Hộp việc: ${getWorkboxDisplayLabel(workbox!)}`}
          />
        )}

        {hasTimeFilter && (
          <FilterSegmentChip
            dataSlot="filter-chip-time"
            icon={FilterIconMonth}
            label="Thời gian"
            value={getTaskTimeFilterLabel(timeFilter!)}
            onRemove={(onRemoveTimeFilter || onRemoveFilter) ? () => handleRemove(onRemoveTimeFilter, "time") : undefined}
            removeAriaLabel="Xóa lọc thời gian"
          />
        )}

        {hasDeadline && (
          <FilterSegmentChip
            dataSlot="filter-chip-deadline"
            icon={FilterIconDeadline}
            label="Thời hạn"
            value={getDeadlineDisplayLabel(deadline!)}
            onRemove={(onRemoveDeadline || onRemoveFilter) ? () => handleRemove(onRemoveDeadline, "deadline") : undefined}
            removeAriaLabel={`Xóa lọc thời hạn: ${deadline}`}
          />
        )}

        {hasPriority && (
          <FilterSegmentChip
            dataSlot="filter-chip-priority"
            icon={FilterIconPriority}
            label="Ưu tiên"
            value={getPriorityDisplayLabel(priority!)}
            onRemove={(onRemovePriority || onRemoveFilter) ? () => handleRemove(onRemovePriority, "priority") : undefined}
            removeAriaLabel={`Xóa lọc ưu tiên: ${priority}`}
          />
        )}

        {hasCategory && (
          <FilterSegmentChip
            dataSlot="filter-chip-category"
            icon={FilterIconCategory}
            label="Danh mục"
            value={getCategoryDisplayLabel(category!)}
            onRemove={(onRemoveCategory || onRemoveFilter) ? () => handleRemove(onRemoveCategory, "category") : undefined}
            removeAriaLabel={`Xóa lọc danh mục: ${category}`}
          />
        )}

        {hasHealth && (
          <FilterSegmentChip
            dataSlot="filter-chip-health"
            icon={FilterIconProgress}
            label="Tiến độ"
            value={getHealthDisplayLabel(health!)}
            onRemove={(onRemoveHealth || onRemoveFilter) ? () => handleRemove(onRemoveHealth, "health") : undefined}
            removeAriaLabel={`Xóa lọc tiến độ: ${health}`}
          />
        )}

        {hasLead && (
          <FilterSegmentChip
            dataSlot="filter-chip-lead"
            icon={FilterIconLead}
            label="Chủ trì"
            value={lead!}
            onRemove={(onRemoveLead || onRemoveFilter) ? () => handleRemove(onRemoveLead, "lead") : undefined}
            removeAriaLabel={`Xóa lọc người chủ trì: ${lead}`}
          />
        )}

        {hasOrigin && (
          <FilterSegmentChip
            dataSlot="filter-chip-origin"
            icon={FilterIconOrigin}
            label="Nguồn gốc"
            value={getOriginDisplayLabel(origin!)}
            onRemove={(onRemoveOrigin || onRemoveFilter) ? () => handleRemove(onRemoveOrigin, "origin") : undefined}
            removeAriaLabel={`Xóa lọc nguồn gốc: ${origin}`}
          />
        )}

        {hasCollaborator && (
          <FilterSegmentChip
            dataSlot="filter-chip-collaborator"
            icon={FilterIconCollaborator}
            label="Phối hợp"
            value={collaborator!}
            onRemove={(onRemoveCollaborator || onRemoveFilter) ? () => handleRemove(onRemoveCollaborator, "collaborator") : undefined}
            removeAriaLabel={`Xóa lọc phối hợp: ${collaborator}`}
          />
        )}

        {hasSearch && (
          <FilterSegmentChip
            dataSlot="filter-chip-search"
            icon={Search}
            label="Từ khóa"
            value={`"${search!.trim()}"`}
            onRemove={(onRemoveSearch || onRemoveFilter) ? () => handleRemove(onRemoveSearch, "search") : undefined}
            removeAriaLabel={`Xóa lọc từ khóa "${search!.trim()}"`}
          />
        )}
    </ActiveFilterBar>
  );
}

export interface ActiveFilterBarProps {
  /** Các `FilterSegmentChip` đang áp dụng. */
  children: React.ReactNode;
  onClearAll?: () => void;
  /** Số kết quả sau lọc; `totalCount` (nếu biết) hiện dạng "x/y kết quả". */
  filteredCount?: number;
  totalCount?: number;
  /** Nằm trong hàng toolbar: một dòng, chip cuộn ngang thay vì xuống dòng */
  inline?: boolean;
  className?: string;
  dataSlot?: string;
}

/**
 * Hàng bộ lọc đang áp dụng dưới thanh công cụ danh sách: chip bên trái, "Xóa lọc" và số kết quả bên phải.
 * Dùng chung Nhiệm vụ, Văn bản, Cuộc họp, Cơ cấu tổ chức. Số kết quả đọc lên cho trình đọc màn hình mỗi khi đổi bộ lọc.
 */
export function ActiveFilterBar({ children, onClearAll, filteredCount, totalCount, inline, className, dataSlot = "active-filter-bar" }: ActiveFilterBarProps) {
  return (
    <div
      data-slot={dataSlot}
      data-filter-bar=""
      className={cn(
        "enter-fade",
        inline
          ? "flex min-w-0 flex-1 flex-nowrap items-center justify-between gap-2 text-xs"
          : "flex min-h-8 flex-wrap items-center gap-1.5 text-xs",
        className
      )}
    >
      {/* Hàng thường: chip và cụm bên phải cùng xuống dòng như chữ, chip không bị cắt (390px trước đây cắt "Chờ duy…"),
          cụm "Xóa lọc" đứng cạnh chip cuối khi còn chỗ */}
      <MotionDiv className={inline ? "flex min-w-0 flex-1 flex-nowrap items-center gap-1.5 overflow-x-auto thin-scrollbar" : "contents"}>{children}</MotionDiv>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {onClearAll && (
          <Button
            data-slot="clear-all-filters"
            variant="ghost"
            size="xs"
            onClick={(event) => keepFocusInFilterBar(event.currentTarget, onClearAll)}
            aria-label="Xóa tất cả bộ lọc"
            className="text-muted-foreground"
          >
            <RotateCcw />
            Xóa lọc
          </Button>
        )}

        {filteredCount !== undefined && (
          <span role="status" aria-live="polite" className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {totalCount !== undefined ? `${filteredCount}/${totalCount}` : filteredCount} kết quả
          </span>
        )}
      </div>
    </div>
  );
}
