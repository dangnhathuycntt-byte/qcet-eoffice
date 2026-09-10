import * as React from "react";

export default function OrgLoading() {
  return (
    <div
      className="max-w-[1440px] w-full mx-auto space-y-6 px-4 sm:px-6 py-4 pb-24 md:pb-10 animate-pulse"
      aria-label="Đang tải sơ đồ cơ cấu tổ chức..."
    >
      {/* Page Header Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-5 w-52 rounded-full bg-muted/70" />
          <div className="h-7 w-72 max-w-full rounded-md bg-muted/80" />
          <div className="h-4 w-96 max-w-full rounded bg-muted/50" />
        </div>

        <div className="flex items-center gap-2.5">
          <div className="h-8.5 w-24 rounded-lg bg-muted/60 border border-border/60" />
          <div className="h-8.5 w-24 rounded-lg bg-muted/60 border border-border/60" />
        </div>
      </div>

      {/* Directory Metrics KPI Cards Skeleton */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3.5 rounded-xl border border-border/70 bg-card p-4 shadow-2xs"
          >
            <div className="size-11 rounded-lg bg-muted/60 shrink-0" />
            <div className="space-y-1.5 flex-1">
              <div className="h-6 w-16 rounded bg-muted/80" />
              <div className="h-3.5 w-28 rounded bg-muted/50" />
            </div>
          </div>
        ))}
      </div>

      {/* Search & Filter Bar Skeleton */}
      <div className="rounded-xl border border-border/70 bg-card p-3 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
          <div className="h-9 w-full sm:w-80 rounded-lg bg-muted/40 border border-border/50" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-24 rounded-lg bg-muted/50" />
            <div className="h-8 w-24 rounded-lg bg-muted/50" />
            <div className="h-8 w-24 rounded-lg bg-muted/50" />
          </div>
        </div>
      </div>

      {/* Department Cards Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-border/60 bg-card p-4 space-y-3 shadow-2xs"
          >
            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <div className="space-y-1">
                <div className="h-4 w-40 rounded bg-muted/70" />
                <div className="h-3 w-20 rounded bg-muted/40" />
              </div>
              <div className="h-5 w-14 rounded-full bg-muted/50" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-full bg-muted/60 shrink-0" />
                <div className="space-y-1 flex-1">
                  <div className="h-3.5 w-32 rounded bg-muted/70" />
                  <div className="h-2.5 w-20 rounded bg-muted/40" />
                </div>
              </div>
              <div className="pt-2 border-t border-border/30 flex items-center justify-between">
                <div className="h-3 w-20 rounded bg-muted/40" />
                <div className="h-3 w-16 rounded bg-muted/40" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
