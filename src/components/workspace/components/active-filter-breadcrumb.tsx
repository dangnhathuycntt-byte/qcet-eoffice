"use client";

import * as React from "react";
import {
  X,
  RotateCcw,
  Clock,
  AlertTriangle,
  Inbox,
  Calendar,
  Tag,
  Building2,
  User,
  Users,
  FileText,
  Search,
  Activity,
  Flag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getTaskTimeFilterLabel,
  NO_TASK_TIME_FILTER,
  type TaskTimeFilter,
} from "@/lib/task-time-filter";

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
      return "Quá hạn";
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
      return "Quá hạn";
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
      return "Quá hạn";
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

function getLeadDisplayLabel(lead: string): string {
  switch (lead) {
    case "my": return "Tôi chủ trì";
    case "bgh": return "Lãnh đạo BGH";
    case "assigned": return "Đã phân công";
    case "unassigned": return "Chưa phân công";
    default: return lead;
  }
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

function getCollaboratorDisplayLabel(collaborator: string): string {
  switch (collaborator) {
    case "has_collab": return "Có phối hợp";
    case "single": return "Tự thực hiện";
    default: return collaborator;
  }
}

export function getActiveFilterSummary(params: ActiveFilterSummaryParams): string[] {
  const parts: string[] = [];
  if (params.dept && params.dept !== "ALL") {
    parts.push(`Đơn vị: ${params.dept}`);
  }
  if (params.workbox && params.workbox !== "ALL") {
    parts.push(`Hộp việc: ${getWorkboxDisplayLabel(params.workbox)}`);
  }
  if (params.search && params.search.trim()) {
    parts.push(`Từ khóa: "${params.search.trim()}"`);
  }
  if (params.status && params.status !== "ALL") {
    parts.push(`Trạng thái: ${params.status}`);
  }
  if (params.overdue) {
    parts.push("Quá hạn");
  }
  if (params.scope && params.scope !== "ALL") {
    const scopeLabel =
      params.scope === "school"
        ? "Toàn trường"
        : params.scope === "unit"
        ? "Đơn vị"
        : params.scope === "my"
        ? "Việc của tôi"
        : params.scope;
    parts.push(`Phạm vi: ${scopeLabel}`);
  }
  return parts;
}

/** Linear-style segmented filter chip (Property | Value | ✕) */
interface FilterSegmentChipProps {
  icon?: React.ComponentType<any>;
  label: string;
  value: React.ReactNode;
  onRemove?: () => void;
  removeAriaLabel?: string;
  dataSlot?: string;
}

function FilterSegmentChip({
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
      className="inline-flex items-center h-[26px] rounded-[6px] border border-border/75 bg-background text-xs shadow-2xs overflow-hidden divide-x divide-border/60 transition-colors select-none"
    >
      {/* Property Tag with Icon */}
      <span className="flex items-center gap-1.5 px-2 py-0.5 text-muted-foreground/80 font-normal bg-muted/30">
        {Icon && <Icon className="size-3 text-muted-foreground/75 shrink-0" strokeWidth={1.5} />}
        <span className="text-[11px] whitespace-nowrap">{label}</span>
      </span>

      {/* Filter Value */}
      <span className="px-2 py-0.5 font-medium text-foreground text-[11.5px] truncate max-w-[200px]">
        {value}
      </span>

      {/* Remove Button */}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeAriaLabel || `Xóa lọc ${label}`}
          className="px-1.5 h-full flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer"
        >
          <X className="size-2.5" strokeWidth={1.5} />
        </button>
      )}
    </span>
  );
}

export interface ActiveFilterBreadcrumbProps {
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
  lead?: string | null;
  origin?: string | null;
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
  className = "",
}: ActiveFilterBreadcrumbProps) {
  const hasDept = Boolean(department && department !== "ALL");
  const hasWorkbox = Boolean(workbox && workbox !== "ALL");
  const hasSearch = Boolean(search && search.trim().length > 0);
  const hasStatus = Boolean(status && status !== "ALL" && status !== "all");
  const hasOverdue = Boolean(overdue && workbox !== "overdue");
  const hasTimeFilter = Boolean(timeFilter && timeFilter.kind !== "none");
  const hasDeadline = Boolean(deadline && deadline !== "all" && deadline !== "ALL");
  const hasPriority = Boolean(priority && priority !== "ALL");
  const hasCategory = Boolean(category && category !== "ALL");
  const hasHealth = Boolean(health && health !== "all");
  const hasLead = Boolean(lead && lead !== "all");
  const hasOrigin = Boolean(origin && origin !== "all");
  const hasCollaborator = Boolean(collaborator && collaborator !== "all");

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
    <div
      data-slot="active-filter-breadcrumb"
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 py-1 text-xs min-h-[30px]",
        className
      )}
    >
      {/* Active Filter Chips (Linear segmented compounds) */}
      <div className="flex flex-wrap items-center gap-1.5 min-w-0 flex-1">
        {hasStatus && (
          <FilterSegmentChip
            dataSlot="filter-chip-status"
            icon={Activity}
            label="Trạng thái"
            value={getStatusDisplayLabel(status!)}
            onRemove={(onRemoveStatus || onRemoveFilter) ? () => handleRemove(onRemoveStatus, "status") : undefined}
            removeAriaLabel={`Xóa lọc Trạng thái: ${status}`}
          />
        )}

        {hasDept && (
          <FilterSegmentChip
            dataSlot="filter-chip-department"
            icon={Building2}
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
            value="Quá hạn"
            onRemove={(onRemoveOverdue || onRemoveFilter) ? () => handleRemove(onRemoveOverdue, "overdue") : undefined}
            removeAriaLabel="Xóa lọc Quá hạn"
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
            icon={Calendar}
            label="Thời gian"
            value={getTaskTimeFilterLabel(timeFilter!)}
            onRemove={(onRemoveTimeFilter || onRemoveFilter) ? () => handleRemove(onRemoveTimeFilter, "time") : undefined}
            removeAriaLabel="Xóa lọc thời gian"
          />
        )}

        {hasDeadline && (
          <FilterSegmentChip
            dataSlot="filter-chip-deadline"
            icon={Clock}
            label="Thời hạn"
            value={getDeadlineDisplayLabel(deadline!)}
            onRemove={(onRemoveDeadline || onRemoveFilter) ? () => handleRemove(onRemoveDeadline, "deadline") : undefined}
            removeAriaLabel={`Xóa lọc thời hạn: ${deadline}`}
          />
        )}

        {hasPriority && (
          <FilterSegmentChip
            dataSlot="filter-chip-priority"
            icon={Flag}
            label="Ưu tiên"
            value={getPriorityDisplayLabel(priority!)}
            onRemove={(onRemovePriority || onRemoveFilter) ? () => handleRemove(onRemovePriority, "priority") : undefined}
            removeAriaLabel={`Xóa lọc ưu tiên: ${priority}`}
          />
        )}

        {hasCategory && (
          <FilterSegmentChip
            dataSlot="filter-chip-category"
            icon={Tag}
            label="Danh mục"
            value={getCategoryDisplayLabel(category!)}
            onRemove={(onRemoveCategory || onRemoveFilter) ? () => handleRemove(onRemoveCategory, "category") : undefined}
            removeAriaLabel={`Xóa lọc danh mục: ${category}`}
          />
        )}

        {hasHealth && (
          <FilterSegmentChip
            dataSlot="filter-chip-health"
            icon={Activity}
            label="Tiến độ"
            value={getHealthDisplayLabel(health!)}
            onRemove={(onRemoveHealth || onRemoveFilter) ? () => handleRemove(onRemoveHealth, "health") : undefined}
            removeAriaLabel={`Xóa lọc tiến độ: ${health}`}
          />
        )}

        {hasLead && (
          <FilterSegmentChip
            dataSlot="filter-chip-lead"
            icon={User}
            label="Chủ trì"
            value={getLeadDisplayLabel(lead!)}
            onRemove={(onRemoveLead || onRemoveFilter) ? () => handleRemove(onRemoveLead, "lead") : undefined}
            removeAriaLabel={`Xóa lọc người chủ trì: ${lead}`}
          />
        )}

        {hasOrigin && (
          <FilterSegmentChip
            dataSlot="filter-chip-origin"
            icon={FileText}
            label="Nguồn gốc"
            value={getOriginDisplayLabel(origin!)}
            onRemove={(onRemoveOrigin || onRemoveFilter) ? () => handleRemove(onRemoveOrigin, "origin") : undefined}
            removeAriaLabel={`Xóa lọc nguồn gốc: ${origin}`}
          />
        )}

        {hasCollaborator && (
          <FilterSegmentChip
            dataSlot="filter-chip-collaborator"
            icon={Users}
            label="Phối hợp"
            value={getCollaboratorDisplayLabel(collaborator!)}
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
      </div>

      {/* Right Controls: Xóa lọc + Kết quả đ��m */}
      <div className="flex items-center gap-2 shrink-0 ml-auto">
        {(onResetFilters || onClearAll) && (
          <button
            type="button"
            data-slot="clear-all-filters"
            onClick={handleClearAll}
            aria-label="Xóa tất cả bộ lọc"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer rounded px-2 py-1 hover:bg-background/80 hover:shadow-2xs border border-transparent hover:border-border/50"
          >
            <RotateCcw className="size-3" strokeWidth={1.5} />
            <span>Xóa lọc</span>
          </button>
        )}

        {totalFilteredCount !== undefined && (
          <span className="text-muted-foreground text-[11px] font-mono tabular-nums px-2 py-0.5 bg-background rounded border border-border/50 shrink-0 shadow-2xs">
            {totalFilteredCount} kết quả{totalCount !== undefined ? ` / ${totalCount}` : ""}
          </span>
        )}
      </div>
    </div>
  );
}
