"use client";

import * as React from "react";
import { Filter, X, RotateCcw } from "lucide-react";
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
    default:
      return workbox;
  }
}

export function getStatusDisplayLabel(status: string): string {
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

function getPriorityDisplayLabel(priority: string): string {
  switch (priority) {
    case "URGENT":
      return "Khẩn cấp";
    case "HIGH":
      return "Ưu tiên cao";
    case "NORMAL":
      return "Bình thường";
    default:
      return priority;
  }
}

function getCategoryDisplayLabel(category: string): string {
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

function getHealthDisplayLabel(health: string): string {
  switch (health) {
    case "on_track": return "Đúng tiến độ";
    case "at_risk": return "Nguy cơ trễ";
    case "overdue": return "Trễ hạn";
    case "completed": return "Đạt 100%";
    default: return health;
  }
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

function getOriginDisplayLabel(origin: string): string {
  switch (origin) {
    case "KE_HOACH_NAM": return "Kế hoạch năm";
    case "NGHI_QUYET": return "Nghị quyết BGH";
    case "GIAO_BAN": return "Giao ban";
    case "DON_VI": return "Đơn vị đề xuất";
    default: return origin;
  }
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

// ─── Chip styling per filter type ─────────────────────────���──
const chipStyles = {
  base: "inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md text-xs font-medium transition-colors bg-muted/60 text-foreground/80 border border-border/60",
  dismiss: "size-4 flex items-center justify-center rounded-sm hover:bg-black/8 cursor-pointer transition-colors ml-0.5",
} as const;

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
  const hasOverdue = Boolean(overdue);
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
    return <div data-slot="active-filter-breadcrumb" className={cn("h-0", className)} />;
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
        "flex flex-wrap items-center gap-1.5 py-1.5 text-xs",
        className
      )}
    >
      {/* Label */}
      <div className="flex items-center gap-1 text-muted-foreground shrink-0 mr-0.5">
        <Filter className="size-3 text-muted-foreground/70" strokeWidth={1.5} />
        <span className="text-[11px] font-medium">Đang lọc:</span>
      </div>

      {/* Chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {hasStatus && (
          <span data-slot="filter-chip" className={chipStyles.base}>
            <span>Trạng thái: <strong className="font-semibold">{getStatusDisplayLabel(status!)}</strong></span>
            {(onRemoveStatus || onRemoveFilter) && (
              <button type="button" onClick={() => handleRemove(onRemoveStatus, "status")}
                aria-label={`Xóa lọc Trạng thái: ${status}`} className={chipStyles.dismiss}>
                <X className="size-2.5" strokeWidth={1.5} />
              </button>
            )}
          </span>
        )}

        {hasDept && (
          <span data-slot="filter-chip" className={chipStyles.base}>
            <span>Đơn vị: <strong className="font-semibold">{department}</strong></span>
            {(onRemoveDepartment || onRemoveFilter) && (
              <button type="button" onClick={() => handleRemove(onRemoveDepartment, "department")}
                aria-label={`Xóa lọc Đơn vị: ${department}`} className={chipStyles.dismiss}>
                <X className="size-2.5" strokeWidth={1.5} />
              </button>
            )}
          </span>
        )}

        {hasOverdue && (
          <span data-slot="filter-chip" className={chipStyles.base}>
            <span>Quá hạn</span>
            {(onRemoveOverdue || onRemoveFilter) && (
              <button type="button" onClick={() => handleRemove(onRemoveOverdue, "overdue")}
                aria-label="Xóa lọc Quá hạn" className={chipStyles.dismiss}>
                <X className="size-2.5" strokeWidth={1.5} />
              </button>
            )}
          </span>
        )}

        {hasWorkbox && (
          <span data-slot="filter-chip" className={chipStyles.base}>
            <span>Hộp việc: <strong className="font-semibold">{getWorkboxDisplayLabel(workbox!)}</strong></span>
            {(onRemoveWorkbox || onRemoveFilter) && (
              <button type="button" onClick={() => handleRemove(onRemoveWorkbox, "workbox")}
                aria-label={`Xóa lọc Hộp việc: ${getWorkboxDisplayLabel(workbox!)}`} className={chipStyles.dismiss}>
                <X className="size-2.5" strokeWidth={1.5} />
              </button>
            )}
          </span>
        )}

        {hasTimeFilter && (
          <span data-slot="filter-chip" className={chipStyles.base}>
            <span>Thời gian: <strong className="font-semibold">{getTaskTimeFilterLabel(timeFilter!)}</strong></span>
            {(onRemoveTimeFilter || onRemoveFilter) && (
              <button type="button" onClick={() => handleRemove(onRemoveTimeFilter, "time")}
                aria-label="Xóa lọc thời gian" className={chipStyles.dismiss}>
                <X className="size-2.5" strokeWidth={1.5} />
              </button>
            )}
          </span>
        )}

        {hasDeadline && (
          <span data-slot="filter-chip" className={chipStyles.base}>
            <span>Thời hạn: <strong className="font-semibold">{getDeadlineDisplayLabel(deadline!)}</strong></span>
            {(onRemoveDeadline || onRemoveFilter) && (
              <button type="button" onClick={() => handleRemove(onRemoveDeadline, "deadline")}
                aria-label={`Xóa lọc thời hạn: ${deadline}`} className={chipStyles.dismiss}>
                <X className="size-2.5" strokeWidth={1.5} />
              </button>
            )}
          </span>
        )}

        {hasPriority && (
          <span data-slot="filter-chip" className={chipStyles.base}>
            <span>Ưu tiên: <strong className="font-semibold">{getPriorityDisplayLabel(priority!)}</strong></span>
            {(onRemovePriority || onRemoveFilter) && (
              <button type="button" onClick={() => handleRemove(onRemovePriority, "priority")}
                aria-label={`Xóa lọc ưu tiên: ${priority}`} className={chipStyles.dismiss}>
                <X className="size-2.5" strokeWidth={1.5} />
              </button>
            )}
          </span>
        )}

        {hasCategory && (
          <span data-slot="filter-chip" className={chipStyles.base}>
            <span>Danh mục: <strong className="font-semibold">{getCategoryDisplayLabel(category!)}</strong></span>
            {(onRemoveCategory || onRemoveFilter) && (
              <button type="button" onClick={() => handleRemove(onRemoveCategory, "category")}
                aria-label={`Xóa lọc danh mục: ${category}`} className={chipStyles.dismiss}>
                <X className="size-2.5" strokeWidth={1.5} />
              </button>
            )}
          </span>
        )}

        {hasHealth && (
          <span data-slot="filter-chip" className={chipStyles.base}>
            <span>Tiến độ: <strong className="font-semibold">{getHealthDisplayLabel(health!)}</strong></span>
            {(onRemoveHealth || onRemoveFilter) && (
              <button type="button" onClick={() => handleRemove(onRemoveHealth, "health")}
                aria-label={`Xóa lọc tiến độ: ${health}`} className={chipStyles.dismiss}>
                <X className="size-2.5" strokeWidth={1.5} />
              </button>
            )}
          </span>
        )}

        {hasLead && (
          <span data-slot="filter-chip" className={chipStyles.base}>
            <span>Chủ trì: <strong className="font-semibold">{getLeadDisplayLabel(lead!)}</strong></span>
            {(onRemoveLead || onRemoveFilter) && (
              <button type="button" onClick={() => handleRemove(onRemoveLead, "lead")}
                aria-label={`Xóa lọc người chủ trì: ${lead}`} className={chipStyles.dismiss}>
                <X className="size-2.5" strokeWidth={1.5} />
              </button>
            )}
          </span>
        )}

        {hasOrigin && (
          <span data-slot="filter-chip" className={chipStyles.base}>
            <span>Nguồn gốc: <strong className="font-semibold">{getOriginDisplayLabel(origin!)}</strong></span>
            {(onRemoveOrigin || onRemoveFilter) && (
              <button type="button" onClick={() => handleRemove(onRemoveOrigin, "origin")}
                aria-label={`Xóa lọc nguồn gốc: ${origin}`} className={chipStyles.dismiss}>
                <X className="size-2.5" strokeWidth={1.5} />
              </button>
            )}
          </span>
        )}

        {hasCollaborator && (
          <span data-slot="filter-chip" className={chipStyles.base}>
            <span>Phối hợp: <strong className="font-semibold">{getCollaboratorDisplayLabel(collaborator!)}</strong></span>
            {(onRemoveCollaborator || onRemoveFilter) && (
              <button type="button" onClick={() => handleRemove(onRemoveCollaborator, "collaborator")}
                aria-label={`Xóa lọc phối hợp: ${collaborator}`} className={chipStyles.dismiss}>
                <X className="size-2.5" strokeWidth={1.5} />
              </button>
            )}
          </span>
        )}

        {hasSearch && (
          <span data-slot="filter-chip" className={chipStyles.base}>
            <span>Từ khóa: <strong className="font-semibold">&quot;{search!.trim()}&quot;</strong></span>
            {(onRemoveSearch || onRemoveFilter) && (
              <button type="button" onClick={() => handleRemove(onRemoveSearch, "search")}
                aria-label={`Xóa lọc từ khóa "${search!.trim()}"`} className={chipStyles.dismiss}>
                <X className="size-2.5" strokeWidth={1.5} />
              </button>
            )}
          </span>
        )}

        {/* Clear all */}
        {(onResetFilters || onClearAll) && (
          <button
            type="button"
            data-slot="clear-all-filters"
            onClick={handleClearAll}
            aria-label="Xóa tất cả bộ lọc"
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors ml-0.5 cursor-pointer rounded px-1 py-0.5 hover:bg-muted"
          >
            <RotateCcw className="size-3" strokeWidth={1.5} />
            <span>Xóa lọc</span>
          </button>
        )}
      </div>

      {/* Result count — pushed right */}
      {totalFilteredCount !== undefined && (
        <span className="text-muted-foreground text-[11px] font-mono tabular-nums ml-auto shrink-0">
          {totalFilteredCount} kết quả{totalCount !== undefined ? ` / ${totalCount}` : ""}
        </span>
      )}
    </div>
  );
}
