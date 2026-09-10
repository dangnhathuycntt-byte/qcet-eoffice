"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, LayoutGrid, TableProperties, BarChart3, ArrowUpDown, ChevronRight, X, ExternalLink } from "lucide-react";
import type { DepartmentHealthSummary } from "@/lib/executive-matrix-aggregator";
export type { DepartmentHealthSummary };
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type DepartmentMatrixViewMode = "cards" | "compact_table" | "ranking";

export interface DepartmentProgressMatrixProps {
  departments: DepartmentHealthSummary[];
  selectedDepartment?: string;
  onSelectDepartment?: (deptId: string) => void;
  viewMode?: DepartmentMatrixViewMode | "grid" | "table" | "chart";
  defaultViewMode?: DepartmentMatrixViewMode | "grid" | "table" | "chart";
  onViewModeChange?: (mode: DepartmentMatrixViewMode) => void;
  navigateToTasks?: boolean;
}

export function getDepartmentTasksUrl(deptId: string): string {
  return `/tasks?scope=school&dept=${encodeURIComponent(deptId)}`;
}

function normalizeMode(mode?: string): DepartmentMatrixViewMode {
  if (mode === "compact_table" || mode === "table") return "compact_table";
  if (mode === "ranking" || mode === "chart") return "ranking";
  return "cards";
}

function getDeptId(dept: DepartmentHealthSummary): string {
  return dept.departmentId || dept.code || dept.departmentCode || "";
}

function getDeptName(dept: DepartmentHealthSummary): string {
  return dept.departmentName || (dept as { name?: string }).name || getDeptId(dept);
}

function getDeptOverdueCount(dept: DepartmentHealthSummary): number {
  return dept.overdueTasksCount ?? dept.overdueTasks ?? 0;
}

function getDeptCompletedCount(dept: DepartmentHealthSummary): number {
  return dept.completedTasksCount ?? dept.completedTasks ?? 0;
}

function getDeptInProgressCount(dept: DepartmentHealthSummary): number {
  return dept.inProgressTasksCount ?? dept.inProgressTasks ?? 0;
}

function getDeptProgressPercent(dept: DepartmentHealthSummary): number {
  return dept.averageProgressPercent ?? dept.completionRate ?? 0;
}

function progressBarColor(percent: number): string {
  if (percent >= 80) return "bg-emerald-500";
  if (percent >= 50) return "bg-amber-500";
  return "bg-rose-500";
}

function progressTextColor(percent: number): string {
  if (percent >= 80) return "text-emerald-600";
  if (percent >= 50) return "text-amber-600";
  return "text-rose-600";
}

export function sortDepartmentsByOverdue(
  departments: DepartmentHealthSummary[],
  descending = true
): DepartmentHealthSummary[] {
  return [...departments].sort((a, b) => {
    const overdueA = getDeptOverdueCount(a);
    const overdueB = getDeptOverdueCount(b);
    if (overdueA !== overdueB) {
      return descending ? overdueB - overdueA : overdueA - overdueB;
    }
    const progA = getDeptProgressPercent(a);
    const progB = getDeptProgressPercent(b);
    return progA - progB;
  });
}

export function sortDepartmentsByProgress(
  departments: DepartmentHealthSummary[],
  descending = true
): DepartmentHealthSummary[] {
  return [...departments].sort((a, b) => {
    const progA = getDeptProgressPercent(a);
    const progB = getDeptProgressPercent(b);
    if (progA !== progB) {
      return descending ? progB - progA : progA - progB;
    }
    const overdueA = getDeptOverdueCount(a);
    const overdueB = getDeptOverdueCount(b);
    return overdueA - overdueB;
  });
}

export function getDepartmentCardData(departments: DepartmentHealthSummary[]) {
  return departments.map((dept) => ({
    ...dept,
    progressColor: progressBarColor(getDeptProgressPercent(dept)),
  }));
}

function MiniProgressRing({ percent, colorClass }: { percent: number; colorClass: string }) {
  const radius = 9;
  const stroke = 2.2;
  const normalizedRadius = radius - stroke * 0.5;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference;

  return (
    <svg height={radius * 2} width={radius * 2} className="shrink-0 -rotate-90">
      <circle
        stroke="currentColor"
        fill="transparent"
        strokeWidth={stroke}
        r={normalizedRadius}
        cx={radius}
        cy={radius}
        className="text-muted/30"
      />
      <circle
        stroke="currentColor"
        fill="transparent"
        strokeWidth={stroke}
        strokeDasharray={`${circumference} ${circumference}`}
        style={{ strokeDashoffset }}
        strokeLinecap="round"
        r={normalizedRadius}
        cx={radius}
        cy={radius}
        className={colorClass}
      />
    </svg>
  );
}

export function DepartmentProgressMatrix({
  departments,
  selectedDepartment = "ALL",
  onSelectDepartment = () => {},
  viewMode: controlledViewMode,
  defaultViewMode = "cards",
  onViewModeChange,
  navigateToTasks = false,
}: DepartmentProgressMatrixProps) {
  let router: ReturnType<typeof useRouter> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    router = useRouter();
  } catch {
    // Gracefully handle test / non-App Router SSR environments
  }
  const [internalViewMode, setInternalViewMode] = React.useState<DepartmentMatrixViewMode>(() =>
    normalizeMode(defaultViewMode)
  );
  const [sortByOverdue, setSortByOverdue] = React.useState<boolean>(true);
  const [sortAscending, setSortAscending] = React.useState<boolean>(false);
  const [rankingSortBy, setRankingSortBy] = React.useState<"progress" | "overdue">("progress");

  const currentViewMode = controlledViewMode ? normalizeMode(controlledViewMode) : internalViewMode;

  const handleViewModeChange = (mode: DepartmentMatrixViewMode) => {
    if (!controlledViewMode) {
      setInternalViewMode(mode);
    }
    onViewModeChange?.(mode);
  };

  const cards = React.useMemo(() => getDepartmentCardData(departments), [departments]);

  const displayedTableDepartments = React.useMemo(() => {
    if (sortByOverdue) {
      return sortDepartmentsByOverdue(departments, !sortAscending);
    }
    return departments;
  }, [departments, sortByOverdue, sortAscending]);

  const displayedRankingDepartments = React.useMemo(() => {
    if (rankingSortBy === "overdue") {
      return sortDepartmentsByOverdue(departments, true);
    }
    return sortDepartmentsByProgress(departments, true);
  }, [departments, rankingSortBy]);

  const selectedDeptObj = React.useMemo(() => {
    if (!selectedDepartment || selectedDepartment === "ALL") return null;
    return departments.find((d) => getDeptId(d) === selectedDepartment);
  }, [departments, selectedDepartment]);

  const toggleSortByOverdue = () => {
    if (!sortByOverdue) {
      setSortByOverdue(true);
      setSortAscending(false);
    } else {
      setSortAscending((prev) => !prev);
    }
  };

  return (
    <div className="space-y-3" data-slot="department-progress-matrix-container">
      {/* View mode toggle toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground">
            <Building2 className="size-3.5 shrink-0" strokeWidth={1.5} />
          </div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
            Tiến độ các đơn vị
          </span>
          <span className="text-xs text-muted-foreground font-mono tabular-nums">
            ({departments.length})
          </span>

          {selectedDeptObj && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-medium">
              <span className="truncate max-w-[150px] sm:max-w-[220px]">
                Đang lọc: {getDeptName(selectedDeptObj)}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectDepartment("ALL");
                }}
                className="p-0.5 hover:bg-indigo-100 rounded-full transition-colors cursor-pointer text-indigo-600 hover:text-indigo-900"
                aria-label="Bỏ chọn đơn vị"
                title="Xem toàn trường"
              >
                <X className="size-3" strokeWidth={1.5} />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/30 p-0.5 shrink-0">
          <button
            type="button"
            aria-label="Chế độ xếp hạng"
            title="Chế độ xếp hạng tiến độ (Ranking Bar Chart)"
            onClick={() => handleViewModeChange("ranking")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all select-none",
              currentViewMode === "ranking"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
            data-mode="ranking"
            aria-pressed={currentViewMode === "ranking"}
          >
            <BarChart3 className="size-3.5" strokeWidth={1.5} />
            <span className="hidden sm:inline">Xếp hạng</span>
          </button>
          <button
            type="button"
            aria-label="Chế độ thẻ"
            title="Chế độ thẻ (Cards View)"
            onClick={() => handleViewModeChange("cards")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all select-none",
              currentViewMode === "cards"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
            data-mode="cards"
            aria-pressed={currentViewMode === "cards"}
          >
            <LayoutGrid className="size-3.5" strokeWidth={1.5} />
            <span className="hidden sm:inline">Thẻ</span>
          </button>
          <button
            type="button"
            aria-label="Chế độ bảng tinh gọn"
            title="Chế độ bảng tinh gọn (Compact Table View)"
            onClick={() => handleViewModeChange("compact_table")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all select-none",
              currentViewMode === "compact_table"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
            data-mode="compact_table"
            aria-pressed={currentViewMode === "compact_table"}
          >
            <TableProperties className="size-3.5" strokeWidth={1.5} />
            <span className="hidden sm:inline">Bảng tinh gọn</span>
          </button>
        </div>
      </div>

      {/* Ranking Bar Chart View */}
      {currentViewMode === "ranking" ? (
        <div className="space-y-3" data-slot="department-ranking-chart">
          {/* Sorting controls */}
          <div className="flex items-center justify-between gap-2 px-1 text-xs">
            <span className="text-muted-foreground font-medium">
              Xếp hạng theo {rankingSortBy === "progress" ? "tỷ lệ hoàn thành (cao xuống thấp)" : "số lượng việc trễ hạn (cần đôn đốc)"}
            </span>
            <div className="flex items-center gap-1 rounded-md border border-border/60 bg-muted/30 p-0.5">
              <button
                type="button"
                onClick={() => setRankingSortBy("progress")}
                className={cn(
                  "px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer",
                  rankingSortBy === "progress"
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Tiến độ
              </button>
              <button
                type="button"
                onClick={() => setRankingSortBy("overdue")}
                className={cn(
                  "px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer",
                  rankingSortBy === "overdue"
                    ? "bg-background text-rose-600 shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Cần đôn đốc
              </button>
            </div>
          </div>

          {/* Ranking list */}
          <div className="divide-y divide-border/40 rounded-xl border border-border/80 bg-card shadow-2xs overflow-hidden">
            {displayedRankingDepartments.map((dept, index) => {
              const deptId = getDeptId(dept);
              const deptName = getDeptName(dept);
              const isSelected = selectedDepartment === deptId;
              const overdueCount = getDeptOverdueCount(dept);
              const inProgressCount = getDeptInProgressCount(dept);
              const completedCount = getDeptCompletedCount(dept);
              const progressPercent = getDeptProgressPercent(dept);
              const barColor = progressBarColor(progressPercent);
              const handleRowClick = () => {
                const activeRouter = router;
                if (navigateToTasks && activeRouter) {
                  activeRouter.push(getDepartmentTasksUrl(deptId));
                }
                onSelectDepartment(isSelected ? "ALL" : deptId);
              };

              return (
                <div
                  key={deptId}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={handleRowClick}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleRowClick();
                    }
                  }}
                  className={cn(
                    "group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 transition-colors cursor-pointer select-none",
                    isSelected
                      ? "bg-indigo-500/[0.08] hover:bg-indigo-500/[0.12]"
                      : "hover:bg-muted/30",
                    "focus-visible:outline-none focus-visible:bg-muted/50"
                  )}
                  data-slot="department-ranking-row"
                  data-dept-id={deptId}
                  data-active={isSelected ? "true" : "false"}
                >
                  {/* Rank index & Info */}
                  <div className="flex items-center gap-3 min-w-0 flex-1 sm:max-w-xs">
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-md font-mono text-xs font-bold tabular-nums",
                        index === 0
                          ? "bg-amber-100 text-amber-800 border border-amber-300"
                          : index === 1
                          ? "bg-slate-200 text-slate-700 border border-slate-300"
                          : index === 2
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-muted/60 text-muted-foreground"
                      )}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-semibold text-foreground truncate leading-tight">
                        {deptName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {dept.leadName}
                      </p>
                    </div>
                  </div>

                  {/* Horizontal Progress Bar */}
                  <div className="flex items-center gap-3 flex-1 px-1 sm:px-4">
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className={cn("h-full rounded-full transition-all duration-500 ease-out", barColor)}
                        style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
                      />
                    </div>
                    <span className="w-12 text-right text-xs sm:text-sm font-bold font-mono tabular-nums text-foreground shrink-0">
                      {progressPercent}%
                    </span>
                  </div>

                  {/* Metrics & Filter status */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 text-xs">
                    <div className="flex items-center gap-2 text-muted-foreground font-mono tabular-nums">
                      <span className="hidden md:inline" title="Hoàn thành">HT: <strong className="text-foreground font-medium">{completedCount}</strong></span>
                      <span className="hidden md:inline" title="Đang làm">ĐL: <strong className="text-foreground font-medium">{inProgressCount}</strong></span>
                      {overdueCount > 0 ? (
                        <Badge variant="rose" className="text-xs h-5 px-1.5 font-mono tabular-nums">
                          {overdueCount} trễ
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground/60 hidden md:inline">0 trễ</span>
                      )}
                    </div>

                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors shrink-0",
                        isSelected
                          ? "bg-indigo-600 text-white font-semibold shadow-2xs"
                          : "bg-muted/60 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                      )}
                    >
                      <span>{isSelected ? "Đang chọn" : "Lọc"}</span>
                      <ChevronRight className="size-3 shrink-0" strokeWidth={1.5} />
                    </span>

                    <Link
                      href={getDepartmentTasksUrl(deptId)}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
                      title={`Xem danh sách nhiệm vụ của ${deptName}`}
                      aria-label={`Xem nhiệm vụ của ${deptName} tại Không gian Nhiệm vụ`}
                      data-slot="dept-task-link"
                    >
                      <span className="hidden sm:inline">Nhiệm vụ</span>
                      <ChevronRight className="size-3 shrink-0" strokeWidth={1.5} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : currentViewMode === "cards" ? (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          data-slot="department-progress-matrix"
        >
          {cards.map((dept) => {
            const deptId = getDeptId(dept);
            const deptName = getDeptName(dept);
            const isSelected = selectedDepartment === deptId;
            const overdueCount = getDeptOverdueCount(dept);
            const inProgressCount = getDeptInProgressCount(dept);
            const completedCount = getDeptCompletedCount(dept);
            const progressPercent = getDeptProgressPercent(dept);
            const blockedCount = dept.blockedTasksCount ?? 0;

            return (
              <div
                key={deptId}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onClick={() => {
                  onSelectDepartment(isSelected ? "ALL" : deptId);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectDepartment(isSelected ? "ALL" : deptId);
                  }
                }}
                className={cn(
                  "group relative flex flex-col gap-3 rounded-xl border bg-card p-4 transition-all duration-200 cursor-pointer select-none",
                  "hover:-translate-y-0.5 hover:shadow-xs",
                  isSelected
                    ? "ring-2 ring-indigo-500/30 ring-inset border-indigo-500 bg-indigo-500/[0.04] shadow-xs z-10"
                    : "border-border/60 hover:border-indigo-500/30 hover:bg-muted/15",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                )}
                data-slot="department-card"
                data-dept-id={deptId}
                data-active={isSelected ? "true" : "false"}
              >
                {/* Department name + lead */}
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
                    <Building2 className="size-4 shrink-0" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate leading-tight">
                      {deptName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {dept.leadName}
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500 ease-out",
                        dept.progressColor
                      )}
                      style={{
                        width: `${Math.min(100, Math.max(0, progressPercent))}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium">
                      Tiến độ
                    </span>
                    <span className="text-xs sm:text-[13px] font-bold font-mono tabular-nums text-foreground">
                      {progressPercent}%
                    </span>
                  </div>
                </div>

                {/* Child stats (Hoàn thành / Đang làm / Trễ) */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40 text-xs sm:text-[12.5px] font-medium text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span>Hoàn thành:</span>
                    <span className="font-semibold text-foreground font-mono tabular-nums">
                      {completedCount}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span>Đang làm:</span>
                    <span className="font-semibold text-foreground font-mono tabular-nums">
                      {inProgressCount}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span>Trễ:</span>
                    <span
                      className={cn(
                        "font-semibold font-mono tabular-nums",
                        overdueCount > 0
                          ? "text-rose-600"
                          : "text-foreground"
                      )}
                    >
                      {overdueCount}
                    </span>
                  </span>
                </div>

                {/* Warning badges */}
                {(overdueCount > 0 || blockedCount > 0) && (
                  <div className="flex flex-wrap gap-1.5">
                    {overdueCount > 0 && (
                      <Badge variant="rose" className="text-xs h-5 px-2">
                        {overdueCount} trễ hạn
                      </Badge>
                    )}
                    {blockedCount > 0 && (
                      <Badge variant="amber" className="text-xs h-5 px-2">
                        {blockedCount} vướng mắc
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Compact Hairline Table View */
        <div
          className="overflow-x-auto rounded-xl border border-border/80 bg-card shadow-2xs"
          data-slot="department-progress-matrix-table-container"
        >
          <table
            className="w-full text-left text-xs border-collapse"
            data-slot="department-progress-matrix-table"
          >
            <thead className="bg-muted/40 border-b border-border/60">
              <tr>
                <th className="p-2.5 font-medium text-muted-foreground whitespace-nowrap">
                  Đơn vị
                </th>
                <th className="p-2.5 font-medium text-muted-foreground whitespace-nowrap hidden md:table-cell">
                  Lãnh đạo phụ trách
                </th>
                <th className="p-2.5 font-medium text-muted-foreground whitespace-nowrap">
                  Tiến độ
                </th>
                <th
                  className="p-2.5 font-medium text-muted-foreground text-center cursor-pointer hover:text-foreground select-none whitespace-nowrap transition-colors"
                  onClick={toggleSortByOverdue}
                  title="Nhấn để sắp xếp theo số lượng trễ hạn"
                >
                  <span className="inline-flex items-center gap-1">
                    <span>Quá hạn</span>
                    <ArrowUpDown className="size-3 text-muted-foreground" strokeWidth={1.5} />
                  </span>
                </th>
                <th className="p-2.5 font-medium text-muted-foreground text-center whitespace-nowrap">
                  Đang làm
                </th>
                <th className="p-2.5 font-medium text-muted-foreground text-center whitespace-nowrap">
                  Hoàn thành
                </th>
                <th className="p-2.5 font-medium text-muted-foreground text-right whitespace-nowrap pr-3">
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {displayedTableDepartments.map((dept) => {
                const deptId = getDeptId(dept);
                const deptName = getDeptName(dept);
                const isSelected = selectedDepartment === deptId;
                const overdueCount = getDeptOverdueCount(dept);
                const inProgressCount = getDeptInProgressCount(dept);
                const completedCount = getDeptCompletedCount(dept);
                const progressPercent = getDeptProgressPercent(dept);
                const ringColor = progressTextColor(progressPercent);

                return (
                  <tr
                    key={deptId}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    onClick={() => onSelectDepartment(isSelected ? "ALL" : deptId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectDepartment(isSelected ? "ALL" : deptId);
                      }
                    }}
                    className={cn(
                      "group transition-colors duration-150 cursor-pointer select-none",
                      isSelected
                        ? "bg-indigo-500/[0.08] hover:bg-indigo-500/[0.12]"
                        : "hover:bg-muted/35",
                      "focus-visible:outline-none focus-visible:bg-muted/50"
                    )}
                    data-slot="department-table-row"
                    data-dept-id={deptId}
                    data-active={isSelected ? "true" : "false"}
                  >
                    {/* Đơn vị */}
                    <td className="p-2.5 font-medium text-foreground">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground">
                          <Building2 className="size-3.5 shrink-0" strokeWidth={1.5} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate leading-tight">
                            {deptName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate md:hidden">
                            {dept.leadName}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Lãnh đạo phụ trách */}
                    <td className="p-2.5 text-muted-foreground whitespace-nowrap hidden md:table-cell">
                      {dept.leadName}
                    </td>

                    {/* Tiến độ */}
                    <td className="p-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <MiniProgressRing percent={progressPercent} colorClass={ringColor} />
                        <span className="font-mono tabular-nums font-bold text-foreground">
                          {progressPercent}%
                        </span>
                      </div>
                    </td>

                    {/* Quá hạn */}
                    <td className="p-2.5 text-center whitespace-nowrap">
                      {overdueCount > 0 ? (
                        <Badge variant="rose" className="text-xs h-5 px-1.5 font-mono tabular-nums">
                          {overdueCount} trễ
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground font-mono tabular-nums">0</span>
                      )}
                    </td>

                    {/* Đang làm */}
                    <td className="p-2.5 text-center font-mono tabular-nums font-medium text-foreground whitespace-nowrap">
                      {inProgressCount}
                    </td>

                    {/* Hoàn thành */}
                    <td className="p-2.5 text-center font-mono tabular-nums font-medium text-foreground whitespace-nowrap">
                      {completedCount}
                    </td>

                    {/* Hành động */}
                    <td className="p-2.5 text-right whitespace-nowrap pr-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium transition-colors",
                          isSelected
                            ? "bg-indigo-600 text-white font-semibold shadow-2xs"
                            : "bg-muted/60 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                        )}
                      >
                        <span>{isSelected ? "Đang chọn" : "Xem"}</span>
                        <ChevronRight className="size-3 shrink-0" strokeWidth={1.5} />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default DepartmentProgressMatrix;
