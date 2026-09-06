"use client";

import * as React from "react";
import {
  List,
  Kanban,
  Calendar,
  Search,
  X,
  Plus,
  Building2,
  Filter,
  ShieldAlert,
} from "lucide-react";
import type { SchoolTask, TaskCategory } from "@/types/dashboard";
import { type AuthUser, matchesUser, filterTasksByRole } from "@/lib/role-task-filter";
import { filterTasksForTable } from "@/components/dashboard/cascading-task-table";
import { getAcademicMonthsForYear, type AcademicMonthPeriod } from "@/lib/academic-calendar";
import { cn } from "@/lib/utils";

// ============================================================================
// 1. Interfaces & Types
// ============================================================================

export type TaskScope = "MY_TASKS" | "SCHOOL_TASKS" | "UNIT_TASKS";
export type TaskViewMode = "table" | "kanban" | "calendar" | "department" | "executive";

export interface ScopeTab {
  id: TaskScope;
  label: string;
}

export interface ViewModeOption {
  id: TaskViewMode;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
}

export interface UnifiedTaskToolbarProps {
  scope: TaskScope;
  onScopeChange: (scope: TaskScope) => void;
  viewMode: TaskViewMode;
  onViewModeChange: (mode: TaskViewMode) => void;
  selectedDepartment: string; // "ALL" or department code
  onDepartmentChange: (dept: string) => void;
  availableDepartments?: { code: string; name: string }[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: string; // "ALL" or TaskCategory
  onCategoryChange: (cat: string) => void;
  selectedPriority: string; // "ALL" | "URGENT" | "HIGH" | "NORMAL"
  onPriorityChange: (prio: string) => void;
  onNewTaskClick: () => void;
  canCreateTask?: boolean;
  totalTasksCount?: number;
  isExecutive?: boolean;
  userRole?: string;
  selectedAcademicMonth?: number | "ALL"; // 1-12 or "ALL"
  onAcademicMonthChange?: (month: number | "ALL") => void;
  academicYear?: string; // default "2026-2027"
  monthlyTaskCounts?: Record<number, number>;
}

// ============================================================================
// 2. Constants & Metadata
// ============================================================================

export const SCOPE_TABS: ScopeTab[] = [
  { id: "MY_TASKS", label: "Việc của tôi" },
  { id: "SCHOOL_TASKS", label: "Nhiệm vụ cấp Trường" },
  { id: "UNIT_TASKS", label: "Công việc Đơn vị" },
];

export const VIEW_MODE_OPTIONS: ViewModeOption[] = [
  { id: "table", label: "Bảng", icon: List },
  { id: "kanban", label: "Kanban", icon: Kanban },
  { id: "calendar", label: "Lịch", icon: Calendar },
  { id: "department", label: "Theo đơn vị", icon: Building2 },
  { id: "executive", label: "Chỉ huy BGH", icon: ShieldAlert },
];

export const DEFAULT_AVAILABLE_DEPARTMENTS: { code: string; name: string }[] = [
  { code: "ALL", name: "Tất cả đơn vị" },
  { code: "BGH", name: "Ban Giám hiệu" },
  { code: "CNTT", name: "Khoa Công nghệ thông tin" },
  { code: "DAO_TAO", name: "Phòng Đào tạo & QLKH" },
  { code: "TRUYEN_THONG", name: "Trung tâm Truyền thông & Số hóa (DCC)" },
  { code: "HANH_CHINH", name: "Phòng Hành chính - Quản trị" },
  { code: "KHAO_THI", name: "Phòng Khảo thí & ĐBCL" },
  { code: "THU_VIEN", name: "Trung tâm Ngoại ngữ - Tin học & Thư viện" },
  { code: "KINH_TE", name: "Khoa Kinh tế - Quản trị" },
  { code: "KY_THUAT", name: "Khoa Kỹ thuật - Công nghệ" },
  { code: "TAI_CHINH", name: "Phòng Kế hoạch - Tài chính" },
  { code: "CTHSSV", name: "Phòng Công tác học sinh sinh viên" },
];

export const CATEGORY_FILTER_OPTIONS: { id: string; label: string }[] = [
  { id: "ALL", label: "Tất cả danh mục" },
  { id: "CHUYEN_DOI_SO", label: "Chuyển đổi số" },
  { id: "TRUYEN_THONG", label: "Truyền thông" },
  { id: "CNTT", label: "Công nghệ thông tin" },
  { id: "ATTT", label: "An toàn thông tin" },
  { id: "THU_VIEN", label: "Thư viện & Học liệu" },
  { id: "BAO_CAO", label: "Báo cáo & Tổng hợp" },
  { id: "KHAC", label: "Khác" },
];

export const PRIORITY_FILTER_OPTIONS: { id: string; label: string }[] = [
  { id: "ALL", label: "Tất cả mức độ" },
  { id: "URGENT", label: "Khẩn cấp" },
  { id: "HIGH", label: "Ưu tiên cao" },
  { id: "NORMAL", label: "Bình thường" },
];

// ============================================================================
// 3. Helper Logic: filterTasksByScope
// ============================================================================

export function filterTasksByScope(
  tasks: SchoolTask[],
  scope: TaskScope,
  user?: AuthUser,
  departmentCode?: string
): SchoolTask[] {
  if (scope === "MY_TASKS") {
    if (!user) return tasks;
    return tasks.filter((t) => {
      const isLead = t.leadAssigneeName === user.name || matchesUser(t.leadAssigneeName, user);
      const hasSub = t.subTasks?.some(
        (s) => s.assigneeName === user.name || matchesUser(s.assigneeName, user)
      );
      return isLead || hasSub;
    });
  }

  if (scope === "SCHOOL_TASKS") {
    if (!user || user.role === "ADMIN") {
      return [...tasks];
    }
    return filterTasksByRole(tasks, user);
  }

  if (scope === "UNIT_TASKS") {
    const targetDept =
      departmentCode && departmentCode !== "ALL"
        ? departmentCode
        : user && user.role !== "ADMIN"
        ? user.departmentCode
        : undefined;

    if (targetDept && targetDept !== "ALL") {
      return filterTasksForTable(tasks, "ALL", "", targetDept);
    }
    return tasks.filter((t) => t.subTasks && t.subTasks.length > 0);
  }

  return tasks;
}

// ============================================================================
// 4. UnifiedTaskToolbar Component
// ============================================================================

export function UnifiedTaskToolbar({
  scope,
  onScopeChange,
  viewMode,
  onViewModeChange,
  selectedDepartment,
  onDepartmentChange,
  availableDepartments = DEFAULT_AVAILABLE_DEPARTMENTS,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedPriority,
  onPriorityChange,
  onNewTaskClick,
  canCreateTask = true,
  totalTasksCount,
  isExecutive,
  userRole,
  selectedAcademicMonth = "ALL",
  onAcademicMonthChange,
  academicYear = "2026-2027",
  monthlyTaskCounts,
}: UnifiedTaskToolbarProps) {
  const isUnitScope = scope === "UNIT_TASKS";
  const activeAcademicMonth = selectedAcademicMonth ?? "ALL";

  const academicMonths = React.useMemo(() => {
    return getAcademicMonthsForYear(academicYear);
  }, [academicYear]);

  const allYearCount = React.useMemo(() => {
    if (monthlyTaskCounts) {
      return Object.values(monthlyTaskCounts).reduce((acc, c) => acc + (c || 0), 0);
    }
    return totalTasksCount;
  }, [monthlyTaskCounts, totalTasksCount]);

  const viewModeOptions = React.useMemo(() => {
    // If explicitly specified as non-executive / non-admin, filter out executive unless viewMode is currently "executive"
    if (isExecutive !== undefined) {
      return isExecutive || viewMode === "executive"
        ? VIEW_MODE_OPTIONS
        : VIEW_MODE_OPTIONS.filter((o) => o.id !== "executive");
    }
    if (userRole !== undefined) {
      return userRole === "ADMIN" || viewMode === "executive"
        ? VIEW_MODE_OPTIONS
        : VIEW_MODE_OPTIONS.filter((o) => o.id !== "executive");
    }
    return VIEW_MODE_OPTIONS;
  }, [isExecutive, userRole, viewMode]);

  return (
    <div
      className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/90 backdrop-blur-xs p-3.5 shadow-card"
      data-slot="unified-task-toolbar"
    >
      {/* Top Row: Scope Switcher Pills, Unit Department Selector, View Mode Switcher, and Create Action */}
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        {/* Left Side: Scope Switcher + Conditional Department Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Scope Switcher Pills */}
          <div
            className="inline-flex items-center rounded-xl border border-border/80 bg-muted/40 p-1 shadow-2xs"
            role="tablist"
            aria-label="Phạm vi công việc"
          >
            {SCOPE_TABS.map((tab) => {
              const isActive = scope === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onScopeChange(tab.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
                    isActive
                      ? "bg-card text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Department Dropdown when Scope is UNIT_TASKS */}
          {isUnitScope && (
            <div className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-background px-2.5 py-1 text-xs shadow-2xs">
              <Building2 className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
              <select
                value={selectedDepartment}
                onChange={(e) => onDepartmentChange(e.target.value)}
                className="bg-transparent text-xs text-foreground font-medium outline-none cursor-pointer pr-1"
                aria-label="Chọn đơn vị triển khai"
              >
                {availableDepartments.map((dept) => (
                  <option key={dept.code} value={dept.code} className="bg-popover text-popover-foreground">
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {typeof totalTasksCount === "number" && (
            <span className="hidden sm:inline-flex items-center text-[11px] text-muted-foreground tabular-nums px-1.5 py-0.5 rounded-md bg-muted/60">
              {totalTasksCount} công việc
            </span>
          )}
        </div>

        {/* Right Side: View Mode Switcher + + Giao việc mới button */}
        <div className="flex items-center gap-2 self-end lg:self-auto">
          {/* View Mode Toggle */}
          <div
            className="inline-flex items-center rounded-xl border border-border/80 bg-muted/40 p-1 shadow-2xs"
            role="group"
            aria-label="Chế độ hiển thị"
          >
            {viewModeOptions.map((opt) => {
              const Icon = opt.icon;
              const isActive = viewMode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onViewModeChange(opt.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all cursor-pointer",
                    isActive
                      ? "bg-card text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title={`Xem dạng ${opt.label}`}
                  aria-pressed={isActive}
                >
                  <Icon className="size-3.5" strokeWidth={1.5} />
                  <span className="hidden sm:inline">{opt.label}</span>
                </button>
              );
            })}
          </div>

          {/* New Task Action Button */}
          {canCreateTask && (
            <button
              type="button"
              onClick={onNewTaskClick}
              className="inline-flex h-8.5 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 cursor-pointer"
            >
              <Plus className="size-3.5" strokeWidth={1.5} />
              <span>Giao việc mới</span>
            </button>
          )}
        </div>
      </div>

      {/* Middle Row: 12 Academic Month Operational Cycle Pill Bar */}
      <div
        className="flex items-center gap-2 overflow-x-auto pt-2 pb-0.5 border-t border-border/50 scrollbar-none"
        role="tablist"
        aria-label="Chu kỳ 12 tháng công tác năm học"
      >
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground whitespace-nowrap pr-0.5 shrink-0 select-none">
          <Calendar className="size-3.5 text-primary" strokeWidth={1.5} />
          <span className="hidden sm:inline">Năm học {academicYear}:</span>
          <span className="sm:hidden">{academicYear}:</span>
        </div>

        <div className="inline-flex items-center gap-1 rounded-xl border border-border/80 bg-muted/30 p-1 shadow-2xs shrink-0">
          {/* All Year / Cả năm tab */}
          <button
            type="button"
            role="tab"
            aria-selected={activeAcademicMonth === "ALL"}
            onClick={() => onAcademicMonthChange?.("ALL")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all cursor-pointer whitespace-nowrap",
              activeAcademicMonth === "ALL"
                ? "bg-card text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-card/40"
            )}
            title={`Tất cả các tháng công tác trong năm học ${academicYear}`}
          >
            <span>Cả năm</span>
            {allYearCount !== undefined && (
              <span
                className={cn(
                  "inline-flex items-center justify-center rounded-md px-1.5 py-0.5 text-[10px] tabular-nums font-semibold",
                  activeAcademicMonth === "ALL"
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {allYearCount}
              </span>
            )}
          </button>

          {/* 12 Operational Academic Months: Tháng 9 -> Tháng 8 */}
          {academicMonths.map((period) => {
            const isSelected = activeAcademicMonth === period.monthNumber;
            const count = monthlyTaskCounts ? monthlyTaskCounts[period.monthNumber] : undefined;

            return (
              <button
                key={period.monthNumber}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => onAcademicMonthChange?.(period.monthNumber)}
                className={cn(
                  "group inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all cursor-pointer whitespace-nowrap",
                  isSelected
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/40"
                )}
                title={period.fullLabel}
              >
                <span>{period.label}</span>
                <span
                  className={cn(
                    "hidden 2xl:inline text-[10px] font-normal transition-opacity",
                    isSelected ? "text-muted-foreground" : "text-muted-foreground/60"
                  )}
                >
                  ({period.shortDateSpan})
                </span>
                {typeof count === "number" && (
                  <span
                    className={cn(
                      "inline-flex items-center justify-center rounded-md px-1.5 py-0.5 text-[10px] tabular-nums font-semibold",
                      isSelected
                        ? "bg-primary/10 text-primary"
                        : count > 0
                        ? "bg-muted text-muted-foreground"
                        : "bg-muted/40 text-muted-foreground/50"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Row: Search Input + Category Filter + Priority Filter */}
      <div className="flex flex-col gap-2 pt-2 border-t border-border/50 sm:flex-row sm:items-center">
        {/* Search Input Bar */}
        <div className="relative flex-1 min-w-[200px]">
          <Search
            className="size-3.5 text-muted-foreground pointer-events-none absolute left-3 top-2.5"
            strokeWidth={1.5}
          />
          <input
            type="text"
            placeholder="Tìm kiếm theo tiêu đề, người phụ trách... (⌘K)"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-8.5 pl-9 pr-8 rounded-xl border border-border/70 bg-background text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label="Xóa tìm kiếm"
            >
              <X className="size-3.5" strokeWidth={1.5} />
            </button>
          )}
        </div>

        {/* Filters Group: Category and Priority */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Category Filter */}
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 bg-background px-2.5 py-1 text-xs shadow-2xs">
            <Filter className="size-3 text-muted-foreground shrink-0" strokeWidth={1.5} />
            <select
              value={selectedCategory}
              onChange={(e) => onCategoryChange(e.target.value)}
              className="bg-transparent text-xs text-foreground font-medium outline-none cursor-pointer pr-1"
              aria-label="Lọc theo danh mục"
            >
              {CATEGORY_FILTER_OPTIONS.map((cat) => (
                <option key={cat.id} value={cat.id} className="bg-popover text-popover-foreground">
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 bg-background px-2.5 py-1 text-xs shadow-2xs">
            <select
              value={selectedPriority}
              onChange={(e) => onPriorityChange(e.target.value)}
              className="bg-transparent text-xs text-foreground font-medium outline-none cursor-pointer pr-1"
              aria-label="Lọc theo mức độ ưu tiên"
            >
              {PRIORITY_FILTER_OPTIONS.map((prio) => (
                <option key={prio.id} value={prio.id} className="bg-popover text-popover-foreground">
                  {prio.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
