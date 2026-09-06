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
      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
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
              "group relative flex flex-col gap-2 rounded-xl border bg-card p-3 sm:p-4 transition-all duration-150 cursor-pointer select-none",
              "hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
              isSelected
                ? "ring-2 ring-indigo-500/40 ring-inset border-indigo-500 bg-primary/[0.04] shadow-sm z-10"
                : "border-border/50"
            )}
            data-slot="department-card"
            data-dept-id={dept.departmentId}
            data-active={isSelected ? "true" : "false"}
          >
            {/* Department name + lead */}
            <div className="flex items-start gap-2 min-w-0">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground">
                <Building2 className="size-3.5 shrink-0" strokeWidth={1.5} />
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
            <div className="space-y-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
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
                <span className="text-[11px] text-muted-foreground">
                  Tiến độ
                </span>
                <span className="text-[11px] font-mono font-semibold text-foreground tabular-nums">
                  {dept.averageProgressPercent}%
                </span>
              </div>
            </div>

            {/* Warning badges */}
            <div className="flex flex-wrap gap-1.5">
              {dept.overdueTasksCount > 0 && (
                <Badge variant="rose" className="text-[10px] h-4 px-1.5">
                  {dept.overdueTasksCount} trễ hạn
                </Badge>
              )}
              {dept.blockedTasksCount > 0 && (
                <Badge variant="amber" className="text-[10px] h-4 px-1.5">
                  {dept.blockedTasksCount} vướng mắc
                </Badge>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default DepartmentProgressMatrix;
