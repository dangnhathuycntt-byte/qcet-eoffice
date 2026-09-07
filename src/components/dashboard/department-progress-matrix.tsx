"use client";

import * as React from "react";
import { Building2 } from "lucide-react";
import type { DepartmentHealthSummary } from "@/lib/executive-matrix-aggregator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface DepartmentProgressMatrixProps {
  departments: DepartmentHealthSummary[];
  selectedDepartment: string;
  onSelectDepartment: (deptId: string) => void;
}

function progressBarColor(percent: number): string {
  if (percent >= 80) return "bg-emerald-500";
  if (percent >= 50) return "bg-amber-500";
  return "bg-rose-500";
}

export function getDepartmentCardData(departments: DepartmentHealthSummary[]) {
  return departments.map((dept) => ({
    ...dept,
    progressColor: progressBarColor(dept.averageProgressPercent),
  }));
}

export function DepartmentProgressMatrix({
  departments,
  selectedDepartment,
  onSelectDepartment,
}: DepartmentProgressMatrixProps) {
  const cards = getDepartmentCardData(departments);

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      data-slot="department-progress-matrix"
    >
      {cards.map((dept) => {
        const isSelected = selectedDepartment === dept.departmentId;

        return (
          <div
            key={dept.departmentId}
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            onClick={() => {
              onSelectDepartment(isSelected ? "ALL" : dept.departmentId);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectDepartment(isSelected ? "ALL" : dept.departmentId);
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
            data-dept-id={dept.departmentId}
            data-active={isSelected ? "true" : "false"}
          >
            {/* Department name + lead */}
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
                <Building2 className="size-4 shrink-0" strokeWidth={1.5} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate leading-tight">
                  {dept.departmentName}
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
                    width: `${Math.min(100, Math.max(0, dept.averageProgressPercent))}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">
                  Tiến độ
                </span>
                <span className="text-xs sm:text-[13px] font-bold font-mono tabular-nums text-foreground">
                  {dept.averageProgressPercent}%
                </span>
              </div>
            </div>

            {/* Child stats (Hoàn thành / Đang làm / Trễ) */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40 text-xs sm:text-[12.5px] font-medium text-muted-foreground">
              <span className="flex items-center gap-1">
                <span>Hoàn thành:</span>
                <span className="font-semibold text-foreground font-mono tabular-nums">
                  {dept.completedTasksCount}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <span>Đang làm:</span>
                <span className="font-semibold text-foreground font-mono tabular-nums">
                  {dept.inProgressTasksCount}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <span>Trễ:</span>
                <span
                  className={cn(
                    "font-semibold font-mono tabular-nums",
                    dept.overdueTasksCount > 0
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-foreground"
                  )}
                >
                  {dept.overdueTasksCount}
                </span>
              </span>
            </div>

            {/* Warning badges */}
            {(dept.overdueTasksCount > 0 || dept.blockedTasksCount > 0) && (
              <div className="flex flex-wrap gap-1.5">
                {dept.overdueTasksCount > 0 && (
                  <Badge variant="rose" className="text-xs h-5 px-2">
                    {dept.overdueTasksCount} trễ hạn
                  </Badge>
                )}
                {dept.blockedTasksCount > 0 && (
                  <Badge variant="amber" className="text-xs h-5 px-2">
                    {dept.blockedTasksCount} vướng mắc
                  </Badge>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default DepartmentProgressMatrix;
