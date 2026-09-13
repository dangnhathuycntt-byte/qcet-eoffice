"use client";

import * as React from "react";
import Link from "next/link";
import { Building2, ChevronRight } from "lucide-react";
import { summarizeDepartmentAttention } from "@/lib/executive-matrix-aggregator";
import { getDepartmentTasksUrl } from "@/components/dashboard/department-progress-matrix";

/** Minimal row shape the preview renders; a DepartmentHealthSummary satisfies it. */
export interface DepartmentAttentionRow {
  departmentId: string;
  departmentName?: string;
  overdueTasksCount?: number;
  overdueTasks?: number;
  blockedTasksCount?: number;
  completedTasksCount?: number;
  completedTasks?: number;
  totalTasksCount?: number;
  totalTasks?: number;
}

export interface DepartmentAttentionPreviewProps {
  departments: DepartmentAttentionRow[];
  /** Preview cap. The dashboard shows at most 5 rows. */
  limit?: number;
  className?: string;
}

/**
 * Compact dashboard preview of the units that need attention.
 *
 * Attention = overdue or blocked tasks only (plan T05.1 — no progress threshold).
 * The full 17/11-unit ranking, medals and per-row colour bars stay on the
 * dedicated matrix surface; this is the quiet dashboard summary.
 */
export function DepartmentAttentionPreview({
  departments,
  limit = 5,
  className,
}: DepartmentAttentionPreviewProps) {
  const { attention, attentionCount, preview } = summarizeDepartmentAttention(
    departments,
    limit
  );

  return (
    <section
      data-slot="department-attention-preview"
      aria-label="Đơn vị cần chú ý"
      className={className}
    >
      <div className="flex items-baseline justify-between gap-3 px-1 pb-2">
        <h2 className="text-sm font-semibold text-foreground tracking-tight">
          Đơn vị cần chú ý
        </h2>
        {attentionCount > 0 && (
          <span className="text-xs text-muted-foreground font-mono tabular-nums">
            {attentionCount} đơn vị
          </span>
        )}
      </div>

      {attentionCount === 0 ? (
        <p
          className="rounded-xl border border-border/60 bg-muted/20 px-3.5 py-3 text-xs text-muted-foreground"
          data-slot="department-attention-empty"
        >
          Không có đơn vị có việc quá hạn hoặc bị chặn trong phạm vi này
        </p>
      ) : (
        <ul className="divide-y divide-border/50 rounded-xl border border-border/60 bg-card">
          {preview.map((dept) => {
            const deptId = dept.departmentId;
            const overdue = dept.overdueTasksCount ?? dept.overdueTasks ?? 0;
            const blocked = dept.blockedTasksCount ?? 0;
            const completed = dept.completedTasksCount ?? dept.completedTasks ?? 0;
            const total = dept.totalTasksCount ?? dept.totalTasks ?? 0;
            return (
              <li
                key={deptId}
                className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5"
                data-slot="department-attention-row"
                data-department-id={deptId}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Building2 className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                    <span className="truncate text-xs font-semibold text-foreground">
                      {dept.departmentName}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    {overdue > 0 && (
                      <span className="font-mono tabular-nums text-rose-700 font-medium">
                        {overdue} quá hạn
                      </span>
                    )}
                    {blocked > 0 && (
                      <span className="font-mono tabular-nums text-rose-700 font-medium">
                        {blocked} bị chặn
                      </span>
                    )}
                    <span className="font-mono tabular-nums">
                      Hoàn thành {completed}/{total}
                    </span>
                  </div>
                </div>
                <Link
                  href={getDepartmentTasksUrl(deptId)}
                  className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-primary hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
                  aria-label={`Xem nhiệm vụ của ${dept.departmentName}`}
                >
                  <span>Xem nhiệm vụ</span>
                  <ChevronRight className="size-3" strokeWidth={1.5} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {attentionCount > preview.length && (
        <div className="pt-2 px-1">
          <Link
            href="/tasks?view=table"
            className="text-xs font-medium text-primary hover:underline"
            data-slot="department-attention-view-all"
          >
            Xem tất cả {attentionCount} đơn vị cần chú ý
          </Link>
        </div>
      )}
    </section>
  );
}

export default DepartmentAttentionPreview;
